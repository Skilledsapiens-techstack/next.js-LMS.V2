import { RecordingPublicationExecutor } from './recording-publication.executor';
import {
  createRecordingPublicationPlan,
  RecordingCandidateForPublication,
  WorkshopForRecordingPublication
} from './recording-publication-plan';

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

const workshop: WorkshopForRecordingPublication = {
  id: 'workshop-uuid',
  workshopId: 'WS-001',
  title: 'Leadership Workshop',
  status: 'Completed'
};

const candidate: RecordingCandidateForPublication = {
  id: 'candidate-uuid',
  workshopId: 'WS-001',
  status: 'reviewed',
  playUrl: 'https://zoom.example/play'
};

function readyPlan() {
  return createRecordingPublicationPlan(workshop, candidate, {
    adminEmail: 'admin@example.com',
    source: 'zoom',
    publishedAt: '2026-06-27T10:00:00.000Z'
  });
}

describe('RecordingPublicationExecutor', () => {
  it('does not call Supabase when recording publication writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new RecordingPublicationExecutor(
      new MockConfigService({ RECORDING_PUBLICATION_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      workshopId: 'workshop-uuid',
      message: 'Recording publication writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe publication plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new RecordingPublicationExecutor(
      new MockConfigService({ RECORDING_PUBLICATION_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createRecordingPublicationPlan({ ...workshop, status: 'Live' }, candidate, {
      adminEmail: 'admin@example.com',
      source: 'zoom'
    });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      workshopId: undefined,
      message: 'Recording publication skipped: workshop_not_completed.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs workshop recording update and audit write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new RecordingPublicationExecutor(
      new MockConfigService({ RECORDING_PUBLICATION_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      workshopId: 'workshop-uuid',
      message: 'Recording publication writes completed.',
      completedSteps: ['workshops', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshops', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            youtube_video_url: undefined,
            zoom_recording_url: 'https://zoom.example/play',
            updated_at: '2026-06-27T10:00:00.000Z'
          }
        ]
      },
      { method: 'eq', args: ['id', 'workshop-uuid'] }
    ]);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'admin',
          actor_id: 'admin@example.com',
          entity_table: 'workshops',
          entity_id: 'workshop-uuid',
          action: 'workshop.recording_published'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed publication step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new RecordingPublicationExecutor(
      new MockConfigService({ RECORDING_PUBLICATION_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      workshopId: 'workshop-uuid',
      message: 'audit write failed',
      completedSteps: ['workshops'],
      failedStep: 'audit_logs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshops', 'audit_logs']);
  });
});
