import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ZoomAccountLabel = 'Zoom Account 1' | 'Zoom Account 2';

type ZoomMeetingAction =
  | 'create-meeting'
  | 'update-meeting'
  | 'reschedule-meeting'
  | 'cancel-meeting'
  | 'complete-meeting'
  | 'fetch-recordings'
  | 'publish-recording';

type WorkshopPayload = {
  action: ZoomMeetingAction;
  alternateDate?: string;
  alternateTime?: string;
  body?: {
    cohortNames?: string[];
    date?: string;
    durationMinutes?: number;
    time?: string;
    title?: string;
    workshopStatus?: string;
    zoomAccount?: ZoomAccountLabel | string;
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

function normalizeZoomAccount(value: unknown): ZoomAccountLabel {
  const account = String(value ?? 'Zoom Account 1').trim().toLowerCase();
  if (account === 'zoom account 2' || account === 'account2' || account === '2') return 'Zoom Account 2';
  return 'Zoom Account 1';
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

function requireText(value: unknown, message: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(message);
  return text;
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
  const duration = Number(body.durationMinutes ?? 90);
  if (!Number.isInteger(duration) || duration <= 0) throw new Error('Meeting duration must be a positive whole number.');

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
    duration_minutes: Number(body.durationMinutes ?? 90),
    join_url: typeof zoomMeeting.join_url === 'string' ? zoomMeeting.join_url : null,
    time: typeof body.time === 'string' && body.time ? body.time : null,
    title,
    workshop_id: `WS-${Date.now()}`,
    workshop_status: 'Scheduled',
    zoom_account: account,
    zoom_id: String(zoomMeeting.id ?? '')
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
    .select('id,email,status,auth_user_id')
    .or(`auth_user_id.eq.${userData.user.id},email.eq.${email}`)
    .limit(2);

  if (adminError) throw adminError;
  const admin = (admins ?? []).find((row) => row.auth_user_id === userData.user.id) ?? (admins ?? []).find((row) => String(row.email).toLowerCase() === email);
  if (!admin || admin.status !== 'active') throw new Error('Active admin access is required.');

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
  const account = normalizeZoomAccount(body.zoomAccount);
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
  const account = normalizeZoomAccount(body.zoomAccount ?? workshop.zoom_account);
  const zoomMeetingId = requireText(workshop.zoom_id, 'Workshop does not have a Zoom meeting ID.');

  await zoomRequest(account, `/meetings/${encodeURIComponent(zoomMeetingId)}`, {
    body: JSON.stringify(buildZoomMeetingPayload(body)),
    method: 'PATCH'
  });

  const updateRow = {
    cohort_names: Array.isArray(body.cohortNames) ? body.cohortNames.map(String).filter(Boolean) : workshop.cohort_names,
    date: requireText(body.date, 'Meeting date is required.'),
    duration_minutes: Number(body.durationMinutes ?? workshop.duration_minutes ?? 90),
    time: typeof body.time === 'string' && body.time ? body.time : null,
    title: requireText(body.title, 'Meeting title is required.'),
    updated_at: new Date().toISOString(),
    workshop_status: payload.action === 'reschedule-meeting' ? 'Scheduled' : body.workshopStatus ?? workshop.workshop_status,
    zoom_account: account
  };

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
  const account = normalizeZoomAccount(workshop.zoom_account);
  const zoomMeetingId = requireText(workshop.zoom_id, 'Workshop does not have a Zoom meeting ID.');
  const response = await zoomRequest<{ recording_files?: ZoomRecordingFile[] }>(account, `/meetings/${encodeURIComponent(zoomMeetingId)}/recordings`);
  const files = (response.recording_files ?? []).filter(isPreferredRecording);

  const rows = files.map((file) => ({
    download_url: ensureHttpUrl(file.download_url),
    duration_minutes: file.recording_start && file.recording_end ? Math.max(1, Math.round((new Date(file.recording_end).getTime() - new Date(file.recording_start).getTime()) / 60000)) : null,
    file_size: typeof file.file_size === 'number' ? file.file_size : null,
    file_type: file.file_type ?? null,
    play_url: ensureHttpUrl(file.play_url),
    recording_end: file.recording_end ?? null,
    recording_start: file.recording_start ?? null,
    recording_type: file.recording_type ?? null,
    status: 'draft',
    updated_at: new Date().toISOString(),
    workshop_id: workshop.workshop_id,
    zoom_account: account,
    zoom_id: zoomMeetingId,
    zoom_recording_file_id: file.id ?? null
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from('workshop_recording_candidates').insert(rows);
    if (error) throw error;
  }

  await writeAudit(supabase, actorEmail, 'admin_workshop_recordings_fetched', workshop, { candidateCount: rows.length, zoomAccount: account });
  return { candidates: rows, count: rows.length, workshop };
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

async function cancelMeeting(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const workshopId = requireText(payload.workshopId, 'Workshop row ID is required.');
  const workshop = await getWorkshopById(supabase, workshopId);
  const account = normalizeZoomAccount(workshop.zoom_account);
  const zoomMeetingId = workshop.zoom_id ? String(workshop.zoom_id).trim() : '';

  if (zoomMeetingId) {
    try {
      await zoomRequest(account, `/meetings/${encodeURIComponent(zoomMeetingId)}`, { method: 'DELETE' });
    } catch (error) {
      const zoomError = error instanceof ZoomApiError ? error : null;
      const isAlreadyGone = zoomError?.status === 404 || String(zoomError?.code ?? '') === '3001';
      const isMissingDeleteScope = zoomError?.message.toLowerCase().includes('scopes') && zoomError.message.toLowerCase().includes('meeting:delete');
      if (isMissingDeleteScope) throw new Error('Zoom meeting delete permission is missing. Add meeting:delete scope to the Zoom Server-to-Server OAuth app, then retry.');
      if (!isAlreadyGone) throw error;
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
    zoomAccount: account,
    zoomId: zoomMeetingId || null
  });
  return data;
}

async function publishRecording(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: WorkshopPayload) {
  const candidateId = requireText(payload.candidateId, 'Recording candidate ID is required.');
  const { data: candidate, error: candidateError } = await supabase.from('workshop_recording_candidates').select('*').eq('id', candidateId).single();
  if (candidateError) throw candidateError;
  const playUrl = ensureHttpUrl(candidate.play_url);
  if (!playUrl) throw new Error('Selected recording candidate does not have a playable URL.');

  const { data: workshop, error: workshopError } = await supabase
    .from('workshops')
    .update({
      updated_at: new Date().toISOString(),
      zoom_recording_url: playUrl
    })
    .eq('workshop_id', candidate.workshop_id)
    .select('*')
    .single();
  if (workshopError) throw workshopError;

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
    if (payload.action === 'fetch-recordings') return jsonResponse(await fetchRecordings(supabase, admin.email, payload));
    if (payload.action === 'publish-recording') return jsonResponse(await publishRecording(supabase, admin.email, payload));

    return jsonResponse({ error: 'Unsupported Zoom meeting action.' }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Zoom meeting request failed.' }, 400);
  }
});
