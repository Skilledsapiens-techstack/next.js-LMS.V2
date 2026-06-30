import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CertificateGenerationPlan } from './certificate-generation-plan';

export type CertificateGenerationExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'updated' | 'failed';
  certificateId?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableCertificateGenerationPlan = CertificateGenerationPlan & {
  shouldFinalize: true;
  certificateRow: NonNullable<CertificateGenerationPlan['certificateRow']>;
  jobUpdate: NonNullable<CertificateGenerationPlan['jobUpdate']>;
  auditEvent: NonNullable<CertificateGenerationPlan['auditEvent']>;
};
export class CertificateGenerationExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: CertificateGenerationPlan): Promise<CertificateGenerationExecutionResult> {
    if (!this.config.get<boolean>('CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        certificateId: plan.certificateRow?.certificate_id,
        message: 'Certificate generation finalization writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        certificateId: plan.certificateRow?.certificate_id,
        message: `Certificate generation finalization skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['certificates', () => this.upsertCertificate(executablePlan)],
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
          certificateId: plan.certificateRow.certificate_id,
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
      certificateId: plan.certificateRow.certificate_id,
      message: 'Certificate generation finalization writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: CertificateGenerationPlan): plan is ExecutableCertificateGenerationPlan {
    return Boolean(plan.shouldFinalize && plan.certificateRow && plan.jobUpdate && plan.auditEvent);
 }

  private async upsertCertificate(plan: ExecutableCertificateGenerationPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('certificates').upsert(plan.certificateRow, { onConflict: 'idempotency_key' });
 }

  private async updateGenerationJob(plan: ExecutableCertificateGenerationPlan): Promise<SupabaseWriteResult> {
    const { idempotency_key: idempotencyKey, ...update } = plan.jobUpdate;
    return this.supabase.admin.from('certificate_generation_jobs').update(update).eq('idempotency_key', idempotencyKey);
 }

  private async upsertAuditLog(plan: ExecutableCertificateGenerationPlan): Promise<SupabaseWriteResult> {
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
