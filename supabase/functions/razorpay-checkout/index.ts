import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const configuredReturnUrl = Deno.env.get('LMS_PAYMENT_RETURN_URL') || '';

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

function toMoneyAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function toRazorpayAmount(value: number, currency: string) {
  const zeroDecimalCurrencies = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
  return Math.round(value * (zeroDecimalCurrencies.has(currency.toUpperCase()) ? 1 : 100));
}

function fromRazorpayAmount(value: unknown, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const zeroDecimalCurrencies = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
  return amount / (zeroDecimalCurrencies.has(currency.toUpperCase()) ? 1 : 100);
}

function uniqueOrderId(prefix: string) {
  const safePrefix = prefix.replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase() || 'LMS';
  return `${safePrefix}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`.slice(0, 40);
}

function requestOrigin(request: Request) {
  return (request.headers.get('origin') || '').replace(/\/+$/, '');
}

function callbackUrl(request: Request, requestedReturnUrl: unknown) {
  const requested = text(requestedReturnUrl);
  const origin = requestOrigin(request);

  if (requested && origin && requested.startsWith('/')) {
    return `${origin}${requested}`;
  }

  if (requested && origin) {
    try {
      const url = new URL(requested);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin === origin) {
        return url.toString();
      }
    } catch {
      // Fall back to the configured/default URL below.
    }
  }

  if (configuredReturnUrl) return configuredReturnUrl;
  return origin ? `${origin}/student/payments` : undefined;
}

async function getAuthenticatedStudent(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Please sign in before starting checkout.');

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user?.email) throw new Error('Your session could not be verified.');

  const email = normalizeEmail(userData.user.email);
  const { data: student, error: studentError } = await admin
    .from('students')
    .select('id,email,alt_email,full_name,phone')
    .or(`auth_user_id.eq.${userData.user.id},email.eq.${email},alt_email.eq.${email}`)
    .limit(1)
    .maybeSingle();
  if (studentError) throw studentError;
  if (!student) throw new Error('Student profile was not found for this account.');
  return { email: normalizeEmail(student.email || email), student: student as JsonRecord };
}

function extractItems(value: unknown, sectionNames: string[]) {
  if (Array.isArray(value)) return value.filter(asRecord);
  const record = asRecord(value);
  for (const sectionName of sectionNames) {
    const section = record[sectionName];
    if (Array.isArray(section)) return section.filter(asRecord);
    const sectionRecord = asRecord(section);
    if (Array.isArray(sectionRecord.items)) return sectionRecord.items.filter(asRecord);
  }
  return [];
}

function itemIdentityValues(item: JsonRecord) {
  return [
    item.id,
    item.resource_id,
    item.resourceId,
    item.workshop_id,
    item.workshopId,
    item.package_key,
    item.packageKey,
  ].map(text).filter(Boolean);
}

function findVisibleItem(items: JsonRecord[], itemId: string) {
  return items.find((item) => itemIdentityValues(item).includes(itemId));
}

async function resolveAtsPackage(packageId: string) {
  const { data, error } = await admin
    .from('ats_packages')
    .select('id,package_key,title,amount,currency,status')
    .eq('id', packageId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('ATS package is not available.');
  return {
    itemId: text(data.package_key),
    itemTitle: text(data.title, 'ATS package'),
    itemType: 'ats_package',
    amount: toMoneyAmount(data.amount),
    currency: text(data.currency, 'INR').toUpperCase(),
    notes: { package_key: text(data.package_key) },
  };
}

async function resolveResource(studentEmail: string, itemId: string) {
  const { data, error } = await admin.rpc('student_resources_view', { p_student_email: studentEmail });
  if (error) throw error;
  const item = findVisibleItem(extractItems(data, ['resources', 'items']), itemId);
  if (!item) throw new Error('This paid resource is not visible for your account.');
  if (text(item.access_type || item.accessType) !== 'paid') throw new Error('This resource does not require payment.');
  if (item.locked !== true && item.hasAccess !== false) throw new Error('You already have access to this resource.');
  const amount = toMoneyAmount(item.price);
  if (!amount) throw new Error('This resource does not have a valid LMS price.');
  return {
    itemId: text(item.resource_id || item.resourceId || item.id),
    itemTitle: text(item.title, 'Paid resource'),
    itemType: 'resource',
    amount,
    currency: text(item.currency, 'INR').toUpperCase(),
    notes: {},
  };
}

async function resolveWorkshop(studentEmail: string, itemId: string) {
  const { data, error } = await admin.rpc('student_schedule_view', { p_student_email: studentEmail, p_include_past: true });
  if (error) throw error;
  const item = findVisibleItem(extractItems(data, ['items']), itemId);
  if (!item) throw new Error('This paid session is not visible for your account.');
  if (text(item.access_type || item.accessType) !== 'paid') throw new Error('This session does not require payment.');
  if (item.locked !== true && item.hasAccess !== false) throw new Error('You already have access to this session.');
  const amount = toMoneyAmount(item.price);
  if (!amount) throw new Error('This session does not have a valid LMS price.');
  return {
    itemId: text(item.workshop_id || item.workshopId || item.id),
    itemTitle: text(item.title, 'Paid session'),
    itemType: 'workshop',
    amount,
    currency: text(item.currency, 'INR').toUpperCase(),
    notes: {},
  };
}

async function resolveCheckoutItem(studentEmail: string, payload: JsonRecord) {
  const itemType = text(payload.itemType || payload.item_type);
  const itemId = text(payload.itemId || payload.item_id || payload.packageId || payload.package_id);
  if (!itemType || !itemId) throw new Error('Checkout item type and id are required.');
  if (itemType === 'ats_package') return resolveAtsPackage(itemId);
  if (itemType === 'resource') return resolveResource(studentEmail, itemId);
  if (itemType === 'workshop' || itemType === 'recording') return resolveWorkshop(studentEmail, itemId);
  throw new Error('This item type is not supported for dynamic checkout.');
}

async function findExistingOrder(studentEmail: string, itemType: string, itemId: string) {
  const { data, error } = await admin
    .from('payment_orders')
    .select('*')
    .eq('student_email', studentEmail)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .eq('status', 'created')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as JsonRecord | null;
}

async function createPaymentOrder(studentEmail: string, item: Awaited<ReturnType<typeof resolveCheckoutItem>>) {
  const now = Date.now();
  const orderId = uniqueOrderId(item.itemType === 'ats_package' ? 'ATS' : item.itemType);
  const insertPayload = {
    amount: item.amount,
    currency: item.currency,
    item_id: item.itemId,
    item_title: item.itemTitle,
    item_type: item.itemType,
    order_id: orderId,
    receipt: `${item.itemType}_${now}`,
    status: 'created',
    student_email: studentEmail,
  };
  const { data, error } = await admin.from('payment_orders').insert(insertPayload).select('*').single();
  if (error) throw error;
  return data as JsonRecord;
}

async function updateOrderWithCheckout(orderId: unknown, payload: JsonRecord) {
  const { data, error } = await admin
    .from('payment_orders')
    .update(payload)
    .eq('id', orderId)
    .select('*')
    .single();
  if (error) throw error;
  return data as JsonRecord;
}

async function fetchRazorpayPaymentLink(paymentLinkId: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(paymentLinkId)}`, {
    headers: {
      Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
      'Content-Type': 'application/json',
    },
  });
  const result = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    const message = text(asRecord(result.error).description || result.error || result.message, 'Razorpay payment link could not be verified.');
    throw new Error(message);
  }
  return result;
}

function paymentIdFromPaymentLink(paymentLink: JsonRecord) {
  const payments = Array.isArray(paymentLink.payments) ? paymentLink.payments : [];
  const firstPayment = payments.map(asRecord).find((payment) => text(payment.status).toLowerCase() === 'captured') || asRecord(payments[0]);
  return text(firstPayment.payment_id || firstPayment.paymentId || firstPayment.id || paymentLink.payment_id || paymentLink.paymentId);
}

async function grantAtsCreditsFromOrder(order: JsonRecord, student: JsonRecord, paymentLink: JsonRecord) {
  const paymentOrderId = text(order.id);
  const existingGrant = await admin
    .from('ats_student_credit_grants')
    .select('id,purchased_scans,remaining_scans')
    .eq('source', 'payment')
    .eq('source_payment_order_id', paymentOrderId)
    .maybeSingle();
  if (existingGrant.error) throw existingGrant.error;
  if (existingGrant.data) {
    return { credits: Number(existingGrant.data.remaining_scans ?? 0), duplicate: true, grantId: text(existingGrant.data.id) };
  }

  const packageKey = text(order.item_id);
  const { data: atsPackage, error: packageError } = await admin
    .from('ats_packages')
    .select('id,package_key,scan_credits,title')
    .eq('package_key', packageKey)
    .maybeSingle();
  if (packageError) throw packageError;
  if (!atsPackage) throw new Error(`ATS package was not found for ${packageKey}.`);

  const studentEmail = normalizeEmail(order.student_email);
  const paymentId = paymentIdFromPaymentLink(paymentLink) || text(paymentLink.id);
  const scanCredits = Number(atsPackage.scan_credits ?? 0);
  if (!Number.isInteger(scanCredits) || scanCredits <= 0) throw new Error('ATS package scan credits are invalid.');

  const { error: orderUpdateError } = await admin
    .from('payment_orders')
    .update({
      razorpay_payment_id: paymentId || null,
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);
  if (orderUpdateError) throw orderUpdateError;

  const { data: grant, error: grantError } = await admin
    .from('ats_student_credit_grants')
    .insert({
      notes: `Razorpay payment verified from payment link ${text(paymentLink.id)}.`,
      package_id: atsPackage.id,
      purchased_scans: scanCredits,
      remaining_scans: scanCredits,
      source: 'payment',
      source_payment_id: paymentId || null,
      source_payment_order_id: paymentOrderId,
      student_email: studentEmail,
      student_id: text(student.id) || null,
    })
    .select('id,purchased_scans,remaining_scans')
    .single();
  if (grantError) throw grantError;

  await admin.from('ats_usage_events').insert([
    {
      event_type: 'payment_completed',
      metadata: {
        package_key: packageKey,
        payment_id: paymentId,
        payment_link_id: text(paymentLink.id),
        payment_order_id: paymentOrderId,
        scan_credits: scanCredits,
        source: 'razorpay_checkout_sync',
      },
      student_email: studentEmail,
      student_id: text(student.id) || null,
    },
    {
      event_type: 'credit_granted',
      metadata: {
        credits: scanCredits,
        grant_id: grant?.id ?? null,
        package_key: packageKey,
        payment_id: paymentId,
        source: 'razorpay_checkout_sync',
      },
      student_email: studentEmail,
      student_id: text(student.id) || null,
    },
  ]);

  return { credits: scanCredits, duplicate: false, grantId: text(grant?.id) };
}

async function syncPaidAtsCredits(studentEmail: string, student: JsonRecord) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders, error } = await admin
    .from('payment_orders')
    .select('*')
    .eq('student_email', studentEmail)
    .eq('item_type', 'ats_package')
    .eq('status', 'created')
    .not('razorpay_payment_link_id', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;

  let creditsGranted = 0;
  const synced: JsonRecord[] = [];
  for (const order of (orders ?? []) as JsonRecord[]) {
    const paymentLinkId = text(order.razorpay_payment_link_id);
    if (!paymentLinkId) continue;
    const paymentLink = await fetchRazorpayPaymentLink(paymentLinkId);
    const status = text(paymentLink.status).toLowerCase();
    const amountPaid = fromRazorpayAmount(paymentLink.amount_paid ?? paymentLink.amountPaid, text(order.currency, 'INR'));
    if (status !== 'paid' || amountPaid < Number(order.amount ?? 0)) {
      synced.push({ orderId: text(order.order_id), paymentLinkId, status, synced: false });
      continue;
    }
    const result = await grantAtsCreditsFromOrder(order, student, paymentLink);
    creditsGranted += result.duplicate ? 0 : result.credits;
    synced.push({ credits: result.credits, duplicate: result.duplicate, orderId: text(order.order_id), paymentLinkId, status, synced: true });
  }

  return { creditsGranted, checked: orders?.length ?? 0, synced };
}

async function createRazorpayPaymentLink(order: JsonRecord, item: Awaited<ReturnType<typeof resolveCheckoutItem>>, student: JsonRecord, request: Request, requestedReturnUrl: unknown) {
  const orderId = text(order.order_id);
  const studentEmail = normalizeEmail(order.student_email);
  const body: JsonRecord = {
    amount: toRazorpayAmount(item.amount, item.currency),
    currency: item.currency,
    accept_partial: false,
    reference_id: orderId,
    description: `Skilled Sapiens - ${item.itemTitle}`.slice(0, 2048),
    customer: {
      name: text(student.full_name, studentEmail),
      email: studentEmail,
      contact: text(student.phone),
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: {
      lms_order_id: orderId,
      item_type: item.itemType,
      item_id: item.itemId,
      student_email: studentEmail,
      ...item.notes,
    },
  };
  const returnUrl = callbackUrl(request, requestedReturnUrl);
  if (returnUrl) {
    body.callback_url = returnUrl;
    body.callback_method = 'get';
  }

  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    const message = text(asRecord(result.error).description || result.error || result.message, 'Razorpay checkout could not be created.');
    throw new Error(message);
  }
  const checkoutUrl = text(result.short_url);
  if (!checkoutUrl) throw new Error('Razorpay did not return a checkout URL.');
  return {
    checkoutUrl,
    paymentLinkId: text(result.id),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(503, { error: 'Supabase function configuration is missing.' });
  if (!razorpayKeyId || !razorpayKeySecret) return json(503, { error: 'Razorpay API keys are not configured in Supabase secrets.' });

  try {
    const payload = asRecord(await request.json());
    const { email, student } = await getAuthenticatedStudent(request);
    if (text(payload.action).toLowerCase() === 'sync_ats_credits') {
      const sync = await syncPaidAtsCredits(email, student);
      return json(200, { ok: true, ...sync });
    }

    const item = await resolveCheckoutItem(email, payload);
    const requestedReturnUrl = payload.returnUrl ?? payload.return_url ?? payload.returnPath ?? payload.return_path;
    let order = await findExistingOrder(email, item.itemType, item.itemId);
    if (order && text(order.checkout_url) && item.itemType === 'ats_package' && text(requestedReturnUrl)) {
      order = null;
    }
    if (!order) order = await createPaymentOrder(email, item);

    const existingCheckoutUrl = text(order.checkout_url);
    if (existingCheckoutUrl) {
      return json(200, {
        ok: true,
        amount: Number(order.amount ?? item.amount),
        checkoutUrl: existingCheckoutUrl,
        currency: text(order.currency, item.currency),
        id: text(order.id),
        itemId: text(order.item_id, item.itemId),
        itemTitle: text(order.item_title, item.itemTitle),
        itemType: text(order.item_type, item.itemType),
        orderId: text(order.order_id),
        paymentLink: existingCheckoutUrl,
        razorpayPaymentLinkId: text(order.razorpay_payment_link_id) || null,
        status: text(order.status, 'created'),
        reused: true,
      });
    }

    const checkout = await createRazorpayPaymentLink(order, item, student, request, requestedReturnUrl);
    order = await updateOrderWithCheckout(order.id, {
      checkout_url: checkout.checkoutUrl,
      razorpay_payment_link_id: checkout.paymentLinkId || null,
      updated_at: new Date().toISOString(),
    });

    return json(200, {
      ok: true,
      amount: Number(order.amount ?? item.amount),
      checkoutUrl: checkout.checkoutUrl,
      currency: text(order.currency, item.currency),
      id: text(order.id),
      itemId: text(order.item_id),
      itemTitle: text(order.item_title),
      itemType: text(order.item_type),
      orderId: text(order.order_id),
      paymentLink: checkout.checkoutUrl,
      razorpayPaymentLinkId: checkout.paymentLinkId || null,
      status: text(order.status, 'created'),
    });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : String(error) });
  }
});
