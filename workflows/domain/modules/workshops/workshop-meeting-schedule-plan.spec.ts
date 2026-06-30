import { createWorkshopMeetingSchedulePlan, WorkshopForMeetingSchedule } from './workshop-meeting-schedule-plan';

const workshop: WorkshopForMeetingSchedule = {
  id: 'workshop-row-uuid',
  workshopId: 'WS-001',
  title: 'Live Consulting Session',
  status: 'Upcoming',
  date: '2026-06-27',
  time: '15:00:00',
  durationMinutes: 90
};

describe('createWorkshopMeetingSchedulePlan', () => {
  it('plans provider payload, workshop update, and audit intent for meeting scheduling', () => {
    expect(
      createWorkshopMeetingSchedulePlan(workshop, {
        adminEmail: ' Admin@Example.com ',
        startsAt: '2026-06-27T15:00:00.000Z',
        timezone: 'Asia/Kolkata',
        hostEmail: ' Mentor@Example.com ',
        agenda: ' Consulting foundations ',
        scheduledAt: '2026-06-27T10:00:00.000Z'
      })
    ).toEqual({
      shouldSchedule: true,
      reason: 'ready',
      idempotencyKey: 'workshop_meeting_schedule:workshop-row-uuid:2026-06-27T15:00:00.000Z',
      providerPayload: {
        title: 'Live Consulting Session',
        startsAt: '2026-06-27T15:00:00.000Z',
        durationMinutes: 90,
        timezone: 'Asia/Kolkata',
        hostEmail: 'mentor@example.com',
        agenda: 'Consulting foundations'
      },
      workshopUpdate: {
        id: 'workshop-row-uuid',
        workshop_status: 'Scheduled',
        updated_at: '2026-06-27T10:00:00.000Z',
        scheduled_at: '2026-06-27T15:00:00.000Z'
      },
      auditEvent: {
        idempotency_key: 'audit:workshop_meeting_schedule:workshop-row-uuid:2026-06-27T15:00:00.000Z',
        action: 'workshop.meeting_schedule_requested',
        entity: 'workshops',
        entity_id: 'workshop-row-uuid',
        actor_id: 'admin@example.com',
        previous_state: {
          status: 'Upcoming',
          workshopId: 'WS-001',
          joinUrl: undefined,
          zoomId: undefined
        },
        next_state: {
          status: 'Scheduled',
          workshopId: 'WS-001',
          startsAt: '2026-06-27T15:00:00.000Z',
          durationMinutes: 90,
          title: 'Live Consulting Session'
        }
      }
    });
  });

  it('uses workshop date and time when explicit start time is not provided', () => {
    expect(
      createWorkshopMeetingSchedulePlan(workshop, {
        adminEmail: 'admin@example.com',
        scheduledAt: '2026-06-27T10:00:00.000Z'
      }).providerPayload
    ).toMatchObject({
      startsAt: '2026-06-27T15:00:00.000Z',
      durationMinutes: 90
    });
  });

  it('blocks unsafe or incomplete scheduling requests', () => {
    expect(createWorkshopMeetingSchedulePlan(workshop, { adminEmail: ' ' })).toEqual({
      shouldSchedule: false,
      reason: 'missing_admin'
    });
    expect(createWorkshopMeetingSchedulePlan({ ...workshop, id: ' ' }, { adminEmail: 'admin@example.com' })).toEqual({
      shouldSchedule: false,
      reason: 'missing_workshop_identity'
    });
    expect(createWorkshopMeetingSchedulePlan({ ...workshop, status: 'Completed' }, { adminEmail: 'admin@example.com' })).toEqual({
      shouldSchedule: false,
      reason: 'final_status'
    });
    expect(createWorkshopMeetingSchedulePlan({ ...workshop, joinUrl: 'https://zoom.example/join' }, { adminEmail: 'admin@example.com' })).toEqual({
      shouldSchedule: false,
      reason: 'already_has_meeting'
    });
    expect(createWorkshopMeetingSchedulePlan({ ...workshop, date: undefined, time: undefined }, { adminEmail: 'admin@example.com' })).toEqual({
      shouldSchedule: false,
      reason: 'invalid_start_time'
    });
    expect(createWorkshopMeetingSchedulePlan(workshop, { adminEmail: 'admin@example.com', durationMinutes: 5 })).toEqual({
      shouldSchedule: false,
      reason: 'invalid_duration'
    });
  });
});
