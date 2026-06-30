import { CertificateGenerationJob } from './certificate-generation-plan';
import { createCertificatePdfRenderPlan } from './certificate-pdf-render-plan';

const job: CertificateGenerationJob = {
  idempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
  requestId: 'certificate_request:student@example.com:lp-123',
  certificateId: 'SS-LP-2026-0001',
  certificateType: 'live_project',
  status: 'pending',
  requestedBy: 'admin@example.com',
  payload: {
    studentEmail: ' Student@Example.com ',
    studentName: ' Student Name ',
    projectId: 'lp-123',
    projectTitle: 'Market Research Project',
    projectRole: 'Research Analyst',
    programKey: 'mba',
    programName: 'MBA',
    cohortName: 'MBA 2026'
  }
};

describe('createCertificatePdfRenderPlan', () => {
  it('plans a certificate PDF render document and private storage target', () => {
    expect(
      createCertificatePdfRenderPlan(job, {
        workerId: ' certificate-worker ',
        renderStartedAt: '2026-06-27T10:00:00.000Z',
        publicVerificationBaseUrl: 'https://skilledsapiens.com/verify-your-certificate/'
      })
    ).toEqual({
      shouldRender: true,
      reason: 'ready',
      idempotencyKey: 'certificate_pdf_render:certificate_request:student@example.com:lp-123:SS-LP-2026-0001',
      renderDocument: {
        certificateId: 'SS-LP-2026-0001',
        certificateType: 'live_project',
        studentName: 'Student Name',
        studentEmail: 'student@example.com',
        issueDate: '2026-06-27',
        projectId: 'lp-123',
        projectTitle: 'Market Research Project',
        projectRole: 'Research Analyst',
        programKey: 'mba',
        programName: 'MBA',
        cohortName: 'MBA 2026',
        verificationUrl: 'https://skilledsapiens.com/verify-your-certificate/?certId=SS-LP-2026-0001'
      },
      storageTarget: {
        bucket: 'certificates-private',
        path: 'live_project/SS-LP-2026-0001.pdf',
        contentType: 'application/pdf'
      },
      jobUpdate: {
        idempotency_key: 'certificate_generation:certificate_request:student@example.com:lp-123',
        status: 'generating',
        worker_id: 'certificate-worker',
        started_at: '2026-06-27T10:00:00.000Z',
        updated_at: '2026-06-27T10:00:00.000Z'
      },
      auditEvent: {
        idempotency_key: 'audit:certificate_pdf_render:certificate_request:student@example.com:lp-123:SS-LP-2026-0001',
        action: 'certificate.render_started',
        entity: 'certificate_generation_jobs',
        entity_id: 'certificate_generation:certificate_request:student@example.com:lp-123',
        actor_id: 'certificate-worker',
        previous_state: {
          jobStatus: 'pending'
        },
        next_state: {
          jobStatus: 'generating',
          certificateId: 'SS-LP-2026-0001',
          storageBucket: 'certificates-private',
          storagePath: 'live_project/SS-LP-2026-0001.pdf'
        }
      }
    });
  });

  it('blocks missing worker identity', () => {
    expect(createCertificatePdfRenderPlan(job, { workerId: ' ' })).toEqual({
      shouldRender: false,
      reason: 'missing_worker'
    });
  });

  it('blocks jobs that are already final or failed', () => {
    expect(createCertificatePdfRenderPlan({ ...job, status: 'ready' }, { workerId: 'certificate-worker' })).toEqual({
      shouldRender: false,
      reason: 'invalid_job_status'
    });
  });

  it('blocks missing certificate identity', () => {
    expect(createCertificatePdfRenderPlan({ ...job, certificateId: ' ' }, { workerId: 'certificate-worker' })).toEqual({
      shouldRender: false,
      reason: 'missing_certificate_identity'
    });
  });

  it('blocks missing student identity', () => {
    expect(createCertificatePdfRenderPlan({ ...job, payload: { ...job.payload, studentEmail: ' ' } }, { workerId: 'certificate-worker' })).toEqual({
      shouldRender: false,
      reason: 'missing_student_identity'
    });
  });
});
