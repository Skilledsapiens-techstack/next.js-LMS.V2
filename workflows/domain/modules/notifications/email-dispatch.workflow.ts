import {
  EmailDispatchExecutionResult,
  EmailDispatchExecutor
} from './email-dispatch.executor';
import {
  EmailDispatchLoadInput,
  EmailDispatchLoader
} from './email-dispatch.loader';

export type EmailDispatchWorkflowResult = {
  status: 'not_found' | EmailDispatchExecutionResult['status'];
  message: string;
  idempotencyKey?: string;
  execution?: EmailDispatchExecutionResult;
};
export class EmailDispatchWorkflow {
  constructor(
    private readonly loader: EmailDispatchLoader,
    private readonly executor: EmailDispatchExecutor
  ) {}

  async prepareDispatch(input: EmailDispatchLoadInput): Promise<EmailDispatchWorkflowResult> {
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
