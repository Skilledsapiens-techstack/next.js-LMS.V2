import { CertificateGenerationJob, CertificateGenerationJobStatus, CertificateType } from './certificate-generation-plan';

export type CertificatePdfRenderInput = {
  workerId: string;
  renderStartedAt?: string;
  issueDate?: string;
  storageBucket?: string;
  storagePath?: string;
  publicVerificationBaseUrl?: string;
};

export type CertificatePdfRenderPlan = {
  shouldRender: boolean;
  reason: 'ready' | 'missing_worker' | 'invalid_job_status' | 'missing_certificate_identity' | 'missing_student_identity';
  idempotencyKey?: string;
  renderDocument?: {
    certificateId: string;
    certificateType: CertificateType;
    studentName: string;
    studentEmail: string;
    issueDate: string;
    projectId?: string;
    projectTitle?: string;
    projectRole?: string;
    programKey?: string;
    programName?: string;
    cohortName?: string;
    verificationUrl?: string;
  };
  storageTarget?: {
    bucket: string;
    path: string;
    contentType: 'application/pdf';
  };
  jobUpdate?: {
    idempotency_key: string;
    status: 'generating';
    worker_id: string;
    started_at: string;
    updated_at: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'certificate.render_started';
    entity: 'certificate_generation_jobs';
    entity_id: string;
    actor_id: string;
    previous_state: {
      jobStatus: CertificateGenerationJobStatus;
    };
    next_state: {
      jobStatus: 'generating';
      certificateId: string;
      storageBucket: string;
      storagePath: string;
    };
  };
};

export function createCertificatePdfRenderPlan(job: CertificateGenerationJob, input: CertificatePdfRenderInput): CertificatePdfRenderPlan {
  const workerId = cleanText(input.workerId);

  if (!workerId) {
    return { shouldRender: false, reason: 'missing_worker' };
  }

  if (job.status !== 'pending' && job.status !== 'generating') {
    return { shouldRender: false, reason: 'invalid_job_status' };
  }

  const certificateId = cleanText(job.certificateId);
  const requestId = cleanText(job.requestId);

  if (!certificateId || !requestId) {
    return { shouldRender: false, reason: 'missing_certificate_identity' };
  }

  const studentName = cleanText(job.payload.studentName);
  const studentEmail = normalizeEmail(job.payload.studentEmail);

  if (!studentName || !studentEmail) {
    return { shouldRender: false, reason: 'missing_student_identity' };
  }

  const renderStartedAt = cleanText(input.renderStartedAt) ?? new Date().toISOString();
  const issueDate = cleanText(input.issueDate) ?? renderStartedAt.slice(0, 10);
  const storageBucket = cleanText(input.storageBucket) ?? 'certificates-private';
  const storagePath = cleanText(input.storagePath) ?? defaultStoragePath(job.certificateType, certificateId);
  const verificationUrl = verificationUrlFor(cleanText(input.publicVerificationBaseUrl), certificateId);
  const idempotencyKey = `certificate_pdf_render:${requestId}:${certificateId}`;

  return {
    shouldRender: true,
    reason: 'ready',
    idempotencyKey,
    renderDocument: {
      certificateId,
      certificateType: job.certificateType,
      studentName,
      studentEmail,
      issueDate,
      projectId: cleanText(job.payload.projectId),
      projectTitle: cleanText(job.payload.projectTitle),
      projectRole: cleanText(job.payload.projectRole),
      programKey: cleanText(job.payload.programKey),
      programName: cleanText(job.payload.programName),
      cohortName: cleanText(job.payload.cohortName),
      verificationUrl
    },
    storageTarget: {
      bucket: storageBucket,
      path: storagePath,
      contentType: 'application/pdf'
    },
    jobUpdate: {
      idempotency_key: job.idempotencyKey,
      status: 'generating',
      worker_id: workerId,
      started_at: renderStartedAt,
      updated_at: renderStartedAt
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}`,
      action: 'certificate.render_started',
      entity: 'certificate_generation_jobs',
      entity_id: job.idempotencyKey,
      actor_id: workerId,
      previous_state: {
        jobStatus: job.status
      },
      next_state: {
        jobStatus: 'generating',
        certificateId,
        storageBucket,
        storagePath
      }
    }
  };
}

function defaultStoragePath(certificateType: CertificateType, certificateId: string): string {
  return `${certificateType}/${certificateId}.pdf`;
}

function verificationUrlFor(baseUrl: string | undefined, certificateId: string): string | undefined {
  if (!baseUrl) return undefined;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}certId=${encodeURIComponent(certificateId)}`;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
