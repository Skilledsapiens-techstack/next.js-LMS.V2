import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CertificatePdfRenderPlan } from './certificate-pdf-render-plan';

export type CertificatePdfRenderExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'updated' | 'failed';
  jobIdempotencyKey?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableCertificatePdfRenderPlan = CertificatePdfRenderPlan & {
  shouldRender: true;
  jobUpdate: NonNullable<CertificatePdfRenderPlan['jobUpdate']>;
  auditEvent: NonNullable<CertificatePdfRenderPlan['auditEvent']>;
};
export class CertificatePdfRenderExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: CertificatePdfRenderPlan): Promise<CertificatePdfRenderExecutionResult> {
    if (!this.config.get<boolean>('CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        jobIdempotencyKey: plan.jobUpdate?.idempotency_key,
        message: 'Certificate PDF render-start writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        jobIdempotencyKey: plan.jobUpdate?.idempotency_key,
        message: `Certificate PDF render-start skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['certificate_generation_jobs', () => this.updateGenerationJob(executablePlan)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          jobIdempotencyKey: plan.jobUpdate.idempotency_key,
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
      jobIdempotencyKey: plan.jobUpdate.idempotency_key,
      message: 'Certificate PDF render-start writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: CertificatePdfRenderPlan): plan is ExecutableCertificatePdfRenderPlan {
    return Boolean(plan.shouldRender && plan.jobUpdate && plan.auditEvent);
 }

  private async updateGenerationJob(plan: ExecutableCertificatePdfRenderPlan): Promise<SupabaseWriteResult> {
    const { idempotency_key: idempotencyKey, ...update } = plan.jobUpdate;
    return this.supabase.admin.from('certificate_generation_jobs').update(update).eq('idempotency_key', idempotencyKey);
 }

  private async upsertAuditLog(plan: ExecutableCertificatePdfRenderPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(
      {
        idempotency_key: plan.auditEvent.idempotency_key,
        actor_type: 'system',
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
