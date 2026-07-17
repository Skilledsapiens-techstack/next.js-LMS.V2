drop index if exists public.recording_sequence_rules_active_program_sequence_idx;

create unique index if not exists recording_sequence_rules_active_program_section_sequence_idx
  on public.recording_sequence_rules (program_key, recording_section, sequence_number)
  where status = 'active';

drop index if exists public.recording_sequence_rules_program_status_order_idx;

create index if not exists recording_sequence_rules_program_section_status_order_idx
  on public.recording_sequence_rules (program_key, recording_section, status, sequence_number);
