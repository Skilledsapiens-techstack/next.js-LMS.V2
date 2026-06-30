import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { SupportTicketReplyLoader } from './support-ticket-reply.loader';

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
          status: 'waiting_for_student',
          conversation_mode: 'two_way',
          student_email: 'student@example.com'
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

describe('SupportTicketReplyLoader', () => {
  it('loads a student-owned support ticket into a reply plan', async () => {
    const supabase = new MockSupabase();
    const loader = new SupportTicketReplyLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: ' support_ticket:student@example.com:client-request-123 ',
        actor: {
          role: 'student',
          email: ' Student@Example.com ',
          name: 'Student Name'
       },
        reply: {
          body: ' I still need help. ',
          clientRequestId: 'reply-123',
          createdAt: '2026-06-27T10:00:00.000Z'
       }
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Support ticket reply plan loaded.',
      plan: {
        shouldCreate: true,
        reason: 'ready',
        messageRow: {
          ticket_id: 'support_ticket:student@example.com:client-request-123',
          author_role: 'student',
          author_email: 'student@example.com',
          visibility: 'public'
       },
        ticketUpdate: {
          id: 'support_ticket:student@example.com:client-request-123',
          status: 'open'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['support_tickets']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['id', 'support_ticket:student@example.com:client-request-123'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('allows admin actors to load a support ticket for reply planning', async () => {
    const supabase = new MockSupabase();
    const loader = new SupportTicketReplyLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: 'support_ticket:student@example.com:client-request-123',
        actor: {
          role: 'admin',
          email: 'admin@example.com'
       },
        reply: {
          body: 'Please share a screenshot.',
          visibility: 'public',
          clientRequestId: 'admin-reply',
          createdAt: '2026-06-27T10:05:00.000Z'
       }
     })
    ).resolves.toMatchObject({
      status: 'ready',
      plan: {
        shouldCreate: true,
        messageRow: {
          author_role: 'admin',
          visibility: 'public'
       },
        ticketUpdate: {
          status: 'waiting_for_student'
       }
     }
   });
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new SupportTicketReplyLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: ' ',
        actor: {
          role: 'student',
          email: ' '
       },
        reply: {
          body: 'Help'
       }
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Support ticket ID and actor email are required to load a reply plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the support ticket does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('support_tickets', { data: null, error: null });
    const loader = new SupportTicketReplyLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: 'missing-ticket',
        actor: {
          role: 'admin',
          email: 'admin@example.com'
       },
        reply: {
          body: 'Help'
       }
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No support ticket matched the reply source identity.'
   });
 });

  it('returns not found when a student tries to reply to another student ticket', async () => {
    const supabase = new MockSupabase();
    const loader = new SupportTicketReplyLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: 'support_ticket:student@example.com:client-request-123',
        actor: {
          role: 'student',
          email: 'other@example.com'
       },
        reply: {
          body: 'Help'
       }
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No support ticket matched the student reply source identity.'
   });
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('support_tickets', { data: null, error: { message: 'ticket query failed' } });
    const loader = new SupportTicketReplyLoader(supabase as never);

    await expect(
      loader.loadPlan({
        ticketId: 'support_ticket:student@example.com:client-request-123',
        actor: {
          role: 'admin',
          email: 'admin@example.com'
       },
        reply: {
          body: 'Help'
       }
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
