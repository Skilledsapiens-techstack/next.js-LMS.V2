import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentResourceAccessType = 'free' | 'paid';

export type StudentResource = {
  accessType: StudentResourceAccessType;
  cohortNames: string[];
  currency?: string;
  description?: string;
  hasAccess: boolean;
  id: string;
  locked: boolean;
  lockReason?: string;
  phase?: string;
  price?: number;
  programKeys: string[];
  resourceId?: string;
  resourceMode?: string;
  resourceType: string;
  title: string;
  updatedAt?: string;
  url?: string;
};

export type StudentResourcesQuery = {
  accessType?: StudentResourceAccessType | 'all';
  limit?: number;
  page?: number;
  resourceType?: string;
  search?: string;
};

export function useStudentResources(query: StudentResourcesQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const resourceType = query.resourceType?.trim();
  const search = query.search?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentResource>>('/students/me/resources', {
        accessToken: accessToken ?? undefined,
        query: {
          accessType,
          limit,
          page,
          resourceType,
          search
        }
      }),
    queryKey: ['student-resources', accessToken, page, limit, accessType, resourceType, search],
    staleTime: 60_000
  });
}
