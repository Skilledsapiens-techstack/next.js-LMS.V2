alter table public.feature_controls
  add column if not exists settings jsonb not null default '{}'::jsonb;

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
  'whatsapp-widget',
  'WhatsApp Coordinator Widget',
  '/student',
  'show',
  'Contact Program Coordinator',
  false,
  130,
  jsonb_build_object('whatsapp_number', '')
)
on conflict (module_id) do update
set
  student_label = excluded.student_label,
  student_path = excluded.student_path,
  upcoming_message = coalesce(public.feature_controls.upcoming_message, excluded.upcoming_message),
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  settings = coalesce(public.feature_controls.settings, '{}'::jsonb) ||
    case
      when public.feature_controls.settings ? 'whatsapp_number' then '{}'::jsonb
      else jsonb_build_object('whatsapp_number', '')
    end,
  updated_at = now();
