import { ProjectSubmissionReviewExecutionResult } from './project-submission-review.executor';
import { ProjectSubmissionReviewLoadResult } from './project-submission-review.loader';
import { createProjectSubmissionReviewPlan } from './project-submission-review-plan';
import { ProjectSubmissionReviewWorkflow } from './project-submission-review.workflow';

class MockLoader {
  input?: unknown;
  result: ProjectSubmissionReviewLoadResult = {
    status: 'ready',
    message: 'Project submission review plan loaded.',
    plan: createProjectSubmissionReviewPlan(
      {
        requestId: 'project_submission:student@example.com:proj_123:attempt:1',
        status: 'under_review',
        studentEmail: 'student@example.com',
        projectId: 'proj_123',
        attemptNumber: 1
      },
      {
        action: 'approve',
        adminEmail: 'admin@example.com',
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
  result: ProjectSubmissionReviewExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    requestId: 'project_submission:student@example.com:proj_123:attempt:1',
    message: 'Project submission review writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('ProjectSubmissionReviewWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new ProjectSubmissionReviewWorkflow(loader as never, executor as never);
    const input = {
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      action: 'approve' as const,
      adminEmail: 'admin@example.com'
    };

    await expect(workflow.reviewSubmission(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Project submission review writes are disabled. No Supabase write was attempted.',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No project submission matched the review source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new ProjectSubmissionReviewWorkflow(loader as never, executor as never);

    await expect(
      workflow.reviewSubmission({
        requestId: 'missing-request',
        action: 'approve',
        adminEmail: 'admin@example.com'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No project submission matched the review source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns review failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      message: 'audit write failed',
      completedSteps: ['project_submission_requests'],
      failedStep: 'audit_logs'
    };
    const workflow = new ProjectSubmissionReviewWorkflow(loader as never, executor as never);

    await expect(
      workflow.reviewSubmission({
        requestId: 'project_submission:student@example.com:proj_123:attempt:1',
        action: 'approve',
        adminEmail: 'admin@example.com'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'audit write failed',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      execution: executor.result
    });
  });
});
