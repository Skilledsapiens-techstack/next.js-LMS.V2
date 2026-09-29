create or replace function public.student_recordings_bundle(p_student_email text default null::text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  with context as (
    select
      public.lms_request_email(p_student_email) as email,
      auth.uid() as user_id
  ),
  student_row as (
    select s.*
    from public.students s
    cross join context ctx
    where s.active = true
      and (
        (ctx.user_id is not null and s.auth_user_id = ctx.user_id)
        or lower(trim(s.email)) = ctx.email
        or lower(trim(coalesce(s.alt_email, ''))) = ctx.email
      )
    order by
      case
        when ctx.user_id is not null and s.auth_user_id = ctx.user_id then 1
        when lower(trim(s.email)) = ctx.email then 2
        when lower(trim(coalesce(s.alt_email, ''))) = ctx.email then 3
        else 4
      end
    limit 1
  ),
  student_scope as (
    select
      s.id as student_id,
      lower(trim(coalesce(s.email, ctx.email))) as email,
      public.lms_normalized_scope_values(array_agg(distinct membership.program_key) filter (where nullif(trim(membership.program_key), '') is not null)) as program_keys,
      public.lms_normalized_scope_values(array_agg(distinct membership.cohort_name) filter (where nullif(trim(membership.cohort_name), '') is not null)) as cohort_names
    from student_row s
    cross join context ctx
    left join lateral (
      select sp.program_key::text as program_key, null::text as cohort_name
      from public.student_programs sp
      where sp.student_id = s.id

      union all

      select c.program_key::text as program_key, coalesce(sc.cohort_name, c.name)::text as cohort_name
      from public.student_cohorts sc
      left join public.cohorts c on c.id = sc.cohort_id
      where sc.student_id = s.id

      union all

      select c.program_key::text as program_key, c.name::text as cohort_name
      from public.cohorts c
      where c.id = s.cohort_id
        or lower(trim(c.name)) = lower(trim(coalesce(s.cohort_name, '')))

      union all

      select null::text as program_key, s.cohort_name::text as cohort_name
      where nullif(trim(coalesce(s.cohort_name, '')), '') is not null
    ) membership on true
    group by s.id, s.email, ctx.email
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
  workshop_audience as materialized (
    select
      w.id,
      public.lms_normalized_scope_values(
        case when w.program_key is null then '{}'::text[] else array[w.program_key]::text[] end
        || coalesce(array_agg(c.program_key) filter (where nullif(trim(coalesce(c.program_key, '')), '') is not null), '{}'::text[])
      ) as program_keys,
      public.lms_normalized_scope_values(w.cohort_names) as cohort_names
    from public.workshops w
    cross join lateral (
      select public.lms_normalized_scope_values(w.cohort_names) as cohort_names
    ) normalized
    left join public.cohorts c
      on lower(trim(c.name)) = any(normalized.cohort_names)
    where w.workshop_status <> 'Inactive'
      and w.workshop_status <> 'Cancelled'
    group by w.id, w.program_key, w.cohort_names
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
    join workshop_audience audience on audience.id = w.id
    left join public.paid_access pa
      on lower(trim(pa.student_email)) = scope.email
     and pa.item_type = 'workshop'
     and pa.status = 'active'
     and (pa.item_id = w.workshop_id or pa.item_id = w.id::text)
     and (pa.expires_at is null or pa.expires_at > now())
    where scope.student_id is not null
      and (cardinality(audience.program_keys) > 0 or cardinality(audience.cohort_names) > 0)
      and (cardinality(audience.program_keys) = 0 or scope.program_keys && audience.program_keys)
      and (cardinality(audience.cohort_names) = 0 or scope.cohort_names && audience.cohort_names)
    order by w.date asc
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
    'paidAccess', coalesce((select jsonb_agg(to_jsonb(pa)) from paid_rows pa), '[]'::jsonb)
  );
$function$;

revoke all on function public.student_recordings_bundle(text) from public;
grant execute on function public.student_recordings_bundle(text) to authenticated;
