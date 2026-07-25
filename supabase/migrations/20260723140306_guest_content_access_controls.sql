-- Guest Access Phase 3: admin-controlled free content visibility.
-- These fields are additive and default to hidden, so existing student access is unchanged.

alter table public.resources
  add column if not exists guest_access_enabled boolean not null default false,
  add column if not exists guest_access_expires_at timestamptz,
  add column if not exists guest_registration_required boolean not null default false,
  add column if not exists guest_cta_label text,
  add column if not exists guest_cta_url text;

alter table public.career_readiness_content
  add column if not exists guest_access_enabled boolean not null default false,
  add column if not exists guest_access_expires_at timestamptz,
  add column if not exists guest_registration_required boolean not null default false,
  add column if not exists guest_cta_label text,
  add column if not exists guest_cta_url text;

alter table public.workshops
  add column if not exists guest_access_enabled boolean not null default false,
  add column if not exists guest_access_expires_at timestamptz,
  add column if not exists guest_registration_required boolean not null default false,
  add column if not exists guest_cta_label text,
  add column if not exists guest_cta_url text;

create index if not exists resources_guest_access_idx
  on public.resources (guest_access_enabled, status, updated_at desc)
  where guest_access_enabled = true;

create index if not exists career_readiness_content_guest_access_idx
  on public.career_readiness_content (guest_access_enabled, is_published, sort_order)
  where guest_access_enabled = true;

create index if not exists workshops_guest_access_idx
  on public.workshops (guest_access_enabled, workshop_status, date, time)
  where guest_access_enabled = true;

grant select on table public.resources to authenticated;
grant select on table public.career_readiness_content to authenticated;
grant select on table public.workshops to authenticated;

drop policy if exists "guest visible resources readable by verified guests" on public.resources;
create policy "guest visible resources readable by verified guests"
on public.resources
for select
to authenticated
using (
  status = 'active'
  and guest_access_enabled is true
  and (guest_access_expires_at is null or guest_access_expires_at >= now())
  and exists (
    select 1
    from public.guest_leads guest
    where (guest.auth_user_id = (select auth.uid()) or lower(btrim(guest.personal_email)) = public.current_auth_email())
      and guest.deactivated_at is null
      and guest.email_verified_at is not null
  )
);

drop policy if exists "guest visible career content readable by verified guests" on public.career_readiness_content;
create policy "guest visible career content readable by verified guests"
on public.career_readiness_content
for select
to authenticated
using (
  is_published is true
  and guest_access_enabled is true
  and (guest_access_expires_at is null or guest_access_expires_at >= now())
  and exists (
    select 1
    from public.guest_leads guest
    where (guest.auth_user_id = (select auth.uid()) or lower(btrim(guest.personal_email)) = public.current_auth_email())
      and guest.deactivated_at is null
      and guest.email_verified_at is not null
  )
);

drop policy if exists "guest visible workshops readable by verified guests" on public.workshops;
create policy "guest visible workshops readable by verified guests"
on public.workshops
for select
to authenticated
using (
  guest_access_enabled is true
  and (guest_access_expires_at is null or guest_access_expires_at >= now())
  and exists (
    select 1
    from public.guest_leads guest
    where (guest.auth_user_id = (select auth.uid()) or lower(btrim(guest.personal_email)) = public.current_auth_email())
      and guest.deactivated_at is null
      and guest.email_verified_at is not null
  )
);
