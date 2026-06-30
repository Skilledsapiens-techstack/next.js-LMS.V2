import { CertificateGenerationExecutionResult } from './certificate-generation.executor';
import { CertificateGenerationLoadResult } from './certificate-generation.loader';
import { createCertificateGenerationPlan } from './certificate-generation-plan';
import { CertificateGenerationWorkflow } from './certificate-generation.workflow';

class MockLoader {
  input?: unknown;
  result: CertificateGenerationLoadResult = {
    status: 'ready',
    message: 'Certificate generation finalization plan loaded.',
    plan: createCertificateGenerationPlan(
      {
        idempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
        requestId: 'certificate_request:student@example.com:lp-123',
        certificateId: 'SS-LP-2026-0001',
        certificateType: 'live_project',
        status: 'generating',
        requestedBy: 'admin@example.com',
        payload: {
          studentEmail: 'student@example.com',
          studentName: 'Student Name',
          projectId: 'lp-123',
          projectTitle: 'Market Research Project',
          projectRole: 'Research Analyst',
          programKey: 'mba',
          programName: 'MBA',
          cohortName: 'MBA 2026'
        }
      },
      {
        workerId: 'certificate-worker',
        generatedAt: '2026-06-27T10:00:00.000Z',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
      }
    )
  };

  loadPlan(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockExecutor {
  plan?: unknown;
  result: CertificateGenerationExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    certificateId: 'SS-LP-2026-0001',
    message: 'Certificate generation finalization writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('CertificateGenerationWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new CertificateGenerationWorkflow(loader as never, executor as never);
    const input = {
      jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
      workerId: 'certificate-worker',
      storageBucket: 'certificates-private',
      storagePath: 'live-project/SS-LP-2026-0001.pdf',
      pdfSha256: 'abc123'
    };

    await expect(workflow.finalizeCertificate(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Certificate generation finalization writes are disabled. No Supabase write was attempted.',
      certificateId: 'SS-LP-2026-0001',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No certificate generation job matched the finalization source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new CertificateGenerationWorkflow(loader as never, executor as never);

    await expect(
      workflow.finalizeCertificate({
        jobIdempotencyKey: 'missing-job',
        workerId: 'certificate-worker',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No certificate generation job matched the finalization source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns certificate generation failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      certificateId: 'SS-LP-2026-0001',
      message: 'generation job update failed',
      completedSteps: ['certificates'],
      failedStep: 'certificate_generation_jobs'
    };
    const workflow = new CertificateGenerationWorkflow(loader as never, executor as never);

    await expect(
      workflow.finalizeCertificate({
        jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
        workerId: 'certificate-worker',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'generation job update failed',
      certificateId: 'SS-LP-2026-0001',
      execution: executor.result
    });
  });
});
