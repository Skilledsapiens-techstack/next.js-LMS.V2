import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminRecordingCandidateStatus = 'draft' | 'reviewed' | 'rejected';

export type AdminRecordingCandidate = {
  detectedAt: string;
  downloadUrl?: string;
  durationMinutes?: number;
  fileSize?: number;
  fileType?: string;
  id: string;
  playUrl?: string;
  recordingEnd?: string;
  recordingPassword?: string;
  recordingStart?: string;
  recordingType?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: AdminRecordingCandidateStatus;
  updatedAt?: string;
  workshopId: string;
  zoomAccount: string;
  zoomId: string;
  zoomRecordingFileId?: string;
};

export type AdminRecordingCandidatesQuery = {
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminRecordingCandidateStatus | 'all';
  workshopId?: string;
  zoomAccount?: string;
};

export function useAdminRecordingCandidates(query: AdminRecordingCandidatesQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';
  const workshopId = query.workshopId?.trim();
  const zoomAccount = query.zoomAccount?.trim();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminRecordingCandidate>>('/admins/recording-candidates', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          search,
          status,
          workshopId,
          zoomAccount
        }
      }),
    queryKey: ['admin-recording-candidates', accessToken, page, limit, status, workshopId, zoomAccount, search],
    staleTime: 60_000
  });
}
