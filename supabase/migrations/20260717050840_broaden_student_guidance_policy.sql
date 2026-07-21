drop policy if exists "Students can view active student guidance content" on public.student_guidance_content;
create policy "Students can view active student guidance content"
  on public.student_guidance_content
  for select
  to authenticated
  using (
    status = 'active'
    and exists (
      select 1
      from public.students s
      where s.active = true
        and lower(trim(s.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and (
          public.lms_normalized_scope_values(public.lms_student_program_keys(s.id)) && array['mclp','smlp','hrlp','flp_er','flp_qf','pmlp']
          or public.lms_normalized_scope_values(coalesce(s.track_role_ids, '{}'::text[])) && array['mclp','smlp','hrlp','flp_er','flp_qf','pmlp']
          or lower(coalesce(s.program_name, '')) like '%leadership program%'
        )
    )
  );
