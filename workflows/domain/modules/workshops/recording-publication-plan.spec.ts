import {
  createRecordingPublicationPlan,
  RecordingCandidateForPublication,
  WorkshopForRecordingPublication
} from './recording-publication-plan';

const workshop: WorkshopForRecordingPublication = {
  id: 'workshop-row-uuid',
  workshopId: 'WS-001',
  title: 'Live Consulting Session',
  status: 'Completed'
};

const candidate: RecordingCandidateForPublication = {
  id: 'candidate-uuid',
  workshopId: 'WS-001',
  status: 'reviewed',
  playUrl: 'https://zoom.example/play',
  downloadUrl: 'https://zoom.example/download'
};

describe('createRecordingPublicationPlan', () => {
  it('plans publication of a reviewed Zoom recording to the workshop', () => {
    expect(
      createRecordingPublicationPlan(workshop, candidate, {
        adminEmail: ' Admin@Example.com ',
        source: 'zoom',
        publishedAt: '2026-06-27T10:00:00.000Z'
      })
    ).toEqual({
      shouldPublish: true,
      reason: 'ready',
      idempotencyKey: 'recording_publication:workshop-row-uuid:candidate-uuid:zoom',
      workshopUpdate: {
        id: 'workshop-row-uuid',
        youtube_video_url: undefined,
        zoom_recording_url: 'https://zoom.example/play',
        updated_at: '2026-06-27T10:00:00.000Z'
      },
      auditEvent: {
        idempotency_key: 'audit:recording_publication:workshop-row-uuid:candidate-uuid:zoom',
        action: 'workshop.recording_published',
        entity: 'workshops',
        entity_id: 'workshop-row-uuid',
        actor_id: 'admin@example.com',
        previous_state: {
          youtubeVideoUrl: undefined,
          zoomRecordingUrl: undefined
        },
        next_state: {
          source: 'zoom',
          recordingUrl: 'https://zoom.example/play',
          workshopId: 'WS-001',
          title: 'Live Consulting Session',
          candidateId: 'candidate-uuid'
        }
      }
    });
  });

  it('plans publication of a reviewed YouTube recording when an explicit URL is provided', () => {
    expect(
      createRecordingPublicationPlan(workshop, candidate, {
        adminEmail: 'admin@example.com',
        source: 'youtube',
        recordingUrl: 'https://youtube.example/watch?v=123',
        publishedAt: '2026-06-27T10:00:00.000Z'
      })
    ).toMatchObject({
      shouldPublish: true,
      reason: 'ready',
      workshopUpdate: {
        youtube_video_url: 'https://youtube.example/watch?v=123',
        zoom_recording_url: undefined
      },
      auditEvent: {
        next_state: {
          source: 'youtube',
          recordingUrl: 'https://youtube.example/watch?v=123'
        }
      }
    });
  });

  it('blocks missing admin identity', () => {
    expect(createRecordingPublicationPlan(workshop, candidate, { adminEmail: ' ', source: 'zoom' })).toEqual({
      shouldPublish: false,
      reason: 'missing_admin'
    });
  });

  it('blocks candidate and workshop mismatches', () => {
    expect(createRecordingPublicationPlan(workshop, { ...candidate, workshopId: 'WS-999' }, { adminEmail: 'admin@example.com', source: 'zoom' })).toEqual({
      shouldPublish: false,
      reason: 'candidate_workshop_mismatch'
    });
  });

  it('blocks publication before the workshop is completed', () => {
    expect(createRecordingPublicationPlan({ ...workshop, status: 'Live' }, candidate, { adminEmail: 'admin@example.com', source: 'zoom' })).toEqual({
      shouldPublish: false,
      reason: 'workshop_not_completed'
    });
  });

  it('blocks candidates that have not been reviewed', () => {
    expect(createRecordingPublicationPlan(workshop, { ...candidate, status: 'draft' }, { adminEmail: 'admin@example.com', source: 'zoom' })).toEqual({
      shouldPublish: false,
      reason: 'candidate_not_reviewed'
    });
  });

  it('blocks publication when a workshop already has a published recording', () => {
    expect(createRecordingPublicationPlan({ ...workshop, youtubeVideoUrl: 'https://youtube.example/existing' }, candidate, { adminEmail: 'admin@example.com', source: 'zoom' })).toEqual({
      shouldPublish: false,
      reason: 'already_published'
    });
  });

  it('blocks missing or non-HTTPS recording URLs', () => {
    expect(
      createRecordingPublicationPlan(
        workshop,
        { ...candidate, playUrl: 'http://zoom.example/play', downloadUrl: undefined },
        { adminEmail: 'admin@example.com', source: 'zoom' }
      )
    ).toEqual({
      shouldPublish: false,
      reason: 'missing_recording_url'
    });
  });
});
