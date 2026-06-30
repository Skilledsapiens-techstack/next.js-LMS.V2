import { createSupportTicketReplyPlan, SupportTicketForReply } from './support-ticket-reply-plan';

const ticket: SupportTicketForReply = {
  id: 'support_ticket:student@example.com:client-request-123',
  status: 'waiting_for_student',
  conversationMode: 'two_way',
  studentEmail: 'student@example.com'
};

describe('createSupportTicketReplyPlan', () => {
  it('plans a student public reply and reopens the ticket', () => {
    const plan = createSupportTicketReplyPlan(
      ticket,
      {
        role: 'student',
        email: ' Student@Example.com ',
        name: ' Student Name '
      },
      {
        body: ' I still need help. ',
        clientRequestId: 'reply-123',
        createdAt: '2026-06-27T10:00:00.000Z'
      }
    );

    expect(plan).toEqual({
      shouldCreate: true,
      reason: 'ready',
      idempotencyKey: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
      messageRow: {
        id: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
        ticket_id: 'support_ticket:student@example.com:client-request-123',
        author_role: 'student',
        author_email: 'student@example.com',
        author_name: 'Student Name',
        body: 'I still need help.',
        visibility: 'public',
        idempotency_key: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
        created_at: '2026-06-27T10:00:00.000Z'
      },
      ticketUpdate: {
        id: 'support_ticket:student@example.com:client-request-123',
        status: 'open',
        updated_at: '2026-06-27T10:00:00.000Z',
        last_message_at: '2026-06-27T10:00:00.000Z',
        last_student_reply_at: '2026-06-27T10:00:00.000Z',
        last_admin_reply_at: undefined
      },
      auditEvent: {
        idempotency_key: 'audit:support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123:support_ticket.student_replied',
        action: 'support_ticket.student_replied',
        entity: 'support_tickets',
        entity_id: 'support_ticket:student@example.com:client-request-123',
        actor_id: 'student@example.com',
        previous_state: {
          status: 'waiting_for_student'
        },
        next_state: {
          status: 'open',
          visibility: 'public',
          authorRole: 'student'
        }
      }
    });
  });

  it('plans an admin public reply and waits for student response', () => {
    expect(
      createSupportTicketReplyPlan(
        { ...ticket, status: 'in_review' },
        {
          role: 'admin',
          email: 'admin@example.com',
          name: 'Admin Name'
        },
        {
          body: 'Please share a screenshot.',
          visibility: 'public',
          clientRequestId: 'admin-public-reply',
          createdAt: '2026-06-27T10:05:00.000Z'
        }
      )
    ).toMatchObject({
      shouldCreate: true,
      reason: 'ready',
      messageRow: {
        author_role: 'admin',
        visibility: 'public'
      },
      ticketUpdate: {
        status: 'waiting_for_student',
        last_admin_reply_at: '2026-06-27T10:05:00.000Z'
      },
      auditEvent: {
        action: 'support_ticket.admin_replied'
      }
    });
  });

  it('plans an admin internal note without exposing it publicly', () => {
    expect(
      createSupportTicketReplyPlan(
        { ...ticket, status: 'open' },
        {
          role: 'admin',
          email: 'admin@example.com'
        },
        {
          body: 'Escalate to course ops.',
          visibility: 'internal',
          clientRequestId: 'internal-note',
          createdAt: '2026-06-27T10:10:00.000Z'
        }
      )
    ).toMatchObject({
      shouldCreate: true,
      reason: 'ready',
      messageRow: {
        author_role: 'admin',
        visibility: 'internal'
      },
      ticketUpdate: {
        status: 'in_review'
      },
      auditEvent: {
        action: 'support_ticket.internal_note_added'
      }
    });
  });

  it('derives deterministic idempotency when a client request ID is not supplied', () => {
    const firstPlan = createSupportTicketReplyPlan(ticket, { role: 'student', email: 'student@example.com' }, { body: 'Same reply' });
    const secondPlan = createSupportTicketReplyPlan(ticket, { role: 'student', email: 'student@example.com' }, { body: 'Same reply' });

    expect(firstPlan.reason).toBe('ready');
    expect(firstPlan.idempotencyKey).toBe(secondPlan.idempotencyKey);
  });

  it('blocks unsafe reply attempts', () => {
    expect(createSupportTicketReplyPlan(ticket, { role: 'student', email: ' ' }, { body: 'Help' })).toEqual({
      shouldCreate: false,
      reason: 'missing_actor_email'
    });
    expect(createSupportTicketReplyPlan(ticket, { role: 'student', email: 'student@example.com' }, { body: ' ' })).toEqual({
      shouldCreate: false,
      reason: 'missing_body'
    });
    expect(createSupportTicketReplyPlan(ticket, { role: 'student', email: 'student@example.com' }, { body: 'Internal', visibility: 'internal' })).toEqual({
      shouldCreate: false,
      reason: 'student_internal_reply_forbidden'
    });
    expect(
      createSupportTicketReplyPlan({ ...ticket, conversationMode: 'admin_only' }, { role: 'student', email: 'student@example.com' }, { body: 'Help' })
    ).toEqual({
      shouldCreate: false,
      reason: 'student_reply_forbidden'
    });
    expect(createSupportTicketReplyPlan({ ...ticket, status: 'closed' }, { role: 'admin', email: 'admin@example.com' }, { body: 'Closed' })).toEqual({
      shouldCreate: false,
      reason: 'ticket_closed'
    });
  });
});
