-- Allow active admins to issue live project certificates from the LMS.
-- Students keep read-only access to their own certificates; no browser-side
-- student write permission is added here.

grant insert on table public.certificates to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'certificates'
      and policyname = 'certificates insertable by active admins'
  ) then
    create policy "certificates insertable by active admins"
      on public.certificates
      for insert
      to authenticated
      with check ((select public.is_active_admin()));
  end if;
end
$$;
