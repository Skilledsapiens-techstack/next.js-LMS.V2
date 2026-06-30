export type SupportTicketStatus = 'open' | 'in_review' | 'waiting_for_student' | 'resolved' | 'closed';

export type SupportTicketForStatusTransition = {
  id: string;
  status: SupportTicketStatus;
  assignedAdminEmail?: string;
};

export type SupportTicketStatusTransitionInput = {
  targetStatus: SupportTicketStatus;
  adminEmail: string;
  note?: string;
  changedAt?: string;
};

export type SupportTicketStatusTransitionPlan = {
  shouldTransition: boolean;
  reason: 'ready' | 'missing_admin' | 'already_in_target_state' | 'missing_resolution_note' | 'invalid_transition';
  idempotencyKey?: string;
  ticketUpdate?: {
    id: string;
    status: SupportTicketStatus;
    updated_at: string;
    assigned_admin_email?: string;
    resolved_at?: string;
    closed_at?: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action:
      | 'support_ticket.status_changed'
      | 'support_ticket.marked_in_review'
      | 'support_ticket.waiting_for_student'
      | 'support_ticket.resolved'
      | 'support_ticket.closed'
      | 'support_ticket.reopened';
    entity: 'support_tickets';
    entity_id: string;
    actor_id: string;
    previous_state: {
      status: SupportTicketStatus;
    };
    next_state: {
      status: SupportTicketStatus;
      note?: string;
      assignedAdminEmail?: string;
    };
  };
};

export function createSupportTicketStatusTransitionPlan(
  ticket: SupportTicketForStatusTransition,
  input: SupportTicketStatusTransitionInput
): SupportTicketStatusTransitionPlan {
  const adminEmail = normalizeEmail(input.adminEmail);
  const note = cleanText(input.note);

  if (!adminEmail) {
    return { shouldTransition: false, reason: 'missing_admin' };
  }

  if (ticket.status === input.targetStatus) {
    return { shouldTransition: false, reason: 'already_in_target_state' };
  }

  if ((input.targetStatus === 'resolved' || input.targetStatus === 'closed') && !note) {
    return { shouldTransition: false, reason: 'missing_resolution_note' };
  }

  if (!canTransition(ticket.status, input.targetStatus)) {
    return { shouldTransition: false, reason: 'invalid_transition' };
  }

  const changedAt = cleanText(input.changedAt) ?? new Date().toISOString();
  const idempotencyKey = `support_ticket_status:${ticket.id}:${ticket.status}:to:${input.targetStatus}`;
  const assignedAdminEmail = normalizeEmail(ticket.assignedAdminEmail ?? '') || adminEmail;

  return {
    shouldTransition: true,
    reason: 'ready',
    idempotencyKey,
    ticketUpdate: {
      id: ticket.id,
      status: input.targetStatus,
      updated_at: changedAt,
      assigned_admin_email: assignedAdminEmail,
      resolved_at: input.targetStatus === 'resolved' ? changedAt : undefined,
      closed_at: input.targetStatus === 'closed' ? changedAt : undefined
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}:${auditAction(input.targetStatus, ticket.status)}`,
      action: auditAction(input.targetStatus, ticket.status),
      entity: 'support_tickets',
      entity_id: ticket.id,
      actor_id: adminEmail,
      previous_state: {
        status: ticket.status
      },
      next_state: {
        status: input.targetStatus,
        note,
        assignedAdminEmail
      }
    }
  };
}

function canTransition(currentStatus: SupportTicketStatus, targetStatus: SupportTicketStatus): boolean {
  const allowedTransitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
    open: ['in_review', 'waiting_for_student', 'resolved', 'closed'],
    in_review: ['open', 'waiting_for_student', 'resolved', 'closed'],
    waiting_for_student: ['open', 'in_review', 'resolved', 'closed'],
    resolved: ['open', 'closed'],
    closed: ['open']
  };

  return allowedTransitions[currentStatus].includes(targetStatus);
}

function auditAction(
  targetStatus: SupportTicketStatus,
  previousStatus: SupportTicketStatus
):
  | 'support_ticket.status_changed'
  | 'support_ticket.marked_in_review'
  | 'support_ticket.waiting_for_student'
  | 'support_ticket.resolved'
  | 'support_ticket.closed'
  | 'support_ticket.reopened' {
  if (targetStatus === 'in_review') return 'support_ticket.marked_in_review';
  if (targetStatus === 'waiting_for_student') return 'support_ticket.waiting_for_student';
  if (targetStatus === 'resolved') return 'support_ticket.resolved';
  if (targetStatus === 'closed') return 'support_ticket.closed';
  if (targetStatus === 'open' && (previousStatus === 'resolved' || previousStatus === 'closed')) return 'support_ticket.reopened';
  return 'support_ticket.status_changed';
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
