export type EnrollmentActivationPaymentStatus =
  | 'pending_payment'
  | 'paid'
  | 'payment_received'
  | 'pending_review'
  | 'approved'
  | 'cohort_assigned'
  | 'activated'
  | 'completed'
  | 'rejected'
  | 'duplicate'
  | 'on_hold'
  | 'refunded'
  | 'exception';

export type EnrollmentActivationItemType = 'program' | 'role';

export type EnrollmentActivationPaymentOrder = {
  status: 'created' | 'paid' | 'failed' | 'cancelled';
  orderId?: string;
  paymentId?: string;
};

export type EnrollmentActivationRequest = {
  requestId: string;
  email?: string | null;
  studentName?: string | null;
  phone?: string | null;
  paymentStatus: EnrollmentActivationPaymentStatus;
  activatedStudentId?: string | null;
};

export type EnrollmentActivationRequestItem = {
  itemId: string;
  itemType: EnrollmentActivationItemType;
  itemName: string;
  programKey?: string | null;
  roleId?: string | null;
  assignedCohortId?: string | null;
  assignedCohortName?: string | null;
  status: EnrollmentActivationPaymentStatus;
};

export type EnrollmentActivationPlan = {
  shouldActivate: boolean;
  reason: 'ready' | 'payment_not_paid' | 'request_not_ready' | 'missing_email' | 'already_activated' | 'no_activatable_items';
  requestId: string;
  normalizedEmail?: string;
  studentProfile?: {
    idempotencyKey: string;
    email: string;
    name?: string;
    phone?: string;
  };
  studentProgramLinks: Array<{
    idempotencyKey: string;
    programKey: string;
    itemId: string;
  }>;
  studentCohortLinks: Array<{
    idempotencyKey: string;
    cohortId?: string;
    cohortName?: string;
    itemId: string;
  }>;
  paidAccessGrants: Array<{
    idempotencyKey: string;
    itemType: EnrollmentActivationItemType;
    itemId: string;
    itemName: string;
    programKey?: string;
    roleId?: string;
  }>;
  statusHistoryEntries: Array<{
    idempotencyKey: string;
    entity: 'enrollment_request' | 'enrollment_request_item';
    itemId?: string;
    nextStatus: 'activated';
  }>;
  auditEvents: Array<{
    idempotencyKey: string;
    action: 'enrollment.activation.planned';
    entity: 'enrollment_requests';
  }>;
};

const READY_REQUEST_STATUSES: EnrollmentActivationPaymentStatus[] = ['paid', 'payment_received', 'approved', 'cohort_assigned'];
const ACTIVATABLE_ITEM_STATUSES: EnrollmentActivationPaymentStatus[] = ['paid', 'payment_received', 'approved', 'cohort_assigned'];

export function createEnrollmentActivationPlan(
  paymentOrder: EnrollmentActivationPaymentOrder,
  request: EnrollmentActivationRequest,
  items: EnrollmentActivationRequestItem[]
): EnrollmentActivationPlan {
  const normalizedEmail = normalizeEmail(request.email);
  const base = emptyPlan(request.requestId, normalizedEmail);

  if (paymentOrder.status !== 'paid') {
    return { ...base, reason: 'payment_not_paid' };
  }

  if (request.activatedStudentId || request.paymentStatus === 'activated' || request.paymentStatus === 'completed') {
    return { ...base, reason: 'already_activated' };
  }

  if (!READY_REQUEST_STATUSES.includes(request.paymentStatus)) {
    return { ...base, reason: 'request_not_ready' };
  }

  if (!normalizedEmail) {
    return { ...base, reason: 'missing_email' };
  }

  const activatableItems = items.filter((item) => ACTIVATABLE_ITEM_STATUSES.includes(item.status));

  if (activatableItems.length === 0) {
    return { ...base, reason: 'no_activatable_items' };
  }

  const studentProfile = {
    idempotencyKey: `student:${normalizedEmail}`,
    email: normalizedEmail,
    name: cleanText(request.studentName),
    phone: cleanText(request.phone)
  };

  const studentProgramLinks = uniqueByKey(
    activatableItems
      .map((item) => {
        const programKey = cleanText(item.programKey);
        if (!programKey) return undefined;
        return {
          idempotencyKey: `student_program:${normalizedEmail}:${programKey}`,
          programKey,
          itemId: item.itemId
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  );

  const studentCohortLinks = uniqueByKey(
    activatableItems
      .map((item) => {
        const cohortId = cleanText(item.assignedCohortId);
        const cohortName = cleanText(item.assignedCohortName);
        if (!cohortId && !cohortName) return undefined;
        const cohortKey = cohortId ?? slugify(cohortName ?? '');
        return {
          idempotencyKey: `student_cohort:${normalizedEmail}:${cohortKey}`,
          cohortId,
          cohortName,
          itemId: item.itemId
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  );

  const paidAccessGrants = uniqueByKey(
    activatableItems.map((item) => {
      const itemKey = cleanText(item.roleId) ?? cleanText(item.programKey) ?? item.itemId;
      return {
        idempotencyKey: `paid_access:${normalizedEmail}:${item.itemType}:${itemKey}`,
        itemType: item.itemType,
        itemId: item.itemId,
        itemName: item.itemName,
        programKey: cleanText(item.programKey),
        roleId: cleanText(item.roleId)
      };
    })
  );

  return {
    shouldActivate: true,
    reason: 'ready',
    requestId: request.requestId,
    normalizedEmail,
    studentProfile,
    studentProgramLinks,
    studentCohortLinks,
    paidAccessGrants,
    statusHistoryEntries: [
      {
        idempotencyKey: `status_history:${request.requestId}:activated`,
        entity: 'enrollment_request',
        nextStatus: 'activated'
      },
      ...activatableItems.map((item) => ({
        idempotencyKey: `status_history:${request.requestId}:${item.itemId}:activated`,
        entity: 'enrollment_request_item' as const,
        itemId: item.itemId,
        nextStatus: 'activated' as const
      }))
    ],
    auditEvents: [
      {
        idempotencyKey: `audit:${request.requestId}:enrollment.activation.planned`,
        action: 'enrollment.activation.planned',
        entity: 'enrollment_requests'
      }
    ]
  };
}

function emptyPlan(requestId: string, normalizedEmail?: string): EnrollmentActivationPlan {
  return {
    shouldActivate: false,
    reason: 'request_not_ready',
    requestId,
    normalizedEmail,
    studentProgramLinks: [],
    studentCohortLinks: [],
    paidAccessGrants: [],
    statusHistoryEntries: [],
    auditEvents: []
  };
}

function normalizeEmail(value: string | null | undefined): string | undefined {
  const email = value?.trim().toLowerCase();
  return email || undefined;
}

function cleanText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function uniqueByKey<T extends { idempotencyKey: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.idempotencyKey)) return false;
    seen.add(item.idempotencyKey);
    return true;
  });
}
