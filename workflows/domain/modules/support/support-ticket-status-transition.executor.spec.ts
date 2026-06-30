import { SupportTicketStatusTransitionExecutor } from './support-ticket-status-transition.executor';
import { createSupportTicketStatusTransitionPlan, SupportTicketForStatusTransition } from './support-ticket-status-transition-plan';

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

const ticket: SupportTicketForStatusTransition = {
  id: 'support_ticket:student@example.com:client-request-123',
  status: 'open'
};

function readyPlan() {
  return createSupportTicketStatusTransitionPlan(ticket, {
    targetStatus: 'in_review',
    adminEmail: 'admin@example.com',
    changedAt: '2026-06-27T10:00:00.000Z'
  });
}

describe('SupportTicketStatusTransitionExecutor', () => {
  it('does not call Supabase when support ticket status writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketStatusTransitionExecutor(new MockConfigService({ SUPPORT_TICKET_STATUS_WRITES_ENABLED: false }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      message: 'Support ticket status writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe status transition plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketStatusTransitionExecutor(new MockConfigService({ SUPPORT_TICKET_STATUS_WRITES_ENABLED: true }) as never, supabase as never);
    const plan = createSupportTicketStatusTransitionPlan(ticket, {
      targetStatus: 'open',
      adminEmail: 'admin@example.com'
    });

    await expect(executor.execute(plan)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      ticketId: undefined,
      message: 'Support ticket status transition skipped: already_in_target_state.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs the support ticket status update and audit write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new SupportTicketStatusTransitionExecutor(new MockConfigService({ SUPPORT_TICKET_STATUS_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      message: 'Support ticket status writes completed.',
      completedSteps: ['support_tickets', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['support_tickets', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'in_review',
            updated_at: '2026-06-27T10:00:00.000Z',
            assigned_admin_email: 'admin@example.com',
            resolved_at: undefined,
            closed_at: undefined
          }
        ]
      },
      { method: 'eq', args: ['id', 'support_ticket:student@example.com:client-request-123'] }
    ]);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'admin',
          actor_id: 'admin@example.com',
          entity_table: 'support_tickets',
          entity_id: 'support_ticket:student@example.com:client-request-123',
          action: 'support_ticket.marked_in_review'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed status transition step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new SupportTicketStatusTransitionExecutor(new MockConfigService({ SUPPORT_TICKET_STATUS_WRITES_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      message: 'audit write failed',
      completedSteps: ['support_tickets'],
      failedStep: 'audit_logs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['support_tickets', 'audit_logs']);
  });
});
