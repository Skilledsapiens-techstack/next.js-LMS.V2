import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProjectSubmissionPlan } from './project-submission-plan';

export type ProjectSubmissionExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'created' | 'failed';
  requestId?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableProjectSubmissionPlan = ProjectSubmissionPlan & {
  shouldCreate: true;
  projectSubmissionRow: NonNullable<ProjectSubmissionPlan['projectSubmissionRow']>;
  studentLimitRow: NonNullable<ProjectSubmissionPlan['studentLimitRow']>;
  auditEvent: NonNullable<ProjectSubmissionPlan['auditEvent']>;
};
export class ProjectSubmissionExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: ProjectSubmissionPlan): Promise<ProjectSubmissionExecutionResult> {
    if (!this.config.get<boolean>('PROJECT_SUBMISSION_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        requestId: plan.idempotencyKey,
        message: 'Project submission writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        requestId: plan.idempotencyKey,
        message: `Project submission skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['project_submission_requests', () => this.upsertProjectSubmission(executablePlan)],
      ['project_submission_student_limits', () => this.upsertStudentLimit(executablePlan)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          requestId: plan.idempotencyKey,
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
      requestId: plan.idempotencyKey,
      message: 'Project submission writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: ProjectSubmissionPlan): plan is ExecutableProjectSubmissionPlan {
    return Boolean(plan.shouldCreate && plan.projectSubmissionRow && plan.studentLimitRow && plan.auditEvent);
 }

  private async upsertProjectSubmission(plan: ExecutableProjectSubmissionPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin
      .from('project_submission_requests')
      .upsert(plan.projectSubmissionRow, { onConflict: 'idempotency_key' });
 }

  private async upsertStudentLimit(plan: ExecutableProjectSubmissionPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin
      .from('project_submission_student_limits')
      .upsert(plan.studentLimitRow, { onConflict: 'idempotency_key' });
 }

  private async upsertAuditLog(plan: ExecutableProjectSubmissionPlan): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(
      {
        idempotency_key: plan.auditEvent.idempotency_key,
        actor_type: 'student',
        actor_id: plan.projectSubmissionRow.student_email,
        entity_table: plan.auditEvent.entity,
        entity_id: plan.projectSubmissionRow.request_id,
        action: plan.auditEvent.action,
        next_state: {
          status: 'submitted',
          projectId: plan.projectSubmissionRow.project_id,
          attemptNumber: plan.projectSubmissionRow.attempt_number
       }
     },
      { onConflict: 'idempotency_key' }
    );
 }
}
