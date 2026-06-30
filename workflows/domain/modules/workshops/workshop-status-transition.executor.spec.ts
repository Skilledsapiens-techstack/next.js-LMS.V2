import { WorkshopStatusTransitionExecutor } from './workshop-status-transition.executor';
import { createWorkshopStatusTransitionPlan, WorkshopForStatusTransition } from './workshop-status-transition-plan';

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

const workshop: WorkshopForStatusTransition = {
  id: 'workshop-row-uuid',
  workshopId: 'WS-001',
  title: 'Live Consulting Session',
  status: 'Scheduled'
};

function readyPlan() {
  return createWorkshopStatusTransitionPlan(workshop, {
    adminEmail: 'admin@example.com',
    nextStatus: 'Live',
    changedAt: '2026-06-27T10:00:00.000Z'
  });
}

describe('WorkshopStatusTransitionExecutor', () => {
  it('does not call Supabase when workshop status writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new WorkshopStatusTransitionExecutor(new MockConfigService({ WORKSHOP_STATUS_WRITES_ENABLED: false }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      workshopId: 'workshop-row-uuid',
      message: 'Workshop status writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe status transition plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new WorkshopStatusTransitionExecutor(new MockConfigService({ WORKSHOP_STATUS_WRITES_ENABLED: true }) as never, supabase as never);
    const plan = createWorkshopStatusTransitionPlan(workshop, {
      adminEmail: 'admin@example.com',
      nextStatus: 'Scheduled'
    });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      workshopId: undefined,
      message: 'Workshop status transition skipped: same_status.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs the workshop status update and audit write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new WorkshopStatusTransitionExecutor(new MockConfigService({ WORKSHOP_STATUS_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      workshopId: 'workshop-row-uuid',
      message: 'Workshop status writes completed.',
      completedSteps: ['workshops', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshops', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            workshop_status: 'Live',
            updated_at: '2026-06-27T10:00:00.000Z'
          }
        ]
      },
      { method: 'eq', args: ['id', 'workshop-row-uuid'] }
    ]);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'admin',
          actor_id: 'admin@example.com',
          entity_table: 'workshops',
          entity_id: 'workshop-row-uuid',
          action: 'workshop.status_changed'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed status transition step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new WorkshopStatusTransitionExecutor(new MockConfigService({ WORKSHOP_STATUS_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      workshopId: 'workshop-row-uuid',
      message: 'audit write failed',
      completedSteps: ['workshops'],
      failedStep: 'audit_logs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshops', 'audit_logs']);
  });
});
