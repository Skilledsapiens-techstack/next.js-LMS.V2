import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminProjectToolkitStatus = 'active' | 'inactive';
export type AdminProjectToolkitType = 'guidelines' | 'sow_link' | 'framework' | 'custom';

export type AdminProjectToolkitItem = {
  content?: string;
  id: string;
  itemType: AdminProjectToolkitType;
  linkLabel?: string;
  linkUrl?: string;
  programKeys: string[];
  sortOrder?: number;
  status: AdminProjectToolkitStatus;
  summary?: string;
  title: string;
  toolkitId: string;
  updatedAt?: string;
};

export type AdminProjectToolkitWritePayload = {
  content?: string;
  itemType: AdminProjectToolkitType;
  linkLabel?: string | null;
  linkUrl?: string | null;
  programKeys: string[];
  sortOrder?: number;
  status: AdminProjectToolkitStatus;
  summary?: string;
  title: string;
  toolkitId?: string;
};

export type AdminProjectToolkitQuery = {
  enabled?: boolean;
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminProjectToolkitStatus | 'all';
  type?: AdminProjectToolkitType | 'all';
};

export function useAdminProjectToolkit(query: AdminProjectToolkitQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 50;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';
  const type = query.type ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminProjectToolkitItem>>('/admins/project-toolkit', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          search,
          sort: 'order',
          status,
          type
        }
      }),
    queryKey: ['admin-project-toolkit', accessToken, page, limit, status, type, search],
    staleTime: 60_000
  });
}

export function useCreateAdminProjectToolkitItem() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminProjectToolkitWritePayload) =>
      apiPost<AdminProjectToolkitItem, AdminProjectToolkitWritePayload>('/admins/project-toolkit', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-toolkit'] });
      queryClient.invalidateQueries({ queryKey: ['student-project-toolkit'] });
    }
  });
}

export function useUpdateAdminProjectToolkitItem() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, itemId }: { body: Partial<AdminProjectToolkitWritePayload>; itemId: string }) =>
      apiPatch<AdminProjectToolkitItem, Partial<AdminProjectToolkitWritePayload>>(`/admins/project-toolkit/${itemId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-toolkit'] });
      queryClient.invalidateQueries({ queryKey: ['student-project-toolkit'] });
    }
  });
}

export function useUpdateAdminProjectToolkitItemStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: AdminProjectToolkitStatus }) =>
      apiPatch<AdminProjectToolkitItem, { status: AdminProjectToolkitStatus }>(`/admins/project-toolkit/${itemId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-toolkit'] });
      queryClient.invalidateQueries({ queryKey: ['student-project-toolkit'] });
    }
  });
}
