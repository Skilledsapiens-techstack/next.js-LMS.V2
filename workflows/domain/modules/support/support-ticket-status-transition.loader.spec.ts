import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { SupportTicketStatusTransitionLoader } from './support-ticket-status-transition.loader';

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
 }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
 }

  maybeSingle() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.result);
 }
}

class MockSupabaseAdmin {
  results = new Map<string, QueryResult>([
    [
      'support_tickets',
      {
        data: {
          id: 'support_ticket:student@example.com:client-request-123',
          status: 'open',
          assigned_admin_email: ' Assigned.Admin@Example.com '
       },
        error: null
     }
    ]
  ]);
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.results.get(table) ?? { data: null, error: null });
    this.queries.push({ table, query });
    return query;
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('SupportTicketStatusTransitionLoader', () => {
  it('loads a support ticket into a status transition plan', async () => {
    const supabase = new MockSupabase();
    const loader = new SupportTicketStatusTransitionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: ' support_ticket:student@example.com:client-request-123 ',
        targetStatus: 'in_review',
        adminEmail: ' Admin@Example.com ',
        changedAt: '2026-06-27T10:00:00.000Z'
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Support ticket status transition plan loaded.',
      plan: {
        shouldTransition: true,
        reason: 'ready',
        ticketUpdate: {
          id: 'support_ticket:student@example.com:client-request-123',
          status: 'in_review',
          updated_at: '2026-06-27T10:00:00.000Z',
          assigned_admin_email: 'assigned.admin@example.com'
       },
        auditEvent: {
          action: 'support_ticket.marked_in_review',
          actor_id: 'admin@example.com'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['support_tickets']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'select', args: ['id,status,assigned_admin_email'] },
        { method: 'eq', args: ['id', 'support_ticket:student@example.com:client-request-123'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new SupportTicketStatusTransitionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: ' ',
        targetStatus: 'in_review',
        adminEmail: ' '
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Support ticket ID and admin email are required to load a status transition plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the support ticket does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('support_tickets', { data: null, error: null });
    const loader = new SupportTicketStatusTransitionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: 'missing-ticket',
        targetStatus: 'in_review',
        adminEmail: 'admin@example.com'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No support ticket matched the status transition source identity.'
   });
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('support_tickets', { data: null, error: { message: 'ticket query failed' } });
    const loader = new SupportTicketStatusTransitionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: 'support_ticket:student@example.com:client-request-123',
        targetStatus: 'in_review',
        adminEmail: 'admin@example.com'
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
