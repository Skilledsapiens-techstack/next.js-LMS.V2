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

export type AdminCohortImpact = {
  announcements: number;
  auditLogs: Array<{ action: string; actorEmail?: string; createdAt?: string; id: string; status?: string }>;
  resources: number;
  students: number;
  workshops: number;
};

export type AdminCohortsQuery = {
  enabled?: boolean;
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
    enabled: Boolean(accessToken) && query.enabled !== false,
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

export function useExportAdminCohorts() {
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: async (query: AdminCohortsQuery) => {
      const allItems: AdminCohort[] = [];
      let currentPage = 1;
      let latestResponse: PaginatedResponse<AdminCohort> | null = null;

      do {
        latestResponse = await apiGet<PaginatedResponse<AdminCohort>>('/admins/cohorts', {
          accessToken: accessToken ?? undefined,
          query: {
            limit: 500,
            page: currentPage,
            program: query.program?.trim(),
            search: query.search?.trim(),
            sort: query.sort?.trim(),
            status: query.status ?? 'all'
          }
        });
        allItems.push(...latestResponse.items);
        currentPage += 1;
      } while (latestResponse.hasNextPage && currentPage <= 100);

      return latestResponse ? { ...latestResponse, items: allItems, page: 1, totalPages: 1 } : { hasNextPage: false, hasPreviousPage: false, items: allItems, limit: 500, page: 1, total: 0, totalPages: 1 };
    }
  });
}

function includesCohortName(row: unknown, cohortName: string) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const record = row as Record<string, unknown>;
  const names = record.cohortNames ?? record.cohort_names;
  if (!Array.isArray(names)) return false;
  return names.some((name) => String(name ?? '').trim() === cohortName);
}

export function useAdminCohortImpact(cohort?: Pick<AdminCohort, 'id' | 'name'> | null) {
  const { accessToken } = useAuth();
  const cohortName = cohort?.name?.trim();
  const cohortId = cohort?.id?.trim();

  return useQuery({
    enabled: Boolean(accessToken && cohortName && cohortId),
    queryFn: async () => {
      const [students, resources, workshops, announcements, auditLogs] = await Promise.all([
        apiGet<PaginatedResponse<unknown>>('/admins/students', {
          accessToken: accessToken ?? undefined,
          query: { cohortName, limit: 1, page: 1, status: 'all' }
        }),
        apiGet<PaginatedResponse<unknown>>('/admins/resources', {
          accessToken: accessToken ?? undefined,
          query: { cohortName, limit: 1, page: 1, status: 'all' }
        }),
        apiGet<PaginatedResponse<unknown>>('/admins/workshops', {
          accessToken: accessToken ?? undefined,
          query: { limit: 500, page: 1, status: 'all' }
        }),
        apiGet<PaginatedResponse<unknown>>('/admins/announcements', {
          accessToken: accessToken ?? undefined,
          query: { audience: 'cohort', limit: 500, page: 1, status: 'all' }
        }),
        apiGet<PaginatedResponse<{ action: string; actorEmail?: string; createdAt?: string; id: string; status?: string }>>('/admins/audit-logs', {
          accessToken: accessToken ?? undefined,
          query: { entityId: cohortId, entityType: 'cohort', limit: 8, page: 1, sort: 'newest' }
        })
      ]);

      return {
        announcements: announcements.items.filter((item) => includesCohortName(item, cohortName ?? '')).length,
        auditLogs: auditLogs.items,
        resources: resources.total,
        students: students.total,
        workshops: workshops.items.filter((item) => includesCohortName(item, cohortName ?? '')).length
      } satisfies AdminCohortImpact;
    },
    queryKey: ['admin-cohort-impact', accessToken, cohortId, cohortName],
    staleTime: 30_000
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
