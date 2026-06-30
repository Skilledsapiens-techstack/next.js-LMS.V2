import { WorkshopMeetingScheduleExecutor } from './workshop-meeting-schedule.executor';
import { WorkshopMeetingProviderResult } from './workshop-meeting.provider';
import { createWorkshopMeetingSchedulePlan, WorkshopForMeetingSchedule } from './workshop-meeting-schedule-plan';

class MockConfigService {
  constructor(private readonly values: Record<string, boolean | undefined>) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  update(...args: unknown[]) {
    this.calls.push({ method: 'update', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return Promise.resolve(this.result);
  }

  upsert(...args: unknown[]) {
    this.calls.push({ method: 'upsert', args });
    return Promise.resolve(this.result);
  }
}

class MockSupabaseAdmin {
  tableResults = new Map<string, QueryResult>();
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.tableResults.get(table) ?? { data: {}, error: null });
    this.queries.push({ table, query });
    return query;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

const workshop: WorkshopForMeetingSchedule = {
  id: 'workshop-row-uuid',
  workshopId: 'WS-001',
  title: 'Live Consulting Session',
  status: 'Upcoming',
  date: '2026-06-27',
  time: '15:00:00',
  durationMinutes: 90
};
const providerResult: WorkshopMeetingProviderResult = {
  enabled: true,
  attempted: true,
  status: 'created',
  message: 'Provider meeting created.',
  providerMeetingId: 'zoom-meeting-123',
  joinUrl: 'https://zoom.example/join/123',
  startUrl: 'https://zoom.example/start/123'
};

function readyPlan() {
  return createWorkshopMeetingSchedulePlan(workshop, {
    adminEmail: 'admin@example.com',
    startsAt: '2026-06-27T15:00:00.000Z',
    scheduledAt: '2026-06-27T10:00:00.000Z'
  });
}

describe('WorkshopMeetingScheduleExecutor', () => {
  it('does not call Supabase when workshop meeting schedule writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new WorkshopMeetingScheduleExecutor(
      new MockConfigService({ WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan(), providerResult)).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      workshopId: 'workshop-row-uuid',
      message: 'Workshop meeting schedule writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe schedule plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new WorkshopMeetingScheduleExecutor(
      new MockConfigService({ WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createWorkshopMeetingSchedulePlan({ ...workshop, joinUrl: 'https://zoom.example/join' }, { adminEmail: 'admin@example.com' });

    await expect(executor.execute(plan, providerResult)).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      workshopId: undefined,
      message: 'Workshop meeting schedule skipped: already_has_meeting.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips when provider meeting was not created', async () => {
    const supabase = new MockSupabase();
    const executor = new WorkshopMeetingScheduleExecutor(
      new MockConfigService({ WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan(), { ...providerResult, status: 'failed', providerMeetingId: undefined, joinUrl: undefined })).resolves.toEqual({
      enabled: true,
      attempted: false,
      status: 'skipped',
      workshopId: 'workshop-row-uuid',
      message: 'Workshop meeting schedule skipped: provider meeting was not created.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs workshop meeting update and audit write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new WorkshopMeetingScheduleExecutor(
      new MockConfigService({ WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan(), providerResult)).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'updated',
      workshopId: 'workshop-row-uuid',
      message: 'Workshop meeting schedule writes completed.',
      completedSteps: ['workshops', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshops', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            workshop_status: 'Scheduled',
            updated_at: '2026-06-27T10:00:00.000Z',
            scheduled_at: '2026-06-27T15:00:00.000Z',
            zoom_id: 'zoom-meeting-123',
            join_url: 'https://zoom.example/join/123'
          }
        ]
      },
      { method: 'eq', args: ['id', 'workshop-row-uuid'] }
    ]);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'admin',
          actor_id: 'admin@example.com',
          entity_table: 'workshops',
          entity_id: 'workshop-row-uuid',
          action: 'workshop.meeting_schedule_requested'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at failed audit write and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new WorkshopMeetingScheduleExecutor(
      new MockConfigService({ WORKSHOP_MEETING_SCHEDULE_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan(), providerResult)).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      workshopId: 'workshop-row-uuid',
      message: 'audit write failed',
      completedSteps: ['workshops'],
      failedStep: 'audit_logs'
    });
  });
});
