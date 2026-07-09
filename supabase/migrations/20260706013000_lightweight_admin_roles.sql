-- Lightweight admin role rollout for Super Admin, Admin, and Moderator.
-- Existing active admins are kept as super_admin to avoid go-live lockouts.

alter table if exists public.admin_users
  add column if not exists role text not null default 'super_admin';

alter table if exists public.admin_users
  drop constraint if exists admin_users_role_check;

update public.admin_users
set role = case
  when lower(role) in ('moderator', 'mentor', 'viewer') then 'moderator'
  when lower(role) in ('admin', 'operations') then 'admin'
  else 'super_admin'
end
where role is null
   or lower(role) not in ('super_admin', 'admin', 'moderator');

update public.admin_users
set role = 'super_admin'
where status = 'active';

alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('super_admin', 'admin', 'moderator'))
  not valid;

alter table public.admin_users validate constraint admin_users_role_check;

create index if not exists admin_users_role_status_idx
  on public.admin_users (role, status);

create or replace function public.current_admin_role()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (
      select au.role
      from public.admin_users au
      where au.status = 'active'
        and (
          au.auth_user_id = (select auth.uid())
          or lower(au.email) = public.current_auth_email()
        )
      order by case when au.auth_user_id = (select auth.uid()) then 0 else 1 end
      limit 1
    ),
    ''
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.current_admin_role() = 'super_admin';
$$;
