import { ProjectSubmissionReviewExecutionResult, ProjectSubmissionReviewExecutor } from './project-submission-review.executor';
import { ProjectSubmissionReviewLoadInput, ProjectSubmissionReviewLoader } from './project-submission-review.loader';

export type ProjectSubmissionReviewWorkflowResult = {
  status: 'not_found' | ProjectSubmissionReviewExecutionResult['status'];
  message: string;
  requestId?: string;
  execution?: ProjectSubmissionReviewExecutionResult;
};
export class ProjectSubmissionReviewWorkflow {
  constructor(
    private readonly loader: ProjectSubmissionReviewLoader,
    private readonly executor: ProjectSubmissionReviewExecutor
  ) {}

  async reviewSubmission(input: ProjectSubmissionReviewLoadInput): Promise<ProjectSubmissionReviewWorkflowResult> {
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
