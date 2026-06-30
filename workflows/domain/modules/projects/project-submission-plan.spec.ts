import { createProjectSubmissionPlan, ProjectSubmissionProject, ProjectSubmissionStudent } from './project-submission-plan';

const student: ProjectSubmissionStudent = {
  id: 'student-uuid',
  email: ' Student@Example.com ',
  fullName: 'Student Name',
  cohortName: 'MBA June'
};

const project: ProjectSubmissionProject = {
  projectId: 'proj_123',
  title: 'Market Research Sprint',
  roleId: 'marketing',
  roleName: 'Marketing Intern',
  programKey: 'mba',
  programKeys: ['mba'],
  cohortKey: 'mba-june',
  cohortName: 'MBA June',
  visibleToStudent: true,
  maxAttempts: 3
};

describe('createProjectSubmissionPlan', () => {
  it('creates a deterministic project submission write plan', () => {
    const plan = createProjectSubmissionPlan(student, project, { submissionLink: 'https://example.com/submission', remarks: ' First attempt ' }, []);

    expect(plan).toEqual({
      shouldCreate: true,
      reason: 'ready',
      idempotencyKey: 'project_submission:student@example.com:proj_123:attempt:1',
      requestNumber: 'PS-proj-123-student-example-com-01',
      nextAttemptNumber: 1,
      projectSubmissionRow: {
        request_id: 'project_submission:student@example.com:proj_123:attempt:1',
        request_number: 'PS-proj-123-student-example-com-01',
        student_id: 'student-uuid',
        student_email: 'student@example.com',
        student_name: 'Student Name',
        project_id: 'proj_123',
        project_title: 'Market Research Sprint',
        role_id: 'marketing',
        role_name: 'Marketing Intern',
        program_key: 'mba',
        cohort_key: 'mba-june',
        cohort_name: 'MBA June',
        submission_link: 'https://example.com/submission',
        remarks: 'First attempt',
        attempt_number: 1,
        status: 'submitted',
        idempotency_key: 'project_submission:student@example.com:proj_123:attempt:1'
      },
      studentLimitRow: {
        idempotency_key: 'project_submission_limit:student@example.com:proj_123',
        student_email: 'student@example.com',
        project_id: 'proj_123',
        attempt_count: 1,
        last_request_id: 'project_submission:student@example.com:proj_123:attempt:1'
      },
      auditEvent: {
        idempotency_key: 'audit:project_submission:student@example.com:proj_123:attempt:1:project_submission.created',
        action: 'project_submission.created',
        entity: 'project_submission_requests'
      }
    });
  });

  it('computes the next attempt from existing submissions', () => {
    expect(
      createProjectSubmissionPlan(student, project, { submissionLink: 'https://example.com/submission' }, [
        { requestId: 'old_1', status: 'rejected', attemptNumber: 1 },
        { requestId: 'old_2', status: 'submitted', attemptNumber: 2 }
      ])
    ).toMatchObject({
      shouldCreate: true,
      nextAttemptNumber: 3,
      idempotencyKey: 'project_submission:student@example.com:proj_123:attempt:3'
    });
  });

  it('refuses projects that are not visible to the student', () => {
    expect(createProjectSubmissionPlan(student, { ...project, visibleToStudent: false }, { submissionLink: 'https://example.com/submission' }, [])).toEqual({
      shouldCreate: false,
      reason: 'project_not_visible'
    });
  });

  it('requires a secure submission link', () => {
    expect(createProjectSubmissionPlan(student, project, { submissionLink: '' }, [])).toEqual({
      shouldCreate: false,
      reason: 'missing_submission_link'
    });
    expect(createProjectSubmissionPlan(student, project, { submissionLink: 'http://example.com/submission' }, [])).toEqual({
      shouldCreate: false,
      reason: 'invalid_submission_link'
    });
  });

  it('enforces attempt limits', () => {
    expect(
      createProjectSubmissionPlan(student, { ...project, maxAttempts: 2 }, { submissionLink: 'https://example.com/submission' }, [
        { requestId: 'old_1', status: 'rejected', attemptNumber: 1 },
        { requestId: 'old_2', status: 'submitted', attemptNumber: 2 }
      ])
    ).toEqual({
      shouldCreate: false,
      reason: 'attempt_limit_reached'
    });
  });
});
