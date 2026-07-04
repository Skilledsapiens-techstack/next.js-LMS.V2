alter table if exists public.workshop_recording_candidates
  add column if not exists recording_password text;

alter table if exists public.workshops
  add column if not exists zoom_recording_password text;

comment on column public.workshop_recording_candidates.recording_password is 'Zoom recording passcode captured from the recording API when available.';
comment on column public.workshops.zoom_recording_password is 'Passcode required to open the published Zoom recording, when Zoom requires one.';
