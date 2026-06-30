import { NotFoundException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { StudentSupportTicketsService } from './student-support-tickets.service';

type QueryResult = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

class MockSupportQuery {
  filters: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.filters.push({ method: 'select', args });
    return this;
 }

  eq(...args: unknown[]) {
    this.filters.push({ method: 'eq', args });
    return this;
 }

  or(...args: unknown[]) {
    this.filters.push({ method: 'or', args });
    return this;
 }

  order(...args: unknown[]) {
    this.filters.push({ method: 'order', args });
    return this;
 }

  range(...args: unknown[]) {
    this.filters.push({ method: 'range', args });
    return this;
 }

  limit(...args: unknown[]) {
    this.filters.push({ method: 'limit', args });
    return this;
 }

  single() {
    this.filters.push({ method: 'single', args: [] });
    return this;
 }

  then(resolve: (value: QueryResult) => void) {
    resolve(this.result);
 }
}

class MockSupabaseAdmin {
  supportTicketsResult: QueryResult = { data: [], error: null, count: 0 };
  supportTicketMessagesResult: QueryResult = { data: [], error: null, count: 0 };
  lastSupportTicketsQuery?: MockSupportQuery;
  lastSupportTicketMessagesQuery?: MockSupportQuery;

  from(tableName: string) {
    if (tableName === 'support_tickets') {
      this.lastSupportTicketsQuery = new MockSupportQuery(this.supportTicketsResult);
      return this.lastSupportTicketsQuery;
   }

    if (tableName === 'support_ticket_messages') {
      this.lastSupportTicketMessagesQuery = new MockSupportQuery(this.supportTicketMessagesResult);
      return this.lastSupportTicketMessagesQuery;
   }

    throw new Error(`Unexpected table: ${tableName}`);
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

class MockStudentsService {
  getCurrentStudent = jest.fn().mockResolvedValue({
    id: 'student-uuid',
    fullName: 'Student One',
    email: ' Student@Example.com ',
    trackRoleIds: [],
    active: true
 });
}

function createUser(): User {
  return {
    id: 'auth-user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date('2026-06-26T00:00:00.000Z').toISOString(),
    email: 'student@example.com'
 };
}

describe('StudentSupportTicketsService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentSupportTicketsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentSupportTicketsService(supabase as never, studentsService as never);
 });

  it('lists only the authenticated student support tickets with bounded pagination', async () => {
    supabase.admin.supportTicketsResult = {
      data: [
        {
          id: 'ticket-uuid',
          ticket_id: 'SUP-20260626-0001',
          student_email: 'student@example.com',
          category_name: 'Login / Access',
          priority: 'normal',
          subject: 'Unable to login',
          status: 'waiting_for_student',
          conversation_mode: 'two_way',
          sla_due_at: '2026-06-28T00:00:00.000Z',
          resolved_at: null,
          closed_at: null,
          last_message_at: '2026-06-26T02:00:00.000Z',
          last_student_reply_at: '2026-06-26T01:00:00.000Z',
          last_admin_reply_at: '2026-06-26T02:00:00.000Z',
          created_at: '2026-06-26T00:00:00.000Z',
          updated_at: '2026-06-26T02:00:00.000Z',
          description: 'should-not-be-selected',
          attachment_path: 'should-not-be-selected'
       }
      ],
      error: null,
      count: 1
   };

    const result = await service.listMyTickets(createUser(), { page: 1, limit: 25, status: 'all' });

    expect(result.items[0]).toEqual({
      id: 'ticket-uuid',
      ticketId: 'SUP-20260626-0001',
      categoryName: 'Login / Access',
      priority: 'normal',
      subject: 'Unable to login',
      status: 'waiting_for_student',
      conversationMode: 'two_way',
      canReply: true,
      slaDueAt: '2026-06-28T00:00:00.000Z',
      lastMessageAt: '2026-06-26T02:00:00.000Z',
      lastStudentReplyAt: '2026-06-26T01:00:00.000Z',
      lastAdminReplyAt: '2026-06-26T02:00:00.000Z',
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T02:00:00.000Z'
   });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastSupportTicketsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'order', args: ['updated_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastSupportTicketsQuery?.filters[0]?.args[0]).not.toContain('description');
    expect(supabase.admin.lastSupportTicketsQuery?.filters[0]?.args[0]).not.toContain('attachment_path');
 });

  it('applies student-safe status and search filters', async () => {
    await service.listMyTickets(createUser(), {
      page: 2,
      limit: 10,
      status: 'open',
      search: ' Login Issue '
   });

    expect(supabase.admin.lastSupportTicketsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'eq', args: ['status', 'open'] },
        {
          method: 'or',
          args: [['ticket_id.ilike.%login issue%', 'category_name.ilike.%login issue%', 'subject.ilike.%login issue%'].join(',')]
       },
        { method: 'range', args: [10, 19] }
      ])
    );
 });

  it('loads a student ticket thread without exposing internal messages or author emails', async () => {
    supabase.admin.supportTicketsResult = {
      data: {
        id: 'ticket-uuid',
        ticket_id: 'SUP-20260626-0001',
        student_email: 'student@example.com',
        category_name: 'Login / Access',
        priority: 'normal',
        subject: 'Unable to login',
        status: 'in_review',
        conversation_mode: 'two_way',
        sla_due_at: null,
        resolved_at: null,
        closed_at: null,
        last_message_at: '2026-06-26T02:00:00.000Z',
        last_student_reply_at: '2026-06-26T01:00:00.000Z',
        last_admin_reply_at: '2026-06-26T02:00:00.000Z',
        created_at: '2026-06-26T00:00:00.000Z',
        updated_at: '2026-06-26T02:00:00.000Z'
     },
      error: null
   };
    supabase.admin.supportTicketMessagesResult = {
      data: [
        {
          id: 'message-1',
          author_role: 'student',
          author_email: 'student@example.com',
          author_name: 'Student One',
          body: 'I cannot login.',
          visibility: 'public',
          created_at: '2026-06-26T01:00:00.000Z'
       },
        {
          id: 'message-2',
          author_role: 'admin',
          author_email: 'admin@example.com',
          author_name: 'Support Team',
          body: 'We are checking this.',
          visibility: 'public',
          created_at: '2026-06-26T02:00:00.000Z'
       }
      ],
      error: null
   };

    const result = await service.getMyTicketDetail(createUser(), 'ticket-uuid');

    expect(result.ticket).toMatchObject({
      id: 'ticket-uuid',
      ticketId: 'SUP-20260626-0001',
      canReply: true
   });
    expect(result.messages).toEqual([
      {
        id: 'message-1',
        authorRole: 'student',
        authorName: 'Student One',
        body: 'I cannot login.',
        createdAt: '2026-06-26T01:00:00.000Z'
     },
      {
        id: 'message-2',
        authorRole: 'admin',
        authorName: 'Support Team',
        body: 'We are checking this.',
        createdAt: '2026-06-26T02:00:00.000Z'
     }
    ]);
    expect(supabase.admin.lastSupportTicketsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['id', 'ticket-uuid'] },
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'single', args: [] }
      ])
    );
    expect(supabase.admin.lastSupportTicketMessagesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['ticket_id', 'ticket-uuid'] },
        { method: 'eq', args: ['visibility', 'public'] },
        { method: 'limit', args: [101] }
      ])
    );
 });

  it('marks resolved and admin-only tickets as non-replyable', async () => {
    supabase.admin.supportTicketsResult = {
      data: [
        {
          id: 'ticket-uuid',
          ticket_id: null,
          student_email: 'student@example.com',
          category_name: 'Certificate',
          priority: 'low',
          subject: 'Certificate request',
          status: 'resolved',
          conversation_mode: 'admin_only',
          sla_due_at: null,
          resolved_at: null,
          closed_at: null,
          last_message_at: null,
          last_student_reply_at: null,
          last_admin_reply_at: null,
          created_at: null,
          updated_at: null
       }
      ],
      error: null,
      count: 1
   };

    const result = await service.listMyTickets(createUser(), { page: 1, limit: 25, status: 'all' });

    expect(result.items[0]?.canReply).toBe(false);
 });

  it('returns not found when the ticket does not belong to the authenticated student', async () => {
    supabase.admin.supportTicketsResult = {
      data: null,
      error: { message: 'No rows', code: 'PGRST116' }
   };

    await expect(service.getMyTicketDetail(createUser(), 'other-ticket')).rejects.toBeInstanceOf(NotFoundException);
 });
});
