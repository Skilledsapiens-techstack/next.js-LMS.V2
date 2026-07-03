alter table if exists public.project_submission_requests
  add column if not exists is_late boolean not null default false;

alter table if exists public.project_submission_requests
  drop constraint if exists project_submission_requests_status_check;

alter table if exists public.project_submission_requests
  add constraint project_submission_requests_status_check
  check (
    status = any (
      array[
        'submitted'::text,
        'under_review'::text,
        'approved'::text,
        'rejected'::text,
        'changes_requested'::text,
        'withdrawn'::text
      ]
    )
  );

grant insert on table public.project_submission_requests to authenticated;

drop policy if exists "project submissions can be created by owning student" on public.project_submission_requests;
create policy "project submissions can be created by owning student"
  on public.project_submission_requests
  for insert
  to authenticated
  with check (
    lower(student_email) = current_auth_email()
    and status = 'submitted'
    and submission_link ~* '^https?://'
    and exists (
      select 1
      from public.students s
      where s.id::text = student_id
        and lower(s.email) = current_auth_email()
        and s.active is true
    )
    and exists (
      select 1
      from public.projects p
      where p.project_id = project_submission_requests.project_id
        and p.status = 'active'
    )
  );
