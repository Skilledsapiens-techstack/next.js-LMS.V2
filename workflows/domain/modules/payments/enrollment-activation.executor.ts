import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { EnrollmentActivationPlan } from './enrollment-activation-plan';

export type EnrollmentActivationExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'activated' | 'failed';
  requestId: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};
export class EnrollmentActivationExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: EnrollmentActivationPlan): Promise<EnrollmentActivationExecutionResult> {
    if (!this.config.get<boolean>('ENROLLMENT_ACTIVATION_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        requestId: plan.requestId,
        message: 'Enrollment activation is disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!plan.shouldActivate || !plan.normalizedEmail || !plan.studentProfile) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        requestId: plan.requestId,
        message: `Enrollment activation skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const completedSteps: string[] = [];

    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['students', () => this.upsertStudent(plan)],
      ['student_programs', () => this.upsertStudentPrograms(plan)],
      ['student_cohorts', () => this.upsertStudentCohorts(plan)],
      ['paid_access', () => this.upsertPaidAccess(plan)],
      ['enrollment_request_items', () => this.updateEnrollmentRequestItems(plan)],
      ['enrollment_requests', () => this.updateEnrollmentRequest(plan)],
      ['enrollment_status_history', () => this.upsertStatusHistory(plan)],
      ['audit_logs', () => this.upsertAuditLogs(plan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          requestId: plan.requestId,
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
      status: 'activated',
      requestId: plan.requestId,
      message: 'Enrollment activation writes completed.',
      completedSteps
   };
 }

  private async upsertStudent(plan: EnrollmentActivationPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin
      .from('students')
      .upsert(
        {
          email: plan.normalizedEmail,
          full_name: plan.studentProfile?.name ?? plan.normalizedEmail,
          phone: plan.studentProfile?.phone ?? null,
          active: true,
          updated_at: new Date().toISOString()
       },
        { onConflict: 'email' }
      )
      .select('id,email')
      .maybeSingle();
 }

  private async upsertStudentPrograms(plan: EnrollmentActivationPlan): Promise<SupabaseWriteResult> {
    if (plan.studentProgramLinks.length === 0) return { error: null };

    return this.supabase.admin.from('student_programs').upsert(
      plan.studentProgramLinks.map((link) => ({
        idempotency_key: link.idempotencyKey,
        student_email: plan.normalizedEmail,
        program_key: link.programKey,
        enrollment_request_id: plan.requestId,
        enrollment_request_item_id: link.itemId,
        status: 'active',
        source: 'enrollment_activation'
     })),
      { onConflict: 'idempotency_key' }
    );
 }

  private async upsertStudentCohorts(plan: EnrollmentActivationPlan): Promise<SupabaseWriteResult> {
    if (plan.studentCohortLinks.length === 0) return { error: null };

    return this.supabase.admin.from('student_cohorts').upsert(
      plan.studentCohortLinks.map((link) => ({
        idempotency_key: link.idempotencyKey,
        student_email: plan.normalizedEmail,
        cohort_id: link.cohortId ?? null,
        cohort_name: link.cohortName ?? null,
        enrollment_request_id: plan.requestId,
        enrollment_request_item_id: link.itemId,
        status: 'active',
        source: 'enrollment_activation'
     })),
      { onConflict: 'idempotency_key' }
    );
 }

  private async upsertPaidAccess(plan: EnrollmentActivationPlan): Promise<SupabaseWriteResult> {
    if (plan.paidAccessGrants.length === 0) return { error: null };

    return this.supabase.admin.from('paid_access').upsert(
      plan.paidAccessGrants.map((grant) => ({
        access_id: grant.idempotencyKey,
        student_email: plan.normalizedEmail,
        item_type: grant.itemType,
        item_id: grant.roleId ?? grant.programKey ?? grant.itemId,
        status: 'active',
        source: 'enrollment_activation',
        granted_at: new Date().toISOString(),
        notes: `Activated from enrollment request ${plan.requestId}`
     })),
      { onConflict: 'access_id' }
    );
 }

  private async updateEnrollmentRequestItems(plan: EnrollmentActivationPlan): Promise<SupabaseWriteResult> {
    const itemIds = plan.statusHistoryEntries.map((entry) => entry.itemId).filter((itemId): itemId is string => Boolean(itemId));

    if (itemIds.length === 0) return { error: null };

    return this.supabase.admin
      .from('enrollment_request_items')
      .update({
        status: 'activated',
        activated_by: 'system:supabase',
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
     })
      .eq('request_id', plan.requestId)
      .in('item_id', itemIds);
 }

  private async updateEnrollmentRequest(plan: EnrollmentActivationPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin
      .from('enrollment_requests')
      .update({
        payment_status: 'activated',
        activated_by: 'system:supabase',
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
     })
      .eq('request_id', plan.requestId)
      .in('payment_status', ['paid', 'payment_received', 'approved', 'cohort_assigned']);
 }

  private async upsertStatusHistory(plan: EnrollmentActivationPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('enrollment_status_history').upsert(
      plan.statusHistoryEntries.map((entry) => ({
        idempotency_key: entry.idempotencyKey,
        request_id: plan.requestId,
        item_id: entry.itemId ?? null,
        previous_status: null,
        new_status: entry.nextStatus,
        actor_email: 'system:supabase',
        changed_by: 'system',
        reason: 'enrollment_activation',
        notes: 'Enrollment activation completed by Supabase activation executor.'
     })),
      { onConflict: 'idempotency_key' }
    );
 }

  private async upsertAuditLogs(plan: EnrollmentActivationPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(
      plan.auditEvents.map((event) => ({
        idempotency_key: event.idempotencyKey,
        actor_type: 'system',
        actor_id: 'system:supabase',
        entity_table: event.entity,
        entity_id: plan.requestId,
        action: event.action,
        next_state: {
          status: 'activated',
          studentEmail: plan.normalizedEmail
       }
     })),
      { onConflict: 'idempotency_key' }
    );
 }
}
