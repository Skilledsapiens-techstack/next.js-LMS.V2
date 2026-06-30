export type ProjectSubmissionStudent = {
  id?: string;
  email: string;
  fullName?: string;
  cohortName?: string;
};

export type ProjectSubmissionProject = {
  projectId: string;
  title: string;
  roleId?: string;
  roleName?: string;
  programKey?: string;
  programKeys: string[];
  cohortKey?: string;
  cohortName?: string;
  visibleToStudent: boolean;
  maxAttempts?: number;
};

export type ProjectSubmissionInput = {
  submissionLink: string;
  remarks?: string;
};

export type ExistingProjectSubmission = {
  requestId: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  attemptNumber: number;
};

export type ProjectSubmissionPlan = {
  shouldCreate: boolean;
  reason: 'ready' | 'project_not_visible' | 'missing_submission_link' | 'invalid_submission_link' | 'attempt_limit_reached';
  idempotencyKey?: string;
  requestNumber?: string;
  nextAttemptNumber?: number;
  projectSubmissionRow?: {
    request_id: string;
    request_number: string;
    student_id?: string;
    student_email: string;
    student_name?: string;
    project_id: string;
    project_title: string;
    role_id?: string;
    role_name?: string;
    program_key?: string;
    cohort_key?: string;
    cohort_name?: string;
    submission_link: string;
    remarks?: string;
    attempt_number: number;
    status: 'submitted';
    idempotency_key: string;
  };
  studentLimitRow?: {
    idempotency_key: string;
    student_email: string;
    project_id: string;
    attempt_count: number;
    last_request_id: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'project_submission.created';
    entity: 'project_submission_requests';
  };
};

export function createProjectSubmissionPlan(
  student: ProjectSubmissionStudent,
  project: ProjectSubmissionProject,
  input: ProjectSubmissionInput,
  existingSubmissions: ExistingProjectSubmission[]
): ProjectSubmissionPlan {
  const studentEmail = normalizeEmail(student.email);
  const submissionLink = cleanText(input.submissionLink);

  if (!project.visibleToStudent) {
    return { shouldCreate: false, reason: 'project_not_visible' };
  }

  if (!submissionLink) {
    return { shouldCreate: false, reason: 'missing_submission_link' };
  }

  if (!isValidSubmissionUrl(submissionLink)) {
    return { shouldCreate: false, reason: 'invalid_submission_link' };
  }

  const nextAttemptNumber = nextAttempt(existingSubmissions);
  const maxAttempts = project.maxAttempts ?? 3;

  if (nextAttemptNumber > maxAttempts) {
    return { shouldCreate: false, reason: 'attempt_limit_reached' };
  }

  const projectKey = cleanText(project.projectId) ?? 'project';
  const idempotencyKey = `project_submission:${studentEmail}:${projectKey}:attempt:${nextAttemptNumber}`;
  const requestNumber = `PS-${slugify(projectKey)}-${slugify(studentEmail)}-${String(nextAttemptNumber).padStart(2, '0')}`;
  const remarks = cleanText(input.remarks);

  return {
    shouldCreate: true,
    reason: 'ready',
    idempotencyKey,
    requestNumber,
    nextAttemptNumber,
    projectSubmissionRow: {
      request_id: idempotencyKey,
      request_number: requestNumber,
      student_id: cleanText(student.id),
      student_email: studentEmail,
      student_name: cleanText(student.fullName),
      project_id: projectKey,
      project_title: project.title,
      role_id: cleanText(project.roleId),
      role_name: cleanText(project.roleName),
      program_key: cleanText(project.programKey ?? project.programKeys[0]),
      cohort_key: cleanText(project.cohortKey),
      cohort_name: cleanText(project.cohortName ?? student.cohortName),
      submission_link: submissionLink,
      remarks,
      attempt_number: nextAttemptNumber,
      status: 'submitted',
      idempotency_key: idempotencyKey
    },
    studentLimitRow: {
      idempotency_key: `project_submission_limit:${studentEmail}:${projectKey}`,
      student_email: studentEmail,
      project_id: projectKey,
      attempt_count: nextAttemptNumber,
      last_request_id: idempotencyKey
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}:project_submission.created`,
      action: 'project_submission.created',
      entity: 'project_submission_requests'
    }
  };
}

function nextAttempt(existingSubmissions: ExistingProjectSubmission[]): number {
  const maxAttempt = existingSubmissions.reduce((max, item) => Math.max(max, Number.isFinite(item.attemptNumber) ? item.attemptNumber : 0), 0);
  return maxAttempt + 1;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function isValidSubmissionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
