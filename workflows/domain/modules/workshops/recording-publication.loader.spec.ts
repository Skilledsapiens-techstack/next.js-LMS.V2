import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { RecordingPublicationLoader } from './recording-publication.loader';

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
          workshop_status: 'Completed',
          youtube_video_url: null,
          zoom_recording_url: null
       },
        error: null
     }
    ],
    [
      'workshop_recording_candidates',
      {
        data: {
          id: 'candidate-uuid',
          workshop_id: 'WS-001',
          status: 'reviewed',
          play_url: 'https://zoom.example/play',
          download_url: 'https://zoom.example/download'
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

describe('RecordingPublicationLoader', () => {
  it('loads a workshop and recording candidate into a publication plan', async () => {
    const supabase = new MockSupabase();
    const loader = new RecordingPublicationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: ' workshop-row-uuid ',
        candidateId: ' candidate-uuid ',
        adminEmail: ' Admin@Example.com ',
        source: 'zoom',
        publishedAt: '2026-06-27T10:00:00.000Z'
     })
    ).resolves.toMatchObject({
      status: 'ready',
      message: 'Recording publication plan loaded.',
      plan: {
        shouldPublish: true,
        reason: 'ready',
        workshopUpdate: {
          id: 'workshop-row-uuid',
          zoom_recording_url: 'https://zoom.example/play',
          updated_at: '2026-06-27T10:00:00.000Z'
       },
        auditEvent: {
          action: 'workshop.recording_published',
          actor_id: 'admin@example.com',
          entity: 'workshops',
          entity_id: 'workshop-row-uuid'
       }
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['workshops', 'workshop_recording_candidates']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'select', args: ['id,workshop_id,title,workshop_status,youtube_video_url,zoom_recording_url'] },
        { method: 'eq', args: ['id', 'workshop-row-uuid'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
    expect(supabase.admin.queries[1]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'select', args: ['id,workshop_id,status,play_url,download_url'] },
        { method: 'eq', args: ['id', 'candidate-uuid'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when source identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new RecordingPublicationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: ' ',
        candidateId: ' ',
        adminEmail: ' ',
        source: 'zoom'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'Workshop ID, recording candidate ID, and admin email are required to load a recording publication plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when either publication source row does not exist', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('workshops', { data: null, error: null });
    const loader = new RecordingPublicationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: 'missing-workshop',
        candidateId: 'candidate-uuid',
        adminEmail: 'admin@example.com',
        source: 'zoom'
     })
    ).resolves.toEqual({
      status: 'not_found',
      message: 'No workshop or recording candidate matched the publication source identity.'
   });
 });

  it('throws service unavailable when workshop loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('workshops', { data: null, error: { message: 'workshop query failed' } });
    const loader = new RecordingPublicationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: 'workshop-row-uuid',
        candidateId: 'candidate-uuid',
        adminEmail: 'admin@example.com',
        source: 'zoom'
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });

  it('throws service unavailable when candidate loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('workshop_recording_candidates', { data: null, error: { message: 'candidate query failed' } });
    const loader = new RecordingPublicationLoader(supabase as never);

    await expect(
      loader.loadPlan({
        workshopId: 'workshop-row-uuid',
        candidateId: 'candidate-uuid',
        adminEmail: 'admin@example.com',
        source: 'zoom'
     })
    ).rejects.toThrow(ServiceUnavailableException);
 });
});
