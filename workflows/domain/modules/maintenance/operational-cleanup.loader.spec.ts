import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { OperationalCleanupLoader } from './operational-cleanup.loader';

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
  tableResults = new Map<string, QueryResult>();
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.tableResults.get(table) ?? { data: [], error: null });
    this.queries.push({ table, query });
    return query;
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('OperationalCleanupLoader', () => {
  it('loads bounded cleanup candidates and creates a ready plan', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('email_outbox', {
      data: [
        {
          idempotency_key: 'email-job-1',
          status: 'sending',
          locked_until: '2026-06-27T11:30:00.000Z',
          updated_at: '2026-06-27T11:29:00.000Z'
       }
      ],
      error: null
   });
    supabase.admin.tableResults.set('certificate_generation_jobs', {
      data: [{ id: 'cert-job-1', status: 'rendering', updated_at: '2026-06-27T09:00:00.000Z' }],
      error: null
   });
    supabase.admin.tableResults.set('enrollment_webhook_events', {
      data: [{ event_id: 'event-1', status: 'processed', processed_at: '2026-05-01T12:00:00.000Z', updated_at: null }],
      error: null
   });
    supabase.admin.tableResults.set('error_logs', {
      data: [{ idempotency_key: 'error-1', created_at: '2026-01-01T12:00:00.000Z' }],
      error: null
   });
    const loader = new OperationalCleanupLoader(supabase as never);

    await expect(loader.loadPlan({ now: '2026-06-27T12:00:00.000Z', perSourceLimit: 10 })).resolves.toMatchObject({
      status: 'ready',
      message: 'Operational cleanup plan loaded.',
      candidateCount: 4,
      plan: {
        shouldRun: true,
        actions: [
          { action: 'release_email_lock', entityId: 'email-job-1' },
          { action: 'mark_certificate_job_failed', entityId: 'cert-job-1' },
          { action: 'archive_webhook_event', entityId: 'event-1' },
          { action: 'purge_error_log', entityId: 'error-1' }
        ]
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual([
      'email_outbox',
      'certificate_generation_jobs',
      'enrollment_webhook_events',
      'error_logs'
    ]);
    expect(supabase.admin.queries.every((entry) => entry.query.calls.some((call) => call.method === 'limit' && call.args[0] === 10))).toBe(true);
 });

  it('returns an empty result when no candidates are ready', async () => {
    const supabase = new MockSupabase();
    const loader = new OperationalCleanupLoader(supabase as never);

    await expect(loader.loadPlan({ now: '2026-06-27T12:00:00.000Z' })).resolves.toMatchObject({
      status: 'empty',
      message: 'No operational cleanup candidates are ready.',
      candidateCount: 0,
      plan: {
        shouldRun: false,
        reason: 'empty_batch',
        actions: []
     }
   });
 });

  it('throws a service unavailable exception when a source read fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('email_outbox', { data: null, error: { message: 'read failed' } });
    const loader = new OperationalCleanupLoader(supabase as never);

    await expect(loader.loadPlan({ now: '2026-06-27T12:00:00.000Z' })).rejects.toThrow(ServiceUnavailableException);
 });
});
