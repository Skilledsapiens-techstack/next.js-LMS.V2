-- Guest Access Phase 1: verified guest identity foundation.
--
-- Guests are intentionally separate from public.students until an admin
-- converts them by assigning paid programs/cohorts in a later phase.

create table if not exists public.guest_leads (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  full_name text not null,
  personal_email text not null,
  official_email text,
  whatsapp_country_code text not null default '+91',
  whatsapp_number text not null,
  current_status text not null,
  audience_type text not null,
  college_name text,
  education_year text,
  company_name text,
  current_job_role text,
  interested_roles text[] not null default '{}',
  interested_program text,
  current_city text,
  mentor_allocation_interest text not null default 'maybe_later',
  lead_status text not null default 'new',
  source text not null default 'guest_signup',
  email_verified_at timestamptz,
  last_active_at timestamptz,
  deactivated_at timestamptz,
  deactivated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_leads_personal_email_not_blank check (length(btrim(personal_email)) > 0),
  constraint guest_leads_full_name_not_blank check (length(btrim(full_name)) >= 2),
  constraint guest_leads_whatsapp_number_format check (whatsapp_number ~ '^[6-9][0-9]{9}$'),
  constraint guest_leads_current_status_check check (
    current_status in ('student', 'working_professional', 'looking_for_job', 'career_switcher', 'entrepreneur_founder', 'other')
  ),
  constraint guest_leads_audience_type_check check (audience_type in ('student', 'working_professional', 'other')),
  constraint guest_leads_student_fields_check check (
    audience_type <> 'student'
    or (
      length(btrim(coalesce(official_email, ''))) > 0
      and length(btrim(coalesce(college_name, ''))) > 0
      and length(btrim(coalesce(education_year, ''))) > 0
    )
  ),
  constraint guest_leads_working_fields_check check (
    audience_type <> 'working_professional'
    or length(btrim(coalesce(company_name, ''))) > 0
  ),
  constraint guest_leads_mentor_interest_check check (mentor_allocation_interest in ('yes_urgently', 'maybe_later', 'no')),
  constraint guest_leads_lead_status_check check (lead_status in ('new', 'contacted', 'interested', 'converted', 'not_interested'))
);

create unique index if not exists guest_leads_personal_email_unique_idx
  on public.guest_leads (lower(btrim(personal_email)));

create index if not exists guest_leads_status_idx
  on public.guest_leads (lead_status, created_at desc);

create index if not exists guest_leads_last_active_idx
  on public.guest_leads (last_active_at desc nulls last);

alter table public.guest_leads enable row level security;

grant select, update on table public.guest_leads to authenticated;

drop policy if exists "guest leads readable by owner or active admins" on public.guest_leads;
create policy "guest leads readable by owner or active admins"
  on public.guest_leads
  for select
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (select public.is_active_admin())
  );

drop policy if exists "guest leads updatable by owner" on public.guest_leads;

drop policy if exists "guest leads manageable by admins" on public.guest_leads;
create policy "guest leads manageable by admins"
  on public.guest_leads
  for update
  to authenticated
  using ((select public.admin_has_permission('admin.students.manage')))
  with check ((select public.admin_has_permission('admin.students.manage')));

drop trigger if exists set_guest_leads_updated_at on public.guest_leads;
create trigger set_guest_leads_updated_at
before update on public.guest_leads
for each row execute function public.set_updated_at();

create or replace function public.handle_guest_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  metadata jsonb;
  signup_type text;
  normalized_email text;
  audience text;
  official text;
  whatsapp text;
begin
  metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  signup_type := lower(btrim(coalesce(metadata ->> 'lms_signup_type', '')));

  if signup_type <> 'guest' then
    return new;
  end if;

  normalized_email := lower(btrim(coalesce(new.email, metadata ->> 'personal_email', '')));
  audience := lower(btrim(coalesce(metadata ->> 'audience_type', 'other')));
  official := lower(btrim(coalesce(metadata ->> 'official_email', '')));
  whatsapp := regexp_replace(coalesce(metadata ->> 'whatsapp_number', ''), '[^0-9]', '', 'g');

  if normalized_email = '' then
    raise exception 'Personal email is required for guest signup.' using errcode = '23514';
  end if;

  if exists (select 1 from public.students s where lower(btrim(s.email)) = normalized_email or s.auth_user_id = new.id) then
    raise exception 'This email is already linked to a Student account. Please login instead.' using errcode = '23514';
  end if;

  if exists (select 1 from public.admin_users a where lower(btrim(a.email)) = normalized_email or a.auth_user_id = new.id) then
    raise exception 'This email is already linked to an Admin account. Please login instead.' using errcode = '23514';
  end if;

  if exists (select 1 from public.guest_leads g where lower(btrim(g.personal_email)) = normalized_email or g.auth_user_id = new.id) then
    raise exception 'This guest account already exists. Please login instead.' using errcode = '23505';
  end if;

  insert into public.guest_leads (
    auth_user_id,
    full_name,
    personal_email,
    official_email,
    whatsapp_number,
    current_status,
    audience_type,
    college_name,
    education_year,
    company_name,
    current_job_role,
    interested_roles,
    interested_program,
    current_city,
    mentor_allocation_interest,
    email_verified_at
  )
  values (
    new.id,
    btrim(coalesce(metadata ->> 'full_name', '')),
    normalized_email,
    nullif(official, ''),
    whatsapp,
    lower(btrim(coalesce(metadata ->> 'current_status', 'other'))),
    audience,
    nullif(btrim(coalesce(metadata ->> 'college_name', '')), ''),
    nullif(btrim(coalesce(metadata ->> 'education_year', '')), ''),
    nullif(btrim(coalesce(metadata ->> 'company_name', '')), ''),
    nullif(btrim(coalesce(metadata ->> 'current_role', '')), ''),
    coalesce(
      array(
        select jsonb_array_elements_text(
          case
            when jsonb_typeof(metadata -> 'interested_roles') = 'array' then metadata -> 'interested_roles'
            else '[]'::jsonb
          end
        )
      ),
      '{}'
    ),
    nullif(btrim(coalesce(metadata ->> 'interested_program', '')), ''),
    nullif(btrim(coalesce(metadata ->> 'current_city', '')), ''),
    lower(btrim(coalesce(metadata ->> 'mentor_allocation_interest', 'maybe_later'))),
    new.email_confirmed_at
  );

  return new;
end;
$$;

revoke all on function public.handle_guest_auth_signup() from public;

drop trigger if exists on_guest_auth_signup on auth.users;
create trigger on_guest_auth_signup
after insert on auth.users
for each row execute function public.handle_guest_auth_signup();

create or replace function public.sync_guest_email_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email_confirmed_at is distinct from old.email_confirmed_at then
    update public.guest_leads
       set email_verified_at = new.email_confirmed_at,
           updated_at = now()
     where auth_user_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_guest_email_verification() from public;

drop trigger if exists on_guest_auth_email_verified on auth.users;
create trigger on_guest_auth_email_verified
after update of email_confirmed_at on auth.users
for each row execute function public.sync_guest_email_verification();
