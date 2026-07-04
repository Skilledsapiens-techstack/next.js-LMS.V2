import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiInvokeFunction, apiPatch } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminWorkshopAccessType = 'free' | 'paid';
export type AdminWorkshopStatus = 'Upcoming' | 'Scheduled' | 'Live' | 'Completed' | 'Cancelled' | 'Inactive';

export type AdminWorkshop = {
  accessType: AdminWorkshopAccessType;
  cohortNames: string[];
  currency?: string;
  date: string;
  domainKey?: string;
  durationMinutes?: number;
  id: string;
  joinUrl?: string;
  paymentLink?: string;
  price?: number;
  programKey?: string;
  status: AdminWorkshopStatus;
  time?: string;
  title: string;
  updatedAt?: string;
  workshopId?: string;
  youtubeVideoUrl?: string;
  zoomAccount?: string;
  zoomId?: string;
  zoomLabel?: string;
  zoomRecordingPassword?: string;
  zoomRecordingUrl?: string;
};

export type AdminWorkshopsQuery = {
  accessType?: AdminWorkshopAccessType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminWorkshopStatus | 'all';
};

export type AdminWorkshopWritePayload = {
  cohortNames?: string[];
  date: string;
  durationMinutes?: number;
  time?: string;
  title: string;
  workshopStatus?: AdminWorkshopStatus;
  zoomAccount?: string;
};

export type AdminWorkshopRecordingPayload = {
  zoomRecordingPassword?: string | null;
  youtubeVideoUrl?: string | null;
  zoomRecordingUrl?: string | null;
};

export type ZoomMeetingFunctionResponse = {
  candidateId?: string;
  candidates?: unknown[];
  count?: number;
  duplicateCount?: number;
  workshop?: AdminWorkshop;
};

export function useAdminWorkshops(query: AdminWorkshopsQuery) {
  const { accessToken } = useAuth();
  const accessType = query.accessType ?? 'all';
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminWorkshop>>('/admins/workshops', {
        accessToken: accessToken ?? undefined,
        query: {
          accessType,
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['admin-workshops', accessToken, page, limit, accessType, status, search],
    staleTime: 60_000
  });
}

export function useSaveAdminWorkshop() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminWorkshopWritePayload) =>
      apiInvokeFunction<ZoomMeetingFunctionResponse, { action: string; body: AdminWorkshopWritePayload }>('zoom-meetings', {
        accessToken: accessToken ?? undefined,
        body: { action: 'create-meeting', body }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
    }
  });
}

export function useUpdateAdminWorkshop() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, workshopId }: { body: AdminWorkshopWritePayload; workshopId: string }) =>
      apiInvokeFunction<ZoomMeetingFunctionResponse, { action: string; body: AdminWorkshopWritePayload; workshopId: string }>('zoom-meetings', {
        accessToken: accessToken ?? undefined,
        body: { action: 'update-meeting', body, workshopId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
    }
  });
}

export function useRescheduleAdminWorkshop() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, workshopId }: { body: AdminWorkshopWritePayload; workshopId: string }) =>
      apiInvokeFunction<ZoomMeetingFunctionResponse, { action: string; body: AdminWorkshopWritePayload; workshopId: string }>('zoom-meetings', {
        accessToken: accessToken ?? undefined,
        body: { action: 'reschedule-meeting', body, workshopId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
    }
  });
}

export function useUpdateAdminWorkshopRecording() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, workshopId }: { body: AdminWorkshopRecordingPayload; workshopId: string }) =>
      apiPatch<AdminWorkshop, AdminWorkshopRecordingPayload>(`/admins/workshops/${workshopId}/recording`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
    }
  });
}

export function useMarkAdminWorkshopCompleted() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workshopId: string) =>
      apiInvokeFunction<ZoomMeetingFunctionResponse, { action: string; workshopId: string }>('zoom-meetings', {
        accessToken: accessToken ?? undefined,
        body: { action: 'complete-meeting', workshopId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
    }
  });
}

export function useCancelAdminWorkshop() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workshopId: string) =>
      apiInvokeFunction<ZoomMeetingFunctionResponse, { action: string; workshopId: string }>('zoom-meetings', {
        accessToken: accessToken ?? undefined,
        body: { action: 'cancel-meeting', workshopId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
    }
  });
}

export function useFetchAdminWorkshopRecordings() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workshopId: string) =>
      apiInvokeFunction<ZoomMeetingFunctionResponse, { action: string; workshopId: string }>('zoom-meetings', {
        accessToken: accessToken ?? undefined,
        body: { action: 'fetch-recordings', workshopId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-recording-candidates'] });
    }
  });
}

export function usePublishAdminWorkshopRecording() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (candidateId: string) =>
      apiInvokeFunction<ZoomMeetingFunctionResponse, { action: string; candidateId: string }>('zoom-meetings', {
        accessToken: accessToken ?? undefined,
        body: { action: 'publish-recording', candidateId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-recording-candidates'] });
    }
  });
}

export function useRejectAdminWorkshopRecording() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (candidateId: string) =>
      apiInvokeFunction<ZoomMeetingFunctionResponse, { action: string; candidateId: string }>('zoom-meetings', {
        accessToken: accessToken ?? undefined,
        body: { action: 'reject-recording', candidateId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-recording-candidates'] });
    }
  });
}
