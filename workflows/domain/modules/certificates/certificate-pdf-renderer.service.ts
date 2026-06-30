import { BadRequestException } from "@app/common/runtime/errors";
import { createHash } from 'crypto';
import { CertificatePdfRenderPlan } from './certificate-pdf-render-plan';

export type CertificatePdfRenderResult = {
  contentType: 'application/pdf';
  storageBucket: string;
  storagePath: string;
  pdfBytes: Buffer;
  pdfSha256: string;
  byteLength: number;
};

type RenderableCertificatePdfPlan = CertificatePdfRenderPlan & {
  shouldRender: true;
  renderDocument: NonNullable<CertificatePdfRenderPlan['renderDocument']>;
  storageTarget: NonNullable<CertificatePdfRenderPlan['storageTarget']>;
};
export class CertificatePdfRendererService {
  render(plan: CertificatePdfRenderPlan): CertificatePdfRenderResult {
    if (!this.isRenderable(plan)) {
      throw new BadRequestException(`Certificate PDF cannot be rendered from plan: ${plan.reason}.`);
   }

    const pdfBytes = createCertificatePdfBytes([
      { size: 20, text: 'Skilled Sapiens Certificate' },
      { size: 16, text: titleFor(plan.renderDocument.certificateType) },
      { size: 13, text: `Certificate ID: ${plan.renderDocument.certificateId}` },
      { size: 13, text: `Issued to: ${plan.renderDocument.studentName}` },
      { size: 11, text: `Student email: ${plan.renderDocument.studentEmail}` },
      { size: 11, text: `Issue date: ${plan.renderDocument.issueDate}` },
      { size: 11, text: optionalLine('Program', plan.renderDocument.programName) },
      { size: 11, text: optionalLine('Cohort', plan.renderDocument.cohortName) },
      { size: 11, text: optionalLine('Project', plan.renderDocument.projectTitle) },
      { size: 11, text: optionalLine('Role', plan.renderDocument.projectRole) },
      { size: 9, text: optionalLine('Verification', plan.renderDocument.verificationUrl) }
    ]);

    return {
      contentType: 'application/pdf',
      storageBucket: plan.storageTarget.bucket,
      storagePath: plan.storageTarget.path,
      pdfBytes,
      pdfSha256: createHash('sha256').update(pdfBytes).digest('hex'),
      byteLength: pdfBytes.length
   };
 }

  private isRenderable(plan: CertificatePdfRenderPlan): plan is RenderableCertificatePdfPlan {
    return Boolean(plan.shouldRender && plan.renderDocument && plan.storageTarget);
 }
}

type PdfLine = {
  size: number;
  text?: string;
};

function createCertificatePdfBytes(lines: PdfLine[]): Buffer {
  const visibleLines = lines.filter((line) => line.text);
  const content = [
    'BT',
    '/F1 20 Tf',
    '72 760 Td',
    ...visibleLines.flatMap((line, index) => {
      const yOffset = index === 0 ? 0 : -34;
      return [`/F1 ${line.size} Tf`, `0 ${yOffset} Td`, `(${escapePdfText(line.text ?? '')}) Tj`];
   }),
    'ET'
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
 }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
 }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

function titleFor(certificateType: string): string {
  if (certificateType === 'live_project') return 'Live Project Completion';
  return 'Certificate Of Completion';
}

function optionalLine(label: string, value: string | undefined): string | undefined {
  return value ? `${label}: ${value}` : undefined;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
