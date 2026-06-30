import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { SupportTicketStatusTransitionPlan } from './support-ticket-status-transition-plan';

export type SupportTicketStatusTransitionExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'updated' | 'failed';
  ticketId?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableSupportTicketStatusTransitionPlan = SupportTicketStatusTransitionPlan & {
  shouldTransition: true;
  ticketUpdate: NonNullable<SupportTicketStatusTransitionPlan['ticketUpdate']>;
  auditEvent: NonNullable<SupportTicketStatusTransitionPlan['auditEvent']>;
};
export class SupportTicketStatusTransitionExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: SupportTicketStatusTransitionPlan): Promise<SupportTicketStatusTransitionExecutionResult> {
    if (!this.config.get<boolean>('SUPPORT_TICKET_STATUS_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        ticketId: plan.ticketUpdate?.id,
        message: 'Support ticket status writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        ticketId: plan.ticketUpdate?.id,
        message: `Support ticket status transition skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['support_tickets', () => this.updateSupportTicket(executablePlan)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          ticketId: plan.ticketUpdate.id,
          message: error.message,
          completedSteps,
          failedStep: step
       };
     }

      completedSteps.push(step);
   }

    return {
      enabled: true,
      attempted: true,
      status: 'updated',
      ticketId: plan.ticketUpdate.id,
      message: 'Support ticket status writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: SupportTicketStatusTransitionPlan): plan is ExecutableSupportTicketStatusTransitionPlan {
    return Boolean(plan.shouldTransition && plan.ticketUpdate && plan.auditEvent);
 }

  private async updateSupportTicket(plan: ExecutableSupportTicketStatusTransitionPlan): Promise<SupabaseWriteResult> {
    const { id, ...update } = plan.ticketUpdate;
    return this.supabase.admin.from('support_tickets').update(update).eq('id', id);
 }

  private async upsertAuditLog(plan: ExecutableSupportTicketStatusTransitionPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(
      {
        idempotency_key: plan.auditEvent.idempotency_key,
        actor_type: 'admin',
        actor_id: plan.auditEvent.actor_id,
        entity_table: plan.auditEvent.entity,
        entity_id: plan.auditEvent.entity_id,
        action: plan.auditEvent.action,
        previous_state: plan.auditEvent.previous_state,
        next_state: plan.auditEvent.next_state
     },
      { onConflict: 'idempotency_key' }
    );
 }
}
