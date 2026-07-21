import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentRecordingAccessType = 'free' | 'paid';
export type StudentRecordingSource = 'youtube' | 'zoom';
export type StudentRecordingSection = 'induction_live_project' | 'core_modules' | 'placement_mentorship' | 'other_workshops';

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
  recordingSequenceMatched?: boolean;
  recordingSequenceNumber?: number | null;
  recordingSequenceProgramKey?: string | null;
  recordingSection?: StudentRecordingSection | null;
  recordingSequenceTitle?: string | null;
  relatedResources?: StudentRecordingResource[];
  recordingUrl?: string;
  recordingPassword?: string;
  source?: StudentRecordingSource;
  time?: string;
  title: string;
  workshopId?: string;
};

export type StudentRecordingResource = {
  description?: string | null;
  id: string;
  resourceMode?: string | null;
  resourceType?: string | null;
  title: string;
  url?: string | null;
};

export type StudentRecordingsQuery = {
  accessType?: StudentRecordingAccessType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  source?: StudentRecordingSource | 'all';
};

export type StudentRecordingResourcesResponse = {
  recordingId: string;
  resources: StudentRecordingResource[];
};

export type StudentRecordingProgressItem = {
  completedAt: string;
  recordingId: string;
};

export type StudentRecordingProgressResponse = {
  items: StudentRecordingProgressItem[];
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
    refetchOnMount: 'always',
    staleTime: 0
  });
}

export function useStudentRecordingProgress(recordingIds: string[]) {
  const { accessToken } = useAuth();
  const cleanRecordingIds = Array.from(new Set(recordingIds.map((recordingId) => recordingId.trim()).filter(Boolean))).sort();

  return useQuery({
    enabled: Boolean(accessToken && cleanRecordingIds.length > 0),
    queryFn: () =>
      apiGet<StudentRecordingProgressResponse>('/students/me/recording-progress', {
        accessToken: accessToken ?? undefined,
        query: {
          recordingIds: cleanRecordingIds.join(',')
        }
      }),
    queryKey: ['student-recording-progress', accessToken, cleanRecordingIds.join(',')],
    refetchOnMount: 'always',
    staleTime: 0
  });
}

export function useStudentRecordingProgressActions(recordingIds: string[]) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const cleanRecordingIds = Array.from(new Set(recordingIds.map((recordingId) => recordingId.trim()).filter(Boolean))).sort();
  const progressQueryKey = ['student-recording-progress', accessToken, cleanRecordingIds.join(',')];

  const markComplete = useMutation({
    mutationFn: (recordingId: string) =>
      apiPost<StudentRecordingProgressItem>(`/students/me/recordings/${encodeURIComponent(recordingId)}/progress`, {
        accessToken: accessToken ?? undefined
      }),
    onSuccess: (item) => {
      queryClient.setQueryData<StudentRecordingProgressResponse>(progressQueryKey, (current) => {
        const items = current?.items ?? [];
        const nextItems = items.filter((progressItem) => progressItem.recordingId !== item.recordingId);
        return { items: [item, ...nextItems] };
      });
      void queryClient.invalidateQueries({ queryKey: progressQueryKey });
    }
  });

  return { markComplete };
}

export function useStudentRecordingResources(recordingId: string | undefined, enabled = true) {
  const { accessToken } = useAuth();
  const cleanRecordingId = recordingId?.trim();

  return useQuery({
    enabled: Boolean(accessToken && cleanRecordingId && enabled),
    queryFn: () =>
      apiGet<StudentRecordingResourcesResponse>(`/students/me/recordings/${encodeURIComponent(cleanRecordingId ?? '')}/resources`, {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['student-recording-resources', accessToken, cleanRecordingId],
    refetchOnMount: 'always',
    staleTime: 0
  });
}
