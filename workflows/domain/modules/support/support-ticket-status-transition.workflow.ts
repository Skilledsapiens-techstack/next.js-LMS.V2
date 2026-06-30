import {
  SupportTicketStatusTransitionExecutionResult,
  SupportTicketStatusTransitionExecutor
} from './support-ticket-status-transition.executor';
import {
  SupportTicketStatusTransitionLoadInput,
  SupportTicketStatusTransitionLoader
} from './support-ticket-status-transition.loader';

export type SupportTicketStatusTransitionWorkflowResult = {
  status: 'not_found' | SupportTicketStatusTransitionExecutionResult['status'];
  message: string;
  ticketId?: string;
  execution?: SupportTicketStatusTransitionExecutionResult;
};
export class SupportTicketStatusTransitionWorkflow {
  constructor(
    private readonly loader: SupportTicketStatusTransitionLoader,
    private readonly executor: SupportTicketStatusTransitionExecutor
  ) {}

  async transitionStatus(input: SupportTicketStatusTransitionLoadInput): Promise<SupportTicketStatusTransitionWorkflowResult> {
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
