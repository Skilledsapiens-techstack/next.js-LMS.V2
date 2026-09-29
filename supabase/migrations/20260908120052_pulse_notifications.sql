create table if not exists public.pulse_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  actor_profile_id uuid references public.pulse_profiles(id) on delete set null,
  notification_type text not null,
  title text not null,
  body text,
  link_path text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pulse_notifications_type_check check (
    notification_type in (
      'comment',
      'reaction',
      'invite_accepted',
      'opportunity_status',
      'report_status'
    )
  ),
  constraint pulse_notifications_title_check check (length(btrim(title)) between 3 and 180)
);

create index if not exists pulse_notifications_recipient_idx
  on public.pulse_notifications (recipient_profile_id, read_at, created_at desc);

alter table public.pulse_notifications enable row level security;

revoke all on table public.pulse_notifications from anon, authenticated;
grant select on table public.pulse_notifications to authenticated;
grant update (read_at) on table public.pulse_notifications to authenticated;

create policy "Pulse notifications are readable by recipient or admins"
on public.pulse_notifications
for select
to authenticated
using (
  recipient_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
);

create policy "Pulse notifications are marked read by recipient"
on public.pulse_notifications
for update
to authenticated
using (recipient_profile_id = public.pulse_current_profile_id())
with check (recipient_profile_id = public.pulse_current_profile_id());

create or replace function public.create_pulse_notification(
  p_target_profile_id uuid,
  p_actor_profile_id uuid,
  p_notification_type text,
  p_title text,
  p_body text,
  p_link_path text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_target_profile_id is null then
    return;
  end if;

  if p_actor_profile_id is not null and p_target_profile_id = p_actor_profile_id then
    return;
  end if;

  insert into public.pulse_notifications (
    recipient_profile_id,
    actor_profile_id,
    notification_type,
    title,
    body,
    link_path,
    metadata
  )
  values (
    p_target_profile_id,
    p_actor_profile_id,
    p_notification_type,
    p_title,
    nullif(p_body, ''),
    nullif(p_link_path, ''),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.create_pulse_notification(uuid, uuid, text, text, text, text, jsonb) from public;

create or replace function public.notify_pulse_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_record public.pulse_posts%rowtype;
  actor_name text;
begin
  if new.status <> 'published' then
    return new;
  end if;

  select *
  into post_record
  from public.pulse_posts
  where id = new.post_id;

  if post_record.id is null then
    return new;
  end if;

  select display_name
  into actor_name
  from public.pulse_profiles
  where id = new.author_profile_id;

  perform public.create_pulse_notification(
    post_record.author_profile_id,
    new.author_profile_id,
    'comment',
    coalesce(actor_name, 'A Pulse student') || ' commented on your post',
    post_record.title,
    '/pulse/home',
    jsonb_build_object('post_id', new.post_id, 'comment_id', new.id)
  );

  return new;
end;
$$;

revoke all on function public.notify_pulse_post_comment() from public;

drop trigger if exists pulse_comments_notify_author on public.pulse_comments;
create trigger pulse_comments_notify_author
after insert on public.pulse_comments
for each row execute function public.notify_pulse_post_comment();

create or replace function public.notify_pulse_post_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_record public.pulse_posts%rowtype;
  actor_name text;
begin
  if new.post_id is null or new.reaction_type <> 'celebrate' then
    return new;
  end if;

  select *
  into post_record
  from public.pulse_posts
  where id = new.post_id;

  if post_record.id is null then
    return new;
  end if;

  select display_name
  into actor_name
  from public.pulse_profiles
  where id = new.profile_id;

  perform public.create_pulse_notification(
    post_record.author_profile_id,
    new.profile_id,
    'reaction',
    coalesce(actor_name, 'A Pulse student') || ' recognized your post',
    post_record.title,
    '/pulse/home',
    jsonb_build_object('post_id', new.post_id, 'reaction_id', new.id)
  );

  return new;
end;
$$;

revoke all on function public.notify_pulse_post_reaction() from public;

drop trigger if exists pulse_reactions_notify_author on public.pulse_reactions;
create trigger pulse_reactions_notify_author
after insert on public.pulse_reactions
for each row execute function public.notify_pulse_post_reaction();

create or replace function public.notify_pulse_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
begin
  if new.status <> 'accepted' or new.accepted_by_profile_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'accepted' then
      return new;
    end if;
  end if;

  select display_name
  into actor_name
  from public.pulse_profiles
  where id = new.accepted_by_profile_id;

  perform public.create_pulse_notification(
    new.invited_by_profile_id,
    new.accepted_by_profile_id,
    'invite_accepted',
    coalesce(actor_name, 'A student') || ' joined through your invite',
    'Your Pulse referral loop is growing.',
    '/pulse/invite',
    jsonb_build_object('invite_id', new.id)
  );

  return new;
end;
$$;

revoke all on function public.notify_pulse_invite_accepted() from public;

drop trigger if exists pulse_invites_notify_accepted on public.pulse_invites;
create trigger pulse_invites_notify_accepted
after insert or update on public.pulse_invites
for each row execute function public.notify_pulse_invite_accepted();

create or replace function public.notify_pulse_opportunity_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  opportunity_title text;
begin
  if new.status = old.status then
    return new;
  end if;

  select title
  into opportunity_title
  from public.pulse_opportunities
  where id = new.opportunity_id;

  perform public.create_pulse_notification(
    new.profile_id,
    null,
    'opportunity_status',
    'Your opportunity status changed',
    coalesce(opportunity_title, 'Opportunity') || ' is now ' || new.status || '.',
    '/pulse/opportunities',
    jsonb_build_object('opportunity_id', new.opportunity_id, 'application_id', new.id, 'status', new.status)
  );

  return new;
end;
$$;

revoke all on function public.notify_pulse_opportunity_status() from public;

drop trigger if exists pulse_applications_notify_status on public.pulse_opportunity_applications;
create trigger pulse_applications_notify_status
after update on public.pulse_opportunity_applications
for each row execute function public.notify_pulse_opportunity_status();

create or replace function public.notify_pulse_report_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status or new.status not in ('reviewing', 'resolved', 'dismissed') then
    return new;
  end if;

  perform public.create_pulse_notification(
    new.reporter_profile_id,
    null,
    'report_status',
    'Your report is now ' || new.status,
    'The Pulse moderation team has updated your report.',
    '/pulse/home',
    jsonb_build_object('report_id', new.id, 'status', new.status)
  );

  return new;
end;
$$;

revoke all on function public.notify_pulse_report_status() from public;

drop trigger if exists pulse_reports_notify_status on public.pulse_reports;
create trigger pulse_reports_notify_status
after update on public.pulse_reports
for each row execute function public.notify_pulse_report_status();
