import { EmailOutboxExecutionResult } from './email-outbox.executor';
import { EmailOutboxLoadResult } from './email-outbox.loader';
import { createEmailOutboxPlan } from './email-outbox-plan';
import { EmailOutboxWorkflow } from './email-outbox.workflow';

class MockLoader {
  input?: unknown;
  result: EmailOutboxLoadResult = {
    status: 'ready',
    message: 'Email outbox plan loaded.',
    plan: createEmailOutboxPlan({
      template: {
        key: 'support.ticket.created',
        subject: 'Ticket {{ticketId}} created',
        htmlBody: '<p>Hello {{studentName}}</p>',
        textBody: 'Hello {{studentName}}'
      },
      recipient: {
        email: 'student@example.com',
        name: 'Student One'
      },
      variables: {
        ticketId: 'SUP-123',
        studentName: 'Student One'
      },
      entity: {
        table: 'support_tickets',
        id: 'ticket-uuid',
        action: 'created'
      },
      requestedBy: 'system:supabase',
      requestedAt: '2026-06-27T10:00:00.000Z'
    })
  };

  loadPlan(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockExecutor {
  plan?: unknown;
  result: EmailOutboxExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
    message: 'Email outbox writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('EmailOutboxWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new EmailOutboxWorkflow(loader as never, executor as never);
    const input = {
      templateKey: 'support.ticket.created',
      recipient: { email: 'student@example.com' },
      variables: { ticketId: 'SUP-123' },
      entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
      requestedBy: 'system:supabase'
    };

    await expect(workflow.enqueueEmail(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Email outbox writes are disabled. No Supabase write was attempted.',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No active email template matched the outbox source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new EmailOutboxWorkflow(loader as never, executor as never);

    await expect(
      workflow.enqueueEmail({
        templateKey: 'missing.template',
        recipient: { email: 'student@example.com' },
        entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
        requestedBy: 'system:supabase'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No active email template matched the outbox source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns email outbox failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'outbox write failed',
      completedSteps: [],
      failedStep: 'email_outbox'
    };
    const workflow = new EmailOutboxWorkflow(loader as never, executor as never);

    await expect(
      workflow.enqueueEmail({
        templateKey: 'support.ticket.created',
        recipient: { email: 'student@example.com' },
        entity: { table: 'support_tickets', id: 'ticket-uuid', action: 'created' },
        requestedBy: 'system:supabase'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'outbox write failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      execution: executor.result
    });
  });
});
