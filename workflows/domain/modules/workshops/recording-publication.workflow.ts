import {
  RecordingPublicationExecutionResult,
  RecordingPublicationExecutor
} from './recording-publication.executor';
import {
  RecordingPublicationLoadInput,
  RecordingPublicationLoader
} from './recording-publication.loader';

export type RecordingPublicationWorkflowResult = {
  status: 'not_found' | RecordingPublicationExecutionResult['status'];
  message: string;
  workshopId?: string;
  execution?: RecordingPublicationExecutionResult;
};
export class RecordingPublicationWorkflow {
  constructor(
    private readonly loader: RecordingPublicationLoader,
    private readonly executor: RecordingPublicationExecutor
  ) {}

  async publishRecording(input: RecordingPublicationLoadInput): Promise<RecordingPublicationWorkflowResult> {
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
