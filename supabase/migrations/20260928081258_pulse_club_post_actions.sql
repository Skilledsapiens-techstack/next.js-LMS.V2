create table if not exists public.pulse_club_post_actions (
  id uuid primary key default gen_random_uuid(),
  club_post_id uuid not null references public.pulse_club_posts(id) on delete cascade,
  profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  action_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_club_post_actions_type_check check (action_type in ('saved', 'useful', 'interested')),
  constraint pulse_club_post_actions_unique unique (club_post_id, profile_id, action_type)
);

create index if not exists pulse_club_post_actions_profile_idx
  on public.pulse_club_post_actions (profile_id, action_type, created_at desc);

create index if not exists pulse_club_post_actions_post_idx
  on public.pulse_club_post_actions (club_post_id, action_type);

drop trigger if exists pulse_club_post_actions_set_updated_at on public.pulse_club_post_actions;
create trigger pulse_club_post_actions_set_updated_at
before update on public.pulse_club_post_actions
for each row execute function public.set_updated_at();

alter table public.pulse_club_post_actions enable row level security;

revoke all on table public.pulse_club_post_actions from anon, authenticated;
grant select, insert, delete on table public.pulse_club_post_actions to authenticated;

drop policy if exists "Pulse club post actions are readable by owner and admins" on public.pulse_club_post_actions;
create policy "Pulse club post actions are readable by owner and admins"
on public.pulse_club_post_actions
for select
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or exists (
    select 1
    from public.pulse_club_posts post
    where post.id = pulse_club_post_actions.club_post_id
      and public.pulse_is_club_admin(post.club_id)
  )
  or (select public.admin_has_permission('admin.community.view'))
);

drop policy if exists "Pulse students can create own club post actions" on public.pulse_club_post_actions;
create policy "Pulse students can create own club post actions"
on public.pulse_club_post_actions
for insert
to authenticated
with check (
  profile_id = public.pulse_current_profile_id()
  and exists (
    select 1
    from public.pulse_club_posts post
    join public.pulse_clubs club on club.id = post.club_id
    where post.id = pulse_club_post_actions.club_post_id
      and (
        (post.post_type = 'resource' and pulse_club_post_actions.action_type in ('saved', 'useful'))
        or (post.post_type = 'opportunity' and pulse_club_post_actions.action_type = 'interested')
      )
      and post.status = 'published'
      and club.status = 'active'
      and club.college_id = public.pulse_current_college_id()
  )
);

drop policy if exists "Pulse students can delete own club post actions" on public.pulse_club_post_actions;
create policy "Pulse students can delete own club post actions"
on public.pulse_club_post_actions
for delete
to authenticated
using (profile_id = public.pulse_current_profile_id());
