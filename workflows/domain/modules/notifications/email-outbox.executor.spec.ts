import { EmailOutboxExecutor } from './email-outbox.executor';
import { createEmailOutboxPlan } from './email-outbox-plan';

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

function readyPlan() {
  return createEmailOutboxPlan({
    template: {
      key: 'support.ticket.created',
      subject: 'Ticket {{ticketId}} created',
      htmlBody: '<p>Hello {{studentName}}</p>',
      textBody: 'Hello {{studentName}}'
    },
    recipient: {
      email: 'student@example.com',
      name: 'Student One'
    },
    variables: {
      ticketId: 'SUP-123',
      studentName: 'Student One'
    },
    entity: {
      table: 'support_tickets',
      id: 'ticket-uuid',
      action: 'created'
    },
    requestedBy: 'system:supabase',
    requestedAt: '2026-06-27T10:00:00.000Z'
  });
}

describe('EmailOutboxExecutor', () => {
  it('does not call Supabase when email outbox writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailOutboxExecutor(
      new MockConfigService({ EMAIL_OUTBOX_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email outbox writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe email outbox plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailOutboxExecutor(
      new MockConfigService({ EMAIL_OUTBOX_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createEmailOutboxPlan({
      template: {
        key: 'support.ticket.created',
        subject: ' ',
        htmlBody: '<p>Hello</p>'
      },
      recipient: { email: 'student@example.com' },
      entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
      requestedBy: 'system:supabase'
    });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      idempotencyKey: undefined,
      message: 'Email outbox enqueue skipped: missing_subject.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs email outbox and audit write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new EmailOutboxExecutor(
      new MockConfigService({ EMAIL_OUTBOX_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'created',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'Email outbox writes completed.',
      completedSteps: ['email_outbox', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_outbox', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
          template_key: 'support.ticket.created',
          recipient_email: 'student@example.com',
          status: 'pending',
          attempt_count: 0
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'system',
          actor_id: 'system:supabase',
          entity_table: 'email_outbox',
          entity_id: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
          action: 'email.enqueued'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed enqueue step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new EmailOutboxExecutor(
      new MockConfigService({ EMAIL_OUTBOX_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'audit write failed',
      completedSteps: ['email_outbox'],
      failedStep: 'audit_logs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_outbox', 'audit_logs']);
  });
}
);
