import { WorkshopStatus } from './workshop-status-transition-plan';

export type WorkshopForMeetingSchedule = {
  id: string;
  workshopId?: string;
  title: string;
  status: WorkshopStatus;
  date?: string;
  time?: string;
  durationMinutes?: number;
  joinUrl?: string;
  zoomId?: string;
};

export type WorkshopMeetingScheduleInput = {
  adminEmail: string;
  startsAt?: string;
  durationMinutes?: number;
  timezone?: string;
  hostEmail?: string;
  agenda?: string;
  scheduledAt?: string;
};

export type WorkshopMeetingSchedulePlan = {
  shouldSchedule: boolean;
  reason:
    | 'ready'
    | 'missing_admin'
    | 'missing_workshop_identity'
    | 'final_status'
    | 'already_has_meeting'
    | 'invalid_start_time'
    | 'invalid_duration';
  idempotencyKey?: string;
  providerPayload?: {
    title: string;
    startsAt: string;
    durationMinutes: number;
    timezone?: string;
    hostEmail?: string;
    agenda?: string;
  };
  workshopUpdate?: {
    id: string;
    workshop_status: 'Scheduled';
    updated_at: string;
    scheduled_at: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'workshop.meeting_schedule_requested';
    entity: 'workshops';
    entity_id: string;
    actor_id: string;
    previous_state: {
      status: WorkshopStatus;
      workshopId?: string;
      joinUrl?: string;
      zoomId?: string;
    };
    next_state: {
      status: 'Scheduled';
      workshopId?: string;
      startsAt: string;
      durationMinutes: number;
      title: string;
    };
  };
};

const finalStatuses: WorkshopStatus[] = ['Completed', 'Cancelled', 'Inactive'];
const defaultDurationMinutes = 60;

export function createWorkshopMeetingSchedulePlan(
  workshop: WorkshopForMeetingSchedule,
  input: WorkshopMeetingScheduleInput
): WorkshopMeetingSchedulePlan {
  const adminEmail = normalizeEmail(input.adminEmail);

  if (!adminEmail) {
    return { shouldSchedule: false, reason: 'missing_admin' };
  }

  const workshopRowId = cleanText(workshop.id);
  const title = cleanText(workshop.title);

  if (!workshopRowId || !title) {
    return { shouldSchedule: false, reason: 'missing_workshop_identity' };
  }

  if (finalStatuses.includes(workshop.status)) {
    return { shouldSchedule: false, reason: 'final_status' };
  }

  if (cleanText(workshop.joinUrl) || cleanText(workshop.zoomId)) {
    return { shouldSchedule: false, reason: 'already_has_meeting' };
  }

  const startsAt = parseDate(input.startsAt) ?? parseWorkshopDateTime(workshop.date, workshop.time);

  if (!startsAt) {
    return { shouldSchedule: false, reason: 'invalid_start_time' };
  }

  const durationMinutes = validDuration(input.durationMinutes ?? workshop.durationMinutes ?? defaultDurationMinutes);

  if (!durationMinutes) {
    return { shouldSchedule: false, reason: 'invalid_duration' };
  }

  const scheduledAt = cleanText(input.scheduledAt) ?? new Date().toISOString();
  const publicWorkshopId = cleanText(workshop.workshopId);
  const startsAtIso = startsAt.toISOString();
  const idempotencyKey = `workshop_meeting_schedule:${workshopRowId}:${startsAtIso}`;

  return {
    shouldSchedule: true,
    reason: 'ready',
    idempotencyKey,
    providerPayload: {
      title,
      startsAt: startsAtIso,
      durationMinutes,
      timezone: cleanText(input.timezone),
      hostEmail: normalizeEmail(input.hostEmail ?? ''),
      agenda: cleanText(input.agenda)
    },
    workshopUpdate: {
      id: workshopRowId,
      workshop_status: 'Scheduled',
      updated_at: scheduledAt,
      scheduled_at: startsAtIso
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}`,
      action: 'workshop.meeting_schedule_requested',
      entity: 'workshops',
      entity_id: workshopRowId,
      actor_id: adminEmail,
      previous_state: {
        status: workshop.status,
        workshopId: publicWorkshopId,
        joinUrl: cleanText(workshop.joinUrl),
        zoomId: cleanText(workshop.zoomId)
      },
      next_state: {
        status: 'Scheduled',
        workshopId: publicWorkshopId,
        startsAt: startsAtIso,
        durationMinutes,
        title
      }
    }
  };
}

function parseWorkshopDateTime(date: string | undefined, time: string | undefined): Date | undefined {
  const cleanDate = cleanText(date);
  const cleanTime = cleanText(time) ?? '00:00:00';

  if (!cleanDate) return undefined;

  const normalizedTime = normalizeTimeForUtc(cleanTime);
  return parseDate(`${cleanDate}T${normalizedTime}`);
}

function normalizeTimeForUtc(value: string): string {
  if (value.endsWith('Z')) return value;

  const [time, milliseconds] = value.split('.');
  const parts = time.split(':');
  const withSeconds = parts.length === 2 ? `${time}:00` : time;

  return `${withSeconds}.${milliseconds ?? '000'}Z`;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function validDuration(value: number): number | undefined {
  return Number.isInteger(value) && value >= 15 && value <= 480 ? value : undefined;
}

function normalizeEmail(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  return text || undefined;
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
