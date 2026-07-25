alter table if exists public.announcements
  add column if not exists student_emails text[] not null default '{}',
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists source_key text,
  add column if not exists system_generated boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists expires_at timestamptz;

create index if not exists announcements_student_emails_gin_idx
  on public.announcements using gin (student_emails);

create unique index if not exists announcements_source_key_unique_idx
  on public.announcements (source_key)
  where source_key is not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'announcements'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%audience%'
      and pg_get_constraintdef(con.oid) ilike '%program%'
      and pg_get_constraintdef(con.oid) ilike '%cohort%'
  loop
    execute format('alter table public.announcements drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.announcements
  drop constraint if exists announcements_audience_check;

alter table public.announcements
  add constraint announcements_audience_check
  check (audience in ('all', 'cohort', 'program', 'student'))
  not valid;

alter table public.announcements validate constraint announcements_audience_check;

create table if not exists public.portal_update_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  source_type text not null,
  source_id text not null,
  title text not null,
  summary text,
  link_label text,
  link_url text,
  student_email text not null,
  student_id uuid references public.students(id) on delete cascade,
  program_keys text[] not null default '{}',
  cohort_names text[] not null default '{}',
  event_date date not null default current_date,
  occurred_at timestamptz not null default now(),
  digest_announcement_id uuid references public.announcements(id) on delete set null,
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint portal_update_events_event_type_check check (
    event_type in ('certificate_issued', 'resource_added', 'recording_published', 'session_scheduled')
  )
);

create index if not exists portal_update_events_student_date_idx
  on public.portal_update_events (student_email, event_date, occurred_at desc);

create index if not exists portal_update_events_source_idx
  on public.portal_update_events (source_type, source_id);

alter table public.portal_update_events enable row level security;

grant select, insert, update on table public.portal_update_events to authenticated;

drop policy if exists "portal update events readable by permitted admins" on public.portal_update_events;
create policy "portal update events readable by permitted admins"
on public.portal_update_events for select to authenticated
using (
  public.admin_has_permission('admin.announcements.view')
  or public.admin_has_permission('admin.certificates.view')
  or public.admin_has_permission('admin.resources.view')
  or public.admin_has_permission('admin.recordings.view')
  or public.admin_has_permission('admin.meetings.view')
);

drop policy if exists "portal update events insertable by permitted admins" on public.portal_update_events;
create policy "portal update events insertable by permitted admins"
on public.portal_update_events for insert to authenticated
with check (
  public.admin_has_permission('admin.announcements.manage')
  or public.admin_has_permission('admin.certificates.issue')
  or public.admin_has_permission('admin.resources.manage')
  or public.admin_has_permission('admin.recordings.manage')
  or public.admin_has_permission('admin.meetings.manage')
);

drop policy if exists "portal update events updateable by permitted admins" on public.portal_update_events;
create policy "portal update events updateable by permitted admins"
on public.portal_update_events for update to authenticated
using (
  public.admin_has_permission('admin.announcements.manage')
  or public.admin_has_permission('admin.certificates.issue')
  or public.admin_has_permission('admin.resources.manage')
  or public.admin_has_permission('admin.recordings.manage')
  or public.admin_has_permission('admin.meetings.manage')
)
with check (
  public.admin_has_permission('admin.announcements.manage')
  or public.admin_has_permission('admin.certificates.issue')
  or public.admin_has_permission('admin.resources.manage')
  or public.admin_has_permission('admin.recordings.manage')
  or public.admin_has_permission('admin.meetings.manage')
);

drop policy if exists "system portal digest announcements managed by source admins" on public.announcements;
create policy "system portal digest announcements managed by source admins"
on public.announcements for all to authenticated
using (
  system_generated is true
  and source_type = 'daily_portal_updates'
  and (
    public.admin_has_permission('admin.announcements.manage')
    or public.admin_has_permission('admin.certificates.issue')
    or public.admin_has_permission('admin.resources.manage')
    or public.admin_has_permission('admin.recordings.manage')
    or public.admin_has_permission('admin.meetings.manage')
  )
)
with check (
  system_generated is true
  and source_type = 'daily_portal_updates'
  and (
    public.admin_has_permission('admin.announcements.manage')
    or public.admin_has_permission('admin.certificates.issue')
    or public.admin_has_permission('admin.resources.manage')
    or public.admin_has_permission('admin.recordings.manage')
    or public.admin_has_permission('admin.meetings.manage')
  )
);

create or replace function public.record_portal_update_event(
  p_event_type text,
  p_source_type text,
  p_source_id text,
  p_title text,
  p_summary text default null,
  p_link_label text default null,
  p_link_url text default null,
  p_student_emails text[] default '{}'::text[],
  p_program_keys text[] default '{}'::text[],
  p_cohort_names text[] default '{}'::text[],
  p_created_by text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  clean_event_type text := lower(trim(coalesce(p_event_type, '')));
  clean_source_type text := lower(trim(coalesce(p_source_type, '')));
  clean_source_id text := trim(coalesce(p_source_id, ''));
  clean_title text := trim(coalesce(p_title, ''));
  clean_summary text := nullif(trim(coalesce(p_summary, '')), '');
  clean_link_label text := nullif(trim(coalesce(p_link_label, '')), '');
  clean_link_url text := nullif(trim(coalesce(p_link_url, '')), '');
  clean_student_emails text[] := public.lms_normalized_scope_values(coalesce(p_student_emails, '{}'::text[]));
  clean_program_keys text[] := public.lms_normalized_scope_values(coalesce(p_program_keys, '{}'::text[]));
  clean_cohort_names text[] := public.lms_normalized_scope_values(coalesce(p_cohort_names, '{}'::text[]));
  inserted_count integer := 0;
  digest_count integer := 0;
  digest_id uuid;
  digest_source_key text;
  digest_message text;
  event_total integer;
  is_service_role boolean := coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
  target record;
begin
  if clean_event_type not in ('certificate_issued', 'resource_added', 'recording_published', 'session_scheduled') then
    raise exception 'Unsupported portal update event type: %', p_event_type using errcode = '22023';
  end if;

  if clean_source_type = '' or clean_source_id = '' or clean_title = '' then
    raise exception 'Portal update event requires source type, source id, and title.' using errcode = '22023';
  end if;

  if clean_event_type = 'certificate_issued' and not (is_service_role or public.admin_has_permission('admin.certificates.issue')) then
    raise exception 'Not authorized to create certificate portal updates.' using errcode = '42501';
  elsif clean_event_type = 'resource_added' and not (is_service_role or public.admin_has_permission('admin.resources.manage')) then
    raise exception 'Not authorized to create resource portal updates.' using errcode = '42501';
  elsif clean_event_type = 'recording_published' and not (is_service_role or public.admin_has_permission('admin.recordings.manage')) then
    raise exception 'Not authorized to create recording portal updates.' using errcode = '42501';
  elsif clean_event_type = 'session_scheduled' and not (is_service_role or public.admin_has_permission('admin.meetings.manage')) then
    raise exception 'Not authorized to create session portal updates.' using errcode = '42501';
  end if;

  for target in
    select distinct
      s.id,
      lower(trim(s.email)) as email
    from public.students s
    where s.active = true
      and lower(trim(coalesce(s.email, ''))) <> ''
      and (
        lower(trim(s.email)) = any(clean_student_emails)
        or (
          cardinality(clean_student_emails) = 0
          and (
            cardinality(clean_program_keys) > 0
            or cardinality(clean_cohort_names) > 0
          )
          and public.lms_audience_matches(s.id, clean_program_keys, clean_cohort_names)
        )
      )
  loop
    insert into public.portal_update_events (
      event_key,
      event_type,
      source_type,
      source_id,
      title,
      summary,
      link_label,
      link_url,
      student_email,
      student_id,
      program_keys,
      cohort_names,
      created_by,
      metadata
    )
    values (
      clean_event_type || ':' || clean_source_type || ':' || clean_source_id || ':' || target.email,
      clean_event_type,
      clean_source_type,
      clean_source_id,
      clean_title,
      clean_summary,
      clean_link_label,
      clean_link_url,
      target.email,
      target.id,
      clean_program_keys,
      clean_cohort_names,
      nullif(trim(coalesce(p_created_by, '')), ''),
      coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (event_key) do nothing;

    if found then
      inserted_count := inserted_count + 1;
      digest_source_key := 'daily-portal-updates:' || current_date::text || ':' || target.email;

      select count(*)
      into event_total
      from public.portal_update_events e
      where e.student_email = target.email
        and e.event_date = current_date;

      with ranked_events as (
        select
          e.title,
          e.summary,
          e.link_label,
          e.link_url,
          row_number() over (order by e.occurred_at desc, e.created_at desc) as position
        from public.portal_update_events e
        where e.student_email = target.email
          and e.event_date = current_date
      )
      select
        'Here are the portal updates added for you today:' || E'\n\n' ||
        string_agg(
          '- ' || title ||
          case when summary is not null then ': ' || summary else '' end ||
          case when link_label is not null then ' (' || link_label || ')' else '' end,
          E'\n'
          order by position
        ) ||
        case
          when event_total > 12 then E'\n- ' || (event_total - 12)::text || ' more update(s) are available in your portal.'
          else ''
        end
      into digest_message
      from ranked_events
      where position <= 12;

      insert into public.announcements (
        announcement_id,
        audience,
        student_emails,
        title,
        message,
        priority,
        status,
        type,
        pinned,
        start_date,
        end_date,
        expires_at,
        link_label,
        link_url,
        source_type,
        source_id,
        source_key,
        system_generated,
        metadata,
        created_by,
        updated_by
      )
      values (
        'AUTO-PORTAL-' || to_char(current_date, 'YYYYMMDD') || '-' || substr(md5(target.email), 1, 10),
        'student',
        array[target.email],
        'Today''s Portal Updates',
        left(digest_message, 2500),
        'normal',
        'active',
        'general',
        false,
        current_date,
        current_date + 1,
        now() + interval '24 hours',
        'Open dashboard',
        '/student',
        'daily_portal_updates',
        current_date::text,
        digest_source_key,
        true,
        jsonb_build_object('eventCount', event_total, 'eventDate', current_date, 'studentEmail', target.email),
        nullif(trim(coalesce(p_created_by, '')), ''),
        nullif(trim(coalesce(p_created_by, '')), '')
      )
      on conflict (source_key) where source_key is not null
      do update set
        message = excluded.message,
        metadata = excluded.metadata,
        updated_at = now(),
        updated_by = excluded.updated_by,
        expires_at = greatest(coalesce(public.announcements.expires_at, excluded.expires_at), excluded.expires_at)
      returning id into digest_id;

      update public.portal_update_events
      set digest_announcement_id = digest_id
      where student_email = target.email
        and event_date = current_date
        and digest_announcement_id is null;

      digest_count := digest_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'insertedEvents', inserted_count,
    'updatedDigests', digest_count
  );
end;
$function$;

revoke all on function public.record_portal_update_event(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text,
  jsonb
) from public;

grant execute on function public.record_portal_update_event(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text,
  jsonb
) to authenticated;

create or replace function public.student_dashboard_bundle(p_student_email text default null::text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  with context as (
    select
      public.lms_student_id_for_request(p_student_email) as student_id,
      public.lms_request_email(p_student_email) as email
  ),
  student_scope as (
    select
      c.student_id,
      c.email,
      public.lms_normalized_scope_values(public.lms_student_program_keys(c.student_id)) as program_keys,
      public.lms_normalized_scope_values(public.lms_student_cohort_names(c.student_id)) as cohort_names
    from context c
  ),
  student_row as (
    select s.*
    from public.students s
    join student_scope scope on s.id = scope.student_id
  ),
  program_rows as (
    select scope.student_id, program_key
    from student_scope scope
    cross join lateral unnest(scope.program_keys) program_key
    where scope.student_id is not null
  ),
  student_cohort_rows as (
    select sc.student_id, sc.cohort_id, sc.cohort_name
    from public.student_cohorts sc
    join student_scope scope on sc.student_id = scope.student_id
  ),
  cohort_rows as (
    select c.*
    from public.cohorts c
    cross join student_scope scope
    cross join lateral (
      select
        public.lms_normalized_scope_values(case when c.program_key is null then '{}'::text[] else array[c.program_key]::text[] end) as program_keys,
        public.lms_normalized_scope_values(array[c.name]::text[]) as cohort_names
    ) audience
    where scope.student_id is not null
      and c.status <> 'inactive'
      and (cardinality(audience.program_keys) = 0 or scope.program_keys && audience.program_keys)
      and (cardinality(audience.cohort_names) = 0 or scope.cohort_names && audience.cohort_names)
    order by c.updated_at desc
  ),
  workshop_rows as (
    select
      w.*,
      case
        when w.access_type <> 'paid' then true
        when pa.id is not null then true
        else false
      end as "hasAccess",
      case when w.access_type = 'paid' and pa.id is null then true else false end as locked,
      case when w.access_type = 'paid' and pa.id is null then 'Payment required' else '' end as "lockReason"
    from public.workshops w
    cross join student_scope scope
    cross join lateral (
      select
        public.lms_workshop_program_keys(w.program_key, w.cohort_names) as program_keys,
        public.lms_normalized_scope_values(w.cohort_names) as cohort_names
    ) audience
    left join public.paid_access pa
      on lower(trim(pa.student_email)) = scope.email
     and pa.item_type = 'workshop'
     and pa.status = 'active'
     and (pa.item_id = w.workshop_id or pa.item_id = w.id::text)
     and (pa.expires_at is null or pa.expires_at > now())
    where scope.student_id is not null
      and w.workshop_status <> 'Inactive'
      and w.workshop_status <> 'Cancelled'
      and (cardinality(audience.program_keys) > 0 or cardinality(audience.cohort_names) > 0)
      and (cardinality(audience.program_keys) = 0 or scope.program_keys && audience.program_keys)
      and (cardinality(audience.cohort_names) = 0 or scope.cohort_names && audience.cohort_names)
    order by w.date asc
  ),
  announcement_rows as (
    select a.*
    from public.announcements a
    cross join student_scope scope
    cross join lateral (
      select
        public.lms_normalized_scope_values(a.program_keys) as program_keys,
        public.lms_normalized_scope_values(a.cohort_names) as cohort_names,
        public.lms_normalized_scope_values(a.student_emails) as student_emails
    ) audience
    where scope.student_id is not null
      and a.status = 'active'
      and (a.start_date is null or a.start_date <= current_date)
      and (a.end_date is null or a.end_date >= current_date)
      and (a.expires_at is null or a.expires_at > now())
      and (
        a.audience = 'all'
        or (
          a.audience = 'program'
          and (cardinality(audience.program_keys) = 0 or scope.program_keys && audience.program_keys)
        )
        or (
          a.audience = 'cohort'
          and (cardinality(audience.cohort_names) = 0 or scope.cohort_names && audience.cohort_names)
        )
        or (
          a.audience = 'student'
          and scope.email = any(audience.student_emails)
        )
      )
    order by a.pinned desc, (a.priority = 'urgent') desc, a.updated_at desc
  ),
  paid_rows as (
    select pa.*
    from public.paid_access pa
    join student_scope scope on lower(trim(pa.student_email)) = scope.email
    where pa.status = 'active'
      and (pa.expires_at is null or pa.expires_at > now())
  )
  select jsonb_build_object(
    'student', coalesce((select to_jsonb(s) from student_row s limit 1), 'null'::jsonb),
    'studentPrograms', coalesce((select jsonb_agg(to_jsonb(sp)) from program_rows sp), '[]'::jsonb),
    'studentCohorts', coalesce((select jsonb_agg(to_jsonb(sc)) from student_cohort_rows sc), '[]'::jsonb),
    'cohorts', coalesce((select jsonb_agg(to_jsonb(c)) from cohort_rows c), '[]'::jsonb),
    'workshops', coalesce((select jsonb_agg(to_jsonb(w)) from workshop_rows w), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(to_jsonb(a)) from announcement_rows a), '[]'::jsonb),
    'featureMaster', coalesce((
      select jsonb_agg(to_jsonb(fm) order by fm.category asc, fm.feature_name asc)
      from public.feature_master fm
    ), '[]'::jsonb),
    'paidAccess', coalesce((select jsonb_agg(to_jsonb(pa)) from paid_rows pa), '[]'::jsonb)
  );
$function$;
