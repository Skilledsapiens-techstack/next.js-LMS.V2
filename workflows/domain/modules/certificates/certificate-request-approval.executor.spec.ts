import { CertificateRequestApprovalExecutor } from './certificate-request-approval.executor';
import { CertificateRequestForApproval, createCertificateRequestApprovalPlan } from './certificate-request-approval-plan';

class MockConfigService {
  constructor(private readonly values: Record<string, boolean | undefined>) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  update(...args: unknown[]) {
    this.calls.push({ method: 'update', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return Promise.resolve(this.result);
  }

  upsert(...args: unknown[]) {
    this.calls.push({ method: 'upsert', args });
    return Promise.resolve(this.result);
  }
}

class MockSupabaseAdmin {
  tableResults = new Map<string, QueryResult>();
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.tableResults.get(table) ?? { data: {}, error: null });
    this.queries.push({ table, query });
    return query;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

const request: CertificateRequestForApproval = {
  requestId: 'certificate_request:student@example.com:lp-123',
  requestType: 'live_project',
  studentEmail: 'student@example.com',
  studentName: 'Student Name',
  projectId: 'lp-123',
  projectTitle: 'Market Research Project',
  projectRole: 'Research Analyst',
  programKey: 'mba',
  cohortName: 'MBA 2026',
  moderatorStatus: 'approved',
  adminStatus: 'pending'
};

function approvalPlan() {
  return createCertificateRequestApprovalPlan(request, {
    decision: 'approve',
    adminEmail: 'admin@example.com',
    certificateId: 'SS-LP-2026-0001',
    decidedAt: '2026-06-27T10:00:00.000Z'
  });
}

function rejectionPlan() {
  return createCertificateRequestApprovalPlan(request, {
    decision: 'reject',
    adminEmail: 'admin@example.com',
    note: 'Evidence does not meet certificate requirements.',
    decidedAt: '2026-06-27T10:05:00.000Z'
  });
}

describe('CertificateRequestApprovalExecutor', () => {
  it('does not call Supabase when certificate approval writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificateRequestApprovalExecutor(
      new MockConfigService({ CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(approvalPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      requestId: 'certificate_request:student@example.com:lp-123',
      message: 'Certificate request approval writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe approval plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificateRequestApprovalExecutor(
      new MockConfigService({ CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createCertificateRequestApprovalPlan({ ...request, moderatorStatus: 'pending' }, { decision: 'approve', adminEmail: 'admin@example.com' });

    await expect(executor.execute(plan)).resolves.toMatchObject({
      enabled: true,
      attempted: false,
      status: 'skipped',
      message: 'Certificate request approval skipped: moderator_not_approved.'
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs request update, generation job, and audit writes for approvals when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificateRequestApprovalExecutor(
      new MockConfigService({ CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(approvalPlan())).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'updated',
      requestId: 'certificate_request:student@example.com:lp-123',
      completedSteps: ['certificate_requests', 'certificate_generation_jobs', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificate_requests', 'certificate_generation_jobs', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            admin_status: 'approved',
            admin_email: 'admin@example.com',
            admin_reviewed_at: '2026-06-27T10:00:00.000Z',
            updated_at: '2026-06-27T10:00:00.000Z'
          }
        ]
      },
      {
        method: 'eq',
        args: ['request_id', 'certificate_request:student@example.com:lp-123']
      }
    ]);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          idempotency_key: 'certificate_generation:certificate_request:student@example.com:lp-123',
          request_id: 'certificate_request:student@example.com:lp-123',
          certificate_id: 'SS-LP-2026-0001',
          status: 'pending',
          requested_by: 'admin@example.com'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
    expect(supabase.admin.queries[2]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'admin',
          actor_id: 'admin@example.com',
          entity_table: 'certificate_requests',
          entity_id: 'certificate_request:student@example.com:lp-123',
          action: 'certificate_request.approved'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('runs request update and audit writes for rejections when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificateRequestApprovalExecutor(
      new MockConfigService({ CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(rejectionPlan())).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'updated',
      requestId: 'certificate_request:student@example.com:lp-123',
      completedSteps: ['certificate_requests', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificate_requests', 'audit_logs']);
  });

  it('stops at the failed approval step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('certificate_generation_jobs', { data: null, error: { message: 'generation job write failed' } });
    const executor = new CertificateRequestApprovalExecutor(
      new MockConfigService({ CERTIFICATE_REQUEST_APPROVAL_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(approvalPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      requestId: 'certificate_request:student@example.com:lp-123',
      message: 'generation job write failed',
      completedSteps: ['certificate_requests'],
      failedStep: 'certificate_generation_jobs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificate_requests', 'certificate_generation_jobs']);
  });
});
