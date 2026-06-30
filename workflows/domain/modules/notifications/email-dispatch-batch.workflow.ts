import {
  EmailDispatchBatchLoadInput,
  EmailDispatchBatchLoader
} from './email-dispatch-batch.loader';
import { EmailSendWorkflow, EmailSendWorkflowResult } from './email-send.workflow';

export type EmailDispatchBatchWorkflowInput = EmailDispatchBatchLoadInput & {
  workerId: string;
};

export type EmailDispatchBatchWorkflowResult = {
  status: 'empty' | 'processed';
  message: string;
  requestedCount: number;
  processedCount: number;
  results: Array<{
    idempotencyKey: string;
    result: EmailSendWorkflowResult;
  }>;
};
export class EmailDispatchBatchWorkflow {
  constructor(
    private readonly batchLoader: EmailDispatchBatchLoader,
    private readonly emailSendWorkflow: EmailSendWorkflow
  ) {}

  async processBatch(input: EmailDispatchBatchWorkflowInput): Promise<EmailDispatchBatchWorkflowResult> {
    const workerId = input.workerId.trim();

    if (!workerId) {
      return {
        status: 'empty',
        message: 'Email dispatch batch skipped: worker ID is required.',
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

    const results: EmailDispatchBatchWorkflowResult['results'] = [];

    for (const idempotencyKey of batch.idempotencyKeys) {
      results.push({
        idempotencyKey,
        result: await this.emailSendWorkflow.send({
          idempotencyKey,
          workerId,
          now: input.now,
          maxAttempts: input.maxAttempts
        })
      });
    }

    return {
      status: 'processed',
      message: 'Email dispatch batch processed.',
      requestedCount: batch.idempotencyKeys.length,
      processedCount: results.length,
      results
    };
  }
}
