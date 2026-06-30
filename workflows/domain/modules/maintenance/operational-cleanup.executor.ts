import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { OperationalCleanupAction, OperationalCleanupPlan } from './operational-cleanup-plan';

export type OperationalCleanupExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'updated' | 'failed';
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableOperationalCleanupPlan = OperationalCleanupPlan & {
  shouldRun: true;
  actions: [OperationalCleanupAction, ...OperationalCleanupAction[]];
};
export class OperationalCleanupExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: OperationalCleanupPlan): Promise<OperationalCleanupExecutionResult> {
    if (!this.config.get<boolean>('BACKGROUND_CLEANUP_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        message: 'Background cleanup writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        message: `Background cleanup skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const completedSteps: string[] = [];

    for (const action of plan.actions) {
      const actionStep = `${action.entityTable}:${action.action}`;
      const actionResult = await this.executeAction(action);

      if (actionResult.error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          message: actionResult.error.message,
          completedSteps,
          failedStep: actionStep
       };
     }

      completedSteps.push(actionStep);

      const auditResult = await this.upsertAuditLog(action);

      if (auditResult.error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          message: auditResult.error.message,
          completedSteps,
          failedStep: 'audit_logs'
       };
     }

      completedSteps.push('audit_logs');
   }

    return {
      enabled: true,
      attempted: true,
      status: 'updated',
      message: 'Background cleanup writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: OperationalCleanupPlan): plan is ExecutableOperationalCleanupPlan {
    return Boolean(plan.shouldRun && plan.actions.length > 0);
 }

  private async executeAction(action: OperationalCleanupAction): Promise<SupabaseWriteResult> {
    if (action.action === 'release_email_lock') {
      return this.supabase.admin
        .from('email_outbox')
        .update({
          status: 'pending',
          locked_until: null,
          worker_id: null,
          updated_at: action.auditRow.created_at
       })
        .eq('idempotency_key', action.entityId)
        .eq('status', 'sending');
   }

    if (action.action === 'mark_certificate_job_failed') {
      return this.supabase.admin
        .from('certificate_generation_jobs')
        .update({
          status: 'failed',
          error_message: action.reason,
          updated_at: action.auditRow.created_at
       })
        .eq('id', action.entityId)
        .eq('status', 'rendering');
   }

    if (action.action === 'archive_webhook_event') {
      return this.supabase.admin
        .from('enrollment_webhook_events')
        .update({
          status: 'archived',
          updated_at: action.auditRow.created_at
       })
        .eq('event_id', action.entityId)
        .in('status', ['processed', 'skipped', 'duplicate']);
   }

    return this.supabase.admin.from('error_logs').delete().eq('idempotency_key', action.entityId);
 }

  private async upsertAuditLog(action: OperationalCleanupAction): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(action.auditRow, { onConflict: 'idempotency_key' });
 }
}
