import { ConfigService } from "@app/common/runtime/config";
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { WorkshopStatusTransitionPlan } from './workshop-status-transition-plan';

export type WorkshopStatusTransitionExecutionResult = {
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

type ExecutableWorkshopStatusTransitionPlan = WorkshopStatusTransitionPlan & {
  shouldTransition: true;
  workshopUpdate: NonNullable<WorkshopStatusTransitionPlan['workshopUpdate']>;
  auditEvent: NonNullable<WorkshopStatusTransitionPlan['auditEvent']>;
};
export class WorkshopStatusTransitionExecutor {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  async execute(plan: WorkshopStatusTransitionPlan): Promise<WorkshopStatusTransitionExecutionResult> {
    if (!this.config.get<boolean>('WORKSHOP_STATUS_WRITES_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        workshopId: plan.workshopUpdate?.id,
        message: 'Workshop status writes are disabled. No Supabase write was attempted.',
        completedSteps: []
     };
   }

    if (!this.isExecutable(plan)) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        workshopId: plan.workshopUpdate?.id,
        message: `Workshop status transition skipped: ${plan.reason}.`,
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
      message: 'Workshop status writes completed.',
      completedSteps
   };
 }

  private isExecutable(plan: WorkshopStatusTransitionPlan): plan is ExecutableWorkshopStatusTransitionPlan {
    return Boolean(plan.shouldTransition && plan.workshopUpdate && plan.auditEvent);
 }

  private async updateWorkshop(plan: ExecutableWorkshopStatusTransitionPlan): Promise<SupabaseWriteResult> {
    const { id, ...update } = plan.workshopUpdate;
    return this.supabase.admin.from('workshops').update(update).eq('id', id);
 }

  private async upsertAuditLog(plan: ExecutableWorkshopStatusTransitionPlan): Promise<SupabaseWriteResult> {
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
