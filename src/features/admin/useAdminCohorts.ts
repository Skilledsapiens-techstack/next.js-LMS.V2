import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminCohortStatus = 'upcoming' | 'active' | 'completed' | 'inactive';

export type AdminCohort = {
  cohortId?: string;
  domainKey?: string;
  endDate?: string;
  googleGroup?: string;
  id: string;
  name: string;
  programKey?: string;
  selfPaced: boolean;
  selfPacedResources: unknown[];
  selfPacedSessions: unknown[];
  startDate?: string;
  status: AdminCohortStatus;
  studentCount: number;
  updatedAt?: string;
  waLink?: string;
  waGroupName?: string;
};

export type AdminCohortsQuery = {
  limit?: number;
  page?: number;
  program?: string;
  search?: string;
  sort?: string;
  status?: AdminCohortStatus | 'all';
};

export type AdminCreateCohortPayload = {
  cohortId?: string;
  domainKey?: string;
  endDate?: string;
  googleGroup?: string;
  name: string;
  programKey: string;
  selfPaced?: boolean;
  selfPacedResources?: unknown[];
  selfPacedSessions?: unknown[];
  startDate?: string;
  status: AdminCohortStatus;
  studentCount?: number;
  waGroupName?: string;
  waLink?: string;
};

export type AdminUpdateCohortPayload = Partial<AdminCreateCohortPayload>;

export function useAdminCohorts(query: AdminCohortsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const program = query.program?.trim();
  const search = query.search?.trim();
  const sort = query.sort?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminCohort>>('/admins/cohorts', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          program,
          search,
          sort,
          status
        }
      }),
    queryKey: ['admin-cohorts', accessToken, page, limit, status, search, program, sort],
    staleTime: 60_000
  });
}

export function useCreateAdminCohort() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminCreateCohortPayload) =>
      apiPost<AdminCohort, AdminCreateCohortPayload>('/admins/cohorts', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cohorts'] })
  });
}

export function useUpdateAdminCohort() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cohortId, body }: { body: AdminUpdateCohortPayload; cohortId: string }) =>
      apiPatch<AdminCohort, AdminUpdateCohortPayload>(`/admins/cohorts/${cohortId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cohorts'] })
  });
}

export function useUpdateAdminCohortStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cohortId, status }: { cohortId: string; status: AdminCohortStatus }) =>
      apiPatch<AdminCohort, { status: AdminCohortStatus }>(`/admins/cohorts/${cohortId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-cohorts'] })
  });
}
