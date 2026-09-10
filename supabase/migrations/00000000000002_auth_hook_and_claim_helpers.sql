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

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
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
-- First-super-admin bootstrap (section 3.5).
-- When a user signs up and public.users has ZERO rows yet, OR their email
-- matches the INITIAL_ADMIN_EMAIL app setting, they become super_admin
-- automatically. This is the one deliberate exception to "no hardcoded data"
-- — it's a one-time technical bootstrap, not seeded business data.
--
-- INITIAL_ADMIN_EMAIL is read from a Postgres setting so it can be configured
-- per-environment (production vs dev/test — section 9) without editing SQL.
-- Set it once after running migrations:
--   alter database postgres set app.initial_admin_email = 'elhanan.klein.lognet@gmail.com';
-- (repeat per Supabase project — this value is NOT the same across the two
-- projects described in section 9, since prod and dev/test are independent)
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

  begin
    v_initial_admin_email := current_setting('app.initial_admin_email', true);
  exception when others then
    v_initial_admin_email := null;
  end;

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
