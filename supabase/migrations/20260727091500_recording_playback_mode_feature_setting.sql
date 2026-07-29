alter table public.feature_controls
  add column if not exists settings jsonb not null default '{}'::jsonb;

update public.feature_controls
set
  settings = coalesce(settings, '{}'::jsonb) ||
    case
      when coalesce(settings, '{}'::jsonb) ? 'recording_playback_mode' then '{}'::jsonb
      else jsonb_build_object('recording_playback_mode', 'external')
    end,
  updated_at = now()
where module_id = 'recordings';
