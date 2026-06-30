export type ProjectSubmissionReviewStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export type ProjectSubmissionReviewAction = 'start_review' | 'approve' | 'reject';

export type ProjectSubmissionForReview = {
  requestId: string;
  status: ProjectSubmissionReviewStatus;
  studentEmail?: string;
  projectId?: string;
  attemptNumber?: number;
};

export type ProjectSubmissionReviewInput = {
  action: ProjectSubmissionReviewAction;
  adminEmail: string;
  reviewNote?: string;
  reviewedAt?: string;
};

export type ProjectSubmissionReviewPlan = {
  shouldTransition: boolean;
  reason: 'ready' | 'missing_admin' | 'missing_review_note' | 'already_in_target_state' | 'invalid_transition';
  idempotencyKey?: string;
  targetStatus?: ProjectSubmissionReviewStatus;
  projectSubmissionUpdate?: {
    request_id: string;
    status: ProjectSubmissionReviewStatus;
    reviewed_by: string;
    reviewed_at: string;
    review_notes?: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'project_submission.review_started' | 'project_submission.approved' | 'project_submission.rejected';
    entity: 'project_submission_requests';
    entity_id: string;
    actor_id: string;
    previous_state: {
      status: ProjectSubmissionReviewStatus;
    };
    next_state: {
      status: ProjectSubmissionReviewStatus;
      reviewNote?: string;
      studentEmail?: string;
      projectId?: string;
      attemptNumber?: number;
    };
  };
};

export function createProjectSubmissionReviewPlan(
  submission: ProjectSubmissionForReview,
  input: ProjectSubmissionReviewInput
): ProjectSubmissionReviewPlan {
  const adminEmail = normalizeEmail(input.adminEmail);

  if (!adminEmail) {
    return { shouldTransition: false, reason: 'missing_admin' };
  }

  const targetStatus = targetStatusForAction(input.action);
  const reviewNote = cleanText(input.reviewNote);

  if (input.action === 'reject' && !reviewNote) {
    return { shouldTransition: false, reason: 'missing_review_note', targetStatus };
  }

  if (submission.status === targetStatus) {
    return { shouldTransition: false, reason: 'already_in_target_state', targetStatus };
  }

  if (!canTransition(submission.status, targetStatus)) {
    return { shouldTransition: false, reason: 'invalid_transition', targetStatus };
  }

  const reviewedAt = cleanText(input.reviewedAt) ?? new Date().toISOString();
  const idempotencyKey = `project_submission_review:${submission.requestId}:${targetStatus}`;
  const auditAction = auditActionForStatus(targetStatus);

  return {
    shouldTransition: true,
    reason: 'ready',
    idempotencyKey,
    targetStatus,
    projectSubmissionUpdate: {
      request_id: submission.requestId,
      status: targetStatus,
      reviewed_by: adminEmail,
      reviewed_at: reviewedAt,
      review_notes: reviewNote
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}:${auditAction}`,
      action: auditAction,
      entity: 'project_submission_requests',
      entity_id: submission.requestId,
      actor_id: adminEmail,
      previous_state: {
        status: submission.status
      },
      next_state: {
        status: targetStatus,
        reviewNote,
        studentEmail: cleanText(submission.studentEmail),
        projectId: cleanText(submission.projectId),
        attemptNumber: submission.attemptNumber
      }
    }
  };
}

function targetStatusForAction(action: ProjectSubmissionReviewAction): ProjectSubmissionReviewStatus {
  if (action === 'start_review') return 'under_review';
  if (action === 'approve') return 'approved';
  return 'rejected';
}

function canTransition(currentStatus: ProjectSubmissionReviewStatus, targetStatus: ProjectSubmissionReviewStatus): boolean {
  if (targetStatus === 'under_review') {
    return currentStatus === 'submitted';
  }

  if (targetStatus === 'approved' || targetStatus === 'rejected') {
    return currentStatus === 'submitted' || currentStatus === 'under_review';
  }

  return false;
}

function auditActionForStatus(
  status: ProjectSubmissionReviewStatus
): 'project_submission.review_started' | 'project_submission.approved' | 'project_submission.rejected' {
  if (status === 'under_review') return 'project_submission.review_started';
  if (status === 'approved') return 'project_submission.approved';
  return 'project_submission.rejected';
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
