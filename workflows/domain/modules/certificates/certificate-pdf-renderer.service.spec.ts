import { CertificateGenerationJob } from './certificate-generation-plan';
import { createCertificatePdfRenderPlan } from './certificate-pdf-render-plan';
import { CertificatePdfRendererService } from './certificate-pdf-renderer.service';

const job: CertificateGenerationJob = {
  idempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
  requestId: 'certificate_request:student@example.com:lp-123',
  certificateId: 'SS-LP-2026-0001',
  certificateType: 'live_project',
  status: 'pending',
  requestedBy: 'admin@example.com',
  payload: {
    studentEmail: 'student@example.com',
    studentName: 'Student (Name)',
    projectId: 'lp-123',
    projectTitle: 'Market Research Project',
    projectRole: 'Research Analyst',
    programKey: 'mba',
    programName: 'MBA',
    cohortName: 'MBA 2026'
  }
};

describe('CertificatePdfRendererService', () => {
  it('renders a deterministic PDF buffer and storage metadata from a render plan', () => {
    const service = new CertificatePdfRendererService();
    const result = service.render(
      createCertificatePdfRenderPlan(job, {
        workerId: 'certificate-worker',
        renderStartedAt: '2026-06-27T10:00:00.000Z',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        publicVerificationBaseUrl: 'https://skilledsapiens.com/verify-your-certificate/'
      })
    );
    const pdfText = result.pdfBytes.toString('utf8');

    expect(result).toMatchObject({
      contentType: 'application/pdf',
      storageBucket: 'certificates-private',
      storagePath: 'live-project/SS-LP-2026-0001.pdf',
      byteLength: result.pdfBytes.length
    });
    expect(result.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('%%EOF');
    expect(pdfText).toContain('Skilled Sapiens Certificate');
    expect(pdfText).toContain('Live Project Completion');
    expect(pdfText).toContain('Student \\(Name\\)');
    expect(pdfText).toContain('https://skilledsapiens.com/verify-your-certificate/?certId=SS-LP-2026-0001');
  });

  it('returns the same PDF hash for the same render plan', () => {
    const service = new CertificatePdfRendererService();
    const plan = createCertificatePdfRenderPlan(job, {
      workerId: 'certificate-worker',
      renderStartedAt: '2026-06-27T10:00:00.000Z'
    });

    expect(service.render(plan).pdfSha256).toBe(service.render(plan).pdfSha256);
  });

  it('rejects plans that are not safe to render', () => {
    const service = new CertificatePdfRendererService();
    const plan = createCertificatePdfRenderPlan({ ...job, status: 'ready' }, { workerId: 'certificate-worker' });

    expect(() => service.render(plan)).toThrow('Certificate PDF cannot be rendered from plan: invalid_job_status.');
  });
});
