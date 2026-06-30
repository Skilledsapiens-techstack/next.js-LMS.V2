export type CertificateRequestReviewStatus = 'pending' | 'approved' | 'rejected';
export type CertificateRequestAdminStatus = CertificateRequestReviewStatus | 'issued';
export type CertificateRequestDecision = 'approve' | 'reject';

export type CertificateRequestForApproval = {
  requestId: string;
  requestType: 'live_project';
  studentEmail: string;
  studentName: string;
  projectId: string;
  projectTitle?: string;
  projectRole: string;
  programKey?: string;
  cohortName?: string;
  moderatorStatus: CertificateRequestReviewStatus;
  adminStatus: CertificateRequestAdminStatus;
};

export type CertificateRequestApprovalInput = {
  decision: CertificateRequestDecision;
  adminEmail: string;
  note?: string;
  decidedAt?: string;
  certificateId?: string;
};

export type CertificateRequestApprovalPlan = {
  shouldApply: boolean;
  reason: 'ready' | 'missing_admin' | 'moderator_not_approved' | 'already_final' | 'missing_rejection_note';
  idempotencyKey?: string;
  requestUpdate?: {
    request_id: string;
    admin_status: 'approved' | 'rejected';
    admin_email: string;
    admin_reviewed_at: string;
    updated_at: string;
  };
  generationJob?: {
    idempotency_key: string;
    request_id: string;
    certificate_id: string;
    certificate_type: 'live_project';
    status: 'pending';
    requested_by: string;
    requested_at: string;
    payload: {
      studentEmail: string;
      studentName: string;
      projectId: string;
      projectTitle?: string;
      projectRole: string;
      programKey?: string;
      cohortName?: string;
    };
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'certificate_request.approved' | 'certificate_request.rejected';
    entity: 'certificate_requests';
    entity_id: string;
    actor_id: string;
    previous_state: {
      moderatorStatus: CertificateRequestReviewStatus;
      adminStatus: CertificateRequestAdminStatus;
    };
    next_state: {
      adminStatus: 'approved' | 'rejected';
      note?: string;
      certificateId?: string;
    };
  };
};

export function createCertificateRequestApprovalPlan(
  request: CertificateRequestForApproval,
  input: CertificateRequestApprovalInput
): CertificateRequestApprovalPlan {
  const adminEmail = normalizeEmail(input.adminEmail);
  const note = cleanText(input.note);

  if (!adminEmail) {
    return { shouldApply: false, reason: 'missing_admin' };
  }

  if (request.moderatorStatus !== 'approved') {
    return { shouldApply: false, reason: 'moderator_not_approved' };
  }

  if (request.adminStatus === 'approved' || request.adminStatus === 'rejected' || request.adminStatus === 'issued') {
    return { shouldApply: false, reason: 'already_final' };
  }

  if (input.decision === 'reject' && !note) {
    return { shouldApply: false, reason: 'missing_rejection_note' };
  }

  const decidedAt = cleanText(input.decidedAt) ?? new Date().toISOString();
  const targetStatus = input.decision === 'approve' ? 'approved' : 'rejected';
  const idempotencyKey = `certificate_request_review:${request.requestId}:${targetStatus}`;
  const certificateId = cleanText(input.certificateId) ?? `cert:${request.requestId}`;

  return {
    shouldApply: true,
    reason: 'ready',
    idempotencyKey,
    requestUpdate: {
      request_id: request.requestId,
      admin_status: targetStatus,
      admin_email: adminEmail,
      admin_reviewed_at: decidedAt,
      updated_at: decidedAt
    },
    generationJob:
      targetStatus === 'approved'
        ? {
            idempotency_key: `certificate_generation:${request.requestId}`,
            request_id: request.requestId,
            certificate_id: certificateId,
            certificate_type: 'live_project',
            status: 'pending',
            requested_by: adminEmail,
            requested_at: decidedAt,
            payload: {
              studentEmail: normalizeEmail(request.studentEmail),
              studentName: request.studentName,
              projectId: request.projectId,
              projectTitle: request.projectTitle,
              projectRole: request.projectRole,
              programKey: request.programKey,
              cohortName: request.cohortName
            }
          }
        : undefined,
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}`,
      action: targetStatus === 'approved' ? 'certificate_request.approved' : 'certificate_request.rejected',
      entity: 'certificate_requests',
      entity_id: request.requestId,
      actor_id: adminEmail,
      previous_state: {
        moderatorStatus: request.moderatorStatus,
        adminStatus: request.adminStatus
      },
      next_state: {
        adminStatus: targetStatus,
        note,
        certificateId: targetStatus === 'approved' ? certificateId : undefined
      }
    }
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
