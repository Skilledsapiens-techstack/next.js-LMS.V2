import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const brevoApiKey = Deno.env.get('BREVO_API_KEY') || '';
const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') || 'updates@skilledsapiens.com';
const senderName = Deno.env.get('BREVO_SENDER_NAME') || 'Skilled Sapiens';

const corsHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function json(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function text(value: unknown) {
  return String(value || '').trim();
}

function escHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleForEvent(event: string, ticket: JsonRecord) {
  const id = text(ticket.ticket_id) || 'Support ticket';
  if (event === 'ticket_created') return `${id}: support ticket received`;
  if (event === 'admin_reply') return `${id}: support team replied`;
  if (event === 'student_reply') return `${id}: student replied`;
  if (event === 'status_changed') return `${id}: status updated to ${text(ticket.status)}`;
  return `${id}: support update`;
}

function htmlForEvent(event: string, ticket: JsonRecord, message: JsonRecord | null) {
  const body = text(message?.body) || text(ticket.description);
  return `<p>Hi,</p>
<p>There is an update on support ticket <strong>${escHtml(ticket.ticket_id)}</strong>.</p>
<p><strong>Subject:</strong> ${escHtml(ticket.subject)}<br>
<strong>Category:</strong> ${escHtml(ticket.category_name)}<br>
<strong>Priority:</strong> ${escHtml(ticket.priority)}<br>
<strong>Status:</strong> ${escHtml(ticket.status)}</p>
${body ? `<p><strong>Latest message:</strong><br>${escHtml(body).replace(/\n/g, '<br>')}</p>` : ''}
<p>Please open the LMS portal to review or respond.</p>
<p>Regards,<br>${escHtml(senderName)}</p>`;
}

async function verifyCaller(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Missing authorization token.');
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid support notification session.');
  return data.user;
}

async function adminEmailsFromSettings() {
  const { data: setting } = await admin
    .from('support_settings')
    .select('setting_value')
    .eq('setting_key', 'admin_notification_emails')
    .maybeSingle();
  const configured = Array.isArray(setting?.setting_value)
    ? setting.setting_value.map(normalizeEmail).filter(Boolean)
    : [];
  if (configured.length) return [...new Set(configured)];

  const { data: admins } = await admin
    .from('admin_users')
    .select('email')
    .eq('status', 'active');
  return [...new Set((admins || []).map((row) => normalizeEmail(row.email)).filter(Boolean))];
}

async function sendBrevo(toEmails: string[], subject: string, htmlContent: string, tags: string[]) {
  const to = [...new Set(toEmails.map(normalizeEmail).filter(Boolean))].map((email) => ({ email }));
  if (!to.length) return { skipped: true, reason: 'no_recipients' };
  if (!brevoApiKey) return { skipped: true, reason: 'BREVO_API_KEY missing' };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to,
      subject,
      htmlContent,
      textContent: htmlContent.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim(),
      tags,
    }),
  });
  const body = await response.text();
  let parsed: JsonRecord = {};
  try { parsed = body ? asRecord(JSON.parse(body)) : {}; } catch (_err) { parsed = { raw: body }; }
  if (!response.ok) throw new Error(`Brevo send failed (${response.status}): ${body.slice(0, 500)}`);
  return { messageId: text(parsed.messageId), recipients: to.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    await verifyCaller(req);
    const payload = asRecord(await req.json());
    const event = text(payload.event);
    const ticketId = text(payload.ticket_id);
    const messageId = text(payload.message_id);
    if (!event || !ticketId) throw new Error('event and ticket_id are required.');

    const { data: ticket, error: ticketError } = await admin
      .from('support_tickets')
      .select('*')
      .or(`id.eq.${ticketId},ticket_id.eq.${ticketId}`)
      .maybeSingle();
    if (ticketError || !ticket) throw new Error(ticketError?.message || 'Support ticket not found.');

    let message: JsonRecord | null = null;
    if (messageId) {
      const { data } = await admin
        .from('support_ticket_messages')
        .select('*')
        .eq('id', messageId)
        .maybeSingle();
      message = data || null;
    }

    const adminRecipients = await adminEmailsFromSettings();
    const studentEmail = normalizeEmail(ticket.student_email);
    const recipients = event === 'ticket_created'
      ? [studentEmail, ...adminRecipients]
      : event === 'student_reply'
        ? adminRecipients
        : [studentEmail];
    const subject = titleForEvent(event, ticket);
    const htmlContent = htmlForEvent(event, ticket, message);
    const delivery = await sendBrevo(recipients, subject, htmlContent, ['lms', 'support', event]);

    try {
      await admin.from('email_queue').insert({
        email_key: crypto.randomUUID(),
        category: 'transactional',
        provider: 'brevo',
        status: delivery.messageId ? 'sent' : 'dry_run',
        recipient_email: recipients[0] || '',
        subject,
        params: { event, ticket_id: ticket.ticket_id, recipients, provider_message_id: delivery.messageId || null },
        tags: ['support', event],
        related_entity_type: 'support_ticket',
        related_entity_id: ticket.id,
        scheduled_at: new Date().toISOString(),
        sent_at: delivery.messageId ? new Date().toISOString() : null,
        failure_message: delivery.skipped ? delivery.reason : null,
      });
    } catch (_err) {
      // Email delivery should not be reported as failed only because queue logging is stricter than the support payload.
    }

    return json(200, { ok: true, delivery });
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
