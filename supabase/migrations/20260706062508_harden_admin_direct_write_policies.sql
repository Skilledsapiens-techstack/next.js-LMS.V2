-- Tighten legacy "any active admin" RLS policies so direct REST access follows
-- the same Super Admin/Admin/Moderator permission model as the LMS UI and
-- Edge Functions.

-- Announcements
drop policy if exists "announcements readable by active admins" on public.announcements;
create policy "announcements readable by announcement admins"
on public.announcements for select to authenticated
using (public.admin_has_permission('admin.announcements.view'));

drop policy if exists "announcements managed by active admins" on public.announcements;
create policy "announcements managed by announcement admins"
on public.announcements for all to authenticated
using (public.admin_has_permission('admin.announcements.manage'))
with check (public.admin_has_permission('admin.announcements.manage'));

-- Students and student access mappings
drop policy if exists "students readable by active admins" on public.students;
create policy "students readable by student admins"
on public.students for select to authenticated
using (public.admin_has_permission('admin.students.view'));

drop policy if exists "students writable by active admins" on public.students;
drop policy if exists "enrollment activation students writable by active admins" on public.students;
create policy "students writable by student managers"
on public.students for all to authenticated
using (public.admin_has_permission('admin.students.manage'))
with check (public.admin_has_permission('admin.students.manage'));

drop policy if exists "student cohorts readable by active admins" on public.student_cohorts;
create policy "student cohorts readable by student admins"
on public.student_cohorts for select to authenticated
using (public.admin_has_permission('admin.students.view'));

drop policy if exists "student cohorts writable by active admins" on public.student_cohorts;
drop policy if exists "enrollment activation student cohorts writable by active admins" on public.student_cohorts;
create policy "student cohorts writable by student managers"
on public.student_cohorts for all to authenticated
using (public.admin_has_permission('admin.students.manage'))
with check (public.admin_has_permission('admin.students.manage'));

drop policy if exists "student programs readable by active admins" on public.student_programs;
create policy "student programs readable by student admins"
on public.student_programs for select to authenticated
using (public.admin_has_permission('admin.students.view'));

drop policy if exists "student programs writable by active admins" on public.student_programs;
drop policy if exists "enrollment activation student programs writable by active admin" on public.student_programs;
create policy "student programs writable by student managers"
on public.student_programs for all to authenticated
using (public.admin_has_permission('admin.students.manage'))
with check (public.admin_has_permission('admin.students.manage'));

drop policy if exists "project submission student limits readable by active admins" on public.project_submission_student_limits;
create policy "project submission student limits readable by student admins"
on public.project_submission_student_limits for select to authenticated
using (public.admin_has_permission('admin.students.view'));

drop policy if exists "project submission attempt limits managed by active admins" on public.project_submission_student_limits;
create policy "project submission attempt limits managed by student managers"
on public.project_submission_student_limits for all to authenticated
using (public.admin_has_permission('admin.students.manage'))
with check (public.admin_has_permission('admin.students.manage'));

-- Cohorts, programs, resources, projects
drop policy if exists "cohorts readable by active admins" on public.cohorts;
create policy "cohorts readable by cohort admins"
on public.cohorts for select to authenticated
using (public.admin_has_permission('admin.cohorts.view'));

drop policy if exists "cohorts managed by active admins" on public.cohorts;
create policy "cohorts managed by cohort admins"
on public.cohorts for all to authenticated
using (public.admin_has_permission('admin.cohorts.manage'))
with check (public.admin_has_permission('admin.cohorts.manage'));

drop policy if exists "resources readable by active admins" on public.resources;
create policy "resources readable by resource admins"
on public.resources for select to authenticated
using (public.admin_has_permission('admin.resources.view'));

drop policy if exists "resources managed by active admins" on public.resources;
create policy "resources managed by resource admins"
on public.resources for all to authenticated
using (public.admin_has_permission('admin.resources.manage'))
with check (public.admin_has_permission('admin.resources.manage'));

drop policy if exists "projects readable by active admins" on public.projects;
create policy "projects readable by project admins"
on public.projects for select to authenticated
using (public.admin_has_permission('admin.projects.view'));

drop policy if exists "projects managed by active admins" on public.projects;
create policy "projects managed by project admins"
on public.projects for all to authenticated
using (public.admin_has_permission('admin.projects.manage'))
with check (public.admin_has_permission('admin.projects.manage'));

drop policy if exists "role master readable by active admins" on public.role_master;
create policy "role master readable by project admins"
on public.role_master for select to authenticated
using (public.admin_has_permission('admin.projects.view'));

drop policy if exists "role master managed by active admins" on public.role_master;
create policy "role master managed by project admins"
on public.role_master for all to authenticated
using (public.admin_has_permission('admin.projects.manage'))
with check (public.admin_has_permission('admin.projects.manage'));

drop policy if exists "programs readable by active admins" on public.programs;
create policy "programs readable by program admins"
on public.programs for select to authenticated
using (public.admin_has_permission('admin.programs.view'));

-- Certificates
drop policy if exists "certificate program settings readable by active admins" on public.certificate_program_settings;
create policy "certificate program settings readable by certificate admins"
on public.certificate_program_settings for select to authenticated
using (public.admin_has_permission('admin.certificates.view'));

drop policy if exists "certificate program settings managed by active admins" on public.certificate_program_settings;
create policy "certificate program settings managed by certificate issuers"
on public.certificate_program_settings for all to authenticated
using (public.admin_has_permission('admin.certificates.issue'))
with check (public.admin_has_permission('admin.certificates.issue'));

drop policy if exists "certificate requests readable by active admins" on public.certificate_requests;
create policy "certificate requests readable by certificate admins"
on public.certificate_requests for select to authenticated
using (public.admin_has_permission('admin.certificates.view'));

drop policy if exists "certificate requests reviewable by active admins" on public.certificate_requests;
create policy "certificate requests reviewable by certificate issuers"
on public.certificate_requests for update to authenticated
using (public.admin_has_permission('admin.certificates.issue'))
with check (public.admin_has_permission('admin.certificates.issue'));

drop policy if exists "certificates readable by active admins" on public.certificates;
create policy "certificates readable by certificate admins"
on public.certificates for select to authenticated
using (public.admin_has_permission('admin.certificates.view'));

drop policy if exists "certificates insertable by active admins" on public.certificates;
create policy "certificates insertable by certificate issuers"
on public.certificates for insert to authenticated
with check (public.admin_has_permission('admin.certificates.issue'));

drop policy if exists "certificates manageable by active admins" on public.certificates;
create policy "certificates manageable by certificate issuers"
on public.certificates for update to authenticated
using (public.admin_has_permission('admin.certificates.issue'))
with check (public.admin_has_permission('admin.certificates.issue'));

-- Project submissions
drop policy if exists "project submissions readable by active admins" on public.project_submission_requests;
create policy "project submissions readable by submission admins"
on public.project_submission_requests for select to authenticated
using (public.admin_has_permission('admin.submissions.view'));

drop policy if exists "project submissions can be reviewed by active admins" on public.project_submission_requests;
create policy "project submissions reviewable by submission reviewers"
on public.project_submission_requests for update to authenticated
using (public.admin_has_permission('admin.submissions.review'))
with check (public.admin_has_permission('admin.submissions.review'));

-- Email centre and payment privacy
drop policy if exists "email_templates_readable_by_admins" on public.email_templates;
create policy "email templates readable by email admins"
on public.email_templates for select to authenticated
using (public.admin_has_permission('admin.email.view'));

drop policy if exists "email_templates_managed_by_admins" on public.email_templates;
create policy "email templates managed by email admins"
on public.email_templates for all to authenticated
using (public.admin_has_permission('admin.email.manage'))
with check (public.admin_has_permission('admin.email.manage'));

drop policy if exists "email events readable by active admins" on public.email_events;
create policy "email events readable by email admins"
on public.email_events for select to authenticated
using (public.admin_has_permission('admin.email.view'));

drop policy if exists "email preferences readable by active admins" on public.email_preferences;
create policy "email preferences readable by email admins"
on public.email_preferences for select to authenticated
using (public.admin_has_permission('admin.email.view'));

drop policy if exists "payment orders readable by active admins" on public.payment_orders;
create policy "payment orders readable by payment admins"
on public.payment_orders for select to authenticated
using (public.admin_has_permission('admin.payments.view'));

drop policy if exists "paid access readable by active admins" on public.paid_access;
create policy "paid access readable by paid access admins"
on public.paid_access for select to authenticated
using (public.admin_has_permission('admin.paid_access.view'));

drop policy if exists "paid access can be inserted by active admins" on public.paid_access;
create policy "paid access insertable by paid access admins"
on public.paid_access for insert to authenticated
with check (public.admin_has_permission('admin.paid_access.view'));

drop policy if exists "paid access can be updated by active admins" on public.paid_access;
create policy "paid access updateable by paid access admins"
on public.paid_access for update to authenticated
using (public.admin_has_permission('admin.paid_access.view'))
with check (public.admin_has_permission('admin.paid_access.view'));

-- Enrollments
drop policy if exists "enrollment requests readable by active admins" on public.enrollment_requests;
create policy "enrollment requests readable by enrollment admins"
on public.enrollment_requests for select to authenticated
using (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment activation requests writable by active admins" on public.enrollment_requests;
drop policy if exists "enrollment requests can be rejected by active admins" on public.enrollment_requests;
create policy "enrollment requests writable by enrollment admins"
on public.enrollment_requests for update to authenticated
using (public.admin_has_permission('admin.enrollments.view'))
with check (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment request items readable by active admins" on public.enrollment_request_items;
create policy "enrollment request items readable by enrollment admins"
on public.enrollment_request_items for select to authenticated
using (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment activation items writable by active admins" on public.enrollment_request_items;
drop policy if exists "enrollment request items can be rejected by active admins" on public.enrollment_request_items;
create policy "enrollment request items writable by enrollment admins"
on public.enrollment_request_items for update to authenticated
using (public.admin_has_permission('admin.enrollments.view'))
with check (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment request items insertable by active admins" on public.enrollment_request_items;
create policy "enrollment request items insertable by enrollment admins"
on public.enrollment_request_items for insert to authenticated
with check (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment status history readable by active admins" on public.enrollment_status_history;
create policy "enrollment status history readable by enrollment admins"
on public.enrollment_status_history for select to authenticated
using (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment activation history insertable by active admins" on public.enrollment_status_history;
drop policy if exists "enrollment status history insertable by active admins" on public.enrollment_status_history;
create policy "enrollment status history insertable by enrollment admins"
on public.enrollment_status_history for insert to authenticated
with check (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment exceptions readable by active admins" on public.enrollment_exceptions;
create policy "enrollment exceptions readable by enrollment admins"
on public.enrollment_exceptions for select to authenticated
using (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment exceptions resolvable by active admins" on public.enrollment_exceptions;
create policy "enrollment exceptions resolvable by enrollment admins"
on public.enrollment_exceptions for update to authenticated
using (public.admin_has_permission('admin.enrollments.view'))
with check (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "enrollment webhook events readable by active admins" on public.enrollment_webhook_events;
create policy "enrollment webhook events readable by enrollment admins"
on public.enrollment_webhook_events for select to authenticated
using (public.admin_has_permission('admin.enrollments.view'));

drop policy if exists "raw enrollment payloads readable by active admins" on public.raw_enrollment_payloads;
create policy "raw enrollment payloads readable by enrollment admins"
on public.raw_enrollment_payloads for select to authenticated
using (public.admin_has_permission('admin.enrollments.view'));

-- Support
drop policy if exists "support categories are managed by admins" on public.support_categories;
create policy "support categories managed by support admins"
on public.support_categories for all to authenticated
using (public.admin_has_permission('admin.support.manage'))
with check (public.admin_has_permission('admin.support.manage'));

drop policy if exists "support settings are readable by admins" on public.support_settings;
create policy "support settings readable by support admins"
on public.support_settings for select to authenticated
using (public.admin_has_permission('admin.support.view'));

drop policy if exists "support settings are managed by admins" on public.support_settings;
create policy "support settings managed by support admins"
on public.support_settings for all to authenticated
using (public.admin_has_permission('admin.support.manage'))
with check (public.admin_has_permission('admin.support.manage'));

drop policy if exists "admins update support tickets" on public.support_tickets;
create policy "support tickets updateable by support admins"
on public.support_tickets for update to authenticated
using (public.admin_has_permission('admin.support.manage'))
with check (public.admin_has_permission('admin.support.manage'));

-- Admin settings / observability
drop policy if exists "portal settings managed by admins" on public.portal_settings;
create policy "portal settings managed by super admins"
on public.portal_settings for all to authenticated
using (public.admin_has_permission('admin.feature_control.manage'))
with check (public.admin_has_permission('admin.feature_control.manage'));

drop policy if exists "feature_master_managed_by_admins" on public.feature_master;
create policy "feature master managed by super admins"
on public.feature_master for all to authenticated
using (public.admin_has_permission('admin.feature_control.manage'))
with check (public.admin_has_permission('admin.feature_control.manage'));

drop policy if exists "error logs readable by active admins" on public.error_logs;
create policy "error logs readable by observability admins"
on public.error_logs for select to authenticated
using (public.admin_has_permission('admin.observability.view'));

drop policy if exists "user activity readable by active admins" on public.user_activity;
create policy "user activity readable by observability admins"
on public.user_activity for select to authenticated
using (public.admin_has_permission('admin.observability.view'));

drop policy if exists "audit logs readable by active admins" on public.audit_logs;
create policy "audit logs readable by observability admins"
on public.audit_logs for select to authenticated
using (public.admin_has_permission('admin.observability.view'));

drop policy if exists "workshops readable by active admins" on public.workshops;
create policy "workshops readable by meeting admins"
on public.workshops for select to authenticated
using (public.admin_has_permission('admin.meetings.view'));
