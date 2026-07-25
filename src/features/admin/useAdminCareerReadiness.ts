import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { CareerReadinessCategory, CareerReadinessLinkButton, StudentCareerReadinessContent } from '../student/useStudentCareerReadiness';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminCareerReadinessContent = StudentCareerReadinessContent & {
  createdAt?: string;
  createdBy?: string;
  guestAccessEnabled?: boolean;
  guestAccessExpiresAt?: string | null;
  guestCtaLabel?: string | null;
  guestCtaUrl?: string | null;
  guestRegistrationRequired?: boolean;
  updatedBy?: string;
};

export type AdminCareerReadinessWritePayload = {
  category: CareerReadinessCategory;
  cohortNames: string[];
  content?: string | null;
  description?: string | null;
  guestAccessEnabled?: boolean;
  guestAccessExpiresAt?: string | null;
  guestCtaLabel?: string | null;
  guestCtaUrl?: string | null;
  guestRegistrationRequired?: boolean;
  isPublished: boolean;
  linkButtons: CareerReadinessLinkButton[];
  linkLabel?: string | null;
  linkUrl?: string | null;
  programKeys: string[];
  sectionTitle: string;
  sortOrder: number;
  title: string;
};

export type AdminCareerReadinessQuery = {
  category?: CareerReadinessCategory | 'all';
  limit?: number;
  page?: number;
  published?: 'all' | 'draft' | 'published';
  search?: string;
};

export function useAdminCareerReadiness(query: AdminCareerReadinessQuery) {
  const { accessToken } = useAuth();
  const category = query.category ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const published = query.published ?? 'all';
  const search = query.search?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminCareerReadinessContent>>('/admins/career-readiness-content', {
        accessToken: accessToken ?? undefined,
        query: {
          category: category === 'all' ? undefined : category,
          limit,
          page,
          published,
          search,
          sort: 'order'
        }
      }),
    queryKey: ['admin-career-readiness', accessToken, page, limit, category, published, search],
    staleTime: 60_000
  });
}

export function useSaveAdminCareerReadiness() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminCareerReadinessWritePayload) =>
      apiPost<AdminCareerReadinessContent, AdminCareerReadinessWritePayload>('/admins/career-readiness-content', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-career-readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['student-career-readiness'] });
    }
  });
}

export function useUpdateAdminCareerReadiness() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, contentId }: { body: AdminCareerReadinessWritePayload; contentId: string }) =>
      apiPatch<AdminCareerReadinessContent, AdminCareerReadinessWritePayload>(`/admins/career-readiness-content/${contentId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-career-readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['student-career-readiness'] });
    }
  });
}

export function useToggleAdminCareerReadinessStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contentId, isPublished }: { contentId: string; isPublished: boolean }) =>
      apiPatch<AdminCareerReadinessContent, { isPublished: boolean }>(`/admins/career-readiness-content/${contentId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { isPublished }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-career-readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['student-career-readiness'] });
    }
  });
}
