export type RecordingCandidateStatus = 'draft' | 'reviewed' | 'rejected';
export type RecordingCandidateReviewDecision = 'review' | 'reject';

export type RecordingCandidateForReview = {
  id: string;
  workshopId: string;
  zoomId: string;
  zoomAccount: string;
  status: RecordingCandidateStatus;
  zoomRecordingFileId?: string;
  playUrl?: string;
  downloadUrl?: string;
};

export type RecordingCandidateReviewInput = {
  adminEmail: string;
  decision: RecordingCandidateReviewDecision;
  reviewedAt?: string;
};

export type RecordingCandidateReviewPlan = {
  shouldReview: boolean;
  reason: 'ready' | 'missing_admin' | 'missing_candidate_identity' | 'already_final' | 'missing_recording_reference';
  idempotencyKey?: string;
  candidateUpdate?: {
    id: string;
    status: Exclude<RecordingCandidateStatus, 'draft'>;
    reviewed_by: string;
    reviewed_at: string;
    updated_at: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'recording_candidate.reviewed' | 'recording_candidate.rejected';
    entity: 'workshop_recording_candidates';
    entity_id: string;
    actor_id: string;
    previous_state: {
      status: RecordingCandidateStatus;
      workshopId: string;
    };
    next_state: {
      status: Exclude<RecordingCandidateStatus, 'draft'>;
      workshopId: string;
      zoomId: string;
      zoomAccount: string;
      zoomRecordingFileId?: string;
    };
  };
};

export function createRecordingCandidateReviewPlan(
  candidate: RecordingCandidateForReview,
  input: RecordingCandidateReviewInput
): RecordingCandidateReviewPlan {
  const adminEmail = normalizeEmail(input.adminEmail);

  if (!adminEmail) {
    return { shouldReview: false, reason: 'missing_admin' };
  }

  const candidateId = cleanText(candidate.id);
  const workshopId = cleanText(candidate.workshopId);
  const zoomId = cleanText(candidate.zoomId);
  const zoomAccount = cleanText(candidate.zoomAccount);

  if (!candidateId || !workshopId || !zoomId || !zoomAccount) {
    return { shouldReview: false, reason: 'missing_candidate_identity' };
  }

  if (candidate.status !== 'draft') {
    return { shouldReview: false, reason: 'already_final' };
  }

  const zoomRecordingFileId = cleanText(candidate.zoomRecordingFileId);
  const playUrl = cleanText(candidate.playUrl);
  const downloadUrl = cleanText(candidate.downloadUrl);

  if (!zoomRecordingFileId && !playUrl && !downloadUrl) {
    return { shouldReview: false, reason: 'missing_recording_reference' };
  }

  const reviewedAt = cleanText(input.reviewedAt) ?? new Date().toISOString();
  const nextStatus = input.decision === 'review' ? 'reviewed' : 'rejected';
  const idempotencyKey = `recording_candidate_review:${candidateId}:${nextStatus}`;

  return {
    shouldReview: true,
    reason: 'ready',
    idempotencyKey,
    candidateUpdate: {
      id: candidateId,
      status: nextStatus,
      reviewed_by: adminEmail,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}`,
      action: input.decision === 'review' ? 'recording_candidate.reviewed' : 'recording_candidate.rejected',
      entity: 'workshop_recording_candidates',
      entity_id: candidateId,
      actor_id: adminEmail,
      previous_state: {
        status: candidate.status,
        workshopId
      },
      next_state: {
        status: nextStatus,
        workshopId,
        zoomId,
        zoomAccount,
        zoomRecordingFileId
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
