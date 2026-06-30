import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { EmailDispatchBatchLoader } from './email-dispatch-batch.loader';

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

  or(...args: unknown[]) {
    this.calls.push({ method: 'or', args });
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
      {
        idempotency_key: 'email-ready-1',
        next_attempt_at: null,
        locked_until: null,
        attempt_count: 0,
        max_attempts: 3
     },
      {
        idempotency_key: 'email-ready-2',
        next_attempt_at: '2026-06-27T09:55:00.000Z',
        locked_until: null,
        attempt_count: 1,
        max_attempts: 3
     },
      {
        idempotency_key: 'email-locked',
        next_attempt_at: null,
        locked_until: '2026-06-27T10:05:00.000Z',
        attempt_count: 0,
        max_attempts: 3
     },
      {
        idempotency_key: 'email-exhausted',
        next_attempt_at: null,
        locked_until: null,
        attempt_count: 3,
        max_attempts: 3
     }
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

describe('EmailDispatchBatchLoader', () => {
  it('loads bounded due pending email dispatch keys', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailDispatchBatchLoader(supabase as never);

    await expect(loader.loadPendingBatch({ now: '2026-06-27T10:00:00.000Z', limit: 10 })).resolves.toEqual({
      status: 'ready',
      idempotencyKeys: ['email-ready-1', 'email-ready-2'],
      message: 'Email dispatch batch loaded.'
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['email_outbox']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual([
      { method: 'select', args: ['idempotency_key,next_attempt_at,locked_until,attempt_count,max_attempts'] },
      { method: 'eq', args: ['status', 'pending'] },
      { method: 'or', args: ['next_attempt_at.is.null,next_attempt_at.lte.2026-06-27T10:00:00.000Z'] },
      { method: 'order', args: ['next_attempt_at', { ascending: true, nullsFirst: true }] },
      { method: 'limit', args: [10] }
    ]);
 });

  it('caps overly large batch limits', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailDispatchBatchLoader(supabase as never);

    await loader.loadPendingBatch({ now: '2026-06-27T10:00:00.000Z', limit: 500 });

    expect(supabase.admin.queries[0]?.query.calls.at(-1)).toEqual({ method: 'limit', args: [100] });
 });

  it('returns empty without Supabase reads when the dispatch clock is invalid', async () => {
    const supabase = new MockSupabase();
    const loader = new EmailDispatchBatchLoader(supabase as never);

    await expect(loader.loadPendingBatch({ now: 'not-a-date' })).resolves.toEqual({
      status: 'empty',
      idempotencyKeys: [],
      message: 'Email dispatch batch was not loaded because the dispatch clock is invalid.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns empty when no loaded rows are eligible', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = {
      data: [
        {
          idempotency_key: 'email-exhausted',
          next_attempt_at: null,
          locked_until: null,
          attempt_count: 3,
          max_attempts: 3
       }
      ],
      error: null
   };
    const loader = new EmailDispatchBatchLoader(supabase as never);

    await expect(loader.loadPendingBatch({ now: '2026-06-27T10:00:00.000Z' })).resolves.toEqual({
      status: 'empty',
      idempotencyKeys: [],
      message: 'No email dispatch jobs are ready.'
   });
 });

  it('throws service unavailable when batch loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.result = { data: null, error: { message: 'batch read failed' } };
    const loader = new EmailDispatchBatchLoader(supabase as never);

    await expect(loader.loadPendingBatch({ now: '2026-06-27T10:00:00.000Z' })).rejects.toThrow(
      new ServiceUnavailableException('Unable to load email dispatch batch: batch read failed')
    );
 });
});
