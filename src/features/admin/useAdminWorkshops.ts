import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch } from '../../lib/supabaseApi';
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
  zoomRecordingUrl?: string;
};

export type AdminWorkshopsQuery = {
  accessType?: AdminWorkshopAccessType | 'all';
  limit?: number;
  page?: number;
  search?: string;
  status?: AdminWorkshopStatus | 'all';
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

export type AdminWorkshopStatusTransitionResult = {
  status: 'not_found' | 'disabled' | 'skipped' | 'updated' | 'failed';
  message: string;
  workshopId?: string;
};

export function useMarkAdminWorkshopCompleted() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workshopId: string) =>
      apiPatch<AdminWorkshopStatusTransitionResult>(`/admins/workshops/${workshopId}/complete`, {
        accessToken: accessToken ?? undefined
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workshops'] });
    }
  });
}
