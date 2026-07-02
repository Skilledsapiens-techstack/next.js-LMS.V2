grant insert, update on table public.programs to authenticated;

drop policy if exists "programs writable by active admins" on public.programs;
create policy "programs writable by active admins"
on public.programs
for insert
to authenticated
with check (is_active_admin());

drop policy if exists "programs updatable by active admins" on public.programs;
create policy "programs updatable by active admins"
on public.programs
for update
to authenticated
using (is_active_admin())
with check (is_active_admin());
