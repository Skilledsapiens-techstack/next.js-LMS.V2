create table if not exists public.pulse_poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.pulse_posts(id) on delete cascade,
  profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_poll_votes_option_check check (length(btrim(option_id)) between 3 and 80),
  constraint pulse_poll_votes_unique unique (post_id, profile_id)
);

create index if not exists pulse_poll_votes_post_idx
  on public.pulse_poll_votes (post_id, option_id);

create index if not exists pulse_poll_votes_profile_idx
  on public.pulse_poll_votes (profile_id, created_at desc);

drop trigger if exists pulse_poll_votes_set_updated_at on public.pulse_poll_votes;
create trigger pulse_poll_votes_set_updated_at
before update on public.pulse_poll_votes
for each row execute function public.set_updated_at();

alter table public.pulse_poll_votes enable row level security;

revoke all on table public.pulse_poll_votes from anon, authenticated;
grant select, insert, update on table public.pulse_poll_votes to authenticated;

drop policy if exists "Pulse poll votes are readable through visible poll posts" on public.pulse_poll_votes;
create policy "Pulse poll votes are readable through visible poll posts"
on public.pulse_poll_votes
for select
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
  or exists (
    select 1
    from public.pulse_posts post
    where post.id = pulse_poll_votes.post_id
      and post.post_type = 'poll'
      and post.status = 'published'
      and (
        post.visibility = 'global'
        or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
      )
  )
);

drop policy if exists "Pulse poll votes are created by active profiles" on public.pulse_poll_votes;
create policy "Pulse poll votes are created by active profiles"
on public.pulse_poll_votes
for insert
to authenticated
with check (
  profile_id = public.pulse_current_profile_id()
  and exists (
    select 1
    from public.pulse_profiles profile
    where profile.id = public.pulse_current_profile_id()
      and profile.pulse_status = 'active'
  )
  and exists (
    select 1
    from public.pulse_posts post
    where post.id = pulse_poll_votes.post_id
      and post.post_type = 'poll'
      and post.status = 'published'
      and (
        post.visibility = 'global'
        or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
      )
  )
);

drop policy if exists "Pulse poll votes are updated by vote owner" on public.pulse_poll_votes;
create policy "Pulse poll votes are updated by vote owner"
on public.pulse_poll_votes
for update
to authenticated
using (profile_id = public.pulse_current_profile_id())
with check (
  profile_id = public.pulse_current_profile_id()
  and exists (
    select 1
    from public.pulse_posts post
    where post.id = pulse_poll_votes.post_id
      and post.post_type = 'poll'
      and post.status = 'published'
      and (
        post.visibility = 'global'
        or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
      )
  )
);

insert into public.pulse_point_rules (action_type, points, daily_cap, weekly_cap, monthly_cap, description, status)
values ('poll_vote_cast', 1, 5, 20, 50, 'Vote in useful Pulse polls', 'active')
on conflict (action_type) do update
set
  points = excluded.points,
  daily_cap = excluded.daily_cap,
  weekly_cap = excluded.weekly_cap,
  monthly_cap = excluded.monthly_cap,
  description = excluded.description,
  status = excluded.status;

create or replace function public.track_pulse_poll_vote_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_pulse_points(
    new.profile_id,
    'poll_vote_cast',
    'pulse_poll_votes',
    new.id,
    'Voted in a Pulse poll',
    jsonb_build_object('post_id', new.post_id, 'option_id', new.option_id)
  );

  return new;
end;
$$;

revoke all on function public.track_pulse_poll_vote_points() from public;

drop trigger if exists pulse_poll_votes_track_points on public.pulse_poll_votes;
create trigger pulse_poll_votes_track_points
after insert on public.pulse_poll_votes
for each row execute function public.track_pulse_poll_vote_points();
