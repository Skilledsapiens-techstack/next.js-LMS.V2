import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiInvokeFunction, apiPost } from '../../lib/supabaseApi';
import { AtsScoreResult } from '../../lib/atsResumeScoring';

export type StudentAtsRole = {
  category: string;
  description?: string;
  id: string;
  roleKey: string;
  roleName: string;
  sortOrder: number;
  status: 'active' | 'inactive';
};

export type StudentAtsRoleLevel = {
  description?: string;
  id: string;
  levelKey: string;
  levelName: string;
  sortOrder: number;
  status: 'active' | 'inactive';
};

export type StudentAtsRoleProfile = {
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

export type StudentAtsAttempt = {
  accessType: 'free' | 'paid' | 'admin';
  breakdown: Record<string, unknown>;
  createdAt: string;
  id: string;
  improvementSummary: Record<string, unknown>;
  jdMatchScore?: number;
  jdMatchUsed: boolean;
  overallScore: number;
  reportDownloaded: boolean;
  scanMode: 'basic' | 'advanced';
};

export type StudentAtsPackage = {
  amount: number;
  currency: string;
  description?: string;
  id: string;
  packageKey: string;
  paymentLink?: string;
  scanCredits: number;
  title: string;
};

export type StudentAtsPackageOrder = {
  amount: number;
  checkoutUrl?: string;
  currency: string;
  id: string;
  itemId: string;
  itemTitle?: string;
  itemType: 'ats_package';
  orderId?: string;
  paymentLink?: string;
  razorpayOrderId?: string;
  status: 'created' | 'paid' | 'failed' | 'cancelled';
};

export type StudentAtsCreditSyncResult = {
  checked: number;
  creditsGranted: number;
  ok: boolean;
  synced: Array<Record<string, unknown>>;
};

export type StudentAtsOverview = {
  attempts: StudentAtsAttempt[];
  freeAttemptsLimit: number;
  freeAttemptsRemaining: number;
  freeAttemptsUsed: number;
  packages: StudentAtsPackage[];
  paidCreditsRemaining: number;
  roleLevels: StudentAtsRoleLevel[];
  roleProfiles: StudentAtsRoleProfile[];
  roles: StudentAtsRole[];
  scoringVersion?: {
    freeScanWeights?: Record<string, unknown>;
    id: string;
    title: string;
    versionKey: string;
    weights?: Record<string, unknown>;
  } | null;
  student: {
    email: string;
    fullName: string;
    id: string;
  };
};

export type StudentAtsAttemptPayload = {
  accessType: 'free' | 'paid';
  breakdown: Record<string, unknown>;
  jdMatchScore?: number;
  jdMatchUsed?: boolean;
  levelId?: string;
  improvementSummary: AtsScoreResult['improvementSummary'];
  overallScore: number;
  roleId?: string;
  scanMode: 'basic' | 'advanced';
};

export function useStudentAtsResumeScore() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<StudentAtsOverview>('/students/me/ats-resume-score', { accessToken: accessToken ?? undefined }),
    queryKey: ['student-ats-resume-score', accessToken],
    staleTime: 60_000
  });
}

export function useCreateStudentAtsAttempt() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: StudentAtsAttemptPayload) =>
      apiPost<StudentAtsAttempt, StudentAtsAttemptPayload>('/students/me/ats-attempts', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-ats-resume-score'] });
    }
  });
}

export function useRecordStudentAtsReportDownload() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { attemptId: string }) =>
      apiPost<StudentAtsAttempt, { attemptId: string }>('/students/me/ats-report-downloads', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-ats-resume-score'] });
    }
  });
}

export function useCreateStudentAtsPackageOrder() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { packageId: string }) =>
      apiInvokeFunction<StudentAtsPackageOrder, { itemId: string; itemType: 'ats_package'; returnPath: string }>('razorpay-checkout', {
        accessToken: accessToken ?? undefined,
        body: { itemId: body.packageId, itemType: 'ats_package', returnPath: '/student/ats-resume-score' }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-ats-resume-score'] });
      void queryClient.invalidateQueries({ queryKey: ['student-payment-orders'] });
    }
  });
}

export function useSyncStudentAtsCredits() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiInvokeFunction<StudentAtsCreditSyncResult, { action: 'sync_ats_credits' }>('razorpay-checkout', {
        accessToken: accessToken ?? undefined,
        body: { action: 'sync_ats_credits' }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-ats-resume-score'] });
      void queryClient.invalidateQueries({ queryKey: ['student-payment-orders'] });
    }
  });
}
