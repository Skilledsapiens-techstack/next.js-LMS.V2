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
