create or replace function public.get_pulse_club_notification_audit(
  p_club_id uuid,
  p_limit integer default 30
)
returns table (
  id uuid,
  recipient_profile_id uuid,
  recipient_display_name text,
  notification_type text,
  title text,
  body text,
  link_path text,
  read_at timestamptz,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_club_id is null then
    raise exception 'Club id is required.' using errcode = '22023';
  end if;

  if not (
    (select public.pulse_is_club_admin(p_club_id))
    or (select public.admin_has_permission('admin.community.view'))
  ) then
    raise exception 'Not authorized to inspect this club notification audit.' using errcode = '42501';
  end if;

  return query
  select
    notification.id,
    notification.recipient_profile_id,
    recipient.display_name as recipient_display_name,
    notification.notification_type,
    notification.title,
    notification.body,
    notification.link_path,
    notification.read_at,
    notification.metadata,
    notification.created_at
  from public.pulse_notifications notification
  left join public.pulse_profiles recipient
    on recipient.id = notification.recipient_profile_id
  where
    notification.metadata->>'club_id' = p_club_id::text
    or exists (
      select 1
      from public.pulse_club_posts post
      where post.id::text = notification.metadata->>'club_post_id'
        and post.club_id = p_club_id
    )
  order by notification.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

revoke all on function public.get_pulse_club_notification_audit(uuid, integer) from public;
grant execute on function public.get_pulse_club_notification_audit(uuid, integer) to authenticated;

create or replace function public.send_pulse_club_test_notification(
  p_club_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  club_record record;
  current_profile_id uuid;
begin
  if p_club_id is null then
    raise exception 'Club id is required.' using errcode = '22023';
  end if;

  current_profile_id := public.pulse_current_profile_id();

  if current_profile_id is null then
    raise exception 'Create your Pulse profile before sending a test notification.' using errcode = '42501';
  end if;

  if not (
    (select public.pulse_is_club_admin(p_club_id))
    or (select public.admin_has_permission('admin.community.manage'))
  ) then
    raise exception 'Not authorized to send a test notification for this club.' using errcode = '42501';
  end if;

  select name, slug
  into club_record
  from public.pulse_clubs
  where id = p_club_id
    and status = 'active';

  if club_record.slug is null then
    raise exception 'Active club not found.' using errcode = '22023';
  end if;

  perform public.create_pulse_notification(
    current_profile_id,
    null,
    'club_post',
    'Test notification from ' || club_record.name,
    'This is a delivery test. Students will not receive this test notification.',
    '/pulse/clubs/' || club_record.slug,
    jsonb_build_object(
      'club_id', p_club_id,
      'post_type', 'test',
      'test_notification', true
    )
  );
end;
$$;

revoke all on function public.send_pulse_club_test_notification(uuid) from public;
grant execute on function public.send_pulse_club_test_notification(uuid) to authenticated;
