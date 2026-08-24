create table if not exists public.email_send_audit_logs (
  id uuid primary key default gen_random_uuid(),
  attempt_key text not null unique,
  action text not null default 'sendAdminStudentCommunication',
  actor_email text,
  actor_user_id uuid,
  batch_size integer not null default 0,
  category text,
  cohort_names text[] not null default '{}',
  daily_limit integer not null default 300,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  provider text not null default 'brevo',
  queue_rows_created integer not null default 0,
  recipient_filters jsonb not null default '{}'::jsonb,
  recipients integer not null default 0,
  remaining_after_batch integer not null default 0,
  remaining_today integer not null default 0,
  resolved_recipients integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  send_mode text not null,
  sent integer not null default 0,
  failed integer not null default 0,
  status text not null default 'started',
  subject text,
  suppressed_recipients integer not null default 0,
  template_key text,
  used_today integer not null default 0,
  will_send integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_send_audit_logs_status_check check (status in ('started', 'sent', 'partial', 'failed')),
  constraint email_send_audit_logs_send_mode_check check (send_mode in ('direct', 'cohort_students', 'cohort_google_group', 'all_active_students'))
);

create index if not exists email_send_audit_logs_created_at_idx
  on public.email_send_audit_logs (created_at desc);

create index if not exists email_send_audit_logs_actor_email_idx
  on public.email_send_audit_logs (actor_email);

create index if not exists email_send_audit_logs_status_idx
  on public.email_send_audit_logs (status);

create index if not exists email_send_audit_logs_template_key_idx
  on public.email_send_audit_logs (template_key);

create index if not exists email_send_audit_logs_cohort_names_idx
  on public.email_send_audit_logs using gin (cohort_names);

create or replace function public.touch_email_send_audit_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_email_send_audit_logs_touch_updated_at on public.email_send_audit_logs;
create trigger trg_email_send_audit_logs_touch_updated_at
before update on public.email_send_audit_logs
for each row
execute function public.touch_email_send_audit_logs_updated_at();

alter table public.email_send_audit_logs enable row level security;

grant select on public.email_send_audit_logs to authenticated;
grant insert, update on public.email_send_audit_logs to service_role;

drop policy if exists "Admins can view email send audit logs" on public.email_send_audit_logs;
create policy "Admins can view email send audit logs"
on public.email_send_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users admin_user
    where admin_user.auth_user_id = auth.uid()
      and admin_user.status = 'active'
      and (
        admin_user.role = 'super_admin'
        or 'admin.email.view' = any(admin_user.permissions)
        or 'admin.email.manage' = any(admin_user.permissions)
      )
  )
);
