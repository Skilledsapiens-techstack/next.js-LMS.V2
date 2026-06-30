import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProjectSubmissionReviewPlan } from './project-submission-review-plan';

export type ProjectSubmissionReviewExecutionResult = {
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

type ExecutableProjectSubmissionReviewPlan = ProjectSubmissionReviewPlan & {
  shouldTransition: true;
  projectSubmissionUpdate: NonNullable<ProjectSubmissionReviewPlan['projectSubmissionUpdate']>;
  auditEvent: NonNullable<ProjectSubmissionReviewPlan['auditEvent']>;
};
export class ProjectSubmissionReviewExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: ProjectSubmissionReviewPlan): Promise<ProjectSubmissionReviewExecutionResult> {
    if (!this.config.get<boolean>('PROJECT_SUBMISSION_REVIEW_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        requestId: plan.projectSubmissionUpdate?.request_id,
        message: 'Project submission review writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        requestId: plan.projectSubmissionUpdate?.request_id,
        message: `Project submission review skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['project_submission_requests', () => this.updateProjectSubmissionReview(executablePlan)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          requestId: plan.projectSubmissionUpdate.request_id,
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
      requestId: plan.projectSubmissionUpdate.request_id,
      message: 'Project submission review writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: ProjectSubmissionReviewPlan): plan is ExecutableProjectSubmissionReviewPlan {
    return Boolean(plan.shouldTransition && plan.projectSubmissionUpdate && plan.auditEvent);
 }

  private async updateProjectSubmissionReview(plan: ExecutableProjectSubmissionReviewPlan): Promise<SupabaseWriteResult> {
    const { request_id: requestId, ...update } = plan.projectSubmissionUpdate;
    return this.supabase.admin.from('project_submission_requests').update(update).eq('request_id', requestId);
 }

  private async upsertAuditLog(plan: ExecutableProjectSubmissionReviewPlan): Promise<SupabaseWriteResult> {
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
