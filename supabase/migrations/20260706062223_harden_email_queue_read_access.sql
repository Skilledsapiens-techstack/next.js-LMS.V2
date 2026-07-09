-- Direct email queue reads expose recipient metadata and delivery details.
-- Keep student invite/onboarding health checks behind Edge Functions, and allow
-- direct table reads only to the Email Centre role.

drop policy if exists "email queue readable by active admins" on public.email_queue;

create policy "email queue readable by email admins"
on public.email_queue
for select
to authenticated
using (public.admin_has_permission('admin.email.view'));
