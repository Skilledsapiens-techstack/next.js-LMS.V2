import { EmailDispatchExecutionResult } from './email-dispatch.executor';
import { EmailDispatchLoadResult } from './email-dispatch.loader';
import { createEmailDispatchPlan } from './email-dispatch-plan';
import { EmailDispatchWorkflow } from './email-dispatch.workflow';

class MockLoader {
  input?: unknown;
  result: EmailDispatchLoadResult = {
    status: 'ready',
    message: 'Email dispatch plan loaded.',
    plan: createEmailDispatchPlan(
      {
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        status: 'pending',
        recipientEmail: 'student@example.com',
        subject: 'Ticket SUP-123 created',
        htmlBody: '<p>Hello Student</p>',
        textBody: 'Hello Student',
        attemptCount: 0
      },
      {
        workerId: 'email-worker-1',
        now: '2026-06-27T10:00:00.000Z'
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
  result: EmailDispatchExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
    message: 'Email dispatch writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('EmailDispatchWorkflow', () => {
  it('loads a dispatch plan and delegates lock execution without provider sending', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new EmailDispatchWorkflow(loader as never, executor as never);
    const input = {
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      workerId: 'email-worker-1',
      now: '2026-06-27T10:00:00.000Z'
    };

    await expect(workflow.prepareDispatch(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Email dispatch writes are disabled. No Supabase write was attempted.',
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
      message: 'No email outbox job matched the dispatch source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new EmailDispatchWorkflow(loader as never, executor as never);

    await expect(
      workflow.prepareDispatch({
        idempotencyKey: 'missing-email-job',
        workerId: 'email-worker-1'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No email outbox job matched the dispatch source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns email dispatch lock failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      message: 'lock write failed',
      completedSteps: [],
      failedStep: 'email_outbox'
    };
    const workflow = new EmailDispatchWorkflow(loader as never, executor as never);

    await expect(
      workflow.prepareDispatch({
        idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        workerId: 'email-worker-1'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'lock write failed',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      execution: executor.result
    });
  });
});
