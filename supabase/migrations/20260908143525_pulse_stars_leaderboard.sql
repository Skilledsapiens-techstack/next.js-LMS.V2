create table if not exists public.pulse_leaderboard_settings (
  singleton boolean primary key default true,
  enabled boolean not null default true,
  allow_cross_college boolean not null default true,
  default_scope text not null default 'college',
  weekly_enabled boolean not null default true,
  monthly_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_leaderboard_settings_singleton_check check (singleton),
  constraint pulse_leaderboard_settings_scope_check check (default_scope in ('college', 'pulse'))
);

create table if not exists public.pulse_leaderboard_rules (
  action_type text primary key,
  points integer not null,
  daily_cap integer,
  weekly_cap integer,
  monthly_cap integer,
  enabled boolean not null default true,
  description text not null,
  updated_at timestamptz not null default now(),
  constraint pulse_leaderboard_rules_points_check check (points > 0),
  constraint pulse_leaderboard_rules_daily_cap_check check (daily_cap is null or daily_cap > 0),
  constraint pulse_leaderboard_rules_weekly_cap_check check (weekly_cap is null or weekly_cap > 0),
  constraint pulse_leaderboard_rules_monthly_cap_check check (monthly_cap is null or monthly_cap > 0)
);

create table if not exists public.pulse_leaderboard_exclusions (
  profile_id uuid primary key references public.pulse_profiles(id) on delete cascade,
  reason text,
  excluded_by_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pulse_point_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  action_type text not null references public.pulse_leaderboard_rules(action_type),
  points integer not null,
  source_table text not null,
  source_id uuid not null,
  description text,
  college_id uuid references public.pulse_colleges(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pulse_point_events_points_check check (points > 0),
  constraint pulse_point_events_source_check check (length(btrim(source_table)) between 3 and 80),
  constraint pulse_point_events_unique_source unique (profile_id, action_type, source_table, source_id)
);

create index if not exists pulse_point_events_profile_created_idx
  on public.pulse_point_events (profile_id, created_at desc);

create index if not exists pulse_point_events_college_created_idx
  on public.pulse_point_events (college_id, created_at desc);

create index if not exists pulse_point_events_action_created_idx
  on public.pulse_point_events (action_type, created_at desc);

alter table public.pulse_leaderboard_settings enable row level security;
alter table public.pulse_leaderboard_rules enable row level security;
alter table public.pulse_leaderboard_exclusions enable row level security;
alter table public.pulse_point_events enable row level security;

revoke all on table public.pulse_leaderboard_settings from anon, authenticated;
revoke all on table public.pulse_leaderboard_rules from anon, authenticated;
revoke all on table public.pulse_leaderboard_exclusions from anon, authenticated;
revoke all on table public.pulse_point_events from anon, authenticated;

grant select on table public.pulse_leaderboard_settings to authenticated;
grant select on table public.pulse_leaderboard_rules to authenticated;
grant select, insert, update, delete on table public.pulse_leaderboard_settings to authenticated;
grant select, insert, update, delete on table public.pulse_leaderboard_rules to authenticated;
grant select, insert, update, delete on table public.pulse_leaderboard_exclusions to authenticated;
grant select on table public.pulse_point_events to authenticated;

create policy "Pulse leaderboard settings are readable by students"
on public.pulse_leaderboard_settings
for select
to authenticated
using (public.pulse_current_profile_id() is not null or (select public.admin_has_permission('admin.community.view')));

create policy "Pulse leaderboard settings are managed by admins"
on public.pulse_leaderboard_settings
for all
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

create policy "Pulse leaderboard rules are readable by students"
on public.pulse_leaderboard_rules
for select
to authenticated
using (public.pulse_current_profile_id() is not null or (select public.admin_has_permission('admin.community.view')));

create policy "Pulse leaderboard rules are managed by admins"
on public.pulse_leaderboard_rules
for all
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

create policy "Pulse leaderboard exclusions are admin only"
on public.pulse_leaderboard_exclusions
for all
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

create policy "Pulse point events are visible to owner or admins"
on public.pulse_point_events
for select
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
);

insert into public.pulse_leaderboard_settings (
  singleton,
  enabled,
  allow_cross_college,
  default_scope,
  weekly_enabled,
  monthly_enabled
)
values (true, true, true, 'college', true, true)
on conflict (singleton) do update
set
  enabled = excluded.enabled,
  allow_cross_college = excluded.allow_cross_college,
  default_scope = excluded.default_scope,
  weekly_enabled = excluded.weekly_enabled,
  monthly_enabled = excluded.monthly_enabled,
  updated_at = now();

insert into public.pulse_leaderboard_rules (
  action_type,
  points,
  daily_cap,
  weekly_cap,
  monthly_cap,
  description
)
values
  ('profile_completed', 10, null, null, null, 'Profile completed'),
  ('post_created', 2, 2, 10, 30, 'Daily update or post published'),
  ('comment_created', 1, 5, 25, 80, 'Useful comment added'),
  ('reaction_given', 1, 10, 50, 150, 'Post reaction given'),
  ('shoutout_received', 10, null, 30, 100, 'Shout-out received from another student'),
  ('opportunity_interest', 3, 9, 30, 90, 'Interest shown in an opportunity'),
  ('invite_accepted', 15, null, 45, 120, 'Invite accepted by a new student')
on conflict (action_type) do update
set
  points = excluded.points,
  daily_cap = excluded.daily_cap,
  weekly_cap = excluded.weekly_cap,
  monthly_cap = excluded.monthly_cap,
  enabled = true,
  description = excluded.description,
  updated_at = now();

create or replace function public.award_pulse_points(
  p_profile_id uuid,
  p_action_type text,
  p_source_table text,
  p_source_id uuid,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.pulse_profiles%rowtype;
  active_settings public.pulse_leaderboard_settings%rowtype;
  active_rule public.pulse_leaderboard_rules%rowtype;
  award_points integer;
  used_points integer;
  remaining_points integer;
begin
  if p_profile_id is null or p_action_type is null or p_source_table is null or p_source_id is null then
    return;
  end if;

  select *
  into active_settings
  from public.pulse_leaderboard_settings
  where singleton = true;

  if active_settings.singleton is null or not active_settings.enabled then
    return;
  end if;

  select *
  into active_rule
  from public.pulse_leaderboard_rules
  where action_type = p_action_type
    and enabled = true;

  if active_rule.action_type is null then
    return;
  end if;

  if exists (
    select 1
    from public.pulse_point_events event
    where event.profile_id = p_profile_id
      and event.action_type = p_action_type
      and event.source_table = p_source_table
      and event.source_id = p_source_id
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.pulse_leaderboard_exclusions exclusion
    where exclusion.profile_id = p_profile_id
  ) then
    return;
  end if;

  select *
  into target_profile
  from public.pulse_profiles
  where id = p_profile_id
    and pulse_status = 'active';

  if target_profile.id is null then
    return;
  end if;

  award_points := active_rule.points;

  if active_rule.daily_cap is not null then
    select coalesce(sum(event.points), 0)
    into used_points
    from public.pulse_point_events event
    where event.profile_id = p_profile_id
      and event.action_type = p_action_type
      and event.created_at >= date_trunc('day', now());

    remaining_points := greatest(active_rule.daily_cap - used_points, 0);
    award_points := least(award_points, remaining_points);
  end if;

  if active_rule.weekly_cap is not null then
    select coalesce(sum(event.points), 0)
    into used_points
    from public.pulse_point_events event
    where event.profile_id = p_profile_id
      and event.action_type = p_action_type
      and event.created_at >= date_trunc('week', now());

    remaining_points := greatest(active_rule.weekly_cap - used_points, 0);
    award_points := least(award_points, remaining_points);
  end if;

  if active_rule.monthly_cap is not null then
    select coalesce(sum(event.points), 0)
    into used_points
    from public.pulse_point_events event
    where event.profile_id = p_profile_id
      and event.action_type = p_action_type
      and event.created_at >= date_trunc('month', now());

    remaining_points := greatest(active_rule.monthly_cap - used_points, 0);
    award_points := least(award_points, remaining_points);
  end if;

  if award_points <= 0 then
    return;
  end if;

  insert into public.pulse_point_events (
    profile_id,
    action_type,
    points,
    source_table,
    source_id,
    description,
    college_id,
    metadata
  )
  values (
    target_profile.id,
    active_rule.action_type,
    award_points,
    btrim(p_source_table),
    p_source_id,
    nullif(btrim(coalesce(p_description, active_rule.description)), ''),
    target_profile.college_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (profile_id, action_type, source_table, source_id) do nothing;
end;
$$;

revoke all on function public.award_pulse_points(uuid, text, text, uuid, text, jsonb) from public;

create or replace function public.track_pulse_profile_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_pulse_points(
    new.id,
    'profile_completed',
    'pulse_profiles',
    new.id,
    'Profile completed',
    '{}'::jsonb
  );

  return new;
end;
$$;

revoke all on function public.track_pulse_profile_points() from public;

drop trigger if exists pulse_profiles_track_points on public.pulse_profiles;
create trigger pulse_profiles_track_points
after insert on public.pulse_profiles
for each row execute function public.track_pulse_profile_points();

create or replace function public.track_pulse_post_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_profile_id uuid;
begin
  if new.status <> 'published' then
    return new;
  end if;

  perform public.award_pulse_points(
    new.author_profile_id,
    'post_created',
    'pulse_posts',
    new.id,
    'Post published',
    jsonb_build_object('post_type', new.post_type, 'visibility', new.visibility)
  );

  if new.post_type in ('recognition', 'shoutout')
    and new.anonymous = false
    and (new.metadata ? 'recipient_profile_id')
    and (new.metadata ->> 'recipient_profile_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    recipient_profile_id := (new.metadata ->> 'recipient_profile_id')::uuid;

    perform public.award_pulse_points(
      recipient_profile_id,
      'shoutout_received',
      'pulse_posts',
      new.id,
      'Shout-out received',
      jsonb_build_object('author_profile_id', new.author_profile_id, 'post_type', new.post_type)
    );
  end if;

  return new;
end;
$$;

revoke all on function public.track_pulse_post_points() from public;

drop trigger if exists pulse_posts_track_points on public.pulse_posts;
create trigger pulse_posts_track_points
after insert on public.pulse_posts
for each row execute function public.track_pulse_post_points();

create or replace function public.track_pulse_comment_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    return new;
  end if;

  perform public.award_pulse_points(
    new.author_profile_id,
    'comment_created',
    'pulse_comments',
    new.id,
    'Comment added',
    jsonb_build_object('post_id', new.post_id)
  );

  return new;
end;
$$;

revoke all on function public.track_pulse_comment_points() from public;

drop trigger if exists pulse_comments_track_points on public.pulse_comments;
create trigger pulse_comments_track_points
after insert on public.pulse_comments
for each row execute function public.track_pulse_comment_points();

create or replace function public.track_pulse_reaction_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.post_id is null then
    return new;
  end if;

  perform public.award_pulse_points(
    new.profile_id,
    'reaction_given',
    'pulse_reactions',
    new.id,
    'Reaction given',
    jsonb_build_object('post_id', new.post_id, 'reaction_type', new.reaction_type)
  );

  return new;
end;
$$;

revoke all on function public.track_pulse_reaction_points() from public;

drop trigger if exists pulse_reactions_track_points on public.pulse_reactions;
create trigger pulse_reactions_track_points
after insert on public.pulse_reactions
for each row execute function public.track_pulse_reaction_points();

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
    'Opportunity interest shown',
    jsonb_build_object('opportunity_id', new.opportunity_id, 'status', new.status)
  );

  return new;
end;
$$;

revoke all on function public.track_pulse_opportunity_interest_points() from public;

drop trigger if exists pulse_opportunity_applications_track_points on public.pulse_opportunity_applications;
create trigger pulse_opportunity_applications_track_points
after insert on public.pulse_opportunity_applications
for each row execute function public.track_pulse_opportunity_interest_points();

create or replace function public.track_pulse_invite_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'accepted' or new.invited_by_profile_id is null or new.accepted_by_profile_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'accepted' then
    return new;
  end if;

  perform public.award_pulse_points(
    new.invited_by_profile_id,
    'invite_accepted',
    'pulse_invites',
    new.id,
    'Invite accepted',
    jsonb_build_object('accepted_by_profile_id', new.accepted_by_profile_id)
  );

  return new;
end;
$$;

revoke all on function public.track_pulse_invite_points() from public;

drop trigger if exists pulse_invites_track_points on public.pulse_invites;
create trigger pulse_invites_track_points
after insert or update on public.pulse_invites
for each row execute function public.track_pulse_invite_points();

create or replace function public.get_pulse_leaderboard(
  p_scope text default 'college',
  p_period text default 'week',
  p_limit integer default 25
)
returns table (
  rank_position bigint,
  profile_id uuid,
  display_name text,
  headline text,
  avatar_url text,
  college_name text,
  total_points bigint,
  badge text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile public.pulse_profiles%rowtype;
  clean_scope text := coalesce(nullif(btrim(p_scope), ''), 'college');
  clean_period text := coalesce(nullif(btrim(p_period), ''), 'week');
  safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  period_start timestamptz;
  settings public.pulse_leaderboard_settings%rowtype;
begin
  if (select auth.uid()) is null then
    return;
  end if;

  select *
  into current_profile
  from public.pulse_profiles
  where auth_user_id = (select auth.uid())
    and pulse_status = 'active'
  limit 1;

  if current_profile.id is null then
    return;
  end if;

  select *
  into settings
  from public.pulse_leaderboard_settings
  where singleton = true;

  if settings.singleton is null or not settings.enabled then
    return;
  end if;

  if clean_scope not in ('college', 'pulse') then
    clean_scope := settings.default_scope;
  end if;

  if clean_scope = 'pulse' and not settings.allow_cross_college then
    clean_scope := 'college';
  end if;

  if clean_period not in ('week', 'month') then
    clean_period := 'week';
  end if;

  if clean_period = 'month' and not settings.monthly_enabled then
    clean_period := 'week';
  end if;

  if clean_period = 'week' and not settings.weekly_enabled then
    clean_period := 'month';
  end if;

  period_start := case
    when clean_period = 'month' then date_trunc('month', now())
    else date_trunc('week', now())
  end;

  return query
  with totals as (
    select
      event.profile_id,
      sum(event.points)::bigint as total_points
    from public.pulse_point_events event
    where event.created_at >= period_start
    group by event.profile_id
  ),
  ranked as (
    select
      dense_rank() over (order by totals.total_points desc) as rank_position,
      profile.id as profile_id,
      profile.display_name,
      profile.headline,
      profile.avatar_url,
      college.name as college_name,
      totals.total_points,
      case
        when totals.total_points >= 100 then 'Pulse Star'
        when totals.total_points >= 50 then 'Top Contributor'
        when totals.total_points >= 20 then 'Campus Voice'
        else 'Rising Contributor'
      end as badge
    from totals
    join public.pulse_profiles profile on profile.id = totals.profile_id
    left join public.pulse_colleges college on college.id = profile.college_id
    where profile.pulse_status = 'active'
      and totals.total_points > 0
      and not exists (
        select 1
        from public.pulse_leaderboard_exclusions exclusion
        where exclusion.profile_id = profile.id
      )
      and (
        (
          clean_scope = 'college'
          and current_profile.college_id is not null
          and profile.college_id = current_profile.college_id
          and profile.profile_visibility in ('public', 'college')
        )
        or (
          clean_scope = 'pulse'
          and profile.profile_visibility = 'public'
        )
      )
  )
  select
    ranked.rank_position,
    ranked.profile_id,
    ranked.display_name,
    ranked.headline,
    ranked.avatar_url,
    ranked.college_name,
    ranked.total_points,
    ranked.badge
  from ranked
  order by ranked.rank_position asc, ranked.total_points desc, ranked.display_name asc
  limit safe_limit;
end;
$$;

revoke all on function public.get_pulse_leaderboard(text, text, integer) from public;
grant execute on function public.get_pulse_leaderboard(text, text, integer) to authenticated;

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
  10,
  'pulse_profiles',
  profile.id,
  'Profile completed',
  profile.college_id,
  '{}'::jsonb,
  profile.created_at
from public.pulse_profiles profile
where profile.pulse_status = 'active'
on conflict (profile_id, action_type, source_table, source_id) do nothing;
