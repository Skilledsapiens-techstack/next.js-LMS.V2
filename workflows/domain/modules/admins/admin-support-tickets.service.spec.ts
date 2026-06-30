import { AdminSupportTicketsService } from './admin-support-tickets.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockSupportTicketsQuery {
  filters: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.filters.push({ method: 'select', args });
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

  eq(...args: unknown[]) {
    this.filters.push({ method: 'eq', args });
    return this;
  }

  or(...args: unknown[]) {
    this.filters.push({ method: 'or', args });
    return this;
  }

  single() {
    this.filters.push({ method: 'single', args: [] });
    return this;
  }

  limit(...args: unknown[]) {
    this.filters.push({ method: 'limit', args });
    return this;
  }

  then(resolve: (value: QueryResult) => void) {
    resolve(this.result);
  }
}

class MockSupabaseAdmin {
  supportTicketsResult: QueryResult = { data: [], error: null, count: 0 };
  supportTicketMessagesResult: QueryResult = { data: [], error: null, count: 0 };
  lastSupportTicketsQuery?: MockSupportTicketsQuery;
  lastSupportTicketMessagesQuery?: MockSupportTicketsQuery;

  from(tableName: string) {
    if (tableName === 'support_tickets') {
      this.lastSupportTicketsQuery = new MockSupportTicketsQuery(this.supportTicketsResult);
      return this.lastSupportTicketsQuery;
    }

    if (tableName === 'support_ticket_messages') {
      this.lastSupportTicketMessagesQuery = new MockSupportTicketsQuery(this.supportTicketMessagesResult);
      return this.lastSupportTicketMessagesQuery;
    }

    throw new Error(`Unexpected table: ${tableName}`);
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminSupportTicketsService', () => {
  let supabase: MockSupabase;
  let service: AdminSupportTicketsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminSupportTicketsService(supabase as never);
  });

  it('lists support tickets with bounded pagination metadata', async () => {
    supabase.admin.supportTicketsResult = {
      data: [
        {
          id: 'ticket-uuid',
          ticket_id: 'SUP-20260626-0001',
          student_email: ' Student@Example.com ',
          student_name: 'Saurabh',
          category_name: 'Login / Access',
          priority: 'urgent',
          subject: 'Unable to login',
          status: 'open',
          conversation_mode: 'two_way',
          sla_due_at: '2026-06-27T00:00:00.000Z',
          assigned_admin_email: 'admin@example.com',
          resolved_at: null,
          closed_at: null,
          last_message_at: '2026-06-26T02:00:00.000Z',
          last_student_reply_at: '2026-06-26T02:00:00.000Z',
          last_admin_reply_at: null,
          created_at: '2026-06-26T00:00:00.000Z',
          updated_at: '2026-06-26T02:00:00.000Z',
          description: 'should-not-be-selected',
          attachment_path: 'should-not-be-selected'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listTickets({ page: 1, limit: 25, status: 'all', priority: 'all' });

    expect(result.items[0]).toEqual({
      id: 'ticket-uuid',
      ticketId: 'SUP-20260626-0001',
      studentEmail: 'student@example.com',
      studentName: 'Saurabh',
      categoryName: 'Login / Access',
      priority: 'urgent',
      subject: 'Unable to login',
      status: 'open',
      conversationMode: 'two_way',
      slaDueAt: '2026-06-27T00:00:00.000Z',
      assignedAdminEmail: 'admin@example.com',
      lastMessageAt: '2026-06-26T02:00:00.000Z',
      lastStudentReplyAt: '2026-06-26T02:00:00.000Z',
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T02:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastSupportTicketsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['updated_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastSupportTicketsQuery?.filters[0]?.args[0]).not.toContain('description');
    expect(supabase.admin.lastSupportTicketsQuery?.filters[0]?.args[0]).not.toContain('attachment_path');
  });

  it('applies status, priority, category, and normalized search filters', async () => {
    await service.listTickets({
      page: 1,
      limit: 10,
      status: 'open',
      priority: 'urgent',
      category: 'Login / Access',
      search: ' Login Issue '
    });

    expect(supabase.admin.lastSupportTicketsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'open'] },
        { method: 'eq', args: ['priority', 'urgent'] },
        { method: 'eq', args: ['category_name', 'Login / Access'] },
        {
          method: 'or',
          args: [
            [
              'ticket_id.ilike.%login issue%',
              'student_email.ilike.%login issue%',
              'student_name.ilike.%login issue%',
              'category_name.ilike.%login issue%',
              'subject.ilike.%login issue%'
            ].join(',')
          ]
        }
      ])
    );
  });

  it('loads support ticket detail with a bounded message thread', async () => {
    supabase.admin.supportTicketsResult = {
      data: {
        id: 'ticket-uuid',
        ticket_id: 'SUP-20260626-0001',
        student_email: ' Student@Example.com ',
        student_name: 'Saurabh',
        category_name: 'Login / Access',
        priority: 'normal',
        subject: 'Unable to login',
        status: 'in_review',
        conversation_mode: 'two_way',
        sla_due_at: null,
        assigned_admin_email: 'admin@example.com',
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
          author_email: ' Student@Example.com ',
          author_name: 'Saurabh',
          body: 'I cannot login.',
          visibility: 'public',
          created_at: '2026-06-26T01:00:00.000Z'
        },
        {
          id: 'message-2',
          author_role: 'admin',
          author_email: ' Admin@Example.com ',
          author_name: 'Admin',
          body: 'We are checking this.',
          visibility: 'internal',
          created_at: '2026-06-26T02:00:00.000Z'
        }
      ],
      error: null
    };

    const result = await service.getTicketDetail('ticket-uuid');

    expect(result.ticket).toMatchObject({
      id: 'ticket-uuid',
      ticketId: 'SUP-20260626-0001',
      studentEmail: 'student@example.com',
      status: 'in_review'
    });
    expect(result.messages).toEqual([
      {
        id: 'message-1',
        authorRole: 'student',
        authorEmail: 'student@example.com',
        authorName: 'Saurabh',
        body: 'I cannot login.',
        visibility: 'public',
        createdAt: '2026-06-26T01:00:00.000Z'
      },
      {
        id: 'message-2',
        authorRole: 'admin',
        authorEmail: 'admin@example.com',
        authorName: 'Admin',
        body: 'We are checking this.',
        visibility: 'internal',
        createdAt: '2026-06-26T02:00:00.000Z'
      }
    ]);
    expect(result.messageLimit).toBe(100);
    expect(result.hasMoreMessages).toBe(false);
    expect(supabase.admin.lastSupportTicketsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['id', 'ticket-uuid'] },
        { method: 'single', args: [] }
      ])
    );
    expect(supabase.admin.lastSupportTicketMessagesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['ticket_id', 'ticket-uuid'] },
        { method: 'order', args: ['created_at', { ascending: true }] },
        { method: 'limit', args: [101] }
      ])
    );
  });

  it('marks support ticket detail when more messages are available', async () => {
    supabase.admin.supportTicketsResult = {
      data: {
        id: 'ticket-uuid',
        ticket_id: 'SUP-20260626-0001',
        student_email: 'student@example.com',
        student_name: null,
        category_name: 'Login / Access',
        priority: 'normal',
        subject: 'Unable to login',
        status: 'open',
        conversation_mode: 'two_way',
        sla_due_at: null,
        assigned_admin_email: null,
        resolved_at: null,
        closed_at: null,
        last_message_at: null,
        last_student_reply_at: null,
        last_admin_reply_at: null,
        created_at: null,
        updated_at: null
      },
      error: null
    };
    supabase.admin.supportTicketMessagesResult = {
      data: Array.from({ length: 101 }, (_, index) => ({
        id: `message-${index}`,
        author_role: 'system',
        author_email: 'system@example.com',
        author_name: null,
        body: `Message ${index}`,
        visibility: 'public',
        created_at: '2026-06-26T01:00:00.000Z'
      })),
      error: null
    };

    const result = await service.getTicketDetail('ticket-uuid');

    expect(result.messages).toHaveLength(100);
    expect(result.hasMoreMessages).toBe(true);
  });
});
