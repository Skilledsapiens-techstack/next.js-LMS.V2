import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminGuestLeadStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'not_interested';
export type AdminGuestAudienceType = 'student' | 'working_professional' | 'other';

export type AdminGuestLeadNote = {
  createdAt?: string;
  createdBy?: string;
  guestLeadId: string;
  id: string;
  note: string;
};

export type AdminGuestLead = {
  audienceType: AdminGuestAudienceType;
  authUserId?: string;
  collegeName?: string | null;
  companyName?: string | null;
  createdAt?: string;
  currentCity?: string | null;
  currentJobRole?: string | null;
  currentStatus: string;
  deactivatedAt?: string | null;
  educationYear?: string | null;
  emailVerifiedAt?: string | null;
  fullName: string;
  id: string;
  interestedProgram?: string | null;
  interestedRoles: string[];
  lastActiveAt?: string | null;
  leadStatus: AdminGuestLeadStatus;
  mentorAllocationInterest: string;
  notes?: AdminGuestLeadNote[];
  officialEmail?: string | null;
  personalEmail: string;
  source?: string;
  updatedAt?: string;
  whatsappCountryCode: string;
  whatsappNumber: string;
};

export type AdminGuestLeadsQuery = {
  audienceType?: AdminGuestAudienceType | 'all';
  city?: string;
  interestedRole?: string;
  leadStatus?: AdminGuestLeadStatus | 'all';
  limit?: number;
  mentor?: string;
  page?: number;
  search?: string;
  sort?: 'newest' | 'last_active';
};

export function useAdminGuestLeads(query: AdminGuestLeadsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;

  return useQuery({
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminGuestLead>>('/admins/guest-leads', {
        accessToken: accessToken ?? undefined,
        query: {
          audienceType: query.audienceType ?? 'all',
          city: query.city?.trim(),
          interestedRole: query.interestedRole?.trim(),
          leadStatus: query.leadStatus ?? 'all',
          limit,
          mentor: query.mentor?.trim(),
          page,
          search: query.search?.trim(),
          sort: query.sort ?? 'newest'
        }
      }),
    queryKey: ['admin-guest-leads', accessToken, page, limit, query.leadStatus, query.audienceType, query.interestedRole, query.city, query.mentor, query.search, query.sort],
    staleTime: 45_000
  });
}

export function useAdminGuestLeadDetail(guestLeadId?: string | null) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken && guestLeadId),
    queryFn: () => apiGet<AdminGuestLead>(`/admins/guest-leads/${guestLeadId}`, { accessToken: accessToken ?? undefined }),
    queryKey: ['admin-guest-lead-detail', accessToken, guestLeadId],
    staleTime: 30_000
  });
}

export function useUpdateAdminGuestLeadStatus() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guestLeadId, leadStatus }: { guestLeadId: string; leadStatus: AdminGuestLeadStatus }) =>
      apiPatch<AdminGuestLead, { leadStatus: AdminGuestLeadStatus }>(`/admins/guest-leads/${guestLeadId}/status`, {
        accessToken: accessToken ?? undefined,
        body: { leadStatus }
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-guest-leads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-guest-lead-detail', accessToken, variables.guestLeadId] });
    }
  });
}

export function useToggleAdminGuestLeadAccess() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ active, guestLeadId }: { active: boolean; guestLeadId: string }) =>
      apiPatch<AdminGuestLead, { active: boolean }>(`/admins/guest-leads/${guestLeadId}/access`, {
        accessToken: accessToken ?? undefined,
        body: { active }
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-guest-leads'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-guest-lead-detail', accessToken, variables.guestLeadId] });
    }
  });
}

export function useCreateAdminGuestLeadNote() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guestLeadId, note }: { guestLeadId: string; note: string }) =>
      apiPost<AdminGuestLeadNote, { note: string }>(`/admins/guest-leads/${guestLeadId}/notes`, {
        accessToken: accessToken ?? undefined,
        body: { note }
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-guest-lead-detail', accessToken, variables.guestLeadId] });
    }
  });
}
