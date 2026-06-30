import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminProjectSubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';
export type AdminProjectSubmissionStatusFilter = AdminProjectSubmissionStatus | 'pending' | 'duplicates' | 'all';

export type AdminProjectSubmission = {
  attemptNumber: number;
  cohortKey?: string;
  cohortName?: string;
  duplicateGroupCount: number;
  duplicateGroupKey?: string;
  id: string;
  isRepeatSubmission: boolean;
  previousRequestIds: string[];
  previousRequestNumbers: string[];
  programKey?: string;
  projectId?: string;
  projectTitle?: string;
  remarks?: string;
  requestNumber?: string;
  roleId?: string;
  roleName?: string;
  status: AdminProjectSubmissionStatus;
  studentEmail: string;
  studentId?: string;
  studentName?: string;
  submissionLink?: string;
  submittedAt?: string;
};

export type AdminProjectSubmissionsQuery = {
  cohortName?: string;
  limit?: number;
  page?: number;
  programKey?: string;
  roleId?: string;
  search?: string;
  status?: AdminProjectSubmissionStatusFilter;
  submittedDate?: string;
};

export type AdminProjectSubmissionReviewAction = 'approve' | 'reject';

export type AdminProjectSubmissionReviewInput = {
  action: AdminProjectSubmissionReviewAction;
  requestId: string;
  reviewNote?: string;
};

export type AdminProjectSubmissionReviewResult = {
  message: string;
  requestId?: string;
  status: 'updated' | 'skipped' | 'disabled' | 'failed' | 'not_found';
};

export function useAdminProjectSubmissions(query: AdminProjectSubmissionsQuery) {
  const { accessToken } = useAuth();
  const cohortName = query.cohortName?.trim();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const roleId = query.roleId?.trim();
  const search = query.search?.trim();
  const status = query.status ?? 'pending';
  const submittedDate = query.submittedDate?.trim().slice(0, 10);

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminProjectSubmission>>('/admins/project-submissions', {
        accessToken: accessToken ?? undefined,
        query: {
          cohortName,
          limit,
          page,
          programKey,
          roleId,
          search,
          status,
          submittedDate
        }
      }),
    queryKey: ['admin-project-submissions', accessToken, page, limit, status, programKey, roleId, cohortName, submittedDate, search],
    staleTime: 60_000
  });
}

export function useReviewAdminProjectSubmission() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ action, requestId, reviewNote }: AdminProjectSubmissionReviewInput) =>
      apiPatch<AdminProjectSubmissionReviewResult, { reviewNote?: string }>(`/admins/project-submissions/${requestId}/${action}`, {
        accessToken: accessToken ?? undefined,
        body: action === 'reject' ? { reviewNote } : undefined
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-project-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['admin-certificate-requests'] });
    }
  });
}
