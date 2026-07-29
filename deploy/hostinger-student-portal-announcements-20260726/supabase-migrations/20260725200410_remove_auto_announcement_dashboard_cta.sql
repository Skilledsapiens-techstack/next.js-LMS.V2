update public.announcements
set
  link_label = null,
  link_url = null,
  updated_at = now()
where source_type = 'daily_portal_updates'
  and system_generated is true
  and (link_label is not null or link_url is not null);

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
        null,
        null,
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
        link_label = null,
        link_url = null,
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
