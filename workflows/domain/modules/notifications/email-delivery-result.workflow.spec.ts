import { EmailDeliveryResultExecutionResult } from './email-delivery-result.executor';
import { EmailDeliveryResultLoadResult } from './email-delivery-result.loader';
import { createEmailDeliveryResultPlan } from './email-delivery-result-plan';
import { EmailDeliveryResultWorkflow } from './email-delivery-result.workflow';

class MockLoader {
  input?: unknown;
  result: EmailDeliveryResultLoadResult = {
    status: 'ready',
    message: 'Email delivery result plan loaded.',
    plan: createEmailDeliveryResultPlan(
      {
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        status: 'sending',
        attemptCount: 1,
        maxAttempts: 3,
        workerId: 'email-worker-1'
      },
      {
        workerId: 'email-worker-1',
        success: true,
        providerMessageId: 'provider-message-123',
        deliveredAt: '2026-06-27T10:01:00.000Z'
      }
    )
  };

  loadPlan(input: unknown) {
    this.input = input;
    return Promise.resolve(this.result);
  }
}

class MockExecutor {
  plan?: unknown;
  result: EmailDeliveryResultExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
    message: 'Email delivery result writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('EmailDeliveryResultWorkflow', () => {
  it('loads a delivery result plan and delegates execution without provider calls', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new EmailDeliveryResultWorkflow(loader as never, executor as never);
    const input = {
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      workerId: 'email-worker-1',
      success: true,
      providerMessageId: 'provider-message-123',
      deliveredAt: '2026-06-27T10:01:00.000Z'
    };

    await expect(workflow.recordDeliveryResult(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Email delivery result writes are disabled. No Supabase write was attempted.',
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
      message: 'No email outbox job matched the delivery result source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new EmailDeliveryResultWorkflow(loader as never, executor as never);

    await expect(
      workflow.recordDeliveryResult({
        idempotencyKey: 'missing-email-job',
        workerId: 'email-worker-1',
        success: true,
        providerMessageId: 'provider-message-123'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No email outbox job matched the delivery result source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns delivery result write failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'result write failed',
      completedSteps: [],
      failedStep: 'email_outbox'
    };
    const workflow = new EmailDeliveryResultWorkflow(loader as never, executor as never);

    await expect(
      workflow.recordDeliveryResult({
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        workerId: 'email-worker-1',
        success: true,
        providerMessageId: 'provider-message-123'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'result write failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      execution: executor.result
    });
  });
});
