import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type WhatsAppStatus = 'active' | 'inactive';
export type WhatsAppLogStatus = 'draft' | 'sent' | 'skipped';

export type AdminWhatsAppGroup = {
  cohortName?: string | null;
  createdAt?: string;
  createdBy?: string;
  directChatLink?: string | null;
  groupName: string;
  id: string;
  inviteLink?: string | null;
  notes?: string | null;
  programName?: string | null;
  status: WhatsAppStatus;
  updatedAt?: string;
  updatedBy?: string;
};

export type AdminWhatsAppCategory = {
  createdAt?: string;
  id: string;
  name: string;
  sortOrder: number;
  status: WhatsAppStatus;
  updatedAt?: string;
};

export type AdminWhatsAppTemplate = {
  categoryId?: string | null;
  createdAt?: string;
  id: string;
  messageBody: string;
  notes?: string | null;
  status: WhatsAppStatus;
  title: string;
  updatedAt?: string;
};

export type AdminWhatsAppLog = {
  categoryId?: string | null;
  cohortName?: string | null;
  createdAt?: string;
  groupId?: string | null;
  groupName: string;
  id: string;
  messageBody: string;
  messageTitle: string;
  notes?: string | null;
  programName?: string | null;
  sentAt?: string;
  sentBy?: string | null;
  status: WhatsAppLogStatus;
  templateId?: string | null;
};

export type AdminWhatsAppGroupPayload = {
  cohortName?: string | null;
  directChatLink?: string | null;
  groupName: string;
  inviteLink?: string | null;
  notes?: string | null;
  programName?: string | null;
  status: WhatsAppStatus;
};

export type AdminWhatsAppCategoryPayload = {
  name: string;
  sortOrder: number;
  status: WhatsAppStatus;
};

export type AdminWhatsAppTemplatePayload = {
  categoryId?: string | null;
  messageBody: string;
  notes?: string | null;
  status: WhatsAppStatus;
  title: string;
};

export type AdminWhatsAppLogPayload = {
  categoryId?: string | null;
  cohortName?: string | null;
  groupId?: string | null;
  groupName: string;
  messageBody: string;
  messageTitle: string;
  notes?: string | null;
  programName?: string | null;
  sentAt?: string;
  status: WhatsAppLogStatus;
  templateId?: string | null;
};

type WhatsAppListQuery = {
  categoryId?: string;
  cohortName?: string;
  enabled?: boolean;
  groupId?: string;
  limit?: number;
  page?: number;
  search?: string;
  sort?: string;
  status?: string;
};

function useAdminList<TItem>(path: string, key: string, query: WhatsAppListQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 100;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<TItem>>(path, {
        accessToken: accessToken ?? undefined,
        query: {
          categoryId: query.categoryId || undefined,
          cohortName: query.cohortName || undefined,
          groupId: query.groupId || undefined,
          limit,
          page,
          search,
          sort: query.sort,
          status
        }
      }),
    queryKey: [key, accessToken, page, limit, status, search, query.sort, query.categoryId, query.cohortName, query.groupId],
    staleTime: 30_000
  });
}

export function useAdminWhatsAppGroups(query: WhatsAppListQuery = {}) {
  return useAdminList<AdminWhatsAppGroup>('/admins/whatsapp-groups', 'admin-whatsapp-groups', { sort: 'cohort', ...query });
}

export function useAdminWhatsAppCategories(query: WhatsAppListQuery = {}) {
  return useAdminList<AdminWhatsAppCategory>('/admins/whatsapp-categories', 'admin-whatsapp-categories', { sort: 'order', ...query });
}

export function useAdminWhatsAppTemplates(query: WhatsAppListQuery = {}) {
  return useAdminList<AdminWhatsAppTemplate>('/admins/whatsapp-templates', 'admin-whatsapp-templates', { sort: 'updated', ...query });
}

export function useAdminWhatsAppLogs(query: WhatsAppListQuery = {}) {
  return useAdminList<AdminWhatsAppLog>('/admins/whatsapp-logs', 'admin-whatsapp-logs', { sort: 'newest', ...query });
}

function useInvalidateWhatsApp() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin-whatsapp-groups'] });
    queryClient.invalidateQueries({ queryKey: ['admin-whatsapp-categories'] });
    queryClient.invalidateQueries({ queryKey: ['admin-whatsapp-templates'] });
    queryClient.invalidateQueries({ queryKey: ['admin-whatsapp-logs'] });
  };
}

export function useCreateAdminWhatsAppGroup() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateWhatsApp();
  return useMutation({
    mutationFn: (body: AdminWhatsAppGroupPayload) => apiPost<AdminWhatsAppGroup, AdminWhatsAppGroupPayload>('/admins/whatsapp-groups', { accessToken: accessToken ?? undefined, body }),
    onSuccess: invalidate
  });
}

export function useUpdateAdminWhatsAppGroup() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateWhatsApp();
  return useMutation({
    mutationFn: ({ groupId, body }: { body: Partial<AdminWhatsAppGroupPayload>; groupId: string }) =>
      apiPatch<AdminWhatsAppGroup, Partial<AdminWhatsAppGroupPayload>>(`/admins/whatsapp-groups/${groupId}`, { accessToken: accessToken ?? undefined, body }),
    onSuccess: invalidate
  });
}

export function useCreateAdminWhatsAppCategory() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateWhatsApp();
  return useMutation({
    mutationFn: (body: AdminWhatsAppCategoryPayload) => apiPost<AdminWhatsAppCategory, AdminWhatsAppCategoryPayload>('/admins/whatsapp-categories', { accessToken: accessToken ?? undefined, body }),
    onSuccess: invalidate
  });
}

export function useUpdateAdminWhatsAppCategory() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateWhatsApp();
  return useMutation({
    mutationFn: ({ categoryId, body }: { body: Partial<AdminWhatsAppCategoryPayload>; categoryId: string }) =>
      apiPatch<AdminWhatsAppCategory, Partial<AdminWhatsAppCategoryPayload>>(`/admins/whatsapp-categories/${categoryId}`, { accessToken: accessToken ?? undefined, body }),
    onSuccess: invalidate
  });
}

export function useCreateAdminWhatsAppTemplate() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateWhatsApp();
  return useMutation({
    mutationFn: (body: AdminWhatsAppTemplatePayload) => apiPost<AdminWhatsAppTemplate, AdminWhatsAppTemplatePayload>('/admins/whatsapp-templates', { accessToken: accessToken ?? undefined, body }),
    onSuccess: invalidate
  });
}

export function useUpdateAdminWhatsAppTemplate() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateWhatsApp();
  return useMutation({
    mutationFn: ({ templateId, body }: { body: Partial<AdminWhatsAppTemplatePayload>; templateId: string }) =>
      apiPatch<AdminWhatsAppTemplate, Partial<AdminWhatsAppTemplatePayload>>(`/admins/whatsapp-templates/${templateId}`, { accessToken: accessToken ?? undefined, body }),
    onSuccess: invalidate
  });
}

export function useCreateAdminWhatsAppLog() {
  const { accessToken } = useAuth();
  const invalidate = useInvalidateWhatsApp();
  return useMutation({
    mutationFn: (body: AdminWhatsAppLogPayload) => apiPost<AdminWhatsAppLog, AdminWhatsAppLogPayload>('/admins/whatsapp-logs', { accessToken: accessToken ?? undefined, body }),
    onSuccess: invalidate
  });
}
