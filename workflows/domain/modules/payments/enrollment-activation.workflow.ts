import { EnrollmentActivationExecutionResult, EnrollmentActivationExecutor } from './enrollment-activation.executor';
import { EnrollmentActivationLoadInput, EnrollmentActivationLoader } from './enrollment-activation.loader';

export type EnrollmentActivationWorkflowResult = {
  status: 'not_found' | EnrollmentActivationExecutionResult['status'];
  message: string;
  requestId?: string;
  execution?: EnrollmentActivationExecutionResult;
};
export class EnrollmentActivationWorkflow {
  constructor(
    private readonly loader: EnrollmentActivationLoader,
    private readonly executor: EnrollmentActivationExecutor
  ) {}

  async activateFromPayment(input: EnrollmentActivationLoadInput): Promise<EnrollmentActivationWorkflowResult> {
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
      requestId: execution.requestId,
      execution
    };
  }
}
