import { WorkshopMeetingProviderResult } from './workshop-meeting.provider';
import { WorkshopMeetingScheduleExecutionResult } from './workshop-meeting-schedule.executor';
import { WorkshopForMeetingSchedule } from './workshop-meeting-schedule-plan';
import { WorkshopMeetingScheduleWorkflow } from './workshop-meeting-schedule.workflow';

const workshop: WorkshopForMeetingSchedule = {
  id: 'workshop-row-uuid',
  workshopId: 'WS-001',
  title: 'Live Consulting Session',
  status: 'Upcoming',
  date: '2026-06-27',
  time: '15:00:00',
  durationMinutes: 90
};
const input = {
  adminEmail: 'admin@example.com',
  startsAt: '2026-06-27T15:00:00.000Z',
  scheduledAt: '2026-06-27T10:00:00.000Z'
};

class MockProvider {
  result: WorkshopMeetingProviderResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    message: 'Workshop meeting provider is disabled. No provider call was attempted.'
  };
  payload?: unknown;

  createMeeting(payload: unknown) {
    this.payload = payload;
    return Promise.resolve(this.result);
  }
}

class MockExecutor {
  result: WorkshopMeetingScheduleExecutionResult = {
    enabled: false,
    attempted: false,
    status: 'disabled',
    workshopId: 'workshop-row-uuid',
    message: 'Workshop meeting schedule writes are disabled. No Supabase write was attempted.',
    completedSteps: []
  };
  plan?: unknown;
  providerResult?: unknown;

  execute(plan: unknown, providerResult: unknown) {
    this.plan = plan;
    this.providerResult = providerResult;
    return Promise.resolve(this.result);
  }
}

describe('WorkshopMeetingScheduleWorkflow', () => {
  it('blocks unsafe schedule plans before provider calls', async () => {
    const provider = new MockProvider();
    const executor = new MockExecutor();
    const workflow = new WorkshopMeetingScheduleWorkflow(provider as never, executor as never);

    await expect(workflow.scheduleMeeting({ ...workshop, joinUrl: 'https://zoom.example/join' }, input)).resolves.toEqual({
      status: 'plan_blocked',
      message: 'Workshop meeting schedule skipped: already_has_meeting.',
      workshopId: undefined
    });
    expect(provider.payload).toBeUndefined();
    expect(executor.plan).toBeUndefined();
  });

  it('does not execute schedule writes when provider is disabled', async () => {
    const provider = new MockProvider();
    const executor = new MockExecutor();
    const workflow = new WorkshopMeetingScheduleWorkflow(provider as never, executor as never);

    await expect(workflow.scheduleMeeting(workshop, input)).resolves.toEqual({
      status: 'provider_blocked',
      message: 'Workshop meeting provider is disabled. No provider call was attempted.',
      workshopId: 'workshop-row-uuid',
      provider: provider.result
    });
    expect(provider.payload).toEqual({
      title: 'Live Consulting Session',
      startsAt: '2026-06-27T15:00:00.000Z',
      durationMinutes: 90,
      timezone: undefined,
      hostEmail: undefined,
      agenda: undefined
    });
    expect(executor.plan).toBeUndefined();
  });

  it('delegates gated schedule execution after provider meeting creation', async () => {
    const provider = new MockProvider();
    provider.result = {
      enabled: true,
      attempted: true,
      status: 'created',
      message: 'Provider meeting created.',
      providerMeetingId: 'zoom-meeting-123',
      joinUrl: 'https://zoom.example/join/123'
    };
    const executor = new MockExecutor();
    const workflow = new WorkshopMeetingScheduleWorkflow(provider as never, executor as never);

    await expect(workflow.scheduleMeeting(workshop, input)).resolves.toEqual({
      status: 'disabled',
      message: 'Workshop meeting schedule writes are disabled. No Supabase write was attempted.',
      workshopId: 'workshop-row-uuid',
      provider: provider.result,
      execution: executor.result
    });
    expect(executor.providerResult).toBe(provider.result);
    expect(executor.plan).toMatchObject({
      shouldSchedule: true,
      reason: 'ready',
      workshopUpdate: {
        id: 'workshop-row-uuid',
        workshop_status: 'Scheduled'
      }
    });
  });

  it('returns executor failures unchanged after provider creation', async () => {
    const provider = new MockProvider();
    provider.result = {
      enabled: true,
      attempted: true,
      status: 'created',
      message: 'Provider meeting created.',
      providerMeetingId: 'zoom-meeting-123',
      joinUrl: 'https://zoom.example/join/123'
    };
    const executor = new MockExecutor();
    executor.result = {
      enabled: true,
      attempted: true,
      status: 'failed',
      workshopId: 'workshop-row-uuid',
      message: 'audit write failed',
      completedSteps: ['workshops'],
      failedStep: 'audit_logs'
    };
    const workflow = new WorkshopMeetingScheduleWorkflow(provider as never, executor as never);

    await expect(workflow.scheduleMeeting(workshop, input)).resolves.toEqual({
      status: 'failed',
      message: 'audit write failed',
      workshopId: 'workshop-row-uuid',
      provider: provider.result,
      execution: executor.result
    });
  });
});
