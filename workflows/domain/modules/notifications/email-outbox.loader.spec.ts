import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { EmailOutboxLoader } from './email-outbox.loader';

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
      key: 'support.ticket.created',
      subject: 'Ticket {{ticketId}} created',
      html_body: '<p>Hello {{studentName}}</p>',
      text_body: 'Hello {{studentName}}',
      active: true
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
  templateKey: ' support.ticket.created ',
  recipient: {
    email: ' Student@Example.com ',
    name: 'Student One'
 },
  variables: {
    studentName: 'Student One',
    ticketId: 'SUP-123'
 },
  entity: {
    table: 'support_tickets',
    id: 'ticket-uuid',
    action: 'created'
 },
  requestedBy: 'system:supabase',
  requestedAt: '2026-06-27T10:00:00.000Z'
};

describe('EmailOutboxLoader', () => {
  it('loads an active template and builds an email outbox plan', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailOutboxLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toMatchObject({
      status: 'ready',
      message: 'Email outbox plan loaded.',
      plan: {
        shouldEnqueue: true,
        reason: 'ready',
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        emailJobRow: {
          template_key: 'support.ticket.created',
          recipient_email: 'student@example.com',
          subject: 'Ticket SUP-123 created',
          html_body: '<p>Hello Student One</p>',
          text_body: 'Hello Student One'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_templates']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      { method: 'select', args: ['key,subject,html_body,text_body,active'] },
      { method: 'eq', args: ['key', 'support.ticket.created'] },
      { method: 'eq', args: ['active', true] },
      { method: 'maybeSingle', args: [] }
    ]);
 });

  it('returns not found without Supabase calls when template key is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailOutboxLoader(supabase as never);

    await expect(loader.loadPlan({ ...loadInput, templateKey: ' ' })).resolves.toEqual({
      status: 'not_found',
      message: 'Template key is required to load an email outbox plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when no active template matches', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: null, error: null };
    const loader = new EmailOutboxLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toEqual({
      status: 'not_found',
      message: 'No active email template matched the outbox source identity.'
   });
 });

  it('returns not found when the template row is malformed', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: { key: 'support.ticket.created', subject: 'Missing body' }, error: null };
    const loader = new EmailOutboxLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).resolves.toEqual({
      status: 'not_found',
      message: 'No active email template matched the outbox source identity.'
   });
 });

  it('throws service unavailable when template loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: null, error: { message: 'template read failed' } };
    const loader = new EmailOutboxLoader(supabase as never);

    await expect(loader.loadPlan(loadInput)).rejects.toThrow(
      new ServiceUnavailableException('Unable to load email template for outbox planning: template read failed')
    );
 });
});
