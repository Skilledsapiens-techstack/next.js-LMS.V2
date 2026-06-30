import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminAnnouncementStatus = 'active' | 'inactive';
export type AdminAnnouncementPriority = 'normal' | 'important' | 'urgent';
export type AdminAnnouncementAudience = 'all' | 'program' | 'cohort';

export class AdminAnnouncementsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminAnnouncementStatus | 'all' = 'all';
  priority: AdminAnnouncementPriority | 'all' = 'all';
  audience: AdminAnnouncementAudience | 'any' = 'any';
}

export class AdminAnnouncementListItemDto {
  id!: string;
  announcementId?: string;
  type?: string;
  title!: string;
  message!: string;
  audience!: AdminAnnouncementAudience;
  programKeys!: string[];
  cohortNames!: string[];
  priority!: AdminAnnouncementPriority;
  status!: AdminAnnouncementStatus;
  pinned!: boolean;
  startDate?: string;
  endDate?: string;
  linkLabel?: string;
  linkUrl?: string;
  updatedAt?: string;
}
