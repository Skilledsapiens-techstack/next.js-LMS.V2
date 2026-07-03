import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminAnnouncementStatus = 'active' | 'inactive';
export type AdminAnnouncementPriority = 'normal' | 'important' | 'urgent';
export type AdminAnnouncementAudience = 'all' | 'program' | 'cohort';

export type AdminAnnouncement = {
  announcementId?: string;
  audience: AdminAnnouncementAudience;
  cohortNames: string[];
  createdAt?: string;
  createdBy?: string;
  customEmoji?: string;
  endDate?: string;
  id: string;
  linkLabel?: string;
  linkUrl?: string;
  message: string;
  pinned: boolean;
  priority: AdminAnnouncementPriority;
  programKeys: string[];
  startDate?: string;
  status: AdminAnnouncementStatus;
  title: string;
  type?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type AdminAnnouncementsQuery = {
  audience?: AdminAnnouncementAudience | 'any';
  limit?: number;
  page?: number;
  priority?: AdminAnnouncementPriority | 'all';
  search?: string;
  status?: AdminAnnouncementStatus | 'all';
};

export type AdminAnnouncementRecipientCountQuery = {
  audience: AdminAnnouncementAudience;
  cohortNames?: string[];
  enabled?: boolean;
  programKeys?: string[];
};

export type AdminAnnouncementWritePayload = {
  audience: AdminAnnouncementAudience;
  cohortNames: string[];
  customEmoji?: string | null;
  endDate?: string | null;
  linkLabel?: string | null;
  linkUrl?: string | null;
  message: string;
  pinned: boolean;
  priority: AdminAnnouncementPriority;
  programKeys: string[];
  startDate?: string | null;
  status: AdminAnnouncementStatus;
  title: string;
  type: string;
};

export function useAdminAnnouncements(query: AdminAnnouncementsQuery) {
  const { accessToken } = useAuth();
  const audience = query.audience ?? 'any';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const priority = query.priority ?? 'all';
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminAnnouncement>>('/admins/announcements', {
        accessToken: accessToken ?? undefined,
        query: {
          audience,
          limit,
          page,
          priority,
          search,
          status
        }
      }),
    queryKey: ['admin-announcements', accessToken, page, limit, status, priority, audience, search],
    staleTime: 60_000
  });
}

export function useAdminAnnouncementRecipientCount(query: AdminAnnouncementRecipientCountQuery) {
  const { accessToken } = useAuth();
  const cohortNames = query.cohortNames ?? [];
  const programKeys = query.programKeys ?? [];

  return useQuery({
    enabled:
      Boolean(accessToken) &&
      query.enabled !== false &&
      (query.audience === 'all' || (query.audience === 'cohort' && cohortNames.length > 0) || (query.audience === 'program' && programKeys.length > 0)),
    queryFn: () =>
      apiGet<{ total: number }>('/admins/announcements/recipient-count', {
        accessToken: accessToken ?? undefined,
        query: {
          audience: query.audience,
          cohortNames: cohortNames.join(','),
          programKeys: programKeys.join(',')
        }
      }),
    queryKey: ['admin-announcement-recipient-count', accessToken, query.audience, cohortNames.join('|'), programKeys.join('|')],
    staleTime: 30_000
  });
}

export function useCreateAdminAnnouncement() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminAnnouncementWritePayload) =>
      apiPost<AdminAnnouncement, AdminAnnouncementWritePayload>('/admins/announcements', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['student-announcements'] });
    }
  });
}

export function useUpdateAdminAnnouncement() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ announcementId, body }: { announcementId: string; body: Partial<AdminAnnouncementWritePayload> }) =>
      apiPatch<AdminAnnouncement, Partial<AdminAnnouncementWritePayload>>(`/admins/announcements/${announcementId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['student-announcements'] });
    }
  });
}

export function useUpdateAdminAnnouncementStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ announcementId, status }: { announcementId: string; status: AdminAnnouncementStatus }) =>
      apiPatch<AdminAnnouncement, { status: AdminAnnouncementStatus }>(`/admins/announcements/${announcementId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['student-announcements'] });
    }
  });
}

export function useArchiveAdminAnnouncement() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (announcementId: string) =>
      apiPatch<AdminAnnouncement, Record<string, never>>(`/admins/announcements/${announcementId}/archive`, {
        accessToken: accessToken ?? undefined,
        body: {}
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['student-announcements'] });
    }
  });
}

export function useBulkArchiveAdminAnnouncements() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementIds: string[]) => {
      const uniqueIds = Array.from(new Set(announcementIds.map((id) => id.trim()).filter(Boolean)));
      await Promise.all(
        uniqueIds.map((announcementId) =>
          apiPatch<AdminAnnouncement, Record<string, never>>(`/admins/announcements/${announcementId}/archive`, {
            accessToken: accessToken ?? undefined,
            body: {}
          })
        )
      );
      return { archived: uniqueIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['student-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['admin-announcement-recipient-count'] });
    }
  });
}
