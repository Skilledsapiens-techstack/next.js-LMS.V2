alter table public.pulse_opportunity_applications
add column if not exists resume_url text,
add column if not exists portfolio_url text,
add column if not exists linkedin_url text,
add column if not exists answers jsonb not null default '{}'::jsonb,
add column if not exists applied_at timestamptz;

create index if not exists pulse_opportunity_applications_profile_status_idx
  on public.pulse_opportunity_applications (profile_id, status, created_at desc);

drop policy if exists "Pulse opportunity applications are updated by applicant or admins"
on public.pulse_opportunity_applications;

create policy "Pulse opportunity applications are updated by applicant"
on public.pulse_opportunity_applications
for update
to authenticated
using (profile_id = public.pulse_current_profile_id())
with check (
  profile_id = public.pulse_current_profile_id()
  and status in ('interested', 'applied', 'withdrawn')
);

create policy "Pulse opportunity applications are updated by community admins"
on public.pulse_opportunity_applications
for update
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));
