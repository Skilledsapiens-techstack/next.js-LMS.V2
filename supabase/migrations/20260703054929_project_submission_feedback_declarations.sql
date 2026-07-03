alter table if exists public.project_submission_requests
  add column if not exists student_feedback text,
  add column if not exists declaration_confirmations jsonb not null default '[]'::jsonb;
