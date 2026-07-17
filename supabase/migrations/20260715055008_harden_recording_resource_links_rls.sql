drop policy if exists "recording resource links readable by authenticated users" on public.recording_resource_links;

create policy "recording resource links readable by eligible students or recording admins"
on public.recording_resource_links
for select
to authenticated
using (
  public.admin_has_permission('admin.recordings.view')
  or exists (
    select 1
    from public.workshops w
    join public.resources r on r.id = recording_resource_links.resource_id
    cross join lateral (
      select public.lms_student_id_for_request(null::text) as student_id
    ) request_context
    cross join lateral (
      select
        public.lms_workshop_program_keys(w.program_key, w.cohort_names) as program_keys,
        public.lms_normalized_scope_values(w.cohort_names) as cohort_names
    ) workshop_audience
    where w.id = recording_resource_links.recording_id
      and request_context.student_id is not null
      and w.workshop_status = 'Completed'
      and coalesce(w.youtube_video_url, w.zoom_recording_url, '') <> ''
      and r.status = 'active'
      and (
        cardinality(workshop_audience.program_keys) > 0
        or cardinality(workshop_audience.cohort_names) > 0
      )
      and (
        cardinality(public.lms_normalized_scope_values(r.program_keys)) > 0
        or cardinality(public.lms_normalized_scope_values(r.cohort_names)) > 0
      )
      and public.lms_audience_matches(request_context.student_id, workshop_audience.program_keys, workshop_audience.cohort_names)
      and public.lms_audience_matches(request_context.student_id, r.program_keys, r.cohort_names)
  )
);
