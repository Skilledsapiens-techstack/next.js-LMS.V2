import { EmailDispatchExecutor } from './email-dispatch.executor';
import { createEmailDispatchPlan, EmailOutboxJobForDispatch } from './email-dispatch-plan';

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
    return this;
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

const job: EmailOutboxJobForDispatch = {
  idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
  status: 'pending',
  recipientEmail: 'student@example.com',
  subject: 'Ticket SUP-123 created',
  htmlBody: '<p>Hello Student</p>',
  textBody: 'Hello Student',
  attemptCount: 0
};

function readyPlan() {
  return createEmailDispatchPlan(job, {
    workerId: 'email-worker-1',
    now: '2026-06-27T10:00:00.000Z'
  });
}

describe('EmailDispatchExecutor', () => {
  it('does not call Supabase when email dispatch writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailDispatchExecutor(
      new MockConfigService({ EMAIL_DISPATCH_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email dispatch writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe dispatch plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailDispatchExecutor(
      new MockConfigService({ EMAIL_DISPATCH_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createEmailDispatchPlan({ ...job, status: 'sent' }, { workerId: 'email-worker-1' });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email dispatch lock skipped: not_pending.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('writes the sending lock only when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailDispatchExecutor(
      new MockConfigService({ EMAIL_DISPATCH_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email dispatch lock write completed.',
      completedSteps: ['email_outbox']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_outbox']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'sending',
            worker_id: 'email-worker-1',
            attempt_count: 1,
            locked_until: '2026-06-27T10:05:00.000Z',
            updated_at: '2026-06-27T10:00:00.000Z'
          }
        ]
      },
      {
        method: 'eq',
        args: ['idempotency_key', 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created']
      },
      { method: 'eq', args: ['status', 'pending'] }
    ]);
  });

  it('reports lock write failures without calling a provider', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('email_outbox', { data: null, error: { message: 'lock write failed' } });
    const executor = new EmailDispatchExecutor(
      new MockConfigService({ EMAIL_DISPATCH_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'lock write failed',
      completedSteps: [],
      failedStep: 'email_outbox'
    });
  });
});
