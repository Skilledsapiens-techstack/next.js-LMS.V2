alter table public.workshops
  add column if not exists available_on_pulse boolean not null default false;

create index if not exists workshops_available_on_pulse_idx
  on public.workshops (available_on_pulse, workshop_status, date, time)
  where available_on_pulse = true;

drop function if exists public.get_pulse_mentorship_sessions();

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
  source_type text,
  source_id text,
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
  with pulse_sessions as (
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
      'pulse_session'::text as source_type,
      session.id::text as source_id,
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
  ),
  pulse_workshops as (
    select
      workshop.id,
      null::uuid as host_profile_id,
      'Skilled Sapiens'::text as host_display_name,
      'Official workshop'::text as host_headline,
      null::uuid as college_id,
      null::text as college_name,
      workshop.title,
      'workshop'::text as session_type,
      coalesce(nullif(workshop.program_key, ''), 'Workshop')::text as topic,
      concat('Join this live workshop: ', workshop.title)::text as description,
      'global'::text as visibility,
      'published'::text as status,
      case
        when workshop.date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        then (
          workshop.date::date
          + case
              when workshop.time::text ~ '^[0-9]{1,2}:[0-9]{2}'
              then workshop.time::time
              else time '00:00'
            end
        ) at time zone 'Asia/Kolkata'
        else now()
      end as starts_at,
      case
        when workshop.date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        then (
          workshop.date::date
          + case
              when workshop.time::text ~ '^[0-9]{1,2}:[0-9]{2}'
              then workshop.time::time
              else time '00:00'
            end
          + make_interval(mins => coalesce(workshop.duration_minutes, 90))
        ) at time zone 'Asia/Kolkata'
        else now() + interval '90 minutes'
      end as ends_at,
      null::integer as max_seats,
      case
        when workshop.zoom_id is not null then 'zoom'
        when workshop.join_url is not null then 'other'
        else 'other'
      end::text as meeting_platform,
      workshop.join_url as meeting_url,
      0::bigint as rsvp_count,
      'admin_workshop'::text as source_type,
      workshop.id::text as source_id,
      coalesce(workshop.updated_at, now()) as created_at
    from public.workshops workshop
    where workshop.available_on_pulse = true
      and coalesce(workshop.session_type, 'workshop') = 'workshop'
      and workshop.workshop_status in ('Upcoming', 'Scheduled', 'Live')
  )
  select * from pulse_sessions
  union all
  select * from pulse_workshops
  order by starts_at asc, created_at desc;
end;
$$;

revoke all on function public.get_pulse_mentorship_sessions() from public;
grant execute on function public.get_pulse_mentorship_sessions() to authenticated;
