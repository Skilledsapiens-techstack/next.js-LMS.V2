insert into public.project_toolkit_items (
  toolkit_id,
  item_type,
  title,
  summary,
  content,
  link_label,
  link_url,
  program_keys,
  status,
  sort_order
) values (
  'cv_points_approval',
  'custom',
  'CV Points Approval',
  'Guidance for writing, submitting, and getting live project CV points approved.',
  '{"management":"","finance":""}',
  null,
  null,
  '{}'::text[],
  'inactive',
  40
)
on conflict (toolkit_id) do nothing;
