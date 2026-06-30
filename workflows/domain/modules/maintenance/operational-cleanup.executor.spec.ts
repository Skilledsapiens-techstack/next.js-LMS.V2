import { OperationalCleanupExecutor } from './operational-cleanup.executor';
import { createOperationalCleanupPlan, OperationalCleanupCandidate } from './operational-cleanup-plan';

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

  delete(...args: unknown[]) {
    this.calls.push({ method: 'delete', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
  }

  in(...args: unknown[]) {
    this.calls.push({ method: 'in', args });
    return Promise.resolve(this.result);
  }

  upsert(...args: unknown[]) {
    this.calls.push({ method: 'upsert', args });
    return Promise.resolve(this.result);
  }

  then(resolve: (value: QueryResult) => void) {
    resolve(this.result);
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

const now = '2026-06-27T12:00:00.000Z';
const candidates: OperationalCleanupCandidate[] = [
  {
    entityTable: 'email_outbox',
    entityId: 'email-job-1',
    status: 'sending',
    lockedUntil: '2026-06-27T11:30:00.000Z'
  },
  {
    entityTable: 'certificate_generation_jobs',
    entityId: 'cert-job-1',
    status: 'rendering',
    updatedAt: '2026-06-27T09:00:00.000Z'
  },
  {
    entityTable: 'enrollment_webhook_events',
    entityId: 'event-1',
    status: 'processed',
    completedAt: '2026-05-01T12:00:00.000Z'
  },
  {
    entityTable: 'error_logs',
    entityId: 'error-1',
    createdAt: '2026-01-01T12:00:00.000Z'
  }
];

function readyPlan() {
  return createOperationalCleanupPlan(candidates, { now });
}

describe('OperationalCleanupExecutor', () => {
  it('does not call Supabase when background cleanup writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new OperationalCleanupExecutor(
      new MockConfigService({ BACKGROUND_CLEANUP_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      message: 'Background cleanup writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips non-executable cleanup plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new OperationalCleanupExecutor(
      new MockConfigService({ BACKGROUND_CLEANUP_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(createOperationalCleanupPlan([], { now }))).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      message: 'Background cleanup skipped: empty_batch.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs cleanup actions and audit writes in a stable sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new OperationalCleanupExecutor(
      new MockConfigService({ BACKGROUND_CLEANUP_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      message: 'Background cleanup writes completed.',
      completedSteps: [
        'email_outbox:release_email_lock',
        'audit_logs',
        'certificate_generation_jobs:mark_certificate_job_failed',
        'audit_logs',
        'enrollment_webhook_events:archive_webhook_event',
        'audit_logs',
        'error_logs:purge_error_log',
        'audit_logs'
      ]
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual([
      'email_outbox',
      'audit_logs',
      'certificate_generation_jobs',
      'audit_logs',
      'enrollment_webhook_events',
      'audit_logs',
      'error_logs',
      'audit_logs'
    ]);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'pending',
            locked_until: null,
            worker_id: null,
            updated_at: now
          }
        ]
      },
      { method: 'eq', args: ['idempotency_key', 'email-job-1'] },
      { method: 'eq', args: ['status', 'sending'] }
    ]);
    expect(supabase.admin.queries[6]?.query.calls).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['idempotency_key', 'error-1'] }
    ]);
  });

  it('stops at the failed cleanup action and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('certificate_generation_jobs', { data: null, error: { message: 'certificate update failed' } });
    const executor = new OperationalCleanupExecutor(
      new MockConfigService({ BACKGROUND_CLEANUP_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      message: 'certificate update failed',
      completedSteps: ['email_outbox:release_email_lock', 'audit_logs'],
      failedStep: 'certificate_generation_jobs:mark_certificate_job_failed'
    });
  });

  it('stops at a failed audit write and reports the completed action', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new OperationalCleanupExecutor(
      new MockConfigService({ BACKGROUND_CLEANUP_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      message: 'audit write failed',
      completedSteps: ['email_outbox:release_email_lock'],
      failedStep: 'audit_logs'
    });
  });
});
