import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { EmailDeliveryResultLoader } from './email-delivery-result.loader';

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
      status: 'sending',
      attempt_count: 1,
      max_attempts: 3,
      worker_id: 'email-worker-1'
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
  workerId: 'email-worker-1',
  success: true,
  providerMessageId: 'provider-message-123',
  deliveredAt: '2026-06-27T10:01:00.000Z'
};

describe('EmailDeliveryResultLoader', () => {
  it('loads one email outbox job and builds a successful delivery result plan', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailDeliveryResultLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toEqual({
      status: 'ready',
      message: 'Email delivery result plan loaded.',
      plan: {
        shouldRecord: true,
        reason: 'ready',
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        emailUpdate: {
          idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
          status: 'sent',
          provider_message_id: 'provider-message-123',
          sent_at: '2026-06-27T10:01:00.000Z',
          locked_until: null,
          worker_id: null,
          updated_at: '2026-06-27T10:01:00.000Z'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_outbox']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      { method: 'select', args: ['idempotency_key,status,attempt_count,max_attempts,worker_id'] },
      { method: 'eq', args: ['idempotency_key', 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created'] },
      { method: 'maybeSingle', args: [] }
    ]);
 });

  it('returns not found without Supabase calls when idempotency key is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailDeliveryResultLoader(supabase as never);

    await expect(loader.loadPlan({ ...loadInput, idempotencyKey: ' ' })).resolves.toEqual({
      status: 'not_found',
      message: 'Email outbox idempotency key is required to load a delivery result plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when no outbox job matches', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: null, error: null };
    const loader = new EmailDeliveryResultLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toEqual({
      status: 'not_found',
      message: 'No email outbox job matched the delivery result source identity.'
   });
 });

  it('returns not found when the outbox row is malformed', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: { idempotency_key: 'email:bad', status: 'unknown' }, error: null };
    const loader = new EmailDeliveryResultLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toEqual({
      status: 'not_found',
      message: 'No email outbox job matched the delivery result source identity.'
   });
 });

  it('returns ready with a blocked plan when the row is not recordable', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = {
      data: {
        idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        status: 'pending',
        attempt_count: 1,
        max_attempts: 3,
        worker_id: 'email-worker-1'
     },
      error: null
   };
    const loader = new EmailDeliveryResultLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toMatchObject({
      status: 'ready',
      message: 'Email delivery result plan loaded.',
      plan: {
        shouldRecord: false,
        reason: 'not_sending',
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created'
     }
   });
 });

  it('throws service unavailable when outbox loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: null, error: { message: 'result read failed' } };
    const loader = new EmailDeliveryResultLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).rejects.toThrow(
      new ServiceUnavailableException('Unable to load email outbox job for delivery result planning: result read failed')
    );
 });
});
