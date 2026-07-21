create table if not exists public.student_recording_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  recording_id uuid not null references public.workshops(id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_recording_progress_student_recording_key unique (student_id, recording_id)
);

create index if not exists student_recording_progress_student_idx
  on public.student_recording_progress (student_id);

create index if not exists student_recording_progress_recording_idx
  on public.student_recording_progress (recording_id);

create index if not exists student_recording_progress_student_completed_idx
  on public.student_recording_progress (student_id, completed_at desc);

alter table public.student_recording_progress enable row level security;

grant select, insert, update, delete on public.student_recording_progress to authenticated;

drop policy if exists "students can read own recording progress" on public.student_recording_progress;
create policy "students can read own recording progress"
  on public.student_recording_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_recording_progress.student_id
        and (
          s.auth_user_id = (select auth.uid())
          or lower(s.email) = public.current_auth_email()
        )
    )
  );

drop policy if exists "students can create own recording progress" on public.student_recording_progress;
create policy "students can create own recording progress"
  on public.student_recording_progress
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students s
      where s.id = student_recording_progress.student_id
        and (
          s.auth_user_id = (select auth.uid())
          or lower(s.email) = public.current_auth_email()
        )
    )
  );

drop policy if exists "students can update own recording progress" on public.student_recording_progress;
create policy "students can update own recording progress"
  on public.student_recording_progress
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_recording_progress.student_id
        and (
          s.auth_user_id = (select auth.uid())
          or lower(s.email) = public.current_auth_email()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      where s.id = student_recording_progress.student_id
        and (
          s.auth_user_id = (select auth.uid())
          or lower(s.email) = public.current_auth_email()
        )
    )
  );

drop policy if exists "students can delete own recording progress" on public.student_recording_progress;
create policy "students can delete own recording progress"
  on public.student_recording_progress
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_recording_progress.student_id
        and (
          s.auth_user_id = (select auth.uid())
          or lower(s.email) = public.current_auth_email()
        )
    )
  );
