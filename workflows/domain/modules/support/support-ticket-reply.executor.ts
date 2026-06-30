import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { SupportTicketReplyPlan } from './support-ticket-reply-plan';

export type SupportTicketReplyExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'created' | 'failed';
  messageId?: string;
  ticketId?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableSupportTicketReplyPlan = SupportTicketReplyPlan & {
  shouldCreate: true;
  messageRow: NonNullable<SupportTicketReplyPlan['messageRow']>;
  ticketUpdate: NonNullable<SupportTicketReplyPlan['ticketUpdate']>;
  auditEvent: NonNullable<SupportTicketReplyPlan['auditEvent']>;
};
export class SupportTicketReplyExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: SupportTicketReplyPlan): Promise<SupportTicketReplyExecutionResult> {
    if (!this.config.get<boolean>('SUPPORT_TICKET_REPLY_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        messageId: plan.messageRow?.id,
        ticketId: plan.ticketUpdate?.id,
        message: 'Support ticket reply writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        messageId: plan.messageRow?.id,
        ticketId: plan.ticketUpdate?.id,
        message: `Support ticket reply skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['support_ticket_messages', () => this.upsertReplyMessage(executablePlan)],
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
          messageId: plan.messageRow.id,
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
      status: 'created',
      messageId: plan.messageRow.id,
      ticketId: plan.ticketUpdate.id,
      message: 'Support ticket reply writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: SupportTicketReplyPlan): plan is ExecutableSupportTicketReplyPlan {
    return Boolean(plan.shouldCreate && plan.messageRow && plan.ticketUpdate && plan.auditEvent);
 }

  private async upsertReplyMessage(plan: ExecutableSupportTicketReplyPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('support_ticket_messages').upsert(plan.messageRow, { onConflict: 'idempotency_key' });
 }

  private async updateSupportTicket(plan: ExecutableSupportTicketReplyPlan): Promise<SupabaseWriteResult> {
    const { id, ...update } = plan.ticketUpdate;
    return this.supabase.admin.from('support_tickets').update(update).eq('id', id);
 }

  private async upsertAuditLog(plan: ExecutableSupportTicketReplyPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(
      {
        idempotency_key: plan.auditEvent.idempotency_key,
        actor_type: plan.messageRow.author_role,
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
