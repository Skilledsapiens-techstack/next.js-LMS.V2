-- Guest Access Phase 2: safe programme catalogue visibility.
-- Verified guest leads may read active programme master rows for discovery only.

grant select on table public.programs to authenticated;

drop policy if exists "active programs readable by verified guests" on public.programs;
create policy "active programs readable by verified guests"
on public.programs
for select
to authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.guest_leads guest
    where (guest.auth_user_id = (select auth.uid()) or lower(btrim(guest.personal_email)) = public.current_auth_email())
      and guest.deactivated_at is null
      and guest.email_verified_at is not null
  )
);
