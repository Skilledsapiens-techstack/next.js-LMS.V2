import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  AdminRecordingCandidateListItemDto,
  AdminRecordingCandidatesQueryDto,
  AdminRecordingCandidateStatus
 } from './dto/admin-recording-candidates.dto';

type AdminRecordingCandidateRow = {
  id: string;
  workshop_id: string;
  zoom_id: string;
  zoom_account: string;
  zoom_recording_file_id: string | null;
  recording_start: string | null;
  recording_end: string | null;
  duration_minutes: number | string | null;
  file_type: string | null;
  recording_type: string | null;
  play_url: string | null;
  download_url: string | null;
  file_size: number | string | null;
  status: AdminRecordingCandidateStatus;
  detected_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
};
export class AdminRecordingCandidatesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listRecordingCandidates(query: AdminRecordingCandidatesQueryDto): Promise<PaginatedResponse<AdminRecordingCandidateListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('workshop_recording_candidates')
      .select(
        [
          'id',
          'workshop_id',
          'zoom_id',
          'zoom_account',
          'zoom_recording_file_id',
          'recording_start',
          'recording_end',
          'duration_minutes',
          'file_type',
          'recording_type',
          'play_url',
          'download_url',
          'file_size',
          'status',
          'detected_at',
          'reviewed_by',
          'reviewed_at',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('detected_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.workshopId) {
      request = request.eq('workshop_id', query.workshopId);
   }

    if (query.zoomAccount) {
      request = request.eq('zoom_account', query.zoomAccount);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(`workshop_id.ilike.%${escapedSearch}%,zoom_id.ilike.%${escapedSearch}%,zoom_recording_file_id.ilike.%${escapedSearch}%,file_type.ilike.%${escapedSearch}%,recording_type.ilike.%${escapedSearch}%`);
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load recording candidates: ${error.message}`);
   }

    return createPaginatedResponse(this.asCandidateRows(data).map((row) => this.toCandidateListItem(row)), page, limit, count ?? 0);
 }

  private asCandidateRows(value: unknown): AdminRecordingCandidateRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminRecordingCandidateRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.workshop_id === 'string' &&
        typeof row.zoom_id === 'string' &&
        typeof row.zoom_account === 'string' &&
        typeof row.detected_at === 'string' &&
        this.isCandidateStatus(row.status)
      );
   });
 }

  private toCandidateListItem(row: AdminRecordingCandidateRow): AdminRecordingCandidateListItemDto {
    const item: AdminRecordingCandidateListItemDto = {
      id: row.id,
      workshopId: row.workshop_id,
      zoomId: row.zoom_id,
      zoomAccount: row.zoom_account,
      status: row.status,
      detectedAt: row.detected_at
   };

    const durationMinutes = this.toOptionalNumber(row.duration_minutes);
    const fileSize = this.toOptionalNumber(row.file_size);

    if (row.zoom_recording_file_id) item.zoomRecordingFileId = row.zoom_recording_file_id;
    if (row.recording_start) item.recordingStart = row.recording_start;
    if (row.recording_end) item.recordingEnd = row.recording_end;
    if (durationMinutes !== undefined) item.durationMinutes = durationMinutes;
    if (row.file_type) item.fileType = row.file_type;
    if (row.recording_type) item.recordingType = row.recording_type;
    if (row.play_url) item.playUrl = row.play_url;
    if (row.download_url) item.downloadUrl = row.download_url;
    if (fileSize !== undefined) item.fileSize = fileSize;
    if (row.reviewed_by) item.reviewedBy = row.reviewed_by;
    if (row.reviewed_at) item.reviewedAt = row.reviewed_at;
    if (row.updated_at) item.updatedAt = row.updated_at;

    return item;
 }

  private toOptionalNumber(value: number | string | null): number | undefined {
    if (value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isCandidateStatus(value: unknown): value is AdminRecordingCandidateStatus {
    return value === 'draft' || value === 'reviewed' || value === 'rejected';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
