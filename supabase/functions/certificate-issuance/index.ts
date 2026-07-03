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
const VERIFY_BASE_URL = Deno.env.get('CERTIFICATE_VERIFY_BASE_URL') ?? 'https://skilledsapiens.com/verify-your-certificate/';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  });
}

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
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

function drawCenteredText(page: any, value: string, y: number, size: number, font: any, color = rgb(0, 0, 0), maxWidth = 520) {
  const textWidth = font.widthOfTextAtSize(value, size);
  const x = Math.max(20, (page.getWidth() - Math.min(textWidth, maxWidth)) / 2);
  page.drawText(value, { x, y, size, font, color, maxWidth });
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
    cover(page, 310, 217, 210, 33);
    drawCenteredText(page, text(certificate.student_name), 229, 16, bold, black, 220);

    cover(page, 500, 166, 180, 40);
    page.drawText(`${text(certificate.project_role, 'Project')} Intern`, { x: 505, y: 189, size: 8, font: bold, color: black, maxWidth: 165 });

    cover(page, 280, 158, 300, 28);
    drawCenteredText(page, `${formatDate(certificate.project_start_date)} to ${formatDate(certificate.project_end_date)}`, 168, 10, regular, black, 280);

    cover(page, 450, 45, 172, 42);
    page.drawText(text(certificate.certificate_id), { x: 500, y: 66, size: 7, font: bold, color: black, maxWidth: 118 });
    page.drawText(formatDate(certificate.issue_date), { x: 500, y: 52, size: 8, font: bold, color: black, maxWidth: 118 });
    page.drawImage(qrImage, { x: 632, y: 43, width: 45, height: 45 });
  } else {
    cover(page, 255, 220, 225, 34);
    drawCenteredText(page, text(certificate.student_name), 232, 14, bold, red, 240);

    cover(page, 272, 196, 225, 22);
    page.drawText(text(certificate.program_name, text(certificate.program_key, 'Leadership Program')), { x: 276, y: 205, size: 6, font: bold, color: black, maxWidth: 200 });

    cover(page, 210, 140, 320, 46);
    const modules = Array.isArray(certificate.modules_covered) ? certificate.modules_covered.map(String).join(', ') : text(certificate.modules_covered);
    wrapText(modules, 72).forEach((line, index) => drawCenteredText(page, line, 166 - index * 10, 8, bold, red, 380));

    cover(page, 124, 32, 132, 30);
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

async function isAdmin(supabase: ReturnType<typeof createClient>, actor: { email: string; id: string }) {
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .or(`auth_user_id.eq.${actor.id},email.eq.${actor.email}`)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function sendCertificateEmail(certificate: CertificateRow, pdfBytes: Uint8Array, signedUrl: string) {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured.');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'updates@skilledsapiens.com';
  const senderName = Deno.env.get('BREVO_SENDER_NAME') ?? 'Skilled Sapiens';
  const subject = `Your Skilled Sapiens certificate: ${text(certificate.certificate_id)}`;
  const expiresAt = formatDate(certificate.pdf_expires_at);
  const html = `
    <p>Hi ${text(certificate.student_name, 'there')},</p>
    <p>Your Skilled Sapiens certificate is attached to this email.</p>
    <p>You can also download it from your portal using the temporary link. The link expires within 24 hours.</p>
    <p><a href="${signedUrl}">Download certificate</a></p>
    <p>Certificate ID: <strong>${text(certificate.certificate_id)}</strong></p>
    <p>Verification: <a href="${verificationUrl(certificate)}">${verificationUrl(certificate)}</a></p>
    ${expiresAt ? `<p>Temporary download expiry: ${expiresAt}</p>` : ''}
  `;
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
      attachment: [{
        content: attachment,
        name: `${text(certificate.certificate_id)}.pdf`
      }]
    })
  });
  if (!response.ok) throw new Error(`Brevo email failed: ${await response.text()}`);
}

async function generateOne(supabase: ReturnType<typeof createClient>, certificateId: string, actor: { email: string; id: string }, options: { force?: boolean; sendEmail?: boolean }) {
  const { data: certificate, error } = await supabase.from('certificates').select('*').eq('id', certificateId).single();
  if (error || !certificate) throw new Error('Certificate was not found.');
  if (certificate.status === 'revoked') throw new Error('Revoked certificates cannot be regenerated.');

  const actorIsAdmin = await isAdmin(supabase, actor);
  if (!actorIsAdmin && text(certificate.student_email).toLowerCase() !== actor.email) {
    throw new Error('You do not have access to this certificate.');
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
        await sendCertificateEmail(certificate, pdfBytes, signed.signedUrl);
        await supabase.from('certificates').update({ email_sent_at: new Date().toISOString(), generation_error: null, updated_at: new Date().toISOString() }).eq('id', certificateId);
      } catch (error) {
        await supabase.from('certificates').update({
          generation_error: `PDF ready, but email failed: ${error instanceof Error ? error.message : 'unknown email error'}`,
          updated_at: new Date().toISOString()
        }).eq('id', certificateId);
        throw error;
      }
    }
    return { certificate, expiresAt: certificate.pdf_expires_at, signedUrl: signed.signedUrl, status: 'reused' };
  }

  if (options.force && minutesAgo(certificate.pdf_generated_at) < REGENERATION_COOLDOWN_MINUTES) {
    throw new Error(`Please wait ${REGENERATION_COOLDOWN_MINUTES} minutes before regenerating this certificate again.`);
  }

  await supabase.from('certificates').update({ generation_status: 'generating', generation_error: null, updated_at: new Date().toISOString() }).eq('id', certificateId);

  const templateType = certificateTypeToTemplateType(certificate.certificate_type);
  const { data: template, error: templateError } = await supabase
    .from('certificate_templates')
    .select('*')
    .eq('template_type', templateType)
    .eq('is_active', true)
    .single();
  if (templateError || !template) throw new Error(`Active ${templateType} template was not found.`);

  const { data: templateFile, error: downloadError } = await supabase.storage.from(text(template.storage_bucket, TEMPLATE_BUCKET)).download(text(template.storage_path));
  if (downloadError || !templateFile) throw new Error(downloadError?.message ?? 'Template download failed.');

  const pdfBytes = await createPdf(new Uint8Array(await templateFile.arrayBuffer()), certificate);
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
    generation_error: null,
    generation_status: 'ready',
    pdf_expires_at: expiresAt,
    pdf_generated_at: new Date().toISOString(),
    pdf_storage_path: outputPath,
    template_url: `${text(template.storage_bucket, TEMPLATE_BUCKET)}/${text(template.storage_path)}`,
    updated_at: new Date().toISOString(),
    verification_url: verificationUrl(certificate)
  };
  const { data: updated, error: updateError } = await supabase.from('certificates').update(updatePayload).eq('id', certificateId).select('*').single();
  if (updateError) throw updateError;

  const { data: signed, error: signedError } = await supabase.storage.from(TEMP_BUCKET).createSignedUrl(outputPath, 60 * 60 * 24);
  if (signedError) throw signedError;
  if (options.sendEmail) {
    try {
      await sendCertificateEmail({ ...updated, pdf_expires_at: expiresAt }, pdfBytes, signed.signedUrl);
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
        await supabase.from('certificates').update({
          generation_error: error instanceof Error ? error.message : 'Certificate generation failed.',
          generation_status: 'failed',
          updated_at: new Date().toISOString()
        }).eq('id', certificateId);
        results.push({ certificateId, error: error instanceof Error ? error.message : 'Certificate generation failed.', status: 'failed' });
      }
    }
    return jsonResponse({ results, message: `${results.filter((result) => result.status !== 'failed').length} certificate PDF${results.length === 1 ? '' : 's'} ready.` });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Certificate generation failed.' }, 400);
  }
});
