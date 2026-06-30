import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { EmailOutboxPlan } from './email-outbox-plan';

export type EmailOutboxExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'created' | 'failed';
  idempotencyKey?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableEmailOutboxPlan = EmailOutboxPlan & {
  shouldEnqueue: true;
  emailJobRow: NonNullable<EmailOutboxPlan['emailJobRow']>;
  auditEvent: NonNullable<EmailOutboxPlan['auditEvent']>;
};
export class EmailOutboxExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: EmailOutboxPlan): Promise<EmailOutboxExecutionResult> {
    if (!this.config.get<boolean>('EMAIL_OUTBOX_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        idempotencyKey: plan.idempotencyKey,
        message: 'Email outbox writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        idempotencyKey: plan.idempotencyKey,
        message: `Email outbox enqueue skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['email_outbox', () => this.upsertEmailJob(executablePlan)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          idempotencyKey: plan.idempotencyKey,
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
      idempotencyKey: plan.idempotencyKey,
      message: 'Email outbox writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: EmailOutboxPlan): plan is ExecutableEmailOutboxPlan {
    return Boolean(plan.shouldEnqueue && plan.emailJobRow && plan.auditEvent);
 }

  private async upsertEmailJob(plan: ExecutableEmailOutboxPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('email_outbox').upsert(plan.emailJobRow, { onConflict: 'idempotency_key' });
 }

  private async upsertAuditLog(plan: ExecutableEmailOutboxPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(
      {
        idempotency_key: plan.auditEvent.idempotency_key,
        actor_type: 'system',
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
