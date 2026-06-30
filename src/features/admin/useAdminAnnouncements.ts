import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminAnnouncementStatus = 'active' | 'inactive';
export type AdminAnnouncementPriority = 'normal' | 'important' | 'urgent';
export type AdminAnnouncementAudience = 'all' | 'program' | 'cohort';

export type AdminAnnouncement = {
  announcementId?: string;
  audience: AdminAnnouncementAudience;
  cohortNames: string[];
  endDate?: string;
  id: string;
  linkLabel?: string;
  linkUrl?: string;
  message: string;
  pinned: boolean;
  priority: AdminAnnouncementPriority;
  programKeys: string[];
  startDate?: string;
  status: AdminAnnouncementStatus;
  title: string;
  type?: string;
  updatedAt?: string;
};

export type AdminAnnouncementsQuery = {
  audience?: AdminAnnouncementAudience | 'any';
  limit?: number;
  page?: number;
  priority?: AdminAnnouncementPriority | 'all';
  search?: string;
  status?: AdminAnnouncementStatus | 'all';
};

export function useAdminAnnouncements(query: AdminAnnouncementsQuery) {
  const { accessToken } = useAuth();
  const audience = query.audience ?? 'any';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const priority = query.priority ?? 'all';
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminAnnouncement>>('/admins/announcements', {
        accessToken: accessToken ?? undefined,
        query: {
          audience,
          limit,
          page,
          priority,
          search,
          status
        }
      }),
    queryKey: ['admin-announcements', accessToken, page, limit, status, priority, audience, search],
    staleTime: 60_000
  });
}
