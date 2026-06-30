import { AdminAnnouncementsService } from './admin-announcements.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockAnnouncementsQuery {
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
  announcementsResult: QueryResult = { data: [], error: null, count: 0 };
  lastAnnouncementsQuery?: MockAnnouncementsQuery;

  from(tableName: string) {
    if (tableName !== 'announcements') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastAnnouncementsQuery = new MockAnnouncementsQuery(this.announcementsResult);
    return this.lastAnnouncementsQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminAnnouncementsService', () => {
  let supabase: MockSupabase;
  let service: AdminAnnouncementsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminAnnouncementsService(supabase as never);
  });

  it('lists announcements with bounded pagination and a narrow response shape', async () => {
    supabase.admin.announcementsResult = {
      data: [
        {
          id: 'announcement-uuid',
          announcement_id: 'ANN-001',
          type: 'general',
          title: 'Portal update',
          message: 'New recording is available.',
          audience: 'cohort',
          program_keys: ['mba'],
          cohort_names: ['MBA June'],
          priority: 'urgent',
          status: 'active',
          pinned: true,
          start_date: '2026-06-27',
          end_date: '2026-07-01',
          link_label: 'Open portal',
          link_url: 'https://example.com/portal',
          internal_notes: 'should-not-be-selected',
          updated_at: '2026-06-27T00:00:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listAnnouncements({ page: 1, limit: 25, status: 'all', priority: 'all', audience: 'any' });

    expect(result.items[0]).toEqual({
      id: 'announcement-uuid',
      announcementId: 'ANN-001',
      type: 'general',
      title: 'Portal update',
      message: 'New recording is available.',
      audience: 'cohort',
      programKeys: ['mba'],
      cohortNames: ['MBA June'],
      priority: 'urgent',
      status: 'active',
      pinned: true,
      startDate: '2026-06-27',
      endDate: '2026-07-01',
      linkLabel: 'Open portal',
      linkUrl: 'https://example.com/portal',
      updatedAt: '2026-06-27T00:00:00.000Z'
    });
    expect(result.items[0]).not.toHaveProperty('internalNotes');
    expect(result.total).toBe(1);
    expect(supabase.admin.lastAnnouncementsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['pinned', { ascending: false, nullsFirst: false }] },
        { method: 'order', args: ['updated_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
  });

  it('applies status, priority, audience, and normalized search filters', async () => {
    await service.listAnnouncements({
      page: 1,
      limit: 10,
      status: 'active',
      priority: 'urgent',
      audience: 'cohort',
      search: ' Portal  Update '
    });

    expect(supabase.admin.lastAnnouncementsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'active'] },
        { method: 'eq', args: ['priority', 'urgent'] },
        { method: 'eq', args: ['audience', 'cohort'] },
        {
          method: 'or',
          args: ['title.ilike.%portal update%,message.ilike.%portal update%,type.ilike.%portal update%']
        }
      ])
    );
  });
});
