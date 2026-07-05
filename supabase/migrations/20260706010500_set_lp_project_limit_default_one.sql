update public.project_submission_student_limits
set
  max_attempts = 1,
  notes = coalesce(nullif(notes, ''), 'Default reset to 1 project per cohort'),
  updated_at = now()
where max_attempts is distinct from 1;
