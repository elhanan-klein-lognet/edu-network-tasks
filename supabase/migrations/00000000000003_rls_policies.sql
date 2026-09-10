-- ============================================================================
-- Row Level Security policies.
--
-- Complex, cross-table visibility (tasks <-> task_assignees <-> projects)
-- would recurse if each table's policy directly queried the others while
-- RLS is active on all of them. The fix: SECURITY DEFINER helper functions
-- (can_view_task / can_view_project) owned by the table owner (postgres),
-- which — per standard Postgres behavior — bypass RLS on the tables they
-- query internally. Every policy that needs cross-table visibility logic
-- calls one of these functions instead of querying the other table
-- directly, so there is exactly one place each rule is implemented and no
-- policy-evaluates-policy cycle.
-- ============================================================================

alter table public.institutions enable row level security;
alter table public.users enable row level security;
alter table public.boards enable row level security;
alter table public.board_custom_field_definitions enable row level security;
alter table public.task_statuses enable row level security;
alter table public.task_priorities enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_project_links enable row level security;
alter table public.task_activity_log enable row level security;

-- ----------------------------------------------------------------------------
-- institutions
-- ----------------------------------------------------------------------------
create policy institutions_select on public.institutions for select
  to authenticated
  using (
    public.current_user_role() in ('super_admin', 'network_admin')
    or id = public.current_user_institution_id()
  );

create policy institutions_write on public.institutions for all
  to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
create policy users_select on public.users for select
  to authenticated
  using (
    public.current_user_role() in ('super_admin', 'network_admin')
    or id = auth.uid()
    or (
      public.current_user_role() = 'institution_manager'
      and institution_id = public.current_user_institution_id()
    )
  );

-- Regular invite/role-change flows go through the service-role client in
-- the admin panel server actions (bypasses RLS). This policy only covers
-- a super_admin acting through the normal authenticated client.
create policy users_write on public.users for update
  to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

-- Deliberately NOT adding a "users may update their own row" policy here.
-- RLS is row-level, not column-level: a policy like
--   using (id = auth.uid()) with check (id = auth.uid())
-- would let any signed-in user rewrite their OWN role/institution_id too
-- (e.g. self-promote to super_admin), since USING/WITH CHECK can't compare
-- old.role to new.role on their own — that needs a BEFORE UPDATE trigger
-- that pins role/institution_id/is_active back to their old values whenever
-- the acting user isn't super_admin. Not implemented yet because no MVP
-- screen needs self-service profile editing (only super_admin edits users,
-- via users_write above); add that trigger FIRST if this policy is ever
-- introduced.

-- ----------------------------------------------------------------------------
-- boards
-- ----------------------------------------------------------------------------
create policy boards_select on public.boards for select
  to authenticated
  using (
    public.current_user_role() in ('super_admin', 'network_admin')
    or institution_id is null -- network-wide board, visible to everyone
    or institution_id = public.current_user_institution_id()
  );

create policy boards_write on public.boards for all
  to authenticated
  using (public.current_user_role() in ('super_admin', 'network_admin'))
  with check (public.current_user_role() in ('super_admin', 'network_admin'));

-- ----------------------------------------------------------------------------
-- board_custom_field_definitions (visibility follows the parent board)
-- ----------------------------------------------------------------------------
create policy board_custom_field_definitions_select on public.board_custom_field_definitions for select
  to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and (
          public.current_user_role() in ('super_admin', 'network_admin')
          or b.institution_id is null
          or b.institution_id = public.current_user_institution_id()
        )
    )
  );

create policy board_custom_field_definitions_write on public.board_custom_field_definitions for all
  to authenticated
  using (public.current_user_role() in ('super_admin', 'network_admin'))
  with check (public.current_user_role() in ('super_admin', 'network_admin'));

-- ----------------------------------------------------------------------------
-- task_statuses / task_priorities — readable by everyone signed in,
-- editable only by super_admin (section 3.3)
-- ----------------------------------------------------------------------------
create policy task_statuses_select on public.task_statuses for select to authenticated using (true);
create policy task_statuses_write on public.task_statuses for all
  to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

create policy task_priorities_select on public.task_priorities for select to authenticated using (true);
create policy task_priorities_write on public.task_priorities for all
  to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- can_view_task / can_view_project — the shared visibility rule (section 2 /
-- 5): institution_manager sees their institution's tasks plus network-wide
-- tasks assigned to them; employee sees only tasks assigned to them.
-- ----------------------------------------------------------------------------
create or replace function public.can_view_task(p_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_institution_id uuid := public.current_user_institution_id();
  v_task_institution_id uuid;
  v_is_assignee boolean;
begin
  if v_role in ('super_admin', 'network_admin') then
    return true;
  end if;

  select t.institution_id into v_task_institution_id
  from public.tasks t
  where t.id = p_task_id;

  if v_task_institution_id is null then
    return exists (
      select 1 from public.task_assignees ta
      where ta.task_id = p_task_id and ta.user_id = auth.uid()
    );
  end if;

  if v_role = 'institution_manager' then
    if v_task_institution_id = v_user_institution_id then
      return true;
    end if;
  end if;

  select exists (
    select 1 from public.task_assignees ta
    where ta.task_id = p_task_id and ta.user_id = auth.uid()
  ) into v_is_assignee;

  return v_is_assignee;
end;
$$;

grant execute on function public.can_view_task(uuid) to authenticated;

comment on function public.can_view_task(uuid) is
  'SECURITY DEFINER: queries tasks/task_assignees bypassing their own RLS (owned by the table owner), so tasks<->task_assignees policies never evaluate each other and cannot recurse. Single source of truth for "who can see this task" (section 2).';

create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_role() in ('super_admin', 'network_admin')
    or exists (
      select 1 from public.task_project_links tpl
      where tpl.project_id = p_project_id and public.can_view_task(tpl.task_id)
    );
$$;

grant execute on function public.can_view_project(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create policy projects_select on public.projects for select
  to authenticated
  using (public.can_view_project(id));

create policy projects_write on public.projects for all
  to authenticated
  using (public.current_user_role() in ('super_admin', 'network_admin'))
  with check (public.current_user_role() in ('super_admin', 'network_admin'));

-- ----------------------------------------------------------------------------
-- tasks
-- ----------------------------------------------------------------------------
create policy tasks_select on public.tasks for select
  to authenticated
  using (public.can_view_task(id));

create policy tasks_insert on public.tasks for insert
  to authenticated
  with check (
    public.current_user_role() in ('super_admin', 'network_admin')
    or (
      public.current_user_role() = 'institution_manager'
      and exists (
        select 1 from public.boards b
        where b.id = board_id
          and (b.institution_id = public.current_user_institution_id() or b.institution_id is null)
      )
    )
  );

-- Full update rights for admins/institution managers on their own scope;
-- employees are handled by the narrower policy below (status only, by
-- convention of what the UI exposes to them — see task_activity_log for the
-- audit trail either way).
create policy tasks_update_privileged on public.tasks for update
  to authenticated
  using (
    public.current_user_role() in ('super_admin', 'network_admin')
    or (
      public.current_user_role() = 'institution_manager'
      and institution_id = public.current_user_institution_id()
    )
  )
  with check (
    public.current_user_role() in ('super_admin', 'network_admin')
    or (
      public.current_user_role() = 'institution_manager'
      and institution_id = public.current_user_institution_id()
    )
  );

create policy tasks_update_own_assigned on public.tasks for update
  to authenticated
  using (
    public.current_user_role() = 'employee'
    and exists (select 1 from public.task_assignees ta where ta.task_id = id and ta.user_id = auth.uid())
  )
  with check (
    public.current_user_role() = 'employee'
    and exists (select 1 from public.task_assignees ta where ta.task_id = id and ta.user_id = auth.uid())
  );

create policy tasks_delete on public.tasks for delete
  to authenticated
  using (
    public.current_user_role() in ('super_admin', 'network_admin')
    or (
      public.current_user_role() = 'institution_manager'
      and institution_id = public.current_user_institution_id()
    )
  );

-- ----------------------------------------------------------------------------
-- task_assignees (visibility/write follow the parent task)
-- ----------------------------------------------------------------------------
create policy task_assignees_select on public.task_assignees for select
  to authenticated
  using (public.can_view_task(task_id));

create policy task_assignees_write on public.task_assignees for all
  to authenticated
  using (
    public.current_user_role() in ('super_admin', 'network_admin')
    or (
      public.current_user_role() = 'institution_manager'
      and exists (
        select 1 from public.tasks t
        where t.id = task_id and t.institution_id = public.current_user_institution_id()
      )
    )
  )
  with check (
    public.current_user_role() in ('super_admin', 'network_admin')
    or (
      public.current_user_role() = 'institution_manager'
      and exists (
        select 1 from public.tasks t
        where t.id = task_id and t.institution_id = public.current_user_institution_id()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- task_project_links
-- ----------------------------------------------------------------------------
create policy task_project_links_select on public.task_project_links for select
  to authenticated
  using (public.can_view_task(task_id));

create policy task_project_links_write on public.task_project_links for all
  to authenticated
  using (public.current_user_role() in ('super_admin', 'network_admin'))
  with check (public.current_user_role() in ('super_admin', 'network_admin'));

-- ----------------------------------------------------------------------------
-- task_activity_log (read-only from the client; rows are written by triggers)
-- ----------------------------------------------------------------------------
create policy task_activity_log_select on public.task_activity_log for select
  to authenticated
  using (public.can_view_task(task_id));
