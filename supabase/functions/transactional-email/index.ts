import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

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
  'https://staging.skilledsapiens.com/';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

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

function fillVars(template: unknown, vars: JsonRecord) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
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
  return 'https://staging.skilledsapiens.com/';
}

function normalizeStudentRedirectUrl(value: unknown) {
  const base = normalizePortalUrl(value);
  try {
    const url = new URL(base);
    url.searchParams.set('reset_role', 'student');
    return url.toString();
  } catch (_err) {
    return 'https://staging.skilledsapiens.com/?reset_role=student';
  }
}

async function assertPublicCaller(req: Request) {
  const apikey = req.headers.get('apikey') || '';
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!anonKey || (apikey !== anonKey && bearer !== anonKey)) {
    throw new Error('Invalid transactional email caller.');
  }
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

async function passwordSetupLink(student: JsonRecord, redirectUrl: string) {
  let link = await generateAuthActionLink('invite', student, redirectUrl);
  let mode = 'invite';
  if (link.status === 'existing') {
    link = await generateAuthActionLink('recovery', student, redirectUrl);
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

  const redirectUrl = normalizeStudentRedirectUrl(payload.redirect_url || payload.redirectUrl);
  const { actionLink, mode } = await passwordSetupLink(student, redirectUrl);
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
  const subject = fillVars(template?.subject || fallbackSubject, vars);
  const renderedBody = fillVars(template?.body || fallbackBody, vars);
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') throw new Error('POST is required.');
    await assertPublicCaller(req);
    const payload = asRecord(await req.json());
    const action = text(payload.action);
    if (action === 'sendSupabaseStudentPasswordSetup') {
      return json(200, await handlePasswordSetup(payload));
    }
    throw new Error('Unknown transactional email action: ' + action);
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
