import { AdminProjectsService } from './admin-projects.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockProjectsQuery {
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

  contains(...args: unknown[]) {
    this.filters.push({ method: 'contains', args });
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
  projectsResult: QueryResult = { data: [], error: null, count: 0 };
  lastProjectsQuery?: MockProjectsQuery;

  from(tableName: string) {
    if (tableName !== 'projects') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastProjectsQuery = new MockProjectsQuery(this.projectsResult);
    return this.lastProjectsQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminProjectsService', () => {
  let supabase: MockSupabase;
  let service: AdminProjectsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminProjectsService(supabase as never);
  });

  it('lists projects with parsed project content and bounded pagination', async () => {
    supabase.admin.projectsResult = {
      data: [
        {
          project_id: 'project-1',
          role_id: 'role-1',
          project_role: 'Marketing Analyst',
          company_name: 'Skilled Sapiens',
          program_key: 'mba',
          program_keys: ['mba', 'marketing'],
          program_name: 'MBA Program',
          title: 'Market Launch Plan',
          brief: 'Create a launch plan.',
          objectives: 'Practice GTM thinking.',
          action_items: 'Research market: Find 3 competitors\nBuild plan: Prepare roadmap',
          deliverables: 'Final deck|PPTX|Upload presentation\nWorkbook|XLSX|Upload model',
          resources: 'Brief|https://example.com/brief|pdf|Project brief',
          submission_link: 'https://example.com/submit',
          deadline: '2026-07-01',
          status: 'active',
          updated_at: '2026-06-26T00:00:00.000Z',
          internal_notes: 'should-not-be-selected'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listProjects({ page: 1, limit: 25, status: 'all' });

    expect(result.items[0]).toEqual({
      id: 'project-1',
      roleId: 'role-1',
      projectRole: 'Marketing Analyst',
      companyName: 'Skilled Sapiens',
      programKey: 'mba',
      programKeys: ['mba', 'marketing'],
      programName: 'MBA Program',
      title: 'Market Launch Plan',
      brief: 'Create a launch plan.',
      objectives: 'Practice GTM thinking.',
      tasks: [
        { title: 'Research market', description: 'Find 3 competitors' },
        { title: 'Build plan', description: 'Prepare roadmap' }
      ],
      documents: [{ title: 'Brief', link: 'https://example.com/brief', type: 'pdf', description: 'Project brief' }],
      deliverables: [
        { title: 'Final deck', format: 'PPTX', note: 'Upload presentation' },
        { title: 'Workbook', format: 'XLSX', note: 'Upload model' }
      ],
      submissionLink: 'https://example.com/submit',
      deadline: '2026-07-01',
      status: 'active',
      updatedAt: '2026-06-26T00:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastProjectsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['updated_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastProjectsQuery?.filters[0]?.args[0]).not.toContain('internal_notes');
  });

  it('applies status, role, program containment, and normalized search filters', async () => {
    await service.listProjects({
      page: 2,
      limit: 10,
      status: 'active',
      roleId: 'role-1',
      programKey: 'mba',
      search: ' Launch Plan '
    });

    expect(supabase.admin.lastProjectsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'active'] },
        { method: 'eq', args: ['role_id', 'role-1'] },
        { method: 'contains', args: ['program_keys', ['mba']] },
        {
          method: 'or',
          args: [
            [
              'project_id.ilike.%launch plan%',
              'title.ilike.%launch plan%',
              'project_role.ilike.%launch plan%',
              'company_name.ilike.%launch plan%',
              'program_name.ilike.%launch plan%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });
});
