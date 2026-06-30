import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminProgramStatus = 'active' | 'inactive';

export class AdminProgramsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminProgramStatus | 'all' = 'all';
}

export class AdminProgramListItemDto {
  id!: string;
  programKey!: string;
  name!: string;
  shortName?: string;
  domainLabel?: string;
  status!: AdminProgramStatus;
  updatedAt?: string;
}
