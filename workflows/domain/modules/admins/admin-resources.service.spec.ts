import { AdminResourcesService } from './admin-resources.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockResourcesQuery {
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
  resourcesResult: QueryResult = { data: [], error: null, count: 0 };
  lastResourcesQuery?: MockResourcesQuery;

  from(tableName: string) {
    if (tableName !== 'resources') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastResourcesQuery = new MockResourcesQuery(this.resourcesResult);
    return this.lastResourcesQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminResourcesService', () => {
  let supabase: MockSupabase;
  let service: AdminResourcesService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminResourcesService(supabase as never);
  });

  it('lists resources with bounded pagination metadata', async () => {
    supabase.admin.resourcesResult = {
      data: [
        {
          id: 'resource-uuid',
          resource_id: 'RES-001',
          title: 'Case Prep',
          description: 'Resource description',
          resource_type: 'pdf',
          resource_mode: 'download',
          phase: 'phase-1',
          program_keys: ['mclp'],
          domain_key: 'mclp',
          cohort_names: ['Cohort A'],
          url: 'https://example.com/resource.pdf',
          access_type: 'paid',
          price: '1999',
          currency: 'INR',
          status: 'active',
          updated_at: '2026-06-26T00:00:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listResources({ page: 1, limit: 25, status: 'all', accessType: 'all' });

    expect(result.items[0]).toEqual({
      id: 'resource-uuid',
      resourceId: 'RES-001',
      title: 'Case Prep',
      description: 'Resource description',
      resourceType: 'pdf',
      resourceMode: 'download',
      phase: 'phase-1',
      programKeys: ['mclp'],
      domainKey: 'mclp',
      cohortNames: ['Cohort A'],
      url: 'https://example.com/resource.pdf',
      accessType: 'paid',
      price: 1999,
      currency: 'INR',
      status: 'active',
      updatedAt: '2026-06-26T00:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastResourcesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['updated_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
  });

  it('applies status, access type, and normalized search filters', async () => {
    await service.listResources({ page: 1, limit: 10, status: 'active', accessType: 'paid', search: ' Case  PDF ' });

    expect(supabase.admin.lastResourcesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'active'] },
        { method: 'eq', args: ['access_type', 'paid'] },
        {
          method: 'or',
          args: ['title.ilike.%case pdf%,resource_type.ilike.%case pdf%,domain_key.ilike.%case pdf%']
        }
      ])
    );
  });
});
