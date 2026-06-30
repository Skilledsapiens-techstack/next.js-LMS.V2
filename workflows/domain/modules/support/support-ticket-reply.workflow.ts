import { SupportTicketReplyExecutionResult, SupportTicketReplyExecutor } from './support-ticket-reply.executor';
import { SupportTicketReplyLoadInput, SupportTicketReplyLoader } from './support-ticket-reply.loader';

export type SupportTicketReplyWorkflowResult = {
  status: 'not_found' | SupportTicketReplyExecutionResult['status'];
  message: string;
  messageId?: string;
  ticketId?: string;
  execution?: SupportTicketReplyExecutionResult;
};
export class SupportTicketReplyWorkflow {
  constructor(
    private readonly loader: SupportTicketReplyLoader,
    private readonly executor: SupportTicketReplyExecutor
  ) {}

  async replyToTicket(input: SupportTicketReplyLoadInput): Promise<SupportTicketReplyWorkflowResult> {
    const loadResult = await this.loader.loadPlan(input);

    if (loadResult.status !== 'ready' || !loadResult.plan) {
      return {
        status: 'not_found',
        message: loadResult.message
      };
    }

    const execution = await this.executor.execute(loadResult.plan);

    return {
      status: execution.status,
      message: execution.message,
      messageId: execution.messageId,
      ticketId: execution.ticketId,
      execution
    };
  }
}
