import {
  EmailDeliveryResultExecutionResult,
  EmailDeliveryResultExecutor
} from './email-delivery-result.executor';
import {
  EmailDeliveryResultLoadInput,
  EmailDeliveryResultLoader
} from './email-delivery-result.loader';

export type EmailDeliveryResultWorkflowResult = {
  status: 'not_found' | EmailDeliveryResultExecutionResult['status'];
  message: string;
  idempotencyKey?: string;
  execution?: EmailDeliveryResultExecutionResult;
};
export class EmailDeliveryResultWorkflow {
  constructor(
    private readonly loader: EmailDeliveryResultLoader,
    private readonly executor: EmailDeliveryResultExecutor
  ) {}

  async recordDeliveryResult(input: EmailDeliveryResultLoadInput): Promise<EmailDeliveryResultWorkflowResult> {
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
