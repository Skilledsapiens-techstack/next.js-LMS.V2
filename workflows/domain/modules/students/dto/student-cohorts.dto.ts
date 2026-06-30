import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentCohortStatus = 'active' | 'upcoming' | 'completed';

export class StudentCohortsQueryDto extends PaginationQueryDto {
  search?: string;
  status: StudentCohortStatus | 'all' = 'all';
}

export class StudentCohortListItemDto {
  id!: string;
  cohortId?: string;
  name!: string;
  programKey?: string;
  domainKey?: string;
  status!: string;
  startDate?: string;
  endDate?: string;
  whatsappGroupName?: string;
  whatsappLink?: string;
  studentCount?: number;
  selfPaced!: boolean;
  updatedAt?: string;
}
