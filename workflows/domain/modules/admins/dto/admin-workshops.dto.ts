import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminWorkshopAccessType = 'free' | 'paid';
export type AdminWorkshopStatus = 'Upcoming' | 'Scheduled' | 'Live' | 'Completed' | 'Cancelled' | 'Inactive';

export class AdminWorkshopsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminWorkshopStatus | 'all' = 'all';
  accessType: AdminWorkshopAccessType | 'all' = 'all';
}

export class AdminWorkshopListItemDto {
  id!: string;
  workshopId?: string;
  title!: string;
  date!: string;
  time?: string;
  durationMinutes?: number;
  programKey?: string;
  domainKey?: string;
  cohortNames!: string[];
  joinUrl?: string;
  status!: AdminWorkshopStatus;
  zoomId?: string;
  zoomAccount?: string;
  zoomLabel?: string;
  youtubeVideoUrl?: string;
  zoomRecordingUrl?: string;
  accessType!: AdminWorkshopAccessType;
  price?: number;
  currency?: string;
  paymentLink?: string;
  updatedAt?: string;
}
