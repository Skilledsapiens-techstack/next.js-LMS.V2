import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiInvokeFunction, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type EmailTemplateStatus = 'active' | 'inactive';

export type AdminEmailTemplate = {
  allowedVariables: string[];
  body: string;
  brevoTemplateId?: number | null;
  category: string;
  createdAt?: string;
  defaultTags: string[];
  description?: string | null;
  id: string;
  isSystem: boolean;
  phase: string;
  sampleParams: Record<string, unknown>;
  sortOrder: number;
  status: EmailTemplateStatus;
  subject: string;
  templateKey: string;
  templateName: string;
  updatedAt?: string;
};

export type AdminEmailQueueItem = {
  category?: string;
  createdAt?: string;
  failureMessage?: string;
  id: string;
  recipientEmail?: string;
  recipientName?: string;
  sentAt?: string;
  status?: string;
  subject?: string;
  templateKey?: string;
};

export type AdminEmailTemplatesQuery = {
  category?: string;
  enabled?: boolean;
  limit?: number;
  page?: number;
  phase?: string;
  search?: string;
  sort?: 'order' | 'updated';
  status?: EmailTemplateStatus | 'all';
};

export type AdminEmailQueueQuery = {
  category?: string;
  enabled?: boolean;
  limit?: number;
  page?: number;
  search?: string;
  status?: string;
};

export type AdminEmailTemplatePayload = {
  allowedVariables?: string[];
  body: string;
  category: string;
  defaultTags?: string[];
  description?: string | null;
  isSystem?: boolean;
  phase: string;
  sampleParams?: Record<string, unknown>;
  sortOrder?: number;
  status: EmailTemplateStatus;
  subject: string;
  templateKey?: string;
  templateName: string;
};

export type AdminEmailSendPayload = {
  action: 'resolveAdminStudentCommunication' | 'sendAdminStudentCommunication';
  batchSize?: number;
  body: string;
  cohortNames?: string[];
  confirmed?: boolean;
  directEmails?: string;
  googleGroupEmail?: string;
  params?: Record<string, unknown>;
  sendMode: 'direct' | 'cohort_students' | 'cohort_google_group' | 'all_active_students';
  subject: string;
  templateKey?: string;
  testMode?: boolean;
};

export type AdminEmailRecipientPreview = {
  email: string;
  name: string;
  relatedType: string;
};

export type AdminEmailResolveResult = {
  alreadySentToday: number;
  batchSize: number;
  dailyLimit: number;
  deliverableRecipients: number;
  message: string;
  ok: boolean;
  previewRecipients: AdminEmailRecipientPreview[];
  recipients: number;
  remainingAfterBatch: number;
  remainingToday: number;
  templateKey: string;
  usedToday: number;
  willSend: number;
};

export type AdminEmailSendResult = {
  alreadySentToday?: number;
  batchSize?: number;
  dailyLimit?: number;
  deliverableRecipients?: number;
  error?: string;
  failed: number;
  message: string;
  ok: boolean;
  recipients: number;
  remainingAfterBatch?: number;
  remainingToday?: number;
  sent: number;
  status: string;
  templateKey: string;
  usedToday?: number;
  willSend?: number;
};

export function useAdminEmailTemplates(query: AdminEmailTemplatesQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 500;
  const page = query.page ?? 1;
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEmailTemplate>>('/admins/email-templates', {
        accessToken: accessToken ?? undefined,
        query: {
          category: query.category,
          limit,
          page,
          phase: query.phase,
          search: query.search?.trim(),
          sort: query.sort ?? 'order',
          status
        }
      }),
    queryKey: ['admin-email-templates', accessToken, page, limit, status, query.phase, query.category, query.search, query.sort],
    staleTime: 30_000
  });
}

export function useAdminEmailQueue(query: AdminEmailQueueQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 8;
  const page = query.page ?? 1;

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEmailQueueItem>>('/admins/email-queue', {
        accessToken: accessToken ?? undefined,
        query: {
          category: query.category,
          limit,
          page,
          search: query.search?.trim(),
          sort: 'newest',
          status: query.status
        }
      }),
    queryKey: ['admin-email-queue', accessToken, page, limit, query.category, query.status, query.search],
    staleTime: 30_000
  });
}

export function useCreateAdminEmailTemplate() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminEmailTemplatePayload) =>
      apiPost<AdminEmailTemplate, AdminEmailTemplatePayload>('/admins/email-templates', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-templates'] })
  });
}

export function useUpdateAdminEmailTemplate() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, templateId }: { body: AdminEmailTemplatePayload; templateId: string }) =>
      apiPatch<AdminEmailTemplate, AdminEmailTemplatePayload>(`/admins/email-templates/${templateId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-templates'] })
  });
}

export function useArchiveAdminEmailTemplate() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) =>
      apiPatch<AdminEmailTemplate, Record<string, never>>(`/admins/email-templates/${templateId}/archive`, {
        accessToken: accessToken ?? undefined,
        body: {}
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-templates'] })
  });
}

export function useSendAdminEmail() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminEmailSendPayload) =>
      apiInvokeFunction<AdminEmailSendResult, AdminEmailSendPayload>('transactional-email', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-queue'] })
  });
}

export function useResolveAdminEmailRecipients() {
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: (body: AdminEmailSendPayload) =>
      apiInvokeFunction<AdminEmailResolveResult, AdminEmailSendPayload>('transactional-email', {
        accessToken: accessToken ?? undefined,
        body: { ...body, action: 'resolveAdminStudentCommunication' }
      })
  });
}
