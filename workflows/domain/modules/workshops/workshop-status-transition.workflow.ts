import {
  WorkshopStatusTransitionExecutionResult,
  WorkshopStatusTransitionExecutor
} from './workshop-status-transition.executor';
import {
  WorkshopStatusTransitionLoadInput,
  WorkshopStatusTransitionLoader
} from './workshop-status-transition.loader';

export type WorkshopStatusTransitionWorkflowResult = {
  status: 'not_found' | WorkshopStatusTransitionExecutionResult['status'];
  message: string;
  workshopId?: string;
  execution?: WorkshopStatusTransitionExecutionResult;
};
export class WorkshopStatusTransitionWorkflow {
  constructor(
    private readonly loader: WorkshopStatusTransitionLoader,
    private readonly executor: WorkshopStatusTransitionExecutor
  ) {}

  async transitionStatus(input: WorkshopStatusTransitionLoadInput): Promise<WorkshopStatusTransitionWorkflowResult> {
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
      workshopId: execution.workshopId,
      execution
    };
  }
}
