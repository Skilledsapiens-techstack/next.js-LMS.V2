drop policy if exists "Pulse club posts are managed by club admins" on public.pulse_club_posts;
create policy "Pulse club posts are managed by club admins"
on public.pulse_club_posts
for all
to authenticated
using (
  public.pulse_is_club_admin(club_id)
  or (select public.admin_has_permission('admin.community.manage'))
)
with check (
  (
    author_profile_id = public.pulse_current_profile_id()
    and public.pulse_is_club_admin(club_id)
  )
  or (select public.admin_has_permission('admin.community.manage'))
);
