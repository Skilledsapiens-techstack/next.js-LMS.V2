import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type WebsiteInquiryStatus = 'new' | 'contacted' | 'archived';
export type WebsiteNavModuleStatus = 'visible' | 'hidden';

export type WebsiteCampusInquiry = {
  createdAt?: string;
  designation: string;
  email: string;
  id: string;
  institutionName: string;
  interestedIn: string;
  metadata?: Record<string, unknown>;
  message?: string | null;
  name: string;
  partnerType: string;
  phone: string;
  sourcePage: string;
  status: WebsiteInquiryStatus;
  updatedAt?: string;
  updatedBy?: string | null;
};

export type WebsiteNavModule = {
  id: string;
  isCore: boolean;
  label: string;
  moduleKey: string;
  navGroup: 'main' | 'placement';
  settings?: Record<string, unknown>;
  slug: string;
  sortOrder: number;
  status: WebsiteNavModuleStatus;
  updatedAt?: string;
  updatedBy?: string | null;
};

export type WebsiteManagementQuery = {
  limit?: number;
  page?: number;
  search?: string;
  sourcePage?: string;
  status?: string;
};

export function useWebsiteCampusInquiries(query: WebsiteManagementQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 50;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const sourcePage = query.sourcePage ?? 'all';
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<WebsiteCampusInquiry>>('/admins/website-management/inquiries', {
        accessToken: accessToken ?? undefined,
        query: { limit, page, search, sort: 'newest', sourcePage, status }
      }),
    queryKey: ['website-campus-inquiries', accessToken, page, limit, status, sourcePage, search],
    staleTime: 30_000
  });
}

export function useWebsiteNavModules() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<WebsiteNavModule>>('/admins/website-management/modules', {
        accessToken: accessToken ?? undefined,
        query: { limit: 100, page: 1, sort: 'order', status: 'all' }
      }),
    queryKey: ['website-nav-modules-admin', accessToken],
    staleTime: 30_000
  });
}

export function useUpdateWebsiteInquiryStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WebsiteInquiryStatus }) =>
      apiPatch<WebsiteCampusInquiry, { status: WebsiteInquiryStatus }>(`/admins/website-management/inquiries/${encodeURIComponent(id)}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-campus-inquiries'] });
    }
  });
}

export function useUpdateWebsiteNavModuleStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WebsiteNavModuleStatus }) =>
      apiPatch<WebsiteNavModule, { status: WebsiteNavModuleStatus }>(`/admins/website-management/modules/${encodeURIComponent(id)}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-nav-modules-admin'] });
      queryClient.invalidateQueries({ queryKey: ['website-nav-modules-public'] });
    }
  });
}
