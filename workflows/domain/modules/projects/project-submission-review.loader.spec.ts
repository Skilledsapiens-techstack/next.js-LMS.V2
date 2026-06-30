import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { ProjectSubmissionReviewLoader } from './project-submission-review.loader';

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
}

class MockSupabaseAdmin {
  results = new Map<string, QueryResult>([
    [
      'project_submission_requests',
      {
        data: {
          request_id: 'project_submission:student@example.com:proj_123:attempt:1',
          status: 'under_review',
          student_email: 'student@example.com',
          project_id: 'proj_123',
          attempt_number: 1
       },
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

describe('ProjectSubmissionReviewLoader', () => {
  it('loads a project submission into a review plan', async () => {
    const supabase = new MockSupabase();
    const loader = new ProjectSubmissionReviewLoader(supabase as never);

    await expect(
      loader.loadPlan({
        requestId: ' project_submission:student@example.com:proj_123:attempt:1 ',
        action: 'approve',
        adminEmail: ' Admin@Example.com ',
        reviewNote: ' Approved ',
        reviewedAt: '2026-06-27T10:00:00.000Z'
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Project submission review plan loaded.',
      plan: {
        shouldTransition: true,
        reason: 'ready',
        targetStatus: 'approved',
        projectSubmissionUpdate: {
          request_id: 'project_submission:student@example.com:proj_123:attempt:1',
          status: 'approved',
          reviewed_by: 'admin@example.com',
          reviewed_at: '2026-06-27T10:00:00.000Z',
          review_notes: 'Approved'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['project_submission_requests']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['request_id', 'project_submission:student@example.com:proj_123:attempt:1'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new ProjectSubmissionReviewLoader(supabase as never);

    await expect(
      loader.loadPlan({
        requestId: ' ',
        action: 'approve',
        adminEmail: ' '
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Project submission request ID and admin email are required to load a review plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the project submission does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('project_submission_requests', { data: null, error: null });
    const loader = new ProjectSubmissionReviewLoader(supabase as never);

    await expect(
      loader.loadPlan({
        requestId: 'missing-request',
        action: 'approve',
        adminEmail: 'admin@example.com'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No project submission matched the review source identity.'
   });
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('project_submission_requests', { data: null, error: { message: 'review query failed' } });
    const loader = new ProjectSubmissionReviewLoader(supabase as never);

    await expect(
      loader.loadPlan({
        requestId: 'project_submission:student@example.com:proj_123:attempt:1',
        action: 'approve',
        adminEmail: 'admin@example.com'
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
