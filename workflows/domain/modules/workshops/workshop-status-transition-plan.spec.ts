import { createWorkshopStatusTransitionPlan, WorkshopForStatusTransition } from './workshop-status-transition-plan';

const workshop: WorkshopForStatusTransition = {
  id: 'workshop-row-uuid',
  workshopId: 'WS-001',
  title: 'Live Consulting Session',
  status: 'Scheduled'
};

describe('createWorkshopStatusTransitionPlan', () => {
  it('plans a safe workshop status transition and audit event', () => {
    expect(
      createWorkshopStatusTransitionPlan(workshop, {
        adminEmail: ' Admin@Example.com ',
        nextStatus: 'Live',
        changedAt: '2026-06-27T10:00:00.000Z'
      })
    ).toEqual({
      shouldTransition: true,
      reason: 'ready',
      idempotencyKey: 'workshop_status_transition:workshop-row-uuid:Scheduled:Live',
      workshopUpdate: {
        id: 'workshop-row-uuid',
        workshop_status: 'Live',
        updated_at: '2026-06-27T10:00:00.000Z'
      },
      auditEvent: {
        idempotency_key: 'audit:workshop_status_transition:workshop-row-uuid:Scheduled:Live',
        action: 'workshop.status_changed',
        entity: 'workshops',
        entity_id: 'workshop-row-uuid',
        actor_id: 'admin@example.com',
        previous_state: {
          status: 'Scheduled',
          workshopId: 'WS-001'
        },
        next_state: {
          status: 'Live',
          workshopId: 'WS-001',
          title: 'Live Consulting Session'
        }
      }
    });
  });

  it('blocks missing admin identity', () => {
    expect(createWorkshopStatusTransitionPlan(workshop, { adminEmail: ' ', nextStatus: 'Live' })).toEqual({
      shouldTransition: false,
      reason: 'missing_admin'
    });
  });

  it('blocks missing workshop identity', () => {
    expect(createWorkshopStatusTransitionPlan({ ...workshop, id: ' ' }, { adminEmail: 'admin@example.com', nextStatus: 'Live' })).toEqual({
      shouldTransition: false,
      reason: 'missing_workshop_identity'
    });
  });

  it('blocks no-op transitions', () => {
    expect(createWorkshopStatusTransitionPlan(workshop, { adminEmail: 'admin@example.com', nextStatus: 'Scheduled' })).toEqual({
      shouldTransition: false,
      reason: 'same_status'
    });
  });

  it('blocks unsafe transitions out of final statuses', () => {
    expect(createWorkshopStatusTransitionPlan({ ...workshop, status: 'Completed' }, { adminEmail: 'admin@example.com', nextStatus: 'Scheduled' })).toEqual({
      shouldTransition: false,
      reason: 'invalid_transition'
    });
  });

  it('allows admin completion from upcoming workshops', () => {
    expect(createWorkshopStatusTransitionPlan({ ...workshop, status: 'Upcoming' }, { adminEmail: 'admin@example.com', nextStatus: 'Completed' })).toEqual(
      expect.objectContaining({
        shouldTransition: true,
        reason: 'ready',
        workshopUpdate: expect.objectContaining({
          id: 'workshop-row-uuid',
          workshop_status: 'Completed'
        })
      })
    );
  });
});
