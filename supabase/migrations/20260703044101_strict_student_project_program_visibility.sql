create or replace function public.student_projects_bundle(p_student_email text default null::text)
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
      public.lms_normalized_scope_values(public.lms_student_program_keys(c.student_id)) as program_keys
    from context c
  ),
  visible_projects as (
    select p.*
    from public.projects p
    cross join student_scope s
    cross join lateral (
      select public.lms_normalized_scope_values(
        coalesce(p.program_keys, '{}'::text[]) || array[coalesce(p.program_key, '')]::text[]
      ) as program_keys
    ) project_scope
    where s.student_id is not null
      and p.status = 'active'
      and cardinality(project_scope.program_keys) > 0
      and s.program_keys && project_scope.program_keys
    order by p.updated_at desc
  ),
  role_rows as (
    select distinct rm.*
    from public.role_master rm
    join visible_projects p on p.role_id = rm.role_id
    where rm.status = 'active'
    order by rm.role_name asc
  ),
  submission_rows as (
    select psr.*
    from public.project_submission_requests psr
    cross join student_scope s
    where psr.student_id = s.student_id
      and lower(trim(psr.student_email)) = s.email
    order by psr.submitted_at desc
  ),
  limit_rows as (
    select psl.*
    from public.project_submission_student_limits psl
    cross join student_scope s
    where psl.student_id = s.student_id
      and lower(trim(psl.student_email)) = s.email
  )
  select jsonb_build_object(
    'student', coalesce((
      select to_jsonb(st)
      from public.students st
      cross join student_scope s
      where st.id = s.student_id
      limit 1
    ), 'null'::jsonb),
    'projects', coalesce((select jsonb_agg(to_jsonb(p)) from visible_projects p), '[]'::jsonb),
    'projectRoles', coalesce((select jsonb_agg(to_jsonb(r)) from role_rows r), '[]'::jsonb),
    'projectSubmissionRequests', coalesce((select jsonb_agg(to_jsonb(psr)) from submission_rows psr), '[]'::jsonb),
    'projectSubmissionStudentLimits', coalesce((select jsonb_agg(to_jsonb(psl)) from limit_rows psl), '[]'::jsonb),
    'featureMaster', coalesce((
      select jsonb_agg(to_jsonb(fm) order by fm.category asc, fm.feature_name asc)
      from public.feature_master fm
    ), '[]'::jsonb)
  );
$function$;
