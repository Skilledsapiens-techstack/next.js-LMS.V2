-- Capture the admin read-access fixes that were applied directly to the
-- linked Supabase project during local integration debugging.

alter table if exists public.admin_users enable row level security;
alter table if exists public.workshop_recording_candidates enable row level security;

grant select on table public.admin_users to authenticated;
grant select on table public.workshop_recording_candidates to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
      and policyname = 'admin users can read own active profile'
  ) then
    create policy "admin users can read own active profile"
      on public.admin_users
      for select
      to authenticated
      using (
        status = 'active'
        and (
          auth_user_id = (select auth.uid())
          or lower(email) = public.current_auth_email()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workshop_recording_candidates'
      and policyname = 'recording candidates readable by active admins'
  ) then
    create policy "recording candidates readable by active admins"
      on public.workshop_recording_candidates
      for select
      to authenticated
      using ((select public.is_active_admin()));
  end if;
end
$$;
