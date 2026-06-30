import { SupportTicketCreationExecutionResult } from './support-ticket-creation.executor';
import { SupportTicketCreationLoadResult } from './support-ticket-creation.loader';
import { createSupportTicketCreationPlan } from './support-ticket-creation-plan';
import { SupportTicketCreationWorkflow } from './support-ticket-creation.workflow';

class MockLoader {
  input?: unknown;
  result: SupportTicketCreationLoadResult = {
    status: 'ready',
    message: 'Support ticket creation plan loaded.',
    plan: createSupportTicketCreationPlan(
      {
        id: 'student-uuid',
        email: 'student@example.com',
        fullName: 'Student Name'
      },
      {
        categoryName: 'Course Access',
        subject: 'Cannot access MBA recordings',
        body: 'The latest workshop recording is locked for me.',
        clientRequestId: 'client-request-123',
        createdAt: '2026-06-27T10:00:00.000Z'
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
  result: SupportTicketCreationExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    ticketId: 'SUP-1234567890',
    message: 'Support ticket creation writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('SupportTicketCreationWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new SupportTicketCreationWorkflow(loader as never, executor as never);
    const input = {
      studentEmail: 'student@example.com',
      ticket: {
        categoryName: 'Course Access',
        subject: 'Cannot access MBA recordings',
        body: 'The latest workshop recording is locked for me.'
      }
    };

    await expect(workflow.createTicket(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Support ticket creation writes are disabled. No Supabase write was attempted.',
      ticketId: 'SUP-1234567890',
      execution: executor.result
    });
    expect(loader.input).toEqual(input);
    expect(executor.plan).toBe(loader.result.plan);
  });

  it('does not call the executor when source loading returns not found', async () => {
    const loader = new MockLoader();
    loader.result = {
      status: 'not_found',
      message: 'No active student matched the support ticket creation source.'
    };
    const executor = new MockExecutor();
    const workflow = new SupportTicketCreationWorkflow(loader as never, executor as never);

    await expect(
      workflow.createTicket({
        studentEmail: 'missing@example.com',
        ticket: {
          categoryName: 'General',
          subject: 'Need help',
          body: 'Help'
        }
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No active student matched the support ticket creation source.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns support ticket creation failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      ticketId: 'SUP-1234567890',
      message: 'message write failed',
      completedSteps: ['support_tickets'],
      failedStep: 'support_ticket_messages'
    };
    const workflow = new SupportTicketCreationWorkflow(loader as never, executor as never);

    await expect(
      workflow.createTicket({
        studentEmail: 'student@example.com',
        ticket: {
          categoryName: 'Course Access',
          subject: 'Cannot access MBA recordings',
          body: 'The latest workshop recording is locked for me.'
        }
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'message write failed',
      ticketId: 'SUP-1234567890',
      execution: executor.result
    });
  });
});
