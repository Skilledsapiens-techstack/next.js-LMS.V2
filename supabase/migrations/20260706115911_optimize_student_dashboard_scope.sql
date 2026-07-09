create or replace function public.student_dashboard_bundle(p_student_email text default null::text)
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
  student_scope as (
    select
      c.student_id,
      c.email,
      public.lms_normalized_scope_values(public.lms_student_program_keys(c.student_id)) as program_keys,
      public.lms_normalized_scope_values(public.lms_student_cohort_names(c.student_id)) as cohort_names
    from context c
  ),
  student_row as (
    select s.*
    from public.students s
    join student_scope scope on s.id = scope.student_id
  ),
  program_rows as (
    select scope.student_id, program_key
    from student_scope scope
    cross join lateral unnest(scope.program_keys) program_key
    where scope.student_id is not null
  ),
  student_cohort_rows as (
    select sc.student_id, sc.cohort_id, sc.cohort_name
    from public.student_cohorts sc
    join student_scope scope on sc.student_id = scope.student_id
  ),
  cohort_rows as (
    select c.*
    from public.cohorts c
    cross join student_scope scope
    cross join lateral (
      select
        public.lms_normalized_scope_values(case when c.program_key is null then '{}'::text[] else array[c.program_key]::text[] end) as program_keys,
        public.lms_normalized_scope_values(array[c.name]::text[]) as cohort_names
    ) audience
    where scope.student_id is not null
      and c.status <> 'inactive'
      and (cardinality(audience.program_keys) = 0 or scope.program_keys && audience.program_keys)
      and (cardinality(audience.cohort_names) = 0 or scope.cohort_names && audience.cohort_names)
    order by c.updated_at desc
  ),
  workshop_rows as (
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
    cross join student_scope scope
    cross join lateral (
      select
        public.lms_workshop_program_keys(w.program_key, w.cohort_names) as program_keys,
        public.lms_normalized_scope_values(w.cohort_names) as cohort_names
    ) audience
    left join public.paid_access pa
      on lower(trim(pa.student_email)) = scope.email
     and pa.item_type = 'workshop'
     and pa.status = 'active'
     and (pa.item_id = w.workshop_id or pa.item_id = w.id::text)
     and (pa.expires_at is null or pa.expires_at > now())
    where scope.student_id is not null
      and w.workshop_status <> 'Inactive'
      and w.workshop_status <> 'Cancelled'
      and (cardinality(audience.program_keys) = 0 or scope.program_keys && audience.program_keys)
      and (cardinality(audience.cohort_names) = 0 or scope.cohort_names && audience.cohort_names)
    order by w.date asc
  ),
  announcement_rows as (
    select a.*
    from public.announcements a
    cross join student_scope scope
    cross join lateral (
      select
        public.lms_normalized_scope_values(a.program_keys) as program_keys,
        public.lms_normalized_scope_values(a.cohort_names) as cohort_names
    ) audience
    where scope.student_id is not null
      and a.status = 'active'
      and (a.start_date is null or a.start_date <= current_date)
      and (a.end_date is null or a.end_date >= current_date)
      and (
        a.audience = 'all'
        or (
          a.audience = 'program'
          and (cardinality(audience.program_keys) = 0 or scope.program_keys && audience.program_keys)
        )
        or (
          a.audience = 'cohort'
          and (cardinality(audience.cohort_names) = 0 or scope.cohort_names && audience.cohort_names)
        )
      )
    order by a.pinned desc, (a.priority = 'urgent') desc, a.updated_at desc
  ),
  paid_rows as (
    select pa.*
    from public.paid_access pa
    join student_scope scope on lower(trim(pa.student_email)) = scope.email
    where pa.status = 'active'
      and (pa.expires_at is null or pa.expires_at > now())
  )
  select jsonb_build_object(
    'student', coalesce((select to_jsonb(s) from student_row s limit 1), 'null'::jsonb),
    'studentPrograms', coalesce((select jsonb_agg(to_jsonb(sp)) from program_rows sp), '[]'::jsonb),
    'studentCohorts', coalesce((select jsonb_agg(to_jsonb(sc)) from student_cohort_rows sc), '[]'::jsonb),
    'cohorts', coalesce((select jsonb_agg(to_jsonb(c)) from cohort_rows c), '[]'::jsonb),
    'workshops', coalesce((select jsonb_agg(to_jsonb(w)) from workshop_rows w), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(to_jsonb(a)) from announcement_rows a), '[]'::jsonb),
    'featureMaster', coalesce((
      select jsonb_agg(to_jsonb(fm) order by fm.category asc, fm.feature_name asc)
      from public.feature_master fm
    ), '[]'::jsonb),
    'paidAccess', coalesce((select jsonb_agg(to_jsonb(pa)) from paid_rows pa), '[]'::jsonb)
  );
$function$;
