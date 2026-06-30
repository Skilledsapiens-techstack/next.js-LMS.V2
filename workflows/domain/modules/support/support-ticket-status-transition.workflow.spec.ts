import { SupportTicketStatusTransitionExecutionResult } from './support-ticket-status-transition.executor';
import { SupportTicketStatusTransitionLoadResult } from './support-ticket-status-transition.loader';
import { createSupportTicketStatusTransitionPlan } from './support-ticket-status-transition-plan';
import { SupportTicketStatusTransitionWorkflow } from './support-ticket-status-transition.workflow';

class MockLoader {
  input?: unknown;
  result: SupportTicketStatusTransitionLoadResult = {
    status: 'ready',
    message: 'Support ticket status transition plan loaded.',
    plan: createSupportTicketStatusTransitionPlan(
      {
        id: 'support_ticket:student@example.com:client-request-123',
        status: 'open',
        assignedAdminEmail: 'assigned.admin@example.com'
      },
      {
        targetStatus: 'in_review',
        adminEmail: 'admin@example.com',
        changedAt: '2026-06-27T10:00:00.000Z'
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
  result: SupportTicketStatusTransitionExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    ticketId: 'support_ticket:student@example.com:client-request-123',
    message: 'Support ticket status writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('SupportTicketStatusTransitionWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new SupportTicketStatusTransitionWorkflow(loader as never, executor as never);
    const input = {
      ticketId: 'support_ticket:student@example.com:client-request-123',
      targetStatus: 'in_review' as const,
      adminEmail: 'admin@example.com'
    };

    await expect(workflow.transitionStatus(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Support ticket status writes are disabled. No Supabase write was attempted.',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No support ticket matched the status transition source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new SupportTicketStatusTransitionWorkflow(loader as never, executor as never);

    await expect(
      workflow.transitionStatus({
        ticketId: 'missing-ticket',
        targetStatus: 'in_review',
        adminEmail: 'admin@example.com'
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No support ticket matched the status transition source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns support ticket status failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      message: 'status update failed',
      completedSteps: [],
      failedStep: 'support_tickets'
    };
    const workflow = new SupportTicketStatusTransitionWorkflow(loader as never, executor as never);

    await expect(
      workflow.transitionStatus({
        ticketId: 'support_ticket:student@example.com:client-request-123',
        targetStatus: 'in_review',
        adminEmail: 'admin@example.com'
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'status update failed',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      execution: executor.result
    });
  });
});
