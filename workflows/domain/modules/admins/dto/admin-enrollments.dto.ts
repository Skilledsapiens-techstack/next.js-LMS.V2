import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminEnrollmentPaymentStatus =
  | 'pending_payment'
  | 'paid'
  | 'payment_received'
  | 'pending_review'
  | 'approved'
  | 'cohort_assigned'
  | 'activated'
  | 'completed'
  | 'rejected'
  | 'duplicate'
  | 'on_hold'
  | 'refunded'
  | 'exception';

export type AdminEnrollmentRequestType = 'razorpay' | 'manual';
export type AdminEnrollmentRequestItemType = 'program' | 'role';
export type AdminEnrollmentExceptionStatus = 'open' | 'resolved' | 'approved' | 'rejected';
export type AdminEnrollmentWebhookEventStatus =
  | 'received'
  | 'processed'
  | 'processed_with_exceptions'
  | 'duplicate'
  | 'invalid_signature'
  | 'skipped_failed'
  | 'skipped_refunded'
  | 'skipped_pending_payment'
  | 'failed';

export class AdminEnrollmentRequestsQueryDto extends PaginationQueryDto {
  search?: string;
  paymentStatus: AdminEnrollmentPaymentStatus | 'all' = 'all';
  requestType: AdminEnrollmentRequestType | 'all' = 'all';
  careerLevel?: string;
  personalMentor?: string;
}

export class AdminEnrollmentRequestListItemDto {
  id!: string;
  requestId!: string;
  studentName?: string;
  email?: string;
  phone?: string;
  collegeName?: string;
  careerLevel?: string;
  personalMentor?: string;
  requestType!: AdminEnrollmentRequestType;
  paymentStatus!: AdminEnrollmentPaymentStatus;
  paymentId?: string;
  orderId?: string;
  amountPaid?: number;
  currency?: string;
  paymentDate?: string;
  exceptionCount!: number;
  activatedStudentId?: string;
  activatedAt?: string;
  activatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class AdminEnrollmentRequestItemDto {
  id!: string;
  itemId!: string;
  requestId!: string;
  itemName!: string;
  itemType!: AdminEnrollmentRequestItemType;
  programKey?: string;
  roleId?: string;
  selectionOrder!: number;
  assignedCohortId?: string;
  assignedCohortName?: string;
  aliasSource?: string;
  mappingConfidence?: number;
  status!: AdminEnrollmentPaymentStatus;
  assignedAt?: string;
  assignedBy?: string;
  activatedAt?: string;
  activatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class AdminEnrollmentStatusHistoryDto {
  id!: string;
  requestId!: string;
  itemId?: string;
  previousStatus?: string;
  newStatus!: string;
  actorEmail?: string;
  notes?: string;
  fieldName?: string;
  changedBy?: string;
  reason?: string;
  createdAt!: string;
}

export class AdminEnrollmentRequestDetailDto {
  request!: AdminEnrollmentRequestListItemDto;
  items!: AdminEnrollmentRequestItemDto[];
  history!: AdminEnrollmentStatusHistoryDto[];
  itemLimit!: number;
  historyLimit!: number;
  hasMoreItems!: boolean;
  hasMoreHistory!: boolean;
}

export class AdminEnrollmentExceptionsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminEnrollmentExceptionStatus | 'all' = 'all';
  exceptionType?: string;
}

export class AdminEnrollmentExceptionListItemDto {
  id!: string;
  exceptionId!: string;
  requestId?: string;
  itemId?: string;
  paymentId?: string;
  studentEmail?: string;
  studentName?: string;
  exceptionType!: string;
  errorMessage!: string;
  rawValue?: string;
  suggestedProgramKey?: string;
  status!: AdminEnrollmentExceptionStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class AdminEnrollmentWebhookEventsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminEnrollmentWebhookEventStatus | 'all' = 'all';
}

export class AdminEnrollmentWebhookEventListItemDto {
  id!: string;
  eventId!: string;
  eventType?: string;
  paymentId?: string;
  orderId?: string;
  requestId?: string;
  status!: AdminEnrollmentWebhookEventStatus;
  errorMessage?: string;
  processedAt?: string;
  createdAt?: string;
}
