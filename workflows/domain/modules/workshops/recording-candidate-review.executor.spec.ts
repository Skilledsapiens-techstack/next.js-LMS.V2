import { RecordingCandidateReviewExecutor } from './recording-candidate-review.executor';
import { createRecordingCandidateReviewPlan, RecordingCandidateForReview } from './recording-candidate-review-plan';

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

const candidate: RecordingCandidateForReview = {
  id: 'candidate-uuid',
  workshopId: 'WS-001',
  zoomId: '123456789',
  zoomAccount: 'account1',
  status: 'draft',
  zoomRecordingFileId: 'file-1',
  playUrl: 'https://zoom.example/play'
};

function readyPlan() {
  return createRecordingCandidateReviewPlan(candidate, {
    adminEmail: 'admin@example.com',
    decision: 'review',
    reviewedAt: '2026-06-27T10:00:00.000Z'
  });
}

describe('RecordingCandidateReviewExecutor', () => {
  it('does not call Supabase when recording candidate review writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new RecordingCandidateReviewExecutor(
      new MockConfigService({ RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      candidateId: 'candidate-uuid',
      message: 'Recording candidate review writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe review plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new RecordingCandidateReviewExecutor(
      new MockConfigService({ RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createRecordingCandidateReviewPlan({ ...candidate, status: 'reviewed' }, { adminEmail: 'admin@example.com', decision: 'reject' });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      candidateId: undefined,
      message: 'Recording candidate review skipped: already_final.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs candidate review update and audit write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new RecordingCandidateReviewExecutor(
      new MockConfigService({ RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      candidateId: 'candidate-uuid',
      message: 'Recording candidate review writes completed.',
      completedSteps: ['workshop_recording_candidates', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshop_recording_candidates', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'reviewed',
            reviewed_by: 'admin@example.com',
            reviewed_at: '2026-06-27T10:00:00.000Z',
            updated_at: '2026-06-27T10:00:00.000Z'
          }
        ]
      },
      { method: 'eq', args: ['id', 'candidate-uuid'] }
    ]);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'admin',
          actor_id: 'admin@example.com',
          entity_table: 'workshop_recording_candidates',
          entity_id: 'candidate-uuid',
          action: 'recording_candidate.reviewed'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed review step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new RecordingCandidateReviewExecutor(
      new MockConfigService({ RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      candidateId: 'candidate-uuid',
      message: 'audit write failed',
      completedSteps: ['workshop_recording_candidates'],
      failedStep: 'audit_logs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshop_recording_candidates', 'audit_logs']);
  });
});
