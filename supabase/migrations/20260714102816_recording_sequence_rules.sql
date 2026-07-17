create table if not exists public.recording_sequence_rules (
  id uuid primary key default gen_random_uuid(),
  program_key text not null,
  sequence_number integer not null check (sequence_number > 0),
  title text not null,
  match_aliases text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recording_sequence_rules_active_program_sequence_idx
  on public.recording_sequence_rules (program_key, sequence_number)
  where status = 'active';

create index if not exists recording_sequence_rules_program_status_order_idx
  on public.recording_sequence_rules (program_key, status, sequence_number);

create or replace function public.set_recording_sequence_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_recording_sequence_rules_updated_at on public.recording_sequence_rules;
create trigger set_recording_sequence_rules_updated_at
before update on public.recording_sequence_rules
for each row execute function public.set_recording_sequence_rules_updated_at();

alter table public.recording_sequence_rules enable row level security;

drop policy if exists "recording sequence rules readable by authenticated users" on public.recording_sequence_rules;
create policy "recording sequence rules readable by authenticated users"
on public.recording_sequence_rules
for select
to authenticated
using (
  status = 'active'
  or public.admin_has_permission('admin.recordings.view')
);

drop policy if exists "recording sequence rules manageable by recording admins" on public.recording_sequence_rules;
create policy "recording sequence rules manageable by recording admins"
on public.recording_sequence_rules
for all
to authenticated
using (public.admin_has_permission('admin.recordings.manage'))
with check (public.admin_has_permission('admin.recordings.manage'));

grant select, insert, update, delete on public.recording_sequence_rules to authenticated;
