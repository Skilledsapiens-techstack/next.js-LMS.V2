import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { RecordingCandidateStatus } from './recording-candidate-review-plan';
import { 
  createRecordingPublicationPlan,
  RecordingCandidateForPublication,
  RecordingPublicationInput,
  RecordingPublicationPlan,
  WorkshopForRecordingPublication
 } from './recording-publication-plan';
import { WorkshopStatus } from './workshop-status-transition-plan';

type WorkshopPublicationRow = {
  id: string;
  workshop_id: string | null;
  title: string;
  workshop_status: WorkshopStatus;
  youtube_video_url: string | null;
  zoom_recording_url: string | null;
};

type RecordingCandidatePublicationRow = {
  id: string;
  workshop_id: string;
  status: RecordingCandidateStatus;
  play_url: string | null;
  download_url: string | null;
};

export type RecordingPublicationLoadInput = RecordingPublicationInput & {
  workshopId: string;
  candidateId: string;
};

export type RecordingPublicationLoadResult = {
  status: 'ready' | 'not_found';
  plan?: RecordingPublicationPlan;
  message: string;
};
export class RecordingPublicationLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: RecordingPublicationLoadInput): Promise<RecordingPublicationLoadResult> {
    const workshopId = this.cleanText(input.workshopId);
    const candidateId = this.cleanText(input.candidateId);
    const adminEmail = this.normalizeEmail(input.adminEmail);

    if (!workshopId || !candidateId || !adminEmail) {
      return {
        status: 'not_found',
        message: 'Workshop ID, recording candidate ID, and admin email are required to load a recording publication plan.'
     };
   }

    const [workshop, candidate] = await Promise.all([
      this.loadWorkshop(workshopId),
      this.loadCandidate(candidateId)
    ]);

    if (!workshop || !candidate) {
      return {
        status: 'not_found',
        message: 'No workshop or recording candidate matched the publication source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createRecordingPublicationPlan(this.toWorkshopForPublication(workshop), this.toCandidateForPublication(candidate), {
        adminEmail,
        source: input.source,
        recordingUrl: input.recordingUrl,
        publishedAt: input.publishedAt
     }),
      message: 'Recording publication plan loaded.'
   };
 }

  private async loadWorkshop(workshopId: string): Promise<WorkshopPublicationRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('workshops')
      .select(['id', 'workshop_id', 'title', 'workshop_status', 'youtube_video_url', 'zoom_recording_url'].join(','))
      .eq('id', workshopId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load workshop for recording publication: ${error.message}`);
   }

    return this.asWorkshopPublicationRow(data);
 }

  private async loadCandidate(candidateId: string): Promise<RecordingCandidatePublicationRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('workshop_recording_candidates')
      .select(['id', 'workshop_id', 'status', 'play_url', 'download_url'].join(','))
      .eq('id', candidateId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load recording candidate for publication: ${error.message}`);
   }

    return this.asCandidatePublicationRow(data);
 }

  private toWorkshopForPublication(row: WorkshopPublicationRow): WorkshopForRecordingPublication {
    return {
      id: row.id,
      workshopId: row.workshop_id ?? undefined,
      title: row.title,
      status: row.workshop_status,
      youtubeVideoUrl: row.youtube_video_url ?? undefined,
      zoomRecordingUrl: row.zoom_recording_url ?? undefined
   };
 }

  private toCandidateForPublication(row: RecordingCandidatePublicationRow): RecordingCandidateForPublication {
    return {
      id: row.id,
      workshopId: row.workshop_id,
      status: row.status,
      playUrl: row.play_url ?? undefined,
      downloadUrl: row.download_url ?? undefined
   };
 }

  private asWorkshopPublicationRow(value: unknown): WorkshopPublicationRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.id !== 'string' ||
      typeof value.title !== 'string' ||
      !this.isWorkshopStatus(value.workshop_status)
    ) {
      return undefined;
   }

    return {
      id: value.id,
      workshop_id: typeof value.workshop_id === 'string' ? value.workshop_id : null,
      title: value.title,
      workshop_status: value.workshop_status,
      youtube_video_url: typeof value.youtube_video_url === 'string' ? value.youtube_video_url : null,
      zoom_recording_url: typeof value.zoom_recording_url === 'string' ? value.zoom_recording_url : null
   };
 }

  private asCandidatePublicationRow(value: unknown): RecordingCandidatePublicationRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.id !== 'string' ||
      typeof value.workshop_id !== 'string' ||
      !this.isCandidateStatus(value.status)
    ) {
      return undefined;
   }

    return {
      id: value.id,
      workshop_id: value.workshop_id,
      status: value.status,
      play_url: typeof value.play_url === 'string' ? value.play_url : null,
      download_url: typeof value.download_url === 'string' ? value.download_url : null
   };
 }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
 }

  private cleanText(value: string): string {
    return value.trim();
 }

  private isWorkshopStatus(value: unknown): value is WorkshopStatus {
    return value === 'Upcoming' || value === 'Scheduled' || value === 'Live' || value === 'Completed' || value === 'Cancelled' || value === 'Inactive';
 }

  private isCandidateStatus(value: unknown): value is RecordingCandidateStatus {
    return value === 'draft' || value === 'reviewed' || value === 'rejected';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
