import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminStudentStatus = 'active' | 'inactive';

export type AdminStudent = {
  active: boolean;
  altEmail?: string;
  cohortName?: string;
  collegeName?: string;
  enrolledDate?: string;
  email: string;
  fullName: string;
  id: string;
  liveProjectDomains?: string[];
  onboardingMailStatus?: string;
  phone?: string;
  programName?: string;
  programs?: string[];
  slot?: string;
  studentId?: string;
  trackRoleIds: string[];
  updatedAt?: string;
  waGroup?: string;
};

export type AdminStudentsQuery = {
  cohortName?: string;
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminStudentStatus | 'all';
};

export type AdminStudentWritePayload = {
  active?: boolean;
  altEmail?: string;
  cohortIds?: string[];
  cohortNames?: string[];
  collegeName?: string;
  email: string;
  fullName: string;
  onboardingMailStatus?: 'pending' | 'sent' | 'failed' | 'skipped' | 'dry-run';
  phone?: string;
  programKeys?: string[];
  programNames?: string[];
  sendInvite?: boolean;
  slot?: string;
  studentId?: string;
  waGroup?: string;
};

export type AdminStudentImportResult = {
  created: number;
  failed: number;
  updated: number;
};

export type AdminStudentAttemptLimit = {
  maxAttempts: number;
  notes?: string;
  studentEmail: string;
  studentId: string;
  updatedAt?: string;
};

export function useAdminStudents(query: AdminStudentsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';
  const cohortName = query.cohortName?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminStudent>>('/admins/students', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          search,
          status,
          cohortName
        }
      }),
    queryKey: ['admin-students', accessToken, page, limit, status, search, cohortName],
    staleTime: 60_000
  });
}

export function useSaveAdminStudent() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminStudentWritePayload) =>
      apiPost<AdminStudent, AdminStudentWritePayload>('/admins/students', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] })
  });
}

export function useUpdateAdminStudent() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, studentId }: { body: AdminStudentWritePayload; studentId: string }) =>
      apiPatch<AdminStudent, AdminStudentWritePayload>(`/admins/students/${studentId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] })
  });
}

export function useUpdateAdminStudentStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ active, studentId }: { active: boolean; studentId: string }) =>
      apiPatch<AdminStudent, { active: boolean }>(`/admins/students/${studentId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { active }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] })
  });
}

export function useImportAdminStudents() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (students: AdminStudentWritePayload[]) =>
      apiPost<AdminStudentImportResult, { students: AdminStudentWritePayload[] }>('/admins/students/import', {
        accessToken: accessToken ?? undefined,
        body: { students }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] })
  });
}

export function useAdminStudentAttemptLimit(studentId: string | undefined) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken && studentId),
    queryFn: () =>
      apiGet<AdminStudentAttemptLimit>(`/admins/students/${studentId}/lp-attempts`, {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-student-lp-attempts', accessToken, studentId],
    staleTime: 30_000
  });
}

export function useUpdateAdminStudentAttemptLimit() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ maxAttempts, notes, studentId }: { maxAttempts: number; notes?: string; studentId: string }) =>
      apiPatch<AdminStudentAttemptLimit, { maxAttempts: number; notes?: string }>(`/admins/students/${studentId}/lp-attempts`, {
        accessToken: accessToken ?? undefined,
        body: { maxAttempts, notes }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-student-lp-attempts'] });
    }
  });
}
