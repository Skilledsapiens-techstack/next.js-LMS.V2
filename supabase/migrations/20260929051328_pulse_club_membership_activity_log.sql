create table if not exists public.pulse_club_membership_activity (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.pulse_clubs(id) on delete cascade,
  membership_id uuid references public.pulse_club_members(id) on delete set null,
  actor_profile_id uuid references public.pulse_profiles(id) on delete set null,
  target_profile_id uuid references public.pulse_profiles(id) on delete set null,
  action text not null,
  previous_status text,
  next_status text,
  previous_role text,
  next_role text,
  previous_title text,
  next_title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pulse_club_membership_activity_action_check check (
    action in ('approved', 'held', 'paused', 'role_updated', 'title_updated', 'membership_updated')
  )
);

create index if not exists pulse_club_membership_activity_club_created_idx
  on public.pulse_club_membership_activity (club_id, created_at desc);

create index if not exists pulse_club_membership_activity_target_idx
  on public.pulse_club_membership_activity (target_profile_id, created_at desc);

alter table public.pulse_club_membership_activity enable row level security;

revoke all on table public.pulse_club_membership_activity from anon, authenticated;
grant select on table public.pulse_club_membership_activity to authenticated;

drop policy if exists "Pulse club membership activity is readable by club admins" on public.pulse_club_membership_activity;
create policy "Pulse club membership activity is readable by club admins"
on public.pulse_club_membership_activity
for select
to authenticated
using (
  public.pulse_is_club_admin(club_id)
  or (select public.admin_has_permission('admin.community.view'))
);

create or replace function public.log_pulse_club_membership_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_action text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status is not distinct from new.status
    and old.role is not distinct from new.role
    and old.title is not distinct from new.title then
    return new;
  end if;

  activity_action := case
    when old.status is distinct from new.status and new.status = 'active' and old.status = 'pending' then 'approved'
    when old.status is distinct from new.status and new.status = 'paused' and old.status = 'pending' then 'held'
    when old.status is distinct from new.status and new.status = 'paused' then 'paused'
    when old.role is distinct from new.role then 'role_updated'
    when old.title is distinct from new.title then 'title_updated'
    else 'membership_updated'
  end;

  insert into public.pulse_club_membership_activity (
    club_id,
    membership_id,
    actor_profile_id,
    target_profile_id,
    action,
    previous_status,
    next_status,
    previous_role,
    next_role,
    previous_title,
    next_title,
    metadata
  )
  values (
    new.club_id,
    new.id,
    public.pulse_current_profile_id(),
    new.profile_id,
    activity_action,
    old.status,
    new.status,
    old.role,
    new.role,
    old.title,
    new.title,
    jsonb_build_object(
      'changed_status', old.status is distinct from new.status,
      'changed_role', old.role is distinct from new.role,
      'changed_title', old.title is distinct from new.title
    )
  );

  return new;
end;
$$;

revoke all on function public.log_pulse_club_membership_activity() from public;

drop trigger if exists pulse_club_membership_activity_log on public.pulse_club_members;
create trigger pulse_club_membership_activity_log
after update on public.pulse_club_members
for each row
execute function public.log_pulse_club_membership_activity();

create or replace function public.get_pulse_club_membership_activity(
  p_club_id uuid,
  p_limit integer default 30
)
returns table (
  id uuid,
  club_id uuid,
  membership_id uuid,
  actor_profile_id uuid,
  actor_display_name text,
  target_profile_id uuid,
  target_display_name text,
  action text,
  previous_status text,
  next_status text,
  previous_role text,
  next_role text,
  previous_title text,
  next_title text,
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
    raise exception 'Not authorized to inspect this club membership activity.' using errcode = '42501';
  end if;

  return query
  select
    activity.id,
    activity.club_id,
    activity.membership_id,
    activity.actor_profile_id,
    actor.display_name as actor_display_name,
    activity.target_profile_id,
    target.display_name as target_display_name,
    activity.action,
    activity.previous_status,
    activity.next_status,
    activity.previous_role,
    activity.next_role,
    activity.previous_title,
    activity.next_title,
    activity.metadata,
    activity.created_at
  from public.pulse_club_membership_activity activity
  left join public.pulse_profiles actor
    on actor.id = activity.actor_profile_id
  left join public.pulse_profiles target
    on target.id = activity.target_profile_id
  where activity.club_id = p_club_id
  order by activity.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

revoke all on function public.get_pulse_club_membership_activity(uuid, integer) from public;
grant execute on function public.get_pulse_club_membership_activity(uuid, integer) to authenticated;
