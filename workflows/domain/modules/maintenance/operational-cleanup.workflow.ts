import {
  OperationalCleanupExecutionResult,
  OperationalCleanupExecutor
} from './operational-cleanup.executor';
import {
  OperationalCleanupLoadInput,
  OperationalCleanupLoader
} from './operational-cleanup.loader';

export type OperationalCleanupWorkflowResult = {
  status: 'empty' | OperationalCleanupExecutionResult['status'];
  message: string;
  candidateCount: number;
  execution?: OperationalCleanupExecutionResult;
};
export class OperationalCleanupWorkflow {
  constructor(
    private readonly loader: OperationalCleanupLoader,
    private readonly executor: OperationalCleanupExecutor
  ) {}

  async runCleanup(input: OperationalCleanupLoadInput = {}): Promise<OperationalCleanupWorkflowResult> {
    const loadResult = await this.loader.loadPlan(input);

    if (loadResult.status !== 'ready') {
      return {
        status: 'empty',
        message: loadResult.message,
        candidateCount: loadResult.candidateCount
      };
    }

    const execution = await this.executor.execute(loadResult.plan);

    return {
      status: execution.status,
      message: execution.message,
      candidateCount: loadResult.candidateCount,
      execution
    };
  }
}
