alter table public.admin_users
  add column if not exists permissions text[];

alter table public.admin_users
  drop constraint if exists admin_users_permissions_allowed_check;

alter table public.admin_users
  add constraint admin_users_permissions_allowed_check
  check (
    permissions is null
    or permissions <@ array[
      'admin.dashboard.view',
      'admin.students.view',
      'admin.students.manage',
      'admin.students.import',
      'admin.students.export',
      'admin.students.invite',
      'admin.cohorts.view',
      'admin.cohorts.manage',
      'admin.programs.view',
      'admin.programs.manage',
      'admin.projects.view',
      'admin.projects.manage',
      'admin.submissions.view',
      'admin.submissions.review',
      'admin.meetings.view',
      'admin.meetings.manage',
      'admin.recordings.view',
      'admin.recordings.manage',
      'admin.resources.view',
      'admin.resources.manage',
      'admin.certificates.view',
      'admin.certificates.issue',
      'admin.enrollments.view',
      'admin.announcements.view',
      'admin.announcements.manage',
      'admin.community.view',
      'admin.community.manage',
      'admin.support.view',
      'admin.support.manage',
      'admin.email.view',
      'admin.email.manage',
      'admin.observability.view',
      'admin.payments.view',
      'admin.paid_access.view'
    ]::text[]
  );

create or replace function public.current_admin_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select au.permissions
  from public.admin_users au
  where au.status = 'active'
    and (
      au.auth_user_id = (select auth.uid())
      or lower(au.email) = public.current_auth_email()
    )
  order by case when au.auth_user_id = (select auth.uid()) then 0 else 1 end
  limit 1;
$$;

revoke all on function public.current_admin_permissions() from public;
grant execute on function public.current_admin_permissions() to authenticated;

create or replace function public.admin_has_permission(required_permission text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  with access_scope as (
    select
      public.current_admin_role() as role_key,
      public.current_admin_permissions() as custom_permissions
  )
  select case
    when required_permission is null or btrim(required_permission) = '' then false
    when role_key = 'super_admin' then true
    when custom_permissions is not null then required_permission = any(custom_permissions)
    when role_key = 'admin' then required_permission = any(array[
      'admin.dashboard.view',
      'admin.students.view',
      'admin.students.manage',
      'admin.students.import',
      'admin.students.export',
      'admin.students.invite',
      'admin.cohorts.view',
      'admin.cohorts.manage',
      'admin.programs.view',
      'admin.programs.manage',
      'admin.projects.view',
      'admin.projects.manage',
      'admin.submissions.view',
      'admin.submissions.review',
      'admin.meetings.view',
      'admin.meetings.manage',
      'admin.recordings.view',
      'admin.recordings.manage',
      'admin.resources.view',
      'admin.resources.manage',
      'admin.certificates.view',
      'admin.certificates.issue',
      'admin.enrollments.view',
      'admin.announcements.view',
      'admin.announcements.manage',
      'admin.community.view',
      'admin.community.manage',
      'admin.support.view',
      'admin.support.manage',
      'admin.observability.view'
    ]::text[])
    when role_key = 'moderator' then required_permission = any(array[
      'admin.dashboard.view',
      'admin.students.view',
      'admin.submissions.view',
      'admin.submissions.review',
      'admin.recordings.view',
      'admin.recordings.manage',
      'admin.certificates.view',
      'admin.announcements.view',
      'admin.community.view',
      'admin.support.view',
      'admin.support.manage',
      'admin.observability.view'
    ]::text[])
    else false
  end
  from access_scope;
$$;

revoke all on function public.admin_has_permission(text) from public;
grant execute on function public.admin_has_permission(text) to authenticated;
