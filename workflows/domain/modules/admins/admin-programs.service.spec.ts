import { AdminProgramsService } from './admin-programs.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockProgramsQuery {
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
  programsResult: QueryResult = { data: [], error: null, count: 0 };
  lastProgramsQuery?: MockProgramsQuery;

  from(tableName: string) {
    if (tableName !== 'programs') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastProgramsQuery = new MockProgramsQuery(this.programsResult);
    return this.lastProgramsQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminProgramsService', () => {
  let supabase: MockSupabase;
  let service: AdminProgramsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminProgramsService(supabase as never);
  });

  it('lists programs with bounded pagination metadata', async () => {
    supabase.admin.programsResult = {
      data: [
        {
          id: 'program-uuid',
          program_key: 'mclp',
          name: 'Management Consulting Leadership Program',
          short_name: 'MCLP',
          domain_label: 'Consulting',
          status: 'active',
          updated_at: '2026-06-26T00:00:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listPrograms({ page: 1, limit: 25, status: 'all' });

    expect(result).toEqual({
      items: [
        {
          id: 'program-uuid',
          programKey: 'mclp',
          name: 'Management Consulting Leadership Program',
          shortName: 'MCLP',
          domainLabel: 'Consulting',
          status: 'active',
          updatedAt: '2026-06-26T00:00:00.000Z'
        }
      ],
      page: 1,
      limit: 25,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(supabase.admin.lastProgramsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['updated_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
  });

  it('applies status and normalized search filters to program list queries', async () => {
    await service.listPrograms({ page: 1, limit: 10, status: 'active', search: ' MCLP  Program ' });

    expect(supabase.admin.lastProgramsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'active'] },
        {
          method: 'or',
          args: ['program_key.ilike.%mclp program%,name.ilike.%mclp program%,short_name.ilike.%mclp program%']
        }
      ])
    );
  });
});
