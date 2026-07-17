import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AdminStudentAction = 'backfill-auth-links' | 'invite-health' | 'status-summary' | 'resend-invite';

type AdminStudentPayload = {
  action: AdminStudentAction;
  emails?: string[];
  studentIds?: string[];
};

type AdminRole = 'admin' | 'moderator' | 'super_admin';
type AuthMatchSource = 'linked' | 'email' | 'multiple' | 'none';

const AUTH_INVITE_COOLDOWN_MS = 60_000;

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function text(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return Array.from(new Set(value.map((entry) => text(entry)).filter(Boolean)));
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function authEmailRowTimestamp(row: Record<string, unknown>) {
  return ['sent_at', 'created_at', 'updated_at', 'scheduled_at'].reduce((latest, key) => {
    const value = Date.parse(text(row[key]));
    return Number.isFinite(value) ? Math.max(latest, value) : latest;
  }, 0);
}

function isAuthEmailRow(row: Record<string, unknown>) {
  const category = text(row.category).toLowerCase();
  const templateKey = text(row.template_key).toLowerCase();
  const tags = stringList(row.tags).map((tag) => tag.toLowerCase());
  return category === 'auth' || templateKey === 'portal_invite' || templateKey === 'portal_password_reset' || tags.includes('lms-auth') || tags.includes('portal-invite');
}

async function enforceInviteCooldown(supabase: ReturnType<typeof createClient>, email: string) {
  const cutoffMs = Date.now() - AUTH_INVITE_COOLDOWN_MS;
  const { data, error } = await supabase
    .from('email_queue')
    .select('category,created_at,scheduled_at,sent_at,tags,template_key,updated_at')
    .eq('recipient_email', email)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(`Unable to verify recent invite activity: ${error.message}`);

  const recent = (data ?? [])
    .map((row) => row as Record<string, unknown>)
    .find((row) => isAuthEmailRow(row) && authEmailRowTimestamp(row) >= cutoffMs);
  if (recent) {
    throw new Error('A password setup email was sent recently. Please wait one minute before sending another fresh link.');
  }
}

function hasPermission(role: AdminRole, permission: 'admin.students.invite' | 'admin.students.manage' | 'admin.students.view') {
  if (role === 'super_admin') return true;
  if (role === 'admin') return true;
  return permission === 'admin.students.view';
}

function requiredPermission(action: AdminStudentAction) {
  if (action === 'status-summary' || action === 'invite-health') return 'admin.students.view' as const;
  if (action === 'resend-invite') return 'admin.students.invite' as const;
  return 'admin.students.manage' as const;
}

async function getActiveAdmin(supabase: ReturnType<typeof createClient>, authorization: string) {
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Missing access token.');

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.email) throw new Error('Invalid session.');

  const email = userData.user.email.toLowerCase();
  const { data: admins, error: adminError } = await supabase
    .from('admin_users')
    .select('id,email,status,role,auth_user_id')
    .or(`auth_user_id.eq.${userData.user.id},email.eq.${email}`)
    .limit(2);

  if (adminError) throw adminError;
  const admin = (admins ?? []).find((row) => row.auth_user_id === userData.user.id) ?? (admins ?? []).find((row) => String(row.email).toLowerCase() === email);
  if (!admin || admin.status !== 'active') throw new Error('Active admin access is required.');

  return { email, id: userData.user.id, role: String(admin.role ?? 'admin') as AdminRole };
}

async function listAuthUsersByStudent(supabase: ReturnType<typeof createClient>, emails: string[], studentIds: string[]) {
  const usersByEmail = new Map<string, Record<string, unknown>>();
  const linkedByEmail = new Map<string, boolean>();
  const sourceByEmail = new Map<string, AuthMatchSource>();
  const countByEmail = new Map<string, number>();

  const studentLookup = studentIds.length > 0
    ? supabase.from('students').select('id,email,auth_user_id').in('id', studentIds).limit(500)
    : supabase.from('students').select('id,email,auth_user_id').in('email', emails).limit(500);
  const { data: students, error } = await studentLookup;
  if (error) throw error;

  for (const student of students ?? []) {
    const authUserId = typeof student.auth_user_id === 'string' ? student.auth_user_id : '';
    const email = normalizeEmail(student.email);
    if (!authUserId || !email) continue;
    const { data, error: userError } = await supabase.auth.admin.getUserById(authUserId);
    if (userError || !data.user) continue;
    const user = data.user as unknown as Record<string, unknown>;
    const existing = usersByEmail.get(email);
    const existingLastSignInAt = typeof existing?.last_sign_in_at === 'string' ? existing.last_sign_in_at : '';
    const nextLastSignInAt = typeof user.last_sign_in_at === 'string' ? user.last_sign_in_at : '';
    if (!existing || (!existingLastSignInAt && nextLastSignInAt)) {
      usersByEmail.set(email, user);
      linkedByEmail.set(email, true);
      sourceByEmail.set(email, 'linked');
      countByEmail.set(email, 1);
    }
  }

  const unlinkedEmails = emails.filter((email) => email && !usersByEmail.has(email));
  if (unlinkedEmails.length > 0) {
    const usersByUnlinkedEmail = await findAuthUsersByEmail(supabase, unlinkedEmails);
    for (const email of unlinkedEmails) {
      const users = usersByUnlinkedEmail.get(email) ?? [];
      if (users.length === 0) {
        sourceByEmail.set(email, 'none');
        countByEmail.set(email, 0);
        continue;
      }
      if (users.length > 1) {
        sourceByEmail.set(email, 'multiple');
        countByEmail.set(email, users.length);
        continue;
      }
      usersByEmail.set(email, users[0]);
      linkedByEmail.set(email, false);
      sourceByEmail.set(email, 'email');
      countByEmail.set(email, 1);
    }
  }

  return { countByEmail, linkedByEmail, sourceByEmail, usersByEmail };
}

async function getStatusSummary(supabase: ReturnType<typeof createClient>, payload: AdminStudentPayload) {
  const emails = uniqueStrings(payload.emails ?? []).map(normalizeEmail).filter(Boolean).slice(0, 500);
  const studentIds = uniqueStrings(payload.studentIds ?? []).slice(0, 500);
  if (emails.length === 0) return { statuses: [] };

  const [authLookup, inviteResult] = await Promise.all([
    listAuthUsersByStudent(supabase, emails, studentIds),
    supabase
      .from('email_queue')
      .select('recipient_email,status,failure_message,sent_at,updated_at,created_at')
      .in('recipient_email', emails)
      .contains('tags', ['portal-invite'])
      .order('created_at', { ascending: false })
      .limit(2000)
  ]);

  if (inviteResult.error) throw inviteResult.error;

  const latestInviteByEmail = new Map<string, Record<string, unknown>>();
  (inviteResult.data ?? []).forEach((invite) => {
    const email = normalizeEmail(invite.recipient_email);
    if (email && !latestInviteByEmail.has(email)) latestInviteByEmail.set(email, invite);
  });

  return {
    statuses: emails.map((email) => {
      const user = authLookup.usersByEmail.get(email);
      const invite = latestInviteByEmail.get(email);
      const authMatchCount = authLookup.countByEmail.get(email) ?? (user ? 1 : 0);
      const authMatchSource = authLookup.sourceByEmail.get(email) ?? (user ? 'linked' : 'none');
      return {
        authAccountExists: Boolean(user) || authMatchCount > 0,
        authLinked: authLookup.linkedByEmail.get(email) ?? false,
        authMatchCount,
        authMatchSource,
        email,
        emailConfirmedAt: (user?.email_confirmed_at as string | undefined) ?? null,
        inviteCreatedAt: (invite?.created_at as string | undefined) ?? null,
        inviteError: (invite?.failure_message as string | undefined) ?? null,
        inviteSentAt: (invite?.sent_at as string | undefined) ?? null,
        inviteStatus: (invite?.status as string | undefined) ?? null,
        inviteUpdatedAt: (invite?.updated_at as string | undefined) ?? null,
        lastSignInAt: (user?.last_sign_in_at as string | undefined) ?? null
      };
    })
  };
}

async function processQueuedStudentEmail(authorization: string, queueId: string) {
  if (!queueId) throw new Error('Queued email id is missing.');
  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/transactional-email`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'processQueuedStudentEmail',
      queueId
    })
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof body.error === 'string') {
    throw new Error(typeof body.error === 'string' ? body.error : `Email delivery failed with status ${response.status}.`);
  }
}

async function queueInvite(supabase: ReturnType<typeof createClient>, authorization: string, actorEmail: string, student: Record<string, unknown>) {
  const email = normalizeEmail(student.email);
  if (!email) throw new Error('Student email is missing.');
  await enforceInviteCooldown(supabase, email);

  const queueRow = {
    category: 'auth',
    created_by: actorEmail,
    params: {
      cohort: student.cohort_name ?? null,
      program: student.program_name ?? null,
      student_id: student.student_id ?? student.id,
      student_name: student.full_name ?? email
    },
    recipient_email: email,
    recipient_name: student.full_name ?? null,
    related_entity_id: String(student.id ?? ''),
    related_entity_type: 'student',
    status: 'queued',
    subject: 'Create your Skilled Sapiens LMS password',
    tags: ['lms', 'lms-auth', 'portal-invite'],
    template_key: 'portal_invite'
  };

  const { data, error } = await supabase.from('email_queue').insert(queueRow).select('*').single();
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    action: 'admin_student_invite_queued',
    actor_email: actorEmail,
    actor_role: 'admin',
    details: { email_queue_id: data.id, template_key: 'portal_invite' },
    entity_id: String(student.id ?? ''),
    entity_type: 'student',
    status: 'success'
  });

  await processQueuedStudentEmail(authorization, String(data.id ?? ''));
}

async function resendInvite(supabase: ReturnType<typeof createClient>, authorization: string, actorEmail: string, payload: AdminStudentPayload) {
  const studentIds = uniqueStrings(payload.studentIds ?? []).slice(0, 500);
  if (studentIds.length === 0) throw new Error('Select at least one student.');

  const { data: students, error } = await supabase.from('students').select('*').in('id', studentIds).limit(500);
  if (error) throw error;

  const rows: Array<{ email?: string; error?: string; status: 'success' | 'failed'; studentId: string }> = [];
  const studentsById = new Map((students ?? []).map((student) => [String(student.id), student]));

  for (const studentId of studentIds) {
    const student = studentsById.get(studentId);
    if (!student) {
      rows.push({ error: 'Student not found.', status: 'failed', studentId });
      continue;
    }

    try {
      await queueInvite(supabase, authorization, actorEmail, student);
      rows.push({ email: normalizeEmail(student.email), status: 'success', studentId });
    } catch (error) {
      rows.push({ email: normalizeEmail(student.email), error: error instanceof Error ? error.message : 'Invite delivery failed.', status: 'failed', studentId });
    }
  }

  const failed = rows.filter((row) => row.status === 'failed').length;
  return { failed, queued: false, rows, sent: rows.length - failed, updated: rows.length - failed };
}

async function findAuthUsersByEmail(supabase: ReturnType<typeof createClient>, targetEmails: string[]) {
  const remaining = new Set(targetEmails);
  const usersByEmail = new Map<string, Array<Record<string, unknown>>>();
  let page = 1;
  const perPage = 1000;

  while (remaining.size > 0 && page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    for (const user of data.users ?? []) {
      const email = normalizeEmail(user.email);
      if (!remaining.has(email)) continue;
      const existing = usersByEmail.get(email) ?? [];
      existing.push(user as unknown as Record<string, unknown>);
      usersByEmail.set(email, existing);
    }

    for (const email of targetEmails) {
      if ((usersByEmail.get(email)?.length ?? 0) > 0) remaining.delete(email);
    }

    if (!data.users || data.users.length < perPage) break;
    page += 1;
  }

  return usersByEmail;
}

async function backfillAuthLinks(supabase: ReturnType<typeof createClient>, actorEmail: string, payload: AdminStudentPayload) {
  const studentIds = uniqueStrings(payload.studentIds ?? []).slice(0, 500);
  if (studentIds.length === 0) throw new Error('Select at least one student.');

  const { data: students, error } = await supabase.from('students').select('id,email,full_name,auth_user_id').in('id', studentIds).limit(500);
  if (error) throw error;

  const emails = uniqueStrings((students ?? []).map((student) => normalizeEmail(student.email)));
  const usersByEmail = await findAuthUsersByEmail(supabase, emails);
  const rows: Array<{ email?: string; error?: string; status: 'linked' | 'skipped' | 'failed'; studentId: string }> = [];

  for (const student of students ?? []) {
    const studentId = String(student.id ?? '');
    const email = normalizeEmail(student.email);
    const existingAuthUserId = typeof student.auth_user_id === 'string' ? student.auth_user_id : '';
    const users = usersByEmail.get(email) ?? [];

    if (!studentId || !email) {
      rows.push({ error: 'Student id or email missing.', status: 'failed', studentId });
      continue;
    }
    if (existingAuthUserId) {
      rows.push({ email, status: 'skipped', studentId });
      continue;
    }
    if (users.length === 0) {
      rows.push({ email, error: 'No matching auth account found.', status: 'skipped', studentId });
      continue;
    }
    if (users.length > 1) {
      rows.push({ email, error: 'Multiple auth accounts matched this email.', status: 'failed', studentId });
      continue;
    }

    const authUserId = String(users[0].id ?? '');
    if (!authUserId) {
      rows.push({ email, error: 'Matched auth account is missing an id.', status: 'failed', studentId });
      continue;
    }

    const { data: conflictingStudents, error: conflictError } = await supabase.from('students').select('id,email').eq('auth_user_id', authUserId).neq('id', studentId).limit(1);
    if (conflictError) throw conflictError;
    if ((conflictingStudents ?? []).length > 0) {
      rows.push({ email, error: 'Auth account is already linked to another student.', status: 'failed', studentId });
      continue;
    }

    const { error: updateError } = await supabase.from('students').update({ auth_user_id: authUserId, updated_at: new Date().toISOString() }).eq('id', studentId);
    if (updateError) {
      rows.push({ email, error: updateError.message, status: 'failed', studentId });
      continue;
    }

    await supabase.from('audit_logs').insert({
      action: 'admin_student_auth_linked',
      actor_email: actorEmail,
      actor_role: 'admin',
      details: { auth_user_id: authUserId },
      entity_id: studentId,
      entity_type: 'student',
      status: 'success'
    });
    rows.push({ email, status: 'linked', studentId });
  }

  const linked = rows.filter((row) => row.status === 'linked').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  const skipped = rows.filter((row) => row.status === 'skipped').length;
  return { failed, linked, rows, skipped };
}

async function getInviteHealth(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('email_queue')
    .select('status,failure_message,created_at,updated_at')
    .contains('tags', ['portal-invite'])
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const counts = (data ?? []).reduce<Record<string, number>>((summary, row) => {
    const status = String(row.status ?? 'unknown');
    summary[status] = (summary[status] ?? 0) + 1;
    return summary;
  }, {});
  const latest = data?.[0];
  const failure = (data ?? []).find((row) => row.failure_message);

  return {
    counts,
    latestAt: latest?.updated_at ?? latest?.created_at ?? null,
    latestFailure: failure?.failure_message ?? null,
    total: data?.length ?? 0
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Admin students function is not configured.');
    const authorization = request.headers.get('Authorization') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const admin = await getActiveAdmin(supabase, authorization);
    const payload = (await request.json().catch(() => ({}))) as AdminStudentPayload;
    const permission = requiredPermission(payload.action);
    if (!hasPermission(admin.role, permission)) throw new Error('This admin role is not allowed to perform this student action.');

    if (payload.action === 'backfill-auth-links') return jsonResponse(await backfillAuthLinks(supabase, admin.email, payload));
    if (payload.action === 'invite-health') return jsonResponse(await getInviteHealth(supabase));
    if (payload.action === 'status-summary') return jsonResponse(await getStatusSummary(supabase, payload));
    if (payload.action === 'resend-invite') return jsonResponse(await resendInvite(supabase, authorization, admin.email, payload));

    return jsonResponse({ error: 'Unsupported admin students action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin students action failed.';
    return jsonResponse({ error: message }, 400);
  }
});
