import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminPaidAccessStatus = 'active' | 'inactive';
export type AdminPaidAccessItemType = 'group' | 'workshop' | 'resource';

export class AdminPaidAccessQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminPaidAccessStatus | 'all' = 'all';
  itemType: AdminPaidAccessItemType | 'all' = 'all';
}

export class AdminPaidAccessListItemDto {
  id!: string;
  accessId?: string;
  studentEmail!: string;
  itemType!: AdminPaidAccessItemType;
  itemId!: string;
  status!: AdminPaidAccessStatus;
  activeNow!: boolean;
  source?: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  grantedAt?: string;
  expiresAt?: string;
  notes?: string;
}
