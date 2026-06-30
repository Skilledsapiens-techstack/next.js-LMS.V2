import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { EmailDeliveryResultPlan } from './email-delivery-result-plan';

export type EmailDeliveryResultExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'updated' | 'failed';
  idempotencyKey?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableEmailDeliveryResultPlan = EmailDeliveryResultPlan & {
  shouldRecord: true;
  emailUpdate: NonNullable<EmailDeliveryResultPlan['emailUpdate']>;
};

type EmailDeliveryFailureResultPlan = ExecutableEmailDeliveryResultPlan & {
  errorLogRow: NonNullable<EmailDeliveryResultPlan['errorLogRow']>;
};
export class EmailDeliveryResultExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: EmailDeliveryResultPlan): Promise<EmailDeliveryResultExecutionResult> {
    if (!this.config.get<boolean>('EMAIL_DELIVERY_RESULT_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        idempotencyKey: plan.idempotencyKey,
        message: 'Email delivery result writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        idempotencyKey: plan.idempotencyKey,
        message: `Email delivery result skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['email_outbox', () => this.updateEmailOutbox(executablePlan)]
    ];

    if (this.hasErrorLog(executablePlan)) {
      steps.push(['error_logs', () => this.upsertErrorLog(executablePlan)]);
   }

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
      status: 'updated',
      idempotencyKey: plan.idempotencyKey,
      message: 'Email delivery result writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: EmailDeliveryResultPlan): plan is ExecutableEmailDeliveryResultPlan {
    return Boolean(plan.shouldRecord && plan.emailUpdate);
 }

  private hasErrorLog(plan: ExecutableEmailDeliveryResultPlan): plan is EmailDeliveryFailureResultPlan {
    return Boolean(plan.errorLogRow);
 }

  private async updateEmailOutbox(plan: ExecutableEmailDeliveryResultPlan): Promise<SupabaseWriteResult> {
    const { idempotency_key, ...update } = plan.emailUpdate;
    return this.supabase.admin
      .from('email_outbox')
      .update(update)
      .eq('idempotency_key', idempotency_key)
      .eq('status', 'sending');
 }

  private async upsertErrorLog(plan: EmailDeliveryFailureResultPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('error_logs').upsert(plan.errorLogRow, { onConflict: 'idempotency_key' });
 }
}
