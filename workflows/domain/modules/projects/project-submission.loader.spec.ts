import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { ProjectSubmissionLoader } from './project-submission.loader';

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
 }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
 }

  maybeSingle() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.result);
 }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
 }
}

class MockSupabaseAdmin {
  results = new Map<string, QueryResult>([
    [
      'students',
      {
        data: {
          id: 'student-uuid',
          email: 'student@example.com',
          full_name: 'Student Name',
          cohort_name: 'MBA June',
          active: true
       },
        error: null
     }
    ],
    [
      'projects',
      {
        data: {
          project_id: 'proj_123',
          title: 'Market Research Sprint',
          role_id: 'marketing',
          project_role: 'Marketing Intern',
          program_key: 'mba',
          program_keys: ['mba'],
          cohort_key: 'mba-june',
          cohort_name: 'MBA June',
          max_attempts: 3,
          status: 'active'
       },
        error: null
     }
    ],
    [
      'project_submission_requests',
      {
        data: [
          {
            request_id: 'old_request',
            status: 'rejected',
            attempt_number: 1
         }
        ],
        error: null
     }
    ]
  ]);
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.results.get(table) ?? { data: null, error: null });
    this.queries.push({ table, query });
    return query;
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('ProjectSubmissionLoader', () => {
  it('loads student, project, and existing submissions into a creation plan', async () => {
    const supabase = new MockSupabase();
    const loader = new ProjectSubmissionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        studentEmail: ' Student@Example.com ',
        projectId: ' proj_123 ',
        submission: {
          submissionLink: 'https://example.com/submission',
          remarks: 'Updated attempt'
       }
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Project submission plan loaded.',
      plan: {
        shouldCreate: true,
        reason: 'ready',
        nextAttemptNumber: 2,
        idempotencyKey: 'project_submission:student@example.com:proj_123:attempt:2'
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['students', 'projects', 'project_submission_requests']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['email', 'student@example.com'] },
        { method: 'eq', args: ['active', true] },
        { method: 'maybeSingle', args: [] }
      ])
    );
    expect(supabase.admin.queries[2]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'eq', args: ['project_id', 'proj_123'] }
      ])
    );
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new ProjectSubmissionLoader(supabase as never);

    await expect(loader.loadPlan({ studentEmail: ' ', projectId: ' ', submission: { submissionLink: 'https://example.com/submission' } })).resolves.toEqual({
      status: 'not_found',
      message: 'Student email and project ID are required to load a project submission plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the student does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('students', { data: null, error: null });
    const loader = new ProjectSubmissionLoader(supabase as never);

    await expect(loader.loadPlan({ studentEmail: 'student@example.com', projectId: 'proj_123', submission: { submissionLink: 'https://example.com/submission' } })).resolves.toEqual({
      status: 'not_found',
      message: 'No active student matched the project submission source.'
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['students']);
 });

  it('returns not found when the project does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('projects', { data: null, error: null });
    const loader = new ProjectSubmissionLoader(supabase as never);

    await expect(loader.loadPlan({ studentEmail: 'student@example.com', projectId: 'proj_123', submission: { submissionLink: 'https://example.com/submission' } })).resolves.toEqual({
      status: 'not_found',
      message: 'No project matched the project submission source.'
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['students', 'projects']);
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('project_submission_requests', { data: null, error: { message: 'submission history query failed' } });
    const loader = new ProjectSubmissionLoader(supabase as never);

    await expect(loader.loadPlan({ studentEmail: 'student@example.com', projectId: 'proj_123', submission: { submissionLink: 'https://example.com/submission' } })).rejects.toThrow(
      ServiceUnavailableException
    );
 });
});
