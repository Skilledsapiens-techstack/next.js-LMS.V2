import { User } from '@supabase/supabase-js';
import { StudentCertificatesService } from './student-certificates.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockCertificatesQuery {
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

  neq(...args: unknown[]) {
    this.filters.push({ method: 'neq', args });
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
  certificatesResult: QueryResult = { data: [], error: null, count: 0 };
  lastCertificatesQuery?: MockCertificatesQuery;

  from(tableName: string) {
    if (tableName !== 'certificates') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastCertificatesQuery = new MockCertificatesQuery(this.certificatesResult);
    return this.lastCertificatesQuery;
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

describe('StudentCertificatesService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentCertificatesService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentCertificatesService(supabase as never, studentsService as never);
  });

  it('lists only authenticated student non-revoked certificates with bounded pagination', async () => {
    supabase.admin.certificatesResult = {
      data: [
        {
          id: 'certificate-uuid',
          certificate_id: 'SS-LP-2026-0001',
          certificate_type: 'live_project',
          student_email: 'student@example.com',
          student_name: 'should-not-be-selected',
          program_key: 'mba',
          program_name: 'MBA Program',
          cohort_name: 'MBA June',
          project_id: 'project-1',
          project_title: 'Market Launch Plan',
          issue_date: '2026-06-26',
          status: 'issued',
          generation_status: 'ready',
          created_at: '2026-06-26T00:00:00.000Z',
          updated_at: '2026-06-26T01:00:00.000Z',
          pdf_storage_path: 'should-not-be-selected'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listMyCertificates(createUser(), {
      page: 1,
      limit: 25,
      status: 'all',
      generationStatus: 'all',
      certificateType: 'all'
    });

    expect(result.items[0]).toEqual({
      id: 'certificate-uuid',
      certificateId: 'SS-LP-2026-0001',
      certificateType: 'live_project',
      programKey: 'mba',
      programName: 'MBA Program',
      cohortName: 'MBA June',
      projectId: 'project-1',
      projectTitle: 'Market Launch Plan',
      issueDate: '2026-06-26',
      status: 'issued',
      generationStatus: 'ready',
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T01:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty('studentEmail');
    expect(result.items[0]).not.toHaveProperty('studentName');
    expect(supabase.admin.lastCertificatesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'neq', args: ['status', 'revoked'] },
        { method: 'order', args: ['issue_date', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastCertificatesQuery?.filters[0]?.args[0]).not.toContain('pdf_storage_path');
    expect(supabase.admin.lastCertificatesQuery?.filters[0]?.args[0]).not.toContain('student_name');
  });

  it('applies student-safe status, generation, type, and search filters', async () => {
    await service.listMyCertificates(createUser(), {
      page: 2,
      limit: 10,
      status: 'issued',
      generationStatus: 'ready',
      certificateType: 'live_project',
      search: ' Market Certificate '
    });

    expect(supabase.admin.lastCertificatesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'neq', args: ['status', 'revoked'] },
        { method: 'eq', args: ['status', 'issued'] },
        { method: 'eq', args: ['generation_status', 'ready'] },
        { method: 'eq', args: ['certificate_type', 'live_project'] },
        {
          method: 'or',
          args: [
            [
              'certificate_id.ilike.%market certificate%',
              'program_name.ilike.%market certificate%',
              'cohort_name.ilike.%market certificate%',
              'project_title.ilike.%market certificate%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });
});
