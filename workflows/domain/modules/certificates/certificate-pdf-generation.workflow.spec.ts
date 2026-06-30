import { CertificateGenerationWorkflowResult } from './certificate-generation.workflow';
import { CertificatePdfGenerationWorkflow } from './certificate-pdf-generation.workflow';
import { CertificatePdfRenderExecutionResult } from './certificate-pdf-render.executor';
import { CertificatePdfRenderLoadResult } from './certificate-pdf-render.loader';
import { CertificatePdfRenderResult } from './certificate-pdf-renderer.service';
import { CertificatePdfStorageWriteResult } from './certificate-pdf-storage.writer';
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
    studentEmail: 'student@example.com',
    studentName: 'Student Name',
    projectId: 'lp-123',
    projectTitle: 'Market Research Project',
    projectRole: 'Research Analyst',
    programKey: 'mba',
    programName: 'MBA',
    cohortName: 'MBA 2026'
  }
};

const plan = createCertificatePdfRenderPlan(job, {
  workerId: 'certificate-worker',
  renderStartedAt: '2026-06-27T10:00:00.000Z',
  storageBucket: 'certificates-private',
  storagePath: 'live-project/SS-LP-2026-0001.pdf',
  publicVerificationBaseUrl: 'https://skilledsapiens.com/verify-your-certificate/'
});

const renderResult: CertificatePdfRenderResult = {
  contentType: 'application/pdf',
  storageBucket: 'certificates-private',
  storagePath: 'live-project/SS-LP-2026-0001.pdf',
  pdfBytes: Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8'),
  pdfSha256: 'a'.repeat(64),
  byteLength: 15
};

const renderStartResult: CertificatePdfRenderExecutionResult = {
  enabled: false,
  attempted: false,
  status: 'disabled',
  jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
  message: 'Certificate PDF render-start writes are disabled. No Supabase write was attempted.',
  completedSteps: []
};

const storageDisabledResult: CertificatePdfStorageWriteResult = {
  enabled: false,
  attempted: false,
  status: 'disabled',
  storageBucket: 'certificates-private',
  storagePath: 'live-project/SS-LP-2026-0001.pdf',
  contentType: 'application/pdf',
  pdfSha256: 'a'.repeat(64),
  byteLength: 15,
  message: 'Certificate PDF storage writes are disabled. No Supabase Storage write was attempted.'
};

class MockRenderLoader {
  input?: unknown;
  result: CertificatePdfRenderLoadResult = {
    status: 'ready',
    message: 'Certificate PDF render plan loaded.',
    plan
  };

  loadPlan(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockRenderStartExecutor {
  plan?: unknown;
  result = renderStartResult;

  execute(planInput: unknown) {
    this.plan = planInput;
    return Promise.resolve(this.result);
  }
}

class MockRenderer {
  plan?: unknown;
  result = renderResult;

  render(planInput: unknown) {
    this.plan = planInput;
    return this.result;
  }
}

class MockStorageWriter {
  renderResult?: unknown;
  result = storageDisabledResult;

  upload(renderResultInput: unknown) {
    this.renderResult = renderResultInput;
    return Promise.resolve(this.result);
  }
}

class MockFinalizationWorkflow {
  input?: unknown;
  result: CertificateGenerationWorkflowResult = {
    status: 'disabled',
    message: 'Certificate generation finalization writes are disabled. No Supabase write was attempted.'
  };

  finalizeCertificate(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

function createWorkflow() {
  const loader = new MockRenderLoader();
  const renderStartExecutor = new MockRenderStartExecutor();
  const renderer = new MockRenderer();
  const storageWriter = new MockStorageWriter();
  const finalizationWorkflow = new MockFinalizationWorkflow();
  const workflow = new CertificatePdfGenerationWorkflow(
    loader as never,
    renderStartExecutor as never,
    renderer as never,
    storageWriter as never,
    finalizationWorkflow as never
  );

  return {
    workflow,
    loader,
    renderStartExecutor,
    renderer,
    storageWriter,
    finalizationWorkflow
  };
}

describe('CertificatePdfGenerationWorkflow', () => {
  it('returns not found without rendering when source loading fails', async () => {
    const { workflow, loader, renderStartExecutor, renderer, storageWriter, finalizationWorkflow } = createWorkflow();
    loader.result = {
      status: 'not_found',
      message: 'No certificate generation job matched the PDF render source identity.'
    };

    await expect(
      workflow.generateCertificatePdf({
        jobIdempotencyKey: 'missing-job',
        workerId: 'certificate-worker'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No certificate generation job matched the PDF render source identity.'
    });
    expect(renderStartExecutor.plan).toBeUndefined();
    expect(renderer.plan).toBeUndefined();
    expect(storageWriter.renderResult).toBeUndefined();
    expect(finalizationWorkflow.input).toBeUndefined();
  });

  it('skips unsafe plans before render-start execution', async () => {
    const { workflow, loader, renderStartExecutor, renderer } = createWorkflow();
    loader.result = {
      status: 'ready',
      message: 'Certificate PDF render plan loaded.',
      plan: createCertificatePdfRenderPlan({ ...job, status: 'ready' }, { workerId: 'certificate-worker' })
    };

    await expect(
      workflow.generateCertificatePdf({
        jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
        workerId: 'certificate-worker'
      })
    ).resolves.toEqual({
      status: 'skipped',
      message: 'Certificate PDF generation skipped: invalid_job_status.'
    });
    expect(renderStartExecutor.plan).toBeUndefined();
    expect(renderer.plan).toBeUndefined();
  });

  it('renders locally and stops before finalization when storage writes are disabled', async () => {
    const { workflow, loader, renderStartExecutor, renderer, storageWriter, finalizationWorkflow } = createWorkflow();
    const input = {
      jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
      workerId: 'certificate-worker',
      generatedAt: '2026-06-27T10:05:00.000Z'
    };

    await expect(workflow.generateCertificatePdf(input)).resolves.toEqual({
      status: 'storage_disabled',
      message: 'Certificate PDF storage writes are disabled. No Supabase Storage write was attempted.',
      renderStart: renderStartResult,
      renderResult: {
        contentType: 'application/pdf',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'a'.repeat(64),
        byteLength: 15
      },
      storage: storageDisabledResult
    });
    expect(loader.input).toEqual(input);
    expect(renderStartExecutor.plan).toBe(plan);
    expect(renderer.plan).toBe(plan);
    expect(storageWriter.renderResult).toBe(renderResult);
    expect(finalizationWorkflow.input).toBeUndefined();
  });

  it('finalizes the certificate only after storage upload succeeds', async () => {
    const { workflow, storageWriter, finalizationWorkflow } = createWorkflow();
    storageWriter.result = {
      ...storageDisabledResult,
      enabled: true,
      attempted: true,
      status: 'uploaded',
      message: 'Certificate PDF uploaded to private storage.'
    };
    finalizationWorkflow.result = {
      status: 'disabled',
      message: 'Certificate generation finalization writes are disabled. No Supabase write was attempted.',
      certificateId: 'SS-LP-2026-0001'
    };

    await expect(
      workflow.generateCertificatePdf({
        jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
        workerId: 'certificate-worker',
        generatedAt: '2026-06-27T10:05:00.000Z',
        issueDate: '2026-06-27'
      })
    ).resolves.toMatchObject({
      status: 'disabled',
      message: 'Certificate generation finalization writes are disabled. No Supabase write was attempted.',
      finalization: finalizationWorkflow.result
    });
    expect(finalizationWorkflow.input).toEqual({
      jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
      workerId: 'certificate-worker',
      generatedAt: '2026-06-27T10:05:00.000Z',
      issueDate: '2026-06-27',
      storageBucket: 'certificates-private',
      storagePath: 'live-project/SS-LP-2026-0001.pdf',
      pdfSha256: 'a'.repeat(64),
      publicVerificationUrl: 'https://skilledsapiens.com/verify-your-certificate/?certId=SS-LP-2026-0001'
    });
  });

  it('stops when render-start writes fail', async () => {
    const { workflow, renderStartExecutor, renderer } = createWorkflow();
    renderStartExecutor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
      message: 'render-start update failed',
      completedSteps: [],
      failedStep: 'certificate_generation_jobs'
    };

    await expect(
      workflow.generateCertificatePdf({
        jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
        workerId: 'certificate-worker'
      })
    ).resolves.toEqual({
      status: 'render_start_failed',
      message: 'render-start update failed',
      renderStart: renderStartExecutor.result
    });
    expect(renderer.plan).toBeUndefined();
  });
});
