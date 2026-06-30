import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminPaymentOrderStatus = 'created' | 'paid' | 'failed' | 'cancelled';
export type AdminPaymentItemType = 'group' | 'workshop' | 'resource';

export class AdminPaymentOrdersQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminPaymentOrderStatus | 'all' = 'all';
  itemType: AdminPaymentItemType | 'all' = 'all';
}

export class AdminPaymentOrderListItemDto {
  id!: string;
  orderId?: string;
  studentEmail!: string;
  itemType!: AdminPaymentItemType;
  itemId!: string;
  itemTitle?: string;
  amount!: number;
  currency!: string;
  status!: AdminPaymentOrderStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  receipt?: string;
  createdAt?: string;
  updatedAt?: string;
}
