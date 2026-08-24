import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const webhookSecret = Deno.env.get('BREVO_WEBHOOK_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-brevo-webhook-secret',
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

function asStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  const item = text(value);
  return item ? [item] : [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function providerMessageIdCandidates(value: unknown) {
  const raw = text(value);
  if (!raw) return [];
  const withoutAngles = raw.replace(/^<+/, '').replace(/>+$/, '');
  return uniqueStrings([raw, withoutAngles, withoutAngles ? `<${withoutAngles}>` : '']);
}

function firstValue(payload: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== null && value !== undefined && text(value)) return value;
  }
  return undefined;
}

function normalizeEventType(value: unknown) {
  const event = text(value).toLowerCase();
  if (event === 'request') return 'sent';
  if (event === 'delivered') return 'delivered';
  if (event === 'opened' || event === 'open') return 'opened';
  if (event === 'unique_opened') return 'unique_opened';
  if (event === 'proxy_open') return 'opened';
  if (event === 'unique_proxy_open') return 'unique_opened';
  if (event === 'click') return 'clicked';
  if (event === 'clicked') return 'clicked';
  if (event === 'soft_bounce') return 'soft_bounce';
  if (event === 'hard_bounce') return 'hard_bounce';
  if (event === 'bounce' || event === 'bounced') return 'bounced';
  if (event === 'deferred') return 'deferred';
  if (event === 'spam') return 'spam';
  if (event === 'unsubscribed' || event === 'unsubscribe') return 'unsubscribed';
  if (event === 'blocked') return 'blocked';
  if (event === 'invalid_email') return 'invalid_email';
  if (event === 'error') return 'error';
  return 'unknown';
}

function occurredAt(payload: JsonRecord) {
  const epochMs = Number(firstValue(payload, ['ts_epoch']));
  if (Number.isFinite(epochMs) && epochMs > 0) return new Date(epochMs).toISOString();

  const epochSeconds = Number(firstValue(payload, ['ts_event', 'ts']));
  if (Number.isFinite(epochSeconds) && epochSeconds > 0) return new Date(epochSeconds * 1000).toISOString();

  const dateValue = text(firstValue(payload, ['date_event', 'date_sent', 'date']));
  if (dateValue) {
    const parsed = new Date(dateValue.replace(' ', 'T'));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date().toISOString();
}

function queueStatusForEvent(eventType: string) {
  if (eventType === 'clicked') return 'clicked';
  if (eventType === 'opened' || eventType === 'unique_opened') return 'opened';
  if (eventType === 'delivered') return 'delivered';
  if (eventType === 'sent') return 'sent';
  if (['hard_bounce', 'soft_bounce', 'bounced', 'spam', 'blocked', 'invalid_email', 'error'].includes(eventType)) return 'failed';
  if (eventType === 'unsubscribed') return 'unsubscribed';
  if (eventType === 'deferred') return 'deferred';
  return '';
}

function statusRank(status: string) {
  const ranks: Record<string, number> = {
    failed: 90,
    unsubscribed: 85,
    clicked: 80,
    opened: 70,
    delivered: 60,
    sent: 50,
    deferred: 40,
    queued: 10,
  };
  return ranks[status] ?? 0;
}

async function findQueue(providerMessageId: string, recipientEmail: string) {
  for (const candidate of providerMessageIdCandidates(providerMessageId)) {
    const { data, error } = await admin
      .from('email_queue')
      .select('id,status')
      .eq('provider', 'brevo')
      .eq('provider_message_id', candidate)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as { id: string; status?: string };
  }

  if (recipientEmail) {
    const { data, error } = await admin
      .from('email_queue')
      .select('id,status')
      .eq('provider', 'brevo')
      .eq('recipient_email', recipientEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as { id: string; status?: string };
  }

  return null;
}

async function insertProviderEvent(eventRow: JsonRecord) {
  const { error } = await admin.from('email_provider_events').insert(eventRow);
  if (!error) return true;

  if (error.code === '23505') {
    console.info('Duplicate Brevo provider event ignored', {
      eventType: eventRow.event_type,
      providerMessageId: eventRow.provider_message_id,
      recipientEmail: eventRow.recipient_email,
    });
    return false;
  }

  throw error;
}

async function processEvent(payload: JsonRecord, endpointSlug: string) {
  const eventType = normalizeEventType(payload.event ?? payload.msg_status ?? payload.status);
  const providerMessageId = text(firstValue(payload, ['message-id', 'messageId', 'message_id']));
  const recipientEmail = normalizeEmail(payload.email ?? payload.to);
  const queue = await findQueue(providerMessageId, recipientEmail);
  const occurred = occurredAt(payload);
  const queueStatus = queueStatusForEvent(eventType);
  const reason = text(payload.reason ?? payload.description ?? payload.error);

  const eventRow = {
    provider: 'brevo',
    provider_event_id: text(payload.id),
    provider_message_id: providerMessageId || null,
    email_queue_id: queue?.id ?? null,
    recipient_email: recipientEmail || null,
    event_type: eventType,
    event_status: 'received',
    subject: text(payload.subject) || null,
    link_url: text(payload.link) || null,
    reason: reason || null,
    template_id: text(payload.template_id ?? payload.templateId) || null,
    tags: asStringArray(payload.tags ?? payload.tag),
    metadata: {
      campaignId: text(payload.camp_id) || null,
      campaignName: text(payload['campaign name']) || null,
      contactId: text(payload.contact_id) || null,
      deviceUsed: text(payload.device_used) || null,
      endpointSlug,
      sendingIp: text(payload.sending_ip) || null,
      userAgent: text(payload.user_agent) || null,
    },
    occurred_at: occurred,
  };

  const archived = await insertProviderEvent(eventRow);

  if (queue?.id && queueStatus) {
    const currentStatus = text(queue.status, 'sent');
    const nextStatus = statusRank(queueStatus) >= statusRank(currentStatus) ? queueStatus : currentStatus;
    const updatePayload: JsonRecord = {
      last_event_at: occurred,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    if (reason && nextStatus === 'failed') updatePayload.failure_message = reason.slice(0, 500);

    const { error: updateError } = await admin
      .from('email_queue')
      .update(updatePayload)
      .eq('id', queue.id);
    if (updateError) throw updateError;
  }

  return { archived, eventType, providerMessageId, queueId: queue?.id ?? null, recipientEmail };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!webhookSecret) return json(503, { error: 'BREVO_WEBHOOK_SECRET is not configured.' });

  const url = new URL(request.url);
  const endpointSlug = url.pathname.split('/').filter(Boolean).pop() || 'brevo-email-webhook';
  const providedSecret = request.headers.get('x-brevo-webhook-secret') || url.searchParams.get('secret') || '';
  if (providedSecret !== webhookSecret) return json(401, { error: 'Invalid webhook secret.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch (_error) {
    return json(400, { error: 'Webhook body must be JSON.' });
  }

  const payloads = Array.isArray(body) ? body.map(asRecord) : [asRecord(body)];
  if (!payloads.length || payloads.some((payload) => Object.keys(payload).length === 0)) {
    return json(400, { error: 'Webhook event payload is empty.' });
  }

  try {
    const results = [];
    for (const payload of payloads) {
      results.push(await processEvent(payload, endpointSlug));
    }
    return json(200, { ok: true, processed: results.length, results });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
});
