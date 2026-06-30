export type CertificateGenerationJobStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type CertificateType = 'leadership' | 'live_project';

export type CertificateGenerationJob = {
  idempotencyKey: string;
  requestId: string;
  certificateId: string;
  certificateType: CertificateType;
  status: CertificateGenerationJobStatus;
  requestedBy: string;
  payload: {
    studentEmail: string;
    studentName: string;
    projectId?: string;
    projectTitle?: string;
    projectRole?: string;
    programKey?: string;
    programName?: string;
    cohortName?: string;
  };
};

export type CertificateGenerationResultInput = {
  workerId: string;
  generatedAt?: string;
  issueDate?: string;
  storageBucket: string;
  storagePath: string;
  pdfSha256: string;
  publicVerificationUrl?: string;
};

export type CertificateGenerationPlan = {
  shouldFinalize: boolean;
  reason: 'ready' | 'missing_worker' | 'invalid_job_status' | 'missing_storage_result';
  idempotencyKey?: string;
  certificateRow?: {
    certificate_id: string;
    certificate_type: CertificateType;
    student_email: string;
    student_name: string;
    program_key?: string;
    program_name?: string;
    cohort_name?: string;
    project_id?: string;
    project_title?: string;
    issue_date: string;
    status: 'issued';
    generation_status: 'ready';
    issued_by: string;
    pdf_storage_bucket: string;
    pdf_storage_path: string;
    pdf_sha256: string;
    public_verification_url?: string;
    source_request_id: string;
    idempotency_key: string;
    created_at: string;
    updated_at: string;
  };
  jobUpdate?: {
    idempotency_key: string;
    status: 'ready';
    completed_at: string;
    storage_bucket: string;
    storage_path: string;
    pdf_sha256: string;
    updated_at: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'certificate.generated';
    entity: 'certificates';
    entity_id: string;
    actor_id: string;
    previous_state: {
      jobStatus: CertificateGenerationJobStatus;
    };
    next_state: {
      certificateId: string;
      jobStatus: 'ready';
      storageBucket: string;
      storagePath: string;
    };
  };
};

export function createCertificateGenerationPlan(
  job: CertificateGenerationJob,
  input: CertificateGenerationResultInput
): CertificateGenerationPlan {
  const workerId = cleanText(input.workerId);

  if (!workerId) {
    return { shouldFinalize: false, reason: 'missing_worker' };
  }

  if (job.status !== 'pending' && job.status !== 'generating') {
    return { shouldFinalize: false, reason: 'invalid_job_status' };
  }

  const storageBucket = cleanText(input.storageBucket);
  const storagePath = cleanText(input.storagePath);
  const pdfSha256 = cleanText(input.pdfSha256);

  if (!storageBucket || !storagePath || !pdfSha256) {
    return { shouldFinalize: false, reason: 'missing_storage_result' };
  }

  const generatedAt = cleanText(input.generatedAt) ?? new Date().toISOString();
  const issueDate = cleanText(input.issueDate) ?? generatedAt.slice(0, 10);
  const idempotencyKey = `certificate_generation_finalize:${job.requestId}:${job.certificateId}`;
  const normalizedStudentEmail = normalizeEmail(job.payload.studentEmail);

  return {
    shouldFinalize: true,
    reason: 'ready',
    idempotencyKey,
    certificateRow: {
      certificate_id: job.certificateId,
      certificate_type: job.certificateType,
      student_email: normalizedStudentEmail,
      student_name: job.payload.studentName,
      program_key: cleanText(job.payload.programKey),
      program_name: cleanText(job.payload.programName),
      cohort_name: cleanText(job.payload.cohortName),
      project_id: cleanText(job.payload.projectId),
      project_title: cleanText(job.payload.projectTitle),
      issue_date: issueDate,
      status: 'issued',
      generation_status: 'ready',
      issued_by: workerId,
      pdf_storage_bucket: storageBucket,
      pdf_storage_path: storagePath,
      pdf_sha256: pdfSha256,
      public_verification_url: cleanText(input.publicVerificationUrl),
      source_request_id: job.requestId,
      idempotency_key: idempotencyKey,
      created_at: generatedAt,
      updated_at: generatedAt
    },
    jobUpdate: {
      idempotency_key: job.idempotencyKey,
      status: 'ready',
      completed_at: generatedAt,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      pdf_sha256: pdfSha256,
      updated_at: generatedAt
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}`,
      action: 'certificate.generated',
      entity: 'certificates',
      entity_id: job.certificateId,
      actor_id: workerId,
      previous_state: {
        jobStatus: job.status
      },
      next_state: {
        certificateId: job.certificateId,
        jobStatus: 'ready',
        storageBucket,
        storagePath
      }
    }
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
