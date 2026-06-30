import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { EmailDispatchPlan } from './email-dispatch-plan';

export type EmailDispatchExecutionResult = {
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

type ExecutableEmailDispatchPlan = EmailDispatchPlan & {
  shouldDispatch: true;
  sendingUpdate: NonNullable<EmailDispatchPlan['sendingUpdate']>;
};
export class EmailDispatchExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: EmailDispatchPlan): Promise<EmailDispatchExecutionResult> {
    if (!this.config.get<boolean>('EMAIL_DISPATCH_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        idempotencyKey: plan.idempotencyKey,
        message: 'Email dispatch writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        idempotencyKey: plan.idempotencyKey,
        message: `Email dispatch lock skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const { error } = await this.acquireSendingLock(plan);

    if (error) {
      return {
        enabled: true,
        attempted: true,
        status: 'failed',
        idempotencyKey: plan.idempotencyKey,
        message: error.message,
        completedSteps: [],
        failedStep: 'email_outbox'
     };
   }

    return {
      enabled: true,
      attempted: true,
      status: 'updated',
      idempotencyKey: plan.idempotencyKey,
      message: 'Email dispatch lock write completed.',
      completedSteps: ['email_outbox']
   };
 }

  private isExecutable(plan: EmailDispatchPlan): plan is ExecutableEmailDispatchPlan {
    return Boolean(plan.shouldDispatch && plan.sendingUpdate);
 }

  private async acquireSendingLock(plan: ExecutableEmailDispatchPlan): Promise<SupabaseWriteResult> {
    const { idempotency_key, ...update } = plan.sendingUpdate;
    return this.supabase.admin
      .from('email_outbox')
      .update(update)
      .eq('idempotency_key', idempotency_key)
      .eq('status', 'pending');
 }
}
