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
  resourceDomainKey?: string | null;
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
  domainCounts: Record<string, number>;
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
  resourceDomainKey?: string;
  resourceType?: string;
  search?: string;
};

export type StudentResourceDomain = {
  count: number;
  domainKey: string;
  label: string;
  sortOrder: number;
};

export function useStudentResources(query: StudentResourcesQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const locked = query.locked ?? 'all';
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const resourceDomainKey = query.resourceDomainKey?.trim();
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
          resourceDomainKey,
          resourceType,
          search
        }
      }),
    queryKey: ['student-resources', accessToken, page, limit, accessType, locked, programKey, resourceDomainKey, resourceType, search],
    staleTime: 60_000
  });
}

export function useStudentResourceDomains(query: Pick<StudentResourcesQuery, 'programKey' | 'resourceType'> = {}) {
  const { accessToken } = useAuth();
  const programKey = query.programKey?.trim();
  const resourceType = query.resourceType?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<StudentResourceDomain[]>('/students/me/resource-domains', {
        accessToken: accessToken ?? undefined,
        query: {
          programKey,
          resourceType
        }
      }),
    queryKey: ['student-resource-domains', accessToken, programKey, resourceType],
    staleTime: 60_000
  });
}
