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
  'email-service',
  'Email Delivery',
  '/admin/email-center',
  'show',
  'Email delivery is temporarily paused. Recipient previews, templates, and history remain available.',
  false,
  165,
  jsonb_build_object('scope', 'email_delivery')
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
      when coalesce(public.feature_controls.settings, '{}'::jsonb) ? 'scope' then '{}'::jsonb
      else jsonb_build_object('scope', 'email_delivery')
    end,
  updated_at = now();

grant select on table public.feature_controls to anon;

drop policy if exists "email service feature control readable publicly" on public.feature_controls;
create policy "email service feature control readable publicly"
on public.feature_controls
for select
to anon
using (module_id = 'email-service');
