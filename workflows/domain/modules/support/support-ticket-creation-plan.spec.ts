import { createSupportTicketCreationPlan, SupportTicketCreationStudent } from './support-ticket-creation-plan';

const student: SupportTicketCreationStudent = {
  id: 'student-uuid',
  email: ' Student@Example.com ',
  fullName: ' Student Name '
};

describe('createSupportTicketCreationPlan', () => {
  it('plans a student support ticket creation with first public message and audit intent', () => {
    const plan = createSupportTicketCreationPlan(student, {
      categoryName: ' Course Access ',
      subject: ' Cannot access MBA recordings ',
      body: 'The latest workshop recording is locked for me.',
      priority: 'high',
      clientRequestId: 'client-request-123',
      createdAt: '2026-06-27T10:00:00.000Z'
    });

    expect(plan).toEqual({
      shouldCreate: true,
      reason: 'ready',
      idempotencyKey: 'support_ticket:student@example.com:client-request-123',
      ticketId: expect.stringMatching(/^SUP-[A-F0-9]{10}$/),
      supportTicketRow: {
        id: 'support_ticket:student@example.com:client-request-123',
        ticket_id: expect.stringMatching(/^SUP-[A-F0-9]{10}$/),
        student_id: 'student-uuid',
        student_email: 'student@example.com',
        student_name: 'Student Name',
        category_name: 'Course Access',
        priority: 'high',
        subject: 'Cannot access MBA recordings',
        status: 'open',
        conversation_mode: 'two_way',
        idempotency_key: 'support_ticket:student@example.com:client-request-123',
        created_at: '2026-06-27T10:00:00.000Z',
        updated_at: '2026-06-27T10:00:00.000Z',
        last_message_at: '2026-06-27T10:00:00.000Z',
        last_student_reply_at: '2026-06-27T10:00:00.000Z'
      },
      firstMessageRow: {
        id: 'support_ticket:student@example.com:client-request-123:message:initial',
        ticket_id: 'support_ticket:student@example.com:client-request-123',
        author_role: 'student',
        author_email: 'student@example.com',
        author_name: 'Student Name',
        body: 'The latest workshop recording is locked for me.',
        visibility: 'public',
        idempotency_key: 'support_ticket:student@example.com:client-request-123:message:initial',
        created_at: '2026-06-27T10:00:00.000Z'
      },
      auditEvent: {
        idempotency_key: 'audit:support_ticket:student@example.com:client-request-123:support_ticket.created',
        action: 'support_ticket.created',
        entity: 'support_tickets',
        entity_id: 'support_ticket:student@example.com:client-request-123',
        actor_id: 'student@example.com',
        next_state: {
          status: 'open',
          priority: 'high',
          categoryName: 'Course Access',
          subject: 'Cannot access MBA recordings'
        }
      }
    });
  });

  it('defaults priority and derives a deterministic idempotency key when a client request ID is not supplied', () => {
    const firstPlan = createSupportTicketCreationPlan(student, {
      categoryName: 'General',
      subject: 'Need help',
      body: 'Please help with my account.',
      createdAt: '2026-06-27T10:00:00.000Z'
    });
    const secondPlan = createSupportTicketCreationPlan(student, {
      categoryName: 'General',
      subject: 'Need help',
      body: 'Please help with my account.',
      createdAt: '2026-06-27T10:05:00.000Z'
    });

    expect(firstPlan.reason).toBe('ready');
    expect(firstPlan.supportTicketRow?.priority).toBe('normal');
    expect(firstPlan.idempotencyKey).toBe(secondPlan.idempotencyKey);
  });

  it('rejects missing required fields before planning rows', () => {
    expect(createSupportTicketCreationPlan({ ...student, email: ' ' }, { categoryName: 'General', subject: 'Need help', body: 'Help' })).toEqual({
      shouldCreate: false,
      reason: 'missing_student_email'
    });
    expect(createSupportTicketCreationPlan(student, { categoryName: ' ', subject: 'Need help', body: 'Help' })).toEqual({
      shouldCreate: false,
      reason: 'missing_category'
    });
    expect(createSupportTicketCreationPlan(student, { categoryName: 'General', subject: ' ', body: 'Help' })).toEqual({
      shouldCreate: false,
      reason: 'missing_subject'
    });
    expect(createSupportTicketCreationPlan(student, { categoryName: 'General', subject: 'Need help', body: ' ' })).toEqual({
      shouldCreate: false,
      reason: 'missing_body'
    });
  });

  it('rejects invalid priority values defensively', () => {
    expect(
      createSupportTicketCreationPlan(student, {
        categoryName: 'General',
        subject: 'Need help',
        body: 'Help',
        priority: 'critical' as never
      })
    ).toEqual({
      shouldCreate: false,
      reason: 'invalid_priority'
    });
  });
});
