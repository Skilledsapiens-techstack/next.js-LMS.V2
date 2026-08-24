create table if not exists public.email_suppression_overrides (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  status text not null default 'cleared',
  reason text,
  created_by text,
  created_at timestamptz not null default now(),
  constraint email_suppression_overrides_status_check check (status in ('cleared', 'suppressed')),
  constraint email_suppression_overrides_email_check check (recipient_email = lower(trim(recipient_email)) and length(recipient_email) > 3)
);

create index if not exists email_suppression_overrides_recipient_idx
on public.email_suppression_overrides(recipient_email, created_at desc);

alter table public.email_suppression_overrides enable row level security;

drop policy if exists "email suppression overrides readable by email admins" on public.email_suppression_overrides;
create policy "email suppression overrides readable by email admins"
on public.email_suppression_overrides
for select
to authenticated
using (public.admin_has_permission('admin.email.view'));

drop policy if exists "email suppression overrides manageable by email admins" on public.email_suppression_overrides;
create policy "email suppression overrides manageable by email admins"
on public.email_suppression_overrides
for all
to authenticated
using (public.admin_has_permission('admin.email.manage'))
with check (public.admin_has_permission('admin.email.manage'));

grant select, insert on table public.email_suppression_overrides to authenticated;
