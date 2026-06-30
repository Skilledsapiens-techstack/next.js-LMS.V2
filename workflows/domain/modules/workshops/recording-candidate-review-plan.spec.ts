import { createRecordingCandidateReviewPlan, RecordingCandidateForReview } from './recording-candidate-review-plan';

const candidate: RecordingCandidateForReview = {
  id: 'candidate-uuid',
  workshopId: 'WS-001',
  zoomId: '123456789',
  zoomAccount: 'account1',
  status: 'draft',
  zoomRecordingFileId: 'file-1',
  playUrl: 'https://zoom.example/play',
  downloadUrl: 'https://zoom.example/download'
};

describe('createRecordingCandidateReviewPlan', () => {
  it('plans a recording candidate review without publishing the recording', () => {
    expect(
      createRecordingCandidateReviewPlan(candidate, {
        adminEmail: ' Admin@Example.com ',
        decision: 'review',
        reviewedAt: '2026-06-27T10:00:00.000Z'
      })
    ).toEqual({
      shouldReview: true,
      reason: 'ready',
      idempotencyKey: 'recording_candidate_review:candidate-uuid:reviewed',
      candidateUpdate: {
        id: 'candidate-uuid',
        status: 'reviewed',
        reviewed_by: 'admin@example.com',
        reviewed_at: '2026-06-27T10:00:00.000Z',
        updated_at: '2026-06-27T10:00:00.000Z'
      },
      auditEvent: {
        idempotency_key: 'audit:recording_candidate_review:candidate-uuid:reviewed',
        action: 'recording_candidate.reviewed',
        entity: 'workshop_recording_candidates',
        entity_id: 'candidate-uuid',
        actor_id: 'admin@example.com',
        previous_state: {
          status: 'draft',
          workshopId: 'WS-001'
        },
        next_state: {
          status: 'reviewed',
          workshopId: 'WS-001',
          zoomId: '123456789',
          zoomAccount: 'account1',
          zoomRecordingFileId: 'file-1'
        }
      }
    });
  });

  it('plans a recording candidate rejection', () => {
    expect(
      createRecordingCandidateReviewPlan(candidate, {
        adminEmail: 'admin@example.com',
        decision: 'reject',
        reviewedAt: '2026-06-27T10:00:00.000Z'
      })
    ).toMatchObject({
      shouldReview: true,
      reason: 'ready',
      candidateUpdate: {
        status: 'rejected'
      },
      auditEvent: {
        action: 'recording_candidate.rejected',
        next_state: {
          status: 'rejected'
        }
      }
    });
  });

  it('blocks missing admin identity', () => {
    expect(createRecordingCandidateReviewPlan(candidate, { adminEmail: ' ', decision: 'review' })).toEqual({
      shouldReview: false,
      reason: 'missing_admin'
    });
  });

  it('blocks missing candidate identity', () => {
    expect(createRecordingCandidateReviewPlan({ ...candidate, id: ' ' }, { adminEmail: 'admin@example.com', decision: 'review' })).toEqual({
      shouldReview: false,
      reason: 'missing_candidate_identity'
    });
  });

  it('blocks already reviewed or rejected candidates', () => {
    expect(createRecordingCandidateReviewPlan({ ...candidate, status: 'reviewed' }, { adminEmail: 'admin@example.com', decision: 'reject' })).toEqual({
      shouldReview: false,
      reason: 'already_final'
    });
  });

  it('blocks candidates without any recording reference', () => {
    expect(
      createRecordingCandidateReviewPlan(
        {
          ...candidate,
          zoomRecordingFileId: ' ',
          playUrl: undefined,
          downloadUrl: undefined
        },
        { adminEmail: 'admin@example.com', decision: 'review' }
      )
    ).toEqual({
      shouldReview: false,
      reason: 'missing_recording_reference'
    });
  });
});
