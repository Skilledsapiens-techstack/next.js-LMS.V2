drop policy if exists "students can delete own recording progress" on public.student_recording_progress;

revoke delete on public.student_recording_progress from authenticated;
