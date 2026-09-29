-- Pulse Career Readiness visibility scope
-- Apply this after pulse_lms_content_visibility.sql.
-- Normal LMS Career Readiness remains program/cohort scoped.
-- Pulse Career Readiness shows every published item marked available_on_pulse with pulse_visibility = 'all'.

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
      c.pulse_featured desc,
      c.category asc,
      c.sort_order asc,
      c.updated_at desc
  )
  select coalesce(jsonb_agg(to_jsonb(visible)), '[]'::jsonb)
  from visible;
$function$;

revoke all on function public.student_career_readiness_content(text, boolean) from public;
grant execute on function public.student_career_readiness_content(text, boolean) to authenticated, service_role;

create or replace function public.student_pulse_career_readiness_content(
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
      and c.available_on_pulse = true
      and c.pulse_visibility = 'all'
    order by
      c.pulse_featured desc,
      c.category asc,
      c.sort_order asc,
      c.updated_at desc
  )
  select coalesce(jsonb_agg(to_jsonb(visible)), '[]'::jsonb)
  from visible;
$function$;

revoke all on function public.student_pulse_career_readiness_content(text) from public;
grant execute on function public.student_pulse_career_readiness_content(text) to authenticated, service_role;
grant execute on function public.student_career_readiness_content(text) to authenticated, service_role;

notify pgrst, 'reload schema';
