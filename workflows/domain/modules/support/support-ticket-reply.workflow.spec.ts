import { SupportTicketReplyExecutionResult } from './support-ticket-reply.executor';
import { SupportTicketReplyLoadResult } from './support-ticket-reply.loader';
import { createSupportTicketReplyPlan } from './support-ticket-reply-plan';
import { SupportTicketReplyWorkflow } from './support-ticket-reply.workflow';

class MockLoader {
  input?: unknown;
  result: SupportTicketReplyLoadResult = {
    status: 'ready',
    message: 'Support ticket reply plan loaded.',
    plan: createSupportTicketReplyPlan(
      {
        id: 'support_ticket:student@example.com:client-request-123',
        status: 'waiting_for_student',
        conversationMode: 'two_way',
        studentEmail: 'student@example.com'
      },
      {
        role: 'student',
        email: 'student@example.com',
        name: 'Student Name'
      },
      {
        body: 'I still need help.',
        clientRequestId: 'reply-123',
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
  result: SupportTicketReplyExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    messageId: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
    ticketId: 'support_ticket:student@example.com:client-request-123',
    message: 'Support ticket reply writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };

  execute(plan: unknown) {
    this.plan = plan;
    return Promise.resolve(this.result);
  }
}

describe('SupportTicketReplyWorkflow', () => {
  it('loads a plan and delegates execution without choosing the trigger', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    const workflow = new SupportTicketReplyWorkflow(loader as never, executor as never);
    const input = {
      ticketId: 'support_ticket:student@example.com:client-request-123',
      actor: {
        role: 'student' as const,
        email: 'student@example.com'
      },
      reply: {
        body: 'I still need help.'
      }
    };

    await expect(workflow.replyToTicket(input)).resolves.toEqual({
      status: 'disabled',
      message: 'Support ticket reply writes are disabled. No Supabase write was attempted.',
      messageId: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
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
      message: 'No support ticket matched the reply source identity.'
    };
    const executor = new MockExecutor();
    const workflow = new SupportTicketReplyWorkflow(loader as never, executor as never);

    await expect(
      workflow.replyToTicket({
        ticketId: 'missing-ticket',
        actor: {
          role: 'admin',
          email: 'admin@example.com'
        },
        reply: {
          body: 'Help'
        }
      })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No support ticket matched the reply source identity.'
    });
    expect(executor.plan).toBeUndefined();
  });

  it('returns support ticket reply failures from the executor unchanged', async () => {
    const loader = new MockLoader();
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      messageId: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      message: 'ticket update failed',
      completedSteps: ['support_ticket_messages'],
      failedStep: 'support_tickets'
    };
    const workflow = new SupportTicketReplyWorkflow(loader as never, executor as never);

    await expect(
      workflow.replyToTicket({
        ticketId: 'support_ticket:student@example.com:client-request-123',
        actor: {
          role: 'student',
          email: 'student@example.com'
        },
        reply: {
          body: 'I still need help.'
        }
      })
    ).resolves.toEqual({
      status: 'failed',
      message: 'ticket update failed',
      messageId: 'support_ticket_reply:support_ticket:student@example.com:client-request-123:reply-123',
      ticketId: 'support_ticket:student@example.com:client-request-123',
      execution: executor.result
    });
  });
});
