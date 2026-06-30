import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createRecordingCandidateReviewPlan,
  RecordingCandidateForReview,
  RecordingCandidateReviewDecision,
  RecordingCandidateReviewPlan,
  RecordingCandidateStatus
 } from './recording-candidate-review-plan';

type RecordingCandidateReviewRow = {
  id: string;
  workshop_id: string;
  zoom_id: string;
  zoom_account: string;
  status: RecordingCandidateStatus;
  zoom_recording_file_id: string | null;
  play_url: string | null;
  download_url: string | null;
};

export type RecordingCandidateReviewLoadInput = {
  candidateId: string;
  adminEmail: string;
  decision: RecordingCandidateReviewDecision;
  reviewedAt?: string;
};

export type RecordingCandidateReviewLoadResult = {
  status: 'ready' | 'not_found';
  plan?: RecordingCandidateReviewPlan;
  message: string;
};
export class RecordingCandidateReviewLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: RecordingCandidateReviewLoadInput): Promise<RecordingCandidateReviewLoadResult> {
    const candidateId = this.cleanText(input.candidateId);
    const adminEmail = this.normalizeEmail(input.adminEmail);

    if (!candidateId || !adminEmail) {
      return {
        status: 'not_found',
        message: 'Recording candidate ID and admin email are required to load a review plan.'
     };
   }

    const candidate = await this.loadCandidate(candidateId);

    if (!candidate) {
      return {
        status: 'not_found',
        message: 'No recording candidate matched the review source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createRecordingCandidateReviewPlan(this.toRecordingCandidateForReview(candidate), {
        adminEmail,
        decision: input.decision,
        reviewedAt: input.reviewedAt
     }),
      message: 'Recording candidate review plan loaded.'
   };
 }

  private async loadCandidate(candidateId: string): Promise<RecordingCandidateReviewRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('workshop_recording_candidates')
      .select(['id', 'workshop_id', 'zoom_id', 'zoom_account', 'status', 'zoom_recording_file_id', 'play_url', 'download_url'].join(','))
      .eq('id', candidateId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load recording candidate for review: ${error.message}`);
   }

    return this.asRecordingCandidateReviewRow(data);
 }

  private toRecordingCandidateForReview(row: RecordingCandidateReviewRow): RecordingCandidateForReview {
    return {
      id: row.id,
      workshopId: row.workshop_id,
      zoomId: row.zoom_id,
      zoomAccount: row.zoom_account,
      status: row.status,
      zoomRecordingFileId: row.zoom_recording_file_id ?? undefined,
      playUrl: row.play_url ?? undefined,
      downloadUrl: row.download_url ?? undefined
   };
 }

  private asRecordingCandidateReviewRow(value: unknown): RecordingCandidateReviewRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.id !== 'string' ||
      typeof value.workshop_id !== 'string' ||
      typeof value.zoom_id !== 'string' ||
      typeof value.zoom_account !== 'string' ||
      !this.isCandidateStatus(value.status)
    ) {
      return undefined;
   }

    return {
      id: value.id,
      workshop_id: value.workshop_id,
      zoom_id: value.zoom_id,
      zoom_account: value.zoom_account,
      status: value.status,
      zoom_recording_file_id: typeof value.zoom_recording_file_id === 'string' ? value.zoom_recording_file_id : null,
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

  private isCandidateStatus(value: unknown): value is RecordingCandidateStatus {
    return value === 'draft' || value === 'reviewed' || value === 'rejected';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
