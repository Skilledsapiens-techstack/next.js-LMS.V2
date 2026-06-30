import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentScheduleAccessType = 'free' | 'paid';
export type StudentScheduleStatus = 'Upcoming' | 'Scheduled' | 'Live';

export type StudentScheduleItem = {
  accessType: StudentScheduleAccessType;
  cohortNames: string[];
  currency?: string;
  date: string;
  domainKey?: string;
  durationMinutes?: number;
  hasAccess: boolean;
  id: string;
  joinUrl?: string;
  locked: boolean;
  lockReason?: string;
  price?: number;
  programKey?: string;
  status: StudentScheduleStatus;
  time?: string;
  title: string;
  workshopId?: string;
};

export type StudentScheduleQuery = {
  accessType?: StudentScheduleAccessType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: StudentScheduleStatus | 'all';
};

export function useStudentSchedule(query: StudentScheduleQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentScheduleItem>>('/students/me/schedule', {
        accessToken: accessToken ?? undefined,
        query: {
          accessType,
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['student-schedule', accessToken, page, limit, accessType, status, search],
    staleTime: 60_000
  });
}
