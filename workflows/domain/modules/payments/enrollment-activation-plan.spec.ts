import { createEnrollmentActivationPlan, EnrollmentActivationRequest, EnrollmentActivationRequestItem } from './enrollment-activation-plan';

const readyRequest: EnrollmentActivationRequest = {
  requestId: 'enr_123',
  email: ' Student@Example.com ',
  studentName: ' Student Name ',
  phone: ' +919999999999 ',
  paymentStatus: 'cohort_assigned'
};

const readyItems: EnrollmentActivationRequestItem[] = [
  {
    itemId: 'item_program',
    itemType: 'program',
    itemName: 'MBA Launchpad',
    programKey: 'mba',
    assignedCohortId: 'cohort-uuid',
    assignedCohortName: 'MBA June',
    status: 'cohort_assigned'
  },
  {
    itemId: 'item_role',
    itemType: 'role',
    itemName: 'Marketing Role',
    programKey: 'mba',
    roleId: 'marketing',
    assignedCohortId: 'cohort-uuid',
    assignedCohortName: 'MBA June',
    status: 'approved'
  }
];

describe('createEnrollmentActivationPlan', () => {
  it('creates an idempotent activation plan for paid enrollment requests', () => {
    const plan = createEnrollmentActivationPlan({ status: 'paid', orderId: 'order_123', paymentId: 'pay_123' }, readyRequest, readyItems);

    expect(plan).toMatchObject({
      shouldActivate: true,
      reason: 'ready',
      requestId: 'enr_123',
      normalizedEmail: 'student@example.com',
      studentProfile: {
        idempotencyKey: 'student:student@example.com',
        email: 'student@example.com',
        name: 'Student Name',
        phone: '+919999999999'
      }
    });
    expect(plan.studentProgramLinks).toEqual([
      {
        idempotencyKey: 'student_program:student@example.com:mba',
        programKey: 'mba',
        itemId: 'item_program'
      }
    ]);
    expect(plan.studentCohortLinks).toEqual([
      {
        idempotencyKey: 'student_cohort:student@example.com:cohort-uuid',
        cohortId: 'cohort-uuid',
        cohortName: 'MBA June',
        itemId: 'item_program'
      }
    ]);
    expect(plan.paidAccessGrants.map((grant) => grant.idempotencyKey)).toEqual([
      'paid_access:student@example.com:program:mba',
      'paid_access:student@example.com:role:marketing'
    ]);
    expect(plan.statusHistoryEntries.map((entry) => entry.idempotencyKey)).toEqual([
      'status_history:enr_123:activated',
      'status_history:enr_123:item_program:activated',
      'status_history:enr_123:item_role:activated'
    ]);
    expect(plan.auditEvents).toEqual([
      {
        idempotencyKey: 'audit:enr_123:enrollment.activation.planned',
        action: 'enrollment.activation.planned',
        entity: 'enrollment_requests'
      }
    ]);
  });

  it('refuses activation when the payment order is not paid', () => {
    expect(createEnrollmentActivationPlan({ status: 'failed' }, readyRequest, readyItems)).toMatchObject({
      shouldActivate: false,
      reason: 'payment_not_paid'
    });
  });

  it('refuses activation when the request is not in an activation-ready state', () => {
    expect(createEnrollmentActivationPlan({ status: 'paid' }, { ...readyRequest, paymentStatus: 'pending_review' }, readyItems)).toMatchObject({
      shouldActivate: false,
      reason: 'request_not_ready'
    });
  });

  it('refuses activation without a normalized student email', () => {
    expect(createEnrollmentActivationPlan({ status: 'paid' }, { ...readyRequest, email: ' ' }, readyItems)).toMatchObject({
      shouldActivate: false,
      reason: 'missing_email'
    });
  });

  it('refuses activation for already activated requests', () => {
    expect(createEnrollmentActivationPlan({ status: 'paid' }, { ...readyRequest, activatedStudentId: 'student-uuid' }, readyItems)).toMatchObject({
      shouldActivate: false,
      reason: 'already_activated'
    });
  });

  it('refuses activation when no request items are activatable', () => {
    expect(createEnrollmentActivationPlan({ status: 'paid' }, readyRequest, readyItems.map((item) => ({ ...item, status: 'pending_review' })))).toMatchObject({
      shouldActivate: false,
      reason: 'no_activatable_items'
    });
  });
});
