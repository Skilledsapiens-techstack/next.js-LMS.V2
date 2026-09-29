create or replace function public.student_announcements_bundle(p_student_email text default null::text)
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
  announcement_rows as (
    select a.*
    from public.announcements a
    cross join student_scope scope
    cross join lateral (
      select
        public.lms_normalized_scope_values(a.program_keys) as program_keys,
        public.lms_normalized_scope_values(a.cohort_names) as cohort_names,
        public.lms_normalized_scope_values(a.student_emails) as student_emails
    ) audience
    where scope.student_id is not null
      and a.status = 'active'
      and (a.start_date is null or a.start_date <= current_date)
      and (a.end_date is null or a.end_date >= current_date)
      and (a.expires_at is null or a.expires_at > now())
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
        or (
          a.audience = 'student'
          and scope.email = any(audience.student_emails)
        )
      )
    order by a.pinned desc, (a.priority = 'urgent') desc, a.updated_at desc
  )
  select jsonb_build_object(
    'student', coalesce((select to_jsonb(s) from student_row s limit 1), 'null'::jsonb),
    'announcements', coalesce((select jsonb_agg(to_jsonb(a)) from announcement_rows a), '[]'::jsonb)
  );
$function$;

revoke all on function public.student_announcements_bundle(text) from public;
grant execute on function public.student_announcements_bundle(text) to authenticated;
