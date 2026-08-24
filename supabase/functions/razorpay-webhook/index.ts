import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
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

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => text(value)).filter(Boolean)));
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { hash: 'SHA-256', name: 'HMAC' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return bytesToHex(signature);
}

async function verifyRazorpaySignature(body: string, signature: string) {
  if (!signature) return false;
  const expected = await hmacSha256Hex(webhookSecret, body);
  return timingSafeEqual(expected, signature);
}

function paymentEntity(payload: JsonRecord) {
  const payloadRecord = asRecord(payload.payload);
  return asRecord(asRecord(payloadRecord.payment).entity);
}

function paymentLinkEntity(payload: JsonRecord) {
  const payloadRecord = asRecord(payload.payload);
  return asRecord(asRecord(payloadRecord.payment_link).entity);
}

function orderEntity(payload: JsonRecord) {
  const payloadRecord = asRecord(payload.payload);
  return asRecord(asRecord(payloadRecord.order).entity);
}

function referenceCandidates(payload: JsonRecord) {
  const payment = paymentEntity(payload);
  const paymentNotes = asRecord(payment.notes);
  const paymentLink = paymentLinkEntity(payload);
  const paymentLinkNotes = asRecord(paymentLink.notes);
  const paymentLinkCustomer = asRecord(paymentLink.customer);
  const order = orderEntity(payload);
  const orderNotes = asRecord(order.notes);

  return {
    lmsOrderIds: uniqueStrings([
      paymentNotes.lms_order_id,
      paymentNotes.lmsOrderId,
      paymentNotes.order_id,
      paymentNotes.orderId,
      paymentNotes.receipt,
      paymentLinkNotes.lms_order_id,
      paymentLinkNotes.lmsOrderId,
      paymentLink.reference_id,
      paymentLink.referenceId,
      orderNotes.lms_order_id,
      orderNotes.lmsOrderId,
      order.receipt,
    ]),
    packageKeys: uniqueStrings([paymentNotes.package_key, paymentNotes.packageKey, paymentLinkNotes.package_key, paymentLinkNotes.packageKey]),
    payment,
    paymentAmount: Number(payment.amount ?? paymentLink.amount_paid ?? paymentLink.amount ?? 0),
    paymentCurrency: text(payment.currency || paymentLink.currency).toUpperCase(),
    paymentId: text(payment.id || payload.razorpay_payment_id || paymentLink.payment_id || paymentLink.paymentId),
    razorpayOrderIds: uniqueStrings([payment.order_id, payment.orderId, order.id, payload.razorpay_order_id]),
    studentEmails: uniqueStrings([
      payment.email,
      paymentNotes.student_email,
      paymentNotes.studentEmail,
      paymentLink.customer_email,
      paymentLink.customerEmail,
      paymentLinkCustomer.email,
      paymentLinkNotes.student_email,
      paymentLinkNotes.studentEmail,
    ]).map(normalizeEmail),
  };
}

function paymentAmountInMajorUnit(refs: ReturnType<typeof referenceCandidates>) {
  return Number.isFinite(refs.paymentAmount) && refs.paymentAmount > 0 ? refs.paymentAmount / 100 : 0;
}

async function inferSinglePackageKeyFromPayment(refs: ReturnType<typeof referenceCandidates>) {
  const amount = paymentAmountInMajorUnit(refs);
  if (!amount || !refs.paymentCurrency) return '';

  const { data, error } = await admin
    .from('ats_packages')
    .select('package_key')
    .eq('status', 'active')
    .eq('currency', refs.paymentCurrency)
    .eq('amount', amount)
    .limit(2);
  if (error) throw error;
  return data?.length === 1 ? text(data[0].package_key) : '';
}

async function findPaymentOrder(payload: JsonRecord) {
  const refs = referenceCandidates(payload);

  for (const orderId of refs.lmsOrderIds) {
    const { data, error } = await admin
      .from('payment_orders')
      .select('*')
      .eq('item_type', 'ats_package')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return { order: data as JsonRecord, refs };
  }

  for (const razorpayOrderId of refs.razorpayOrderIds) {
    const { data, error } = await admin
      .from('payment_orders')
      .select('*')
      .eq('item_type', 'ats_package')
      .eq('razorpay_order_id', razorpayOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return { order: data as JsonRecord, refs };
  }

  const studentEmail = refs.studentEmails[0] || '';
  const packageKey = refs.packageKeys[0] || await inferSinglePackageKeyFromPayment(refs);
  const amount = paymentAmountInMajorUnit(refs);
  if (studentEmail && packageKey && amount > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from('payment_orders')
      .select('*')
      .eq('item_type', 'ats_package')
      .eq('student_email', studentEmail)
      .eq('item_id', packageKey)
      .eq('status', 'created')
      .eq('amount', amount)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return { order: data as JsonRecord, refs };
  }

  return { order: null, refs };
}

async function grantAtsCredits(paymentOrder: JsonRecord, refs: ReturnType<typeof referenceCandidates>) {
  const packageKey = text(paymentOrder.item_id || refs.packageKeys[0]);
  if (!packageKey) throw new Error('ATS package key is missing on payment order.');

  const { data: atsPackage, error: packageError } = await admin
    .from('ats_packages')
    .select('id,package_key,scan_credits,title')
    .eq('package_key', packageKey)
    .maybeSingle();
  if (packageError) throw packageError;
  if (!atsPackage) throw new Error(`ATS package was not found for ${packageKey}.`);

  const studentEmail = normalizeEmail(paymentOrder.student_email || refs.studentEmails[0]);
  if (!studentEmail) throw new Error('Student email is missing on payment order.');

  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id,email')
    .ilike('email', studentEmail)
    .limit(1)
    .maybeSingle();
  if (studentError) throw studentError;

  const paymentOrderId = text(paymentOrder.id || paymentOrder.order_id);
  const paymentId = refs.paymentId || null;
  const razorpayOrderId = refs.razorpayOrderIds[0] || text(paymentOrder.razorpay_order_id) || null;
  const scanCredits = Number(atsPackage.scan_credits ?? 0);
  if (!Number.isInteger(scanCredits) || scanCredits <= 0) throw new Error('ATS package scan credits are invalid.');

  const updatePayload: JsonRecord = {
    status: 'paid',
    updated_at: new Date().toISOString(),
  };
  if (paymentId) updatePayload.razorpay_payment_id = paymentId;
  if (razorpayOrderId) updatePayload.razorpay_order_id = razorpayOrderId;

  const { error: orderUpdateError } = await admin
    .from('payment_orders')
    .update(updatePayload)
    .eq('id', paymentOrder.id);
  if (orderUpdateError) throw orderUpdateError;

  const grantPayload = {
    notes: `Razorpay payment confirmed${paymentId ? ` (${paymentId})` : ''}.`,
    package_id: atsPackage.id,
    purchased_scans: scanCredits,
    remaining_scans: scanCredits,
    source: 'payment',
    source_payment_id: paymentId,
    source_payment_order_id: paymentOrderId,
    student_email: studentEmail,
    student_id: student?.id ?? null,
  };

  const { data: grant, error: grantError } = await admin
    .from('ats_student_credit_grants')
    .insert(grantPayload)
    .select('id,purchased_scans,remaining_scans')
    .single();

  if (grantError && grantError.code !== '23505') throw grantError;

  if (!grantError) {
    await admin.from('ats_usage_events').insert([
      {
        event_type: 'payment_completed',
        metadata: {
          package_key: packageKey,
          payment_id: paymentId,
          payment_order_id: paymentOrderId,
          razorpay_order_id: razorpayOrderId,
          scan_credits: scanCredits,
        },
        student_email: studentEmail,
        student_id: student?.id ?? null,
      },
      {
        event_type: 'credit_granted',
        metadata: {
          credits: scanCredits,
          grant_id: grant?.id ?? null,
          package_key: packageKey,
          payment_id: paymentId,
          source: 'razorpay_webhook',
        },
        student_email: studentEmail,
        student_id: student?.id ?? null,
      },
    ]);
  }

  return {
    credits: scanCredits,
    duplicate: grantError?.code === '23505',
    paymentOrderId,
    studentEmail,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!supabaseUrl || !serviceRoleKey) return json(503, { error: 'Supabase service configuration is missing.' });
  if (!webhookSecret) return json(503, { error: 'RAZORPAY_WEBHOOK_SECRET is not configured.' });

  const signature = request.headers.get('x-razorpay-signature') || '';
  const rawBody = await request.text();
  const isValid = await verifyRazorpaySignature(rawBody, signature);
  if (!isValid) return json(401, { error: 'Invalid Razorpay webhook signature.' });

  let payload: JsonRecord;
  try {
    payload = asRecord(JSON.parse(rawBody));
  } catch (_error) {
    return json(400, { error: 'Webhook body must be JSON.' });
  }

  const eventName = text(payload.event).toLowerCase();
  const payment = paymentEntity(payload);
  const paymentStatus = text(payment.status).toLowerCase();
  const isPaidEvent = eventName === 'payment.captured' || eventName === 'payment_link.paid' || eventName === 'order.paid' || paymentStatus === 'captured';
  if (!isPaidEvent) return json(200, { ok: true, ignored: true, event: eventName || 'unknown' });

  try {
    const { order, refs } = await findPaymentOrder(payload);
    if (!order) {
      return json(202, {
        ok: false,
        pending: true,
        reason: 'No matching ATS payment order found. Ensure Razorpay notes/reference_id include lms_order_id or use Razorpay order_id mapping.',
      });
    }

    if (text(order.item_type) !== 'ats_package') return json(200, { ok: true, ignored: true, reason: 'Not an ATS package order.' });

    const result = await grantAtsCredits(order, refs);
    return json(200, { ok: true, event: eventName, ...result });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
});
