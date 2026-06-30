import { CertificateGenerationJob } from './certificate-generation-plan';
import { CertificatePdfRenderExecutor } from './certificate-pdf-render.executor';
import { createCertificatePdfRenderPlan } from './certificate-pdf-render-plan';

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

const job: CertificateGenerationJob = {
  idempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
  requestId: 'certificate_request:student@example.com:lp-123',
  certificateId: 'SS-LP-2026-0001',
  certificateType: 'live_project',
  status: 'pending',
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
  return createCertificatePdfRenderPlan(job, {
    workerId: 'certificate-worker',
    renderStartedAt: '2026-06-27T10:00:00.000Z',
    storageBucket: 'certificates-private',
    storagePath: 'live-project/SS-LP-2026-0001.pdf'
  });
}

describe('CertificatePdfRenderExecutor', () => {
  it('does not call Supabase when certificate PDF render-start writes are disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificatePdfRenderExecutor(
      new MockConfigService({ CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED: false }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
      message: 'Certificate PDF render-start writes are disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe render-start plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificatePdfRenderExecutor(
      new MockConfigService({ CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED: true }) as never,
      supabase as never
    );
    const plan = createCertificatePdfRenderPlan({ ...job, status: 'ready' }, { workerId: 'certificate-worker' });

    await expect(executor.execute(plan)).resolves.toMatchObject({
      enabled: true,
      attempted: false,
      status: 'skipped',
      message: 'Certificate PDF render-start skipped: invalid_job_status.'
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs generation job and audit writes when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new CertificatePdfRenderExecutor(
      new MockConfigService({ CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'updated',
      jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
      completedSteps: ['certificate_generation_jobs', 'audit_logs']
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificate_generation_jobs', 'audit_logs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      {
        method: 'update',
        args: [
          {
            status: 'generating',
            worker_id: 'certificate-worker',
            started_at: '2026-06-27T10:00:00.000Z',
            updated_at: '2026-06-27T10:00:00.000Z'
          }
        ]
      },
      {
        method: 'eq',
        args: ['idempotency_key', 'certificate_generation:certificate_request:student@example.com:lp-123']
      }
    ]);
    expect(supabase.admin.queries[1]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.objectContaining({
          actor_type: 'system',
          actor_id: 'certificate-worker',
          entity_table: 'certificate_generation_jobs',
          entity_id: 'certificate_generation:certificate_request:student@example.com:lp-123',
          action: 'certificate.render_started'
        }),
        { onConflict: 'idempotency_key' }
      ]
    });
  });

  it('stops at the failed render-start step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('audit_logs', { data: null, error: { message: 'audit write failed' } });
    const executor = new CertificatePdfRenderExecutor(
      new MockConfigService({ CERTIFICATE_PDF_RENDER_START_WRITES_ENABLED: true }) as never,
      supabase as never
    );

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
      message: 'audit write failed',
      completedSteps: ['certificate_generation_jobs'],
      failedStep: 'audit_logs'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificate_generation_jobs', 'audit_logs']);
  });
});
