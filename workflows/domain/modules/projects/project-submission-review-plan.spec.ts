import { createProjectSubmissionReviewPlan, ProjectSubmissionForReview } from './project-submission-review-plan';

const submittedSubmission: ProjectSubmissionForReview = {
  requestId: 'project_submission:student@example.com:proj_123:attempt:1',
  status: 'submitted',
  studentEmail: 'student@example.com',
  projectId: 'proj_123',
  attemptNumber: 1
};

describe('createProjectSubmissionReviewPlan', () => {
  it('plans a submitted project submission review start', () => {
    const plan = createProjectSubmissionReviewPlan(submittedSubmission, {
      action: 'start_review',
      adminEmail: ' Admin@Example.com ',
      reviewedAt: '2026-06-27T10:00:00.000Z'
    });

    expect(plan).toMatchObject({
      shouldTransition: true,
      reason: 'ready',
      idempotencyKey: 'project_submission_review:project_submission:student@example.com:proj_123:attempt:1:under_review',
      targetStatus: 'under_review',
      projectSubmissionUpdate: {
        request_id: 'project_submission:student@example.com:proj_123:attempt:1',
        status: 'under_review',
        reviewed_by: 'admin@example.com',
        reviewed_at: '2026-06-27T10:00:00.000Z'
      },
      auditEvent: {
        idempotency_key:
          'audit:project_submission_review:project_submission:student@example.com:proj_123:attempt:1:under_review:project_submission.review_started',
        action: 'project_submission.review_started',
        entity: 'project_submission_requests',
        entity_id: 'project_submission:student@example.com:proj_123:attempt:1',
        actor_id: 'admin@example.com',
        previous_state: {
          status: 'submitted'
        },
        next_state: {
          status: 'under_review',
          studentEmail: 'student@example.com',
          projectId: 'proj_123',
          attemptNumber: 1
        }
      }
    });
  });

  it('plans approval from submitted or under-review states', () => {
    expect(
      createProjectSubmissionReviewPlan(submittedSubmission, {
        action: 'approve',
        adminEmail: 'admin@example.com',
        reviewNote: ' Good work ',
        reviewedAt: '2026-06-27T10:05:00.000Z'
      })
    ).toMatchObject({
      shouldTransition: true,
      reason: 'ready',
      targetStatus: 'approved',
      projectSubmissionUpdate: {
        status: 'approved',
        review_notes: 'Good work'
      },
      auditEvent: {
        action: 'project_submission.approved',
        next_state: {
          status: 'approved',
          reviewNote: 'Good work'
        }
      }
    });

    expect(
      createProjectSubmissionReviewPlan(
        { ...submittedSubmission, status: 'under_review' },
        {
          action: 'approve',
          adminEmail: 'admin@example.com',
          reviewedAt: '2026-06-27T10:10:00.000Z'
        }
      )
    ).toMatchObject({
      shouldTransition: true,
      reason: 'ready',
      targetStatus: 'approved'
    });
  });

  it('requires a review note for rejection', () => {
    expect(
      createProjectSubmissionReviewPlan(submittedSubmission, {
        action: 'reject',
        adminEmail: 'admin@example.com',
        reviewedAt: '2026-06-27T10:15:00.000Z'
      })
    ).toEqual({
      shouldTransition: false,
      reason: 'missing_review_note',
      targetStatus: 'rejected'
    });
  });

  it('plans rejection when a review note is present', () => {
    expect(
      createProjectSubmissionReviewPlan(
        { ...submittedSubmission, status: 'under_review' },
        {
          action: 'reject',
          adminEmail: 'admin@example.com',
          reviewNote: 'Needs source file access',
          reviewedAt: '2026-06-27T10:20:00.000Z'
        }
      )
    ).toMatchObject({
      shouldTransition: true,
      reason: 'ready',
      targetStatus: 'rejected',
      projectSubmissionUpdate: {
        status: 'rejected',
        review_notes: 'Needs source file access'
      },
      auditEvent: {
        action: 'project_submission.rejected',
        next_state: {
          status: 'rejected',
          reviewNote: 'Needs source file access'
        }
      }
    });
  });

  it('blocks missing admin identity and unsafe transitions', () => {
    expect(
      createProjectSubmissionReviewPlan(submittedSubmission, {
        action: 'approve',
        adminEmail: ' '
      })
    ).toEqual({
      shouldTransition: false,
      reason: 'missing_admin'
    });

    expect(
      createProjectSubmissionReviewPlan(
        { ...submittedSubmission, status: 'approved' },
        {
          action: 'reject',
          adminEmail: 'admin@example.com',
          reviewNote: 'late rejection'
        }
      )
    ).toEqual({
      shouldTransition: false,
      reason: 'invalid_transition',
      targetStatus: 'rejected'
    });
  });

  it('reports no-op when the submission already has the target status', () => {
    expect(
      createProjectSubmissionReviewPlan(
        { ...submittedSubmission, status: 'approved' },
        {
          action: 'approve',
          adminEmail: 'admin@example.com'
        }
      )
    ).toEqual({
      shouldTransition: false,
      reason: 'already_in_target_state',
      targetStatus: 'approved'
    });
  });
});
