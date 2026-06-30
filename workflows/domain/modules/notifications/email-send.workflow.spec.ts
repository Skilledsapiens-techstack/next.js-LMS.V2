import { EmailDeliveryResultWorkflowResult } from './email-delivery-result.workflow';
import { EmailDispatchExecutionResult } from './email-dispatch.executor';
import { EmailDispatchLoadResult } from './email-dispatch.loader';
import { createEmailDispatchPlan } from './email-dispatch-plan';
import { EmailProviderSendResult } from './email-provider.sender';
import { EmailSendWorkflow } from './email-send.workflow';

const idempotencyKey = 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created';
const input = {
  idempotencyKey,
  workerId: 'email-worker-1',
  now: '2026-06-27T10:00:00.000Z'
};
const plan = createEmailDispatchPlan(
  {
    idempotencyKey,
    status: 'pending',
    recipientEmail: 'student@example.com',
    subject: 'Ticket SUP-123 created',
    htmlBody: '<p>Hello Student</p>',
    textBody: 'Hello Student',
    attemptCount: 0
  },
  input
);

class MockLoader {
  result: EmailDispatchLoadResult = {
    status: 'ready',
    message: 'Email dispatch plan loaded.',
    plan
  };
  input?: unknown;

  loadPlan(inputValue: unknown) {
    this.input = inputValue;
    return Promise.resolve(this.result);
  }
}

class MockDispatchExecutor {
  result: EmailDispatchExecutionResult = {
    enabled: true,
    attempted: true,
    status: 'updated',
    idempotencyKey,
    message: 'Email dispatch lock write completed.',
    completedSteps: ['email_outbox']
  };
  plan?: unknown;

  execute(planValue: unknown) {
    this.plan = planValue;
    return Promise.resolve(this.result);
  }
}

class MockSender {
  result: EmailProviderSendResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    message: 'Email provider sends are disabled. No provider call was attempted.'
  };
  payload?: unknown;

  send(payload: unknown) {
    this.payload = payload;
    return Promise.resolve(this.result);
  }
}

class MockDeliveryResultWorkflow {
  result: EmailDeliveryResultWorkflowResult = {
    status: 'disabled',
    message: 'Email delivery result writes are disabled. No Supabase write was attempted.',
    idempotencyKey,
    execution: {
      enabled: false,
      attempted: false,
      status: 'disabled',
      idempotencyKey,
      message: 'Email delivery result writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    }
  };
  input?: unknown;

  recordDeliveryResult(inputValue: unknown) {
    this.input = inputValue;
    return Promise.resolve(this.result);
  }
}

describe('EmailSendWorkflow', () => {
  it('returns not found without dispatching when the email job cannot be loaded', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No email outbox job matched the dispatch source identity.'
    };
    const dispatchExecutor = new MockDispatchExecutor();
    const sender = new MockSender();
    const deliveryResultWorkflow = new MockDeliveryResultWorkflow();
    const workflow = new EmailSendWorkflow(loader as never, dispatchExecutor as never, sender as never, deliveryResultWorkflow as never);

    await expect(workflow.send(input)).resolves.toEqual({
      status: 'not_found',
      message: 'No email outbox job matched the dispatch source identity.'
    });
    expect(dispatchExecutor.plan).toBeUndefined();
    expect(sender.payload).toBeUndefined();
  });

  it('does not call the provider when dispatch locking is blocked', async () => {
    const loader = new MockLoader();
    const dispatchExecutor = new MockDispatchExecutor();
    dispatchExecutor.result = {
      enabled: false,
      attempted: false,
      status: 'disabled',
      idempotencyKey,
      message: 'Email dispatch writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    };
    const sender = new MockSender();
    const deliveryResultWorkflow = new MockDeliveryResultWorkflow();
    const workflow = new EmailSendWorkflow(loader as never, dispatchExecutor as never, sender as never, deliveryResultWorkflow as never);

    await expect(workflow.send(input)).resolves.toEqual({
      status: 'dispatch_blocked',
      message: 'Email dispatch writes are disabled. No Supabase write was attempted.',
      idempotencyKey,
      dispatch: dispatchExecutor.result
    });
    expect(sender.payload).toBeUndefined();
  });

  it('does not record delivery result when provider sending is disabled', async () => {
    const loader = new MockLoader();
    const dispatchExecutor = new MockDispatchExecutor();
    const sender = new MockSender();
    const deliveryResultWorkflow = new MockDeliveryResultWorkflow();
    const workflow = new EmailSendWorkflow(loader as never, dispatchExecutor as never, sender as never, deliveryResultWorkflow as never);

    await expect(workflow.send(input)).resolves.toEqual({
      status: 'provider_blocked',
      message: 'Email provider sends are disabled. No provider call was attempted.',
      idempotencyKey,
      dispatch: dispatchExecutor.result,
      provider: sender.result
    });
    expect(sender.payload).toBe(plan.dispatchPayload);
    expect(deliveryResultWorkflow.input).toBeUndefined();
  });

  it('records a successful provider send as delivery success', async () => {
    const loader = new MockLoader();
    const dispatchExecutor = new MockDispatchExecutor();
    const sender = new MockSender();
    sender.result = {
      enabled: true,
      attempted: true,
      status: 'sent',
      message: 'Provider accepted email.',
      providerMessageId: 'provider-message-123',
      deliveredAt: '2026-06-27T10:01:00.000Z'
    };
    const deliveryResultWorkflow = new MockDeliveryResultWorkflow();
    const workflow = new EmailSendWorkflow(loader as never, dispatchExecutor as never, sender as never, deliveryResultWorkflow as never);

    await expect(workflow.send(input)).resolves.toEqual({
      status: 'sent',
      message: 'Email provider send completed.',
      idempotencyKey,
      dispatch: dispatchExecutor.result,
      provider: sender.result,
      deliveryResult: deliveryResultWorkflow.result
    });
    expect(deliveryResultWorkflow.input).toEqual({
      idempotencyKey,
      workerId: 'email-worker-1',
      deliveredAt: '2026-06-27T10:01:00.000Z',
      providerMessageId: 'provider-message-123',
      success: true,
      errorMessage: 'Provider accepted email.'
    });
  });

  it('records a provider failure as delivery failure', async () => {
    const loader = new MockLoader();
    const dispatchExecutor = new MockDispatchExecutor();
    const sender = new MockSender();
    sender.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      message: 'Provider rejected email.',
      errorMessage: 'provider_rejected'
    };
    const deliveryResultWorkflow = new MockDeliveryResultWorkflow();
    const workflow = new EmailSendWorkflow(loader as never, dispatchExecutor as never, sender as never, deliveryResultWorkflow as never);

    await expect(workflow.send(input)).resolves.toMatchObject({
      status: 'failed',
      message: 'Provider rejected email.',
      idempotencyKey
    });
    expect(deliveryResultWorkflow.input).toEqual({
      idempotencyKey,
      workerId: 'email-worker-1',
      deliveredAt: '2026-06-27T10:00:00.000Z',
      providerMessageId: undefined,
      success: false,
      errorMessage: 'provider_rejected'
    });
  });
});
