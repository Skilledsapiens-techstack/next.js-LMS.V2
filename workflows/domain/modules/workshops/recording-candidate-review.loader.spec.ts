import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { RecordingCandidateReviewLoader } from './recording-candidate-review.loader';

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
      'workshop_recording_candidates',
      {
        data: {
          id: 'candidate-uuid',
          workshop_id: 'WS-001',
          zoom_id: '123456789',
          zoom_account: 'account1',
          status: 'draft',
          zoom_recording_file_id: 'file-1',
          play_url: 'https://zoom.example/play',
          download_url: 'https://zoom.example/download'
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

describe('RecordingCandidateReviewLoader', () => {
  it('loads a recording candidate into a review plan', async () => {
    const supabase = new MockSupabase();
    const loader = new RecordingCandidateReviewLoader(supabase as never);

    await expect(
      loader.loadPlan({
        candidateId: ' candidate-uuid ',
        adminEmail: ' Admin@Example.com ',
        decision: 'review',
        reviewedAt: '2026-06-27T10:00:00.000Z'
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Recording candidate review plan loaded.',
      plan: {
        shouldReview: true,
        reason: 'ready',
        candidateUpdate: {
          id: 'candidate-uuid',
          status: 'reviewed',
          reviewed_by: 'admin@example.com',
          reviewed_at: '2026-06-27T10:00:00.000Z',
          updated_at: '2026-06-27T10:00:00.000Z'
       },
        auditEvent: {
          action: 'recording_candidate.reviewed',
          actor_id: 'admin@example.com',
          entity: 'workshop_recording_candidates',
          entity_id: 'candidate-uuid'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshop_recording_candidates']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'select', args: ['id,workshop_id,zoom_id,zoom_account,status,zoom_recording_file_id,play_url,download_url'] },
        { method: 'eq', args: ['id', 'candidate-uuid'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new RecordingCandidateReviewLoader(supabase as never);

    await expect(
      loader.loadPlan({
        candidateId: ' ',
        adminEmail: ' ',
        decision: 'review'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Recording candidate ID and admin email are required to load a review plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the recording candidate does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('workshop_recording_candidates', { data: null, error: null });
    const loader = new RecordingCandidateReviewLoader(supabase as never);

    await expect(
      loader.loadPlan({
        candidateId: 'missing-candidate',
        adminEmail: 'admin@example.com',
        decision: 'review'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No recording candidate matched the review source identity.'
   });
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('workshop_recording_candidates', { data: null, error: { message: 'candidate query failed' } });
    const loader = new RecordingCandidateReviewLoader(supabase as never);

    await expect(
      loader.loadPlan({
        candidateId: 'candidate-uuid',
        adminEmail: 'admin@example.com',
        decision: 'review'
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
