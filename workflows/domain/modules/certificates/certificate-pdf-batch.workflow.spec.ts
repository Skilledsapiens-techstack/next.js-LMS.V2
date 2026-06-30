import { CertificatePdfBatchLoadResult } from './certificate-pdf-batch.loader';
import { CertificatePdfGenerationWorkflowResult } from './certificate-pdf-generation.workflow';
import { CertificatePdfBatchWorkflow } from './certificate-pdf-batch.workflow';

class MockBatchLoader {
  result: CertificatePdfBatchLoadResult = {
    status: 'ready',
    jobIdempotencyKeys: ['cert-pending-1', 'cert-stale-generating'],
    message: 'Certificate PDF batch loaded.'
  };
  input?: unknown;

  loadPendingBatch(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockGenerationWorkflow {
  calls: unknown[] = [];
  result: CertificatePdfGenerationWorkflowResult = {
    status: 'storage_disabled',
    message: 'Certificate PDF storage writes are disabled. No storage write was attempted.'
  };

  generateCertificatePdf(input: unknown) {
    this.calls.push(input);
    return Promise.resolve(this.result);
  }
}

describe('CertificatePdfBatchWorkflow', () => {
  it('requires a worker ID before loading a certificate PDF batch', async () => {
    const loader = new MockBatchLoader();
    const generation = new MockGenerationWorkflow();
    const workflow = new CertificatePdfBatchWorkflow(loader as never, generation as never);

    await expect(workflow.processBatch({ workerId: ' ' })).resolves.toEqual({
      status: 'empty',
      message: 'Certificate PDF batch skipped: worker ID is required.',
      requestedCount: 0,
      processedCount: 0,
      results: []
    });
    expect(loader.input).toBeUndefined();
    expect(generation.calls).toEqual([]);
  });

  it('returns empty loader results without calling the generation workflow', async () => {
    const loader = new MockBatchLoader();
    loader.result = {
      status: 'empty',
      jobIdempotencyKeys: [],
      message: 'No certificate PDF jobs are ready.'
    };
    const generation = new MockGenerationWorkflow();
    const workflow = new CertificatePdfBatchWorkflow(loader as never, generation as never);

    await expect(workflow.processBatch({ workerId: 'certificate-worker-1', now: '2026-06-27T10:00:00.000Z' })).resolves.toEqual({
      status: 'empty',
      message: 'No certificate PDF jobs are ready.',
      requestedCount: 0,
      processedCount: 0,
      results: []
    });
    expect(generation.calls).toEqual([]);
  });

  it('processes each loaded certificate PDF job key sequentially through the generation workflow', async () => {
    const loader = new MockBatchLoader();
    const generation = new MockGenerationWorkflow();
    const workflow = new CertificatePdfBatchWorkflow(loader as never, generation as never);

    await expect(
      workflow.processBatch({
        workerId: ' certificate-worker-1 ',
        now: '2026-06-27T10:00:00.000Z',
        limit: 10,
        staleGeneratingMinutes: 30,
        issueDate: '2026-06-27',
        storageBucket: 'certificates-private',
        publicVerificationBaseUrl: 'https://example.com/verify',
        publicVerificationUrl: 'https://example.com/verify/CERT-1',
        generatedAt: '2026-06-27T10:01:00.000Z'
      })
    ).resolves.toEqual({
      status: 'processed',
      message: 'Certificate PDF batch processed.',
      requestedCount: 2,
      processedCount: 2,
      results: [
        {
          jobIdempotencyKey: 'cert-pending-1',
          result: generation.result
        },
        {
          jobIdempotencyKey: 'cert-stale-generating',
          result: generation.result
        }
      ]
    });
    expect(loader.input).toEqual({
      workerId: ' certificate-worker-1 ',
      now: '2026-06-27T10:00:00.000Z',
      limit: 10,
      staleGeneratingMinutes: 30,
      issueDate: '2026-06-27',
      storageBucket: 'certificates-private',
      publicVerificationBaseUrl: 'https://example.com/verify',
      publicVerificationUrl: 'https://example.com/verify/CERT-1',
      generatedAt: '2026-06-27T10:01:00.000Z'
    });
    expect(generation.calls).toEqual([
      {
        jobIdempotencyKey: 'cert-pending-1',
        workerId: 'certificate-worker-1',
        renderStartedAt: '2026-06-27T10:00:00.000Z',
        issueDate: '2026-06-27',
        storageBucket: 'certificates-private',
        publicVerificationBaseUrl: 'https://example.com/verify',
        publicVerificationUrl: 'https://example.com/verify/CERT-1',
        generatedAt: '2026-06-27T10:01:00.000Z'
      },
      {
        jobIdempotencyKey: 'cert-stale-generating',
        workerId: 'certificate-worker-1',
        renderStartedAt: '2026-06-27T10:00:00.000Z',
        issueDate: '2026-06-27',
        storageBucket: 'certificates-private',
        publicVerificationBaseUrl: 'https://example.com/verify',
        publicVerificationUrl: 'https://example.com/verify/CERT-1',
        generatedAt: '2026-06-27T10:01:00.000Z'
      }
    ]);
  });
});
