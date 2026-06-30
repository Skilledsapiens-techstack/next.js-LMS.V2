export type WorkshopStatus = 'Upcoming' | 'Scheduled' | 'Live' | 'Completed' | 'Cancelled' | 'Inactive';

export type WorkshopForStatusTransition = {
  id: string;
  workshopId?: string;
  title: string;
  status: WorkshopStatus;
};

export type WorkshopStatusTransitionInput = {
  adminEmail: string;
  nextStatus: WorkshopStatus;
  changedAt?: string;
};

export type WorkshopStatusTransitionPlan = {
  shouldTransition: boolean;
  reason: 'ready' | 'missing_admin' | 'missing_workshop_identity' | 'same_status' | 'invalid_transition';
  idempotencyKey?: string;
  workshopUpdate?: {
    id: string;
    workshop_status: WorkshopStatus;
    updated_at: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'workshop.status_changed';
    entity: 'workshops';
    entity_id: string;
    actor_id: string;
    previous_state: {
      status: WorkshopStatus;
      workshopId?: string;
    };
    next_state: {
      status: WorkshopStatus;
      workshopId?: string;
      title: string;
    };
  };
};

const allowedTransitions: Record<WorkshopStatus, WorkshopStatus[]> = {
  Upcoming: ['Scheduled', 'Completed', 'Cancelled', 'Inactive'],
  Scheduled: ['Live', 'Completed', 'Cancelled', 'Inactive'],
  Live: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
  Inactive: []
};

export function createWorkshopStatusTransitionPlan(
  workshop: WorkshopForStatusTransition,
  input: WorkshopStatusTransitionInput
): WorkshopStatusTransitionPlan {
  const adminEmail = normalizeEmail(input.adminEmail);

  if (!adminEmail) {
    return { shouldTransition: false, reason: 'missing_admin' };
  }

  const workshopId = cleanText(workshop.id);
  const title = cleanText(workshop.title);

  if (!workshopId || !title) {
    return { shouldTransition: false, reason: 'missing_workshop_identity' };
  }

  if (workshop.status === input.nextStatus) {
    return { shouldTransition: false, reason: 'same_status' };
  }

  if (!allowedTransitions[workshop.status].includes(input.nextStatus)) {
    return { shouldTransition: false, reason: 'invalid_transition' };
  }

  const changedAt = cleanText(input.changedAt) ?? new Date().toISOString();
  const publicWorkshopId = cleanText(workshop.workshopId);
  const idempotencyKey = `workshop_status_transition:${workshopId}:${workshop.status}:${input.nextStatus}`;

  return {
    shouldTransition: true,
    reason: 'ready',
    idempotencyKey,
    workshopUpdate: {
      id: workshopId,
      workshop_status: input.nextStatus,
      updated_at: changedAt
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}`,
      action: 'workshop.status_changed',
      entity: 'workshops',
      entity_id: workshopId,
      actor_id: adminEmail,
      previous_state: {
        status: workshop.status,
        workshopId: publicWorkshopId
      },
      next_state: {
        status: input.nextStatus,
        workshopId: publicWorkshopId,
        title
      }
    }
  };
}

function normalizeEmail(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  return text || undefined;
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
