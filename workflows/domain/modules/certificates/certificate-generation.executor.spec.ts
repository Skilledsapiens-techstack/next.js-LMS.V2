import { CertificateGenerationExecutor } from './certificate-generation.executor';
import { CertificateGenerationJob, createCertificateGenerationPlan } from './certificate-generation-plan';

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

  upsert(...args: unknown[]) {
    this.calls.push({ method: 'upsert', args });
    return Promise.resolve(this.result);
  }

  update(...args: unknown[]) {
    this.calls.push({ method: 'update', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
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

const job: CertificateGenerationJob = {
  idempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
  requestId: 'certificate_request:student@example.com:lp-123',
  certificateId: 'SS-LP-2026-0001',
  certificateType: 'live_project',
  status: 'generating',
  requestedBy: 'admin@example.com',
  payload: {
    studentEmail: 'student@example.com',
    studentName: 'Student Name',
    projectId: 'lp-123',
    projectTitle: 'Market Research Project',
    projectRole: 'Research Analyst',
    programKey: 'mba',
    programName: 'MBA',
    cohortName: 'MBA 2026'
  }
};

function readyPlan() {
  return createCertificateGenerationPlan(job, {
    workerId: 'certificate-worker',
    generatedAt: '2026-06-27T10:00:00.000Z',
    storageBucket: 'certificates-private',
    storagePath: 'live-project/SS-LP-2026-0001.pdf',
    pdfSha256: 'abc123'
  });
}

describe('CertificateGenerationExecutor', () => {
  it('does not call Supabase when certificate finalization writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificateGenerationExecutor(
      new MockConfigService({ CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      certificateId: 'SS-LP-2026-0001',
      message: 'Certificate generation finalization writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe finalization plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificateGenerationExecutor(
      new MockConfigService({ CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createCertificateGenerationPlan(
      { ...job, status: 'ready' },
      {
        workerId: 'certificate-worker',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
      }
    );

    await expect(executor.execute(plan)).resolves.toMatchObject({
      enabled: true,
      attempted: false,
      status: 'skipped',
      message: 'Certificate generation finalization skipped: invalid_job_status.'
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs certificate, generation job, and audit writes when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificateGenerationExecutor(
      new MockConfigService({ CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'updated',
      certificateId: 'SS-LP-2026-0001',
      completedSteps: ['certificates', 'certificate_generation_jobs', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificates', 'certificate_generation_jobs', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          certificate_id: 'SS-LP-2026-0001',
          student_email: 'student@example.com',
          pdf_storage_bucket: 'certificates-private',
          pdf_storage_path: 'live-project/SS-LP-2026-0001.pdf'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
    expect(supabase.admin.queries[1]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'ready',
            completed_at: '2026-06-27T10:00:00.000Z',
            storage_bucket: 'certificates-private',
            storage_path: 'live-project/SS-LP-2026-0001.pdf',
            pdf_sha256: 'abc123',
            updated_at: '2026-06-27T10:00:00.000Z'
          }
        ]
      },
      {
        method: 'eq',
        args: ['idempotency_key', 'certificate_generation:certificate_request:student@example.com:lp-123']
      }
    ]);
    expect(supabase.admin.queries[2]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'system',
          actor_id: 'certificate-worker',
          entity_table: 'certificates',
          entity_id: 'SS-LP-2026-0001',
          action: 'certificate.generated'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed finalization step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('certificate_generation_jobs', { data: null, error: { message: 'generation job update failed' } });
    const executor = new CertificateGenerationExecutor(
      new MockConfigService({ CERTIFICATE_GENERATION_FINALIZATION_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      certificateId: 'SS-LP-2026-0001',
      message: 'generation job update failed',
      completedSteps: ['certificates'],
      failedStep: 'certificate_generation_jobs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificates', 'certificate_generation_jobs']);
  });
});
