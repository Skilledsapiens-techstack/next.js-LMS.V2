import { AdminRecordingCandidatesService } from './admin-recording-candidates.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockCandidatesQuery {
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
  candidatesResult: QueryResult = { data: [], error: null, count: 0 };
  lastCandidatesQuery?: MockCandidatesQuery;

  from(tableName: string) {
    if (tableName !== 'workshop_recording_candidates') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastCandidatesQuery = new MockCandidatesQuery(this.candidatesResult);
    return this.lastCandidatesQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminRecordingCandidatesService', () => {
  let supabase: MockSupabase;
  let service: AdminRecordingCandidatesService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminRecordingCandidatesService(supabase as never);
  });

  it('lists recording candidates with bounded pagination and review metadata', async () => {
    supabase.admin.candidatesResult = {
      data: [
        {
          id: 'candidate-uuid',
          workshop_id: 'WS-001',
          zoom_id: '123456789',
          zoom_account: 'account1',
          zoom_recording_file_id: 'file-1',
          recording_start: '2026-06-27T10:00:00.000Z',
          recording_end: '2026-06-27T11:00:00.000Z',
          duration_minutes: '60',
          file_type: 'MP4',
          recording_type: 'shared_screen_with_speaker_view',
          play_url: 'https://zoom.example/play',
          download_url: 'https://zoom.example/download',
          file_size: '123456',
          status: 'draft',
          detected_at: '2026-06-27T11:10:00.000Z',
          reviewed_by: null,
          reviewed_at: null,
          raw_payload: 'should-not-be-selected',
          updated_at: '2026-06-27T11:10:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listRecordingCandidates({ page: 1, limit: 25, status: 'all' });

    expect(result.items[0]).toEqual({
      id: 'candidate-uuid',
      workshopId: 'WS-001',
      zoomId: '123456789',
      zoomAccount: 'account1',
      zoomRecordingFileId: 'file-1',
      recordingStart: '2026-06-27T10:00:00.000Z',
      recordingEnd: '2026-06-27T11:00:00.000Z',
      durationMinutes: 60,
      fileType: 'MP4',
      recordingType: 'shared_screen_with_speaker_view',
      playUrl: 'https://zoom.example/play',
      downloadUrl: 'https://zoom.example/download',
      fileSize: 123456,
      status: 'draft',
      detectedAt: '2026-06-27T11:10:00.000Z',
      updatedAt: '2026-06-27T11:10:00.000Z'
    });
    expect(result.items[0]).not.toHaveProperty('rawPayload');
    expect(result.total).toBe(1);
    expect(supabase.admin.lastCandidatesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['detected_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
  });

  it('applies status, workshop, zoom account, and normalized search filters', async () => {
    await service.listRecordingCandidates({
      page: 1,
      limit: 10,
      status: 'draft',
      workshopId: 'WS-001',
      zoomAccount: 'account1',
      search: ' file 1 '
    });

    expect(supabase.admin.lastCandidatesQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'draft'] },
        { method: 'eq', args: ['workshop_id', 'WS-001'] },
        { method: 'eq', args: ['zoom_account', 'account1'] },
        {
          method: 'or',
          args: ['workshop_id.ilike.%file 1%,zoom_id.ilike.%file 1%,zoom_recording_file_id.ilike.%file 1%,file_type.ilike.%file 1%,recording_type.ilike.%file 1%']
        }
      ])
    );
  });
});
