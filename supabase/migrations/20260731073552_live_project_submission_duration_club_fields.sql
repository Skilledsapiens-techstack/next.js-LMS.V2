alter table public.project_submission_requests
  add column if not exists live_project_total_days integer,
  add column if not exists duration_confirmation_accepted boolean,
  add column if not exists linkedin_profile_id text,
  add column if not exists college_club_member boolean,
  add column if not exists college_club_name text,
  add column if not exists college_club_other text,
  add column if not exists wants_skilled_sapiens_collaboration boolean;

update public.project_submission_requests
set live_project_total_days = greatest(1, (project_end_date - project_start_date) + 1)
where live_project_total_days is null
  and project_start_date is not null
  and project_end_date is not null;
