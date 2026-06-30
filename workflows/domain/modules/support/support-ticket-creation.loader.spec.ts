import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { SupportTicketCreationLoader } from './support-ticket-creation.loader';

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
      'students',
      {
        data: {
          id: 'student-uuid',
          email: 'student@example.com',
          full_name: 'Student Name',
          active: true
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

describe('SupportTicketCreationLoader', () => {
  it('loads an active student into a support ticket creation plan', async () => {
    const supabase = new MockSupabase();
    const loader = new SupportTicketCreationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        studentEmail: ' Student@Example.com ',
        ticket: {
          categoryName: 'Course Access',
          subject: 'Cannot access MBA recordings',
          body: 'The latest workshop recording is locked for me.',
          priority: 'high',
          clientRequestId: 'client-request-123',
          createdAt: '2026-06-27T10:00:00.000Z'
       }
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Support ticket creation plan loaded.',
      plan: {
        shouldCreate: true,
        reason: 'ready',
        idempotencyKey: 'support_ticket:student@example.com:client-request-123',
        supportTicketRow: {
          student_id: 'student-uuid',
          student_email: 'student@example.com',
          student_name: 'Student Name',
          category_name: 'Course Access',
          priority: 'high',
          subject: 'Cannot access MBA recordings'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['students']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['email', 'student@example.com'] },
        { method: 'eq', args: ['active', true] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when student email is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new SupportTicketCreationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        studentEmail: ' ',
        ticket: {
          categoryName: 'General',
          subject: 'Need help',
          body: 'Help'
       }
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Student email is required to load a support ticket creation plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the active student does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('students', { data: null, error: null });
    const loader = new SupportTicketCreationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        studentEmail: 'student@example.com',
        ticket: {
          categoryName: 'General',
          subject: 'Need help',
          body: 'Help'
       }
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No active student matched the support ticket creation source.'
   });
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('students', { data: null, error: { message: 'student query failed' } });
    const loader = new SupportTicketCreationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        studentEmail: 'student@example.com',
        ticket: {
          categoryName: 'General',
          subject: 'Need help',
          body: 'Help'
       }
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
