import { SupportTicketCreationExecutionResult, SupportTicketCreationExecutor } from './support-ticket-creation.executor';
import { SupportTicketCreationLoadInput, SupportTicketCreationLoader } from './support-ticket-creation.loader';

export type SupportTicketCreationWorkflowResult = {
  status: 'not_found' | SupportTicketCreationExecutionResult['status'];
  message: string;
  ticketId?: string;
  execution?: SupportTicketCreationExecutionResult;
};
export class SupportTicketCreationWorkflow {
  constructor(
    private readonly loader: SupportTicketCreationLoader,
    private readonly executor: SupportTicketCreationExecutor
  ) {}

  async createTicket(input: SupportTicketCreationLoadInput): Promise<SupportTicketCreationWorkflowResult> {
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
      ticketId: execution.ticketId,
      execution
    };
  }
}
