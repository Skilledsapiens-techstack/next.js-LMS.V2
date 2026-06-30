import { createSupportTicketStatusTransitionPlan, SupportTicketForStatusTransition } from './support-ticket-status-transition-plan';

const ticket: SupportTicketForStatusTransition = {
  id: 'support_ticket:student@example.com:client-request-123',
  status: 'open'
};

describe('createSupportTicketStatusTransitionPlan', () => {
  it('plans marking an open support ticket in review', () => {
    const plan = createSupportTicketStatusTransitionPlan(ticket, {
      targetStatus: 'in_review',
      adminEmail: ' Admin@Example.com ',
      changedAt: '2026-06-27T10:00:00.000Z'
    });

    expect(plan).toEqual({
      shouldTransition: true,
      reason: 'ready',
      idempotencyKey: 'support_ticket_status:support_ticket:student@example.com:client-request-123:open:to:in_review',
      ticketUpdate: {
        id: 'support_ticket:student@example.com:client-request-123',
        status: 'in_review',
        updated_at: '2026-06-27T10:00:00.000Z',
        assigned_admin_email: 'admin@example.com',
        resolved_at: undefined,
        closed_at: undefined
      },
      auditEvent: {
        idempotency_key:
          'audit:support_ticket_status:support_ticket:student@example.com:client-request-123:open:to:in_review:support_ticket.marked_in_review',
        action: 'support_ticket.marked_in_review',
        entity: 'support_tickets',
        entity_id: 'support_ticket:student@example.com:client-request-123',
        actor_id: 'admin@example.com',
        previous_state: {
          status: 'open'
        },
        next_state: {
          status: 'in_review',
          note: undefined,
          assignedAdminEmail: 'admin@example.com'
        }
      }
    });
  });

  it('plans resolving and closing tickets with required notes', () => {
    expect(
      createSupportTicketStatusTransitionPlan(
        { ...ticket, status: 'in_review', assignedAdminEmail: 'owner@example.com' },
        {
          targetStatus: 'resolved',
          adminEmail: 'admin@example.com',
          note: 'Access restored',
          changedAt: '2026-06-27T10:05:00.000Z'
        }
      )
    ).toMatchObject({
      shouldTransition: true,
      reason: 'ready',
      ticketUpdate: {
        status: 'resolved',
        assigned_admin_email: 'owner@example.com',
        resolved_at: '2026-06-27T10:05:00.000Z'
      },
      auditEvent: {
        action: 'support_ticket.resolved',
        next_state: {
          note: 'Access restored'
        }
      }
    });

    expect(
      createSupportTicketStatusTransitionPlan(
        { ...ticket, status: 'resolved' },
        {
          targetStatus: 'closed',
          adminEmail: 'admin@example.com',
          note: 'No further response',
          changedAt: '2026-06-27T10:10:00.000Z'
        }
      )
    ).toMatchObject({
      shouldTransition: true,
      reason: 'ready',
      ticketUpdate: {
        status: 'closed',
        closed_at: '2026-06-27T10:10:00.000Z'
      },
      auditEvent: {
        action: 'support_ticket.closed'
      }
    });
  });

  it('plans reopening resolved or closed tickets', () => {
    expect(
      createSupportTicketStatusTransitionPlan(
        { ...ticket, status: 'closed' },
        {
          targetStatus: 'open',
          adminEmail: 'admin@example.com',
          changedAt: '2026-06-27T10:15:00.000Z'
        }
      )
    ).toMatchObject({
      shouldTransition: true,
      reason: 'ready',
      ticketUpdate: {
        status: 'open'
      },
      auditEvent: {
        action: 'support_ticket.reopened'
      }
    });
  });

  it('blocks missing admin, no-op, missing resolution note, and invalid transitions', () => {
    expect(createSupportTicketStatusTransitionPlan(ticket, { targetStatus: 'in_review', adminEmail: ' ' })).toEqual({
      shouldTransition: false,
      reason: 'missing_admin'
    });
    expect(createSupportTicketStatusTransitionPlan(ticket, { targetStatus: 'open', adminEmail: 'admin@example.com' })).toEqual({
      shouldTransition: false,
      reason: 'already_in_target_state'
    });
    expect(createSupportTicketStatusTransitionPlan(ticket, { targetStatus: 'resolved', adminEmail: 'admin@example.com' })).toEqual({
      shouldTransition: false,
      reason: 'missing_resolution_note'
    });
    expect(createSupportTicketStatusTransitionPlan({ ...ticket, status: 'closed' }, { targetStatus: 'in_review', adminEmail: 'admin@example.com' })).toEqual({
      shouldTransition: false,
      reason: 'invalid_transition'
    });
  });
});
