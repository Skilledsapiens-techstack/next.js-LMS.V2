import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentAnnouncementPriority = 'normal' | 'important' | 'urgent';

export class StudentAnnouncementsQueryDto extends PaginationQueryDto {
  search?: string;
  priority: StudentAnnouncementPriority | 'all' = 'all';
}

export class StudentAnnouncementListItemDto {
  id!: string;
  announcementId?: string;
  type?: string;
  title!: string;
  message!: string;
  audience?: string;
  programKeys!: string[];
  cohortNames!: string[];
  priority!: StudentAnnouncementPriority;
  pinned!: boolean;
  startDate?: string;
  endDate?: string;
  linkLabel?: string;
  linkUrl?: string;
  updatedAt?: string;
}
