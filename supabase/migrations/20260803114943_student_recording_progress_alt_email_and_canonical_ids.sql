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
          or lower(trim(coalesce(s.email, ''))) = public.current_auth_email()
          or lower(trim(coalesce(s.alt_email, ''))) = public.current_auth_email()
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
          or lower(trim(coalesce(s.email, ''))) = public.current_auth_email()
          or lower(trim(coalesce(s.alt_email, ''))) = public.current_auth_email()
        )
    )
  );
