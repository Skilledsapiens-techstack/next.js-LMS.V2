import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { WorkshopStatusTransitionLoader } from './workshop-status-transition.loader';

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
      'workshops',
      {
        data: {
          id: 'workshop-row-uuid',
          workshop_id: 'WS-001',
          title: 'Live Consulting Session',
          workshop_status: 'Scheduled'
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

describe('WorkshopStatusTransitionLoader', () => {
  it('loads a workshop into a status transition plan', async () => {
    const supabase = new MockSupabase();
    const loader = new WorkshopStatusTransitionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: ' workshop-row-uuid ',
        nextStatus: 'Live',
        adminEmail: ' Admin@Example.com ',
        changedAt: '2026-06-27T10:00:00.000Z'
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Workshop status transition plan loaded.',
      plan: {
        shouldTransition: true,
        reason: 'ready',
        workshopUpdate: {
          id: 'workshop-row-uuid',
          workshop_status: 'Live',
          updated_at: '2026-06-27T10:00:00.000Z'
       },
        auditEvent: {
          action: 'workshop.status_changed',
          actor_id: 'admin@example.com',
          entity: 'workshops',
          entity_id: 'workshop-row-uuid'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshops']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'select', args: ['id,workshop_id,title,workshop_status'] },
        { method: 'eq', args: ['id', 'workshop-row-uuid'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new WorkshopStatusTransitionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: ' ',
        nextStatus: 'Live',
        adminEmail: ' '
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Workshop ID and admin email are required to load a status transition plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when the workshop does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('workshops', { data: null, error: null });
    const loader = new WorkshopStatusTransitionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: 'missing-workshop',
        nextStatus: 'Live',
        adminEmail: 'admin@example.com'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No workshop matched the status transition source identity.'
   });
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('workshops', { data: null, error: { message: 'workshop query failed' } });
    const loader = new WorkshopStatusTransitionLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: 'workshop-row-uuid',
        nextStatus: 'Live',
        adminEmail: 'admin@example.com'
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
