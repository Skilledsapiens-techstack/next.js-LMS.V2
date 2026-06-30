import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

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

export type AdminEnrollmentRequest = {
  activatedAt?: string;
  activatedBy?: string;
  activatedStudentId?: string;
  amountPaid?: number;
  careerLevel?: string;
  collegeName?: string;
  createdAt?: string;
  currency?: string;
  email?: string;
  exceptionCount: number;
  id: string;
  orderId?: string;
  paymentDate?: string;
  paymentId?: string;
  paymentStatus: AdminEnrollmentPaymentStatus;
  personalMentor?: string;
  phone?: string;
  requestId: string;
  requestType: AdminEnrollmentRequestType;
  studentName?: string;
  updatedAt?: string;
};

export type AdminEnrollmentRequestItem = {
  activatedAt?: string;
  activatedBy?: string;
  aliasSource?: string;
  assignedAt?: string;
  assignedBy?: string;
  assignedCohortId?: string;
  assignedCohortName?: string;
  createdAt?: string;
  id: string;
  itemId: string;
  itemName: string;
  itemType: AdminEnrollmentRequestItemType;
  mappingConfidence?: number;
  programKey?: string;
  requestId: string;
  roleId?: string;
  selectionOrder: number;
  status: AdminEnrollmentPaymentStatus;
  updatedAt?: string;
};

export type AdminEnrollmentStatusHistory = {
  actorEmail?: string;
  changedBy?: string;
  createdAt: string;
  fieldName?: string;
  id: string;
  itemId?: string;
  newStatus: string;
  notes?: string;
  previousStatus?: string;
  reason?: string;
  requestId: string;
};

export type AdminEnrollmentRequestDetail = {
  hasMoreHistory: boolean;
  hasMoreItems: boolean;
  history: AdminEnrollmentStatusHistory[];
  historyLimit: number;
  itemLimit: number;
  items: AdminEnrollmentRequestItem[];
  request: AdminEnrollmentRequest;
};

export type AdminEnrollmentException = {
  createdAt?: string;
  errorMessage: string;
  exceptionId: string;
  exceptionType: string;
  id: string;
  itemId?: string;
  paymentId?: string;
  rawValue?: string;
  requestId?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  status: AdminEnrollmentExceptionStatus;
  studentEmail?: string;
  studentName?: string;
  suggestedProgramKey?: string;
  updatedAt?: string;
};

export type AdminEnrollmentWebhookEvent = {
  createdAt?: string;
  errorMessage?: string;
  eventId: string;
  eventType?: string;
  id: string;
  orderId?: string;
  paymentId?: string;
  processedAt?: string;
  requestId?: string;
  status: AdminEnrollmentWebhookEventStatus;
};

export type AdminEnrollmentRequestsQuery = {
  careerLevel?: string;
  limit?: number;
  page?: number;
  paymentStatus?: AdminEnrollmentPaymentStatus | 'all';
  personalMentor?: string;
  requestType?: AdminEnrollmentRequestType | 'all';
  search?: string;
};

export type AdminEnrollmentExceptionsQuery = {
  exceptionType?: string;
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminEnrollmentExceptionStatus | 'all';
};

export type AdminEnrollmentWebhookEventsQuery = {
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminEnrollmentWebhookEventStatus | 'all';
};

export function useAdminEnrollmentRequests(query: AdminEnrollmentRequestsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const paymentStatus = query.paymentStatus ?? 'all';
  const requestType = query.requestType ?? 'all';
  const search = query.search?.trim();
  const careerLevel = query.careerLevel?.trim();
  const personalMentor = query.personalMentor?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEnrollmentRequest>>('/admins/enrollment-requests', {
        accessToken: accessToken ?? undefined,
        query: { careerLevel, limit, page, paymentStatus, personalMentor, requestType, search }
      }),
    queryKey: ['admin-enrollment-requests', accessToken, page, limit, paymentStatus, requestType, careerLevel, personalMentor, search],
    staleTime: 60_000
  });
}

export function useAdminEnrollmentRequestDetail(requestId: string | undefined) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken && requestId),
    queryFn: () =>
      apiGet<AdminEnrollmentRequestDetail>(`/admins/enrollment-requests/${encodeURIComponent(requestId ?? '')}`, {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-enrollment-request-detail', accessToken, requestId],
    staleTime: 60_000
  });
}

export function useAdminEnrollmentExceptions(query: AdminEnrollmentExceptionsQuery) {
  const { accessToken } = useAuth();
  const exceptionType = query.exceptionType?.trim();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEnrollmentException>>('/admins/enrollment-exceptions', {
        accessToken: accessToken ?? undefined,
        query: { exceptionType, limit, page, search, status }
      }),
    queryKey: ['admin-enrollment-exceptions', accessToken, page, limit, status, exceptionType, search],
    staleTime: 60_000
  });
}

export function useAdminEnrollmentWebhookEvents(query: AdminEnrollmentWebhookEventsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEnrollmentWebhookEvent>>('/admins/enrollment-webhook-events', {
        accessToken: accessToken ?? undefined,
        query: { limit, page, search, status }
      }),
    queryKey: ['admin-enrollment-webhook-events', accessToken, page, limit, status, search],
    staleTime: 60_000
  });
}
