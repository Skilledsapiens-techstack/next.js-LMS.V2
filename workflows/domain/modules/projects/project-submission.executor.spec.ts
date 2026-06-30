import { ProjectSubmissionExecutor } from './project-submission.executor';
import { createProjectSubmissionPlan, ProjectSubmissionProject, ProjectSubmissionStudent } from './project-submission-plan';

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

const student: ProjectSubmissionStudent = {
  id: 'student-uuid',
  email: 'student@example.com',
  fullName: 'Student Name',
  cohortName: 'MBA June'
};

const project: ProjectSubmissionProject = {
  projectId: 'proj_123',
  title: 'Market Research Sprint',
  roleId: 'marketing',
  roleName: 'Marketing Intern',
  programKey: 'mba',
  programKeys: ['mba'],
  cohortKey: 'mba-june',
  cohortName: 'MBA June',
  visibleToStudent: true,
  maxAttempts: 3
};

function readyPlan() {
  return createProjectSubmissionPlan(student, project, { submissionLink: 'https://example.com/submission' }, []);
}

describe('ProjectSubmissionExecutor', () => {
  it('does not call Supabase when project submission writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new ProjectSubmissionExecutor(new MockConfigService({ PROJECT_SUBMISSION_WRITES_ENABLED: false }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      message: 'Project submission writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe project submission plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new ProjectSubmissionExecutor(new MockConfigService({ PROJECT_SUBMISSION_WRITES_ENABLED: true }) as never, supabase as never);
    const plan = createProjectSubmissionPlan(student, { ...project, visibleToStudent: false }, { submissionLink: 'https://example.com/submission' }, []);

    await expect(executor.execute(plan)).resolves.toMatchObject({
      enabled: true,
      attempted: false,
      status: 'skipped',
      message: 'Project submission skipped: project_not_visible.'
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs the idempotent project submission write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new ProjectSubmissionExecutor(new MockConfigService({ PROJECT_SUBMISSION_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'created',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      completedSteps: ['project_submission_requests', 'project_submission_student_limits', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['project_submission_requests', 'project_submission_student_limits', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          request_id: 'project_submission:student@example.com:proj_123:attempt:1',
          student_email: 'student@example.com',
          project_id: 'proj_123',
          status: 'submitted'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed project submission step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('project_submission_student_limits', { data: null, error: { message: 'limit write failed' } });
    const executor = new ProjectSubmissionExecutor(new MockConfigService({ PROJECT_SUBMISSION_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      requestId: 'project_submission:student@example.com:proj_123:attempt:1',
      message: 'limit write failed',
      completedSteps: ['project_submission_requests'],
      failedStep: 'project_submission_student_limits'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['project_submission_requests', 'project_submission_student_limits']);
  });
});
