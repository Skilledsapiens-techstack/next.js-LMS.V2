-- Fix Pulse Stars point rules/triggers and backfill missing events.
-- This keeps the leaderboard aligned with real Pulse actions already taken.

insert into public.pulse_leaderboard_rules (
  action_type,
  points,
  daily_cap,
  weekly_cap,
  monthly_cap,
  description,
  enabled
)
values
  ('poll_vote_cast', 1, 5, 20, 50, 'Vote in useful Pulse polls', true)
on conflict (action_type) do update
set
  points = excluded.points,
  daily_cap = excluded.daily_cap,
  weekly_cap = excluded.weekly_cap,
  monthly_cap = excluded.monthly_cap,
  description = excluded.description,
  enabled = excluded.enabled,
  updated_at = now();

do $$
begin
  if to_regclass('public.pulse_point_rules') is not null then
    execute $sql$
      insert into public.pulse_leaderboard_rules (
        action_type,
        points,
        daily_cap,
        weekly_cap,
        monthly_cap,
        description,
        enabled
      )
      select
        action_type,
        points,
        daily_cap,
        weekly_cap,
        monthly_cap,
        description,
        coalesce(status = 'active', true)
      from public.pulse_point_rules
      where action_type = 'poll_vote_cast'
      on conflict (action_type) do update
      set
        points = excluded.points,
        daily_cap = excluded.daily_cap,
        weekly_cap = excluded.weekly_cap,
        monthly_cap = excluded.monthly_cap,
        description = excluded.description,
        enabled = excluded.enabled,
        updated_at = now()
    $sql$;
  end if;
end;
$$;

create or replace function public.track_pulse_opportunity_interest_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('interested', 'applied', 'shortlisted', 'selected') then
    return new;
  end if;

  perform public.award_pulse_points(
    new.profile_id,
    'opportunity_interest',
    'pulse_opportunity_applications',
    new.id,
    case
      when new.status = 'applied' then 'Opportunity application submitted'
      else 'Opportunity interest shown'
    end,
    jsonb_build_object('opportunity_id', new.opportunity_id, 'status', new.status)
  );

  return new;
end;
$$;

revoke all on function public.track_pulse_opportunity_interest_points() from public;

drop trigger if exists pulse_opportunity_applications_track_points on public.pulse_opportunity_applications;
create trigger pulse_opportunity_applications_track_points
after insert or update on public.pulse_opportunity_applications
for each row execute function public.track_pulse_opportunity_interest_points();

insert into public.pulse_point_events (
  profile_id,
  action_type,
  points,
  source_table,
  source_id,
  description,
  college_id,
  metadata,
  created_at
)
select
  profile.id,
  'profile_completed',
  coalesce(rule.points, 10),
  'pulse_profiles',
  profile.id,
  'Profile completed',
  profile.college_id,
  '{}'::jsonb,
  profile.created_at
from public.pulse_profiles profile
left join public.pulse_leaderboard_rules rule on rule.action_type = 'profile_completed'
where profile.pulse_status = 'active'
on conflict (profile_id, action_type, source_table, source_id) do nothing;

insert into public.pulse_point_events (
  profile_id,
  action_type,
  points,
  source_table,
  source_id,
  description,
  college_id,
  metadata,
  created_at
)
select
  profile.id,
  'post_created',
  coalesce(rule.points, 2),
  'pulse_posts',
  post.id,
  'Post published',
  profile.college_id,
  jsonb_build_object('post_type', post.post_type, 'visibility', post.visibility),
  post.created_at
from public.pulse_posts post
join public.pulse_profiles profile on profile.id = post.author_profile_id and profile.pulse_status = 'active'
left join public.pulse_leaderboard_rules rule on rule.action_type = 'post_created'
where post.status = 'published'
on conflict (profile_id, action_type, source_table, source_id) do nothing;

insert into public.pulse_point_events (
  profile_id,
  action_type,
  points,
  source_table,
  source_id,
  description,
  college_id,
  metadata,
  created_at
)
select
  recipient.id,
  'shoutout_received',
  coalesce(rule.points, 10),
  'pulse_posts',
  post.id,
  'Shout-out received',
  recipient.college_id,
  jsonb_build_object('author_profile_id', post.author_profile_id, 'post_type', post.post_type),
  post.created_at
from public.pulse_posts post
join public.pulse_profiles recipient
  on recipient.id::text = post.metadata ->> 'recipient_profile_id'
  and recipient.pulse_status = 'active'
left join public.pulse_leaderboard_rules rule on rule.action_type = 'shoutout_received'
where post.status = 'published'
  and post.post_type in ('recognition', 'shoutout')
  and post.anonymous = false
  and (post.metadata ? 'recipient_profile_id')
  and (post.metadata ->> 'recipient_profile_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (profile_id, action_type, source_table, source_id) do nothing;

insert into public.pulse_point_events (
  profile_id,
  action_type,
  points,
  source_table,
  source_id,
  description,
  college_id,
  metadata,
  created_at
)
select
  profile.id,
  'comment_created',
  coalesce(rule.points, 1),
  'pulse_comments',
  pulse_comment.id,
  'Comment added',
  profile.college_id,
  jsonb_build_object('post_id', pulse_comment.post_id),
  pulse_comment.created_at
from public.pulse_comments pulse_comment
join public.pulse_profiles profile on profile.id = pulse_comment.author_profile_id and profile.pulse_status = 'active'
left join public.pulse_leaderboard_rules rule on rule.action_type = 'comment_created'
where pulse_comment.status = 'published'
on conflict (profile_id, action_type, source_table, source_id) do nothing;

insert into public.pulse_point_events (
  profile_id,
  action_type,
  points,
  source_table,
  source_id,
  description,
  college_id,
  metadata,
  created_at
)
select
  profile.id,
  'reaction_given',
  coalesce(rule.points, 1),
  'pulse_reactions',
  reaction.id,
  'Reaction given',
  profile.college_id,
  jsonb_build_object('post_id', reaction.post_id, 'reaction_type', reaction.reaction_type),
  reaction.created_at
from public.pulse_reactions reaction
join public.pulse_profiles profile on profile.id = reaction.profile_id and profile.pulse_status = 'active'
left join public.pulse_leaderboard_rules rule on rule.action_type = 'reaction_given'
where reaction.post_id is not null
on conflict (profile_id, action_type, source_table, source_id) do nothing;

insert into public.pulse_point_events (
  profile_id,
  action_type,
  points,
  source_table,
  source_id,
  description,
  college_id,
  metadata,
  created_at
)
select
  profile.id,
  'opportunity_interest',
  coalesce(rule.points, 3),
  'pulse_opportunity_applications',
  application.id,
  case
    when application.status = 'applied' then 'Opportunity application submitted'
    else 'Opportunity interest shown'
  end,
  profile.college_id,
  jsonb_build_object('opportunity_id', application.opportunity_id, 'status', application.status),
  application.created_at
from public.pulse_opportunity_applications application
join public.pulse_profiles profile on profile.id = application.profile_id and profile.pulse_status = 'active'
left join public.pulse_leaderboard_rules rule on rule.action_type = 'opportunity_interest'
where application.status in ('interested', 'applied', 'shortlisted', 'selected')
on conflict (profile_id, action_type, source_table, source_id) do nothing;

insert into public.pulse_point_events (
  profile_id,
  action_type,
  points,
  source_table,
  source_id,
  description,
  college_id,
  metadata,
  created_at
)
select
  inviter.id,
  'invite_accepted',
  coalesce(rule.points, 15),
  'pulse_invites',
  invite.id,
  'Invite accepted',
  inviter.college_id,
  jsonb_build_object('accepted_by_profile_id', invite.accepted_by_profile_id),
  coalesce(invite.accepted_at, invite.updated_at, invite.created_at)
from public.pulse_invites invite
join public.pulse_profiles inviter on inviter.id = invite.invited_by_profile_id and inviter.pulse_status = 'active'
left join public.pulse_leaderboard_rules rule on rule.action_type = 'invite_accepted'
where invite.status = 'accepted'
  and invite.accepted_by_profile_id is not null
on conflict (profile_id, action_type, source_table, source_id) do nothing;

do $$
begin
  if to_regclass('public.pulse_poll_votes') is not null then
    execute $sql$
      insert into public.pulse_point_events (
        profile_id,
        action_type,
        points,
        source_table,
        source_id,
        description,
        college_id,
        metadata,
        created_at
      )
      select
        profile.id,
        'poll_vote_cast',
        coalesce(rule.points, 1),
        'pulse_poll_votes',
        vote.id,
        'Voted in a Pulse poll',
        profile.college_id,
        jsonb_build_object('post_id', vote.post_id, 'option_id', vote.option_id),
        vote.created_at
      from public.pulse_poll_votes vote
      join public.pulse_profiles profile on profile.id = vote.profile_id and profile.pulse_status = 'active'
      left join public.pulse_leaderboard_rules rule on rule.action_type = 'poll_vote_cast'
      on conflict (profile_id, action_type, source_table, source_id) do nothing
    $sql$;
  end if;
end;
$$;
