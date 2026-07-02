import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';

export type StudentAnnouncementPriority = 'normal' | 'important' | 'urgent';

export type StudentAnnouncement = {
  announcementId?: string;
  audience?: string;
  cohortNames: string[];
  endDate?: string;
  id: string;
  linkLabel?: string;
  linkUrl?: string;
  message: string;
  pinned: boolean;
  priority: StudentAnnouncementPriority;
  programKeys: string[];
  startDate?: string;
  title: string;
  type?: string;
  updatedAt?: string;
};

export type PaginatedResponse<TItem> = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  items: TItem[];
  limit: number;
  summary?: Record<string, unknown>;
  page: number;
  total: number;
  totalPages: number;
};

export type StudentAnnouncementsQuery = {
  limit?: number;
  page?: number;
  priority?: StudentAnnouncementPriority | 'all';
  search?: string;
};

export function useStudentAnnouncements(query: StudentAnnouncementsQuery) {
  const { accessToken } = useAuth();
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  const priority = query.priority ?? 'all';
  const search = query.search?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentAnnouncement>>('/students/me/announcements', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          priority,
          search
        }
      }),
    queryKey: ['student-announcements', accessToken, page, limit, priority, search],
    staleTime: 60_000
  });
}
