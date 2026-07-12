import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ZoomAccountLabel = 'Zoom Account 1' | 'Zoom Account 2';
type MeetingLinkSource = ZoomAccountLabel | 'Custom Link';

type ZoomMeetingAction =
  | 'create-meeting'
  | 'update-meeting'
  | 'reschedule-meeting'
  | 'cancel-meeting'
  | 'complete-meeting'
  | 'add-manual-recording'
  | 'edit-published-recording'
  | 'fetch-recordings'
  | 'publish-recording'
  | 'reject-recording';

type WorkshopPayload = {
  action: ZoomMeetingAction;
  alternateDate?: string;
  alternateTime?: string;
  body?: {
    cohortNames?: string[];
    date?: string;
    durationMinutes?: number;
    customJoinUrl?: string | null;
    programKey?: string | null;
    time?: string;
    title?: string;
    workshopStatus?: string;
    youtubeVideoUrl?: string | null;
    zoomAccount?: ZoomAccountLabel | string;
    zoomRecordingPassword?: string | null;
    zoomRecordingUrl?: string | null;
  };
  candidateId?: string;
  workshopId?: string;
};

type WorkshopRow = {
  id: string;
  cohort_names: string[];
  date: string;
  duration_minutes: number | null;
  join_url: string | null;
  time: string | null;
  title: string;
  workshop_id: string | null;
  workshop_status: string;
  zoom_account: string | null;
  zoom_id: string | null;
};

type ZoomRecordingFile = {
  id?: string;
  download_url?: string;
  file_size?: number;
  file_type?: string;
  password?: string;
  play_url?: string;
  recording_end?: string;
  recording_start?: string;
  recording_type?: string;
};

class ZoomApiError extends Error {
  code?: number | string;
  status: number;

  constructor(message: string, status: number, code?: number | string) {
    super(message);
    this.code = code;
    this.name = 'ZoomApiError';
    this.status = status;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  });
}

function readRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function readFirstRequiredEnv(names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`${names.join(' or ')} is not configured.`);
}

function normalizeMeetingLinkSource(value: unknown): MeetingLinkSource {
  const account = String(value ?? 'Zoom Account 1').trim().toLowerCase();
  if (account === 'custom link' || account === 'custom' || account === 'manual link' || account === 'manual') return 'Custom Link';
  if (account === 'zoom account 2' || account === 'account2' || account === '2') return 'Zoom Account 2';
  return 'Zoom Account 1';
}

function normalizeZoomAccount(value: unknown): ZoomAccountLabel {
  const source = normalizeMeetingLinkSource(value);
  return source === 'Zoom Account 2' ? 'Zoom Account 2' : 'Zoom Account 1';
}

function isCustomLinkSource(value: unknown) {
  return normalizeMeetingLinkSource(value) === 'Custom Link';
}

function zoomAccountPrefix(label: ZoomAccountLabel) {
  return label === 'Zoom Account 2' ? 'ZOOM_ACCOUNT_2' : 'ZOOM_ACCOUNT_1';
}

function toZoomStartTime(date: string, time?: string) {
  const safeTime = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '00:00';
  return `${date}T${safeTime}:00`;
}

function ensureHttpUrl(value: unknown) {
  const url = typeof value === 'string' ? value.trim() : '';
  return /^https?:\/\//i.test(url) ? url : null;
}

function requireHttpUrl(value: unknown, message: string) {
  const url = ensureHttpUrl(value);
  if (!url) throw new Error(message);
  return url;
}

function requireText(value: unknown, message: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(message);
  return text;
}

function readDurationMinutes(value: unknown, fallback = 90) {
  const duration = Number(value ?? fallback);
  if (!Number.isInteger(duration) || duration <= 0) throw new Error('Meeting duration must be a positive whole number.');
  return duration;
}

async function getZoomAccessToken(account: ZoomAccountLabel) {
  const prefix = zoomAccountPrefix(account);
  const accountId = readFirstRequiredEnv([`${prefix}_ACCOUNT_ID`, `${prefix}_ID`]);
  const clientId = readRequiredEnv(`${prefix}_CLIENT_ID`);
  const clientSecret = readRequiredEnv(`${prefix}_CLIENT_SECRET`);
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const params = new URLSearchParams({ account_id: accountId, grant_type: 'account_credentials' });

  const response = await fetch('https://zoom.us/oauth/token', {
    body: params,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    method: 'POST'
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== 'string') {
    throw new Error(`Zoom authentication failed for ${account}.`);
  }

  return payload.access_token as string;
}

async function zoomRequest<T>(account: ZoomAccountLabel, path: string, init: RequestInit = {}) {
  const token = await getZoomAccessToken(account);
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });

  if (response.status === 204) return null as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : `Zoom API request failed: ${path}`;
    throw new ZoomApiError(message, response.status, payload?.code);
  }
  return payload as T;
}

function buildZoomMeetingPayload(body: NonNullable<WorkshopPayload['body']>) {
  const title = requireText(body.title, 'Meeting title is required.');
  const date = requireText(body.date, 'Meeting date is required.');
  const duration = readDurationMinutes(body.durationMinutes);

  return {
    duration,
    settings: {
      auto_recording: 'none',
      join_before_host: false,
      meeting_authentication: false,
      mute_upon_entry: true,
      participant_video: false,
      waiting_room: true
    },
    start_time: toZoomStartTime(date, body.time),
    timezone: 'Asia/Kolkata',
    topic: title,
    type: 2
  };
}

function buildWorkshopRow(body: NonNullable<WorkshopPayload['body']>, zoomMeeting: Record<string, unknown>, account: ZoomAccountLabel) {
  const date = requireText(body.date, 'Meeting date is required.');
  const title = requireText(body.title, 'Meeting title is required.');
  return {
    cohort_names: Array.isArray(body.cohortNames) ? body.cohortNames.map(String).filter(Boolean) : [],
    date,
    duration_minutes: readDurationMinutes(body.durationMinutes),
    join_url: typeof zoomMeeting.join_url === 'string' ? zoomMeeting.join_url : null,
    time: typeof body.time === 'string' && body.time ? body.time : null,
    title,
    workshop_id: `WS-${Date.now()}`,
    workshop_status: 'Scheduled',
    zoom_account: account,
    zoom_id: String(zoomMeeting.id ?? '')
  };
}

function buildCustomWorkshopRow(body: NonNullable<WorkshopPayload['body']>) {
  const date = requireText(body.date, 'Meeting date is required.');
  const title = requireText(body.title, 'Meeting title is required.');
  return {
    cohort_names: Array.isArray(body.cohortNames) ? body.cohortNames.map(String).filter(Boolean) : [],
    date,
    duration_minutes: readDurationMinutes(body.durationMinutes),
    join_url: requireHttpUrl(body.customJoinUrl, 'Add a valid custom meeting link before saving.'),
    time: typeof body.time === 'string' && body.time ? body.time : null,
    title,
    workshop_id: `WS-${Date.now()}`,
    workshop_status: 'Scheduled',
    zoom_account: 'Custom Link',
    zoom_id: null
  };
}

function buildWorkshopUpdateRow(body: NonNullable<WorkshopPayload['body']>, workshop: WorkshopRow, source: MeetingLinkSource, extra: Record<string, unknown> = {}) {
  return {
    cohort_names: Array.isArray(body.cohortNames) ? body.cohortNames.map(String).filter(Boolean) : workshop.cohort_names,
    date: requireText(body.date, 'Meeting date is required.'),
    duration_minutes: readDurationMinutes(body.durationMinutes, workshop.duration_minutes ?? 90),
    time: typeof body.time === 'string' && body.time ? body.time : null,
    title: requireText(body.title, 'Meeting title is required.'),
    updated_at: new Date().toISOString(),
    workshop_status: body.workshopStatus ?? workshop.workshop_status,
    zoom_account: source,
    ...extra
  };
}

async function getActiveAdmin(supabase: ReturnType<typeof createClient>, authorization: string) {
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Missing access token.');

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.email) throw new Error('Invalid Supabase session.');

  const email = userData.user.email.toLowerCase();
  const { data: admins, error: adminError } = await supabase
    .from('admin_users')
    .select('id,email,status,role,auth_user_id')
    .or(`auth_user_id.eq.${userData.user.id},email.eq.${email}`)
    .limit(2);

  if (adminError) throw adminError;
  const admin = (admins ?? []).find((row) => row.auth_user_id === userData.user.id) ?? (admins ?? []).find((row) => String(row.email).toLowerCase() === email);
  if (!admin || admin.status !== 'active') throw new Error('Active admin access is required.');
  if (admin.role !== 'super_admin' && admin.role !== 'admin') throw new Error('Meeting management permission is required.');

  return { email, id: userData.user.id };
}

async function writeAudit(supabase: ReturnType<typeof createClient>, actorEmail: string, action: string, workshop: Record<string, unknown>, details: Record<string, unknown>) {
  await supabase.from('audit_logs').insert({
    action,
    actor_email: actorEmail,
    actor_role: 'admin',
    details,
    entity_id: String(workshop.id ?? ''),
    entity_type: 'workshop',
    status: 'success'
  });
}

async function getWorkshopById(supabase: ReturnType<typeof createClient>, workshopId: string) {
  const { data, error } = await supabase.from('workshops').select('*').eq('id', workshopId).single();
  if (error) throw error;
  return data as WorkshopRow;
}

async function createMeeting(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const body = payload.body ?? {};
  const source = normalizeMeetingLinkSource(body.zoomAccount);
  if (source === 'Custom Link') {
    const workshopRow = buildCustomWorkshopRow(body);
    const { data, error } = await supabase.from('workshops').insert(workshopRow).select('*').single();
    if (error) throw error;
    await writeAudit(supabase, actorEmail, 'admin_workshop_created', data, { changedFields: Object.keys(workshopRow).sort(), zoomAccount: source });
    return data;
  }

  const account = source;
  const zoomMeeting = await zoomRequest<Record<string, unknown>>(account, '/users/me/meetings', {
    body: JSON.stringify(buildZoomMeetingPayload(body)),
    method: 'POST'
  });
  const workshopRow = buildWorkshopRow(body, zoomMeeting, account);
  const { data, error } = await supabase.from('workshops').insert(workshopRow).select('*').single();
  if (error) throw error;
  await writeAudit(supabase, actorEmail, 'admin_workshop_created', data, { changedFields: Object.keys(workshopRow).sort(), zoomAccount: account });
  return data;
}

async function updateMeeting(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const workshopId = requireText(payload.workshopId, 'Workshop row ID is required.');
  const workshop = await getWorkshopById(supabase, workshopId);
  const body = payload.body ?? {};
  const source = normalizeMeetingLinkSource(body.zoomAccount ?? workshop.zoom_account);

  if (source === 'Custom Link') {
    const updateRow = buildWorkshopUpdateRow(body, workshop, source, {
      join_url: requireHttpUrl(body.customJoinUrl ?? workshop.join_url, 'Add a valid custom meeting link before saving.'),
      workshop_status: payload.action === 'reschedule-meeting' ? 'Scheduled' : body.workshopStatus ?? workshop.workshop_status,
      zoom_id: null
    });
    const { data, error } = await supabase.from('workshops').update(updateRow).eq('id', workshopId).select('*').single();
    if (error) throw error;
    await writeAudit(supabase, actorEmail, payload.action === 'reschedule-meeting' ? 'admin_workshop_rescheduled' : 'admin_workshop_updated', data, {
      changedFields: Object.keys(updateRow).sort(),
      zoomAccount: source
    });
    return data;
  }

  const account = source;
  const zoomMeetingId = workshop.zoom_id ? String(workshop.zoom_id).trim() : '';
  let zoomMeeting: Record<string, unknown> | null = null;

  if (zoomMeetingId) {
    await zoomRequest(account, `/meetings/${encodeURIComponent(zoomMeetingId)}`, {
      body: JSON.stringify(buildZoomMeetingPayload(body)),
      method: 'PATCH'
    });
  } else {
    zoomMeeting = await zoomRequest<Record<string, unknown>>(account, '/users/me/meetings', {
      body: JSON.stringify(buildZoomMeetingPayload(body)),
      method: 'POST'
    });
  }

  const updateRow = buildWorkshopUpdateRow(body, workshop, account, {
    join_url: zoomMeeting && typeof zoomMeeting.join_url === 'string' ? zoomMeeting.join_url : workshop.join_url,
    workshop_status: payload.action === 'reschedule-meeting' ? 'Scheduled' : body.workshopStatus ?? workshop.workshop_status,
    zoom_id: zoomMeeting ? String(zoomMeeting.id ?? '') : zoomMeetingId
  });

  const { data, error } = await supabase.from('workshops').update(updateRow).eq('id', workshopId).select('*').single();
  if (error) throw error;
  await writeAudit(supabase, actorEmail, payload.action === 'reschedule-meeting' ? 'admin_workshop_rescheduled' : 'admin_workshop_updated', data, {
    changedFields: Object.keys(updateRow).sort(),
    zoomAccount: account
  });
  return data;
}

function isPreferredRecording(file: ZoomRecordingFile) {
  return String(file.file_type ?? '').toUpperCase() === 'MP4' && String(file.recording_type ?? '').toLowerCase() === 'shared_screen_with_speaker_view';
}

async function fetchRecordings(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const workshopId = requireText(payload.workshopId, 'Workshop row ID is required.');
  const workshop = await getWorkshopById(supabase, workshopId);
  if (isCustomLinkSource(workshop.zoom_account)) {
    throw new Error('Custom link meetings do not have Zoom recordings to fetch. Add a recording link manually.');
  }
  const account = normalizeZoomAccount(workshop.zoom_account);
  const zoomMeetingId = requireText(workshop.zoom_id, 'Workshop does not have a Zoom meeting ID.');
  const response = await zoomRequest<{ password?: string; recording_files?: ZoomRecordingFile[] }>(account, `/meetings/${encodeURIComponent(zoomMeetingId)}/recordings`);
  const files = (response.recording_files ?? []).filter(isPreferredRecording);

  const rows = files.map((file) => ({
    download_url: ensureHttpUrl(file.download_url),
    duration_minutes: file.recording_start && file.recording_end ? Math.max(1, Math.round((new Date(file.recording_end).getTime() - new Date(file.recording_start).getTime()) / 60000)) : null,
    file_size: typeof file.file_size === 'number' ? file.file_size : null,
    file_type: file.file_type ?? null,
    play_url: ensureHttpUrl(file.play_url),
    recording_password: typeof file.password === 'string' && file.password.trim() ? file.password.trim() : typeof response.password === 'string' && response.password.trim() ? response.password.trim() : null,
    recording_end: file.recording_end ?? null,
    recording_start: file.recording_start ?? null,
    recording_type: file.recording_type ?? null,
    status: 'draft',
    updated_at: new Date().toISOString(),
    workshop_id: workshop.workshop_id ?? workshop.id,
    zoom_account: account,
    zoom_id: zoomMeetingId,
    zoom_recording_file_id: file.id ?? null
  }));
  const recordingFileIds = rows.map((row) => row.zoom_recording_file_id).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  let existingFileIds = new Set<string>();

  if (recordingFileIds.length > 0) {
    const { data: existingCandidates, error: existingError } = await supabase
      .from('workshop_recording_candidates')
      .select('zoom_recording_file_id')
      .eq('zoom_account', account)
      .eq('zoom_id', zoomMeetingId)
      .neq('status', 'rejected')
      .in('zoom_recording_file_id', recordingFileIds);
    if (existingError) throw existingError;
    existingFileIds = new Set((existingCandidates ?? []).map((candidate) => String(candidate.zoom_recording_file_id)).filter(Boolean));
  }

  const newRows = rows.filter((row) => !row.zoom_recording_file_id || !existingFileIds.has(row.zoom_recording_file_id));

  if (newRows.length > 0) {
    const { error } = await supabase.from('workshop_recording_candidates').insert(newRows);
    if (error) throw error;
  }

  await writeAudit(supabase, actorEmail, 'admin_workshop_recordings_fetched', workshop, {
    candidateCount: newRows.length,
    duplicateCount: rows.length - newRows.length,
    zoomAccount: account
  });
  return { candidates: newRows, count: newRows.length, duplicateCount: rows.length - newRows.length, workshop };
}

async function completeMeeting(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const workshopId = requireText(payload.workshopId, 'Workshop row ID is required.');
  const { data, error } = await supabase
    .from('workshops')
    .update({ updated_at: new Date().toISOString(), workshop_status: 'Completed' })
    .eq('id', workshopId)
    .select('*')
    .single();
  if (error) throw error;
  await writeAudit(supabase, actorEmail, 'admin_workshop_status_changed', data, { changedFields: ['updated_at', 'workshop_status'] });
  return data;
}

async function addManualRecording(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const workshopId = requireText(payload.workshopId, 'Workshop row ID is required.');
  const workshop = await getWorkshopById(supabase, workshopId);
  const body = payload.body ?? {};
  const youtubeUrl = ensureHttpUrl(body.youtubeVideoUrl);
  const alternateUrl = ensureHttpUrl(body.zoomRecordingUrl);
  const playUrl = youtubeUrl ?? alternateUrl;
  if (!playUrl) throw new Error('Add a valid recording URL before sending it for review.');

  const account = normalizeMeetingLinkSource(body.zoomAccount ?? workshop.zoom_account);
  const workshopKey = workshop.workshop_id ?? workshop.id;
  const { data: existingManualCandidate, error: existingManualCandidateError } = await supabase
    .from('workshop_recording_candidates')
    .select('id,status')
    .eq('workshop_id', workshopKey)
    .eq('play_url', playUrl)
    .in('status', ['draft', 'rejected'])
    .limit(1)
    .maybeSingle();
  if (existingManualCandidateError) throw existingManualCandidateError;
  if (existingManualCandidate) {
    const status = String(existingManualCandidate.status ?? '');
    throw new Error(status === 'draft' ? 'This recording link is already waiting for review.' : 'This recording link was already rejected for this workshop.');
  }

  const row = {
    download_url: null,
    duration_minutes: null,
    file_size: null,
    file_type: youtubeUrl ? 'URL' : 'MP4',
    play_url: playUrl,
    recording_password: typeof body.zoomRecordingPassword === 'string' && body.zoomRecordingPassword.trim() ? body.zoomRecordingPassword.trim() : null,
    recording_end: null,
    recording_start: null,
    recording_type: youtubeUrl ? 'manual_youtube_link' : 'manual_recording_link',
    status: 'draft',
    updated_at: new Date().toISOString(),
    workshop_id: workshopKey,
    zoom_account: account,
    zoom_id: workshop.zoom_id ?? workshop.workshop_id ?? workshop.id,
    zoom_recording_file_id: null
  };

  const { data: candidate, error } = await supabase.from('workshop_recording_candidates').insert(row).select('*').single();
  if (error) throw error;

  await writeAudit(supabase, actorEmail, 'admin_workshop_recording_updated', workshop, {
    candidateId: candidate.id,
    source: youtubeUrl ? 'youtube' : 'manual',
    workshopId
  });
  return { candidate, candidateId: candidate.id, count: 1, workshop };
}

async function editPublishedRecording(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const workshopId = requireText(payload.workshopId, 'Workshop row ID is required.');
  const workshop = await getWorkshopById(supabase, workshopId);
  if (workshop.workshop_status !== 'Completed') throw new Error('Only completed published workshops can be edited here.');

  const body = payload.body ?? {};
  const title = requireText(body.title ?? workshop.title, 'Recording title is required.');
  const youtubeUrl = ensureHttpUrl(body.youtubeVideoUrl);
  const alternateUrl = ensureHttpUrl(body.zoomRecordingUrl);
  if (!youtubeUrl && !alternateUrl) throw new Error('Published recordings must keep at least one valid recording URL.');

  const cohortNames = Array.isArray(body.cohortNames)
    ? Array.from(new Set(body.cohortNames.map((name) => String(name).trim()).filter(Boolean)))
    : workshop.cohort_names;
  const previousProgramKey = typeof (workshop as Record<string, unknown>).program_key === 'string' ? String((workshop as Record<string, unknown>).program_key) : null;
  const programKey =
    Object.prototype.hasOwnProperty.call(body, 'programKey')
      ? typeof body.programKey === 'string' && body.programKey.trim()
        ? body.programKey.trim().toLowerCase()
        : null
      : previousProgramKey;
  const passcode = typeof body.zoomRecordingPassword === 'string' && body.zoomRecordingPassword.trim() ? body.zoomRecordingPassword.trim() : null;

  const updateRow = {
    cohort_names: cohortNames,
    program_key: programKey,
    title,
    updated_at: new Date().toISOString(),
    workshop_status: 'Completed',
    youtube_video_url: youtubeUrl,
    zoom_recording_password: passcode,
    zoom_recording_url: alternateUrl
  };

  const { data, error } = await supabase.from('workshops').update(updateRow).eq('id', workshopId).select('*').single();
  if (error) throw error;

  await writeAudit(supabase, actorEmail, 'admin_published_recording_updated', data, {
    changedFields: Object.keys(updateRow).sort(),
    previous: {
      cohort_names: workshop.cohort_names,
      program_key: (workshop as Record<string, unknown>).program_key ?? null,
      title: workshop.title,
      youtube_video_url: (workshop as Record<string, unknown>).youtube_video_url ?? null,
      zoom_recording_password: (workshop as Record<string, unknown>).zoom_recording_password ?? null,
      zoom_recording_url: (workshop as Record<string, unknown>).zoom_recording_url ?? null
    }
  });

  return { workshop: data };
}

async function cancelMeeting(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const workshopId = requireText(payload.workshopId, 'Workshop row ID is required.');
  const workshop = await getWorkshopById(supabase, workshopId);
  const source = normalizeMeetingLinkSource(workshop.zoom_account);
  const account = normalizeZoomAccount(workshop.zoom_account);
  const zoomMeetingId = workshop.zoom_id ? String(workshop.zoom_id).trim() : '';
  let zoomCancellationWarning = '';

  if (source !== 'Custom Link' && zoomMeetingId) {
    try {
      await zoomRequest(account, `/meetings/${encodeURIComponent(zoomMeetingId)}`, { method: 'DELETE' });
    } catch (error) {
      const zoomError = error instanceof ZoomApiError ? error : null;
      const isAlreadyGone = zoomError?.status === 404 || String(zoomError?.code ?? '') === '3001';
      if (!isAlreadyGone) {
        zoomCancellationWarning = error instanceof Error ? error.message : 'Zoom meeting could not be cancelled from Zoom.';
        console.warn('Zoom meeting delete failed; continuing with LMS cancellation.', {
          account,
          workshopId,
          zoomMeetingId,
          warning: zoomCancellationWarning
        });
      }
    }
  }

  const updateRow = {
    join_url: null,
    updated_at: new Date().toISOString(),
    workshop_status: 'Cancelled'
  };
  const { data, error } = await supabase.from('workshops').update(updateRow).eq('id', workshopId).select('*').single();
  if (error) throw error;
  await writeAudit(supabase, actorEmail, 'admin_workshop_cancelled', data, {
    changedFields: Object.keys(updateRow).sort(),
    zoomCancellationWarning: zoomCancellationWarning || null,
    zoomAccount: source,
    zoomId: zoomMeetingId || null
  });
  return { ...data, zoom_cancellation_warning: zoomCancellationWarning || null };
}

async function publishRecording(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const candidateId = requireText(payload.candidateId, 'Recording candidate ID is required.');
  const { data: candidate, error: candidateError } = await supabase.from('workshop_recording_candidates').select('*').eq('id', candidateId).single();
  if (candidateError) throw candidateError;
  const playUrl = ensureHttpUrl(candidate.play_url);
  if (!playUrl) throw new Error('Selected recording candidate does not have a playable URL.');

  let workshopResult = await supabase
    .from('workshops')
    .update({
      updated_at: new Date().toISOString(),
      zoom_recording_password: typeof candidate.recording_password === 'string' && candidate.recording_password.trim() ? candidate.recording_password.trim() : null,
      zoom_recording_url: playUrl
    })
    .eq('workshop_id', candidate.workshop_id)
    .select('*')
    .maybeSingle();
  if (workshopResult.error) throw workshopResult.error;

  if (!workshopResult.data) {
    workshopResult = await supabase
      .from('workshops')
      .update({
        updated_at: new Date().toISOString(),
        zoom_recording_password: typeof candidate.recording_password === 'string' && candidate.recording_password.trim() ? candidate.recording_password.trim() : null,
        zoom_recording_url: playUrl
      })
      .eq('id', candidate.workshop_id)
      .select('*')
      .maybeSingle();
    if (workshopResult.error) throw workshopResult.error;
  }

  const workshop = workshopResult.data;
  if (!workshop) throw new Error('Workshop for this recording candidate could not be found.');

  await supabase
    .from('workshop_recording_candidates')
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: actorEmail, status: 'reviewed', updated_at: new Date().toISOString() })
    .eq('id', candidateId);

  await writeAudit(supabase, actorEmail, 'admin_workshop_recording_published', workshop, {
    candidateId,
    publishedUrl: playUrl,
    zoomRecordingFileId: candidate.zoom_recording_file_id
  });
  return { candidateId, workshop };
}

async function rejectRecording(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const candidateId = requireText(payload.candidateId, 'Recording candidate ID is required.');
  const { data: candidate, error: candidateError } = await supabase.from('workshop_recording_candidates').select('*').eq('id', candidateId).single();
  if (candidateError) throw candidateError;

  const { data: candidateRow, error: updateError } = await supabase
    .from('workshop_recording_candidates')
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: actorEmail, status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', candidateId)
    .select('*')
    .single();
  if (updateError) throw updateError;

  const { data: workshop } = await supabase.from('workshops').select('*').eq('workshop_id', candidate.workshop_id).maybeSingle();
  await writeAudit(supabase, actorEmail, 'admin_workshop_recording_rejected', workshop ?? { id: candidate.workshop_id }, {
    candidateId,
    zoomRecordingFileId: candidate.zoom_recording_file_id
  });
  return { candidate: candidateRow, candidateId };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service environment is not configured.');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const admin = await getActiveAdmin(supabase, request.headers.get('Authorization') ?? '');
    const payload = (await request.json()) as WorkshopPayload;

    if (payload.action === 'create-meeting') return jsonResponse({ workshop: await createMeeting(supabase, admin.email, payload) });
    if (payload.action === 'update-meeting' || payload.action === 'reschedule-meeting') return jsonResponse({ workshop: await updateMeeting(supabase, admin.email, payload) });
    if (payload.action === 'cancel-meeting') return jsonResponse({ workshop: await cancelMeeting(supabase, admin.email, payload) });
    if (payload.action === 'complete-meeting') return jsonResponse({ workshop: await completeMeeting(supabase, admin.email, payload) });
    if (payload.action === 'add-manual-recording') return jsonResponse(await addManualRecording(supabase, admin.email, payload));
    if (payload.action === 'edit-published-recording') return jsonResponse(await editPublishedRecording(supabase, admin.email, payload));
    if (payload.action === 'fetch-recordings') return jsonResponse(await fetchRecordings(supabase, admin.email, payload));
    if (payload.action === 'publish-recording') return jsonResponse(await publishRecording(supabase, admin.email, payload));
    if (payload.action === 'reject-recording') return jsonResponse(await rejectRecording(supabase, admin.email, payload));

    return jsonResponse({ error: 'Unsupported Zoom meeting action.' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Zoom meeting request failed.' }, 400);
  }
});
