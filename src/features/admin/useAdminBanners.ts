import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';
import { StudentBannerDisplayType, StudentBannerPriority } from '../student/useStudentBanners';

export type AdminBannerStatus = 'active' | 'inactive' | 'draft';
export type AdminBannerAudience = 'all' | 'program' | 'cohort' | 'student' | 'access';
export type AdminBannerType = 'general' | 'launch' | 'product' | 'workshop' | 'offer' | 'maintenance' | 'custom';

export type AdminBanner = {
  audience: AdminBannerAudience;
  bannerId?: string;
  bannerType: AdminBannerType;
  cohortNames: string[];
  createdAt?: string;
  createdBy?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  customType?: string;
  displayType: StudentBannerDisplayType;
  endAt?: string;
  id: string;
  message: string;
  priority: StudentBannerPriority;
  programKeys: string[];
  requireAcknowledgement: boolean;
  startAt?: string;
  status: AdminBannerStatus;
  studentEmails: string[];
  targetAtsCredits: boolean;
  targetPaidAccess: boolean;
  title: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type AdminBannersQuery = {
  audience?: AdminBannerAudience | 'any';
  displayType?: StudentBannerDisplayType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminBannerStatus | 'all';
  type?: AdminBannerType | 'all';
};

export type AdminBannerWritePayload = {
  audience: AdminBannerAudience;
  bannerType: AdminBannerType;
  cohortNames: string[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  customType?: string | null;
  displayType: StudentBannerDisplayType;
  endAt?: string | null;
  message: string;
  priority: StudentBannerPriority;
  programKeys: string[];
  requireAcknowledgement: boolean;
  startAt?: string | null;
  status: AdminBannerStatus;
  studentEmails: string[];
  targetAtsCredits: boolean;
  targetPaidAccess: boolean;
  title: string;
};

export function useAdminBanners(query: AdminBannersQuery) {
  const { accessToken } = useAuth();
  const audience = query.audience ?? 'any';
  const displayType = query.displayType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';
  const type = query.type ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminBanner>>('/admins/banners', {
        accessToken: accessToken ?? undefined,
        query: { audience, displayType, limit, page, search, status, type }
      }),
    queryKey: ['admin-banners', accessToken, page, limit, status, audience, displayType, type, search],
    staleTime: 30_000
  });
}

export function useCreateAdminBanner() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminBannerWritePayload) =>
      apiPost<AdminBanner, AdminBannerWritePayload>('/admins/banners', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['student-banners'] });
    }
  });
}

export function useUpdateAdminBanner() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bannerId, body }: { bannerId: string; body: Partial<AdminBannerWritePayload> }) =>
      apiPatch<AdminBanner, Partial<AdminBannerWritePayload>>(`/admins/banners/${bannerId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['student-banners'] });
    }
  });
}

export function useUpdateAdminBannerStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bannerId, status }: { bannerId: string; status: AdminBannerStatus }) =>
      apiPatch<AdminBanner, { status: AdminBannerStatus }>(`/admins/banners/${bannerId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['student-banners'] });
    }
  });
}

export function useArchiveAdminBanner() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bannerId: string) =>
      apiPatch<AdminBanner, Record<string, never>>(`/admins/banners/${bannerId}/archive`, {
        accessToken: accessToken ?? undefined,
        body: {}
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['student-banners'] });
    }
  });
}
