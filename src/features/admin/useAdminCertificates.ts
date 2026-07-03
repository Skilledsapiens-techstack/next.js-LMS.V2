import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminCertificateStatus = 'draft' | 'issued' | 'revoked';
export type AdminCertificateGenerationStatus = 'pending' | 'generating' | 'ready' | 'expired' | 'failed';
export type AdminCertificateType = 'leadership' | 'live_project';
export type AdminCertificateReviewStatus = 'pending' | 'approved' | 'rejected';
export type AdminCertificateRequestAdminStatus = AdminCertificateReviewStatus | 'issued';

export type AdminCertificate = {
  certificateId: string;
  certificateType: AdminCertificateType;
  cohortName?: string;
  createdAt?: string;
  generationStatus: AdminCertificateGenerationStatus;
  id: string;
  issueDate: string;
  issuedBy?: string;
  programKey?: string;
  programName?: string;
  projectId?: string;
  projectTitle?: string;
  status: AdminCertificateStatus;
  studentEmail: string;
  studentName: string;
  updatedAt?: string;
};

export type AdminCertificateRequest = {
  adminEmail?: string;
  adminReviewedAt?: string;
  adminStatus: AdminCertificateRequestAdminStatus;
  attemptNumber?: number;
  cohortStartDate?: string;
  cohortName?: string;
  createdAt?: string;
  id: string;
  moderatorEmail?: string;
  moderatorReviewedAt?: string;
  moderatorStatus: AdminCertificateReviewStatus;
  programKey?: string;
  projectId: string;
  projectRole: string;
  projectTitle?: string;
  requestId: string;
  requestNumber?: string;
  requestType: 'live_project';
  submissionUrl?: string;
  studentEmail: string;
  studentId?: string;
  studentName: string;
  submittedAt: string;
  updatedAt?: string;
};

export type IssueLiveProjectCertificateInput = {
  durationWeeks: number;
  issueDate: string;
  requestId: string;
  sendEmail: boolean;
  startDate: string;
};

export type IssueLiveProjectCertificateResult = {
  certificate: AdminCertificate;
  message: string;
};

export type AdminCertificatesQuery = {
  certificateType?: AdminCertificateType | 'all';
  generationStatus?: AdminCertificateGenerationStatus | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminCertificateStatus | 'all';
};

export type AdminCertificateRequestsQuery = {
  adminStatus?: AdminCertificateRequestAdminStatus | 'all';
  limit?: number;
  moderatorStatus?: AdminCertificateReviewStatus | 'all';
  page?: number;
  search?: string;
};

export function useAdminCertificates(query: AdminCertificatesQuery) {
  const { accessToken } = useAuth();
  const certificateType = query.certificateType ?? 'all';
  const generationStatus = query.generationStatus ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminCertificate>>('/admins/certificates', {
        accessToken: accessToken ?? undefined,
        query: {
          certificateType,
          generationStatus,
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['admin-certificates', accessToken, page, limit, status, generationStatus, certificateType, search],
    staleTime: 60_000
  });
}

export function useAdminCertificateRequests(query: AdminCertificateRequestsQuery) {
  const { accessToken } = useAuth();
  const adminStatus = query.adminStatus ?? 'all';
  const limit = query.limit ?? 25;
  const moderatorStatus = query.moderatorStatus ?? 'all';
  const page = query.page ?? 1;
  const search = query.search?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminCertificateRequest>>('/admins/certificate-requests', {
        accessToken: accessToken ?? undefined,
        query: {
          adminStatus,
          limit,
          moderatorStatus,
          page,
          search
        }
      }),
    queryKey: ['admin-certificate-requests', accessToken, page, limit, moderatorStatus, adminStatus, search],
    staleTime: 60_000
  });
}

export function useIssueLiveProjectCertificate() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: IssueLiveProjectCertificateInput) =>
      apiPost<IssueLiveProjectCertificateResult, IssueLiveProjectCertificateInput>('/admins/certificates/live-project', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['admin-certificate-requests'] });
      queryClient.invalidateQueries({ queryKey: ['student-certificates'] });
    }
  });
}
