-- Let Pulse-only users see Pulse Resources and Career Readiness content.
-- These readers are used by the Pulse app with `pulse=true`; they should depend
-- on active Pulse access, not LMS roster access. LMS/student portal readers stay
-- unchanged and continue to enforce program/cohort entitlement.

create or replace function public.student_pulse_resources(
  p_student_email text default null::text
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  with context as (
    select
      public.lms_request_email(p_student_email) as email,
      exists (
        select 1
        from public.pulse_profiles profile
        where profile.auth_user_id = (select auth.uid())
          and profile.pulse_status = 'active'
      ) as has_pulse_profile
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
    where c.has_pulse_profile = true
      and r.status = 'active'
      and r.available_on_pulse = true
      and r.pulse_visibility = 'all'
    order by
      r.pulse_featured desc,
      coalesce(nullif(r.pulse_category, ''), nullif(r.resource_domain_key, ''), r.resource_type) asc,
      r.updated_at desc
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
    select exists (
      select 1
      from public.pulse_profiles profile
      where profile.auth_user_id = (select auth.uid())
        and profile.pulse_status = 'active'
    ) as has_pulse_profile
  ),
  visible as (
    select c.*
    from public.career_readiness_content c
    cross join context ctx
    where ctx.has_pulse_profile = true
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

revoke all on function public.student_pulse_resources(text) from public;
revoke all on function public.student_pulse_career_readiness_content(text) from public;

grant execute on function public.student_pulse_resources(text) to authenticated, service_role;
grant execute on function public.student_pulse_career_readiness_content(text) to authenticated, service_role;

notify pgrst, 'reload schema';
