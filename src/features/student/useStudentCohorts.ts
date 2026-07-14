import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentCohortStatus = 'active' | 'upcoming' | 'completed';

export type StudentCohort = {
  cohortId?: string;
  domainKey?: string;
  endDate?: string;
  id: string;
  name: string;
  programKey?: string;
  programName?: string;
  selfPaced: boolean;
  startDate?: string;
  status: string;
  studentCount?: number;
  updatedAt?: string;
  whatsappGroupName?: string;
  whatsappLink?: string;
};

export type StudentCohortsQuery = {
  limit?: number;
  page?: number;
  search?: string;
  status?: StudentCohortStatus | 'all';
};

export function useStudentCohorts(query: StudentCohortsQuery) {
  const { accessToken } = useAuth();
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  const status = query.status ?? 'all';
  const search = query.search?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentCohort>>('/students/me/cohorts', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['student-cohorts', accessToken, page, limit, status, search],
    staleTime: 60_000
  });
}
