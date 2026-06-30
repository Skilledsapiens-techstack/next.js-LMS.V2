import { RecordingPublicationExecutionResult } from './recording-publication.executor';
import { RecordingPublicationLoadResult } from './recording-publication.loader';
import { createRecordingPublicationPlan } from './recording-publication-plan';
import { RecordingPublicationWorkflow } from './recording-publication.workflow';

class MockLoader {
  input?: unknown;
  result: RecordingPublicationLoadResult = {
    status: 'ready',
    message: 'Recording publication plan loaded.',
    plan: createRecordingPublicationPlan(
      {
        id: 'workshop-uuid',
        workshopId: 'WS-001',
        title: 'Leadership Workshop',
        status: 'Completed'
      },
      {
        id: 'candidate-uuid',
        workshopId: 'WS-001',
        status: 'reviewed',
        playUrl: 'https://zoom.example/play'
      },
      {
        adminEmail: 'admin@example.com',
        source: 'zoom',
        publishedAt: '2026-06-27T10:00:00.000Z'
      }
    )
  };

  loadPlan(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockExecutor {
  plan?: unknown;
  result: RecordingPublicationExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    workshopId: 'workshop-uuid',
    message: 'Recording publication writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('RecordingPublicationWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new RecordingPublicationWorkflow(loader as never, executor as never);
    const input = {
      workshopId: 'workshop-uuid',
      candidateId: 'candidate-uuid',
      adminEmail: 'admin@example.com',
      source: 'zoom' as const
    };

    await expect(workflow.publishRecording(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Recording publication writes are disabled. No Supabase write was attempted.',
      workshopId: 'workshop-uuid',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No workshop or recording candidate matched the publication source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new RecordingPublicationWorkflow(loader as never, executor as never);

    await expect(
      workflow.publishRecording({
        workshopId: 'missing-workshop',
        candidateId: 'missing-candidate',
        adminEmail: 'admin@example.com',
        source: 'zoom'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No workshop or recording candidate matched the publication source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns recording publication failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      workshopId: 'workshop-uuid',
      message: 'workshop update failed',
      completedSteps: [],
      failedStep: 'workshops'
    };
    const workflow = new RecordingPublicationWorkflow(loader as never, executor as never);

    await expect(
      workflow.publishRecording({
        workshopId: 'workshop-uuid',
        candidateId: 'candidate-uuid',
        adminEmail: 'admin@example.com',
        source: 'zoom'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'workshop update failed',
      workshopId: 'workshop-uuid',
      execution: executor.result
    });
  });
});
