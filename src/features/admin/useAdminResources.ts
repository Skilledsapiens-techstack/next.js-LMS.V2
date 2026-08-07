import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminResourceStatus = 'active' | 'inactive';
export type AdminResourceAccessType = 'free' | 'paid';

export type AdminResource = {
  accessType: AdminResourceAccessType;
  cohortNames: string[];
  currency: string;
  description?: string;
  domainKey?: string;
  resourceDomainKey?: string | null;
  guestAccessEnabled?: boolean;
  guestAccessExpiresAt?: string | null;
  guestCtaLabel?: string | null;
  guestCtaUrl?: string | null;
  guestRegistrationRequired?: boolean;
  id: string;
  phase?: string;
  paymentLink?: string;
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

export type AdminResourceAuditLog = {
  action: string;
  actorEmail?: string;
  createdAt?: string;
  details?: {
    changedFields?: string[];
    resourceId?: string;
    status?: string;
    title?: string;
  };
  entityId?: string;
  entityType?: string;
  id: string;
  status?: string;
};

export type AdminResourceWritePayload = {
  accessType: AdminResourceAccessType;
  cohortNames: string[];
  currency?: string;
  description?: string | null;
  domainKey?: string | null;
  resourceDomainKey?: string | null;
  guestAccessEnabled?: boolean;
  guestAccessExpiresAt?: string | null;
  guestCtaLabel?: string | null;
  guestCtaUrl?: string | null;
  guestRegistrationRequired?: boolean;
  paymentLink?: string | null;
  price?: number | null;
  programKeys: string[];
  resourceId: string;
  resourceMode?: string;
  resourceType: string;
  status: AdminResourceStatus;
  title: string;
  url?: string | null;
};

export type AdminResourceDomainStatus = 'active' | 'inactive';

export type AdminResourceDomain = {
  createdAt?: string;
  description?: string | null;
  domainKey: string;
  id: string;
  label: string;
  sortOrder: number;
  status: AdminResourceDomainStatus;
  updatedAt?: string;
};

export type AdminResourceDomainWritePayload = {
  description?: string | null;
  domainKey: string;
  label: string;
  sortOrder: number;
  status: AdminResourceDomainStatus;
};

export type AdminResourcesQuery = {
  accessType?: AdminResourceAccessType | 'all';
  cohortName?: string;
  limit?: number;
  page?: number;
  programKey?: string;
  search?: string;
  status?: AdminResourceStatus | 'all';
};

export function useAdminResources(query: AdminResourcesQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const cohortName = query.cohortName?.trim();
  const programKey = query.programKey?.trim();
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminResource>>('/admins/resources', {
        accessToken: accessToken ?? undefined,
        query: {
          accessType,
          cohortName,
          limit,
          page,
          programKey,
          search,
          sort: 'newest',
          status
        }
      }),
    queryKey: ['admin-resources', accessToken, page, limit, status, accessType, programKey, cohortName, search],
    staleTime: 60_000
  });
}

export function useAdminResourceDomains() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminResourceDomain>>('/admins/resource-domains', {
        accessToken: accessToken ?? undefined,
        query: {
          limit: 100,
          page: 1,
          sort: 'order'
        }
      }),
    queryKey: ['admin-resource-domains', accessToken],
    staleTime: 60_000
  });
}

export function useSaveAdminResourceDomain() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminResourceDomainWritePayload) =>
      apiPost<AdminResourceDomain, AdminResourceDomainWritePayload>('/admins/resource-domains', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-resource-domains'] });
      void queryClient.invalidateQueries({ queryKey: ['student-resource-domains'] });
    }
  });
}

export function useUpdateAdminResourceDomain() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, domainId }: { body: AdminResourceDomainWritePayload; domainId: string }) =>
      apiPatch<AdminResourceDomain, AdminResourceDomainWritePayload>(`/admins/resource-domains/${domainId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-resource-domains'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      void queryClient.invalidateQueries({ queryKey: ['student-resource-domains'] });
      void queryClient.invalidateQueries({ queryKey: ['student-resources'] });
    }
  });
}

export function useAdminResourceAuditLogs(resourceId?: string | null) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken && resourceId),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminResourceAuditLog>>('/admins/audit-logs', {
        accessToken: accessToken ?? undefined,
        query: {
          entityId: resourceId ?? undefined,
          entityType: 'resource',
          limit: 8,
          page: 1,
          sort: 'newest'
        }
      }),
    queryKey: ['admin-resource-audit-logs', accessToken, resourceId],
    staleTime: 30_000
  });
}

export function useSaveAdminResource() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminResourceWritePayload) =>
      apiPost<AdminResource, AdminResourceWritePayload>('/admins/resources', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      void queryClient.invalidateQueries({ queryKey: ['student-resources'] });
    }
  });
}

export function useUpdateAdminResource() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, resourceId }: { body: AdminResourceWritePayload; resourceId: string }) =>
      apiPatch<AdminResource, AdminResourceWritePayload>(`/admins/resources/${resourceId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      void queryClient.invalidateQueries({ queryKey: ['student-resources'] });
    }
  });
}

export function useArchiveAdminResource() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resourceId: string) =>
      apiPatch<AdminResource>(`/admins/resources/${resourceId}/archive`, {
        accessToken: accessToken ?? undefined
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      void queryClient.invalidateQueries({ queryKey: ['student-resources'] });
    }
  });
}

export function useRestoreAdminResource() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resourceId: string) =>
      apiPatch<AdminResource>(`/admins/resources/${resourceId}/restore`, {
        accessToken: accessToken ?? undefined
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      void queryClient.invalidateQueries({ queryKey: ['student-resources'] });
    }
  });
}
