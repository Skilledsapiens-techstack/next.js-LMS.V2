import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminAtsStatus = 'active' | 'inactive' | 'draft';

export type AdminAtsRole = {
  category: string;
  description?: string;
  id: string;
  roleKey: string;
  roleName: string;
  sortOrder: number;
  status: 'active' | 'inactive';
};

export type AdminAtsRoleLevel = {
  id: string;
  levelKey: string;
  levelName: string;
  sortOrder: number;
  status: 'active' | 'inactive';
};

export type AdminAtsRoleProfile = {
  actionVerbs: string[];
  expectations: Record<string, unknown>;
  id: string;
  keywords: string[];
  levelId: string;
  preferredSections: string[];
  roleId: string;
  sampleCvPoints: Array<Record<string, unknown>>;
  scoringWeights: Record<string, unknown>;
  status: 'active' | 'inactive';
};

export type AdminAtsPackage = {
  amount: number;
  currency: string;
  description?: string;
  id: string;
  includesAdvancedAnalysis: boolean;
  includesJdMatch: boolean;
  includesReportDownload: boolean;
  packageKey: string;
  paymentLink?: string;
  scanCredits: number;
  sortOrder: number;
  status: AdminAtsStatus;
  title: string;
};

export type AdminAtsAttempt = {
  accessType: 'free' | 'paid' | 'admin';
  breakdown: Record<string, unknown>;
  createdAt: string;
  id: string;
  improvementSummary: Record<string, unknown>;
  jdMatchScore?: number;
  jdMatchUsed: boolean;
  levelId?: string;
  overallScore: number;
  reportDownloaded: boolean;
  roleId?: string;
  scanMode: 'basic' | 'advanced';
  studentEmail: string;
  studentName?: string;
};

export type AdminAtsScoringVersion = {
  description?: string;
  freeScanWeights: Record<string, unknown>;
  id: string;
  status: AdminAtsStatus;
  title: string;
  versionKey: string;
  weights: Record<string, unknown>;
};

export type AdminAtsStudentCredit = {
  active?: boolean;
  adminCreditsGranted: number;
  cohortName?: string;
  collegeName?: string;
  email: string;
  freeAttemptsLimit: number;
  freeAttemptsRemaining: number;
  freeAttemptsUsed: number;
  fullName?: string;
  id: string;
  latestLimitNote?: string;
  paidCreditsGranted: number;
  paidCreditsRemaining: number;
  paidScansUsed: number;
  phone?: string;
  programName?: string;
  purchasedCreditsGranted: number;
  studentId?: string;
  totalScans: number;
};

export type UpdateAdminAtsStudentCreditsPayload = {
  advancedCreditsToGrant?: number;
  freeAttemptsLimit?: number;
  notes?: string;
  studentIds: string[];
};

export function useAdminAtsResumeScore() {
  const { accessToken } = useAuth();
  const authOptions = { accessToken: accessToken ?? undefined };
  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const [attempts, roles, levels, profiles, packages, scoringVersions] = await Promise.all([
        apiGet<PaginatedResponse<AdminAtsAttempt>>('/admins/ats-attempts', { ...authOptions, query: { limit: 200, page: 1, sort: 'newest' } }),
        apiGet<PaginatedResponse<AdminAtsRole>>('/admins/ats-roles', { ...authOptions, query: { limit: 500, page: 1, sort: 'order' } }),
        apiGet<PaginatedResponse<AdminAtsRoleLevel>>('/admins/ats-role-levels', { ...authOptions, query: { limit: 20, page: 1, sort: 'order' } }),
        apiGet<PaginatedResponse<AdminAtsRoleProfile>>('/admins/ats-role-profiles', { ...authOptions, query: { limit: 1000, page: 1, sort: 'updated' } }),
        apiGet<PaginatedResponse<AdminAtsPackage>>('/admins/ats-packages', { ...authOptions, query: { limit: 50, page: 1, sort: 'order' } }),
        apiGet<PaginatedResponse<AdminAtsScoringVersion>>('/admins/ats-scoring-versions', { ...authOptions, query: { limit: 20, page: 1, sort: 'updated' } })
      ]);
      return { attempts, roles, levels, profiles, packages, scoringVersions };
    },
    queryKey: ['admin-ats-resume-score', accessToken],
    staleTime: 60_000
  });
}

export function useAdminAtsStudentCredits(search: string) {
  const { accessToken } = useAuth();
  const query = search.trim();
  return useQuery({
    enabled: Boolean(accessToken && query),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminAtsStudentCredit>>('/admins/ats-student-credits', {
        accessToken: accessToken ?? undefined,
        query: { limit: 30, page: 1, search: query }
      }),
    queryKey: ['admin-ats-student-credits', accessToken, query],
    staleTime: 30_000
  });
}

export function useUpdateAdminAtsStudentCredits() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAdminAtsStudentCreditsPayload) =>
      apiPost<{ advancedCreditsGranted: number; freeAttemptsLimit: number | null; message: string; studentsUpdated: number }, UpdateAdminAtsStudentCreditsPayload>('/admins/ats-student-credits', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ats-resume-score'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-ats-student-credits'] });
    }
  });
}

export function useUpdateAdminAtsPackage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, id }: { body: Partial<AdminAtsPackage>; id: string }) =>
      apiPatch<AdminAtsPackage, Partial<AdminAtsPackage>>(`/admins/ats-packages/${encodeURIComponent(id)}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ats-resume-score'] });
    }
  });
}

export function useUpdateAdminAtsRoleProfile() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, id }: { body: Partial<AdminAtsRoleProfile>; id: string }) =>
      apiPatch<AdminAtsRoleProfile, Partial<AdminAtsRoleProfile>>(`/admins/ats-role-profiles/${encodeURIComponent(id)}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ats-resume-score'] });
    }
  });
}

export function useUpdateAdminAtsScoringVersion() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, id }: { body: Partial<AdminAtsScoringVersion>; id: string }) =>
      apiPatch<AdminAtsScoringVersion, Partial<AdminAtsScoringVersion>>(`/admins/ats-scoring-versions/${encodeURIComponent(id)}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ats-resume-score'] });
    }
  });
}
