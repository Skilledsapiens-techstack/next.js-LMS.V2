create table if not exists public.email_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'brevo',
  provider_event_id text,
  provider_message_id text,
  email_queue_id uuid references public.email_queue(id) on delete set null,
  recipient_email text,
  event_type text not null,
  event_status text not null default 'received',
  subject text,
  link_url text,
  reason text,
  template_id text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint email_provider_events_event_type_check check (
    event_type in (
      'sent',
      'delivered',
      'opened',
      'unique_opened',
      'clicked',
      'soft_bounce',
      'hard_bounce',
      'bounced',
      'deferred',
      'spam',
      'unsubscribed',
      'blocked',
      'invalid_email',
      'error',
      'unknown'
    )
  )
);

create unique index if not exists email_provider_events_dedupe_idx
on public.email_provider_events (
  provider,
  coalesce(provider_event_id, ''),
  coalesce(provider_message_id, ''),
  event_type,
  coalesce(recipient_email, ''),
  occurred_at
);

create index if not exists email_provider_events_message_idx
on public.email_provider_events(provider, provider_message_id);

create index if not exists email_provider_events_email_queue_idx
on public.email_provider_events(email_queue_id);

create index if not exists email_provider_events_type_time_idx
on public.email_provider_events(event_type, occurred_at desc);

create index if not exists email_provider_events_recipient_idx
on public.email_provider_events(recipient_email, occurred_at desc);

alter table public.email_provider_events enable row level security;

drop policy if exists "email provider events readable by email admins" on public.email_provider_events;
create policy "email provider events readable by email admins"
on public.email_provider_events
for select
to authenticated
using (public.admin_has_permission('admin.email.view'));

drop policy if exists "email provider events manageable by email admins" on public.email_provider_events;
create policy "email provider events manageable by email admins"
on public.email_provider_events
for all
to authenticated
using (public.admin_has_permission('admin.email.manage'))
with check (public.admin_has_permission('admin.email.manage'));

grant select on table public.email_provider_events to authenticated;
