import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentProjectSubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export type StudentProjectSubmission = {
  attemptNumber: number;
  cohortKey?: string;
  cohortName?: string;
  id: string;
  isRepeatSubmission: boolean;
  programKey?: string;
  projectId?: string;
  projectTitle?: string;
  remarks?: string;
  requestNumber?: string;
  roleId?: string;
  roleName?: string;
  status: StudentProjectSubmissionStatus;
  submissionLink?: string;
  submittedAt?: string;
};

export type StudentProjectSubmissionsQuery = {
  cohortName?: string;
  limit?: number;
  page?: number;
  programKey?: string;
  search?: string;
  status?: StudentProjectSubmissionStatus | 'all';
};

export function useStudentProjectSubmissions(query: StudentProjectSubmissionsQuery) {
  const { accessToken } = useAuth();
  const cohortName = query.cohortName?.trim();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
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
          programKey,
          search,
          status
        }
      }),
    queryKey: ['student-project-submissions', accessToken, page, limit, status, programKey, cohortName, search],
    staleTime: 60_000
  });
}
