import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentRecordingAccessType = 'free' | 'paid';
export type StudentRecordingSource = 'youtube' | 'zoom';

export class StudentRecordingsQueryDto extends PaginationQueryDto {
  search?: string;
  accessType: StudentRecordingAccessType | 'all' = 'all';
  source: StudentRecordingSource | 'all' = 'all';
}

export class StudentRecordingListItemDto {
  id!: string;
  workshopId?: string;
  title!: string;
  date!: string;
  time?: string;
  durationMinutes?: number;
  programKey?: string;
  domainKey?: string;
  cohortNames!: string[];
  accessType!: StudentRecordingAccessType;
  hasAccess!: boolean;
  locked!: boolean;
  lockReason?: string;
  source?: StudentRecordingSource;
  recordingUrl?: string;
  price?: number;
  currency?: string;
}
