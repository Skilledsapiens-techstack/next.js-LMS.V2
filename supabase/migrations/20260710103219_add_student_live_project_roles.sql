alter table public.students
  add column if not exists live_project_role_ids text[] not null default '{}'::text[];

create index if not exists students_live_project_role_ids_gin
  on public.students
  using gin (live_project_role_ids);
