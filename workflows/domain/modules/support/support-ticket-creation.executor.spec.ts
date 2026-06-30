import { SupportTicketCreationExecutor } from './support-ticket-creation.executor';
import { createSupportTicketCreationPlan, SupportTicketCreationStudent } from './support-ticket-creation-plan';

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

const student: SupportTicketCreationStudent = {
  id: 'student-uuid',
  email: 'student@example.com',
  fullName: 'Student Name'
};

function readyPlan() {
  return createSupportTicketCreationPlan(student, {
    categoryName: 'Course Access',
    subject: 'Cannot access MBA recordings',
    body: 'The latest workshop recording is locked for me.',
    priority: 'high',
    clientRequestId: 'client-request-123',
    createdAt: '2026-06-27T10:00:00.000Z'
  });
}

describe('SupportTicketCreationExecutor', () => {
  it('does not call Supabase when support ticket creation writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketCreationExecutor(new MockConfigService({ SUPPORT_TICKET_CREATION_WRITES_ENABLED: false }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      ticketId: expect.stringMatching(/^SUP-[A-F0-9]{10}$/),
      message: 'Support ticket creation writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe support ticket creation plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketCreationExecutor(new MockConfigService({ SUPPORT_TICKET_CREATION_WRITES_ENABLED: true }) as never, supabase as never);
    const plan = createSupportTicketCreationPlan(student, {
      categoryName: 'Course Access',
      subject: ' ',
      body: 'The latest workshop recording is locked for me.'
    });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      ticketId: undefined,
      message: 'Support ticket creation skipped: missing_subject.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs the idempotent support ticket creation write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketCreationExecutor(new MockConfigService({ SUPPORT_TICKET_CREATION_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'created',
      ticketId: expect.stringMatching(/^SUP-[A-F0-9]{10}$/),
      completedSteps: ['support_tickets', 'support_ticket_messages', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['support_tickets', 'support_ticket_messages', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          id: 'support_ticket:student@example.com:client-request-123',
          student_email: 'student@example.com',
          category_name: 'Course Access',
          priority: 'high',
          status: 'open'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
    expect(supabase.admin.queries[2]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'student',
          actor_id: 'student@example.com',
          entity_table: 'support_tickets',
          entity_id: 'support_ticket:student@example.com:client-request-123',
          action: 'support_ticket.created'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed support ticket creation step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('support_ticket_messages', { data: null, error: { message: 'message write failed' } });
    const executor = new SupportTicketCreationExecutor(new MockConfigService({ SUPPORT_TICKET_CREATION_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      ticketId: expect.stringMatching(/^SUP-[A-F0-9]{10}$/),
      message: 'message write failed',
      completedSteps: ['support_tickets'],
      failedStep: 'support_ticket_messages'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['support_tickets', 'support_ticket_messages']);
  });
});
