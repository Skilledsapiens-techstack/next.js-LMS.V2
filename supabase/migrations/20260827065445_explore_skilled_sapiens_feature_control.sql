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
  'explore-skilled-sapiens',
  'Explore Skilled Sapiens',
  '/student/explore',
  'show',
  'Explore Skilled Sapiens is currently unavailable.',
  false,
  170,
  '{"scope": "student_guest"}'::jsonb
)
on conflict (module_id) do update
set
  student_label = excluded.student_label,
  student_path = excluded.student_path,
  upcoming_message = coalesce(public.feature_controls.upcoming_message, excluded.upcoming_message),
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  settings = coalesce(public.feature_controls.settings, '{}'::jsonb) || excluded.settings,
  updated_at = now();

grant select on table public.feature_controls to anon;

drop policy if exists "explore skilled sapiens feature control readable publicly" on public.feature_controls;
create policy "explore skilled sapiens feature control readable publicly"
on public.feature_controls
for select
to anon
using (module_id = 'explore-skilled-sapiens');
