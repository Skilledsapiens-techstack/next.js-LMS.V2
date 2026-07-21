drop policy if exists "students can update own recording progress" on public.student_recording_progress;

revoke update on public.student_recording_progress from authenticated;
