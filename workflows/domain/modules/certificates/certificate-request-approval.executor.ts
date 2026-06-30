import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CertificateRequestApprovalPlan } from './certificate-request-approval-plan';

export type CertificateRequestApprovalExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'updated' | 'failed';
  requestId?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableCertificateRequestApprovalPlan = CertificateRequestApprovalPlan & {
  shouldApply: true;
  requestUpdate: NonNullable<CertificateRequestApprovalPlan['requestUpdate']>;
  auditEvent: NonNullable<CertificateRequestApprovalPlan['auditEvent']>;
};
export class CertificateRequestApprovalExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: CertificateRequestApprovalPlan): Promise<CertificateRequestApprovalExecutionResult> {
    if (!this.config.get<boolean>('CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        requestId: plan.requestUpdate?.request_id,
        message: 'Certificate request approval writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        requestId: plan.requestUpdate?.request_id,
        message: `Certificate request approval skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['certificate_requests', () => this.updateCertificateRequest(executablePlan)]
    ];

    if (executablePlan.generationJob) {
      steps.push(['certificate_generation_jobs', () => this.upsertGenerationJob(executablePlan)]);
   }

    steps.push(['audit_logs', () => this.upsertAuditLog(executablePlan)]);

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          requestId: plan.requestUpdate.request_id,
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
      requestId: plan.requestUpdate.request_id,
      message: 'Certificate request approval writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: CertificateRequestApprovalPlan): plan is ExecutableCertificateRequestApprovalPlan {
    return Boolean(plan.shouldApply && plan.requestUpdate && plan.auditEvent);
 }

  private async updateCertificateRequest(plan: ExecutableCertificateRequestApprovalPlan): Promise<SupabaseWriteResult> {
    const { request_id: requestId, ...update } = plan.requestUpdate;
    return this.supabase.admin.from('certificate_requests').update(update).eq('request_id', requestId);
 }

  private async upsertGenerationJob(plan: ExecutableCertificateRequestApprovalPlan): Promise<SupabaseWriteResult> {
    if (!plan.generationJob) return { error: null };

    return this.supabase.admin.from('certificate_generation_jobs').upsert(
      {
        idempotency_key: plan.generationJob.idempotency_key,
        request_id: plan.generationJob.request_id,
        certificate_id: plan.generationJob.certificate_id,
        certificate_type: plan.generationJob.certificate_type,
        status: plan.generationJob.status,
        requested_by: plan.generationJob.requested_by,
        requested_at: plan.generationJob.requested_at,
        payload: plan.generationJob.payload
     },
      { onConflict: 'idempotency_key' }
    );
 }

  private async upsertAuditLog(plan: ExecutableCertificateRequestApprovalPlan): Promise<SupabaseWriteResult> {
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
