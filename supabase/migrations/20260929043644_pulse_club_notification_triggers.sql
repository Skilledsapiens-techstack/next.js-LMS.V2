alter table public.pulse_notifications
drop constraint if exists pulse_notifications_type_check;

alter table public.pulse_notifications
add constraint pulse_notifications_type_check check (
  notification_type in (
    'club_action',
    'club_membership',
    'club_post',
    'comment',
    'connection_interest',
    'invite_accepted',
    'opportunity_status',
    'reaction',
    'report_status'
  )
);

create or replace function public.notify_pulse_club_member_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  club_record record;
begin
  if new.status <> 'active' or old.status = 'active' then
    return new;
  end if;

  select name, slug
  into club_record
  from public.pulse_clubs
  where id = new.club_id;

  if club_record.slug is null then
    return new;
  end if;

  perform public.create_pulse_notification(
    new.profile_id,
    null,
    'club_membership',
    'You are now a member of ' || club_record.name,
    'Open the workspace to see its events, resources, opportunities, and discussions.',
    '/pulse/clubs/' || club_record.slug,
    jsonb_build_object('club_id', new.club_id, 'membership_id', new.id, 'status', new.status)
  );

  return new;
end;
$$;

revoke all on function public.notify_pulse_club_member_status() from public;

drop trigger if exists pulse_club_members_notify_status on public.pulse_club_members;
create trigger pulse_club_members_notify_status
after update on public.pulse_club_members
for each row execute function public.notify_pulse_club_member_status();

create or replace function public.notify_pulse_club_post_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  club_record record;
  member_record record;
  notification_title text;
begin
  if new.status <> 'published' or new.post_type not in ('event', 'resource', 'opportunity') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'published' then
      return new;
    end if;
  end if;

  select name, slug
  into club_record
  from public.pulse_clubs
  where id = new.club_id
    and status = 'active';

  if club_record.slug is null then
    return new;
  end if;

  notification_title := case new.post_type
    when 'event' then 'New event from ' || club_record.name
    when 'resource' then club_record.name || ' added a resource'
    when 'opportunity' then 'New opportunity from ' || club_record.name
    else club_record.name || ' published an update'
  end;

  for member_record in
    select distinct member.profile_id
    from public.pulse_club_members member
    where member.club_id = new.club_id
      and member.status = 'active'
  loop
    perform public.create_pulse_notification(
      member_record.profile_id,
      new.author_profile_id,
      'club_post',
      notification_title,
      new.title,
      '/pulse/clubs/' || club_record.slug || '?post=' || new.id::text,
      jsonb_build_object('club_id', new.club_id, 'club_post_id', new.id, 'post_type', new.post_type)
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_pulse_club_post_published() from public;

drop trigger if exists pulse_club_posts_notify_published on public.pulse_club_posts;
create trigger pulse_club_posts_notify_published
after insert or update on public.pulse_club_posts
for each row execute function public.notify_pulse_club_post_published();

create or replace function public.notify_pulse_club_post_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
  post_record record;
  recipient_record record;
  action_label text;
begin
  select display_name
  into actor_name
  from public.pulse_profiles
  where id = new.profile_id;

  select
    post.author_profile_id,
    post.club_id,
    post.id,
    post.post_type,
    post.title,
    club.name as club_name,
    club.slug as club_slug
  into post_record
  from public.pulse_club_posts post
  join public.pulse_clubs club on club.id = post.club_id
  where post.id = new.club_post_id;

  if post_record.id is null or post_record.club_slug is null then
    return new;
  end if;

  action_label := case new.action_type
    when 'interested' then 'showed interest in'
    when 'saved' then 'saved'
    when 'useful' then 'found useful'
    else 'engaged with'
  end;

  for recipient_record in
    select post_record.author_profile_id as profile_id
    union
    select member.profile_id
    from public.pulse_club_members member
    where member.club_id = post_record.club_id
      and member.status = 'active'
      and member.role in ('admin', 'moderator')
  loop
    perform public.create_pulse_notification(
      recipient_record.profile_id,
      new.profile_id,
      'club_action',
      coalesce(actor_name, 'A student') || ' ' || action_label || ' a club ' || post_record.post_type,
      post_record.title,
      '/pulse/clubs/' || post_record.club_slug || '?post=' || post_record.id::text,
      jsonb_build_object(
        'club_id', post_record.club_id,
        'club_post_id', post_record.id,
        'post_type', post_record.post_type,
        'action_id', new.id,
        'action_type', new.action_type
      )
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_pulse_club_post_action() from public;

drop trigger if exists pulse_club_post_actions_notify_team on public.pulse_club_post_actions;
create trigger pulse_club_post_actions_notify_team
after insert on public.pulse_club_post_actions
for each row execute function public.notify_pulse_club_post_action();
