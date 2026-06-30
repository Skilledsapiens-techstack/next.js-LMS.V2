import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentResourceAccessType = 'free' | 'paid';

export class StudentResourcesQueryDto extends PaginationQueryDto {
  search?: string;
  accessType: StudentResourceAccessType | 'all' = 'all';
  resourceType?: string;
}

export class StudentResourceListItemDto {
  id!: string;
  resourceId?: string;
  title!: string;
  description?: string;
  resourceType!: string;
  resourceMode?: string;
  phase?: string;
  programKeys!: string[];
  cohortNames!: string[];
  url?: string;
  accessType!: StudentResourceAccessType;
  hasAccess!: boolean;
  locked!: boolean;
  lockReason?: string;
  price?: number;
  currency?: string;
  updatedAt?: string;
}
