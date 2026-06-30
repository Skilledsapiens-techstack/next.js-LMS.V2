import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { CertificateRequestApprovalLoader } from './certificate-request-approval.loader';

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
      'certificate_requests',
      {
        data: {
          request_id: 'certificate_request:student@example.com:lp-123',
          request_type: 'live_project',
          student_email: ' Student@Example.com ',
          student_name: 'Student Name',
          project_id: 'lp-123',
          project_title: 'Market Research Project',
          project_role: 'Research Analyst',
          program_key: 'mba',
          cohort_name: 'MBA 2026',
          moderator_status: 'approved',
          admin_status: 'pending'
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

describe('CertificateRequestApprovalLoader', () => {
  it('loads a certificate request into an approval plan', async () => {
    const supabase = new MockSupabase();
    const loader = new CertificateRequestApprovalLoader(supabase as never);

    await expect(
      loader.loadPlan({
        requestId: ' certificate_request:student@example.com:lp-123 ',
        decision: 'approve',
        adminEmail: ' Admin@Example.com ',
        certificateId: 'SS-LP-2026-0001',
        decidedAt: '2026-06-27T10:00:00.000Z'
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Certificate request approval plan loaded.',
      plan: {
        shouldApply: true,
        reason: 'ready',
        requestUpdate: {
          request_id: 'certificate_request:student@example.com:lp-123',
          admin_status: 'approved',
          admin_email: 'admin@example.com'
       },
        generationJob: {
          request_id: 'certificate_request:student@example.com:lp-123',
          certificate_id: 'SS-LP-2026-0001',
          payload: {
            studentEmail: 'student@example.com',
            projectId: 'lp-123'
         }
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificate_requests']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['request_id', 'certificate_request:student@example.com:lp-123'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new CertificateRequestApprovalLoader(supabase as never);

    await expect(
      loader.loadPlan({
        requestId: ' ',
        decision: 'approve',
        adminEmail: ' '
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Certificate request ID and admin email are required to load an approval plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the certificate request does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('certificate_requests', { data: null, error: null });
    const loader = new CertificateRequestApprovalLoader(supabase as never);

    await expect(
      loader.loadPlan({
        requestId: 'missing-request',
        decision: 'approve',
        adminEmail: 'admin@example.com'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No certificate request matched the approval source identity.'
   });
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('certificate_requests', { data: null, error: { message: 'certificate request query failed' } });
    const loader = new CertificateRequestApprovalLoader(supabase as never);

    await expect(
      loader.loadPlan({
        requestId: 'certificate_request:student@example.com:lp-123',
        decision: 'approve',
        adminEmail: 'admin@example.com'
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
