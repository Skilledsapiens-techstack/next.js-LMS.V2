import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentPaymentOrderStatus = 'created' | 'paid' | 'failed' | 'cancelled';
export type StudentPaymentItemType = 'group' | 'workshop' | 'resource';

export class StudentPaymentOrdersQueryDto extends PaginationQueryDto {
  search?: string;
  status: StudentPaymentOrderStatus | 'all' = 'all';
  itemType: StudentPaymentItemType | 'all' = 'all';
}

export class StudentPaymentOrderListItemDto {
  id!: string;
  orderId?: string;
  itemType!: StudentPaymentItemType;
  itemId!: string;
  itemTitle?: string;
  amount!: number;
  currency!: string;
  status!: StudentPaymentOrderStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  receipt?: string;
  createdAt?: string;
  updatedAt?: string;
}
