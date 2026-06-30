import { RecordingCandidateReviewExecutionResult } from './recording-candidate-review.executor';
import { RecordingCandidateReviewLoadResult } from './recording-candidate-review.loader';
import { createRecordingCandidateReviewPlan } from './recording-candidate-review-plan';
import { RecordingCandidateReviewWorkflow } from './recording-candidate-review.workflow';

class MockLoader {
  input?: unknown;
  result: RecordingCandidateReviewLoadResult = {
    status: 'ready',
    message: 'Recording candidate review plan loaded.',
    plan: createRecordingCandidateReviewPlan(
      {
        id: 'candidate-uuid',
        workshopId: 'WS-001',
        zoomId: '123456789',
        zoomAccount: 'account1',
        status: 'draft',
        zoomRecordingFileId: 'file-1',
        playUrl: 'https://zoom.example/play'
      },
      {
        adminEmail: 'admin@example.com',
        decision: 'review',
        reviewedAt: '2026-06-27T10:00:00.000Z'
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
  result: RecordingCandidateReviewExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    candidateId: 'candidate-uuid',
    message: 'Recording candidate review writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('RecordingCandidateReviewWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new RecordingCandidateReviewWorkflow(loader as never, executor as never);
    const input = {
      candidateId: 'candidate-uuid',
      adminEmail: 'admin@example.com',
      decision: 'review' as const
    };

    await expect(workflow.reviewCandidate(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Recording candidate review writes are disabled. No Supabase write was attempted.',
      candidateId: 'candidate-uuid',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No recording candidate matched the review source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new RecordingCandidateReviewWorkflow(loader as never, executor as never);

    await expect(
      workflow.reviewCandidate({
        candidateId: 'missing-candidate',
        adminEmail: 'admin@example.com',
        decision: 'review'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No recording candidate matched the review source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns recording candidate review failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      candidateId: 'candidate-uuid',
      message: 'candidate update failed',
      completedSteps: [],
      failedStep: 'workshop_recording_candidates'
    };
    const workflow = new RecordingCandidateReviewWorkflow(loader as never, executor as never);

    await expect(
      workflow.reviewCandidate({
        candidateId: 'candidate-uuid',
        adminEmail: 'admin@example.com',
        decision: 'review'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'candidate update failed',
      candidateId: 'candidate-uuid',
      execution: executor.result
    });
  });
});
