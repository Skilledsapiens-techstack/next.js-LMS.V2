-- ATS Resume Score foundation.
-- Resume files, extracted resume text, and pasted job descriptions are intentionally not stored.

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
      'admin.admin_users.view',
      'admin.admin_users.manage',
      'admin.feature_control.manage',
      'admin.payments.view',
      'admin.paid_access.view',
      'admin.ats.view',
      'admin.ats.manage'
    ]::text[]
  );

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
      'admin.email.view',
      'admin.email.manage',
      'admin.observability.view',
      'admin.payments.view',
      'admin.paid_access.view',
      'admin.ats.view',
      'admin.ats.manage'
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

create table if not exists public.ats_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  role_name text not null,
  category text not null,
  description text,
  status text not null default 'active',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint ats_roles_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.ats_role_levels (
  id uuid primary key default gen_random_uuid(),
  level_key text not null unique,
  level_name text not null,
  description text,
  sort_order integer not null default 100,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint ats_role_levels_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.ats_role_profiles (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.ats_roles(id) on delete cascade,
  level_id uuid not null references public.ats_role_levels(id) on delete cascade,
  keywords text[] not null default '{}',
  action_verbs text[] not null default '{}',
  preferred_sections text[] not null default '{}',
  expectations jsonb not null default '{}'::jsonb,
  scoring_weights jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint ats_role_profiles_unique unique (role_id, level_id),
  constraint ats_role_profiles_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.ats_scoring_versions (
  id uuid primary key default gen_random_uuid(),
  version_key text not null unique,
  title text not null,
  description text,
  weights jsonb not null,
  free_scan_weights jsonb not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint ats_scoring_versions_status_check check (status in ('active', 'inactive', 'draft'))
);

create table if not exists public.ats_packages (
  id uuid primary key default gen_random_uuid(),
  package_key text not null unique,
  title text not null,
  description text,
  scan_credits integer not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  payment_link text,
  includes_advanced_analysis boolean not null default true,
  includes_jd_match boolean not null default true,
  includes_report_download boolean not null default true,
  status text not null default 'active',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint ats_packages_scan_credits_check check (scan_credits > 0),
  constraint ats_packages_amount_check check (amount >= 0),
  constraint ats_packages_payment_link_check check (payment_link is null or payment_link ~* '^https?://'),
  constraint ats_packages_status_check check (status in ('active', 'inactive', 'draft'))
);

create table if not exists public.ats_student_credit_grants (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  student_email text not null,
  package_id uuid references public.ats_packages(id) on delete set null,
  source text not null default 'payment',
  source_payment_order_id text,
  source_payment_id text,
  purchased_scans integer not null,
  remaining_scans integer not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ats_student_credit_grants_source_check check (source in ('payment', 'admin', 'migration', 'adjustment')),
  constraint ats_student_credit_grants_purchased_check check (purchased_scans > 0),
  constraint ats_student_credit_grants_remaining_check check (remaining_scans >= 0 and remaining_scans <= purchased_scans)
);

create table if not exists public.ats_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  student_email text not null,
  student_name text,
  scan_mode text not null,
  access_type text not null,
  role_id uuid references public.ats_roles(id) on delete set null,
  level_id uuid references public.ats_role_levels(id) on delete set null,
  credit_grant_id uuid references public.ats_student_credit_grants(id) on delete set null,
  scoring_version_id uuid references public.ats_scoring_versions(id) on delete set null,
  overall_score integer not null,
  breakdown jsonb not null,
  improvement_summary jsonb not null default '{}'::jsonb,
  jd_match_used boolean not null default false,
  jd_match_score integer,
  report_downloaded boolean not null default false,
  report_downloaded_at timestamptz,
  analysis_locale text not null default 'en-IN',
  created_at timestamptz not null default now(),
  constraint ats_attempts_scan_mode_check check (scan_mode in ('basic', 'advanced')),
  constraint ats_attempts_access_type_check check (access_type in ('free', 'paid', 'admin')),
  constraint ats_attempts_overall_score_check check (overall_score between 0 and 100),
  constraint ats_attempts_jd_match_score_check check (jd_match_score is null or jd_match_score between 0 and 100)
);

create table if not exists public.ats_usage_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references public.ats_attempts(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  student_email text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ats_usage_events_type_check check (event_type in ('basic_scan_created', 'advanced_scan_created', 'report_downloaded', 'payment_started', 'payment_completed', 'credit_granted'))
);

create index if not exists ats_roles_status_sort_idx on public.ats_roles (status, sort_order, role_name);
create index if not exists ats_role_profiles_role_level_idx on public.ats_role_profiles (role_id, level_id, status);
create index if not exists ats_packages_status_sort_idx on public.ats_packages (status, sort_order, title);
create index if not exists ats_student_credit_grants_student_email_idx on public.ats_student_credit_grants (lower(student_email), remaining_scans);
create index if not exists ats_attempts_student_email_created_idx on public.ats_attempts (lower(student_email), created_at desc);
create index if not exists ats_attempts_role_created_idx on public.ats_attempts (role_id, created_at desc);
create index if not exists ats_usage_events_created_idx on public.ats_usage_events (created_at desc, event_type);

alter table public.ats_student_credit_grants
  drop constraint if exists ats_student_credit_grants_source_payment_order_unique;

alter table public.ats_student_credit_grants
  add constraint ats_student_credit_grants_source_payment_order_unique unique (source_payment_order_id);

drop trigger if exists set_ats_roles_updated_at on public.ats_roles;
create trigger set_ats_roles_updated_at
before update on public.ats_roles
for each row execute function public.set_updated_at();

drop trigger if exists set_ats_role_levels_updated_at on public.ats_role_levels;
create trigger set_ats_role_levels_updated_at
before update on public.ats_role_levels
for each row execute function public.set_updated_at();

drop trigger if exists set_ats_role_profiles_updated_at on public.ats_role_profiles;
create trigger set_ats_role_profiles_updated_at
before update on public.ats_role_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_ats_scoring_versions_updated_at on public.ats_scoring_versions;
create trigger set_ats_scoring_versions_updated_at
before update on public.ats_scoring_versions
for each row execute function public.set_updated_at();

drop trigger if exists set_ats_packages_updated_at on public.ats_packages;
create trigger set_ats_packages_updated_at
before update on public.ats_packages
for each row execute function public.set_updated_at();

drop trigger if exists set_ats_student_credit_grants_updated_at on public.ats_student_credit_grants;
create trigger set_ats_student_credit_grants_updated_at
before update on public.ats_student_credit_grants
for each row execute function public.set_updated_at();

alter table public.ats_roles enable row level security;
alter table public.ats_role_levels enable row level security;
alter table public.ats_role_profiles enable row level security;
alter table public.ats_scoring_versions enable row level security;
alter table public.ats_packages enable row level security;
alter table public.ats_student_credit_grants enable row level security;
alter table public.ats_attempts enable row level security;
alter table public.ats_usage_events enable row level security;

grant select on table public.ats_roles, public.ats_role_levels, public.ats_role_profiles, public.ats_scoring_versions, public.ats_packages to authenticated;
grant select, insert, update on table public.ats_student_credit_grants, public.ats_attempts, public.ats_usage_events to authenticated;
grant insert, update on table public.ats_roles, public.ats_role_levels, public.ats_role_profiles, public.ats_scoring_versions, public.ats_packages to authenticated;

drop policy if exists "ats roles readable by students and ats admins" on public.ats_roles;
create policy "ats roles readable by students and ats admins"
on public.ats_roles for select to authenticated
using (status = 'active' or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats roles manageable by ats admins" on public.ats_roles;
create policy "ats roles manageable by ats admins"
on public.ats_roles for all to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

drop policy if exists "ats levels readable by students and ats admins" on public.ats_role_levels;
create policy "ats levels readable by students and ats admins"
on public.ats_role_levels for select to authenticated
using (status = 'active' or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats levels manageable by ats admins" on public.ats_role_levels;
create policy "ats levels manageable by ats admins"
on public.ats_role_levels for all to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

drop policy if exists "ats profiles readable by students and ats admins" on public.ats_role_profiles;
create policy "ats profiles readable by students and ats admins"
on public.ats_role_profiles for select to authenticated
using (status = 'active' or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats profiles manageable by ats admins" on public.ats_role_profiles;
create policy "ats profiles manageable by ats admins"
on public.ats_role_profiles for all to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

drop policy if exists "ats scoring readable by students and ats admins" on public.ats_scoring_versions;
create policy "ats scoring readable by students and ats admins"
on public.ats_scoring_versions for select to authenticated
using (status = 'active' or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats scoring manageable by ats admins" on public.ats_scoring_versions;
create policy "ats scoring manageable by ats admins"
on public.ats_scoring_versions for all to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

drop policy if exists "ats packages readable by students and ats admins" on public.ats_packages;
create policy "ats packages readable by students and ats admins"
on public.ats_packages for select to authenticated
using (status = 'active' or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats packages manageable by ats admins" on public.ats_packages;
create policy "ats packages manageable by ats admins"
on public.ats_packages for all to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

drop policy if exists "ats credits readable by owner or ats admins" on public.ats_student_credit_grants;
create policy "ats credits readable by owner or ats admins"
on public.ats_student_credit_grants for select to authenticated
using (lower(btrim(student_email)) = public.current_auth_email() or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats credits manageable by ats admins" on public.ats_student_credit_grants;
create policy "ats credits manageable by ats admins"
on public.ats_student_credit_grants for all to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

drop policy if exists "ats attempts readable by owner or ats admins" on public.ats_attempts;
create policy "ats attempts readable by owner or ats admins"
on public.ats_attempts for select to authenticated
using (lower(btrim(student_email)) = public.current_auth_email() or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats attempts insertable by owner or ats admins" on public.ats_attempts;
create policy "ats attempts insertable by owner or ats admins"
on public.ats_attempts for insert to authenticated
with check (
  (
    lower(btrim(student_email)) = public.current_auth_email()
    and scan_mode = 'basic'
    and access_type = 'free'
    and jd_match_used is false
    and credit_grant_id is null
    and (
      select count(*)
      from public.ats_attempts existing_attempt
      where lower(btrim(existing_attempt.student_email)) = public.current_auth_email()
        and existing_attempt.access_type = 'free'
        and existing_attempt.scan_mode = 'basic'
    ) < 2
  )
  or public.admin_has_permission('admin.ats.manage')
);

drop policy if exists "ats attempts updateable by ats admins" on public.ats_attempts;
create policy "ats attempts updateable by ats admins"
on public.ats_attempts for update to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

drop policy if exists "ats usage events readable by owner or ats admins" on public.ats_usage_events;
create policy "ats usage events readable by owner or ats admins"
on public.ats_usage_events for select to authenticated
using (lower(btrim(student_email)) = public.current_auth_email() or public.admin_has_permission('admin.ats.view'));

drop policy if exists "ats usage events insertable by owner or ats admins" on public.ats_usage_events;
create policy "ats usage events insertable by owner or ats admins"
on public.ats_usage_events for insert to authenticated
with check (
  lower(btrim(student_email)) = public.current_auth_email()
  or public.admin_has_permission('admin.ats.manage')
);

drop policy if exists "ats usage events updateable by ats admins" on public.ats_usage_events;
create policy "ats usage events updateable by ats admins"
on public.ats_usage_events for update to authenticated
using (public.admin_has_permission('admin.ats.manage'))
with check (public.admin_has_permission('admin.ats.manage'));

create or replace function public.consume_ats_paid_scan(
  p_student_email text,
  p_student_id uuid,
  p_student_name text,
  p_role_id uuid,
  p_level_id uuid,
  p_scoring_version_id uuid,
  p_overall_score integer,
  p_breakdown jsonb,
  p_improvement_summary jsonb,
  p_jd_match_used boolean,
  p_jd_match_score integer
)
returns public.ats_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_email text := public.current_auth_email();
  v_credit public.ats_student_credit_grants%rowtype;
  v_attempt public.ats_attempts%rowtype;
begin
  if v_auth_email is null or lower(btrim(coalesce(p_student_email, ''))) <> v_auth_email then
    raise exception 'ATS paid scan can only be consumed by the authenticated student.';
  end if;

  if p_overall_score is null or p_overall_score < 0 or p_overall_score > 100 then
    raise exception 'ATS overall score must be between 0 and 100.';
  end if;

  if p_breakdown is null or jsonb_typeof(p_breakdown) <> 'object' then
    raise exception 'ATS score breakdown is required.';
  end if;

  if p_jd_match_score is not null and (p_jd_match_score < 0 or p_jd_match_score > 100) then
    raise exception 'ATS JD match score must be between 0 and 100.';
  end if;

  select *
  into v_credit
  from public.ats_student_credit_grants
  where lower(btrim(student_email)) = v_auth_email
    and remaining_scans > 0
    and (expires_at is null or expires_at > now())
  order by granted_at asc, created_at asc
  limit 1
  for update;

  if not found then
    raise exception 'No paid ATS scan credits are available.';
  end if;

  update public.ats_student_credit_grants
  set remaining_scans = remaining_scans - 1,
      updated_at = now()
  where id = v_credit.id;

  insert into public.ats_attempts (
    access_type,
    breakdown,
    credit_grant_id,
    improvement_summary,
    jd_match_score,
    jd_match_used,
    level_id,
    overall_score,
    role_id,
    scan_mode,
    scoring_version_id,
    student_email,
    student_id,
    student_name
  )
  values (
    'paid',
    p_breakdown,
    v_credit.id,
    coalesce(p_improvement_summary, '{}'::jsonb),
    p_jd_match_score,
    coalesce(p_jd_match_used, false),
    p_level_id,
    p_overall_score,
    p_role_id,
    'advanced',
    p_scoring_version_id,
    lower(btrim(p_student_email)),
    p_student_id,
    nullif(btrim(coalesce(p_student_name, '')), '')
  )
  returning * into v_attempt;

  insert into public.ats_usage_events (attempt_id, student_id, student_email, event_type, metadata)
  values (
    v_attempt.id,
    p_student_id,
    lower(btrim(p_student_email)),
    'advanced_scan_created',
    jsonb_build_object(
      'overall_score', p_overall_score,
      'jd_match_used', coalesce(p_jd_match_used, false),
      'jd_match_score', p_jd_match_score,
      'role_id', p_role_id,
      'level_id', p_level_id
    )
  );

  return v_attempt;
end;
$$;

revoke all on function public.consume_ats_paid_scan(text, uuid, text, uuid, uuid, uuid, integer, jsonb, jsonb, boolean, integer) from public;
grant execute on function public.consume_ats_paid_scan(text, uuid, text, uuid, uuid, uuid, integer, jsonb, jsonb, boolean, integer) to authenticated;

create or replace function public.record_ats_report_download(p_attempt_id uuid)
returns public.ats_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_email text := public.current_auth_email();
  v_attempt public.ats_attempts%rowtype;
begin
  if v_auth_email is null then
    raise exception 'Authentication is required.';
  end if;

  update public.ats_attempts
  set report_downloaded = true,
      report_downloaded_at = coalesce(report_downloaded_at, now())
  where id = p_attempt_id
    and access_type = 'paid'
    and scan_mode = 'advanced'
    and lower(btrim(student_email)) = v_auth_email
  returning * into v_attempt;

  if not found then
    raise exception 'Paid ATS attempt was not found for this student.';
  end if;

  insert into public.ats_usage_events (attempt_id, student_id, student_email, event_type, metadata)
  values (
    v_attempt.id,
    v_attempt.student_id,
    v_attempt.student_email,
    'report_downloaded',
    jsonb_build_object('overall_score', v_attempt.overall_score)
  );

  return v_attempt;
end;
$$;

revoke all on function public.record_ats_report_download(uuid) from public;
grant execute on function public.record_ats_report_download(uuid) to authenticated;

alter table public.payment_orders
  drop constraint if exists payment_orders_item_type_check;

alter table public.payment_orders
  add constraint payment_orders_item_type_check
  check (item_type in ('group', 'workshop', 'resource', 'ats_package'));

grant insert on table public.payment_orders to authenticated;

drop policy if exists "ats package payment orders insertable by owning student" on public.payment_orders;
create policy "ats package payment orders insertable by owning student"
on public.payment_orders for insert to authenticated
with check (
  lower(btrim(student_email)) = public.current_auth_email()
  and item_type = 'ats_package'
  and status = 'created'
  and razorpay_payment_id is null
);

insert into public.feature_controls (module_id, student_label, student_path, status, upcoming_message, is_core, sort_order, settings)
values (
  'ats-resume-score',
  'ATS Resume Score',
  '/student/ats-resume-score',
  'show',
  'ATS Resume Score will be available soon.',
  false,
  125,
  jsonb_build_object('free_lifetime_scans', 2, 'paid_features', array['advanced_analysis', 'jd_match', 'report_download'])
)
on conflict (module_id) do update
set
  student_label = excluded.student_label,
  student_path = excluded.student_path,
  upcoming_message = coalesce(public.feature_controls.upcoming_message, excluded.upcoming_message),
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  settings = coalesce(public.feature_controls.settings, '{}'::jsonb) || excluded.settings,
  updated_at = now();

insert into public.ats_role_levels (level_key, level_name, description, sort_order)
values
  ('internship', 'Internship', 'For internship resumes and early practical exposure.', 10),
  ('fresher', 'Fresher', 'For recent graduates and students entering their first full-time role.', 20),
  ('entry_level', 'Entry Level', 'For candidates with limited professional experience.', 30),
  ('experienced', 'Experienced', 'For candidates with meaningful prior role experience.', 40)
on conflict (level_key) do update
set level_name = excluded.level_name, description = excluded.description, sort_order = excluded.sort_order, updated_at = now();

insert into public.ats_roles (role_key, role_name, category, description, sort_order)
values
  ('data_analyst', 'Data Analyst', 'Analytics', 'Transforms business data into analysis, dashboards, and decision insights.', 10),
  ('business_analyst', 'Business Analyst', 'Analytics', 'Connects business problems, requirements, processes, and measurable outcomes.', 20),
  ('data_scientist', 'Data Scientist', 'Analytics', 'Builds statistical, machine learning, and predictive analysis solutions.', 30),
  ('hr_generalist', 'HR', 'Human Resources', 'Supports hiring, employee operations, HR processes, and people programs.', 40),
  ('marketing_associate', 'Marketing', 'Marketing', 'Plans campaigns, messaging, research, content, and brand growth work.', 50),
  ('digital_marketing_specialist', 'Digital Marketing', 'Marketing', 'Manages performance marketing, SEO, social, email, and analytics.', 60),
  ('finance_analyst', 'Finance Analyst', 'Finance', 'Performs financial analysis, reporting, budgeting, and business finance support.', 70),
  ('financial_analyst', 'Financial Analyst', 'Finance', 'Analyzes financial statements, forecasts, models, and performance drivers.', 80),
  ('investment_banking_analyst', 'Investment Banking Analyst', 'Finance', 'Works on valuation, deal materials, financial models, and transaction analysis.', 90),
  ('equity_research_analyst', 'Equity Research Analyst', 'Finance', 'Researches listed companies, sectors, valuation, and investment recommendations.', 100),
  ('credit_analyst', 'Credit Analyst', 'Finance', 'Assesses borrower risk, financial strength, repayment capacity, and credit policy.', 110),
  ('risk_analyst', 'Risk Analyst', 'Finance', 'Identifies, measures, monitors, and reports financial or operational risks.', 120),
  ('portfolio_analyst', 'Portfolio Analyst', 'Finance', 'Supports portfolio monitoring, allocation analysis, performance, and reporting.', 130),
  ('accounting_audit_analyst', 'Accounting & Audit', 'Finance', 'Handles accounting controls, audit evidence, reconciliations, and compliance checks.', 140),
  ('tax_analyst', 'Tax Analyst', 'Finance', 'Supports tax compliance, filings, research, and documentation.', 150),
  ('software_developer', 'Software Developer', 'Technology', 'Builds software features, APIs, integrations, tests, and maintainable systems.', 160),
  ('frontend_developer', 'Frontend Developer', 'Technology', 'Builds user interfaces, frontend flows, performance, and accessible experiences.', 170),
  ('backend_developer', 'Backend Developer', 'Technology', 'Builds APIs, databases, services, integrations, and backend reliability.', 180),
  ('full_stack_developer', 'Full Stack Developer', 'Technology', 'Builds end-to-end product features across frontend, backend, and data layers.', 190),
  ('product_manager', 'Product Management', 'Product', 'Defines product problems, roadmaps, requirements, metrics, and cross-functional execution.', 200),
  ('sales_associate', 'Sales', 'Sales', 'Manages prospecting, pipeline, outreach, demos, negotiation, and revenue outcomes.', 210),
  ('business_development_associate', 'Business Development', 'Sales', 'Builds partnerships, leads, outreach channels, and growth opportunities.', 220),
  ('operations_associate', 'Operations', 'Operations', 'Improves processes, execution tracking, coordination, reporting, and operational quality.', 230),
  ('project_manager', 'Project Manager', 'Operations', 'Plans, tracks, coordinates, and delivers projects across stakeholders.', 240),
  ('scrum_master', 'Scrum Master', 'Operations', 'Facilitates agile ceremonies, delivery health, impediment removal, and team rituals.', 250),
  ('consulting_analyst', 'Consulting', 'Consulting', 'Solves business problems through research, analysis, recommendations, and client-ready outputs.', 260),
  ('management_consulting_analyst', 'Management Consulting', 'Consulting', 'Works on strategy, market analysis, operating models, and executive recommendations.', 270),
  ('strategy_analyst', 'Strategy Analyst', 'Consulting', 'Analyzes markets, competitors, business models, and growth strategy.', 280),
  ('customer_success_associate', 'Customer Success', 'Customer Success', 'Improves onboarding, adoption, retention, support coordination, and customer value.', 290),
  ('supply_chain_analyst', 'Supply Chain', 'Operations', 'Analyzes planning, procurement, logistics, inventory, and fulfillment operations.', 300),
  ('ui_ux_designer', 'UI/UX Designer', 'Design', 'Designs user flows, research insights, wireframes, prototypes, and product experiences.', 310)
on conflict (role_key) do update
set role_name = excluded.role_name, category = excluded.category, description = excluded.description, sort_order = excluded.sort_order, updated_at = now();

insert into public.ats_scoring_versions (version_key, title, description, weights, free_scan_weights)
values (
  'ats_v1',
  'ATS Resume Score v1',
  'Initial configurable ATS score model for browser-only PDF analysis.',
  jsonb_build_object(
    'contact_information', 10,
    'section_completeness', 15,
    'ats_readability', 15,
    'role_keyword_match', 20,
    'job_description_match', 15,
    'action_verbs', 10,
    'quantified_impact', 10,
    'formatting_risk', 5
  ),
  jsonb_build_object(
    'contact_information', 15,
    'section_completeness', 20,
    'ats_readability', 25,
    'action_verbs', 15,
    'quantified_impact', 15,
    'formatting_risk', 10
  )
)
on conflict (version_key) do update
set title = excluded.title, description = excluded.description, weights = excluded.weights, free_scan_weights = excluded.free_scan_weights, updated_at = now();

insert into public.ats_packages (package_key, title, description, scan_credits, amount, currency, sort_order)
values
  ('ats_single_scan', 'ATS Advanced Scan', 'One advanced ATS scan with detailed analysis, JD matching, and branded report download.', 1, 199, 'INR', 10),
  ('ats_3_scan_pack', 'ATS 3 Scan Pack', 'Three advanced ATS scans for iterating resume improvements.', 3, 499, 'INR', 20),
  ('ats_5_scan_pack', 'ATS 5 Scan Pack', 'Five advanced ATS scans for multiple roles or resume versions.', 5, 799, 'INR', 30)
on conflict (package_key) do update
set title = excluded.title, description = excluded.description, scan_credits = excluded.scan_credits, amount = excluded.amount, currency = excluded.currency, sort_order = excluded.sort_order, updated_at = now();

with
  levels as (
    select level_key, id as level_id from public.ats_role_levels where level_key in ('internship', 'fresher', 'entry_level', 'experienced')
  ),
  profiles(role_key, keywords, verbs, sections) as (
    values
      ('data_analyst', array['sql','excel','power bi','tableau','python','dashboard','data cleaning','data visualization','statistics','kpi','reporting','insights'], array['analyzed','visualized','cleaned','modeled','reported','segmented','automated','validated'], array['summary','skills','projects','experience','education','certifications']),
      ('business_analyst', array['requirements','stakeholder','process mapping','user stories','brd','frd','sql','excel','dashboard','gap analysis','acceptance criteria'], array['gathered','documented','mapped','analyzed','prioritized','coordinated','validated','improved'], array['summary','skills','projects','experience','education','certifications']),
      ('data_scientist', array['python','machine learning','statistics','regression','classification','pandas','numpy','scikit-learn','sql','model evaluation','feature engineering'], array['modeled','predicted','trained','evaluated','engineered','optimized','validated','analyzed'], array['summary','skills','projects','experience','education','publications']),
      ('hr_generalist', array['recruitment','onboarding','employee engagement','hr operations','ats','payroll','policy','screening','interviewing','hrms'], array['recruited','screened','onboarded','coordinated','resolved','implemented','tracked','organized'], array['summary','skills','experience','projects','education','certifications']),
      ('marketing_associate', array['campaigns','brand','content','market research','lead generation','seo','social media','analytics','copywriting','crm'], array['launched','created','researched','positioned','promoted','tracked','generated','optimized'], array['summary','skills','experience','projects','education','portfolio']),
      ('digital_marketing_specialist', array['seo','sem','google ads','meta ads','email marketing','analytics','conversion','ctr','cpc','roas','content marketing','landing page'], array['optimized','launched','scaled','tested','converted','tracked','segmented','improved'], array['summary','skills','experience','projects','certifications','portfolio']),
      ('finance_analyst', array['financial analysis','budgeting','forecasting','variance analysis','excel','financial reporting','kpi','reconciliation','power bi'], array['forecasted','analyzed','reconciled','modeled','reported','budgeted','tracked','evaluated'], array['summary','skills','experience','projects','education','certifications']),
      ('financial_analyst', array['financial modeling','valuation','forecasting','excel','financial statements','variance analysis','dcf','ratio analysis','reporting'], array['modeled','valued','forecasted','analyzed','reported','benchmarked','evaluated','prepared'], array['summary','skills','experience','projects','education','certifications']),
      ('investment_banking_analyst', array['valuation','dcf','comps','pitchbook','financial modeling','m&a','transaction','due diligence','excel','powerpoint'], array['valued','modeled','prepared','researched','analyzed','supported','benchmarked','drafted'], array['summary','skills','experience','projects','education','certifications']),
      ('equity_research_analyst', array['equity research','valuation','financial statements','sector research','dcf','comps','investment thesis','earnings','ratio analysis'], array['researched','valued','modeled','recommended','tracked','analyzed','forecasted','published'], array['summary','skills','experience','projects','education','certifications']),
      ('credit_analyst', array['credit risk','loan assessment','financial statements','cash flow','debt service','covenants','underwriting','risk rating'], array['assessed','reviewed','rated','analyzed','monitored','validated','recommended','documented'], array['summary','skills','experience','projects','education','certifications']),
      ('risk_analyst', array['risk management','market risk','credit risk','operational risk','controls','compliance','var','stress testing','reporting'], array['identified','measured','monitored','mitigated','tested','reported','assessed','escalated'], array['summary','skills','experience','projects','education','certifications']),
      ('portfolio_analyst', array['portfolio management','asset allocation','performance attribution','risk','benchmark','returns','investment analysis','reporting'], array['monitored','allocated','analyzed','reported','benchmarked','evaluated','rebalanced','tracked'], array['summary','skills','experience','projects','education','certifications']),
      ('accounting_audit_analyst', array['accounting','audit','reconciliation','internal controls','gaap','ifrs','ledger','compliance','financial statements'], array['audited','reconciled','verified','tested','prepared','reviewed','documented','controlled'], array['summary','skills','experience','projects','education','certifications']),
      ('tax_analyst', array['tax compliance','gst','tds','income tax','filing','returns','tax research','reconciliation','documentation'], array['filed','prepared','reviewed','reconciled','researched','computed','documented','validated'], array['summary','skills','experience','projects','education','certifications']),
      ('software_developer', array['javascript','typescript','react','node.js','api','database','git','testing','debugging','system design'], array['built','implemented','debugged','optimized','tested','integrated','refactored','deployed'], array['summary','skills','projects','experience','education','github']),
      ('frontend_developer', array['react','javascript','typescript','html','css','accessibility','responsive design','state management','performance','ui'], array['built','implemented','styled','optimized','tested','integrated','improved','shipped'], array['summary','skills','projects','experience','education','github']),
      ('backend_developer', array['node.js','api','database','sql','postgres','authentication','authorization','performance','testing','deployment'], array['designed','built','integrated','optimized','secured','tested','deployed','maintained'], array['summary','skills','projects','experience','education','github']),
      ('full_stack_developer', array['react','node.js','typescript','api','database','postgres','authentication','testing','deployment','git'], array['built','integrated','implemented','optimized','tested','deployed','debugged','delivered'], array['summary','skills','projects','experience','education','github']),
      ('product_manager', array['roadmap','requirements','user research','metrics','prioritization','stakeholders','product strategy','experiments','analytics'], array['defined','prioritized','launched','researched','measured','aligned','coordinated','validated'], array['summary','skills','experience','projects','education','case studies']),
      ('sales_associate', array['sales','lead generation','pipeline','crm','cold calling','negotiation','revenue','demo','closing','prospecting'], array['generated','prospected','qualified','pitched','negotiated','closed','followed up','converted'], array['summary','skills','experience','projects','education','achievements']),
      ('business_development_associate', array['business development','partnerships','lead generation','outreach','pipeline','crm','market research','proposal','revenue'], array['identified','generated','pitched','partnered','negotiated','expanded','converted','researched'], array['summary','skills','experience','projects','education','achievements']),
      ('operations_associate', array['operations','process improvement','coordination','sop','reporting','workflow','inventory','vendor','quality','excel'], array['coordinated','streamlined','tracked','improved','implemented','resolved','documented','monitored'], array['summary','skills','experience','projects','education','certifications']),
      ('project_manager', array['project planning','stakeholder management','timeline','risk management','budget','delivery','status reporting','jira','agile'], array['planned','delivered','coordinated','tracked','mitigated','managed','reported','aligned'], array['summary','skills','experience','projects','education','certifications']),
      ('scrum_master', array['scrum','agile','sprint planning','retrospective','daily standup','jira','impediments','velocity','team facilitation'], array['facilitated','coached','removed','tracked','improved','coordinated','reported','enabled'], array['summary','skills','experience','projects','education','certifications']),
      ('consulting_analyst', array['consulting','market research','problem solving','excel','powerpoint','stakeholder','strategy','analysis','recommendations'], array['analyzed','researched','recommended','modeled','presented','structured','benchmarked','synthesized'], array['summary','skills','experience','projects','education','case studies']),
      ('management_consulting_analyst', array['strategy','operating model','market sizing','benchmarking','financial analysis','powerpoint','excel','client','recommendations'], array['structured','analyzed','benchmarked','recommended','presented','modeled','synthesized','diagnosed'], array['summary','skills','experience','projects','education','case studies']),
      ('strategy_analyst', array['strategy','market research','competitive analysis','business model','growth','forecasting','kpi','financial analysis'], array['analyzed','researched','forecasted','recommended','evaluated','benchmarked','prioritized','modeled'], array['summary','skills','experience','projects','education','case studies']),
      ('customer_success_associate', array['customer success','onboarding','retention','adoption','crm','support','renewal','churn','customer health'], array['onboarded','supported','retained','resolved','tracked','improved','renewed','educated'], array['summary','skills','experience','projects','education','achievements']),
      ('supply_chain_analyst', array['supply chain','procurement','inventory','logistics','demand planning','vendor','forecasting','fulfillment','excel'], array['forecasted','planned','optimized','tracked','coordinated','reduced','monitored','analyzed'], array['summary','skills','experience','projects','education','certifications']),
      ('ui_ux_designer', array['ui design','ux research','wireframes','prototyping','figma','user flows','usability testing','design system','persona'], array['designed','researched','prototyped','tested','mapped','iterated','validated','improved'], array['summary','skills','portfolio','projects','experience','education'])
  )
insert into public.ats_role_profiles (role_id, level_id, keywords, action_verbs, preferred_sections, expectations, scoring_weights)
select
  r.id,
  l.level_id,
  p.keywords,
  p.verbs,
  p.sections,
  jsonb_build_object(
    'level', l.level_key,
    'summary', case
      when l.level_key = 'internship' then 'Prioritize projects, coursework, tools, and learning evidence.'
      when l.level_key = 'fresher' then 'Prioritize projects, internships, certifications, and measurable academic or practical work.'
      when l.level_key = 'entry_level' then 'Prioritize relevant experience, projects, tools, and clear business impact.'
      else 'Prioritize role ownership, measurable outcomes, leadership, and depth of domain experience.'
    end
  ),
  '{}'::jsonb
from profiles p
join public.ats_roles r on r.role_key = p.role_key
cross join levels l
on conflict (role_id, level_id) do update
set
  keywords = excluded.keywords,
  action_verbs = excluded.action_verbs,
  preferred_sections = excluded.preferred_sections,
  expectations = excluded.expectations,
  updated_at = now();
