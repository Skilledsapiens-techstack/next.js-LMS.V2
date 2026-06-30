import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { WorkshopMeetingProviderResult } from './workshop-meeting.provider';
import { WorkshopMeetingSchedulePlan } from './workshop-meeting-schedule-plan';

export type WorkshopMeetingScheduleExecutionResult = {
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

type ExecutableWorkshopMeetingSchedulePlan = WorkshopMeetingSchedulePlan & {
  shouldSchedule: true;
  workshopUpdate: NonNullable<WorkshopMeetingSchedulePlan['workshopUpdate']>;
  auditEvent: NonNullable<WorkshopMeetingSchedulePlan['auditEvent']>;
};

type CreatedMeetingResult = WorkshopMeetingProviderResult & {
  status: 'created';
  providerMeetingId: string;
  joinUrl: string;
};
export class WorkshopMeetingScheduleExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(
    plan: WorkshopMeetingSchedulePlan,
    providerResult: WorkshopMeetingProviderResult | undefined
  ): Promise<WorkshopMeetingScheduleExecutionResult> {
    if (!this.config.get<boolean>('WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        workshopId: plan.workshopUpdate?.id,
        message: 'Workshop meeting schedule writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        workshopId: plan.workshopUpdate?.id,
        message: `Workshop meeting schedule skipped: ${plan.reason}.`,
        completedSteps: []
     };
   }

    if (!this.isCreatedMeeting(providerResult)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        workshopId: plan.workshopUpdate.id,
        message: 'Workshop meeting schedule skipped: provider meeting was not created.',
        completedSteps: []
     };
   }

    const executablePlan = plan;
    const completedSteps: string[] = [];
    const steps: Array<[string, () => Promise<SupabaseWriteResult>]> = [
      ['workshops', () => this.updateWorkshop(executablePlan, providerResult)],
      ['audit_logs', () => this.upsertAuditLog(executablePlan, providerResult)]
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
      message: 'Workshop meeting schedule writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: WorkshopMeetingSchedulePlan): plan is ExecutableWorkshopMeetingSchedulePlan {
    return Boolean(plan.shouldSchedule && plan.workshopUpdate && plan.auditEvent);
 }

  private isCreatedMeeting(result: WorkshopMeetingProviderResult | undefined): result is CreatedMeetingResult {
    return Boolean(result?.status === 'created' && result.providerMeetingId?.trim() && result.joinUrl?.trim());
 }

  private async updateWorkshop(
    plan: ExecutableWorkshopMeetingSchedulePlan,
    providerResult: CreatedMeetingResult
  ): Promise<SupabaseWriteResult> {
    const { id, ...update } = plan.workshopUpdate;
    return this.supabase.admin
      .from('workshops')
      .update({
        ...update,
        zoom_id: providerResult.providerMeetingId,
        join_url: providerResult.joinUrl
     })
      .eq('id', id);
 }

  private async upsertAuditLog(
    plan: ExecutableWorkshopMeetingSchedulePlan,
    providerResult: CreatedMeetingResult
  ): Promise<SupabaseWriteResult> {
    return this.supabase.admin.from('audit_logs').upsert(
      {
        idempotency_key: plan.auditEvent.idempotency_key,
        actor_type: 'admin',
        actor_id: plan.auditEvent.actor_id,
        entity_table: plan.auditEvent.entity,
        entity_id: plan.auditEvent.entity_id,
        action: plan.auditEvent.action,
        previous_state: plan.auditEvent.previous_state,
        next_state: {
          ...plan.auditEvent.next_state,
          providerMeetingId: providerResult.providerMeetingId
       }
     },
      { onConflict: 'idempotency_key' }
    );
 }
}
