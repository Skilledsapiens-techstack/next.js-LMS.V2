import { User } from '@supabase/supabase-js';
import { StudentProjectSubmissionsService } from './student-project-submissions.service';

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

class MockStudentsService {
  getCurrentStudent = jest.fn().mockResolvedValue({
    id: 'student-uuid',
    fullName: 'Student One',
    email: ' Student@Example.com ',
    trackRoleIds: [],
    active: true
  });
}

function createUser(): User {
  return {
    id: 'auth-user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date('2026-06-26T00:00:00.000Z').toISOString(),
    email: 'student@example.com'
  };
}

describe('StudentProjectSubmissionsService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentProjectSubmissionsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentProjectSubmissionsService(supabase as never, studentsService as never);
  });

  it('lists only the authenticated student project submissions with bounded pagination', async () => {
    supabase.admin.projectSubmissionsResult = {
      data: [
        {
          request_id: 'psr-1',
          request_number: 'PSR-0001',
          student_email: 'student@example.com',
          student_name: 'should-not-be-selected',
          project_id: 'project-1',
          project_title: 'Market Launch Plan',
          role_id: 'role-1',
          role_name: 'Marketing Analyst',
          program_key: 'mba',
          cohort_key: 'mba-june',
          cohort_name: 'MBA June',
          submission_link: 'https://example.com/report',
          remarks: 'Submitted for review',
          attempt_number: '2',
          submitted_at: '2026-06-26T02:00:00.000Z',
          status: 'under_review',
          raw_payload: 'should-not-be-selected'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listMyProjectSubmissions(createUser(), { page: 1, limit: 25, status: 'all' });

    expect(result.items[0]).toEqual({
      id: 'psr-1',
      requestNumber: 'PSR-0001',
      projectId: 'project-1',
      projectTitle: 'Market Launch Plan',
      roleId: 'role-1',
      roleName: 'Marketing Analyst',
      programKey: 'mba',
      cohortKey: 'mba-june',
      cohortName: 'MBA June',
      submissionLink: 'https://example.com/report',
      remarks: 'Submitted for review',
      attemptNumber: 2,
      isRepeatSubmission: true,
      submittedAt: '2026-06-26T02:00:00.000Z',
      status: 'under_review'
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty('studentEmail');
    expect(result.items[0]).not.toHaveProperty('studentName');
    expect(supabase.admin.lastProjectSubmissionsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'order', args: ['submitted_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastProjectSubmissionsQuery?.filters[0]?.args[0]).not.toContain('raw_payload');
    expect(supabase.admin.lastProjectSubmissionsQuery?.filters[0]?.args[0]).not.toContain('student_name');
  });

  it('applies student-safe status, program, cohort, and search filters', async () => {
    await service.listMyProjectSubmissions(createUser(), {
      page: 2,
      limit: 10,
      status: 'approved',
      programKey: 'mba',
      cohortName: 'MBA June',
      search: ' Market Plan '
    });

    expect(supabase.admin.lastProjectSubmissionsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'eq', args: ['status', 'approved'] },
        { method: 'eq', args: ['program_key', 'mba'] },
        { method: 'eq', args: ['cohort_name', 'MBA June'] },
        {
          method: 'or',
          args: [
            [
              'request_number.ilike.%market plan%',
              'project_title.ilike.%market plan%',
              'role_name.ilike.%market plan%',
              'cohort_name.ilike.%market plan%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });
});
