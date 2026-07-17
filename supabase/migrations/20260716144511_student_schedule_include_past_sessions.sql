create or replace function public.student_schedule_view(
  p_student_email text default null::text,
  p_include_past boolean default false
)
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
      w.*,
      case
        when w.access_type <> 'paid' then true
        when pa.id is not null then true
        else false
      end as "hasAccess",
      case when w.access_type = 'paid' and pa.id is null then true else false end as locked,
      case when w.access_type = 'paid' and pa.id is null then 'Payment required' else '' end as "lockReason"
    from public.workshops w
    cross join context c
    left join public.paid_access pa
      on lower(trim(pa.student_email)) = c.email
     and pa.item_type = 'workshop'
     and pa.status = 'active'
     and (pa.item_id = w.workshop_id or pa.item_id = w.id::text)
     and (pa.expires_at is null or pa.expires_at > now())
    where c.student_id is not null
      and (
        (p_include_past is true and w.date is not null)
        or (coalesce(p_include_past, false) is false and w.date >= current_date)
      )
      and w.workshop_status in ('Upcoming', 'Scheduled', 'Live', 'Completed')
      and public.lms_audience_matches(
        c.student_id,
        public.lms_workshop_program_keys(w.program_key, w.cohort_names),
        w.cohort_names
      )
    order by w.date asc, w.time asc
  )
  select coalesce(jsonb_agg(to_jsonb(visible)), '[]'::jsonb)
  from visible;
$function$;
