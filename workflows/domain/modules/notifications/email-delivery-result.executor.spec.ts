import { EmailDeliveryResultExecutor } from './email-delivery-result.executor';
import { createEmailDeliveryResultPlan, EmailDeliveryJob } from './email-delivery-result-plan';

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

const job: EmailDeliveryJob = {
  idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
  status: 'sending',
  attemptCount: 1,
  maxAttempts: 3,
  workerId: 'email-worker-1'
};

function successPlan() {
  return createEmailDeliveryResultPlan(job, {
    workerId: 'email-worker-1',
    success: true,
    providerMessageId: 'provider-message-123',
    deliveredAt: '2026-06-27T10:01:00.000Z'
  });
}

function failurePlan() {
  return createEmailDeliveryResultPlan(job, {
    workerId: 'email-worker-1',
    success: false,
    errorMessage: 'Provider timeout',
    deliveredAt: '2026-06-27T10:01:00.000Z'
  });
}

describe('EmailDeliveryResultExecutor', () => {
  it('does not call Supabase when email delivery result writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailDeliveryResultExecutor(
      new MockConfigService({ EMAIL_DELIVERY_RESULT_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(successPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email delivery result writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe result plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailDeliveryResultExecutor(
      new MockConfigService({ EMAIL_DELIVERY_RESULT_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createEmailDeliveryResultPlan({ ...job, status: 'pending' }, { workerId: 'email-worker-1', success: true, providerMessageId: 'message-1' });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email delivery result skipped: not_sending.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('writes a successful delivery result without error log writes', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailDeliveryResultExecutor(
      new MockConfigService({ EMAIL_DELIVERY_RESULT_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(successPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email delivery result writes completed.',
      completedSteps: ['email_outbox']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_outbox']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'sent',
            provider_message_id: 'provider-message-123',
            sent_at: '2026-06-27T10:01:00.000Z',
            locked_until: null,
            worker_id: null,
            updated_at: '2026-06-27T10:01:00.000Z'
          }
        ]
      },
      {
        method: 'eq',
        args: ['idempotency_key', 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created']
      },
      { method: 'eq', args: ['status', 'sending'] }
    ]);
  });

  it('writes a failed delivery result and provider error log when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailDeliveryResultExecutor(
      new MockConfigService({ EMAIL_DELIVERY_RESULT_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(failurePlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email delivery result writes completed.',
      completedSteps: ['email_outbox', 'error_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_outbox', 'error_logs']);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          entity_table: 'email_outbox',
          entity_id: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
          error_type: 'email_provider',
          message: 'Provider timeout'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at failed error log write and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('error_logs', { data: null, error: { message: 'error log failed' } });
    const executor = new EmailDeliveryResultExecutor(
      new MockConfigService({ EMAIL_DELIVERY_RESULT_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(failurePlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'error log failed',
      completedSteps: ['email_outbox'],
      failedStep: 'error_logs'
    });
  });
});
