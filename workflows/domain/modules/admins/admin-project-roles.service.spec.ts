import { AdminProjectRolesService } from './admin-project-roles.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockProjectRolesQuery {
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
  projectRolesResult: QueryResult = { data: [], error: null, count: 0 };
  lastProjectRolesQuery?: MockProjectRolesQuery;

  from(tableName: string) {
    if (tableName !== 'role_master') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastProjectRolesQuery = new MockProjectRolesQuery(this.projectRolesResult);
    return this.lastProjectRolesQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminProjectRolesService', () => {
  let supabase: MockSupabase;
  let service: AdminProjectRolesService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminProjectRolesService(supabase as never);
  });

  it('lists project roles with bounded pagination', async () => {
    supabase.admin.projectRolesResult = {
      data: [
        {
          role_id: 'marketing_analyst',
          role_name: 'Marketing Analyst',
          role_category: 'Marketing',
          program_key: 'live_mgmt',
          status: 'active',
          updated_at: '2026-06-26T00:00:00.000Z',
          mapping_payload: 'should-not-be-selected'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listProjectRoles({ page: 1, limit: 25, status: 'all' });

    expect(result.items[0]).toEqual({
      id: 'marketing_analyst',
      name: 'Marketing Analyst',
      category: 'Marketing',
      programKey: 'live_mgmt',
      status: 'active',
      updatedAt: '2026-06-26T00:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastProjectRolesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['role_name', { ascending: true, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastProjectRolesQuery?.filters[0]?.args[0]).not.toContain('mapping_payload');
  });

  it('applies status, program, and normalized search filters', async () => {
    await service.listProjectRoles({
      page: 2,
      limit: 10,
      status: 'active',
      programKey: 'live_mgmt',
      search: ' Marketing '
    });

    expect(supabase.admin.lastProjectRolesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'active'] },
        { method: 'eq', args: ['program_key', 'live_mgmt'] },
        {
          method: 'or',
          args: [
            [
              'role_id.ilike.%marketing%',
              'role_name.ilike.%marketing%',
              'role_category.ilike.%marketing%',
              'program_key.ilike.%marketing%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });
});
