import { AdminCertificatesService } from './admin-certificates.service';

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
  certificateRequestsResult: QueryResult = { data: [], error: null, count: 0 };
  lastCertificatesQuery?: MockCertificatesQuery;
  lastCertificateRequestsQuery?: MockCertificatesQuery;

  from(tableName: string) {
    if (tableName === 'certificates') {
      this.lastCertificatesQuery = new MockCertificatesQuery(this.certificatesResult);
      return this.lastCertificatesQuery;
    }

    if (tableName === 'certificate_requests') {
      this.lastCertificateRequestsQuery = new MockCertificatesQuery(this.certificateRequestsResult);
      return this.lastCertificateRequestsQuery;
    }

    throw new Error(`Unexpected table: ${tableName}`);
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminCertificatesService', () => {
  let supabase: MockSupabase;
  let service: AdminCertificatesService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminCertificatesService(supabase as never);
  });

  it('lists certificates with bounded pagination metadata', async () => {
    supabase.admin.certificatesResult = {
      data: [
        {
          id: 'certificate-uuid',
          certificate_id: 'SS-LP-2026-0001',
          certificate_type: 'live_project',
          student_email: ' Student@Example.com ',
          student_name: 'Saurabh',
          program_key: 'mclp',
          program_name: 'Management Consulting Leadership Program',
          cohort_name: 'Cohort A',
          project_id: 'project-1',
          project_title: 'Market Entry Strategy',
          issue_date: '2026-06-26',
          status: 'issued',
          generation_status: 'ready',
          issued_by: 'admin@example.com',
          created_at: '2026-06-26T00:00:00.000Z',
          updated_at: '2026-06-26T00:00:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listCertificates({ page: 1, limit: 25, status: 'all', generationStatus: 'all', certificateType: 'all' });

    expect(result.items[0]).toEqual({
      id: 'certificate-uuid',
      certificateId: 'SS-LP-2026-0001',
      certificateType: 'live_project',
      studentEmail: 'student@example.com',
      studentName: 'Saurabh',
      programKey: 'mclp',
      programName: 'Management Consulting Leadership Program',
      cohortName: 'Cohort A',
      projectId: 'project-1',
      projectTitle: 'Market Entry Strategy',
      issueDate: '2026-06-26',
      status: 'issued',
      generationStatus: 'ready',
      issuedBy: 'admin@example.com',
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T00:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastCertificatesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['issue_date', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
  });

  it('applies status, generation, type, and normalized search filters', async () => {
    await service.listCertificates({
      page: 1,
      limit: 10,
      status: 'issued',
      generationStatus: 'ready',
      certificateType: 'leadership',
      search: ' Saurabh Certificate '
    });

    expect(supabase.admin.lastCertificatesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'issued'] },
        { method: 'eq', args: ['generation_status', 'ready'] },
        { method: 'eq', args: ['certificate_type', 'leadership'] },
        {
          method: 'or',
          args: [
            [
              'certificate_id.ilike.%saurabh certificate%',
              'student_email.ilike.%saurabh certificate%',
              'student_name.ilike.%saurabh certificate%',
              'program_name.ilike.%saurabh certificate%',
              'project_title.ilike.%saurabh certificate%'
            ].join(',')
          ]
        }
      ])
    );
  });

  it('lists certificate requests with bounded pagination metadata', async () => {
    supabase.admin.certificateRequestsResult = {
      data: [
        {
          id: 'request-uuid',
          request_id: 'CERT-REQ-001',
          request_type: 'live_project',
          student_email: ' Student@Example.com ',
          student_name: 'Saurabh',
          project_id: 'project-1',
          project_title: 'Market Entry Strategy',
          project_role: 'Analyst',
          program_key: 'mclp',
          cohort_name: 'Cohort A',
          submitted_at: '2026-06-26T00:00:00.000Z',
          moderator_status: 'approved',
          moderator_email: 'moderator@example.com',
          moderator_reviewed_at: '2026-06-26T01:00:00.000Z',
          admin_status: 'pending',
          admin_email: null,
          admin_reviewed_at: null,
          created_at: '2026-06-26T00:00:00.000Z',
          updated_at: '2026-06-26T01:00:00.000Z',
          submission_token: 'should-not-be-selected'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listCertificateRequests({ page: 1, limit: 25, moderatorStatus: 'all', adminStatus: 'all' });

    expect(result.items[0]).toEqual({
      id: 'request-uuid',
      requestId: 'CERT-REQ-001',
      requestType: 'live_project',
      studentEmail: 'student@example.com',
      studentName: 'Saurabh',
      projectId: 'project-1',
      projectTitle: 'Market Entry Strategy',
      projectRole: 'Analyst',
      programKey: 'mclp',
      cohortName: 'Cohort A',
      submittedAt: '2026-06-26T00:00:00.000Z',
      moderatorStatus: 'approved',
      moderatorEmail: 'moderator@example.com',
      moderatorReviewedAt: '2026-06-26T01:00:00.000Z',
      adminStatus: 'pending',
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T01:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastCertificateRequestsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['submitted_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastCertificateRequestsQuery?.filters[0]?.args[0]).not.toContain('submission_token');
  });

  it('applies request review status and normalized search filters', async () => {
    await service.listCertificateRequests({
      page: 1,
      limit: 10,
      moderatorStatus: 'approved',
      adminStatus: 'pending',
      search: ' Saurabh Project '
    });

    expect(supabase.admin.lastCertificateRequestsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['moderator_status', 'approved'] },
        { method: 'eq', args: ['admin_status', 'pending'] },
        {
          method: 'or',
          args: [
            [
              'request_id.ilike.%saurabh project%',
              'student_email.ilike.%saurabh project%',
              'student_name.ilike.%saurabh project%',
              'project_id.ilike.%saurabh project%',
              'project_title.ilike.%saurabh project%'
            ].join(',')
          ]
        }
      ])
    );
  });
});
