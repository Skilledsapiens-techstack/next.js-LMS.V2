import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentPaidAccessStatus = 'active' | 'inactive';
export type StudentPaidAccessItemType = 'group' | 'workshop' | 'resource';

export type StudentPaidAccess = {
  accessId?: string;
  activeNow: boolean;
  amount?: number;
  currency?: string;
  expiresAt?: string;
  grantedAt?: string;
  id: string;
  itemId: string;
  itemType: StudentPaidAccessItemType;
  paymentId?: string;
  source?: string;
  status: StudentPaidAccessStatus;
};

export type StudentPaidAccessQuery = {
  itemType?: StudentPaidAccessItemType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: StudentPaidAccessStatus | 'all';
};

export function useStudentPaidAccess(query: StudentPaidAccessQuery) {
  const { accessToken } = useAuth();
  const itemType = query.itemType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentPaidAccess>>('/students/me/paid-access', {
        accessToken: accessToken ?? undefined,
        query: {
          itemType,
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['student-paid-access', accessToken, page, limit, status, itemType, search],
    staleTime: 60_000
  });
}
