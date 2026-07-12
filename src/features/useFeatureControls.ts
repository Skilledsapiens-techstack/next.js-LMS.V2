import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { apiGet, apiPatch } from '../lib/supabaseApi';
import { PaginatedResponse } from './student/useStudentAnnouncements';

export type FeatureControlStatus = 'show' | 'upcoming' | 'hide';

export type FeatureControl = {
  createdAt?: string;
  id: string;
  isCore: boolean;
  moduleId: string;
  settings?: Record<string, unknown> | null;
  sortOrder: number;
  status: FeatureControlStatus;
  studentLabel: string;
  studentPath: string;
  upcomingMessage?: string | null;
  updatedAt?: string;
  updatedBy?: string;
};

export type FeatureControlUpdatePayload = {
  settings?: Record<string, unknown> | null;
  status: FeatureControlStatus;
  upcomingMessage?: string | null;
};

export const defaultFeatureMessages: Record<string, string> = {
  announcements: 'Announcements will be enabled soon.',
  certificates: 'Certificates will be available after admin verification.',
  cohorts: 'Program details will be available shortly.',
  community: 'Community access is coming soon.',
  payments: 'Payments and access details will be available soon.',
  'project-submissions': 'Project submissions will be available soon.',
  projects: 'Live Project Hub will be enabled soon.',
  recordings: 'Watch Recordings will be available after your sessions are published.',
  resources: 'Resource Library will be available after onboarding.',
  schedule: 'Upcoming Workshops will be visible once sessions are planned.',
  support: 'Support will be available soon.',
  'whatsapp-widget': 'Contact Program Coordinator'
};

export function getFeatureMessage(feature?: Pick<FeatureControl, 'moduleId' | 'studentLabel' | 'upcomingMessage'> | null) {
  if (!feature) return 'This module will be available soon.';
  return feature.upcomingMessage?.trim() || defaultFeatureMessages[feature.moduleId] || `${feature.studentLabel} will be available soon.`;
}

export function useStudentFeatureControls(query: { enabled?: boolean } = {}) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<FeatureControl>>('/students/me/feature-controls', {
        accessToken: accessToken ?? undefined,
        query: { limit: 50, page: 1, sort: 'order' }
      }),
    queryKey: ['student-feature-controls', accessToken],
    staleTime: 120_000
  });
}

export function useAdminFeatureControls() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<FeatureControl>>('/admins/feature-controls', {
        accessToken: accessToken ?? undefined,
        query: { limit: 50, page: 1, sort: 'order' }
      }),
    queryKey: ['admin-feature-controls', accessToken],
    staleTime: 60_000
  });
}

export function useUpdateAdminFeatureControl() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, id }: { body: FeatureControlUpdatePayload; id: string }) =>
      apiPatch<FeatureControl, FeatureControlUpdatePayload>(`/admins/feature-controls/${id}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-feature-controls'] });
      void queryClient.invalidateQueries({ queryKey: ['student-feature-controls'] });
    }
  });
}
