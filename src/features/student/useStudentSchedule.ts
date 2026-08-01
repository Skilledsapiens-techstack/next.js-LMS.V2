import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentScheduleAccessType = 'free' | 'paid';
export type StudentSessionType = 'workshop' | 'doubt_session';
export type StudentScheduleStatus = 'Upcoming' | 'Scheduled' | 'Live' | 'Completed';

export type StudentScheduleItem = {
  accessType: StudentScheduleAccessType;
  cohortNames: string[];
  currency?: string | null;
  date: string;
  domainKey?: string;
  durationMinutes?: number;
  hasAccess: boolean;
  id: string;
  joinUrl?: string;
  locked: boolean;
  lockReason?: string;
  paymentLink?: string;
  price?: number | null;
  programKey?: string;
  sessionType?: StudentSessionType;
  status: StudentScheduleStatus;
  time?: string;
  title: string;
  workshopId?: string;
};

export type StudentScheduleQuery = {
  accessType?: StudentScheduleAccessType | 'all';
  enabled?: boolean;
  includePast?: boolean;
  limit?: number;
  page?: number;
  search?: string;
  sessionType?: StudentSessionType | 'all';
  status?: StudentScheduleStatus | 'all';
};

export function useStudentSchedule(query: StudentScheduleQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const includePast = query.includePast ?? false;
  const search = query.search?.trim();
  const sessionType = query.sessionType ?? 'all';
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<StudentScheduleItem>>('/students/me/schedule', {
        accessToken: accessToken ?? undefined,
        query: {
          accessType,
          includePast,
          limit,
          page,
          search,
          sessionType,
          status
        }
      }),
    queryKey: ['student-schedule', accessToken, page, limit, accessType, includePast, status, search, sessionType],
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 60_000
  });
}
