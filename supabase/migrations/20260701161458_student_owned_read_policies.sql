do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'auth_user_id'
  ) then
    drop policy if exists "students readable by owning student" on public.students;
    create policy "students readable by owning student"
      on public.students
      for select
      to authenticated
      using (
        auth_user_id = auth.uid()
        or lower(email) = current_auth_email()
      );
  end if;
end $$;

drop policy if exists "certificates readable by owning student" on public.certificates;
create policy "certificates readable by owning student"
  on public.certificates
  for select
  to authenticated
  using (lower(student_email) = current_auth_email());

drop policy if exists "paid access readable by owning student" on public.paid_access;
create policy "paid access readable by owning student"
  on public.paid_access
  for select
  to authenticated
  using (lower(student_email) = current_auth_email());

drop policy if exists "payment orders readable by owning student" on public.payment_orders;
create policy "payment orders readable by owning student"
  on public.payment_orders
  for select
  to authenticated
  using (lower(student_email) = current_auth_email());

drop policy if exists "project submissions readable by owning student" on public.project_submission_requests;
create policy "project submissions readable by owning student"
  on public.project_submission_requests
  for select
  to authenticated
  using (lower(student_email) = current_auth_email());
