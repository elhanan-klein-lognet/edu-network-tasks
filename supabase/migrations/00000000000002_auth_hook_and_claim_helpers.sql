-- ============================================================================
-- JWT custom claims: the RLS-recursion fix described in spec.md section 9.
--
-- Instead of every RLS policy querying public.users (which itself has RLS,
-- causing infinite recursion / bad performance), a Supabase Auth Hook stamps
-- `user_role` and `institution_id` onto the JWT at sign-in / token refresh.
-- Policies then read auth.jwt() directly — no table lookup, no recursion.
--
-- IMPORTANT — manual step required after running this migration:
-- Supabase Dashboard → Authentication → Hooks → "Customize Access Token
-- (JWT) Claims hook" → select public.custom_access_token_hook. This cannot
-- be enabled from SQL alone. Local dev: add the equivalent entry under
-- [auth.hook.custom_access_token] in supabase/config.toml.
-- ============================================================================

-- SECURITY DEFINER is required here, not optional: Supabase Auth calls this
-- function as the `supabase_auth_admin` role, which is not `authenticated`
-- and matches none of public.users's RLS policies (they're all `to
-- authenticated`). Without SECURITY DEFINER the SELECT below silently
-- returns zero rows under RLS — not an error, just v_role staying NULL —
-- so every user's user_role claim quietly falls back to 'employee' no
-- matter what their real role is. (Found this the hard way: it doesn't
-- show up as an error anywhere, only as RLS rejecting things it shouldn't.)
-- SECURITY DEFINER makes it run as the function owner (table owner),
-- which bypasses RLS — same reasoning as can_view_task in
-- 00000000000003_rls_policies.sql, just easy to forget here because this
-- function's job LOOKS read-only and harmless.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  v_role public.user_role;
  v_institution_id uuid;
begin
  select role, institution_id
  into v_role, v_institution_id
  from public.users
  where id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  claims := jsonb_set(claims, '{user_role}', to_jsonb(coalesce(v_role::text, 'employee')));

  if v_institution_id is not null then
    claims := jsonb_set(claims, '{institution_id}', to_jsonb(v_institution_id::text));
  else
    claims := claims - 'institution_id';
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Supabase's auth server (role supabase_auth_admin) must be able to call this,
-- and nothing else should be able to call it directly.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- supabase_auth_admin needs to read public.users to compute the claims above.
grant select on public.users to supabase_auth_admin;

-- ----------------------------------------------------------------------------
-- Policy helper functions — thin wrappers around auth.jwt(), no table access,
-- so calling them from any RLS policy can never recurse.
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'user_role', 'employee');
$$;

create or replace function public.current_user_institution_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'institution_id', '')::uuid;
$$;

comment on function public.current_user_role() is
  'Reads user_role from the JWT (stamped by custom_access_token_hook). Never queries public.users — safe to use in any RLS policy without recursion risk.';
comment on function public.current_user_institution_id() is
  'Reads institution_id from the JWT. NULL for super_admin/network_admin. Never queries public.users.';

-- ----------------------------------------------------------------------------
-- app_config: tiny key/value settings table.
--
-- First attempt at this used `alter database postgres set app.<key> = ...`
-- (a Postgres GUC), which fails on Supabase's hosted Postgres with
-- "permission denied to set parameter" — the SQL Editor does not run as a
-- true superuser there, and ALTER DATABASE ... SET requires one. A plain
-- table is the fix: normal DML, no elevated privileges needed, and it's
-- readable only by SECURITY DEFINER functions (owner-bypasses-RLS, same
-- pattern as can_view_task in 00000000000003_rls_policies.sql) since RLS is
-- enabled with no policies for any other role.
-- ----------------------------------------------------------------------------
create table public.app_config (
  key   text primary key,
  value text
);

alter table public.app_config enable row level security;
-- Intentionally no policies: not readable by authenticated/anon at all,
-- only by the table owner (and therefore by SECURITY DEFINER functions
-- owned by it, such as handle_new_auth_user below).

comment on table public.app_config is
  'Small per-project settings, e.g. initial_admin_email (section 3.5). Set via: insert into public.app_config (key, value) values (''initial_admin_email'', ''someone@example.com'') on conflict (key) do update set value = excluded.value; — run this once per Supabase project (production and dev/test get different values, section 9).';

-- ----------------------------------------------------------------------------
-- First-super-admin bootstrap (section 3.5).
-- When a user signs up and public.users has ZERO rows yet, OR their email
-- matches the initial_admin_email row in app_config above, they become
-- super_admin automatically. This is the one deliberate exception to
-- "no hardcoded data" — it's a one-time technical bootstrap, not seeded
-- business data.
-- ----------------------------------------------------------------------------
-- NOTE: this trigger handles ONLY the bootstrap case. For every other
-- sign-up, the admin-panel invite action (using the service-role client,
-- which bypasses RLS) inserts the public.users row itself, in the same
-- request as the inviteUserByEmail call, with the role/institution_id the
-- admin picked in the UI (section 3.2). That avoids ever inserting an
-- employee/institution_manager row with a null institution_id, which the
-- users_institution_required_for_scoped_roles check constraint forbids.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_first_user boolean;
  v_is_configured_admin boolean;
  v_initial_admin_email text;
begin
  select count(*) = 0 into v_is_first_user from public.users;

  select value into v_initial_admin_email
  from public.app_config
  where key = 'initial_admin_email';

  v_is_configured_admin := v_initial_admin_email is not null
    and lower(new.email) = lower(v_initial_admin_email);

  if v_is_first_user or v_is_configured_admin then
    insert into public.users (id, full_name, role, institution_id)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'super_admin', null)
    on conflict (id) do nothing;
  end if;
  -- else: no-op. The invite server action creates the profile row — see
  -- src/app/(admin)/users/actions.ts.

  return new;
end;
$$;

create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
