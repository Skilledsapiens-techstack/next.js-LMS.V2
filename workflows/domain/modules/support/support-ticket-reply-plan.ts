import { createHash } from 'crypto';

export type SupportTicketStatus = 'open' | 'in_review' | 'waiting_for_student' | 'resolved' | 'closed';
export type SupportTicketConversationMode = 'two_way' | 'admin_only';
export type SupportTicketReplyActorRole = 'student' | 'admin';
export type SupportTicketReplyVisibility = 'public' | 'internal';

export type SupportTicketForReply = {
  id: string;
  status: SupportTicketStatus;
  conversationMode: SupportTicketConversationMode;
  studentEmail: string;
};

export type SupportTicketReplyActor = {
  role: SupportTicketReplyActorRole;
  email: string;
  name?: string;
};

export type SupportTicketReplyInput = {
  body: string;
  visibility?: SupportTicketReplyVisibility;
  clientRequestId?: string;
  createdAt?: string;
};

export type SupportTicketReplyPlan = {
  shouldCreate: boolean;
  reason: 'ready' | 'missing_actor_email' | 'missing_body' | 'student_internal_reply_forbidden' | 'student_reply_forbidden' | 'ticket_closed';
  idempotencyKey?: string;
  messageRow?: {
    id: string;
    ticket_id: string;
    author_role: SupportTicketReplyActorRole;
    author_email: string;
    author_name?: string;
    body: string;
    visibility: SupportTicketReplyVisibility;
    idempotency_key: string;
    created_at: string;
  };
  ticketUpdate?: {
    id: string;
    status: SupportTicketStatus;
    updated_at: string;
    last_message_at: string;
    last_student_reply_at?: string;
    last_admin_reply_at?: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'support_ticket.student_replied' | 'support_ticket.admin_replied' | 'support_ticket.internal_note_added';
    entity: 'support_tickets';
    entity_id: string;
    actor_id: string;
    previous_state: {
      status: SupportTicketStatus;
    };
    next_state: {
      status: SupportTicketStatus;
      visibility: SupportTicketReplyVisibility;
      authorRole: SupportTicketReplyActorRole;
    };
  };
};

export function createSupportTicketReplyPlan(
  ticket: SupportTicketForReply,
  actor: SupportTicketReplyActor,
  input: SupportTicketReplyInput
): SupportTicketReplyPlan {
  const actorEmail = normalizeEmail(actor.email);
  const body = cleanText(input.body);
  const visibility = input.visibility ?? 'public';

  if (!actorEmail) {
    return { shouldCreate: false, reason: 'missing_actor_email' };
  }

  if (!body) {
    return { shouldCreate: false, reason: 'missing_body' };
  }

  if (ticket.status === 'closed') {
    return { shouldCreate: false, reason: 'ticket_closed' };
  }

  if (actor.role === 'student' && visibility === 'internal') {
    return { shouldCreate: false, reason: 'student_internal_reply_forbidden' };
  }

  if (actor.role === 'student' && (ticket.conversationMode !== 'two_way' || ticket.status === 'resolved')) {
    return { shouldCreate: false, reason: 'student_reply_forbidden' };
  }

  const createdAt = cleanText(input.createdAt) ?? new Date().toISOString();
  const requestKey = cleanText(input.clientRequestId) ?? hashParts([ticket.id, actor.role, actorEmail, body]).slice(0, 16);
  const idempotencyKey = `support_ticket_reply:${ticket.id}:${requestKey}`;
  const nextStatus = nextStatusForReply(ticket.status, actor.role, visibility);
  const action = auditActionForReply(actor.role, visibility);

  return {
    shouldCreate: true,
    reason: 'ready',
    idempotencyKey,
    messageRow: {
      id: idempotencyKey,
      ticket_id: ticket.id,
      author_role: actor.role,
      author_email: actorEmail,
      author_name: cleanText(actor.name),
      body,
      visibility,
      idempotency_key: idempotencyKey,
      created_at: createdAt
    },
    ticketUpdate: {
      id: ticket.id,
      status: nextStatus,
      updated_at: createdAt,
      last_message_at: createdAt,
      last_student_reply_at: actor.role === 'student' ? createdAt : undefined,
      last_admin_reply_at: actor.role === 'admin' ? createdAt : undefined
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}:${action}`,
      action,
      entity: 'support_tickets',
      entity_id: ticket.id,
      actor_id: actorEmail,
      previous_state: {
        status: ticket.status
      },
      next_state: {
        status: nextStatus,
        visibility,
        authorRole: actor.role
      }
    }
  };
}

function nextStatusForReply(
  currentStatus: SupportTicketStatus,
  actorRole: SupportTicketReplyActorRole,
  visibility: SupportTicketReplyVisibility
): SupportTicketStatus {
  if (actorRole === 'student') return 'open';
  if (visibility === 'internal') return currentStatus === 'open' ? 'in_review' : currentStatus;
  return 'waiting_for_student';
}

function auditActionForReply(
  actorRole: SupportTicketReplyActorRole,
  visibility: SupportTicketReplyVisibility
): 'support_ticket.student_replied' | 'support_ticket.admin_replied' | 'support_ticket.internal_note_added' {
  if (actorRole === 'student') return 'support_ticket.student_replied';
  if (visibility === 'internal') return 'support_ticket.internal_note_added';
  return 'support_ticket.admin_replied';
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
