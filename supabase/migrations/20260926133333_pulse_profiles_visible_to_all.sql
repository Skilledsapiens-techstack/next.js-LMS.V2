update public.pulse_profiles
set profile_visibility = 'public'
where profile_visibility <> 'public';

drop policy if exists "Pulse profiles are readable by owner public profiles and admins" on public.pulse_profiles;
create policy "Pulse profiles are readable by signed in Pulse users"
on public.pulse_profiles
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or pulse_status = 'active'
  or (select public.admin_has_permission('admin.community.view'))
);

drop policy if exists "Pulse connections are created by active requester for visible profiles" on public.pulse_connections;
create policy "Pulse connections are created by active requester for active profiles"
on public.pulse_connections
for insert
to authenticated
with check (
  requester_profile_id = public.pulse_current_profile_id()
  and requester_profile_id <> target_profile_id
  and exists (
    select 1
    from public.pulse_profiles target_profile
    where target_profile.id = pulse_connections.target_profile_id
      and target_profile.pulse_status = 'active'
  )
);
