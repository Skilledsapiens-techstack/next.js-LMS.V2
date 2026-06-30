import { AdminCohortsService } from './admin-cohorts.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockCohortsQuery {
  filters: Array<{ method: string; args: unknown[] }> = [];
  inserts: unknown[] = [];
  updates: unknown[] = [];

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

  insert(...args: unknown[]) {
    this.inserts.push(args);
    return this;
  }

  update(...args: unknown[]) {
    this.updates.push(args);
    return this;
  }

  single() {
    return Promise.resolve(this.result);
  }

  then(resolve: (value: QueryResult) => void) {
    resolve(this.result);
  }
}

class MockAuditQuery {
  inserts: unknown[] = [];

  insert(...args: unknown[]) {
    this.inserts.push(args);
    return { data: null, error: null };
  }
}

class MockSupabaseAdmin {
  cohortsResult: QueryResult = { data: [], error: null, count: 0 };
  cohortsResults: QueryResult[] = [];
  tableNames: string[] = [];
  lastAuditQuery?: MockAuditQuery;
  lastCohortsQuery?: MockCohortsQuery;
  cohortQueries: MockCohortsQuery[] = [];

  from(tableName: string) {
    this.tableNames.push(tableName);

    if (tableName === 'audit_logs') {
      this.lastAuditQuery = new MockAuditQuery();
      return this.lastAuditQuery;
    }

    if (tableName !== 'cohorts') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastCohortsQuery = new MockCohortsQuery(this.cohortsResults.shift() ?? this.cohortsResult);
    this.cohortQueries.push(this.lastCohortsQuery);
    return this.lastCohortsQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

class MockConfig {
  constructor(private readonly values: Record<string, unknown> = {}) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

describe('AdminCohortsService', () => {
  let supabase: MockSupabase;
  let config: MockConfig;
  let service: AdminCohortsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    config = new MockConfig();
    service = new AdminCohortsService(supabase as never, config as never);
  });

  it('lists cohorts with bounded pagination metadata', async () => {
    supabase.admin.cohortsResult = {
      data: [
        {
          id: 'cohort-uuid',
          cohort_id: 'COH-001',
          name: 'Cohort One',
          program_key: 'mclp',
          domain_key: 'mclp',
          status: 'active',
          start_date: '2026-06-01',
          end_date: '2026-09-01',
          student_count: 42,
          wa_link: 'https://chat.whatsapp.com/example',
          wa_group_name: 'Cohort One WA',
          google_group: 'cohort-one@googlegroups.com',
          self_paced: true,
          sp_sessions: [{ title: 'Session 1' }],
          sp_resources: [{ title: 'Resource 1' }],
          updated_at: '2026-06-26T00:00:00.000Z'
        }
      ],
      error: null,
      count: 26
    };

    const result = await service.listCohorts({ page: 2, limit: 25, status: 'all' });

    expect(result).toEqual({
      items: [
        {
          id: 'cohort-uuid',
          cohortId: 'COH-001',
          name: 'Cohort One',
          programKey: 'mclp',
          domainKey: 'mclp',
          status: 'active',
          startDate: '2026-06-01',
          endDate: '2026-09-01',
          studentCount: 42,
          waLink: 'https://chat.whatsapp.com/example',
          waGroupName: 'Cohort One WA',
          googleGroup: 'cohort-one@googlegroups.com',
          selfPaced: true,
          selfPacedSessions: [{ title: 'Session 1' }],
          selfPacedResources: [{ title: 'Resource 1' }],
          updatedAt: '2026-06-26T00:00:00.000Z'
        }
      ],
      page: 2,
      limit: 25,
      total: 26,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
    expect(supabase.admin.lastCohortsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['name', { ascending: true }] },
        { method: 'range', args: [25, 49] }
      ])
    );
  });

  it('applies status, program, sort, and normalized search filters to cohort list queries', async () => {
    await service.listCohorts({ page: 1, limit: 10, status: 'active', search: ' MCLP  Cohort ', program: 'sales-marketing', sort: 'students_desc' });

    expect(supabase.admin.lastCohortsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'active'] },
        {
          method: 'or',
          args: ['name.ilike.%mclp cohort%,program_key.ilike.%mclp cohort%,domain_key.ilike.%mclp cohort%']
        },
        { method: 'or', args: ['program_key.in.(sales_marketing,smlp),domain_key.in.(sales_marketing,smlp)'] },
        { method: 'order', args: ['student_count', { ascending: false, nullsFirst: false }] },
        { method: 'order', args: ['name', { ascending: true }] },
        { method: 'range', args: [0, 9] }
      ])
    );
  });

  it('does not attempt Supabase writes when cohort writes are disabled', async () => {
    await expect(
      service.createCohort(
        {
          name: 'New Cohort',
          programKey: 'mclp',
          status: 'active'
        },
        'admin@example.com'
      )
    ).rejects.toThrow('Cohort writes are disabled');

    expect(supabase.admin.tableNames).toEqual([]);
  });

  it('creates cohorts and records an audit event when writes are enabled', async () => {
    config = new MockConfig({ COHORT_WRITES_ENABLED: true });
    service = new AdminCohortsService(supabase as never, config as never);
    supabase.admin.cohortsResult = {
      data: {
        id: 'created-cohort-uuid',
        cohort_id: 'COH-NEW',
        name: 'New Cohort',
        program_key: 'mclp',
        domain_key: 'mclp',
        status: 'active',
        start_date: '2026-07-01',
        end_date: null,
        student_count: 0,
        wa_link: null,
        wa_group_name: 'WA New',
        google_group: 'new@googlegroups.com',
        self_paced: true,
        sp_sessions: [{ title: 'Intro', url: 'https://example.com/recording' }],
        sp_resources: [{ name: 'Deck', url: 'https://example.com/deck', type: 'PDF' }],
        updated_at: '2026-06-29T00:00:00.000Z'
      },
      error: null,
      count: null
    };

    const result = await service.createCohort(
      {
        cohortId: 'COH-NEW',
        name: 'New Cohort',
        programKey: 'mclp',
        status: 'active',
        startDate: '2026-07-01',
        waGroupName: 'WA New',
        selfPaced: true,
        selfPacedSessions: [{ title: 'Intro', url: 'https://example.com/recording' }],
        selfPacedResources: [{ name: 'Deck', url: 'https://example.com/deck', type: 'PDF' }]
      },
      'Admin@Example.com'
    );

    expect(result).toMatchObject({
      id: 'created-cohort-uuid',
      cohortId: 'COH-NEW',
      name: 'New Cohort',
      programKey: 'mclp',
      selfPaced: true
    });
    expect(supabase.admin.tableNames).toEqual(['cohorts', 'audit_logs']);
    expect(supabase.admin.lastCohortsQuery?.inserts[0]).toEqual([
      expect.objectContaining({
        cohort_id: 'COH-NEW',
        name: 'New Cohort',
        program_key: 'mclp',
        self_paced: true,
        wa_group_name: 'WA New'
      })
    ]);
    expect(supabase.admin.lastAuditQuery?.inserts[0]).toEqual([
      expect.objectContaining({
        action: 'cohort.created',
        actor_email: 'admin@example.com',
        actor_role: 'admin',
        entity_type: 'cohorts',
        entity_id: 'created-cohort-uuid',
        status: 'success',
        details: expect.objectContaining({
          previousState: null,
          nextState: expect.objectContaining({
            cohortId: 'COH-NEW',
            name: 'New Cohort',
            programKey: 'mclp',
            status: 'active',
            selfPaced: true
          })
        })
      })
    ]);
  });

  it('updates cohorts and records previous and next audit state when writes are enabled', async () => {
    config = new MockConfig({ COHORT_WRITES_ENABLED: true });
    service = new AdminCohortsService(supabase as never, config as never);
    supabase.admin.cohortsResults = [
      {
        data: {
          id: 'cohort-uuid',
          cohort_id: 'COH-OLD',
          name: 'Old Cohort',
          program_key: 'mclp',
          domain_key: 'mclp',
          status: 'active',
          start_date: '2026-07-01',
          end_date: null,
          student_count: 10,
          wa_link: null,
          wa_group_name: 'Old WA',
          google_group: null,
          self_paced: false,
          sp_sessions: [],
          sp_resources: [],
          updated_at: '2026-06-29T00:00:00.000Z'
        },
        error: null
      },
      {
        data: {
          id: 'cohort-uuid',
          cohort_id: 'COH-NEW',
          name: 'Updated Cohort',
          program_key: 'smlp',
          domain_key: 'smlp',
          status: 'upcoming',
          start_date: '2026-08-01',
          end_date: null,
          student_count: 12,
          wa_link: null,
          wa_group_name: 'New WA',
          google_group: 'new@googlegroups.com',
          self_paced: true,
          sp_sessions: [{ title: 'Intro' }],
          sp_resources: [],
          updated_at: '2026-06-30T00:00:00.000Z'
        },
        error: null
      }
    ];

    const result = await service.updateCohort(
      'cohort-uuid',
      {
        cohortId: 'COH-NEW',
        name: 'Updated Cohort',
        programKey: 'smlp',
        status: 'upcoming',
        startDate: '2026-08-01',
        studentCount: 12,
        waGroupName: 'New WA',
        googleGroup: 'new@googlegroups.com',
        selfPaced: true,
        selfPacedSessions: [{ title: 'Intro' }],
        selfPacedResources: []
      },
      'Admin@Example.com'
    );

    expect(result).toMatchObject({
      id: 'cohort-uuid',
      cohortId: 'COH-NEW',
      name: 'Updated Cohort',
      programKey: 'smlp',
      status: 'upcoming',
      selfPaced: true
    });
    expect(supabase.admin.cohortQueries[1]?.updates[0]).toEqual([
      expect.objectContaining({
        cohort_id: 'COH-NEW',
        name: 'Updated Cohort',
        program_key: 'smlp',
        self_paced: true,
        sp_sessions: [{ title: 'Intro' }]
      })
    ]);
    expect(supabase.admin.lastAuditQuery?.inserts[0]).toEqual([
      expect.objectContaining({
        action: 'cohort.updated',
        actor_email: 'admin@example.com',
        entity_id: 'cohort-uuid',
        details: expect.objectContaining({
          previousState: expect.objectContaining({ name: 'Old Cohort', status: 'active' }),
          nextState: expect.objectContaining({ name: 'Updated Cohort', status: 'upcoming' })
        })
      })
    ]);
  });

  it('deactivates cohorts and records an audit event when writes are enabled', async () => {
    config = new MockConfig({ COHORT_WRITES_ENABLED: true });
    service = new AdminCohortsService(supabase as never, config as never);
    supabase.admin.cohortsResults = [
      {
        data: {
          id: 'cohort-uuid',
          cohort_id: 'COH-001',
          name: 'Active Cohort',
          program_key: 'mclp',
          domain_key: 'mclp',
          status: 'active',
          start_date: '2026-07-01',
          end_date: null,
          student_count: 10,
          wa_link: null,
          wa_group_name: null,
          google_group: null,
          self_paced: false,
          sp_sessions: [],
          sp_resources: [],
          updated_at: '2026-06-29T00:00:00.000Z'
        },
        error: null
      },
      {
        data: {
          id: 'cohort-uuid',
          cohort_id: 'COH-001',
          name: 'Active Cohort',
          program_key: 'mclp',
          domain_key: 'mclp',
          status: 'inactive',
          start_date: '2026-07-01',
          end_date: null,
          student_count: 10,
          wa_link: null,
          wa_group_name: null,
          google_group: null,
          self_paced: false,
          sp_sessions: [],
          sp_resources: [],
          updated_at: '2026-06-30T00:00:00.000Z'
        },
        error: null
      }
    ];

    await service.updateCohortStatus('cohort-uuid', 'inactive', 'admin@example.com');

    expect(supabase.admin.cohortQueries[1]?.updates[0]).toEqual([expect.objectContaining({ status: 'inactive' })]);
    expect(supabase.admin.lastAuditQuery?.inserts[0]).toEqual([
      expect.objectContaining({
        action: 'cohort.deactivated',
        entity_id: 'cohort-uuid',
        details: expect.objectContaining({
          previousState: expect.objectContaining({ status: 'active' }),
          nextState: expect.objectContaining({ status: 'inactive' })
        })
      })
    ]);
  });
});
