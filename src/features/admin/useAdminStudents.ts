import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiInvokeFunction, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminStudentStatus = 'active' | 'inactive';

export type AdminStudent = {
  active: boolean;
  altEmail?: string;
  authAccountExists?: boolean;
  authEmailConfirmedAt?: string;
  authLastSignInAt?: string;
  cohortNames?: string[];
  cohortName?: string;
  cohorts?: Array<{ cohortId?: string; cohortName: string }>;
  collegeName?: string;
  educationYear?: string;
  enrolledDate?: string;
  email: string;
  fullName: string;
  id: string;
  liveProjectDomains?: string[];
  liveProjectDuration?: string;
  liveProjectRoleIds?: string[];
  liveProjectRoles?: string[];
  latestInviteError?: string;
  latestInviteStatus?: string;
  onboardingMailStatus?: string;
  onboardingDate?: string;
  onboardingSequence?: number;
  personalMentor?: string;
  phone?: string;
  programKeys?: string[];
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
  direction?: 'asc' | 'desc';
  enabled?: boolean;
  limit?: number;
  page?: number;
  programKey?: string;
  search?: string;
  sort?: string;
  status?: AdminStudentStatus | 'all';
};

export type AdminStudentWritePayload = {
  active?: boolean;
  altEmail?: string;
  assignmentMode?: 'add' | 'replace';
  cohortIds?: string[];
  cohortNames?: string[];
  collegeName?: string;
  educationYear?: string;
  email: string;
  fullName: string;
  liveProjectDuration?: string;
  liveProjectRoleIds?: string[];
  onboardingMailStatus?: 'pending' | 'sent' | 'failed' | 'skipped' | 'dry-run';
  onboardingDate?: string;
  personalMentor?: string;
  phone?: string;
  programKeys?: string[];
  programNames?: string[];
  sendOnboardingMail?: boolean;
  sendInvite?: boolean;
  slot?: string;
  studentId?: string;
  waGroup?: string;
};

export type AdminStudentImportResult = {
  created: number;
  failed: number;
  rows?: AdminStudentImportRowResult[];
  updated: number;
};

export type AdminStudentImportRowResult = {
  action?: 'created' | 'updated' | 'skipped';
  email?: string;
  error?: string;
  rowNumber: number;
  status: 'success' | 'failed';
};

type AdminStudentImportMutationPayload =
  | AdminStudentWritePayload[]
  | {
      invalidate?: boolean;
      students: AdminStudentWritePayload[];
    };

export type AdminStudentAuthStatus = {
  authAccountExists: boolean;
  email: string;
  emailConfirmedAt?: string | null;
  inviteError?: string | null;
  inviteStatus?: string | null;
  lastSignInAt?: string | null;
};

export type AdminStudentsBulkPayload = {
  active?: boolean;
  assignmentMode?: 'add' | 'replace';
  cohortIds?: string[];
  cohortNames?: string[];
  programKeys?: string[];
  programNames?: string[];
  resendInvite?: boolean;
  studentIds: string[];
};

export type AdminStudentsBulkResult = {
  failed: number;
  rows: Array<{ email?: string; error?: string; status: 'success' | 'failed'; studentId: string }>;
  updated: number;
};

export type AdminStudentAuthBackfillResult = {
  failed: number;
  linked: number;
  rows: Array<{ email?: string; error?: string; status: 'linked' | 'skipped' | 'failed'; studentId: string }>;
  skipped: number;
};

export type AdminStudentInviteHealth = {
  counts: Record<string, number>;
  latestAt?: string | null;
  latestFailure?: string | null;
  total: number;
};

export type AdminStudentAuditLog = {
  action: string;
  actorEmail?: string;
  createdAt?: string;
  details?: Record<string, unknown>;
  entityId?: string;
  id: string;
  status?: string;
};

export type AdminStudentAttemptLimit = {
  maxAttempts: number;
  notes?: string;
  studentEmail: string;
  studentId: string;
  updatedAt?: string;
};

export type AdminStudentAccessPreview = {
  certificates: number;
  cohorts: string[];
  projects: number;
  recordings: number;
  resources: number;
  schedule: number;
  studentEmail: string;
  studentName: string;
};

export function useAdminStudents(query: AdminStudentsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const search = query.search?.trim();
  const sort = query.sort?.trim();
  const direction = query.direction;
  const status = query.status ?? 'all';
  const cohortName = query.cohortName?.trim();

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminStudent>>('/admins/students', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          programKey,
          search,
          sort,
          direction,
          status,
          cohortName
        }
      }),
    queryKey: ['admin-students', accessToken, page, limit, status, search, cohortName, programKey, sort, direction],
    staleTime: 60_000
  });
}

export function useAdminStudentCollegeOptions() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<{ items: string[] }>('/admins/students/college-options', {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-student-college-options', accessToken],
    staleTime: 5 * 60_000
  });
}

export function useExportAdminStudents() {
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: async (query: AdminStudentsQuery) => {
      const allItems: AdminStudent[] = [];
      let currentPage = 1;
      let latestResponse: PaginatedResponse<AdminStudent> | null = null;

      do {
        latestResponse = await apiGet<PaginatedResponse<AdminStudent>>('/admins/students', {
          accessToken: accessToken ?? undefined,
          query: {
            cohortName: query.cohortName?.trim(),
            limit: 500,
            page: currentPage,
            programKey: query.programKey?.trim(),
            search: query.search?.trim(),
            sort: query.sort?.trim(),
            direction: query.direction,
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
    mutationFn: (payload: AdminStudentImportMutationPayload) => {
      const students = Array.isArray(payload) ? payload : payload.students;
      return apiPost<AdminStudentImportResult, { students: AdminStudentWritePayload[] }>('/admins/students/import', {
        accessToken: accessToken ?? undefined,
        body: { students }
      });
    },
    onSuccess: (_result, payload) => {
      if (!Array.isArray(payload) && payload.invalidate === false) return;
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
    }
  });
}

export function useBulkUpdateAdminStudents() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminStudentsBulkPayload) =>
      apiPost<AdminStudentsBulkResult, AdminStudentsBulkPayload>('/admins/students/bulk', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] })
  });
}

export function useResendAdminStudentInvite() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentId: string) =>
      apiPost<{ queued: boolean }, { studentIds: string[] }>('/admins/students/resend-invites', {
        accessToken: accessToken ?? undefined,
        body: { studentIds: [studentId] }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] })
  });
}

export function useBackfillAdminStudentAuthLinks() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentIds: string[]) =>
      apiInvokeFunction<AdminStudentAuthBackfillResult, { action: string; studentIds: string[] }>('admin-students', {
        accessToken: accessToken ?? undefined,
        body: { action: 'backfill-auth-links', studentIds }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-student-auth-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-student-audit-logs'] });
    }
  });
}

export function useAdminStudentInviteHealth() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiInvokeFunction<AdminStudentInviteHealth, { action: string }>('admin-students', {
        accessToken: accessToken ?? undefined,
        body: { action: 'invite-health' }
      }),
    queryKey: ['admin-student-invite-health', accessToken],
    retry: false,
    staleTime: 60_000
  });
}

export function useAdminStudentAuditLogs() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminStudentAuditLog>>('/admins/student-audit-logs', {
        accessToken: accessToken ?? undefined,
        query: { limit: 12, page: 1 }
      }),
    queryKey: ['admin-student-audit-logs', accessToken],
    staleTime: 60_000
  });
}

export function useAdminStudentAuthStatuses(students: Array<{ email: string; id: string } | string>) {
  const { accessToken } = useAuth();
  const normalizedStudents = students
    .map((student) => (typeof student === 'string' ? { email: student.trim().toLowerCase(), id: student.trim().toLowerCase() } : { email: student.email?.trim().toLowerCase() ?? '', id: student.id ?? '' }))
    .filter((student) => student.email && student.id);

  return useQuery({
    enabled: Boolean(accessToken && normalizedStudents.length > 0),
    queryFn: () =>
      apiInvokeFunction<{ statuses: AdminStudentAuthStatus[] }, { action: string; emails: string[]; studentIds: string[] }>('admin-students', {
        accessToken: accessToken ?? undefined,
        body: {
          action: 'status-summary',
          emails: normalizedStudents.map((student) => student.email),
          studentIds: normalizedStudents.map((student) => student.id)
        }
      }),
    queryKey: ['admin-student-auth-statuses', accessToken, normalizedStudents.map((student) => `${student.id}:${student.email}`).join('|')],
    retry: false,
    staleTime: 60_000
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

export function useAdminStudentAccessPreview(studentId: string | undefined) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken && studentId),
    queryFn: () =>
      apiGet<AdminStudentAccessPreview>(`/admins/students/${studentId}/access-preview`, {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-student-access-preview', accessToken, studentId],
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
