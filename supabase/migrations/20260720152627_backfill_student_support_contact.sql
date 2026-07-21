insert into public.support_settings (setting_key, setting_value, status, updated_by)
select
  'student_contact',
  jsonb_build_object(
    'support_email', coalesce(settings->>'support_email', ''),
    'support_contact_title', coalesce(settings->>'support_contact_title', 'Need help from the support team?'),
    'support_contact_note', coalesce(settings->>'support_contact_note', 'Email us with your registered LMS email, module name, and the issue you are facing.')
  ),
  'active',
  coalesce(updated_by, 'migration')
from public.feature_controls
where module_id = 'whatsapp-widget'
on conflict (setting_key) do nothing;
