import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentProjectSubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'changes_requested';

export type StudentProjectSubmission = {
  attemptNumber: number;
  cohortKey?: string;
  cohortName?: string;
  declarationConfirmations?: string[];
  id: string;
  isRepeatSubmission: boolean;
  isLate?: boolean;
  programKey?: string;
  projectId?: string;
  projectTitle?: string;
  remarks?: string;
  requestNumber?: string;
  roleId?: string;
  roleName?: string;
  status: StudentProjectSubmissionStatus;
  studentFeedback?: string;
  submissionLink?: string;
  submittedAt?: string;
};

export type StudentProjectSubmissionInput = {
  cohortId: string;
  declarationAccepted: boolean;
  declarationConfirmations: string[];
  projectId: string;
  remarks?: string;
  studentFeedback: string;
  submissionLink: string;
};

export type StudentProjectSubmissionResult = {
  isLate?: boolean;
  message: string;
  submission: StudentProjectSubmission;
};

export type StudentProjectSubmissionsQuery = {
  cohortName?: string;
  limit?: number;
  page?: number;
  projectId?: string;
  programKey?: string;
  search?: string;
  status?: StudentProjectSubmissionStatus | 'all';
};

export function useStudentProjectSubmissions(query: StudentProjectSubmissionsQuery) {
  const { accessToken } = useAuth();
  const cohortName = query.cohortName?.trim();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const projectId = query.projectId?.trim();
  const programKey = query.programKey?.trim();
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentProjectSubmission>>('/students/me/project-submissions', {
        accessToken: accessToken ?? undefined,
        query: {
          cohortName,
          limit,
          page,
          projectId,
          programKey,
          search,
          status
        }
      }),
    queryKey: ['student-project-submissions', accessToken, page, limit, status, programKey, cohortName, projectId, search],
    staleTime: 60_000
  });
}

export function useSubmitStudentProjectSubmission() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: StudentProjectSubmissionInput) =>
      apiPost<StudentProjectSubmissionResult, StudentProjectSubmissionInput>('/students/me/project-submissions', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-project-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['student-projects'] });
    }
  });
}
