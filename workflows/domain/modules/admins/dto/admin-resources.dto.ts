import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminResourceStatus = 'active' | 'inactive';
export type AdminResourceAccessType = 'free' | 'paid';

export class AdminResourcesQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminResourceStatus | 'all' = 'all';
  accessType: AdminResourceAccessType | 'all' = 'all';
}

export class AdminResourceListItemDto {
  id!: string;
  resourceId?: string;
  title!: string;
  description?: string;
  resourceType!: string;
  resourceMode?: string;
  phase?: string;
  programKeys!: string[];
  domainKey?: string;
  cohortNames!: string[];
  url?: string;
  accessType!: AdminResourceAccessType;
  price?: number;
  currency!: string;
  status!: AdminResourceStatus;
  updatedAt?: string;
}
