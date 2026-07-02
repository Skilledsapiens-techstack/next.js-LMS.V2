-- Keep one active candidate per Zoom recording file, then enforce that rule.
-- Rejected duplicates remain as history, but draft/reviewed duplicates are blocked.
with ranked_candidates as (
  select
    id,
    row_number() over (
      partition by zoom_account, zoom_id, zoom_recording_file_id
      order by
        case status when 'reviewed' then 0 when 'draft' then 1 else 2 end,
        coalesce(reviewed_at, detected_at, updated_at, now()) asc,
        id asc
    ) as duplicate_rank
  from public.workshop_recording_candidates
  where zoom_recording_file_id is not null
    and status <> 'rejected'
)
update public.workshop_recording_candidates as candidate
set
  reviewed_at = coalesce(candidate.reviewed_at, now()),
  reviewed_by = coalesce(candidate.reviewed_by, 'system'),
  status = 'rejected',
  updated_at = now()
from ranked_candidates
where candidate.id = ranked_candidates.id
  and ranked_candidates.duplicate_rank > 1;

create unique index if not exists workshop_recording_candidates_active_file_unique
on public.workshop_recording_candidates (zoom_account, zoom_id, zoom_recording_file_id)
where zoom_recording_file_id is not null
  and status <> 'rejected';

drop policy if exists "admin workshop writes can be audited by active admins" on public.audit_logs;

create policy "admin workshop writes can be audited by active admins"
on public.audit_logs
for insert
to authenticated
with check (
  is_active_admin()
  and actor_role = 'admin'
  and entity_type = 'workshop'
  and action in (
    'admin_workshop_created',
    'admin_workshop_updated',
    'admin_workshop_rescheduled',
    'admin_workshop_cancelled',
    'admin_workshop_status_changed',
    'admin_workshop_recording_updated',
    'admin_workshop_recordings_fetched',
    'admin_workshop_recording_published',
    'admin_workshop_recording_rejected'
  )
  and lower(coalesce(actor_email, '')) = current_auth_email()
);
