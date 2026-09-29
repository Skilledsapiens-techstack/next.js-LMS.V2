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
