-- ============================================================================
-- Core schema for the network task management system.
-- Mirrors spec.md section 10. No table here is seeded with initial rows —
-- every row is created through the admin panel (section 3) or the
-- first-super-admin bootstrap (section 3.5). See README.md for setup.
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- institutions  (section 3.1)
-- ----------------------------------------------------------------------------
create table public.institutions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.institutions is
  'Educational institutions in the network. Populated only via the admin panel (section 3.1) — no seed rows.';

-- ----------------------------------------------------------------------------
-- users  (profile table — extends auth.users, section 3.2 / 3.5 / 3.6)
-- ----------------------------------------------------------------------------
create type public.user_role as enum (
  'super_admin',        -- מנהל-על
  'network_admin',      -- הנהלת רשת
  'institution_manager', -- מנהל מוסד
  'employee'             -- עובד / חבר צוות
);

create table public.users (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null,
  role            public.user_role not null default 'employee',
  institution_id  uuid references public.institutions (id),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table public.users is
  'App-level profile for each auth.users row. Role/institution assigned via the admin panel (3.2) or the initial bootstrap trigger (3.5) — see 00000000000004_auth_hook.sql.';

-- institution_manager / employee must belong to an institution;
-- super_admin / network_admin operate network-wide and have none.
alter table public.users add constraint users_institution_required_for_scoped_roles
  check (
    (role in ('institution_manager', 'employee') and institution_id is not null)
    or (role in ('super_admin', 'network_admin'))
  );

-- ----------------------------------------------------------------------------
-- boards  (section 4)
-- ----------------------------------------------------------------------------
create table public.boards (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- NULL institution_id = network-wide board (crosses institutions)
  institution_id  uuid references public.institutions (id),
  is_active       boolean not null default true,
  created_by      uuid references public.users (id),
  created_at      timestamptz not null default now()
);

comment on table public.boards is
  'One board per institution (or NULL institution_id for the network-wide board). Board structure itself is fixed for MVP — only custom fields (below) and the global status/priority lists (system settings) are configurable.';

-- ----------------------------------------------------------------------------
-- board_custom_field_definitions  (section 4 / 3.4 — up to 3 per board)
-- ----------------------------------------------------------------------------
create type public.custom_field_type as enum ('text', 'number', 'date', 'select');

create table public.board_custom_field_definitions (
  id              uuid primary key default gen_random_uuid(),
  board_id        uuid not null references public.boards (id) on delete cascade,
  field_name      text not null,
  field_type      public.custom_field_type not null,
  -- select options, e.g. ["low", "medium", "high"] — only used when field_type = 'select'
  field_options   jsonb,
  display_order   int not null default 0,
  created_at      timestamptz not null default now()
);

comment on table public.board_custom_field_definitions is
  'Defines the shape of each board''s tasks.custom_fields JSONB. Max 3 rows per board, enforced by trigger below.';

create or replace function public.enforce_max_custom_fields_per_board()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.board_custom_field_definitions where board_id = new.board_id) >= 3 then
    raise exception 'A board can have at most 3 custom field definitions (section 4 of spec.md)';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_max_custom_fields
  before insert on public.board_custom_field_definitions
  for each row execute function public.enforce_max_custom_fields_per_board();

-- ----------------------------------------------------------------------------
-- task_statuses / task_priorities  (the "system_settings" of section 10 / 3.3)
-- Realized as two normalized tables rather than a generic key-value blob,
-- so tasks.status_id / priority_id stay real foreign keys.
-- ----------------------------------------------------------------------------
create table public.task_statuses (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  display_order   int not null default 0,
  created_at      timestamptz not null default now()
);

create table public.task_priorities (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  display_order   int not null default 0,
  created_at      timestamptz not null default now()
);

comment on table public.task_statuses is
  'Global, network-wide status list — editable by super_admin via the settings screen (3.3), not hardcoded. Seed sensible Hebrew defaults once via the admin panel after first deploy, not via migration.';
comment on table public.task_priorities is
  'Global, network-wide priority list — editable by super_admin via the settings screen (3.3), not hardcoded.';

-- ----------------------------------------------------------------------------
-- projects  (section 6)
-- ----------------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  due_date    date,
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- tasks  (section 5)
-- ----------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  board_id        uuid not null references public.boards (id),
  -- denormalized from boards.institution_id at insert time for simpler RLS
  -- and dashboard queries (section 7) — kept in sync by trigger below.
  institution_id  uuid references public.institutions (id),
  status_id       uuid not null references public.task_statuses (id),
  priority_id     uuid not null references public.task_priorities (id),
  due_date        date,
  custom_fields   jsonb not null default '{}'::jsonb,
  created_by      uuid references public.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.set_task_institution_from_board()
returns trigger
language plpgsql
as $$
begin
  select institution_id into new.institution_id
  from public.boards where id = new.board_id;
  return new;
end;
$$;

create trigger trg_set_task_institution
  before insert or update of board_id on public.tasks
  for each row execute function public.set_task_institution_from_board();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- task_assignees  (many-to-many, section 4 / 10)
-- ----------------------------------------------------------------------------
create table public.task_assignees (
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

-- ----------------------------------------------------------------------------
-- task_project_links  (many-to-many, section 5 / 10)
-- ----------------------------------------------------------------------------
create table public.task_project_links (
  task_id     uuid not null references public.tasks (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  primary key (task_id, project_id)
);

-- ----------------------------------------------------------------------------
-- task_activity_log  (lightweight MVP audit trail, section 4 / 10)
-- ----------------------------------------------------------------------------
create table public.task_activity_log (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  changed_by  uuid references public.users (id),
  field_name  text not null, -- 'status' | 'assignee'
  old_value   text,
  new_value   text,
  changed_at  timestamptz not null default now()
);

create or replace function public.log_task_status_change()
returns trigger
language plpgsql
as $$
begin
  if old.status_id is distinct from new.status_id then
    insert into public.task_activity_log (task_id, changed_by, field_name, old_value, new_value)
    values (new.id, auth.uid(), 'status', old.status_id::text, new.status_id::text);
  end if;
  return new;
end;
$$;

create trigger trg_log_task_status_change
  after update of status_id on public.tasks
  for each row execute function public.log_task_status_change();

create or replace function public.log_task_assignee_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity_log (task_id, changed_by, field_name, old_value, new_value)
    values (new.task_id, auth.uid(), 'assignee', null, new.user_id::text);
  elsif tg_op = 'DELETE' then
    insert into public.task_activity_log (task_id, changed_by, field_name, old_value, new_value)
    values (old.task_id, auth.uid(), 'assignee', old.user_id::text, null);
  end if;
  return null;
end;
$$;

create trigger trg_log_task_assignee_change
  after insert or delete on public.task_assignees
  for each row execute function public.log_task_assignee_change();

-- ----------------------------------------------------------------------------
-- indexes
-- ----------------------------------------------------------------------------
create index idx_users_institution_id on public.users (institution_id);
create index idx_boards_institution_id on public.boards (institution_id);
create index idx_tasks_board_id on public.tasks (board_id);
create index idx_tasks_institution_id on public.tasks (institution_id);
create index idx_tasks_status_id on public.tasks (status_id);
create index idx_task_assignees_user_id on public.task_assignees (user_id);
create index idx_task_activity_log_task_id on public.task_activity_log (task_id);
