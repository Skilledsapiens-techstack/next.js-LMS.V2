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
  paymentLink?: string;
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

export type StudentResourcesSummary = {
  available: number;
  free: number;
  locked: number;
  paid: number;
  recentlyAdded: number;
  typeCounts: Record<string, number>;
};

export type StudentResourcesResponse = PaginatedResponse<StudentResource> & {
  summary?: StudentResourcesSummary;
};

export type StudentResourcesQuery = {
  accessType?: StudentResourceAccessType | 'all';
  locked?: boolean | 'all';
  limit?: number;
  page?: number;
  programKey?: string;
  resourceType?: string;
  search?: string;
};

export function useStudentResources(query: StudentResourcesQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const locked = query.locked ?? 'all';
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const resourceType = query.resourceType?.trim();
  const search = query.search?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<StudentResourcesResponse>('/students/me/resources', {
        accessToken: accessToken ?? undefined,
        query: {
          accessType,
          limit,
          locked,
          page,
          programKey,
          resourceType,
          search
        }
      }),
    queryKey: ['student-resources', accessToken, page, limit, accessType, locked, programKey, resourceType, search],
    staleTime: 60_000
  });
}
