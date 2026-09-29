create table if not exists public.pulse_connections (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  target_profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  connection_type text not null default 'connect_interest',
  message text,
  created_at timestamptz not null default now(),
  constraint pulse_connections_type_check check (connection_type in ('connect_interest')),
  constraint pulse_connections_message_check check (message is null or length(btrim(message)) between 2 and 500),
  constraint pulse_connections_no_self_check check (requester_profile_id <> target_profile_id),
  constraint pulse_connections_unique_pair unique (requester_profile_id, target_profile_id, connection_type)
);

create index if not exists pulse_connections_requester_idx
  on public.pulse_connections (requester_profile_id, created_at desc);

create index if not exists pulse_connections_target_idx
  on public.pulse_connections (target_profile_id, created_at desc);

alter table public.pulse_connections enable row level security;

revoke all on table public.pulse_connections from anon, authenticated;
grant select, insert, delete on table public.pulse_connections to authenticated;

create policy "Pulse connections are readable by related students and admins"
on public.pulse_connections
for select
to authenticated
using (
  requester_profile_id = public.pulse_current_profile_id()
  or target_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
);

create policy "Pulse connections are created by active requester for visible profiles"
on public.pulse_connections
for insert
to authenticated
with check (
  requester_profile_id = public.pulse_current_profile_id()
  and requester_profile_id <> target_profile_id
  and exists (
    select 1
    from public.pulse_profiles target_profile
    where target_profile.id = pulse_connections.target_profile_id
      and target_profile.pulse_status = 'active'
      and (
        target_profile.profile_visibility = 'public'
        or (
          target_profile.profile_visibility = 'college'
          and target_profile.college_id = public.pulse_current_college_id()
        )
        or (select public.admin_has_permission('admin.community.view'))
      )
  )
);

create policy "Pulse connections are removed by requester or admins"
on public.pulse_connections
for delete
to authenticated
using (
  requester_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
);

alter table public.pulse_notifications
drop constraint if exists pulse_notifications_type_check;

alter table public.pulse_notifications
add constraint pulse_notifications_type_check check (
  notification_type in (
    'comment',
    'connection_interest',
    'invite_accepted',
    'opportunity_status',
    'reaction',
    'report_status'
  )
);

create or replace function public.notify_pulse_connection_interest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
begin
  select display_name
  into actor_name
  from public.pulse_profiles
  where id = new.requester_profile_id;

  perform public.create_pulse_notification(
    new.target_profile_id,
    new.requester_profile_id,
    'connection_interest',
    coalesce(actor_name, 'A Pulse student') || ' showed interest in your profile',
    'Open their profile to see what they are building and exploring.',
    '/pulse/u/' || new.requester_profile_id::text,
    jsonb_build_object('connection_id', new.id, 'requester_profile_id', new.requester_profile_id)
  );

  return new;
end;
$$;

revoke all on function public.notify_pulse_connection_interest() from public;

drop trigger if exists pulse_connections_notify_target on public.pulse_connections;
create trigger pulse_connections_notify_target
after insert on public.pulse_connections
for each row execute function public.notify_pulse_connection_interest();
