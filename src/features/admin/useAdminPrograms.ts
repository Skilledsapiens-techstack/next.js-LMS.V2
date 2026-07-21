import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminProgramStatus = 'active' | 'inactive';

export type AdminProgram = {
  createdAt?: string;
  domainLabel?: string;
  id: string;
  name: string;
  programKey: string;
  shortName?: string;
  status: AdminProgramStatus;
  updatedAt?: string;
};

export type AdminProgramsQuery = {
  domain?: string;
  enabled?: boolean;
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminProgramStatus | 'all';
};

export type AdminProgramWritePayload = {
  domainLabel?: string;
  name: string;
  programKey?: string;
  shortName?: string;
  status: AdminProgramStatus;
};

export type AdminStudentGuidanceContentStatus = 'active' | 'inactive';

export type AdminStudentGuidanceContent = {
  audience: 'leadership';
  content: string;
  contentKey: 'program_structure' | 'certificate_structure';
  createdAt?: string;
  id: string;
  sortOrder: number;
  status: AdminStudentGuidanceContentStatus;
  summary?: string;
  title: string;
  updatedAt?: string;
};

export type AdminStudentGuidanceContentWritePayload = {
  audience?: 'leadership';
  content?: string;
  sortOrder?: number;
  status?: AdminStudentGuidanceContentStatus;
  summary?: string | null;
  title?: string;
};

export type AdminProgramImpact = {
  auditLogs: Array<{ action: string; actorEmail?: string; createdAt?: string; id: string; status?: string }>;
  cohorts: number;
  resources: number;
  students: number;
  workshops: number;
};

export function useAdminPrograms(query: AdminProgramsQuery) {
  const { accessToken } = useAuth();
  const domain = query.domain?.trim();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminProgram>>('/admins/programs', {
        accessToken: accessToken ?? undefined,
        query: {
          domain,
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['admin-programs', accessToken, page, limit, status, search, domain],
    staleTime: 60_000
  });
}

export function useAdminProgramImpact(program?: Pick<AdminProgram, 'id' | 'programKey'> | null) {
  const { accessToken } = useAuth();
  const programId = program?.id?.trim();
  const programKey = program?.programKey?.trim();

  return useQuery({
    enabled: Boolean(accessToken && programId && programKey),
    queryFn: async () => {
      const [cohorts, students, resources, workshops, auditLogs] = await Promise.all([
        apiGet<PaginatedResponse<unknown>>('/admins/cohorts', {
          accessToken: accessToken ?? undefined,
          query: { limit: 1, page: 1, program: programKey, status: 'all' }
        }),
        apiGet<PaginatedResponse<unknown>>('/admins/students', {
          accessToken: accessToken ?? undefined,
          query: { limit: 1, page: 1, programKey, status: 'all' }
        }),
        apiGet<PaginatedResponse<unknown>>('/admins/resources', {
          accessToken: accessToken ?? undefined,
          query: { limit: 1, page: 1, programKey, status: 'all' }
        }),
        apiGet<PaginatedResponse<unknown>>('/admins/workshops', {
          accessToken: accessToken ?? undefined,
          query: { limit: 1, page: 1, programKey, status: 'all' }
        }),
        apiGet<PaginatedResponse<{ action: string; actorEmail?: string; createdAt?: string; id: string; status?: string }>>('/admins/audit-logs', {
          accessToken: accessToken ?? undefined,
          query: { entityId: programId, entityType: 'program', limit: 8, page: 1, sort: 'newest' }
        })
      ]);

      return {
        auditLogs: auditLogs.items,
        cohorts: cohorts.total,
        resources: resources.total,
        students: students.total,
        workshops: workshops.total
      } satisfies AdminProgramImpact;
    },
    queryKey: ['admin-program-impact', accessToken, programId, programKey],
    staleTime: 30_000
  });
}

export function useAdminStudentGuidanceContent() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminStudentGuidanceContent>>('/admins/student-guidance-content', {
        accessToken: accessToken ?? undefined,
        query: { limit: 10, page: 1, sort: 'order', status: 'all' }
      }),
    queryKey: ['admin-student-guidance-content', accessToken],
    staleTime: 60_000
  });
}

export function useCreateAdminProgram() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminProgramWritePayload) =>
      apiPost<AdminProgram, AdminProgramWritePayload>('/admins/programs', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-programs'] })
  });
}

export function useUpdateAdminProgram() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, programId }: { body: Partial<AdminProgramWritePayload>; programId: string }) =>
      apiPatch<AdminProgram, Partial<AdminProgramWritePayload>>(`/admins/programs/${programId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-programs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-program-impact'] });
    }
  });
}

export function useUpdateAdminStudentGuidanceContent() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, contentId }: { body: AdminStudentGuidanceContentWritePayload; contentId: string }) =>
      apiPatch<AdminStudentGuidanceContent, AdminStudentGuidanceContentWritePayload>(`/admins/student-guidance-content/${contentId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-student-guidance-content'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    }
  });
}

export function useUpdateAdminProgramStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ programId, status }: { programId: string; status: AdminProgramStatus }) =>
      apiPatch<AdminProgram, { status: AdminProgramStatus }>(`/admins/programs/${programId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-programs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-program-impact'] });
    }
  });
}
