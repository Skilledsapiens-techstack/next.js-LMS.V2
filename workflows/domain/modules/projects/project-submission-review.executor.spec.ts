import { ProjectSubmissionReviewExecutor } from './project-submission-review.executor';
import { createProjectSubmissionReviewPlan, ProjectSubmissionForReview } from './project-submission-review-plan';

class MockConfigService {
  constructor(private readonly values: Record<string, boolean | undefined>) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  update(...args: unknown[]) {
    this.calls.push({ method: 'update', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return Promise.resolve(this.result);
  }

  upsert(...args: unknown[]) {
    this.calls.push({ method: 'upsert', args });
    return Promise.resolve(this.result);
  }
}

class MockSupabaseAdmin {
  tableResults = new Map<string, QueryResult>();
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.tableResults.get(table) ?? { data: {}, error: null });
    this.queries.push({ table, query });
    return query;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

const submission: ProjectSubmissionForReview = {
  requestId: 'project_submission:student@example.com:proj_123:attempt:1',
  status: 'under_review',
  studentEmail: 'student@example.com',
  projectId: 'proj_123',
  attemptNumber: 1
};

function approvalPlan() {
  return createProjectSubmissionReviewPlan(submission, {
    action: 'approve',
    adminEmail: 'admin@example.com',
    reviewNote: 'Good work',
    reviewedAt: '2026-06-27T10:00:00.000Z'
  });
}

describe('ProjectSubmissionReviewExecutor', () => {
  it('does not call Supabase when project submission review writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new ProjectSubmissionReviewExecutor(
      new MockConfigService({ PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(approvalPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      message: 'Project submission review writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe review plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new ProjectSubmissionReviewExecutor(
      new MockConfigService({ PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createProjectSubmissionReviewPlan(
      { ...submission, status: 'approved' },
      {
        action: 'reject',
        adminEmail: 'admin@example.com',
        reviewNote: 'late rejection'
      }
    );

    await expect(executor.execute(plan)).resolves.toMatchObject({
      enabled: true,
      attempted: false,
      status: 'skipped',
      message: 'Project submission review skipped: invalid_transition.'
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs the review update and audit write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new ProjectSubmissionReviewExecutor(
      new MockConfigService({ PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(approvalPlan())).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'updated',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      completedSteps: ['project_submission_requests', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['project_submission_requests', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'approved',
            reviewed_by: 'admin@example.com',
            reviewed_at: '2026-06-27T10:00:00.000Z',
            review_notes: 'Good work'
          }
        ]
      },
      {
        method: 'eq',
        args: ['request_id', 'project_submission:student@example.com:proj_123:attempt:1']
      }
    ]);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'admin',
          actor_id: 'admin@example.com',
          entity_table: 'project_submission_requests',
          entity_id: 'project_submission:student@example.com:proj_123:attempt:1',
          action: 'project_submission.approved'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed review step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new ProjectSubmissionReviewExecutor(
      new MockConfigService({ PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(approvalPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      message: 'audit write failed',
      completedSteps: ['project_submission_requests'],
      failedStep: 'audit_logs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['project_submission_requests', 'audit_logs']);
  });
});
