import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;
type AdminPermission = 'admin.email.manage' | 'admin.students.invite';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const brevoApiKey = Deno.env.get('BREVO_API_KEY') || '';
const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') || 'updates@skilledsapiens.com';
const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'Skilled Sapiens';
const portalUrlFallback =
  Deno.env.get('LMS_PORTAL_URL') ||
  Deno.env.get('PUBLIC_SITE_URL') ||
  Deno.env.get('SITE_URL') ||
  'https://login.skilledsapiens.com/login';
const DAILY_EMAIL_LIMIT = 300;
const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

type EmailRecipient = {
  email: string;
  name: string;
  relatedId: string;
  relatedType: string;
  vars: JsonRecord;
};

type RecipientFilters = {
  authInviteStatus: string;
  cohortName: string;
  collegeName: string;
  educationYear: string;
  liveProjectRoleId: string;
  onboardingDateFrom: string;
  onboardingDateTo: string;
  paidAccessStatus: string;
  programKey: string;
};

function json(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function uniqueText(values: unknown[]) {
  const seen = new Set<string>();
  const items: string[] = [];
  values.forEach((value) => {
    const item = text(value);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  });
  return items;
}

function splitTextList(value: unknown) {
  return text(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanProgramNames(values: string[], programNameByKey: Map<string, string>) {
  return uniqueText(values).filter((value) => {
    const key = value.toLowerCase();
    const resolvedName = programNameByKey.get(key);
    return !resolvedName || resolvedName.toLowerCase() === key;
  });
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

function escHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(value: unknown) {
  return '<p>' + escHtml(value).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

function looksLikeHtml(value: unknown) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function sanitizeAdminHtml(value: unknown) {
  return String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(["']).*?\1/gi, '')
    .replace(/\son\w+=\S+/gi, '')
    .replace(/\s(href|src)=(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

function richPlainTextToHtml(value: unknown, options: { linkLabels?: Record<string, string>; buttonUrls?: string[] } = {}) {
  const raw = String(value || '');
  const linkLabels = options.linkLabels || {};
  const buttonUrls = new Set(options.buttonUrls || []);
  const urlPattern = /https?:\/\/[^\s<>"')]+/g;
  let cursor = 0;
  const parts: string[] = [];

  raw.replace(urlPattern, (match, offset) => {
    parts.push(escHtml(raw.slice(cursor, offset)));
    const cleanUrl = match.replace(/[.,;:!?]+$/g, '');
    const trailing = match.slice(cleanUrl.length);
    const label = linkLabels[cleanUrl] || 'Open Link';
    const classlessStyle = buttonUrls.has(cleanUrl)
      ? 'display:inline-block;background:#df302b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;'
      : 'color:#df302b;font-weight:700;text-decoration:underline;';
    parts.push('<a href="' + escHtml(cleanUrl) + '" style="' + classlessStyle + '">' + escHtml(label) + '</a>' + escHtml(trailing));
    cursor = offset + match.length;
    return match;
  });

  parts.push(escHtml(raw.slice(cursor)));
  return '<p>' + parts.join('').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

function adminEmailBodyToHtml(value: unknown) {
  if (looksLikeHtml(value)) return sanitizeAdminHtml(value);
  return richPlainTextToHtml(value);
}

function htmlToPlainText(value: unknown) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function formatTemplateValue(value: unknown, htmlMode: boolean) {
  const raw = value === undefined || value === null ? '' : String(value);
  if (!htmlMode) return raw;
  return escHtml(raw).replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
}

function fillVars(template: unknown, vars: JsonRecord, options: { html?: boolean } = {}) {
  const htmlMode = options.html === true;
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    return formatTemplateValue(value, htmlMode);
  });
}

function portalUrlFromRedirect(redirectUrl: string) {
  if (/^https?:\/\//i.test(redirectUrl)) return redirectUrl.split(/[?#]/)[0];
  return normalizePortalUrl(redirectUrl).split(/[?#]/)[0];
}

function normalizePortalUrl(value: unknown) {
  const raw = text(value);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^https?:\/\//i.test(portalUrlFallback)) return portalUrlFallback;
  return 'https://login.skilledsapiens.com/login';
}

function normalizeStudentRedirectUrl(value: unknown, intent: 'create' | 'forgot' = 'create') {
  const base = normalizePortalUrl(value);
  try {
    const url = new URL(base);
    url.pathname = '/login';
    url.searchParams.set('mode', 'recovery');
    url.searchParams.set('intent', intent);
    url.searchParams.set('portal', 'student');
    url.searchParams.delete('reset_role');
    return url.toString();
  } catch (_err) {
    return `https://login.skilledsapiens.com/login?mode=recovery&intent=${intent}&portal=student`;
  }
}

async function assertPublicCaller(req: Request) {
  if (req.method !== 'POST') throw new Error('POST is required.');
}

function adminHasPermission(role: string, permission: AdminPermission) {
  if (role === 'super_admin') return true;
  if (role === 'admin') return permission === 'admin.students.invite';
  return false;
}

async function assertAdminCaller(req: Request, permission: AdminPermission) {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer || bearer === anonKey) throw new Error('Admin session is required.');

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(bearer);
  const email = normalizeEmail(userData.user?.email);
  if (userError || !userData.user?.id || !email) throw new Error('Admin session is invalid.');

  const { data, error } = await admin
    .from('admin_users')
    .select('id,email,status,role,auth_user_id,full_name')
    .or(`auth_user_id.eq.${userData.user.id},email.eq.${email}`)
    .limit(2);
  if (error) throw new Error(error.message);
  const row = (data || []).find((item) => item.auth_user_id === userData.user?.id) || (data || []).find((item) => normalizeEmail(item.email) === email);
  if (!row || row.status !== 'active') throw new Error('Active admin access is required.');
  if (!adminHasPermission(text(row.role, 'admin'), permission)) throw new Error('This admin role is not allowed to send this email.');
  return asRecord(row);
}

async function enforceCooldown(email: string) {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await admin
    .from('email_queue')
    .select('id')
    .eq('recipient_email', email)
    .eq('category', 'auth')
    .gte('created_at', cutoff)
    .limit(1);
  if (!error && data && data.length) {
    throw new Error('A setup email was requested recently. Please wait a minute before trying again.');
  }
}

async function activeStudentByEmail(email: string) {
  const { data, error } = await admin
    .from('students')
    .select('id,student_id,email,full_name,active,auth_user_id')
    .eq('email', email)
    .eq('active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asRecord(data) : null;
}

async function generateAuthActionLink(type: 'invite' | 'recovery', student: JsonRecord, redirectUrl: string): Promise<JsonRecord> {
  const payload: JsonRecord = {
    type,
    email: normalizeEmail(student.email),
    data: {
      full_name: text(student.full_name),
      student_id: text(student.student_id),
    },
  };
  if (/^https?:\/\//i.test(redirectUrl)) payload.redirect_to = redirectUrl;

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text();
  let body: JsonRecord = {};
  try { body = bodyText ? asRecord(JSON.parse(bodyText)) : {}; } catch (_err) { body = { raw: bodyText }; }
  if (response.ok && body.action_link) return { status: 'generated', actionLink: text(body.action_link), type };
  if (/already|registered|exists/i.test(bodyText)) return { status: 'existing', message: bodyText.slice(0, 300), type };
  return { status: 'failed', message: bodyText.slice(0, 300) || `Supabase link generation returned ${response.status}`, type };
}

async function passwordSetupLink(student: JsonRecord, createRedirectUrl: string, recoveryRedirectUrl?: string) {
  let link = await generateAuthActionLink('invite', student, createRedirectUrl);
  let mode = 'invite';
  if (link.status === 'existing') {
    link = await generateAuthActionLink('recovery', student, recoveryRedirectUrl || createRedirectUrl);
    mode = 'recovery';
  }
  if (link.status !== 'generated') {
    throw new Error(link.message || 'Supabase could not generate a password setup link.');
  }
  return { actionLink: text(link.actionLink), mode };
}

async function emailTemplateByKey(templateKey: string) {
  if (!templateKey) return null;
  const { data, error } = await admin
    .from('email_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asRecord(data) : null;
}

async function studentsByEmails(emails: string[]) {
  if (emails.length === 0) return new Map<string, JsonRecord>();
  const { data, error } = await admin
    .from('students')
    .select('id,student_id,email,full_name,active,auth_user_id,cohort_name,college_name,duration,live_project_role_ids,onboarding_mail_status,program_name,project_start_date,track_role_ids,you_are_from')
    .in('email', emails)
    .limit(Math.min(emails.length, 1000));
  if (error) throw new Error(error.message);
  const enriched = await enrichStudentsWithCohortDetails((data || []).map(asRecord));
  return new Map(enriched.map((row) => [normalizeEmail(row.email), row]));
}

async function studentsForCohorts(cohortNames: string[]) {
  if (cohortNames.length === 0) return [];
  const { data: links, error: linkError } = await admin
    .from('student_cohorts')
    .select('student_id,cohort_name')
    .in('cohort_name', cohortNames)
    .limit(10000);
  if (linkError) throw new Error(linkError.message);
  const studentIds = Array.from(new Set((links || []).map((row) => text(row.student_id)).filter(Boolean))).slice(0, 1000);
  if (studentIds.length === 0) return [];

  const { data: students, error: studentError } = await admin
    .from('students')
    .select('id,student_id,email,full_name,active,auth_user_id,cohort_name,college_name,duration,live_project_role_ids,onboarding_mail_status,program_name,project_start_date,track_role_ids,you_are_from')
    .eq('active', true)
    .in('id', studentIds)
    .limit(1000);
  if (studentError) throw new Error(studentError.message);
  return enrichStudentsWithCohortDetails((students || []).map(asRecord));
}

async function activeLmsStudents() {
  const { data, error } = await admin
    .from('students')
    .select('id,student_id,email,full_name,active,auth_user_id,cohort_name,college_name,duration,live_project_role_ids,onboarding_mail_status,program_name,project_start_date,track_role_ids,you_are_from')
    .eq('active', true)
    .limit(10000);
  if (error) throw new Error(error.message);
  return enrichStudentsWithCohortDetails((data || []).map(asRecord));
}

async function cohortsByNames(cohortNames: string[]) {
  if (cohortNames.length === 0) return [];
  const { data, error } = await admin
    .from('cohorts')
    .select('id,name,cohort_id,program_key,google_group,wa_group_name,wa_link,status')
    .in('name', cohortNames)
    .limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map(asRecord);
}

async function programsByKeys(programKeys: string[]) {
  const keys = uniqueText(programKeys.map((key) => key.toLowerCase()));
  if (keys.length === 0) return new Map<string, string>();
  const { data, error } = await admin
    .from('programs')
    .select('program_key,name,short_name')
    .in('program_key', keys)
    .limit(500);
  if (error) throw new Error(error.message);
  return new Map((data || []).map((program) => [
    text(program.program_key).toLowerCase(),
    text(program.name) || text(program.short_name) || text(program.program_key),
  ]));
}

async function enrichStudentsWithCohortDetails(students: JsonRecord[]) {
  const studentIds = students.map((student) => text(student.id)).filter(Boolean);
  if (studentIds.length === 0) return students;

  const { data: links, error: linkError } = await admin
    .from('student_cohorts')
    .select('student_id,cohort_name')
    .in('student_id', studentIds)
    .limit(20000);
  if (linkError) throw new Error(linkError.message);

  const { data: programLinks, error: programLinkError } = await admin
    .from('student_programs')
    .select('student_id,program_key')
    .in('student_id', studentIds)
    .limit(20000);
  if (programLinkError) throw new Error(programLinkError.message);

  const cohortNames = Array.from(new Set((links || []).map((row) => text(row.cohort_name)).filter(Boolean)));
  const cohorts = await cohortsByNames(cohortNames);
  const cohortByName = new Map(cohorts.map((cohort) => [text(cohort.name), cohort]));
  const programNameByKey = await programsByKeys([
    ...cohorts.map((cohort) => text(cohort.program_key)).filter(Boolean),
    ...(programLinks || []).map((link) => text(link.program_key)).filter(Boolean),
  ]);
  const linksByStudent = new Map<string, JsonRecord[]>();
  (links || []).forEach((link) => {
    const studentId = text(link.student_id);
    if (!studentId) return;
    linksByStudent.set(studentId, [...(linksByStudent.get(studentId) || []), asRecord(link)]);
  });
  const programsByStudent = new Map<string, JsonRecord[]>();
  (programLinks || []).forEach((link) => {
    const studentId = text(link.student_id);
    if (!studentId) return;
    programsByStudent.set(studentId, [...(programsByStudent.get(studentId) || []), asRecord(link)]);
  });

  return students.map((student) => {
    const studentLinks = linksByStudent.get(text(student.id)) || [];
    const studentProgramLinks = programsByStudent.get(text(student.id)) || [];
    const cohortNamesForStudent = Array.from(new Set([
      ...studentLinks.map((link) => text(link.cohort_name)).filter(Boolean),
      text(student.cohort_name),
    ].filter(Boolean)));
    const programKeys = uniqueText([
      ...studentProgramLinks.map((link) => text(link.program_key).toLowerCase()).filter(Boolean),
      ...cohortNamesForStudent.map((name) => text(cohortByName.get(name)?.program_key).toLowerCase()).filter(Boolean),
      ...splitTextList(student.program_name).map((value) => value.toLowerCase()).filter(Boolean),
    ]);
    const programNames = cleanProgramNames([
      ...studentProgramLinks.map((link) => {
        const programKey = text(link.program_key).toLowerCase();
        return programNameByKey.get(programKey) || programKey;
      }).filter(Boolean),
      ...cohortNamesForStudent.map((name) => {
        const programKey = text(cohortByName.get(name)?.program_key).toLowerCase();
        return programNameByKey.get(programKey) || programKey;
      }),
      ...splitTextList(student.program_name),
      ...cohortNamesForStudent.map((name) => text(cohortByName.get(name)?.program_key)),
    ], programNameByKey);
    const cohortDetails = cohortNamesForStudent.map((name) => {
      const cohort = cohortByName.get(name) || {};
      const programKey = text(cohort.program_key).toLowerCase();
      const programName = programNameByKey.get(programKey) || programKey;
      const bits = [
        `Cohort: ${name}`,
        programName ? `Program: ${programName}` : '',
        text(cohort.wa_group_name) ? `WhatsApp group: ${text(cohort.wa_group_name)}` : '',
        text(cohort.wa_link) ? `WhatsApp link: ${text(cohort.wa_link)}` : '',
        text(cohort.google_group) ? `Google group: ${text(cohort.google_group)}` : '',
      ].filter(Boolean);
      return bits.join('\n');
    });

    return {
      ...student,
      cohort_group_details: cohortDetails.join('\n\n'),
      cohort_names: cohortNamesForStudent,
      google_groups: cohortNamesForStudent.map((name) => text(cohortByName.get(name)?.google_group)).filter(Boolean).join('\n'),
      program_keys: programKeys,
      program_names: programNames,
      whatsapp_groups: cohortNamesForStudent.map((name) => {
        const cohort = cohortByName.get(name) || {};
        return [text(cohort.wa_group_name), text(cohort.wa_link)].filter(Boolean).join(' - ');
      }).filter(Boolean).join('\n'),
    };
  });
}

function splitEmails(value: unknown) {
  return Array.from(new Set(String(value || '')
    .split(/[\s,;]+/)
    .map((entry) => normalizeEmail(entry))
    .filter((entry) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry))));
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return Array.from(new Set(value.map((entry) => text(entry)).filter(Boolean)));
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function normalizeRecipientFilters(value: unknown): RecipientFilters {
  const record = asRecord(value);
  return {
    authInviteStatus: text(record.authInviteStatus || record.auth_invite_status),
    cohortName: text(record.cohortName || record.cohort_name),
    collegeName: text(record.collegeName || record.college_name),
    educationYear: text(record.educationYear || record.education_year),
    liveProjectRoleId: text(record.liveProjectRoleId || record.live_project_role_id),
    onboardingDateFrom: text(record.onboardingDateFrom || record.onboarding_date_from),
    onboardingDateTo: text(record.onboardingDateTo || record.onboarding_date_to),
    paidAccessStatus: text(record.paidAccessStatus || record.paid_access_status),
    programKey: text(record.programKey || record.program_key).toLowerCase(),
  };
}

function hasAnyRecipientFilter(filters: RecipientFilters) {
  return Object.values(filters).some((value) => Boolean(value && value !== 'any'));
}

function dateOnlyTimestamp(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(`${raw.slice(0, 10)}T00:00:00.000Z`);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function studentMatchesBaseFilters(student: JsonRecord, filters: RecipientFilters) {
  if (filters.programKey) {
    const programKeys = stringList(student.program_keys).map((key) => key.toLowerCase());
    if (!programKeys.includes(filters.programKey)) return false;
  }

  if (filters.cohortName) {
    const cohortNames = stringList(student.cohort_names).map((name) => name.toLowerCase());
    if (!cohortNames.includes(filters.cohortName.toLowerCase())) return false;
  }

  if (filters.collegeName && text(student.college_name).toLowerCase() !== filters.collegeName.toLowerCase()) return false;
  if (filters.educationYear && text(student.you_are_from).toLowerCase() !== filters.educationYear.toLowerCase()) return false;

  if (filters.liveProjectRoleId) {
    const roleIds = stringList(student.live_project_role_ids).map((roleId) => roleId.toLowerCase());
    if (!roleIds.includes(filters.liveProjectRoleId.toLowerCase())) return false;
  }

  const onboardingTimestamp = dateOnlyTimestamp(student.project_start_date);
  const fromTimestamp = dateOnlyTimestamp(filters.onboardingDateFrom);
  const toTimestamp = dateOnlyTimestamp(filters.onboardingDateTo);
  if (fromTimestamp !== null && (onboardingTimestamp === null || onboardingTimestamp < fromTimestamp)) return false;
  if (toTimestamp !== null && (onboardingTimestamp === null || onboardingTimestamp > toTimestamp)) return false;

  const authInviteStatus = filters.authInviteStatus;
  if (authInviteStatus && authInviteStatus !== 'any') {
    const hasAuth = Boolean(text(student.auth_user_id));
    const onboardingStatus = text(student.onboarding_mail_status).toLowerCase();
    if (authInviteStatus === 'auth_linked' && !hasAuth) return false;
    if (authInviteStatus === 'auth_missing' && hasAuth) return false;
    if (authInviteStatus === 'invite_pending' && onboardingStatus !== 'pending') return false;
    if (authInviteStatus === 'invite_sent' && onboardingStatus !== 'sent') return false;
    if (authInviteStatus === 'invite_failed' && onboardingStatus !== 'failed') return false;
    if (authInviteStatus === 'invite_skipped' && onboardingStatus !== 'skipped') return false;
    if (authInviteStatus === 'invite_dry_run' && onboardingStatus !== 'dry-run') return false;
  }

  return true;
}

async function activePaidAccessEmailSet(emails: string[]) {
  if (emails.length === 0) return new Set<string>();
  const { data, error } = await admin
    .from('paid_access')
    .select('student_email,status,expires_at')
    .eq('status', 'active')
    .limit(20000);
  if (error) throw new Error(error.message);
  const requested = new Set(emails.map(normalizeEmail).filter(Boolean));
  const now = Date.now();
  return new Set((data || [])
    .filter((row) => {
      const email = normalizeEmail(row.student_email);
      if (!requested.has(email)) return false;
      const expiresAt = text(row.expires_at);
      if (!expiresAt) return true;
      const timestamp = new Date(expiresAt).getTime();
      return Number.isNaN(timestamp) || timestamp > now;
    })
    .map((row) => normalizeEmail(row.student_email))
    .filter(Boolean));
}

async function applyRecipientFilters(students: JsonRecord[], filters: RecipientFilters) {
  if (!hasAnyRecipientFilter(filters)) return students;
  let filtered = students.filter((student) => studentMatchesBaseFilters(student, filters));

  if (filters.paidAccessStatus && filters.paidAccessStatus !== 'any') {
    const paidEmails = await activePaidAccessEmailSet(filtered.map((student) => normalizeEmail(student.email)).filter(Boolean));
    filtered = filtered.filter((student) => {
      const hasActivePaidAccess = paidEmails.has(normalizeEmail(student.email));
      return filters.paidAccessStatus === 'active' ? hasActivePaidAccess : !hasActivePaidAccess;
    });
  }

  return filtered;
}

function studentVars(student: JsonRecord, fallbackEmail = '', extra: JsonRecord = {}) {
  const email = normalizeEmail(student.email || fallbackEmail);
  const cohortNames = Array.isArray(student.cohort_names) ? student.cohort_names.map(text).filter(Boolean) : [text(student.cohort_name)].filter(Boolean);
  const programNames = Array.isArray(student.program_names) ? student.program_names.map(text).filter(Boolean) : [text(student.program_name)].filter(Boolean);
  return {
    student_name: text(student.full_name, email || 'Student'),
    student_email: email,
    student_id: text(student.student_id),
    program: programNames[0] || text(student.program_name),
    programs: programNames.join(', ') || text(student.program_name),
    cohort: cohortNames[0] || text(student.cohort_name),
    cohorts: cohortNames.join(', ') || text(student.cohort_name),
    cohort_group_details: text(student.cohort_group_details, 'Group details will be shared by your program coordinator.'),
    google_groups: text(student.google_groups),
    portal_url: portalUrlFallback,
    whatsapp_groups: text(student.whatsapp_groups),
    ...extra,
  };
}

function cohortVars(cohort: JsonRecord, extra: JsonRecord = {}) {
  return {
    cohort: text(cohort.name),
    cohorts: text(cohort.name),
    cohort_id: text(cohort.cohort_id),
    cohort_group_details: [
      text(cohort.name),
      text(cohort.wa_group_name) ? `WhatsApp: ${text(cohort.wa_group_name)}` : '',
      text(cohort.wa_link) ? `WhatsApp link: ${text(cohort.wa_link)}` : '',
      text(cohort.google_group) ? `Google Group: ${text(cohort.google_group)}` : '',
    ].filter(Boolean).join('\n'),
    google_groups: text(cohort.google_group),
    program: text(cohort.program_key),
    programs: text(cohort.program_key),
    portal_url: portalUrlFallback,
    whatsapp_groups: [text(cohort.wa_group_name), text(cohort.wa_link)].filter(Boolean).join(' - '),
    ...extra,
  };
}

function clampBatchSize(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(numeric)));
}

function istDayBounds() {
  const istOffsetMs = 330 * 60 * 1000;
  const nowIst = new Date(Date.now() + istOffsetMs);
  const startUtcMs = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - istOffsetMs;
  return {
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000).toISOString(),
    start: new Date(startUtcMs).toISOString(),
  };
}

async function sentCountToday() {
  const bounds = istDayBounds();
  const { count, error } = await admin
    .from('email_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', bounds.start)
    .lt('sent_at', bounds.end);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function sentEmailsToday(templateKey: string, category: string) {
  const bounds = istDayBounds();
  const { data, error } = await admin
    .from('email_queue')
    .select('recipient_email')
    .eq('status', 'sent')
    .eq('template_key', templateKey)
    .eq('category', category)
    .gte('sent_at', bounds.start)
    .lt('sent_at', bounds.end)
    .limit(5000);
  if (error) throw new Error(error.message);
  return new Set((data || []).map((row) => normalizeEmail(row.recipient_email)).filter(Boolean));
}

async function resolveAdminStudentCommunication(payload: JsonRecord) {
  const templateKey = text(payload.templateKey || payload.template_key);
  const template = templateKey === 'custom_blank' ? null : await emailTemplateByKey(templateKey);
  const subjectSource = text(payload.subject || template?.subject);
  const bodySource = text(payload.body || template?.body);
  const sendMode = text(payload.sendMode || payload.send_mode, 'direct');
  const cohortNames = stringList(payload.cohortNames || payload.cohort_names);
  const directEmails = splitEmails(payload.directEmails || payload.direct_emails);
  const recipientFilters = normalizeRecipientFilters(payload.recipientFilters || payload.recipient_filters);
  const params = asRecord(payload.params);
  const templateUsedKey = text(template?.template_key, templateKey || 'custom_blank');
  const category = text(template?.category || template?.phase || payload.category, 'general');
  const testMode = payload.testMode === true || payload.test_mode === true;
  const tags = Array.from(new Set(['lms', 'email-center', category, ...(testMode ? ['test'] : []), ...stringList(template?.default_tags)]));

  if (!subjectSource) throw new Error('Email subject is required.');
  if (!bodySource) throw new Error('Email body is required.');

  let recipients: EmailRecipient[] = [];

  if (sendMode === 'cohort_students') {
    if (cohortNames.length === 0) throw new Error('Select at least one cohort.');
    const students = await applyRecipientFilters(await studentsForCohorts(cohortNames), recipientFilters);
    recipients = students
      .map((student) => {
        const email = normalizeEmail(student.email);
        return { email, name: text(student.full_name, email), relatedId: text(student.id, email), relatedType: 'student', vars: studentVars(student, email, params) };
      })
      .filter((item) => item.email);
  } else if (sendMode === 'all_active_students') {
    const students = await applyRecipientFilters(await activeLmsStudents(), recipientFilters);
    recipients = students
      .map((student) => {
        const email = normalizeEmail(student.email);
        return { email, name: text(student.full_name, email), relatedId: text(student.id, email), relatedType: 'student', vars: studentVars(student, email, params) };
      })
      .filter((item) => item.email);
  } else if (sendMode === 'cohort_google_group') {
    if (cohortNames.length === 0) throw new Error('Select one cohort with a Google Group email.');
    const cohorts = await cohortsByNames(cohortNames);
    recipients = cohorts
      .map((cohort) => {
        const email = normalizeEmail(payload.googleGroupEmail || payload.google_group_email || cohort.google_group);
        return { email, name: text(cohort.name, email), relatedId: text(cohort.id, email), relatedType: 'cohort', vars: cohortVars(cohort, params) };
      })
      .filter((item) => item.email);
  } else {
    if (directEmails.length === 0) throw new Error('Add at least one email recipient.');
    const studentsByEmail = await studentsByEmails(directEmails);
    recipients = directEmails.map((email) => {
      const student = studentsByEmail.get(email) || { email };
      return { email, name: text(student.full_name, email), relatedId: text(student.id, email), relatedType: student.id ? 'student' : 'email', vars: studentVars(student, email, params) };
    });
  }

  const recipientLimit = sendMode === 'all_active_students' ? 10000 : 1000;
  recipients = Array.from(new Map(recipients.map((recipient) => [recipient.email, recipient])).values()).slice(0, recipientLimit);

  const alreadySentEmails = testMode ? new Set<string>() : await sentEmailsToday(templateUsedKey, category);
  const deliverableRecipients = recipients.filter((recipient) => !alreadySentEmails.has(recipient.email));
  const usedToday = await sentCountToday();
  const remainingToday = Math.max(0, DAILY_EMAIL_LIMIT - usedToday);
  const batchSize = clampBatchSize(payload.batchSize || payload.batch_size);
  const willSend = Math.min(deliverableRecipients.length, batchSize, remainingToday);
  const remainingAfterBatch = Math.max(0, deliverableRecipients.length - willSend);

  return {
    batchSize,
    category,
    cohortNames,
    dailyLimit: DAILY_EMAIL_LIMIT,
    deliverableRecipients,
    message: deliverableRecipients.length
      ? `${willSend} recipient${willSend === 1 ? '' : 's'} ready for this batch.`
      : 'All matching recipients already received this template today, or no deliverable recipients remain.',
    recipients,
    remainingAfterBatch,
    remainingToday,
    recipientFilters,
    sendMode,
    subjectSource,
    bodySource,
    tags,
    testMode,
    templateKey: templateUsedKey,
    usedToday,
    alreadySentToday: alreadySentEmails.size,
    willSend,
  };
}

async function handleAdminStudentCommunicationPreview(payload: JsonRecord) {
  const resolved = await resolveAdminStudentCommunication(payload);
  return {
    ok: true,
    alreadySentToday: resolved.alreadySentToday,
    batchSize: resolved.batchSize,
    dailyLimit: resolved.dailyLimit,
    deliverableRecipients: resolved.deliverableRecipients.length,
    message: resolved.message,
    previewRecipients: resolved.deliverableRecipients.slice(0, 10).map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
      relatedType: recipient.relatedType,
    })),
    recipients: resolved.recipients.length,
    remainingAfterBatch: resolved.remainingAfterBatch,
    remainingToday: resolved.remainingToday,
    templateKey: resolved.templateKey,
    usedToday: resolved.usedToday,
    willSend: resolved.willSend,
  };
}

async function handleAdminStudentCommunication(payload: JsonRecord, actor: JsonRecord) {
  const confirmed = payload.confirmed === true;
  if (!confirmed) throw new Error('Review the recipient summary and confirm before sending.');
  const resolved = await resolveAdminStudentCommunication(payload);
  const recipients = resolved.deliverableRecipients.slice(0, resolved.willSend);
  if (resolved.remainingToday <= 0) throw new Error('Daily email limit reached. Try again tomorrow.');
  if (recipients.length === 0) throw new Error('No recipients are available for this batch.');

  const results: JsonRecord[] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const subject = fillVars(resolved.subjectSource, recipient.vars);
    const renderedBody = fillVars(resolved.bodySource, recipient.vars, { html: looksLikeHtml(resolved.bodySource) });
    const htmlContent = adminEmailBodyToHtml(renderedBody);
    const textContent = htmlToPlainText(htmlContent) || renderedBody;
    try {
      const delivery = await sendBrevo(recipient.email, recipient.name, subject, htmlContent, textContent, resolved.tags);
      sent += 1;
      results.push({ email: recipient.email, status: 'sent', messageId: delivery.messageId || '' });
      await logEmailQueue({
        email_key: crypto.randomUUID(),
        template_key: resolved.templateKey,
        category: resolved.category,
        status: 'sent',
        provider: 'brevo',
        provider_message_id: delivery.messageId || null,
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        subject,
        params: recipient.vars,
        tags: resolved.tags,
        related_entity_type: recipient.relatedType,
        related_entity_id: recipient.relatedId,
        scheduled_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        failure_message: null,
        created_by: text(actor.email),
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      results.push({ email: recipient.email, status: 'failed', error: message.slice(0, 500) });
      await logEmailQueue({
        email_key: crypto.randomUUID(),
        template_key: resolved.templateKey,
        category: resolved.category,
        status: 'failed',
        provider: 'brevo',
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        subject,
        params: recipient.vars,
        tags: resolved.tags,
        related_entity_type: recipient.relatedType,
        related_entity_id: recipient.relatedId,
        scheduled_at: new Date().toISOString(),
        failure_message: message.slice(0, 500),
        created_by: text(actor.email),
      });
    }
  }

  await admin.from('audit_logs').insert({
    action: 'admin_email_center_sent',
    actor_email: text(actor.email),
    actor_role: 'admin',
    details: {
      alreadySentToday: resolved.alreadySentToday,
      batchSize: resolved.batchSize,
      category: resolved.category,
      dailyLimit: resolved.dailyLimit,
      failed,
      remainingAfterBatch: resolved.remainingAfterBatch,
      remainingToday: resolved.remainingToday,
      recipientFilters: resolved.recipientFilters,
      recipients: resolved.recipients.length,
      sendMode: resolved.sendMode,
      sent,
      templateKey: resolved.templateKey,
      usedToday: resolved.usedToday,
    },
    entity_id: resolved.templateKey,
    entity_type: 'email_center',
    status: failed > 0 ? 'partial' : 'success',
  });

  return {
    ok: failed === 0,
    alreadySentToday: resolved.alreadySentToday,
    batchSize: resolved.batchSize,
    dailyLimit: resolved.dailyLimit,
    deliverableRecipients: resolved.deliverableRecipients.length,
    failed,
    message: `Email sent to ${sent} recipient${sent === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.${resolved.remainingAfterBatch ? ` ${resolved.remainingAfterBatch} recipients remain for later batches.` : ''}`,
    recipients: resolved.recipients.length,
    remainingAfterBatch: Math.max(0, resolved.deliverableRecipients.length - sent - failed),
    remainingToday: Math.max(0, resolved.remainingToday - sent),
    results,
    sent,
    status: failed ? 'partial' : 'sent',
    templateKey: resolved.templateKey,
    usedToday: resolved.usedToday,
    willSend: resolved.willSend,
  };
}

async function sendBrevo(toEmail: string, toName: string, subject: string, htmlContent: string, textContent: string, tags: string[]): Promise<JsonRecord> {
  if (!brevoApiKey) throw new Error('BREVO_API_KEY is not configured.');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail, name: toName || undefined }],
      subject,
      htmlContent,
      textContent,
      tags,
    }),
  });
  const bodyText = await response.text();
  let body: JsonRecord = {};
  try { body = bodyText ? asRecord(JSON.parse(bodyText)) : {}; } catch (_err) { body = { raw: bodyText }; }
  if (!response.ok) throw new Error(`Brevo send failed (${response.status}): ${bodyText.slice(0, 500)}`);
  return { provider: 'brevo', messageId: text(body.messageId), recipients: 1 };
}

async function logEmailQueue(payload: JsonRecord) {
  try {
    await admin.from('email_queue').insert(payload);
  } catch (_err) {
    // Email delivery should not fail only because queue logging has a stricter schema.
  }
}

async function handlePasswordSetup(payload: JsonRecord) {
  const email = normalizeEmail(payload.email);
  if (!email) throw new Error('Enter your registered LMS email address.');

  const student = await activeStudentByEmail(email);
  if (!student) throw new Error('No active LMS student found for this email. Contact the administrator.');
  await enforceCooldown(email);

  const redirectUrl = normalizeStudentRedirectUrl(payload.redirect_url || payload.redirectUrl, 'create');
  const recoveryRedirectUrl = normalizeStudentRedirectUrl(payload.redirect_url || payload.redirectUrl, 'forgot');
  const { actionLink, mode } = await passwordSetupLink(student, redirectUrl, recoveryRedirectUrl);
  const name = text(student.full_name, 'Student') || 'Student';
  const isRecovery = mode === 'recovery';
  const templateKey = isRecovery ? 'portal_password_reset' : 'portal_invite';
  const fallbackSubject = isRecovery
    ? 'Reset your Skilled Sapiens LMS password'
    : 'Create your Skilled Sapiens LMS password';
  const fallbackBody = [
    `Hi ${name},`,
    '',
    isRecovery
      ? 'Use the secure link below to reset your Skilled Sapiens LMS password.'
      : 'Use the secure link below to create your Skilled Sapiens LMS password.',
    '',
    actionLink,
    '',
    'This link is generated by Supabase Auth and should only be used by you.',
    '',
    'If you did not request this, you can ignore this email.',
    '',
    'Skilled Sapiens',
  ].join('\n');
  const fallbackHtml = [
    `<p>Hi ${escHtml(name)},</p>`,
    `<p>${isRecovery ? 'Use the secure link below to reset your Skilled Sapiens LMS password.' : 'Use the secure link below to create your Skilled Sapiens LMS password.'}</p>`,
    `<p><a href="${escHtml(actionLink)}" style="display:inline-block;background:#df302b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">${isRecovery ? 'Reset Password' : 'Create Password'}</a></p>`,
    '<p>This link is generated by Supabase Auth and should only be used by you.</p>',
    '<p>If you did not request this, you can ignore this email.</p>',
    '<p>Skilled Sapiens</p>',
  ].join('');
  const vars = {
    student_name: name,
    student_email: email,
    action_link: actionLink,
    portal_url: portalUrlFromRedirect(redirectUrl),
  };
  const template = await emailTemplateByKey(templateKey);
  const templateUsedKey = text(template?.template_key, templateKey);
  const bodyTemplate = template?.body || fallbackBody;
  const subject = fillVars(template?.subject || fallbackSubject, vars);
  const renderedBody = fillVars(bodyTemplate, vars, { html: looksLikeHtml(bodyTemplate) });
  const portalUrl = portalUrlFromRedirect(redirectUrl);
  const htmlContent = template
    ? richPlainTextToHtml(renderedBody, {
      linkLabels: {
        [actionLink]: isRecovery ? 'Reset Password' : 'Create Password',
        [portalUrl]: 'Open LMS Portal',
      },
      buttonUrls: [actionLink],
    })
    : fallbackHtml;
  const textContent = template ? htmlToPlainText(htmlContent) || renderedBody : fallbackBody;
  const tags = ['lms', 'lms-auth', isRecovery ? 'password-reset' : 'portal-invite'];

  try {
    const delivery = await sendBrevo(email, name, subject, htmlContent, textContent, tags);
    await logEmailQueue({
      email_key: crypto.randomUUID(),
      template_key: templateUsedKey,
      category: 'auth',
      status: 'sent',
      provider: 'brevo',
      provider_message_id: delivery.messageId || null,
      recipient_email: email,
      recipient_name: name,
      subject,
      params: vars,
      tags,
      related_entity_type: 'student',
      related_entity_id: email,
      scheduled_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      failure_message: null,
    });
    return {
      ok: true,
      status: 'sent',
      mode,
      provider: delivery.provider,
      messageId: delivery.messageId || '',
      email,
      templateKey: templateUsedKey,
      templateSource: template ? 'supabase' : 'fallback',
      message: isRecovery
        ? 'A password account already exists. Password reset email sent.'
        : 'Password setup email sent. Check your inbox and spam folder.',
    };
  } catch (error) {
    await logEmailQueue({
      email_key: crypto.randomUUID(),
      template_key: templateUsedKey,
      category: 'auth',
      status: 'failed',
      provider: 'brevo',
      recipient_email: email,
      recipient_name: name,
      subject,
      params: vars,
      tags,
      related_entity_type: 'student',
      related_entity_id: email,
      scheduled_at: new Date().toISOString(),
      failure_message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    });
    throw error;
  }
}

async function processQueuedStudentEmail(payload: JsonRecord, actor: JsonRecord) {
  const queueId = text(payload.queueId || payload.queue_id);
  if (!queueId) throw new Error('Queued email id is required.');

  const { data: queueData, error: queueError } = await admin
    .from('email_queue')
    .select('*')
    .eq('id', queueId)
    .maybeSingle();
  if (queueError) throw new Error(queueError.message);
  if (!queueData) throw new Error('Queued email was not found.');

  const queue = asRecord(queueData);
  const email = normalizeEmail(queue.recipient_email);
  const templateKey = text(queue.template_key);
  if (!email) throw new Error('Queued email is missing a recipient.');
  if (!['portal_invite', 'onboarding_welcome'].includes(templateKey)) {
    throw new Error(`Queued template is not supported for student delivery: ${templateKey || 'unknown'}.`);
  }

  const students = await studentsByEmails([email]);
  const student = students.get(email) || { email, full_name: queue.recipient_name };
  const params = asRecord(queue.params);
  let vars = studentVars(student, email, params);
  let fallbackSubject = text(queue.subject, 'Skilled Sapiens LMS update');
  let fallbackBody = [
    `Hi ${text(vars.student_name, 'Student')},`,
    '',
    'Your Skilled Sapiens LMS profile has been updated.',
    '',
    text(vars.portal_url, portalUrlFallback),
    '',
    'Skilled Sapiens Team',
  ].join('\n');
  const buttonUrls: string[] = [];
  const linkLabels: Record<string, string> = {};

  if (templateKey === 'portal_invite') {
    const rawRedirectUrl = payload.redirect_url || payload.redirectUrl || params.redirect_url || params.redirectUrl;
    const redirectUrl = normalizeStudentRedirectUrl(rawRedirectUrl, 'create');
    const recoveryRedirectUrl = normalizeStudentRedirectUrl(rawRedirectUrl, 'forgot');
    const { actionLink, mode } = await passwordSetupLink(student, redirectUrl, recoveryRedirectUrl);
    const portalUrl = portalUrlFromRedirect(redirectUrl);
    vars = {
      ...vars,
      action_link: actionLink,
      portal_url: portalUrl,
    };
    fallbackSubject = mode === 'recovery'
      ? 'Reset your Skilled Sapiens LMS password'
      : 'Create your Skilled Sapiens LMS password';
    fallbackBody = [
      `Hi ${text(vars.student_name, 'Student')},`,
      '',
      mode === 'recovery'
        ? 'Use the secure link below to reset your Skilled Sapiens LMS password.'
        : 'Use the secure link below to create your Skilled Sapiens LMS password.',
      '',
      actionLink,
      '',
      'Open LMS:',
      portalUrl,
      '',
      'If you did not request this email, please ignore it.',
      '',
      'Skilled Sapiens Team',
    ].join('\n');
    buttonUrls.push(actionLink);
    linkLabels[actionLink] = mode === 'recovery' ? 'Reset Password' : 'Create Password';
    linkLabels[portalUrl] = 'Open LMS Portal';
  } else if (templateKey === 'onboarding_welcome') {
    fallbackSubject = `Welcome to Skilled Sapiens LMS, ${text(vars.student_name, 'Student')}`;
    fallbackBody = [
      `Hi ${text(vars.student_name, 'Student')},`,
      '',
      'Welcome to Skilled Sapiens. Your LMS access is now active.',
      '',
      'Your registered program(s):',
      text(vars.programs),
      '',
      'Your registered cohort(s):',
      text(vars.cohorts),
      '',
      'Cohort communication details:',
      text(vars.cohort_group_details),
      '',
      'Open your LMS portal:',
      text(vars.portal_url, portalUrlFallback),
      '',
      'Please keep these details handy for live sessions, resources, project submissions, announcements, and support.',
      '',
      'Skilled Sapiens Team',
    ].join('\n');
    linkLabels[text(vars.portal_url, portalUrlFallback)] = 'Open LMS Portal';
  }

  const template = await emailTemplateByKey(templateKey);
  const subject = fillVars(template?.subject || fallbackSubject, vars);
  const bodyTemplate = template?.body || fallbackBody;
  const renderedBody = fillVars(bodyTemplate, vars, { html: looksLikeHtml(bodyTemplate) });
  const htmlContent = richPlainTextToHtml(renderedBody, { buttonUrls, linkLabels });
  const textContent = htmlToPlainText(htmlContent) || renderedBody;
  const tags = Array.from(new Set([...stringList(queue.tags), templateKey === 'portal_invite' ? 'portal-invite' : 'onboarding']));

  try {
    const delivery = await sendBrevo(email, text(queue.recipient_name || vars.student_name, email), subject, htmlContent, textContent, tags);
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('email_queue')
      .update({
        failure_message: null,
        params: vars,
        provider: 'brevo',
        provider_message_id: delivery.messageId || null,
        sent_at: now,
        status: 'sent',
        subject,
        tags,
        updated_at: now,
      })
      .eq('id', queueId);
    if (updateError) throw new Error(updateError.message);
    await admin.from('audit_logs').insert({
      action: templateKey === 'portal_invite' ? 'admin_student_invite_sent' : 'admin_student_onboarding_mail_sent',
      actor_email: text(actor.email),
      actor_role: 'admin',
      details: { email_queue_id: queueId, provider: 'brevo', provider_message_id: delivery.messageId || null, template_key: templateKey },
      entity_id: text(queue.related_entity_id, email),
      entity_type: 'student',
      status: 'success',
    });
    return { ok: true, status: 'sent', email, messageId: delivery.messageId || '', templateKey };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    await admin
      .from('email_queue')
      .update({
        failure_message: message,
        provider: 'brevo',
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueId);
    throw new Error(message);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') throw new Error('POST is required.');
    const payload = asRecord(await req.json());
    const action = text(payload.action);
    if (action === 'sendSupabaseStudentPasswordSetup') {
      await assertPublicCaller(req);
      return json(200, await handlePasswordSetup(payload));
    }
    if (action === 'sendAdminStudentCommunication') {
      const actor = await assertAdminCaller(req, 'admin.email.manage');
      return json(200, await handleAdminStudentCommunication(payload, actor));
    }
    if (action === 'processQueuedStudentEmail') {
      const actor = await assertAdminCaller(req, 'admin.students.invite');
      return json(200, await processQueuedStudentEmail(payload, actor));
    }
    if (action === 'resolveAdminStudentCommunication') {
      await assertAdminCaller(req, 'admin.email.manage');
      return json(200, await handleAdminStudentCommunicationPreview(payload));
    }
    throw new Error('Unknown transactional email action: ' + action);
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
