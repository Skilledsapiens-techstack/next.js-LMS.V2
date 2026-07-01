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
