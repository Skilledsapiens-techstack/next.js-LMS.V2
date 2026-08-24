alter table public.email_send_audit_logs
  add column if not exists body_snapshot text,
  add column if not exists subject_snapshot text,
  add column if not exists recipient_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists original_payload jsonb not null default '{}'::jsonb,
  add column if not exists retry_of_attempt_key text;

create index if not exists email_send_audit_logs_retry_of_attempt_key_idx
  on public.email_send_audit_logs (retry_of_attempt_key);
