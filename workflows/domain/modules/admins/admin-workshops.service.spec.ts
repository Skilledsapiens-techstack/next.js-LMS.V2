import { AdminWorkshopsService } from './admin-workshops.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockWorkshopsQuery {
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
  workshopsResult: QueryResult = { data: [], error: null, count: 0 };
  lastWorkshopsQuery?: MockWorkshopsQuery;

  from(tableName: string) {
    if (tableName !== 'workshops') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastWorkshopsQuery = new MockWorkshopsQuery(this.workshopsResult);
    return this.lastWorkshopsQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

class MockWorkshopStatusTransitionWorkflow {
  transitionStatus = jest.fn();
}

describe('AdminWorkshopsService', () => {
  let supabase: MockSupabase;
  let workflow: MockWorkshopStatusTransitionWorkflow;
  let service: AdminWorkshopsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    workflow = new MockWorkshopStatusTransitionWorkflow();
    service = new AdminWorkshopsService(supabase as never, workflow as never);
  });

  it('lists workshops with bounded pagination and operational metadata', async () => {
    supabase.admin.workshopsResult = {
      data: [
        {
          id: 'workshop-uuid',
          workshop_id: 'WS-001',
          title: 'Live Consulting Session',
          date: '2026-07-01',
          time: '18:00',
          duration_minutes: '90',
          program_key: 'mclp',
          domain_key: 'consulting',
          cohort_names: ['MCLP June'],
          join_url: 'https://zoom.example/join',
          workshop_status: 'Scheduled',
          zoom_id: '123456789',
          zoom_account: 'account1',
          zoom_label: 'Zoom Account 1',
          youtube_video_url: 'https://youtube.example/video',
          zoom_recording_url: 'https://zoom.example/recording',
          access_type: 'paid',
          price: '1999',
          currency: 'INR',
          payment_link: 'https://payments.example/ws-001',
          zoom_start_url: 'should-not-be-selected',
          updated_at: '2026-06-27T00:00:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listWorkshops({ page: 1, limit: 25, status: 'all', accessType: 'all' });

    expect(result.items[0]).toEqual({
      id: 'workshop-uuid',
      workshopId: 'WS-001',
      title: 'Live Consulting Session',
      date: '2026-07-01',
      time: '18:00',
      durationMinutes: 90,
      programKey: 'mclp',
      domainKey: 'consulting',
      cohortNames: ['MCLP June'],
      joinUrl: 'https://zoom.example/join',
      status: 'Scheduled',
      zoomId: '123456789',
      zoomAccount: 'account1',
      zoomLabel: 'Zoom Account 1',
      youtubeVideoUrl: 'https://youtube.example/video',
      zoomRecordingUrl: 'https://zoom.example/recording',
      accessType: 'paid',
      price: 1999,
      currency: 'INR',
      paymentLink: 'https://payments.example/ws-001',
      updatedAt: '2026-06-27T00:00:00.000Z'
    });
    expect(result.items[0]).not.toHaveProperty('zoomStartUrl');
    expect(result.total).toBe(1);
    expect(supabase.admin.lastWorkshopsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['date', { ascending: false, nullsFirst: false }] },
        { method: 'order', args: ['time', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
  });

  it('applies status, access type, and normalized search filters', async () => {
    await service.listWorkshops({
      page: 1,
      limit: 10,
      status: 'Completed',
      accessType: 'paid',
      search: ' Zoom 123 '
    });

    expect(supabase.admin.lastWorkshopsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['workshop_status', 'Completed'] },
        { method: 'eq', args: ['access_type', 'paid'] },
        {
          method: 'or',
          args: ['title.ilike.%zoom 123%,workshop_id.ilike.%zoom 123%,program_key.ilike.%zoom 123%,domain_key.ilike.%zoom 123%,zoom_id.ilike.%zoom 123%']
        }
      ])
    );
  });

  it('marks a workshop completed through the status transition workflow', async () => {
    workflow.transitionStatus.mockResolvedValue({
      status: 'updated',
      message: 'Workshop status writes completed.',
      workshopId: 'workshop-uuid'
    });

    await expect(service.markWorkshopCompleted('workshop-uuid', 'admin@example.com')).resolves.toEqual({
      status: 'updated',
      message: 'Workshop status writes completed.',
      workshopId: 'workshop-uuid'
    });
    expect(workflow.transitionStatus).toHaveBeenCalledWith({
      adminEmail: 'admin@example.com',
      nextStatus: 'Completed',
      workshopId: 'workshop-uuid'
    });
  });
});
