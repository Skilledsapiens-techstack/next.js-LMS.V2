import { SupportTicketReplyExecutor } from './support-ticket-reply.executor';
import { createSupportTicketReplyPlan, SupportTicketForReply } from './support-ticket-reply-plan';

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

  update(...args: unknown[]) {
    this.calls.push({ method: 'update', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
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

const ticket: SupportTicketForReply = {
  id: 'support_ticket:student@example.com:client-request-123',
  status: 'waiting_for_student',
  conversationMode: 'two_way',
  studentEmail: 'student@example.com'
};

function readyPlan() {
  return createSupportTicketReplyPlan(
    ticket,
    {
      role: 'student',
      email: 'student@example.com',
      name: 'Student Name'
    },
    {
      body: 'I still need help.',
      clientRequestId: 'reply-123',
      createdAt: '2026-06-27T10:00:00.000Z'
    }
  );
}

describe('SupportTicketReplyExecutor', () => {
  it('does not call Supabase when support ticket reply writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketReplyExecutor(new MockConfigService({ SUPPORT_TICKET_REPLY_WRITES_ENABLED: false }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      messageId: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      message: 'Support ticket reply writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe reply plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketReplyExecutor(new MockConfigService({ SUPPORT_TICKET_REPLY_WRITES_ENABLED: true }) as never, supabase as never);
    const plan = createSupportTicketReplyPlan(ticket, { role: 'student', email: 'student@example.com' }, { body: ' ', clientRequestId: 'reply-123' });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      messageId: undefined,
      ticketId: undefined,
      message: 'Support ticket reply skipped: missing_body.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs the idempotent support ticket reply write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketReplyExecutor(new MockConfigService({ SUPPORT_TICKET_REPLY_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'created',
      messageId: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      message: 'Support ticket reply writes completed.',
      completedSteps: ['support_ticket_messages', 'support_tickets', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['support_ticket_messages', 'support_tickets', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          id: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
          ticket_id: 'support_ticket:student@example.com:client-request-123',
          author_role: 'student',
          visibility: 'public'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
    expect(supabase.admin.queries[1]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'open',
            updated_at: '2026-06-27T10:00:00.000Z',
            last_message_at: '2026-06-27T10:00:00.000Z',
            last_student_reply_at: '2026-06-27T10:00:00.000Z',
            last_admin_reply_at: undefined
          }
        ]
      },
      { method: 'eq', args: ['id', 'support_ticket:student@example.com:client-request-123'] }
    ]);
  });

  it('stops at the failed reply step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('support_tickets', { data: null, error: { message: 'ticket update failed' } });
    const executor = new SupportTicketReplyExecutor(new MockConfigService({ SUPPORT_TICKET_REPLY_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      messageId: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      message: 'ticket update failed',
      completedSteps: ['support_ticket_messages'],
      failedStep: 'support_tickets'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['support_ticket_messages', 'support_tickets']);
  });
});
