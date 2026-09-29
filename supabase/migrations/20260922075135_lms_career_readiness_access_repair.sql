-- LMS Career Readiness access repair
-- Keeps the module available across older/newer deployments by ensuring the
-- expected columns, reader RPCs, grants, and schema-cache refresh are present.

create table if not exists public.career_readiness_content (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  description text,
  content text,
  link_url text,
  link_label text,
  program_keys text[] not null default '{}',
  cohort_names text[] not null default '{}',
  is_published boolean not null default false,
  sort_order integer not null default 100,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_readiness_content
  add column if not exists link_buttons jsonb not null default '[]'::jsonb,
  add column if not exists guest_access_enabled boolean not null default false,
  add column if not exists guest_access_expires_at timestamptz,
  add column if not exists guest_cta_label text,
  add column if not exists guest_cta_url text,
  add column if not exists guest_registration_required boolean not null default false,
  add column if not exists available_on_pulse boolean not null default false,
  add column if not exists pulse_category text,
  add column if not exists pulse_featured boolean not null default false,
  add column if not exists pulse_summary text,
  add column if not exists pulse_visibility text not null default 'program';

alter table public.career_readiness_content
  drop constraint if exists career_readiness_link_buttons_array_check,
  add constraint career_readiness_link_buttons_array_check
    check (jsonb_typeof(link_buttons) = 'array');

alter table public.career_readiness_content
  drop constraint if exists career_readiness_content_pulse_visibility_check,
  add constraint career_readiness_content_pulse_visibility_check
    check (pulse_visibility in ('all', 'college', 'program'));

alter table public.career_readiness_content enable row level security;

grant select on table public.career_readiness_content to authenticated;
grant insert, update on table public.career_readiness_content to authenticated;

create index if not exists career_readiness_content_published_idx
  on public.career_readiness_content (is_published, category, sort_order, updated_at desc);

create index if not exists career_readiness_content_program_keys_idx
  on public.career_readiness_content using gin (program_keys);

create index if not exists career_readiness_content_cohort_names_idx
  on public.career_readiness_content using gin (cohort_names);

create index if not exists career_readiness_available_on_pulse_idx
  on public.career_readiness_content (available_on_pulse, pulse_featured, category, sort_order, updated_at desc)
  where is_published = true;

drop policy if exists "career readiness readable by resource admins" on public.career_readiness_content;
create policy "career readiness readable by resource admins"
on public.career_readiness_content
for select
to authenticated
using (public.admin_has_permission('admin.resources.view'));

drop policy if exists "career readiness insertable by resource admins" on public.career_readiness_content;
create policy "career readiness insertable by resource admins"
on public.career_readiness_content
for insert
to authenticated
with check (public.admin_has_permission('admin.resources.manage'));

drop policy if exists "career readiness updateable by resource admins" on public.career_readiness_content;
create policy "career readiness updateable by resource admins"
on public.career_readiness_content
for update
to authenticated
using (public.admin_has_permission('admin.resources.manage'))
with check (public.admin_has_permission('admin.resources.manage'));

create or replace function public.student_career_readiness_content(
  p_student_email text default null::text
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  with context as (
    select public.lms_student_id_for_request(p_student_email) as student_id
  ),
  visible as (
    select c.*
    from public.career_readiness_content c
    cross join context ctx
    where ctx.student_id is not null
      and c.is_published = true
      and (
        (
          cardinality(public.lms_normalized_scope_values(c.program_keys)) = 0
          and cardinality(public.lms_normalized_scope_values(c.cohort_names)) = 0
        )
        or public.lms_audience_matches(ctx.student_id, c.program_keys, c.cohort_names)
      )
    order by c.category asc, c.sort_order asc, c.updated_at desc
  )
  select coalesce(jsonb_agg(to_jsonb(visible)), '[]'::jsonb)
  from visible;
$function$;

create or replace function public.student_career_readiness_content(
  p_student_email text default null::text,
  p_pulse boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  with context as (
    select public.lms_student_id_for_request(p_student_email) as student_id
  ),
  visible as (
    select c.*
    from public.career_readiness_content c
    cross join context ctx
    where ctx.student_id is not null
      and c.is_published = true
      and (
        (
          p_pulse = true
          and c.available_on_pulse = true
          and c.pulse_visibility = 'all'
        )
        or (
          p_pulse = false
          and (
            (
              cardinality(public.lms_normalized_scope_values(c.program_keys)) = 0
              and cardinality(public.lms_normalized_scope_values(c.cohort_names)) = 0
            )
            or public.lms_audience_matches(ctx.student_id, c.program_keys, c.cohort_names)
          )
        )
      )
    order by
      case when p_pulse then c.pulse_featured else false end desc,
      c.category asc,
      c.sort_order asc,
      c.updated_at desc
  )
  select coalesce(jsonb_agg(to_jsonb(visible)), '[]'::jsonb)
  from visible;
$function$;

create or replace function public.student_pulse_career_readiness_content(
  p_student_email text default null::text
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select public.student_career_readiness_content(p_student_email, true);
$function$;

revoke all on function public.student_career_readiness_content(text) from public;
revoke all on function public.student_career_readiness_content(text, boolean) from public;
revoke all on function public.student_pulse_career_readiness_content(text) from public;

grant execute on function public.student_career_readiness_content(text) to authenticated, service_role;
grant execute on function public.student_career_readiness_content(text, boolean) to authenticated, service_role;
grant execute on function public.student_pulse_career_readiness_content(text) to authenticated, service_role;

insert into public.feature_controls (module_id, student_label, student_path, status, upcoming_message, is_core, sort_order)
values ('career-readiness', 'Career Readiness', '/student/career-readiness', 'show', null, false, 85)
on conflict (module_id) do update
set
  student_label = excluded.student_label,
  student_path = excluded.student_path,
  sort_order = excluded.sort_order,
  updated_at = now();

notify pgrst, 'reload schema';
