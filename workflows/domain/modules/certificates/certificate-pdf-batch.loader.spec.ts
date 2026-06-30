import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { CertificatePdfBatchLoader } from './certificate-pdf-batch.loader';

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
 }

  in(...args: unknown[]) {
    this.calls.push({ method: 'in', args });
    return this;
 }

  order(...args: unknown[]) {
    this.calls.push({ method: 'order', args });
    return this;
 }

  limit(...args: unknown[]) {
    this.calls.push({ method: 'limit', args });
    return Promise.resolve(this.result);
 }
}

class MockSupabaseAdmin {
  result: QueryResult = {
    data: [
      { idempotency_key: 'cert-pending-1', status: 'pending', updated_at: '2026-06-27T09:58:00.000Z' },
      { idempotency_key: 'cert-stale-generating', status: 'generating', updated_at: '2026-06-27T09:00:00.000Z' },
      { idempotency_key: 'cert-active-generating', status: 'generating', updated_at: '2026-06-27T09:50:00.000Z' },
      { idempotency_key: 'cert-ready', status: 'ready', updated_at: '2026-06-27T09:00:00.000Z' }
    ],
    error: null
 };
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.result);
    this.queries.push({ table, query });
    return query;
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('CertificatePdfBatchLoader', () => {
  it('loads bounded pending and stale-generating certificate PDF job keys', async () => {
    const supabase = new MockSupabase();
    const loader = new CertificatePdfBatchLoader(supabase as never);

    await expect(loader.loadPendingBatch({ now: '2026-06-27T10:00:00.000Z', limit: 10, staleGeneratingMinutes: 30 })).resolves.toEqual({
      status: 'ready',
      jobIdempotencyKeys: ['cert-pending-1', 'cert-stale-generating'],
      message: 'Certificate PDF batch loaded.'
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['certificate_generation_jobs']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      { method: 'select', args: ['idempotency_key,status,updated_at'] },
      { method: 'in', args: ['status', ['pending', 'generating']] },
      { method: 'order', args: ['updated_at', { ascending: true, nullsFirst: true }] },
      { method: 'limit', args: [10] }
    ]);
 });

  it('caps overly large batch limits', async () => {
    const supabase = new MockSupabase();
    const loader = new CertificatePdfBatchLoader(supabase as never);

    await loader.loadPendingBatch({ now: '2026-06-27T10:00:00.000Z', limit: 500 });

    expect(supabase.admin.queries[0]?.query.calls.at(-1)).toEqual({ method: 'limit', args: [100] });
 });

  it('returns empty without Supabase reads when the batch clock is invalid', async () => {
    const supabase = new MockSupabase();
    const loader = new CertificatePdfBatchLoader(supabase as never);

    await expect(loader.loadPendingBatch({ now: 'not-a-date' })).resolves.toEqual({
      status: 'empty',
      jobIdempotencyKeys: [],
      message: 'Certificate PDF batch was not loaded because the batch clock is invalid.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns empty when no loaded rows are eligible', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = {
      data: [{ idempotency_key: 'cert-active-generating', status: 'generating', updated_at: '2026-06-27T09:50:00.000Z' }],
      error: null
   };
    const loader = new CertificatePdfBatchLoader(supabase as never);

    await expect(loader.loadPendingBatch({ now: '2026-06-27T10:00:00.000Z', staleGeneratingMinutes: 30 })).resolves.toEqual({
      status: 'empty',
      jobIdempotencyKeys: [],
      message: 'No certificate PDF jobs are ready.'
   });
 });

  it('throws service unavailable when batch loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: null, error: { message: 'certificate batch read failed' } };
    const loader = new CertificatePdfBatchLoader(supabase as never);

    await expect(loader.loadPendingBatch({ now: '2026-06-27T10:00:00.000Z' })).rejects.toThrow(
      new ServiceUnavailableException('Unable to load certificate PDF batch: certificate batch read failed')
    );
 });
});
