import {
  CertificatePdfBatchLoadInput,
  CertificatePdfBatchLoader
} from './certificate-pdf-batch.loader';
import {
  CertificatePdfGenerationWorkflow,
  CertificatePdfGenerationWorkflowResult
} from './certificate-pdf-generation.workflow';

export type CertificatePdfBatchWorkflowInput = CertificatePdfBatchLoadInput & {
  workerId: string;
  issueDate?: string;
  storageBucket?: string;
  publicVerificationBaseUrl?: string;
  publicVerificationUrl?: string;
  generatedAt?: string;
};

export type CertificatePdfBatchWorkflowResult = {
  status: 'empty' | 'processed';
  message: string;
  requestedCount: number;
  processedCount: number;
  results: Array<{
    jobIdempotencyKey: string;
    result: CertificatePdfGenerationWorkflowResult;
  }>;
};
export class CertificatePdfBatchWorkflow {
  constructor(
    private readonly batchLoader: CertificatePdfBatchLoader,
    private readonly generationWorkflow: CertificatePdfGenerationWorkflow
  ) {}

  async processBatch(input: CertificatePdfBatchWorkflowInput): Promise<CertificatePdfBatchWorkflowResult> {
    const workerId = input.workerId.trim();

    if (!workerId) {
      return {
        status: 'empty',
        message: 'Certificate PDF batch skipped: worker ID is required.',
        requestedCount: 0,
        processedCount: 0,
        results: []
      };
    }

    const batch = await this.batchLoader.loadPendingBatch(input);

    if (batch.status !== 'ready') {
      return {
        status: 'empty',
        message: batch.message,
        requestedCount: 0,
        processedCount: 0,
        results: []
      };
    }

    const results: CertificatePdfBatchWorkflowResult['results'] = [];

    for (const jobIdempotencyKey of batch.jobIdempotencyKeys) {
      results.push({
        jobIdempotencyKey,
        result: await this.generationWorkflow.generateCertificatePdf({
          jobIdempotencyKey,
          workerId,
          renderStartedAt: input.now,
          issueDate: input.issueDate,
          storageBucket: input.storageBucket,
          publicVerificationBaseUrl: input.publicVerificationBaseUrl,
          publicVerificationUrl: input.publicVerificationUrl,
          generatedAt: input.generatedAt
        })
      });
    }

    return {
      status: 'processed',
      message: 'Certificate PDF batch processed.',
      requestedCount: batch.jobIdempotencyKeys.length,
      processedCount: results.length,
      results
    };
  }
}
