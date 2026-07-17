alter table public.recording_sequence_rules
  add column if not exists recording_section text not null default 'other_workshops';

alter table public.recording_sequence_rules
  drop constraint if exists recording_sequence_rules_section_check;

alter table public.recording_sequence_rules
  add constraint recording_sequence_rules_section_check
  check (recording_section in ('induction_live_project', 'core_modules', 'placement_mentorship', 'other_workshops'));

comment on column public.recording_sequence_rules.recording_section is 'Student recording section for matched workshop recordings.';
