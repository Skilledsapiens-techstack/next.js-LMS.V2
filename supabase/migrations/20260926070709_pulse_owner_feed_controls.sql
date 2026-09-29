grant select, insert, update, delete on table public.pulse_comments to authenticated;

drop policy if exists "Pulse comments are deleted by authors or admins" on public.pulse_comments;
create policy "Pulse comments are deleted by authors or admins"
on public.pulse_comments
for delete
to authenticated
using (
  author_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
);
