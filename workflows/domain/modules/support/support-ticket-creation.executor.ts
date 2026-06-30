import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { SupportTicketCreationPlan } from './support-ticket-creation-plan';

export type SupportTicketCreationExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'created' | 'failed';
  ticketId?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableSupportTicketCreationPlan = SupportTicketCreationPlan & {
  shouldCreate: true;
  supportTicketRow: NonNullable<SupportTicketCreationPlan['supportTicketRow']>;
  firstMessageRow: NonNullable<SupportTicketCreationPlan['firstMessageRow']>;
  auditEvent: NonNullable<SupportTicketCreationPlan['auditEvent']>;
};
export class SupportTicketCreationExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: SupportTicketCreationPlan): Promise<SupportTicketCreationExecutionResult> {
    if (!this.config.get<boolean>('SUPPORT_TICKET_CREATION_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        ticketId: plan.ticketId,
        message: 'Support ticket creation writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        ticketId: plan.ticketId,
        message: `Support ticket creation skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['support_tickets', () => this.upsertSupportTicket(executablePlan)],
      ['support_ticket_messages', () => this.upsertInitialMessage(executablePlan)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          ticketId: plan.ticketId,
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
      ticketId: plan.ticketId,
      message: 'Support ticket creation writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: SupportTicketCreationPlan): plan is ExecutableSupportTicketCreationPlan {
    return Boolean(plan.shouldCreate && plan.supportTicketRow && plan.firstMessageRow && plan.auditEvent);
 }

  private async upsertSupportTicket(plan: ExecutableSupportTicketCreationPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('support_tickets').upsert(plan.supportTicketRow, { onConflict: 'idempotency_key' });
 }

  private async upsertInitialMessage(plan: ExecutableSupportTicketCreationPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('support_ticket_messages').upsert(plan.firstMessageRow, { onConflict: 'idempotency_key' });
 }

  private async upsertAuditLog(plan: ExecutableSupportTicketCreationPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(
      {
        idempotency_key: plan.auditEvent.idempotency_key,
        actor_type: 'student',
        actor_id: plan.auditEvent.actor_id,
        entity_table: plan.auditEvent.entity,
        entity_id: plan.auditEvent.entity_id,
        action: plan.auditEvent.action,
        next_state: plan.auditEvent.next_state
     },
      { onConflict: 'idempotency_key' }
    );
 }
}
