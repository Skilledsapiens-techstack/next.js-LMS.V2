import {
  EmailOutboxExecutionResult,
  EmailOutboxExecutor
} from './email-outbox.executor';
import {
  EmailOutboxLoadInput,
  EmailOutboxLoader
} from './email-outbox.loader';

export type EmailOutboxWorkflowResult = {
  status: 'not_found' | EmailOutboxExecutionResult['status'];
  message: string;
  idempotencyKey?: string;
  execution?: EmailOutboxExecutionResult;
};
export class EmailOutboxWorkflow {
  constructor(
    private readonly loader: EmailOutboxLoader,
    private readonly executor: EmailOutboxExecutor
  ) {}

  async enqueueEmail(input: EmailOutboxLoadInput): Promise<EmailOutboxWorkflowResult> {
    const loadResult = await this.loader.loadPlan(input);

    if (loadResult.status !== 'ready' || !loadResult.plan) {
      return {
        status: 'not_found',
        message: loadResult.message
      };
    }

    const execution = await this.executor.execute(loadResult.plan);

    return {
      status: execution.status,
      message: execution.message,
      idempotencyKey: execution.idempotencyKey,
      execution
    };
  }
}
