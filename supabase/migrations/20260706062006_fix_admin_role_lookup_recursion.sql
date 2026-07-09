-- Fix RBAC policy recursion.
-- `admin_has_permission()` is used inside policies, including the admin_users
-- policy. The role lookup must therefore bypass admin_users RLS while still
-- binding the lookup to the current Supabase auth identity.

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
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

revoke all on function public.current_admin_role() from public;
grant execute on function public.current_admin_role() to authenticated;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.current_admin_role() = 'super_admin';
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;
