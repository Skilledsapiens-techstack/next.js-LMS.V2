import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { EmailDispatchLoader } from './email-dispatch.loader';

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
  result: QueryResult = {
    data: {
      idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      status: 'pending',
      recipient_email: ' Student@Example.com ',
      subject: ' Ticket SUP-123 created ',
      html_body: ' <p>Hello Student</p> ',
      text_body: ' Hello Student ',
      attempt_count: 0,
      max_attempts: 3,
      next_attempt_at: null,
      locked_until: null,
      provider_message_id: null
   },
    error: null
 };
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.result);
    this.queries.push({ table, query });
    return query;
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

const loadInput = {
  idempotencyKey: ' email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created ',
  workerId: ' email-worker-1 ',
  now: '2026-06-27T10:00:00.000Z'
};

describe('EmailDispatchLoader', () => {
  it('loads one email outbox job and builds a dispatch plan', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailDispatchLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toEqual({
      status: 'ready',
      message: 'Email dispatch plan loaded.',
      plan: {
        shouldDispatch: true,
        reason: 'ready',
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        dispatchPayload: {
          to: 'student@example.com',
          subject: 'Ticket SUP-123 created',
          html: '<p>Hello Student</p>',
          text: 'Hello Student'
       },
        sendingUpdate: {
          idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
          status: 'sending',
          worker_id: 'email-worker-1',
          attempt_count: 1,
          locked_until: '2026-06-27T10:05:00.000Z',
          updated_at: '2026-06-27T10:00:00.000Z'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_outbox']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'select',
        args: ['idempotency_key,status,recipient_email,subject,html_body,text_body,attempt_count,max_attempts,next_attempt_at,locked_until,provider_message_id']
     },
      {
        method: 'eq',
        args: ['idempotency_key', 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created']
     },
      { method: 'maybeSingle', args: [] }
    ]);
 });

  it('returns not found without Supabase calls when idempotency key is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailDispatchLoader(supabase as never);

    await expect(loader.loadPlan({ ...loadInput, idempotencyKey: ' ' })).resolves.toEqual({
      status: 'not_found',
      message: 'Email outbox idempotency key is required to load a dispatch plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when no outbox job matches', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: null, error: null };
    const loader = new EmailDispatchLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toEqual({
      status: 'not_found',
      message: 'No email outbox job matched the dispatch source identity.'
   });
 });

  it('returns not found when the outbox row is malformed', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: { idempotency_key: 'email:bad', status: 'pending' }, error: null };
    const loader = new EmailDispatchLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toEqual({
      status: 'not_found',
      message: 'No email outbox job matched the dispatch source identity.'
   });
 });

  it('returns ready with a blocked plan when the row is not dispatchable', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = {
      data: {
        idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        status: 'sent',
        recipient_email: 'student@example.com',
        subject: 'Done',
        html_body: '<p>Done</p>',
        attempt_count: 1
     },
      error: null
   };
    const loader = new EmailDispatchLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toMatchObject({
      status: 'ready',
      message: 'Email dispatch plan loaded.',
      plan: {
        shouldDispatch: false,
        reason: 'not_pending',
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created'
     }
   });
 });

  it('throws service unavailable when outbox loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: null, error: { message: 'outbox read failed' } };
    const loader = new EmailDispatchLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).rejects.toThrow(
      new ServiceUnavailableException('Unable to load email outbox job for dispatch planning: outbox read failed')
    );
 });
});
