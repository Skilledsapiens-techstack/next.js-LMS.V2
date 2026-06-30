import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminProjectRoleStatus = 'active' | 'inactive';

export class AdminProjectRolesQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminProjectRoleStatus | 'all' = 'all';
  programKey?: string;
}

export class AdminProjectRoleListItemDto {
  id!: string;
  name!: string;
  category?: string;
  programKey?: string;
  status!: AdminProjectRoleStatus;
  updatedAt?: string;
}
