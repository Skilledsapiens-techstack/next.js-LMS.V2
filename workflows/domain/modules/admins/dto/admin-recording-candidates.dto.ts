import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminRecordingCandidateStatus = 'draft' | 'reviewed' | 'rejected';

export class AdminRecordingCandidatesQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminRecordingCandidateStatus | 'all' = 'all';
  workshopId?: string;
  zoomAccount?: string;
}

export class AdminRecordingCandidateListItemDto {
  id!: string;
  workshopId!: string;
  zoomId!: string;
  zoomAccount!: string;
  zoomRecordingFileId?: string;
  recordingStart?: string;
  recordingEnd?: string;
  durationMinutes?: number;
  fileType?: string;
  recordingType?: string;
  playUrl?: string;
  downloadUrl?: string;
  fileSize?: number;
  status!: AdminRecordingCandidateStatus;
  detectedAt!: string;
  reviewedBy?: string;
  reviewedAt?: string;
  updatedAt?: string;
}
