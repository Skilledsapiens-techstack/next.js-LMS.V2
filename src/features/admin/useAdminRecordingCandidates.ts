import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
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

export type AdminRecordingSequenceRuleStatus = 'active' | 'inactive';
export type AdminRecordingSection = 'induction_live_project' | 'core_modules' | 'placement_mentorship' | 'other_workshops';

export type AdminRecordingSequenceRule = {
  createdAt?: string;
  id: string;
  matchAliases: string[];
  programKey: string;
  recordingSection: AdminRecordingSection;
  sequenceNumber: number;
  status: AdminRecordingSequenceRuleStatus;
  title: string;
  updatedAt?: string;
};

export type AdminRecordingSequenceRulePayload = {
  matchAliases?: string[];
  programKey: string;
  recordingSection?: AdminRecordingSection;
  sequenceNumber: number;
  status?: AdminRecordingSequenceRuleStatus;
  title: string;
};

export type AdminRecordingSequenceRulesQuery = {
  limit?: number;
  page?: number;
  programKey?: string;
  status?: AdminRecordingSequenceRuleStatus | 'all';
};

export type AdminRecordingResourceLinks = {
  recordingId: string;
  resourceIds: string[];
};

export type AdminRecordingResourceSummary = {
  recordingId: string;
  resourceCount: number;
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

export function useAdminRecordingSequenceRules(query: AdminRecordingSequenceRulesQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 500;
  const page = query.page ?? 1;
  const programKey = query.programKey?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminRecordingSequenceRule>>('/admins/recording-sequences', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          programKey,
          sort: 'order',
          status
        }
      }),
    queryKey: ['admin-recording-sequences', accessToken, page, limit, programKey, status],
    staleTime: 60_000
  });
}

export function useCreateAdminRecordingSequenceRule() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminRecordingSequenceRulePayload) =>
      apiPost<AdminRecordingSequenceRule, AdminRecordingSequenceRulePayload>('/admins/recording-sequences', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-recording-sequences'] });
    }
  });
}

export function useUpdateAdminRecordingSequenceRule() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, id }: { body: AdminRecordingSequenceRulePayload; id: string }) =>
      apiPatch<AdminRecordingSequenceRule, AdminRecordingSequenceRulePayload>(`/admins/recording-sequences/${encodeURIComponent(id)}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-recording-sequences'] });
    }
  });
}

export function useDeleteAdminRecordingSequenceRule() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<AdminRecordingSequenceRule>(`/admins/recording-sequences/${encodeURIComponent(id)}`, {
        accessToken: accessToken ?? undefined
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-recording-sequences'] });
    }
  });
}

export function useAdminRecordingResourceLinks(recordingId?: string | null) {
  const { accessToken } = useAuth();
  const cleanRecordingId = recordingId?.trim();

  return useQuery({
    enabled: Boolean(accessToken && cleanRecordingId),
    queryFn: () =>
      apiGet<AdminRecordingResourceLinks>(`/admins/recordings/${encodeURIComponent(cleanRecordingId ?? '')}/resources`, {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-recording-resource-links', accessToken, cleanRecordingId],
    staleTime: 30_000
  });
}

export function useAdminRecordingResourceSummary(recordingIds: string[]) {
  const { accessToken } = useAuth();
  const cleanRecordingIds = Array.from(new Set(recordingIds.map((recordingId) => recordingId.trim()).filter(Boolean)));

  return useQuery({
    enabled: Boolean(accessToken && cleanRecordingIds.length > 0),
    queryFn: () =>
      apiGet<{ items: AdminRecordingResourceSummary[] }>('/admins/recordings/resources-summary', {
        accessToken: accessToken ?? undefined,
        query: {
          recordingIds: cleanRecordingIds.join(',')
        }
      }),
    queryKey: ['admin-recording-resource-summary', accessToken, cleanRecordingIds.join(',')],
    staleTime: 30_000
  });
}

export function useUpdateAdminRecordingResourceLinks() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recordingId, resourceIds }: { recordingId: string; resourceIds: string[] }) =>
      apiPatch<AdminRecordingResourceLinks, { resourceIds: string[] }>(`/admins/recordings/${encodeURIComponent(recordingId)}/resources`, {
        accessToken: accessToken ?? undefined,
        body: { resourceIds }
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-recording-resource-links', accessToken, variables.recordingId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-recording-resource-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['student-recordings'] });
    }
  });
}
