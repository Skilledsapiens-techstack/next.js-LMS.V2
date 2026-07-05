alter table if exists public.students
  add column if not exists last_seen_at timestamptz;

create index if not exists students_last_seen_at_idx
on public.students (last_seen_at desc)
where last_seen_at is not null;

create or replace function public.update_student_last_seen()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  next_last_seen timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  update public.students
  set last_seen_at = next_last_seen
  where active is true
    and (
      auth_user_id = auth.uid()
      or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

  return next_last_seen;
end;
$$;

revoke all on function public.update_student_last_seen() from public;
grant execute on function public.update_student_last_seen() to authenticated;

create table if not exists public.system_event_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  module text not null,
  severity text not null default 'info',
  event_type text not null,
  message text not null,
  related_entity_type text,
  related_entity_id text,
  actor_email text,
  details jsonb not null default '{}'::jsonb,
  constraint system_event_logs_severity_check check (severity in ('info', 'warning', 'error', 'critical'))
);

create index if not exists system_event_logs_created_at_idx
on public.system_event_logs (created_at desc);

create index if not exists system_event_logs_severity_created_at_idx
on public.system_event_logs (severity, created_at desc);

alter table public.system_event_logs enable row level security;

grant select, insert on table public.system_event_logs to authenticated;

drop policy if exists "system event logs readable by active admins" on public.system_event_logs;
create policy "system event logs readable by active admins"
on public.system_event_logs
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "system event logs insertable by active admins" on public.system_event_logs;
create policy "system event logs insertable by active admins"
on public.system_event_logs
for insert
to authenticated
with check (
  public.is_active_admin()
  and lower(coalesce(actor_email, '')) = public.current_auth_email()
);

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  status text not null default 'open',
  severity text not null default 'warning',
  module text not null,
  title text not null,
  message text not null,
  related_event_id uuid references public.system_event_logs(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  constraint system_alerts_status_check check (status in ('open', 'resolved', 'dismissed')),
  constraint system_alerts_severity_check check (severity in ('warning', 'error', 'critical'))
);

create index if not exists system_alerts_status_created_at_idx
on public.system_alerts (status, created_at desc);

alter table public.system_alerts enable row level security;

grant select, insert, update on table public.system_alerts to authenticated;

drop policy if exists "system alerts readable by active admins" on public.system_alerts;
create policy "system alerts readable by active admins"
on public.system_alerts
for select
to authenticated
using (public.is_active_admin());

drop policy if exists "system alerts insertable by active admins" on public.system_alerts;
create policy "system alerts insertable by active admins"
on public.system_alerts
for insert
to authenticated
with check (public.is_active_admin());

drop policy if exists "system alerts updateable by active admins" on public.system_alerts;
create policy "system alerts updateable by active admins"
on public.system_alerts
for update
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());
