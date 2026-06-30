import { RecordingCandidateStatus } from './recording-candidate-review-plan';
import { WorkshopStatus } from './workshop-status-transition-plan';

export type RecordingPublicationSource = 'zoom' | 'youtube';

export type WorkshopForRecordingPublication = {
  id: string;
  workshopId?: string;
  title: string;
  status: WorkshopStatus;
  youtubeVideoUrl?: string;
  zoomRecordingUrl?: string;
};

export type RecordingCandidateForPublication = {
  id: string;
  workshopId: string;
  status: RecordingCandidateStatus;
  playUrl?: string;
  downloadUrl?: string;
};

export type RecordingPublicationInput = {
  adminEmail: string;
  source: RecordingPublicationSource;
  recordingUrl?: string;
  publishedAt?: string;
};

export type RecordingPublicationPlan = {
  shouldPublish: boolean;
  reason:
    | 'ready'
    | 'missing_admin'
    | 'missing_workshop_identity'
    | 'candidate_workshop_mismatch'
    | 'workshop_not_completed'
    | 'candidate_not_reviewed'
    | 'missing_recording_url'
    | 'already_published';
  idempotencyKey?: string;
  workshopUpdate?: {
    id: string;
    youtube_video_url?: string;
    zoom_recording_url?: string;
    updated_at: string;
  };
  auditEvent?: {
    idempotency_key: string;
    action: 'workshop.recording_published';
    entity: 'workshops';
    entity_id: string;
    actor_id: string;
    previous_state: {
      youtubeVideoUrl?: string;
      zoomRecordingUrl?: string;
    };
    next_state: {
      source: RecordingPublicationSource;
      recordingUrl: string;
      workshopId?: string;
      title: string;
      candidateId: string;
    };
  };
};

export function createRecordingPublicationPlan(
  workshop: WorkshopForRecordingPublication,
  candidate: RecordingCandidateForPublication,
  input: RecordingPublicationInput
): RecordingPublicationPlan {
  const adminEmail = normalizeEmail(input.adminEmail);

  if (!adminEmail) {
    return { shouldPublish: false, reason: 'missing_admin' };
  }

  const workshopRowId = cleanText(workshop.id);
  const title = cleanText(workshop.title);

  if (!workshopRowId || !title) {
    return { shouldPublish: false, reason: 'missing_workshop_identity' };
  }

  const publicWorkshopId = cleanText(workshop.workshopId);
  const candidateWorkshopId = cleanText(candidate.workshopId);

  if (publicWorkshopId && candidateWorkshopId && publicWorkshopId !== candidateWorkshopId) {
    return { shouldPublish: false, reason: 'candidate_workshop_mismatch' };
  }

  if (workshop.status !== 'Completed') {
    return { shouldPublish: false, reason: 'workshop_not_completed' };
  }

  if (candidate.status !== 'reviewed') {
    return { shouldPublish: false, reason: 'candidate_not_reviewed' };
  }

  if (cleanText(workshop.youtubeVideoUrl) || cleanText(workshop.zoomRecordingUrl)) {
    return { shouldPublish: false, reason: 'already_published' };
  }

  const recordingUrl = input.source === 'youtube'
    ? cleanUrl(input.recordingUrl)
    : cleanUrl(input.recordingUrl) ?? cleanUrl(candidate.playUrl) ?? cleanUrl(candidate.downloadUrl);

  if (!recordingUrl) {
    return { shouldPublish: false, reason: 'missing_recording_url' };
  }

  const candidateId = cleanText(candidate.id);

  if (!candidateId) {
    return { shouldPublish: false, reason: 'missing_workshop_identity' };
  }

  const publishedAt = cleanText(input.publishedAt) ?? new Date().toISOString();
  const idempotencyKey = `recording_publication:${workshopRowId}:${candidateId}:${input.source}`;

  return {
    shouldPublish: true,
    reason: 'ready',
    idempotencyKey,
    workshopUpdate: {
      id: workshopRowId,
      youtube_video_url: input.source === 'youtube' ? recordingUrl : undefined,
      zoom_recording_url: input.source === 'zoom' ? recordingUrl : undefined,
      updated_at: publishedAt
    },
    auditEvent: {
      idempotency_key: `audit:${idempotencyKey}`,
      action: 'workshop.recording_published',
      entity: 'workshops',
      entity_id: workshopRowId,
      actor_id: adminEmail,
      previous_state: {
        youtubeVideoUrl: cleanText(workshop.youtubeVideoUrl),
        zoomRecordingUrl: cleanText(workshop.zoomRecordingUrl)
      },
      next_state: {
        source: input.source,
        recordingUrl,
        workshopId: publicWorkshopId,
        title,
        candidateId
      }
    }
  };
}

function normalizeEmail(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  return text || undefined;
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function cleanUrl(value: string | undefined): string | undefined {
  const url = cleanText(value);
  if (!url || !url.startsWith('https://')) return undefined;
  return url;
}
