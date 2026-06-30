import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminProgramStatus = 'active' | 'inactive';

export type AdminProgram = {
  domainLabel?: string;
  id: string;
  name: string;
  programKey: string;
  shortName?: string;
  status: AdminProgramStatus;
  updatedAt?: string;
};

export type AdminProgramsQuery = {
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminProgramStatus | 'all';
};

export function useAdminPrograms(query: AdminProgramsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminProgram>>('/admins/programs', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['admin-programs', accessToken, page, limit, status, search],
    staleTime: 60_000
  });
}
