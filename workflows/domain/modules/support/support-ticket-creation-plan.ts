import { createHash } from 'crypto';

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type SupportTicketCreationStudent = {
  id?: string;
  email: string;
  fullName?: string;
};

export type SupportTicketCreationInput = {
  categoryName: string;
  subject: string;
  body: string;
  priority?: SupportTicketPriority;
  clientRequestId?: string;
  createdAt?: string;
};

export type SupportTicketCreationPlan = {
  shouldCreate: boolean;
  reason: 'ready' | 'missing_student_email' | 'missing_category' | 'missing_subject' | 'missing_body' | 'invalid_priority';
  idempotencyKey?: string;
  ticketId?: string;
  supportTicketRow?: {
    id: string;
    ticket_id: string;
    student_id?: string;
    student_email: string;
    student_name?: string;
    category_name: string;
    priority: SupportTicketPriority;
    subject: string;
    status: 'open';
    conversation_mode: 'two_way';
    idempotency_key: string;
    created_at: string;
    updated_at: string;
    last_message_at: string;
    last_student_reply_at: string;
  };
  firstMessageRow?: {
    id: string;
    ticket_id: string;
    author_role: 'student';
    author_email: string;
    author_name?: string;
    body: string;
    visibility: 'public';
    idempotency_key: string;
    created_at: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'support_ticket.created';
    entity: 'support_tickets';
    entity_id: string;
    actor_id: string;
    next_state: {
      status: 'open';
      priority: SupportTicketPriority;
      categoryName: string;
      subject: string;
    };
  };
};

const allowedPriorities: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export function createSupportTicketCreationPlan(student: SupportTicketCreationStudent, input: SupportTicketCreationInput): SupportTicketCreationPlan {
  const studentEmail = normalizeEmail(student.email);
  const categoryName = cleanText(input.categoryName);
  const subject = cleanText(input.subject);
  const body = cleanText(input.body);
  const priority = input.priority ?? 'normal';

  if (!studentEmail) {
    return { shouldCreate: false, reason: 'missing_student_email' };
  }

  if (!categoryName) {
    return { shouldCreate: false, reason: 'missing_category' };
  }

  if (!subject) {
    return { shouldCreate: false, reason: 'missing_subject' };
  }

  if (!body) {
    return { shouldCreate: false, reason: 'missing_body' };
  }

  if (!allowedPriorities.includes(priority)) {
    return { shouldCreate: false, reason: 'invalid_priority' };
  }

  const createdAt = cleanText(input.createdAt) ?? new Date().toISOString();
  const requestKey = cleanText(input.clientRequestId) ?? hashParts([studentEmail, categoryName, subject, body]).slice(0, 16);
  const idempotencyKey = `support_ticket:${studentEmail}:${requestKey}`;
  const ticketId = `SUP-${hashParts([studentEmail, requestKey]).slice(0, 10).toUpperCase()}`;
  const messageId = `${idempotencyKey}:message:initial`;

  return {
    shouldCreate: true,
    reason: 'ready',
    idempotencyKey,
    ticketId,
    supportTicketRow: {
      id: idempotencyKey,
      ticket_id: ticketId,
      student_id: cleanText(student.id),
      student_email: studentEmail,
      student_name: cleanText(student.fullName),
      category_name: categoryName,
      priority,
      subject,
      status: 'open',
      conversation_mode: 'two_way',
      idempotency_key: idempotencyKey,
      created_at: createdAt,
      updated_at: createdAt,
      last_message_at: createdAt,
      last_student_reply_at: createdAt
    },
    firstMessageRow: {
      id: messageId,
      ticket_id: idempotencyKey,
      author_role: 'student',
      author_email: studentEmail,
      author_name: cleanText(student.fullName),
      body,
      visibility: 'public',
      idempotency_key: messageId,
      created_at: createdAt
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}:support_ticket.created`,
      action: 'support_ticket.created',
      entity: 'support_tickets',
      entity_id: idempotencyKey,
      actor_id: studentEmail,
      next_state: {
        status: 'open',
        priority,
        categoryName,
        subject
      }
    }
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function hashParts(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
