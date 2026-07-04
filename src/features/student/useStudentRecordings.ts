import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentRecordingAccessType = 'free' | 'paid';
export type StudentRecordingSource = 'youtube' | 'zoom';

export type StudentRecording = {
  accessType: StudentRecordingAccessType;
  cohortNames: string[];
  currency?: string | null;
  date: string;
  domainKey?: string;
  durationMinutes?: number;
  hasAccess: boolean;
  id: string;
  locked: boolean;
  lockReason?: string;
  paymentLink?: string;
  price?: number | null;
  programKey?: string;
  recordingUrl?: string;
  recordingPassword?: string;
  source?: StudentRecordingSource;
  time?: string;
  title: string;
  workshopId?: string;
};

export type StudentRecordingsQuery = {
  accessType?: StudentRecordingAccessType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  source?: StudentRecordingSource | 'all';
};

export function useStudentRecordings(query: StudentRecordingsQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const source = query.source ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentRecording>>('/students/me/recordings', {
        accessToken: accessToken ?? undefined,
        query: {
          accessType,
          limit,
          page,
          search,
          source
        }
      }),
    queryKey: ['student-recordings', accessToken, page, limit, accessType, source, search],
    staleTime: 60_000
  });
}
