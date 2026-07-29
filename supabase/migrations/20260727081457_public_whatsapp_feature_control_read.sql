grant select on table public.feature_controls to anon;

drop policy if exists "whatsapp feature control readable publicly" on public.feature_controls;
create policy "whatsapp feature control readable publicly"
on public.feature_controls
for select
to anon
using (module_id = 'whatsapp-widget');
