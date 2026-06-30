import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { RecordingPublicationPlan } from './recording-publication-plan';

export type RecordingPublicationExecutionResult = {
  enabled: boolean;
  attempted: boolean;
  status: 'disabled' | 'skipped' | 'updated' | 'failed';
  workshopId?: string;
  message: string;
  completedSteps: string[];
  failedStep?: string;
};

type SupabaseWriteResult = {
  error: { message: string } | null;
};

type ExecutableRecordingPublicationPlan = RecordingPublicationPlan & {
  shouldPublish: true;
  workshopUpdate: NonNullable<RecordingPublicationPlan['workshopUpdate']>;
  auditEvent: NonNullable<RecordingPublicationPlan['auditEvent']>;
};
export class RecordingPublicationExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: RecordingPublicationPlan): Promise<RecordingPublicationExecutionResult> {
    if (!this.config.get<boolean>('RECORDING_PUBLICATION_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        workshopId: plan.workshopUpdate?.id,
        message: 'Recording publication writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        workshopId: plan.workshopUpdate?.id,
        message: `Recording publication skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['workshops', () => this.updateWorkshop(executablePlan)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan)]
    ];

    for (const [step, run] of steps) {
      const { error } = await run();

      if (error) {
        return {
          enabled: true,
          attempted: true,
          status: 'failed',
          workshopId: plan.workshopUpdate.id,
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
      workshopId: plan.workshopUpdate.id,
      message: 'Recording publication writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: RecordingPublicationPlan): plan is ExecutableRecordingPublicationPlan {
    return Boolean(plan.shouldPublish && plan.workshopUpdate && plan.auditEvent);
 }

  private async updateWorkshop(plan: ExecutableRecordingPublicationPlan): Promise<SupabaseWriteResult> {
    const { id, ...update } = plan.workshopUpdate;
    return this.supabase.admin.from('workshops').update(update).eq('id', id);
 }

  private async upsertAuditLog(plan: ExecutableRecordingPublicationPlan): Promise<SupabaseWriteResult> {
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
