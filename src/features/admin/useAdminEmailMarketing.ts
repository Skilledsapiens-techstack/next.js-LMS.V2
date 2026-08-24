import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type EmailMarketingCampaignStatus = 'active' | 'paused' | 'archived';
export type EmailMarketingPlanStatus = 'draft' | 'reviewed' | 'sent' | 'skipped' | 'cancelled';
export type EmailMarketingPlanEventType = 'created' | 'reviewed' | 'sent' | 'skipped' | 'cancelled' | 'note';

export type AdminEmailMarketingCampaign = {
  audienceRules: Record<string, unknown>;
  campaignKey: string;
  createdAt?: string;
  createdBy?: string | null;
  defaultBody?: string | null;
  defaultResourceIds: string[];
  defaultSubject?: string | null;
  description?: string | null;
  id: string;
  phase: string;
  rotationWeight: number;
  status: EmailMarketingCampaignStatus;
  templateKey?: string | null;
  title: string;
  touchIntervalDays: number;
  updatedAt?: string;
  updatedBy?: string | null;
};

export type AdminEmailMarketingPlan = {
  campaignId?: string | null;
  campaignPhase: string;
  campaignTitle: string;
  cohortIds: string[];
  cohortNames: string[];
  createdAt?: string;
  createdBy?: string | null;
  dailyLimit: number;
  id: string;
  metadata: Record<string, unknown>;
  plannedDate: string;
  plannedRecipientCount: number;
  planKey: string;
  priorityScore: number;
  rationale?: string | null;
  resourceIds: string[];
  sentAt?: string | null;
  sentBy?: string | null;
  sentEmailQueueIds: string[];
  skipReason?: string | null;
  skippedAt?: string | null;
  skippedBy?: string | null;
  status: EmailMarketingPlanStatus;
  suggestedBatchSize: number;
  suggestedBody?: string | null;
  suggestedSubject?: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
};

export type AdminEmailMarketingPlanEvent = {
  actorEmail?: string | null;
  createdAt?: string;
  details: Record<string, unknown>;
  eventType: EmailMarketingPlanEventType;
  id: string;
  planId: string;
};

export type AdminEmailMarketingCohortTouch = {
  campaignPhase?: string;
  campaignTitle?: string;
  cohortName: string;
  lastPlanId?: string;
  lastTouchedAt?: string;
  lastTouchStatus?: string;
  plannedRecipientCount?: number;
};

export type AdminEmailProviderEvent = {
  createdAt?: string;
  emailQueueId?: string | null;
  eventStatus: string;
  eventType: string;
  id: string;
  linkUrl?: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  provider: string;
  providerEventId?: string | null;
  providerMessageId?: string | null;
  reason?: string | null;
  receivedAt?: string;
  recipientEmail?: string | null;
  subject?: string | null;
  tags: string[];
  templateId?: string | null;
};

export type AdminEmailSuppressionOverrideStatus = 'cleared' | 'suppressed';

export type AdminEmailSuppressionOverride = {
  createdAt?: string;
  createdBy?: string | null;
  id: string;
  reason?: string | null;
  recipientEmail: string;
  status: AdminEmailSuppressionOverrideStatus;
};

export type AdminEmailSendAuditLog = {
  action: string;
  actorEmail?: string | null;
  attemptKey: string;
  batchSize: number;
  bodySnapshot?: string | null;
  category?: string | null;
  cohortNames: string[];
  completedAt?: string | null;
  createdAt?: string;
  dailyLimit: number;
  failed: number;
  failureMessage?: string | null;
  id: string;
  metadata: Record<string, unknown>;
  provider: string;
  queueRowsCreated: number;
  recipientFilters: Record<string, unknown>;
  recipientSnapshot: Record<string, unknown>[];
  recipients: number;
  remainingAfterBatch: number;
  remainingToday: number;
  resolvedRecipients: number;
  results: Record<string, unknown>[];
  sendMode: string;
  sent: number;
  startedAt: string;
  status: 'started' | 'sent' | 'partial' | 'failed';
  subject?: string | null;
  subjectSnapshot?: string | null;
  suppressedRecipients: number;
  templateKey?: string | null;
  originalPayload?: Record<string, unknown>;
  retryOfAttemptKey?: string | null;
  updatedAt?: string;
  usedToday: number;
  willSend: number;
};

export type AdminEmailMarketingCohortTouchResult = {
  generatedAt: string;
  items: AdminEmailMarketingCohortTouch[];
};

export type AdminEmailMarketingCampaignPayload = {
  audienceRules?: Record<string, unknown>;
  campaignKey: string;
  defaultBody?: string | null;
  defaultResourceIds?: string[];
  defaultSubject?: string | null;
  description?: string | null;
  phase: string;
  rotationWeight?: number;
  status?: EmailMarketingCampaignStatus;
  templateKey?: string | null;
  title: string;
  touchIntervalDays?: number;
};

export type AdminEmailMarketingPlanPayload = {
  campaignId?: string | null;
  campaignPhase: string;
  campaignTitle: string;
  cohortIds?: string[];
  cohortNames?: string[];
  dailyLimit?: number;
  metadata?: Record<string, unknown>;
  plannedDate: string;
  plannedRecipientCount?: number;
  planKey: string;
  priorityScore?: number;
  rationale?: string | null;
  resourceIds?: string[];
  sentAt?: string | null;
  sentBy?: string | null;
  sentEmailQueueIds?: string[];
  skipReason?: string | null;
  skippedAt?: string | null;
  skippedBy?: string | null;
  status?: EmailMarketingPlanStatus;
  suggestedBatchSize?: number;
  suggestedBody?: string | null;
  suggestedSubject?: string | null;
};

export type AdminEmailMarketingPlanEventPayload = {
  actorEmail?: string;
  details?: Record<string, unknown>;
  eventType: EmailMarketingPlanEventType;
  planId: string;
};

export type AdminEmailSuppressionOverridePayload = {
  reason?: string | null;
  recipientEmail: string;
  status: AdminEmailSuppressionOverrideStatus;
};

export type AdminEmailMarketingQuery = {
  enabled?: boolean;
  emailQueueId?: string;
  eventType?: string;
  limit?: number;
  page?: number;
  phase?: string;
  plannedDate?: string;
  planId?: string;
  search?: string;
  sort?: 'newest' | 'priority' | 'updated';
  status?: string;
};

export function useAdminEmailMarketingCampaigns(query: AdminEmailMarketingQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 100;
  const page = query.page ?? 1;

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEmailMarketingCampaign>>('/admins/email-marketing-campaigns', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          phase: query.phase,
          search: query.search?.trim(),
          sort: query.sort ?? 'priority',
          status: query.status ?? 'active'
        }
      }),
    queryKey: ['admin-email-marketing-campaigns', accessToken, page, limit, query.phase, query.search, query.sort, query.status],
    staleTime: 60_000
  });
}

export function useAdminEmailMarketingPlans(query: AdminEmailMarketingQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 30;
  const page = query.page ?? 1;

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEmailMarketingPlan>>('/admins/email-marketing-plans', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          id: query.planId,
          plannedDate: query.plannedDate,
          search: query.search?.trim(),
          sort: query.sort ?? 'newest',
          status: query.status
        }
      }),
    queryKey: ['admin-email-marketing-plans', accessToken, page, limit, query.planId, query.plannedDate, query.search, query.sort, query.status],
    staleTime: 30_000
  });
}

export function useAdminEmailMarketingPlanEvents(query: AdminEmailMarketingQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 20;
  const page = query.page ?? 1;

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false && Boolean(query.planId),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEmailMarketingPlanEvent>>('/admins/email-marketing-plan-events', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          planId: query.planId,
          sort: 'newest'
        }
      }),
    queryKey: ['admin-email-marketing-plan-events', accessToken, page, limit, query.planId],
    staleTime: 30_000
  });
}

export function useAdminEmailMarketingCohortTouch(query: { enabled?: boolean } = {}) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<AdminEmailMarketingCohortTouchResult>('/admins/email-marketing-cohort-touch', {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-email-marketing-cohort-touch', accessToken],
    staleTime: 30_000
  });
}

export function useAdminEmailProviderEvents(query: AdminEmailMarketingQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 100;
  const page = query.page ?? 1;

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEmailProviderEvent>>('/admins/email-provider-events', {
        accessToken: accessToken ?? undefined,
        query: {
          emailQueueId: query.emailQueueId,
          eventType: query.eventType,
          limit,
          page,
          provider: 'brevo',
          search: query.search?.trim(),
          sort: 'newest'
        }
      }),
    queryKey: ['admin-email-provider-events', accessToken, page, limit, query.emailQueueId, query.eventType, query.search],
    staleTime: 30_000
  });
}

export function useAdminEmailSuppressionOverrides(query: AdminEmailMarketingQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 300;
  const page = query.page ?? 1;

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEmailSuppressionOverride>>('/admins/email-suppression-overrides', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          recipientEmail: query.search?.trim(),
          search: query.search?.trim(),
          sort: 'newest',
          status: query.status
        }
      }),
    queryKey: ['admin-email-suppression-overrides', accessToken, page, limit, query.search, query.status],
    staleTime: 30_000
  });
}

export function useAdminEmailSendAuditLogs(query: AdminEmailMarketingQuery = {}) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 30;
  const page = query.page ?? 1;

  return useQuery({
    enabled: Boolean(accessToken) && query.enabled !== false,
    queryFn: () =>
      apiGet<PaginatedResponse<AdminEmailSendAuditLog>>('/admins/email-send-audit-logs', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          search: query.search?.trim(),
          sort: 'newest',
          status: query.status
        }
      }),
    queryKey: ['admin-email-send-audit-logs', accessToken, page, limit, query.search, query.status],
    staleTime: 20_000
  });
}

export function useCreateAdminEmailMarketingCampaign() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminEmailMarketingCampaignPayload) =>
      apiPost<AdminEmailMarketingCampaign, AdminEmailMarketingCampaignPayload>('/admins/email-marketing-campaigns', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-marketing-campaigns'] })
  });
}

export function useUpdateAdminEmailMarketingCampaign() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, campaignId }: { body: Partial<AdminEmailMarketingCampaignPayload>; campaignId: string }) =>
      apiPatch<AdminEmailMarketingCampaign, Partial<AdminEmailMarketingCampaignPayload>>(`/admins/email-marketing-campaigns/${campaignId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-marketing-campaigns'] })
  });
}

export function useCreateAdminEmailMarketingPlan() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminEmailMarketingPlanPayload) =>
      apiPost<AdminEmailMarketingPlan, AdminEmailMarketingPlanPayload>('/admins/email-marketing-plans', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-marketing-plans'] })
  });
}

export function useUpdateAdminEmailMarketingPlan() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, planId }: { body: Partial<AdminEmailMarketingPlanPayload>; planId: string }) =>
      apiPatch<AdminEmailMarketingPlan, Partial<AdminEmailMarketingPlanPayload>>(`/admins/email-marketing-plans/${planId}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-marketing-plans'] })
  });
}

export function useCreateAdminEmailMarketingPlanEvent() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminEmailMarketingPlanEventPayload) =>
      apiPost<AdminEmailMarketingPlanEvent, AdminEmailMarketingPlanEventPayload>('/admins/email-marketing-plan-events', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-marketing-plan-events'] })
  });
}

export function useCreateAdminEmailSuppressionOverride() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminEmailSuppressionOverridePayload) =>
      apiPost<AdminEmailSuppressionOverride, AdminEmailSuppressionOverridePayload>('/admins/email-suppression-overrides', {
        accessToken: accessToken ?? undefined,
        body: {
          ...body,
          recipientEmail: body.recipientEmail.trim().toLowerCase()
        }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-suppression-overrides'] })
  });
}
