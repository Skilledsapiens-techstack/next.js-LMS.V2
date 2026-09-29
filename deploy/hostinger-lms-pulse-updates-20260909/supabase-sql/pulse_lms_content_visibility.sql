-- Pulse LMS content bridge
-- Apply this in Supabase SQL editor before using the new Admin "Show in Pulse" controls.

alter table public.resources
  add column if not exists available_on_pulse boolean not null default false,
  add column if not exists pulse_featured boolean not null default false,
  add column if not exists pulse_category text,
  add column if not exists pulse_visibility text not null default 'all',
  add column if not exists pulse_summary text;

alter table public.career_readiness_content
  add column if not exists available_on_pulse boolean not null default false,
  add column if not exists pulse_featured boolean not null default false,
  add column if not exists pulse_category text,
  add column if not exists pulse_visibility text not null default 'all',
  add column if not exists pulse_summary text;

alter table public.resources
  drop constraint if exists resources_pulse_visibility_check,
  add constraint resources_pulse_visibility_check
    check (pulse_visibility in ('all', 'college', 'program'));

alter table public.career_readiness_content
  drop constraint if exists career_readiness_content_pulse_visibility_check,
  add constraint career_readiness_content_pulse_visibility_check
    check (pulse_visibility in ('all', 'college', 'program'));

create index if not exists resources_available_on_pulse_idx
  on public.resources (available_on_pulse, pulse_featured, resource_domain_key, updated_at desc)
  where status = 'active';

create index if not exists career_readiness_available_on_pulse_idx
  on public.career_readiness_content (available_on_pulse, pulse_featured, category, sort_order, updated_at desc)
  where is_published = true;

create or replace function public.student_resources_view(p_student_email text default null::text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  with context as (
    select
      public.lms_student_id_for_request(p_student_email) as student_id,
      public.lms_request_email(p_student_email) as email
  ),
  visible as (
    select
      r.*,
      case
        when r.access_type <> 'paid' then true
        when pa.id is not null then true
        else false
      end as "hasAccess",
      case when r.access_type = 'paid' and pa.id is null then true else false end as locked,
      case when r.access_type = 'paid' and pa.id is null then 'Payment required' else '' end as "lockReason"
    from public.resources r
    cross join context c
    left join public.paid_access pa
      on lower(trim(pa.student_email)) = c.email
     and pa.item_type = 'resource'
     and pa.status = 'active'
     and (pa.item_id = r.resource_id or pa.item_id = r.id::text)
     and (pa.expires_at is null or pa.expires_at > now())
    where c.student_id is not null
      and r.status = 'active'
      and (
        cardinality(public.lms_normalized_scope_values(r.program_keys)) > 0
        or cardinality(public.lms_normalized_scope_values(r.cohort_names)) > 0
      )
      and public.lms_audience_matches(c.student_id, r.program_keys, r.cohort_names)
    order by r.updated_at desc
  )
  select coalesce(
    jsonb_agg(
      to_jsonb(visible)
      || jsonb_build_object(
        'url', case when visible.locked then null else visible.url end
      )
    ),
    '[]'::jsonb
  )
  from visible;
$function$;

create or replace function public.student_career_readiness_content(p_student_email text default null::text)
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

revoke all on function public.student_resources_view(text) from public;
revoke all on function public.student_career_readiness_content(text) from public;
grant execute on function public.student_resources_view(text) to authenticated;
grant execute on function public.student_career_readiness_content(text) to authenticated;
