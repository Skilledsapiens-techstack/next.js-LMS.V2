create table if not exists public.pulse_mentorship_sessions (
  id uuid primary key default gen_random_uuid(),
  host_profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  college_id uuid references public.pulse_colleges(id) on delete set null,
  title text not null,
  session_type text not null default 'workshop',
  topic text not null,
  description text not null,
  visibility text not null default 'global',
  status text not null default 'submitted',
  starts_at timestamptz not null,
  ends_at timestamptz,
  max_seats integer,
  meeting_platform text not null default 'google_meet',
  meeting_url text,
  rejection_note text,
  reviewed_by_auth_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_mentorship_sessions_type_check check (
    session_type in ('workshop', 'resume_review', 'one_on_one', 'ama', 'career_session')
  ),
  constraint pulse_mentorship_sessions_visibility_check check (visibility in ('global', 'college')),
  constraint pulse_mentorship_sessions_status_check check (
    status in ('draft', 'submitted', 'approved', 'published', 'rejected', 'cancelled', 'completed', 'archived')
  ),
  constraint pulse_mentorship_sessions_platform_check check (meeting_platform in ('google_meet', 'zoom', 'other')),
  constraint pulse_mentorship_sessions_title_check check (length(btrim(title)) between 3 and 180),
  constraint pulse_mentorship_sessions_topic_check check (length(btrim(topic)) between 2 and 120),
  constraint pulse_mentorship_sessions_description_check check (length(btrim(description)) between 10 and 12000),
  constraint pulse_mentorship_sessions_max_seats_check check (max_seats is null or max_seats between 1 and 500)
);

create table if not exists public.pulse_mentorship_rsvps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pulse_mentorship_sessions(id) on delete cascade,
  profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  status text not null default 'rsvped',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_mentorship_rsvps_status_check check (status in ('rsvped', 'waitlisted', 'cancelled', 'attended', 'no_show')),
  constraint pulse_mentorship_rsvps_unique unique (session_id, profile_id)
);

create index if not exists pulse_mentorship_sessions_feed_idx
  on public.pulse_mentorship_sessions (status, visibility, college_id, starts_at);

create index if not exists pulse_mentorship_sessions_host_idx
  on public.pulse_mentorship_sessions (host_profile_id, created_at desc);

create index if not exists pulse_mentorship_rsvps_session_idx
  on public.pulse_mentorship_rsvps (session_id, status, created_at);

create index if not exists pulse_mentorship_rsvps_profile_idx
  on public.pulse_mentorship_rsvps (profile_id, created_at desc);

drop trigger if exists pulse_mentorship_sessions_set_updated_at on public.pulse_mentorship_sessions;
create trigger pulse_mentorship_sessions_set_updated_at
before update on public.pulse_mentorship_sessions
for each row execute function public.set_updated_at();

drop trigger if exists pulse_mentorship_rsvps_set_updated_at on public.pulse_mentorship_rsvps;
create trigger pulse_mentorship_rsvps_set_updated_at
before update on public.pulse_mentorship_rsvps
for each row execute function public.set_updated_at();

alter table public.pulse_mentorship_sessions enable row level security;
alter table public.pulse_mentorship_rsvps enable row level security;

revoke all on table public.pulse_mentorship_sessions from anon, authenticated;
revoke all on table public.pulse_mentorship_rsvps from anon, authenticated;

grant select (
  id,
  host_profile_id,
  college_id,
  title,
  session_type,
  topic,
  description,
  visibility,
  status,
  starts_at,
  ends_at,
  max_seats,
  meeting_platform,
  rejection_note,
  reviewed_by_auth_user_id,
  reviewed_at,
  created_at,
  updated_at
) on table public.pulse_mentorship_sessions to authenticated;

grant insert (
  host_profile_id,
  college_id,
  title,
  session_type,
  topic,
  description,
  visibility,
  status,
  starts_at,
  ends_at,
  max_seats,
  meeting_platform,
  meeting_url
) on table public.pulse_mentorship_sessions to authenticated;

grant update (
  title,
  session_type,
  topic,
  description,
  visibility,
  status,
  starts_at,
  ends_at,
  max_seats,
  meeting_platform,
  meeting_url,
  rejection_note,
  reviewed_by_auth_user_id,
  reviewed_at
) on table public.pulse_mentorship_sessions to authenticated;

grant select, insert, update on table public.pulse_mentorship_rsvps to authenticated;

create policy "Pulse mentorship sessions are readable by allowed students or admins"
on public.pulse_mentorship_sessions
for select
to authenticated
using (
  host_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
  or (
    status = 'published'
    and (
      visibility = 'global'
      or (
        visibility = 'college'
        and college_id is not null
        and college_id = public.pulse_current_college_id()
      )
    )
  )
);

create policy "Pulse students can submit mentorship sessions"
on public.pulse_mentorship_sessions
for insert
to authenticated
with check (
  host_profile_id = public.pulse_current_profile_id()
  and status = 'submitted'
);

create policy "Pulse hosts can edit their unpublished mentorship sessions"
on public.pulse_mentorship_sessions
for update
to authenticated
using (
  host_profile_id = public.pulse_current_profile_id()
  and status in ('draft', 'submitted', 'rejected')
)
with check (
  host_profile_id = public.pulse_current_profile_id()
  and status in ('draft', 'submitted')
);

create policy "Pulse mentorship sessions are managed by admins"
on public.pulse_mentorship_sessions
for all
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

create policy "Pulse mentorship RSVPs are readable by owner host or admins"
on public.pulse_mentorship_rsvps
for select
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
  or exists (
    select 1
    from public.pulse_mentorship_sessions session
    where session.id = pulse_mentorship_rsvps.session_id
      and session.host_profile_id = public.pulse_current_profile_id()
  )
);

create policy "Pulse students can RSVP to published mentorship sessions"
on public.pulse_mentorship_rsvps
for insert
to authenticated
with check (
  profile_id = public.pulse_current_profile_id()
  and status in ('rsvped', 'waitlisted')
  and exists (
    select 1
    from public.pulse_mentorship_sessions session
    where session.id = pulse_mentorship_rsvps.session_id
      and session.status = 'published'
      and (
        session.max_seats is null
        or (
          select count(*)
          from public.pulse_mentorship_rsvps existing
          where existing.session_id = session.id
            and existing.status = 'rsvped'
        ) < session.max_seats
      )
  )
);

create policy "Pulse students can update their own mentorship RSVP"
on public.pulse_mentorship_rsvps
for update
to authenticated
using (profile_id = public.pulse_current_profile_id())
with check (
  profile_id = public.pulse_current_profile_id()
  and status in ('rsvped', 'cancelled')
);

create policy "Pulse mentorship RSVPs are managed by admins"
on public.pulse_mentorship_rsvps
for all
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

create or replace function public.get_pulse_mentorship_sessions()
returns table (
  id uuid,
  host_profile_id uuid,
  host_display_name text,
  host_headline text,
  college_id uuid,
  college_name text,
  title text,
  session_type text,
  topic text,
  description text,
  visibility text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  max_seats integer,
  meeting_platform text,
  meeting_url text,
  rsvp_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := public.pulse_current_profile_id();
  current_college_id uuid := public.pulse_current_college_id();
  can_admin_view boolean := (select public.admin_has_permission('admin.community.view'));
begin
  if (select auth.uid()) is null or current_profile_id is null then
    return;
  end if;

  return query
  select
    session.id,
    session.host_profile_id,
    host.display_name as host_display_name,
    host.headline as host_headline,
    session.college_id,
    college.name as college_name,
    session.title,
    session.session_type,
    session.topic,
    session.description,
    session.visibility,
    session.status,
    session.starts_at,
    session.ends_at,
    session.max_seats,
    session.meeting_platform,
    case
      when can_admin_view
        or session.host_profile_id = current_profile_id
        or exists (
          select 1
          from public.pulse_mentorship_rsvps own_rsvp
          where own_rsvp.session_id = session.id
            and own_rsvp.profile_id = current_profile_id
            and own_rsvp.status in ('rsvped', 'attended')
        )
      then session.meeting_url
      else null
    end as meeting_url,
    (
      select count(*)
      from public.pulse_mentorship_rsvps rsvp
      where rsvp.session_id = session.id
        and rsvp.status in ('rsvped', 'attended')
    ) as rsvp_count,
    session.created_at
  from public.pulse_mentorship_sessions session
  join public.pulse_profiles host on host.id = session.host_profile_id
  left join public.pulse_colleges college on college.id = session.college_id
  where session.status = 'published'
    and (
      session.visibility = 'global'
      or (
        session.visibility = 'college'
        and session.college_id is not null
        and session.college_id = current_college_id
      )
      or session.host_profile_id = current_profile_id
      or can_admin_view
    )
  order by session.starts_at asc, session.created_at desc;
end;
$$;

revoke all on function public.get_pulse_mentorship_sessions() from public;
grant execute on function public.get_pulse_mentorship_sessions() to authenticated;
