import {
  RecordingCandidateReviewExecutionResult,
  RecordingCandidateReviewExecutor
} from './recording-candidate-review.executor';
import {
  RecordingCandidateReviewLoadInput,
  RecordingCandidateReviewLoader
} from './recording-candidate-review.loader';

export type RecordingCandidateReviewWorkflowResult = {
  status: 'not_found' | RecordingCandidateReviewExecutionResult['status'];
  message: string;
  candidateId?: string;
  execution?: RecordingCandidateReviewExecutionResult;
};
export class RecordingCandidateReviewWorkflow {
  constructor(
    private readonly loader: RecordingCandidateReviewLoader,
    private readonly executor: RecordingCandidateReviewExecutor
  ) {}

  async reviewCandidate(input: RecordingCandidateReviewLoadInput): Promise<RecordingCandidateReviewWorkflowResult> {
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
      candidateId: execution.candidateId,
      execution
    };
  }
}
