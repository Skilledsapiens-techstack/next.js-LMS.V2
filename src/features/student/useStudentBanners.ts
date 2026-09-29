import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentBannerDisplayType =
  | 'login_popup'
  | 'top_running'
  | 'top_sticky'
  | 'bottom_sticky'
  | 'bottom_right_floating'
  | 'floating_bell';

export type StudentBannerPriority = 'low' | 'normal' | 'high' | 'urgent';

export type StudentBanner = {
  bannerId?: string;
  bannerType: string;
  cohortNames: string[];
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
  studentEmails: string[];
  title: string;
  updatedAt?: string;
};

export type StudentBannersQuery = {
  enabled?: boolean;
  limit?: number;
  page?: number;
};

export function useStudentBanners(query: StudentBannersQuery = {}) {
  const { accessToken } = useAuth();
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<StudentBanner>>('/students/me/banners', {
        accessToken: accessToken ?? undefined,
        query: { limit, page }
      }),
    queryKey: ['student-banners', accessToken, page, limit],
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false,
    staleTime: 0
  });
}

export function useDismissStudentBanner() {
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: ({ acknowledged, bannerId }: { acknowledged: boolean; bannerId: string }) =>
      apiPost<{ dismissed: boolean }, { acknowledged: boolean }>(`/students/me/banners/${bannerId}/dismiss`, {
        accessToken: accessToken ?? undefined,
        body: { acknowledged }
      })
  });
}
