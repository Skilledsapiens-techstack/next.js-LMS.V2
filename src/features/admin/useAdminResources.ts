import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminResourceStatus = 'active' | 'inactive';
export type AdminResourceAccessType = 'free' | 'paid';

export type AdminResource = {
  accessType: AdminResourceAccessType;
  cohortNames: string[];
  currency: string;
  description?: string;
  domainKey?: string;
  id: string;
  phase?: string;
  price?: number;
  programKeys: string[];
  resourceId?: string;
  resourceMode?: string;
  resourceType: string;
  status: AdminResourceStatus;
  title: string;
  updatedAt?: string;
  url?: string;
};

export type AdminResourcesQuery = {
  accessType?: AdminResourceAccessType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminResourceStatus | 'all';
};

export function useAdminResources(query: AdminResourcesQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminResource>>('/admins/resources', {
        accessToken: accessToken ?? undefined,
        query: {
          accessType,
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['admin-resources', accessToken, page, limit, status, accessType, search],
    staleTime: 60_000
  });
}
