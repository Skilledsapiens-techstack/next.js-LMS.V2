import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentScheduleAccessType = 'free' | 'paid';
export type StudentScheduleStatus = 'Upcoming' | 'Scheduled' | 'Live';

export class StudentScheduleQueryDto extends PaginationQueryDto {
  search?: string;
  accessType: StudentScheduleAccessType | 'all' = 'all';
  status: StudentScheduleStatus | 'all' = 'all';
}

export class StudentScheduleListItemDto {
  id!: string;
  workshopId?: string;
  title!: string;
  date!: string;
  time?: string;
  durationMinutes?: number;
  programKey?: string;
  domainKey?: string;
  cohortNames!: string[];
  status!: StudentScheduleStatus;
  accessType!: StudentScheduleAccessType;
  hasAccess!: boolean;
  locked!: boolean;
  lockReason?: string;
  joinUrl?: string;
  price?: number;
  currency?: string;
}
