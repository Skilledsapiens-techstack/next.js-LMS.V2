import {
  WorkshopMeetingProvider,
  WorkshopMeetingProviderResult
} from './workshop-meeting.provider';
import {
  WorkshopMeetingScheduleExecutionResult,
  WorkshopMeetingScheduleExecutor
} from './workshop-meeting-schedule.executor';
import {
  createWorkshopMeetingSchedulePlan,
  WorkshopForMeetingSchedule,
  WorkshopMeetingScheduleInput
} from './workshop-meeting-schedule-plan';

export type WorkshopMeetingScheduleWorkflowResult = {
  status: 'plan_blocked' | 'provider_blocked' | WorkshopMeetingScheduleExecutionResult['status'];
  message: string;
  workshopId?: string;
  provider?: WorkshopMeetingProviderResult;
  execution?: WorkshopMeetingScheduleExecutionResult;
};
export class WorkshopMeetingScheduleWorkflow {
  constructor(
    private readonly provider: WorkshopMeetingProvider,
    private readonly executor: WorkshopMeetingScheduleExecutor
  ) {}

  async scheduleMeeting(
    workshop: WorkshopForMeetingSchedule,
    input: WorkshopMeetingScheduleInput
  ): Promise<WorkshopMeetingScheduleWorkflowResult> {
    const plan = createWorkshopMeetingSchedulePlan(workshop, input);

    if (!plan.shouldSchedule) {
      return {
        status: 'plan_blocked',
        message: `Workshop meeting schedule skipped: ${plan.reason}.`,
        workshopId: plan.workshopUpdate?.id
      };
    }

    const provider = await this.provider.createMeeting(plan.providerPayload);

    if (provider.status !== 'created') {
      return {
        status: 'provider_blocked',
        message: provider.message,
        workshopId: plan.workshopUpdate?.id,
        provider
      };
    }

    const execution = await this.executor.execute(plan, provider);

    return {
      status: execution.status,
      message: execution.message,
      workshopId: execution.workshopId,
      provider,
      execution
    };
  }
}
