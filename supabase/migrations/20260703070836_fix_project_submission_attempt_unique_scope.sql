alter table if exists public.project_submission_requests
  drop constraint if exists project_submission_requests_student_cohort_attempt_unique;

create unique index if not exists project_submission_requests_student_project_cohort_attempt_unique
  on public.project_submission_requests (student_id, project_id, cohort_key, attempt_number);
