drop policy if exists "Pulse club members can join own college clubs" on public.pulse_club_members;
create policy "Pulse club members can join own college clubs"
on public.pulse_club_members
for insert
to authenticated
with check (
  profile_id = public.pulse_current_profile_id()
  and role = 'member'
  and status = 'active'
  and exists (
    select 1
    from public.pulse_clubs club
    where club.id = pulse_club_members.club_id
      and club.status = 'active'
      and club.college_id = public.pulse_current_college_id()
  )
);

drop policy if exists "Pulse club members can update own follow status" on public.pulse_club_members;
create policy "Pulse club members can update own follow status"
on public.pulse_club_members
for update
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  and role = 'member'
)
with check (
  profile_id = public.pulse_current_profile_id()
  and role = 'member'
  and status in ('active', 'paused')
);

drop policy if exists "Pulse club posts are managed by club admins and authors" on public.pulse_club_posts;
drop policy if exists "Pulse club posts are managed by club admins" on public.pulse_club_posts;
create policy "Pulse club posts are managed by club admins"
on public.pulse_club_posts
for all
to authenticated
using (public.pulse_is_club_admin(club_id))
with check (
  author_profile_id = public.pulse_current_profile_id()
  and public.pulse_is_club_admin(club_id)
);
