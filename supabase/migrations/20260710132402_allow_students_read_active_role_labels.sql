drop policy if exists "active role labels readable by authenticated users" on public.role_master;
create policy "active role labels readable by authenticated users"
on public.role_master
for select
to authenticated
using (status = 'active');
