import { CertificateGenerationJob, createCertificateGenerationPlan } from './certificate-generation-plan';

const job: CertificateGenerationJob = {
  idempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
  requestId: 'certificate_request:student@example.com:lp-123',
  certificateId: 'SS-LP-2026-0001',
  certificateType: 'live_project',
  status: 'generating',
  requestedBy: 'admin@example.com',
  payload: {
    studentEmail: ' Student@Example.com ',
    studentName: 'Student Name',
    projectId: 'lp-123',
    projectTitle: 'Market Research Project',
    projectRole: 'Research Analyst',
    programKey: 'mba',
    programName: 'MBA',
    cohortName: 'MBA 2026'
  }
};

describe('createCertificateGenerationPlan', () => {
  it('plans certificate finalization from a generated private-storage PDF result', () => {
    expect(
      createCertificateGenerationPlan(job, {
        workerId: ' certificate-worker ',
        generatedAt: '2026-06-27T10:00:00.000Z',
        storageBucket: ' certificates-private ',
        storagePath: ' live-project/SS-LP-2026-0001.pdf ',
        pdfSha256: ' abc123 ',
        publicVerificationUrl: 'https://skilledsapiens.com/verify-your-certificate/?certId=SS-LP-2026-0001'
      })
    ).toEqual({
      shouldFinalize: true,
      reason: 'ready',
      idempotencyKey: 'certificate_generation_finalize:certificate_request:student@example.com:lp-123:SS-LP-2026-0001',
      certificateRow: {
        certificate_id: 'SS-LP-2026-0001',
        certificate_type: 'live_project',
        student_email: 'student@example.com',
        student_name: 'Student Name',
        program_key: 'mba',
        program_name: 'MBA',
        cohort_name: 'MBA 2026',
        project_id: 'lp-123',
        project_title: 'Market Research Project',
        issue_date: '2026-06-27',
        status: 'issued',
        generation_status: 'ready',
        issued_by: 'certificate-worker',
        pdf_storage_bucket: 'certificates-private',
        pdf_storage_path: 'live-project/SS-LP-2026-0001.pdf',
        pdf_sha256: 'abc123',
        public_verification_url: 'https://skilledsapiens.com/verify-your-certificate/?certId=SS-LP-2026-0001',
        source_request_id: 'certificate_request:student@example.com:lp-123',
        idempotency_key: 'certificate_generation_finalize:certificate_request:student@example.com:lp-123:SS-LP-2026-0001',
        created_at: '2026-06-27T10:00:00.000Z',
        updated_at: '2026-06-27T10:00:00.000Z'
      },
      jobUpdate: {
        idempotency_key: 'certificate_generation:certificate_request:student@example.com:lp-123',
        status: 'ready',
        completed_at: '2026-06-27T10:00:00.000Z',
        storage_bucket: 'certificates-private',
        storage_path: 'live-project/SS-LP-2026-0001.pdf',
        pdf_sha256: 'abc123',
        updated_at: '2026-06-27T10:00:00.000Z'
      },
      auditEvent: {
        idempotency_key: 'audit:certificate_generation_finalize:certificate_request:student@example.com:lp-123:SS-LP-2026-0001',
        action: 'certificate.generated',
        entity: 'certificates',
        entity_id: 'SS-LP-2026-0001',
        actor_id: 'certificate-worker',
        previous_state: {
          jobStatus: 'generating'
        },
        next_state: {
          certificateId: 'SS-LP-2026-0001',
          jobStatus: 'ready',
          storageBucket: 'certificates-private',
          storagePath: 'live-project/SS-LP-2026-0001.pdf'
        }
      }
    });
  });

  it('blocks missing worker identity', () => {
    expect(
      createCertificateGenerationPlan(job, {
        workerId: ' ',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
      })
    ).toEqual({
      shouldFinalize: false,
      reason: 'missing_worker'
    });
  });

  it('blocks jobs that are already final or failed', () => {
    expect(
      createCertificateGenerationPlan(
        { ...job, status: 'ready' },
        {
          workerId: 'certificate-worker',
          storageBucket: 'certificates-private',
          storagePath: 'live-project/SS-LP-2026-0001.pdf',
          pdfSha256: 'abc123'
        }
      )
    ).toEqual({
      shouldFinalize: false,
      reason: 'invalid_job_status'
    });
  });

  it('requires a complete private-storage generation result', () => {
    expect(
      createCertificateGenerationPlan(job, {
        workerId: 'certificate-worker',
        storageBucket: 'certificates-private',
        storagePath: ' ',
        pdfSha256: 'abc123'
      })
    ).toEqual({
      shouldFinalize: false,
      reason: 'missing_storage_result'
    });
  });
});
