grant insert on table public.project_submission_requests to authenticated;

drop policy if exists "project submissions can be created by owning student" on public.project_submission_requests;
create policy "project submissions can be created by owning student"
  on public.project_submission_requests
  for insert
  to authenticated
  with check (
    lower(trim(student_email)) = current_auth_email()
    and status = 'submitted'
    and submission_link ~* '^https?://'
    and exists (
      select 1
      from public.students s
      where s.id::text = project_submission_requests.student_id::text
        and lower(trim(s.email)) = current_auth_email()
        and s.active is true
    )
    and exists (
      select 1
      from public.projects p
      where p.status = 'active'
        and (
          p.project_id = project_submission_requests.project_id::text
          or p.id::text = project_submission_requests.project_id::text
        )
    )
  );
