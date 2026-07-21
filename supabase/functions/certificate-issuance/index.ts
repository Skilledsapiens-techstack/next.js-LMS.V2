import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

type CertificateRow = Record<string, unknown>;

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const TEMPLATE_BUCKET = 'certificate-templates';
const TEMP_BUCKET = 'temporary-certificates';
const PDF_TTL_HOURS = 24;
const REGENERATION_COOLDOWN_MINUTES = 15;
const STUDENT_REGENERATION_COOLDOWN_MINUTES = 24 * 60;
const VERIFY_BASE_URL = Deno.env.get('CERTIFICATE_VERIFY_BASE_URL') ?? 'https://skilledsapiens.com/verify-your-certificate/';
const SLIDES_WEBAPP_URL = Deno.env.get('CERTIFICATE_SLIDES_WEBAPP_URL') ?? '';
const SLIDES_SECRET = Deno.env.get('CERTIFICATE_SLIDES_SECRET') ?? '';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  });
}

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function escHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fillVars(source: string, vars: Record<string, unknown>) {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => text(vars[key]));
}

function richPlainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function labelCertificateDownloadLink(html: string, signedUrl: string) {
  const escapedUrl = escHtml(signedUrl);
  if (!escapedUrl) return html;
  const downloadLink = `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">Download Your Certificate</a>`;
  return html.split(escapedUrl).join(downloadLink);
}

function shouldMarkGenerationFailed(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return ![
    'A fresh certificate PDF was already generated in the last 24 hours.',
    'Certificate issuance permission is required.',
    'Certificate was not found.',
    'Revoked certificates cannot be regenerated.',
    'You do not have access to this certificate.'
  ].some((safeMessage) => message.startsWith(safeMessage));
}

function htmlToPlainText(value: string) {
  return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

function certificateTypeToTemplateType(value: unknown) {
  return text(value) === 'live_project' ? 'live_project' : 'leadership_program';
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function minutesAgo(value: unknown) {
  const date = new Date(text(value));
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / 60_000;
}

function formatDate(value: unknown) {
  const raw = text(value);
  if (!raw) return '';
  const date = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function verificationUrl(certificate: CertificateRow) {
  const existing = text(certificate.verification_url);
  if (existing.startsWith('http')) return existing;
  const base = VERIFY_BASE_URL.endsWith('/') ? VERIFY_BASE_URL : `${VERIFY_BASE_URL}/`;
  return `${base}?certId=${encodeURIComponent(text(certificate.certificate_id))}`;
}

function wrapText(value: string, maxChars: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function formatList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join(', ');
  return text(value);
}

function certificateFileName(certificate: CertificateRow) {
  return `${text(certificate.certificate_id, 'certificate')}.pdf`;
}

function slidesPlaceholderMap(certificate: CertificateRow) {
  const verify = verificationUrl(certificate);
  const program = text(certificate.program_name, text(certificate.program_key));
  const cohort = text(certificate.cohort_name, text(certificate.cohort_id));
  const modules = formatList(certificate.modules_covered);
  const projectStart = formatDate(certificate.project_start_date);
  const projectEnd = formatDate(certificate.project_end_date);
  const projectDateRange = [projectStart, projectEnd].filter(Boolean).join(' to ');

  return {
    certificate_id: text(certificate.certificate_id),
    certificate_type: certificateTypeToTemplateType(certificate.certificate_type),
    cohort,
    cohort_name: cohort,
    duration: text(certificate.duration_label),
    duration_label: text(certificate.duration_label),
    issue_date: formatDate(certificate.issue_date),
    module_list: modules,
    modules,
    modules_covered: modules,
    portal_url: 'https://dev.skilledsapiens.com/login',
    program,
    program_key: text(certificate.program_key),
    program_name: program,
    project_date_range: projectDateRange,
    project_end_date: projectEnd,
    project_role: text(certificate.project_role, text(certificate.role_name)),
    project_start_date: projectStart,
    project_title: text(certificate.project_title),
    qr_code: verify,
    role_name: text(certificate.role_name, text(certificate.project_role)),
    student_email: text(certificate.student_email),
    student_name: text(certificate.student_name, 'Student'),
    verification_url: verify
  };
}

async function createSlidesPdf(certificate: CertificateRow) {
  if (!SLIDES_WEBAPP_URL) return null;
  if (!SLIDES_SECRET) throw new Error('CERTIFICATE_SLIDES_SECRET is not configured.');

  const templateType = certificateTypeToTemplateType(certificate.certificate_type);
  const response = await fetch(SLIDES_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: SLIDES_SECRET,
      templateType,
      certificateId: text(certificate.certificate_id),
      fileName: certificateFileName(certificate),
      placeholders: slidesPlaceholderMap(certificate)
    })
  });

  const raw = await response.text();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(raw);
  } catch (_error) {
    throw new Error(`Google Slides certificate generator returned an invalid response: ${raw.slice(0, 240)}`);
  }

  if (!response.ok || result.ok === false) {
    throw new Error(text(result.error, `Google Slides certificate generator failed with status ${response.status}.`));
  }

  const pdfBase64 = text(result.pdfBase64);
  if (!pdfBase64) throw new Error('Google Slides certificate generator did not return a PDF.');

  return {
    pdfBytes: base64ToBytes(pdfBase64),
    templateUrl: text(result.templateUrl, `google-slides:${templateType}`)
  };
}

function drawCenteredText(page: any, value: string, y: number, size: number, font: any, color = rgb(0, 0, 0), maxWidth = 520) {
  const textWidth = font.widthOfTextAtSize(value, size);
  const x = Math.max(20, (page.getWidth() - Math.min(textWidth, maxWidth)) / 2);
  page.drawText(value, { x, y, size, font, color, maxWidth });
}

function drawCenteredInBox(page: any, value: string, x: number, y: number, width: number, size: number, font: any, color = rgb(0, 0, 0)) {
  const textWidth = font.widthOfTextAtSize(value, size);
  const startX = x + Math.max(0, (width - textWidth) / 2);
  page.drawText(value, { x: startX, y, size, font, color, maxWidth: width });
}

function cover(page: any, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), opacity: 1 });
}

async function createPdf(templateBytes: Uint8Array, certificate: CertificateRow) {
  const pdf = await PDFDocument.load(templateBytes);
  const [page] = pdf.getPages();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const red = rgb(0.73, 0.08, 0.08);
  const black = rgb(0.04, 0.04, 0.04);
  const verify = verificationUrl(certificate);
  const qrDataUrl = await QRCode.toDataURL(verify, { margin: 0, width: 160 });
  const qrImage = await pdf.embedPng(qrDataUrl.split(',')[1]);

  if (text(certificate.certificate_type) === 'live_project') {
    cover(page, 300, 214, 260, 42);
    drawCenteredInBox(page, text(certificate.student_name), 300, 229, 260, 16, bold, black);

    cover(page, 468, 180, 205, 26);
    page.drawText(`${text(certificate.project_role, 'Project')} Intern`, { x: 505, y: 189, size: 8, font: bold, color: black, maxWidth: 150 });

    cover(page, 300, 154, 250, 30);
    drawCenteredInBox(page, `${formatDate(certificate.project_start_date)} to ${formatDate(certificate.project_end_date)}`, 300, 168, 250, 10, regular, black);

    cover(page, 482, 40, 142, 48);
    page.drawText(text(certificate.certificate_id), { x: 502, y: 66, size: 7, font: bold, color: black, maxWidth: 118 });
    page.drawText(formatDate(certificate.issue_date), { x: 502, y: 52, size: 8, font: bold, color: black, maxWidth: 118 });
    page.drawImage(qrImage, { x: 632, y: 43, width: 45, height: 45 });
  } else {
    cover(page, 250, 216, 250, 44);
    drawCenteredInBox(page, text(certificate.student_name), 250, 232, 250, 14, bold, red);

    cover(page, 268, 194, 250, 24);
    drawCenteredInBox(page, text(certificate.program_name, text(certificate.program_key, 'Leadership Program')), 268, 205, 250, 6, bold, black);

    cover(page, 205, 138, 330, 50);
    const modules = Array.isArray(certificate.modules_covered) ? certificate.modules_covered.map(String).join(', ') : text(certificate.modules_covered);
    wrapText(modules, 72).forEach((line, index) => drawCenteredText(page, line, 166 - index * 10, 8, bold, red, 380));

    cover(page, 122, 30, 138, 34);
    page.drawText(text(certificate.certificate_id), { x: 126, y: 51, size: 7, font: bold, color: black, maxWidth: 128 });
    page.drawText(formatDate(certificate.issue_date), { x: 126, y: 37, size: 8, font: bold, color: black, maxWidth: 128 });
    page.drawImage(qrImage, { x: 608, y: 34, width: 36, height: 36 });
  }

  return await pdf.save();
}

async function getActor(supabase: ReturnType<typeof createClient>, request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) throw new Error('Missing authorization token.');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) throw new Error('Invalid session.');
  return { email: data.user.email.toLowerCase(), id: data.user.id };
}

async function getAdminAccess(supabase: ReturnType<typeof createClient>, actor: { email: string; id: string }) {
  const { data } = await supabase
    .from('admin_users')
    .select('id,role,permissions')
    .or(`auth_user_id.eq.${actor.id},email.eq.${actor.email}`)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return {
    permissions: Array.isArray(data?.permissions) ? data.permissions.map(String) : null,
    role: typeof data?.role === 'string' ? data.role : null
  };
}

function hasAdminPermission(access: { permissions: string[] | null; role: string | null }, permission: string) {
  if (access.permissions) return access.permissions.includes(permission);
  if (permission === 'admin.certificates.view') return access.role === 'super_admin' || access.role === 'admin' || access.role === 'moderator';
  if (permission === 'admin.certificates.issue') return access.role === 'super_admin' || access.role === 'admin';
  return false;
}

function canViewCertificates(access: { permissions: string[] | null; role: string | null }) {
  return hasAdminPermission(access, 'admin.certificates.view');
}

function canIssueCertificates(access: { permissions: string[] | null; role: string | null }) {
  return hasAdminPermission(access, 'admin.certificates.issue');
}

async function getEmailTemplate(supabase: ReturnType<typeof createClient>, templateKey: string) {
  const { data } = await supabase
    .from('email_templates')
    .select('template_key, subject, body')
    .eq('template_key', templateKey)
    .eq('status', 'active')
    .maybeSingle();
  return data || null;
}

async function sendCertificateEmail(supabase: ReturnType<typeof createClient>, certificate: CertificateRow, pdfBytes: Uint8Array, signedUrl: string) {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured.');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'updates@skilledsapiens.com';
  const senderName = Deno.env.get('BREVO_SENDER_NAME') ?? 'Skilled Sapiens';
  const template = await getEmailTemplate(supabase, 'certificate_ready');
  const subjectFallback = `Your Skilled Sapiens certificate: ${text(certificate.certificate_id)}`;
  const expiresAt = formatDate(certificate.pdf_expires_at);
  const vars = {
    student_name: text(certificate.student_name, 'there'),
    student_email: text(certificate.student_email),
    certificate_id: text(certificate.certificate_id),
    certificate_download_url: signedUrl,
    verification_url: verificationUrl(certificate),
    program: text(certificate.program_name, text(certificate.program_key)),
    cohort: text(certificate.cohort_name, text(certificate.cohort_id)),
    expiry: expiresAt || '24 hours',
    portal_url: 'https://dev.skilledsapiens.com/login'
  };
  const subject = fillVars(text(template?.subject) || subjectFallback, vars);
  const bodyFallback = `Hi {{student_name}},

Your Skilled Sapiens certificate {{certificate_id}} is attached to this email.

You can also download it within 24 hours: {{certificate_download_url}}

Verify anytime: {{verification_url}}

Regards,
Skilled Sapiens Team`;
  const html = labelCertificateDownloadLink(richPlainTextToHtml(fillVars(text(template?.body) || bodyFallback, vars)), signedUrl);
  const attachment = bytesToBase64(pdfBytes);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: text(certificate.student_email), name: text(certificate.student_name) }],
      subject,
      htmlContent: html,
      textContent: htmlToPlainText(html),
      attachment: [{
        content: attachment,
        name: `${text(certificate.certificate_id)}.pdf`
      }]
    })
  });
  if (!response.ok) throw new Error(`Brevo email failed: ${await response.text()}`);
  await supabase.from('email_queue').insert({
    email_key: crypto.randomUUID(),
    category: 'transactional',
    template_key: 'certificate_ready',
    provider: 'brevo',
    status: 'sent',
    recipient_email: text(certificate.student_email),
    recipient_name: text(certificate.student_name),
    subject,
    params: { ...vars, has_attachment: true },
    tags: ['certificate', 'certificate_ready'],
    related_entity_type: 'certificate',
    related_entity_id: certificate.id,
    scheduled_at: new Date().toISOString(),
    sent_at: new Date().toISOString()
  });
}

async function generateOne(supabase: ReturnType<typeof createClient>, certificateId: string, actor: { email: string; id: string }, options: { force?: boolean; sendEmail?: boolean }) {
  const { data: certificate, error } = await supabase.from('certificates').select('*').eq('id', certificateId).single();
  if (error || !certificate) throw new Error('Certificate was not found.');
  if (certificate.status === 'revoked') throw new Error('Revoked certificates cannot be regenerated.');

  const adminAccess = await getAdminAccess(supabase, actor);
  const actorCanViewAsAdmin = canViewCertificates(adminAccess);
  const actorCanIssueAsAdmin = canIssueCertificates(adminAccess);
  if (!actorCanViewAsAdmin && text(certificate.student_email).toLowerCase() !== actor.email) {
    throw new Error('You do not have access to this certificate.');
  }
  if ((options.force || options.sendEmail) && !actorCanIssueAsAdmin) {
    throw new Error('Certificate issuance permission is required.');
  }

  const currentPath = text(certificate.pdf_storage_path);
  const currentExpiry = new Date(text(certificate.pdf_expires_at));
  if (!options.force && currentPath && currentExpiry.getTime() > Date.now()) {
    const { data: signed, error: signedError } = await supabase.storage.from(TEMP_BUCKET).createSignedUrl(currentPath, 60 * 60 * 24);
    if (signedError) throw signedError;
    if (options.sendEmail) {
      const { data: existingFile, error: existingDownloadError } = await supabase.storage.from(TEMP_BUCKET).download(currentPath);
      if (existingDownloadError || !existingFile) throw new Error(existingDownloadError?.message ?? 'Existing certificate PDF download failed.');
      try {
        const pdfBytes = new Uint8Array(await existingFile.arrayBuffer());
        await sendCertificateEmail(supabase, certificate, pdfBytes, signed.signedUrl);
        await supabase.from('certificates').update({ email_sent_at: new Date().toISOString(), generation_error: null, updated_at: new Date().toISOString() }).eq('id', certificateId);
      } catch (error) {
        await supabase.from('certificates').update({
          generation_error: `PDF ready, but email failed: ${error instanceof Error ? error.message : 'unknown email error'}`,
          updated_at: new Date().toISOString()
        }).eq('id', certificateId);
        throw error;
      }
    }
    const reusedCertificate = { ...certificate, generation_status: 'ready', generation_error: null, updated_at: new Date().toISOString() };
    await supabase.from('certificates').update({
      generation_error: null,
      generation_status: 'ready',
      updated_at: reusedCertificate.updated_at
    }).eq('id', certificateId);
    return { certificate: reusedCertificate, expiresAt: certificate.pdf_expires_at, signedUrl: signed.signedUrl, status: 'reused' };
  }

  if (!actorCanIssueAsAdmin && !options.force && minutesAgo(certificate.pdf_generated_at) < STUDENT_REGENERATION_COOLDOWN_MINUTES) {
    throw new Error('A fresh certificate PDF was already generated in the last 24 hours. Please try again later or contact your program coordinator.');
  }

  if (options.force && minutesAgo(certificate.pdf_generated_at) < REGENERATION_COOLDOWN_MINUTES) {
    if (currentPath && currentExpiry.getTime() > Date.now()) {
      const { data: signed, error: signedError } = await supabase.storage.from(TEMP_BUCKET).createSignedUrl(currentPath, 60 * 60 * 24);
      if (signedError) throw signedError;
      const reusedCertificate = { ...certificate, generation_status: 'ready', generation_error: null, updated_at: new Date().toISOString() };
      await supabase.from('certificates').update({
        generation_error: null,
        generation_status: 'ready',
        updated_at: reusedCertificate.updated_at
      }).eq('id', certificateId);
      return { certificate: reusedCertificate, expiresAt: certificate.pdf_expires_at, signedUrl: signed.signedUrl, status: 'reused' };
    }
    throw new Error(`Please wait ${REGENERATION_COOLDOWN_MINUTES} minutes before regenerating this certificate again.`);
  }

  await supabase.from('certificates').update({ generation_status: 'generating', generation_error: null, updated_at: new Date().toISOString() }).eq('id', certificateId);

  const templateType = certificateTypeToTemplateType(certificate.certificate_type);
  let slidesPdf: Awaited<ReturnType<typeof createSlidesPdf>> = null;
  let slidesError = '';
  try {
    slidesPdf = await createSlidesPdf(certificate);
  } catch (error) {
    slidesError = error instanceof Error ? error.message : 'Google Slides certificate generator failed.';
  }
  let pdfBytes: Uint8Array;
  let templateUrl: string;

  if (slidesPdf) {
    pdfBytes = slidesPdf.pdfBytes;
    templateUrl = slidesPdf.templateUrl;
  } else {
    const { data: template, error: templateError } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('template_type', templateType)
      .eq('is_active', true)
      .single();
    if (templateError || !template) throw new Error(`Active ${templateType} template was not found.`);

    const { data: templateFile, error: downloadError } = await supabase.storage.from(text(template.storage_bucket, TEMPLATE_BUCKET)).download(text(template.storage_path));
    if (downloadError || !templateFile) throw new Error(downloadError?.message ?? 'Template download failed.');

    pdfBytes = await createPdf(new Uint8Array(await templateFile.arrayBuffer()), certificate);
    templateUrl = `${text(template.storage_bucket, TEMPLATE_BUCKET)}/${text(template.storage_path)}`;
  }
  const year = new Date().getFullYear();
  const folder = templateType === 'live_project' ? 'live-project' : 'leadership-program';
  const outputPath = `${folder}/${year}/${text(certificate.certificate_id)}-${Date.now()}.pdf`;
  const expiresAt = addHours(new Date(), PDF_TTL_HOURS).toISOString();

  const { error: uploadError } = await supabase.storage.from(TEMP_BUCKET).upload(outputPath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true
  });
  if (uploadError) throw uploadError;
  if (currentPath && currentPath !== outputPath) await supabase.storage.from(TEMP_BUCKET).remove([currentPath]);

  const updatePayload = {
    generation_error: slidesError ? `Google Slides fallback used: ${slidesError}` : null,
    generation_status: 'ready',
    pdf_expires_at: expiresAt,
    pdf_generated_at: new Date().toISOString(),
    pdf_storage_path: outputPath,
    template_url: templateUrl,
    updated_at: new Date().toISOString(),
    verification_url: verificationUrl(certificate)
  };
  const { data: updated, error: updateError } = await supabase.from('certificates').update(updatePayload).eq('id', certificateId).select('*').single();
  if (updateError) throw updateError;

  const { data: signed, error: signedError } = await supabase.storage.from(TEMP_BUCKET).createSignedUrl(outputPath, 60 * 60 * 24);
  if (signedError) throw signedError;
  if (options.sendEmail) {
    try {
      await sendCertificateEmail(supabase, { ...updated, pdf_expires_at: expiresAt }, pdfBytes, signed.signedUrl);
      await supabase.from('certificates').update({ email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', certificateId);
    } catch (error) {
      await supabase.from('certificates').update({
        generation_error: `PDF ready, but email failed: ${error instanceof Error ? error.message : 'unknown email error'}`,
        updated_at: new Date().toISOString()
      }).eq('id', certificateId);
    }
  }
  return { certificate: updated, expiresAt, signedUrl: signed.signedUrl, status: 'generated' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const actor = await getActor(supabase, request);
    const body = await request.json().catch(() => ({}));
    const certificateIds = Array.isArray(body.certificateIds) ? body.certificateIds.map(String) : [text(body.certificateId)].filter(Boolean);
    if (certificateIds.length === 0) throw new Error('Certificate ID is required.');
    if (certificateIds.length > 250) throw new Error('A maximum of 250 certificates can be generated at once.');

    const results = [];
    for (const certificateId of certificateIds) {
      try {
        results.push(await generateOne(supabase, certificateId, actor, {
          force: body.force === true,
          sendEmail: body.sendEmail === true
        }));
      } catch (error) {
        if (shouldMarkGenerationFailed(error)) {
          await supabase.from('certificates').update({
            generation_error: error instanceof Error ? error.message : 'Certificate generation failed.',
            generation_status: 'failed',
            updated_at: new Date().toISOString()
          }).eq('id', certificateId);
        }
        results.push({ certificateId, error: error instanceof Error ? error.message : 'Certificate generation failed.', status: 'failed' });
      }
    }
    return jsonResponse({ results, message: `${results.filter((result) => result.status !== 'failed').length} certificate PDF${results.length === 1 ? '' : 's'} ready.` });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Certificate generation failed.' }, 400);
  }
});
