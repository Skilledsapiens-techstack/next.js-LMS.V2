import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { CertificateGenerationLoader } from './certificate-generation.loader';

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
 }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
 }

  maybeSingle() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.result);
 }
}

class MockSupabaseAdmin {
  results = new Map<string, QueryResult>([
    [
      'certificate_generation_jobs',
      {
        data: {
          idempotency_key: 'certificate_generation:certificate_request:student@example.com:lp-123',
          request_id: 'certificate_request:student@example.com:lp-123',
          certificate_id: 'SS-LP-2026-0001',
          certificate_type: 'live_project',
          status: 'generating',
          requested_by: 'admin@example.com',
          payload: {
            studentEmail: ' Student@Example.com ',
            studentName: 'Student Name',
            projectId: 'lp-123',
            projectTitle: 'Market Research Project',
            projectRole: 'Research Analyst',
            programKey: 'mba',
            programName: 'MBA',
            cohortName: 'MBA 2026'
         }
       },
        error: null
     }
    ]
  ]);
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.results.get(table) ?? { data: null, error: null });
    this.queries.push({ table, query });
    return query;
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('CertificateGenerationLoader', () => {
  it('loads a generation job into a finalization plan', async () => {
    const supabase = new MockSupabase();
    const loader = new CertificateGenerationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        jobIdempotencyKey: ' certificate_generation:certificate_request:student@example.com:lp-123 ',
        workerId: ' certificate-worker ',
        generatedAt: '2026-06-27T10:00:00.000Z',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Certificate generation finalization plan loaded.',
      plan: {
        shouldFinalize: true,
        reason: 'ready',
        certificateRow: {
          certificate_id: 'SS-LP-2026-0001',
          student_email: 'student@example.com',
          pdf_storage_bucket: 'certificates-private',
          pdf_storage_path: 'live-project/SS-LP-2026-0001.pdf'
       },
        jobUpdate: {
          idempotency_key: 'certificate_generation:certificate_request:student@example.com:lp-123',
          status: 'ready'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificate_generation_jobs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['idempotency_key', 'certificate_generation:certificate_request:student@example.com:lp-123'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new CertificateGenerationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        jobIdempotencyKey: ' ',
        workerId: ' ',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Certificate generation job idempotency key and worker ID are required to load a finalization plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the generation job does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('certificate_generation_jobs', { data: null, error: null });
    const loader = new CertificateGenerationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        jobIdempotencyKey: 'missing-job',
        workerId: 'certificate-worker',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No certificate generation job matched the finalization source identity.'
   });
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('certificate_generation_jobs', { data: null, error: { message: 'generation job query failed' } });
    const loader = new CertificateGenerationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        jobIdempotencyKey: 'certificate_generation:certificate_request:student@example.com:lp-123',
        workerId: 'certificate-worker',
        storageBucket: 'certificates-private',
        storagePath: 'live-project/SS-LP-2026-0001.pdf',
        pdfSha256: 'abc123'
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
