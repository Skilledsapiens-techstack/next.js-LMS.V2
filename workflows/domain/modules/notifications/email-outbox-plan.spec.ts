import { createEmailOutboxPlan, emailOutboxPayloadHash } from './email-outbox-plan';

const template = {
  key: 'support.ticket.created',
  subject: 'Ticket {{ticketId}} created',
  htmlBody: '<p>Hello {{studentName}}, ticket {{ticketId}} is open.</p>',
  textBody: 'Hello {{studentName}}, ticket {{ticketId}} is open.'
};

describe('createEmailOutboxPlan', () => {
  it('builds a deterministic pending email outbox row and audit intent', () => {
    expect(
      createEmailOutboxPlan({
        template,
        recipient: {
          email: ' Student@Example.com ',
          name: ' Student One '
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
        requestedBy: ' Student@Example.com ',
        requestedAt: '2026-06-27T10:00:00.000Z',
        correlationId: 'request-123',
        priority: 'high'
      })
    ).toEqual({
      shouldEnqueue: true,
      reason: 'ready',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      emailJobRow: {
        idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        template_key: 'support.ticket.created',
        recipient_email: 'student@example.com',
        recipient_name: 'Student One',
        subject: 'Ticket SUP-123 created',
        html_body: '<p>Hello Student One, ticket SUP-123 is open.</p>',
        text_body: 'Hello Student One, ticket SUP-123 is open.',
        status: 'pending',
        priority: 'high',
        entity_table: 'support_tickets',
        entity_id: 'ticket-uuid',
        entity_action: 'created',
        requested_by: 'student@example.com',
        requested_at: '2026-06-27T10:00:00.000Z',
        correlation_id: 'request-123',
        attempt_count: 0
      },
      auditEvent: {
        idempotency_key: 'audit:email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created:email.enqueued',
        action: 'email.enqueued',
        entity: 'email_outbox',
        entity_id: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        actor_id: 'student@example.com',
        next_state: {
          templateKey: 'support.ticket.created',
          recipientEmail: 'student@example.com',
          entityTable: 'support_tickets',
          entityId: 'ticket-uuid',
          entityAction: 'created',
          priority: 'high'
        }
      }
    });
  });

  it('defaults priority and keeps missing variables blank', () => {
    const plan = createEmailOutboxPlan({
      template,
      recipient: { email: 'student@example.com' },
      variables: { ticketId: 'SUP-123' },
      entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
      requestedBy: 'system:supabase',
      requestedAt: '2026-06-27T10:00:00.000Z'
    });

    expect(plan.emailJobRow).toMatchObject({
      priority: 'normal',
      html_body: '<p>Hello , ticket SUP-123 is open.</p>'
    });
  });

  it('escapes rendered values before storing email bodies', () => {
    const plan = createEmailOutboxPlan({
      template,
      recipient: { email: 'student@example.com' },
      variables: {
        studentName: '<script>alert("x")</script>',
        ticketId: 'SUP-123'
      },
      entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
      requestedBy: 'system:supabase',
      requestedAt: '2026-06-27T10:00:00.000Z'
    });

    expect(plan.emailJobRow?.html_body).toBe('<p>Hello &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;, ticket SUP-123 is open.</p>');
  });

  it('uses the same idempotency key for repeated requests against the same business entity', () => {
    const first = createEmailOutboxPlan({
      template,
      recipient: { email: 'student@example.com' },
      variables: { studentName: 'One', ticketId: 'SUP-123' },
      entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
      requestedBy: 'system:supabase'
    });
    const second = createEmailOutboxPlan({
      template,
      recipient: { email: 'student@example.com' },
      variables: { studentName: 'Two', ticketId: 'SUP-123' },
      entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
      requestedBy: 'system:supabase'
    });

    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });

  it('creates a stable payload hash for rendered content comparisons', () => {
    const plan = createEmailOutboxPlan({
      template,
      recipient: { email: 'student@example.com' },
      variables: { studentName: 'Student One', ticketId: 'SUP-123' },
      entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
      requestedBy: 'system:supabase',
      requestedAt: '2026-06-27T10:00:00.000Z'
    });

    expect(emailOutboxPayloadHash(plan.emailJobRow!)).toHaveLength(64);
    expect(emailOutboxPayloadHash(plan.emailJobRow!)).toBe(emailOutboxPayloadHash(plan.emailJobRow!));
  });

  it('rejects unsafe or incomplete enqueue plans before building rows', () => {
    const base = {
      template,
      recipient: { email: 'student@example.com' },
      entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
      requestedBy: 'system:supabase'
    };

    expect(createEmailOutboxPlan({ ...base, template: { ...template, key: ' ' } })).toEqual({ shouldEnqueue: false, reason: 'missing_template_key' });
    expect(createEmailOutboxPlan({ ...base, recipient: { email: ' ' } })).toEqual({ shouldEnqueue: false, reason: 'missing_recipient_email' });
    expect(createEmailOutboxPlan({ ...base, entity: { table: ' ', id: 'ticket-uuid', action: 'created' } })).toEqual({ shouldEnqueue: false, reason: 'missing_entity' });
    expect(createEmailOutboxPlan({ ...base, requestedBy: ' ' })).toEqual({ shouldEnqueue: false, reason: 'missing_requested_by' });
    expect(createEmailOutboxPlan({ ...base, template: { ...template, subject: ' ' } })).toEqual({ shouldEnqueue: false, reason: 'missing_subject' });
    expect(createEmailOutboxPlan({ ...base, template: { ...template, htmlBody: ' ' } })).toEqual({ shouldEnqueue: false, reason: 'missing_body' });
    expect(createEmailOutboxPlan({ ...base, priority: 'urgent' as never })).toEqual({ shouldEnqueue: false, reason: 'invalid_priority' });
  });
});
