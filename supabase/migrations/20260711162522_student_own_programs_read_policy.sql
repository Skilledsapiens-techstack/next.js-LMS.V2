drop policy if exists "student programs readable by owning student" on public.student_programs;
create policy "student programs readable by owning student"
on public.student_programs for select to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = student_programs.student_id
      and (
        s.auth_user_id = (select auth.uid())
        or lower(s.email) = public.current_auth_email()
      )
  )
);
