import { AdminProjectSubmissionsService } from './admin-project-submissions.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockProjectSubmissionsQuery {
  filters: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.filters.push({ method: 'select', args });
    return this;
  }

  order(...args: unknown[]) {
    this.filters.push({ method: 'order', args });
    return this;
  }

  range(...args: unknown[]) {
    this.filters.push({ method: 'range', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.filters.push({ method: 'eq', args });
    return this;
  }

  in(...args: unknown[]) {
    this.filters.push({ method: 'in', args });
    return this;
  }

  gt(...args: unknown[]) {
    this.filters.push({ method: 'gt', args });
    return this;
  }

  gte(...args: unknown[]) {
    this.filters.push({ method: 'gte', args });
    return this;
  }

  lt(...args: unknown[]) {
    this.filters.push({ method: 'lt', args });
    return this;
  }

  or(...args: unknown[]) {
    this.filters.push({ method: 'or', args });
    return this;
  }

  then(resolve: (value: QueryResult) => void) {
    resolve(this.result);
  }
}

class MockSupabaseAdmin {
  projectSubmissionsResult: QueryResult = { data: [], error: null, count: 0 };
  lastProjectSubmissionsQuery?: MockProjectSubmissionsQuery;

  from(tableName: string) {
    if (tableName !== 'project_submission_requests') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastProjectSubmissionsQuery = new MockProjectSubmissionsQuery(this.projectSubmissionsResult);
    return this.lastProjectSubmissionsQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

class MockReviewWorkflow {
  result = {
    status: 'updated',
    message: 'Project submission review writes completed.',
    requestId: 'psr-1'
  };
  reviewSubmission = jest.fn(async () => this.result);
}

describe('AdminProjectSubmissionsService', () => {
  let supabase: MockSupabase;
  let reviewWorkflow: MockReviewWorkflow;
  let service: AdminProjectSubmissionsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    reviewWorkflow = new MockReviewWorkflow();
    service = new AdminProjectSubmissionsService(supabase as never, reviewWorkflow as never);
  });

  it('lists project submissions with bounded pagination and duplicate annotations', async () => {
    supabase.admin.projectSubmissionsResult = {
      data: [
        {
          request_id: 'psr-2',
          request_number: 'PSR-0002',
          student_id: 'student-1',
          student_email: ' Student@Example.com ',
          student_name: 'Saurabh',
          project_id: 'project-1',
          project_title: 'Market Launch Plan',
          role_id: 'role-1',
          role_name: 'Marketing Analyst',
          program_key: 'mba',
          cohort_key: 'mba-june',
          cohort_name: 'MBA June',
          submission_link: 'https://example.com/submission-2',
          remarks: 'Second attempt',
          attempt_number: 2,
          submitted_at: '2026-06-26T02:00:00.000Z',
          status: 'submitted',
          raw_payload: 'should-not-be-selected'
        },
        {
          request_id: 'psr-1',
          request_number: 'PSR-0001',
          student_id: 'student-1',
          student_email: 'student@example.com',
          student_name: 'Saurabh',
          project_id: 'project-1',
          project_title: 'Market Launch Plan',
          role_id: 'role-1',
          role_name: 'Marketing Analyst',
          program_key: 'mba',
          cohort_key: 'mba-june',
          cohort_name: 'MBA June',
          submission_link: 'https://example.com/submission-1',
          remarks: 'First attempt',
          attempt_number: 1,
          submitted_at: '2026-06-25T02:00:00.000Z',
          status: 'under_review'
        }
      ],
      error: null,
      count: 2
    };

    const result = await service.listProjectSubmissions({ page: 1, limit: 25, status: 'pending' });

    expect(result.items[0]).toEqual({
      id: 'psr-2',
      requestNumber: 'PSR-0002',
      studentId: 'student-1',
      studentEmail: 'student@example.com',
      studentName: 'Saurabh',
      projectId: 'project-1',
      projectTitle: 'Market Launch Plan',
      roleId: 'role-1',
      roleName: 'Marketing Analyst',
      programKey: 'mba',
      cohortKey: 'mba-june',
      cohortName: 'MBA June',
      submissionLink: 'https://example.com/submission-2',
      remarks: 'Second attempt',
      attemptNumber: 2,
      isRepeatSubmission: true,
      previousRequestIds: ['psr-1'],
      previousRequestNumbers: ['PSR-0001'],
      duplicateGroupKey: 'student@example.com|mba-june',
      duplicateGroupCount: 2,
      submittedAt: '2026-06-26T02:00:00.000Z',
      status: 'submitted'
    });
    expect(result.total).toBe(2);
    expect(supabase.admin.lastProjectSubmissionsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['submitted_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] },
        { method: 'in', args: ['status', ['submitted', 'under_review']] }
      ])
    );
    expect(supabase.admin.lastProjectSubmissionsQuery?.filters[0]?.args[0]).not.toContain('raw_payload');
  });

  it('applies duplicate, role, program, cohort, date, and normalized search filters', async () => {
    await service.listProjectSubmissions({
      page: 2,
      limit: 10,
      status: 'duplicates',
      roleId: 'role-1',
      programKey: 'mba',
      cohortName: 'MBA June',
      submittedDate: '2026-06-26',
      search: ' Project Search '
    });

    expect(supabase.admin.lastProjectSubmissionsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'range', args: [10, 19] },
        { method: 'in', args: ['status', ['submitted', 'under_review']] },
        { method: 'gt', args: ['attempt_number', 1] },
        { method: 'eq', args: ['role_id', 'role-1'] },
        { method: 'eq', args: ['program_key', 'mba'] },
        { method: 'eq', args: ['cohort_name', 'MBA June'] },
        { method: 'gte', args: ['submitted_at', '2026-06-26T00:00:00Z'] },
        { method: 'lt', args: ['submitted_at', '2026-06-27T00:00:00.000Z'] },
        {
          method: 'or',
          args: [
            [
              'request_number.ilike.%project search%',
              'student_name.ilike.%project search%',
              'student_email.ilike.%project search%',
              'project_title.ilike.%project search%',
              'role_name.ilike.%project search%',
              'cohort_name.ilike.%project search%'
            ].join(',')
          ]
        }
      ])
    );
  });

  it('approves a project submission through the guarded review workflow', async () => {
    const result = await service.approveSubmission('psr-1', 'Admin@Example.com');

    expect(result).toEqual(reviewWorkflow.result);
    expect(reviewWorkflow.reviewSubmission).toHaveBeenCalledWith({
      requestId: 'psr-1',
      action: 'approve',
      adminEmail: 'Admin@Example.com',
      reviewNote: undefined
    });
  });

  it('rejects a project submission with a review note through the guarded review workflow', async () => {
    const result = await service.rejectSubmission('psr-2', 'Admin@Example.com', 'Needs correction');

    expect(result).toEqual(reviewWorkflow.result);
    expect(reviewWorkflow.reviewSubmission).toHaveBeenCalledWith({
      requestId: 'psr-2',
      action: 'reject',
      adminEmail: 'Admin@Example.com',
      reviewNote: 'Needs correction'
    });
  });
});
