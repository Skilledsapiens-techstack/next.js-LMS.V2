import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentPaymentOrderStatus = 'created' | 'paid' | 'failed' | 'cancelled';
export type StudentPaymentItemType = 'group' | 'workshop' | 'resource';

export type StudentPaymentOrder = {
  amount: number;
  createdAt?: string;
  currency: string;
  id: string;
  itemId: string;
  itemTitle?: string;
  itemType: StudentPaymentItemType;
  orderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  receipt?: string;
  status: StudentPaymentOrderStatus;
  updatedAt?: string;
};

export type StudentPaymentOrdersQuery = {
  itemType?: StudentPaymentItemType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: StudentPaymentOrderStatus | 'all';
};

export function useStudentPaymentOrders(query: StudentPaymentOrdersQuery) {
  const { accessToken } = useAuth();
  const itemType = query.itemType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentPaymentOrder>>('/students/me/payment-orders', {
        accessToken: accessToken ?? undefined,
        query: {
          itemType,
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['student-payment-orders', accessToken, page, limit, status, itemType, search],
    staleTime: 60_000
  });
}
