drop policy if exists "Pulse club memberships are readable by college members" on public.pulse_club_members;
create policy "Pulse club memberships are readable by college members"
on public.pulse_club_members
for select
to authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.pulse_clubs club
    where club.id = pulse_club_members.club_id
      and club.status = 'active'
      and club.college_id = public.pulse_current_college_id()
  )
);
