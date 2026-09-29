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
  'explore-pulse',
  'Explore Pulse',
  '/pulse/home',
  'show',
  'Explore Pulse is currently unavailable.',
  false,
  180,
  '{"scope": "student_lms_topbar"}'::jsonb
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
