-- Replace the last broad active-admin RLS checks with explicit RBAC permissions.

create or replace function public.admin_has_permission(required_permission text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  with role_scope as (
    select public.current_admin_role() as role_key
  )
  select case
    when required_permission is null or btrim(required_permission) = '' then false
    when role_key = 'super_admin' then true
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
  from role_scope;
$$;

revoke all on function public.admin_has_permission(text) from public;
grant execute on function public.admin_has_permission(text) to authenticated;

drop policy if exists "college master readable by authenticated users" on public.college_master;
create policy "college master readable by authenticated users"
on public.college_master for select to authenticated
using (
  status = 'active'
  or public.admin_has_permission('admin.students.view')
);

drop policy if exists "college_master_managed_by_admins" on public.college_master;
create policy "college master manageable by student admins"
on public.college_master for all to authenticated
using (public.admin_has_permission('admin.students.manage'))
with check (public.admin_has_permission('admin.students.manage'));

drop policy if exists "community comments readable by active admins" on public.community_comments;
create policy "community comments readable by community admins"
on public.community_comments for select to authenticated
using (public.admin_has_permission('admin.community.view'));

drop policy if exists "community comments moderated by active admins" on public.community_comments;
create policy "community comments moderated by community admins"
on public.community_comments for update to authenticated
using (public.admin_has_permission('admin.community.manage'))
with check (public.admin_has_permission('admin.community.manage'));

drop policy if exists "community groups readable by active admins" on public.community_groups;
create policy "community groups readable by community admins"
on public.community_groups for select to authenticated
using (public.admin_has_permission('admin.community.view'));

drop policy if exists "community groups managed by active admins" on public.community_groups;
create policy "community groups managed by community admins"
on public.community_groups for all to authenticated
using (public.admin_has_permission('admin.community.manage'))
with check (public.admin_has_permission('admin.community.manage'));

drop policy if exists "community posts readable by active admins" on public.community_posts;
create policy "community posts readable by community admins"
on public.community_posts for select to authenticated
using (public.admin_has_permission('admin.community.view'));

drop policy if exists "community posts managed by active admins" on public.community_posts;
create policy "community posts managed by community admins"
on public.community_posts for all to authenticated
using (public.admin_has_permission('admin.community.manage'))
with check (public.admin_has_permission('admin.community.manage'));

drop policy if exists "faq categories readable by authenticated users" on public.faq_categories;
create policy "faq categories readable by authenticated users"
on public.faq_categories for select to authenticated
using (
  status = 'active'
  or public.admin_has_permission('admin.support.view')
);

drop policy if exists "faq categories managed by admins" on public.faq_categories;
create policy "faq categories managed by support admins"
on public.faq_categories for all to authenticated
using (public.admin_has_permission('admin.support.manage'))
with check (public.admin_has_permission('admin.support.manage'));

drop policy if exists "published faqs readable by authenticated users" on public.faqs;
create policy "published faqs readable by authenticated users"
on public.faqs for select to authenticated
using (
  status = 'published'
  or public.admin_has_permission('admin.support.view')
);

drop policy if exists "faqs managed by admins" on public.faqs;
create policy "faqs managed by support admins"
on public.faqs for all to authenticated
using (public.admin_has_permission('admin.support.manage'))
with check (public.admin_has_permission('admin.support.manage'));

drop policy if exists "active portal settings readable by authenticated users" on public.portal_settings;
create policy "active portal settings readable by authenticated users"
on public.portal_settings for select to authenticated
using (
  status = 'active'
  or public.admin_has_permission('admin.feature_control.manage')
);

drop policy if exists "support faqs readable by authenticated users" on public.support_faqs;
create policy "support faqs readable by authenticated users"
on public.support_faqs for select to authenticated
using (
  status = 'published'
  or public.admin_has_permission('admin.support.view')
);

drop policy if exists "students add support messages when category permits" on public.support_ticket_messages;
create policy "students add support messages when category permits"
on public.support_ticket_messages for insert to authenticated
with check (
  public.admin_has_permission('admin.support.manage')
  or (
    author_role = 'student'
    and lower(author_email) = public.current_auth_email()
    and exists (
      select 1
      from public.support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and lower(t.student_email) = public.current_auth_email()
        and t.status <> all(array['resolved', 'closed']::text[])
        and t.conversation_mode = 'two_way'
    )
  )
);

drop policy if exists "support messages visible to ticket participants" on public.support_ticket_messages;
create policy "support messages visible to ticket participants"
on public.support_ticket_messages for select to authenticated
using (
  public.admin_has_permission('admin.support.view')
  or exists (
    select 1
    from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        lower(t.student_email) = public.current_auth_email()
        or t.created_by_auth_user_id = auth.uid()
      )
  )
);

drop policy if exists "user activity can be inserted by owner or admin" on public.user_activity;
create policy "user activity can be inserted by owner or observability admins"
on public.user_activity for insert to authenticated
with check (
  public.admin_has_permission('admin.observability.view')
  or lower(user_email) = public.current_auth_email()
);

drop policy if exists "user activity can be updated by owner or admin" on public.user_activity;
create policy "user activity can be updated by owner or observability admins"
on public.user_activity for update to authenticated
using (
  public.admin_has_permission('admin.observability.view')
  or lower(user_email) = public.current_auth_email()
)
with check (
  public.admin_has_permission('admin.observability.view')
  or lower(user_email) = public.current_auth_email()
);
