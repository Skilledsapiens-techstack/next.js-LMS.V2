drop policy if exists "student cohorts readable by owning student" on public.student_cohorts;

create policy "student cohorts readable by owning student"
  on public.student_cohorts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_cohorts.student_id
        and s.active is true
        and (
          s.auth_user_id = (select auth.uid())
          or lower(trim(coalesce(s.email, ''))) = public.current_auth_email()
          or lower(trim(coalesce(s.alt_email, ''))) = public.current_auth_email()
        )
    )
  );
