import { CertificateRequestForApproval, createCertificateRequestApprovalPlan } from './certificate-request-approval-plan';

const request: CertificateRequestForApproval = {
  requestId: 'certificate_request:student@example.com:lp-123',
  requestType: 'live_project',
  studentEmail: ' Student@Example.com ',
  studentName: 'Student Name',
  projectId: 'lp-123',
  projectTitle: 'Market Research Project',
  projectRole: 'Research Analyst',
  programKey: 'mba',
  cohortName: 'MBA 2026',
  moderatorStatus: 'approved',
  adminStatus: 'pending'
};

describe('createCertificateRequestApprovalPlan', () => {
  it('plans admin approval with request update, generation job intent, and audit intent', () => {
    expect(
      createCertificateRequestApprovalPlan(request, {
        decision: 'approve',
        adminEmail: ' Admin@Example.com ',
        certificateId: 'SS-LP-2026-0001',
        decidedAt: '2026-06-27T10:00:00.000Z'
      })
    ).toEqual({
      shouldApply: true,
      reason: 'ready',
      idempotencyKey: 'certificate_request_review:certificate_request:student@example.com:lp-123:approved',
      requestUpdate: {
        request_id: 'certificate_request:student@example.com:lp-123',
        admin_status: 'approved',
        admin_email: 'admin@example.com',
        admin_reviewed_at: '2026-06-27T10:00:00.000Z',
        updated_at: '2026-06-27T10:00:00.000Z'
      },
      generationJob: {
        idempotency_key: 'certificate_generation:certificate_request:student@example.com:lp-123',
        request_id: 'certificate_request:student@example.com:lp-123',
        certificate_id: 'SS-LP-2026-0001',
        certificate_type: 'live_project',
        status: 'pending',
        requested_by: 'admin@example.com',
        requested_at: '2026-06-27T10:00:00.000Z',
        payload: {
          studentEmail: 'student@example.com',
          studentName: 'Student Name',
          projectId: 'lp-123',
          projectTitle: 'Market Research Project',
          projectRole: 'Research Analyst',
          programKey: 'mba',
          cohortName: 'MBA 2026'
        }
      },
      auditEvent: {
        idempotency_key: 'audit:certificate_request_review:certificate_request:student@example.com:lp-123:approved',
        action: 'certificate_request.approved',
        entity: 'certificate_requests',
        entity_id: 'certificate_request:student@example.com:lp-123',
        actor_id: 'admin@example.com',
        previous_state: {
          moderatorStatus: 'approved',
          adminStatus: 'pending'
        },
        next_state: {
          adminStatus: 'approved',
          certificateId: 'SS-LP-2026-0001'
        }
      }
    });
  });

  it('plans admin rejection without creating a generation job', () => {
    expect(
      createCertificateRequestApprovalPlan(request, {
        decision: 'reject',
        adminEmail: 'admin@example.com',
        note: 'Project evidence does not match certificate requirements.',
        decidedAt: '2026-06-27T10:05:00.000Z'
      })
    ).toMatchObject({
      shouldApply: true,
      reason: 'ready',
      requestUpdate: {
        admin_status: 'rejected',
        admin_email: 'admin@example.com'
      },
      generationJob: undefined,
      auditEvent: {
        action: 'certificate_request.rejected',
        next_state: {
          adminStatus: 'rejected',
          note: 'Project evidence does not match certificate requirements.'
        }
      }
    });
  });

  it('blocks missing admin identity', () => {
    expect(createCertificateRequestApprovalPlan(request, { decision: 'approve', adminEmail: ' ' })).toEqual({
      shouldApply: false,
      reason: 'missing_admin'
    });
  });

  it('blocks approval before moderator approval', () => {
    expect(
      createCertificateRequestApprovalPlan({ ...request, moderatorStatus: 'pending' }, { decision: 'approve', adminEmail: 'admin@example.com' })
    ).toEqual({
      shouldApply: false,
      reason: 'moderator_not_approved'
    });
  });

  it('blocks already finalized admin states', () => {
    expect(createCertificateRequestApprovalPlan({ ...request, adminStatus: 'issued' }, { decision: 'reject', adminEmail: 'admin@example.com', note: 'No' })).toEqual({
      shouldApply: false,
      reason: 'already_final'
    });
  });

  it('requires a rejection note', () => {
    expect(createCertificateRequestApprovalPlan(request, { decision: 'reject', adminEmail: 'admin@example.com', note: ' ' })).toEqual({
      shouldApply: false,
      reason: 'missing_rejection_note'
    });
  });
});
