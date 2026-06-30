import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentPaidAccessStatus = 'active' | 'inactive';
export type StudentPaidAccessItemType = 'group' | 'workshop' | 'resource';

export class StudentPaidAccessQueryDto extends PaginationQueryDto {
  search?: string;
  status: StudentPaidAccessStatus | 'all' = 'all';
  itemType: StudentPaidAccessItemType | 'all' = 'all';
}

export class StudentPaidAccessListItemDto {
  id!: string;
  accessId?: string;
  itemType!: StudentPaidAccessItemType;
  itemId!: string;
  status!: StudentPaidAccessStatus;
  activeNow!: boolean;
  source?: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  grantedAt?: string;
  expiresAt?: string;
}
