import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminPaymentOrderStatus = 'created' | 'paid' | 'failed' | 'cancelled';
export type AdminPaymentItemType = 'group' | 'workshop' | 'resource';
export type AdminPaidAccessStatus = 'active' | 'inactive';
export type AdminPaidAccessItemType = AdminPaymentItemType;

export type AdminPaymentOrder = {
  amount: number;
  createdAt?: string;
  currency: string;
  id: string;
  itemId: string;
  itemTitle?: string;
  itemType: AdminPaymentItemType;
  orderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  receipt?: string;
  status: AdminPaymentOrderStatus;
  studentEmail: string;
  updatedAt?: string;
};

export type AdminPaidAccess = {
  accessId?: string;
  activeNow: boolean;
  amount?: number;
  currency?: string;
  expiresAt?: string;
  grantedAt?: string;
  id: string;
  itemId: string;
  itemType: AdminPaidAccessItemType;
  notes?: string;
  paymentId?: string;
  source?: string;
  status: AdminPaidAccessStatus;
  studentEmail: string;
};

export type AdminPaymentOrdersQuery = {
  itemType?: AdminPaymentItemType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminPaymentOrderStatus | 'all';
};

export type AdminPaidAccessQuery = {
  itemType?: AdminPaidAccessItemType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminPaidAccessStatus | 'all';
};

export function useAdminPaymentOrders(query: AdminPaymentOrdersQuery) {
  const { accessToken } = useAuth();
  const itemType = query.itemType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminPaymentOrder>>('/admins/payment-orders', {
        accessToken: accessToken ?? undefined,
        query: { itemType, limit, page, search, status }
      }),
    queryKey: ['admin-payment-orders', accessToken, page, limit, status, itemType, search],
    staleTime: 60_000
  });
}

export function useAdminPaidAccess(query: AdminPaidAccessQuery) {
  const { accessToken } = useAuth();
  const itemType = query.itemType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminPaidAccess>>('/admins/paid-access', {
        accessToken: accessToken ?? undefined,
        query: { itemType, limit, page, search, status }
      }),
    queryKey: ['admin-paid-access', accessToken, page, limit, status, itemType, search],
    staleTime: 60_000
  });
}
