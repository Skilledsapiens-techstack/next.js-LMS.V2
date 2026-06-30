import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { RecordingCandidateReviewPlan } from './recording-candidate-review-plan';

export type RecordingCandidateReviewExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'updated' | 'failed';
  candidateId?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableRecordingCandidateReviewPlan = RecordingCandidateReviewPlan & {
  shouldReview: true;
  candidateUpdate: NonNullable<RecordingCandidateReviewPlan['candidateUpdate']>;
  auditEvent: NonNullable<RecordingCandidateReviewPlan['auditEvent']>;
};
export class RecordingCandidateReviewExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: RecordingCandidateReviewPlan): Promise<RecordingCandidateReviewExecutionResult> {
    if (!this.config.get<boolean>('RECORDING_CANDIDATE_REVIEW_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        candidateId: plan.candidateUpdate?.id,
        message: 'Recording candidate review writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        candidateId: plan.candidateUpdate?.id,
        message: `Recording candidate review skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['workshop_recording_candidates', () => this.updateCandidate(executablePlan)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          candidateId: plan.candidateUpdate.id,
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
      candidateId: plan.candidateUpdate.id,
      message: 'Recording candidate review writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: RecordingCandidateReviewPlan): plan is ExecutableRecordingCandidateReviewPlan {
    return Boolean(plan.shouldReview && plan.candidateUpdate && plan.auditEvent);
 }

  private async updateCandidate(plan: ExecutableRecordingCandidateReviewPlan): Promise<SupabaseWriteResult> {
    const { id, ...update } = plan.candidateUpdate;
    return this.supabase.admin.from('workshop_recording_candidates').update(update).eq('id', id);
 }

  private async upsertAuditLog(plan: ExecutableRecordingCandidateReviewPlan): Promise<SupabaseWriteResult> {
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
