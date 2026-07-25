insert into public.feature_controls (
  module_id,
  student_label,
  student_path,
  status,
  upcoming_message,
  is_core,
  sort_order,
  settings
)
values (
  'guest-login',
  'Guest Login Entry',
  '/guest-signup',
  'show',
  'Guest access is currently unavailable.',
  false,
  140,
  '{}'::jsonb
)
on conflict (module_id) do update
set
  student_label = excluded.student_label,
  student_path = excluded.student_path,
  upcoming_message = coalesce(public.feature_controls.upcoming_message, excluded.upcoming_message),
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  updated_at = now();

grant select on table public.feature_controls to anon;

drop policy if exists "guest login feature control readable publicly" on public.feature_controls;
create policy "guest login feature control readable publicly"
on public.feature_controls
for select
to anon
using (module_id = 'guest-login');
