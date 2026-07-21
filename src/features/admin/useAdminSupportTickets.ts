import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminSupportTicketStatus = 'open' | 'in_review' | 'waiting_for_student' | 'resolved' | 'closed';
export type AdminSupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type AdminSupportConversationMode = 'two_way' | 'admin_only';
export type AdminSupportMessageAuthorRole = 'student' | 'admin' | 'system';
export type AdminSupportMessageVisibility = 'public' | 'internal';

export type AdminSupportCategory = {
  allowAttachments: boolean;
  categoryKey: string;
  categoryName: string;
  conversationMode: AdminSupportConversationMode;
  defaultPriority: AdminSupportTicketPriority;
  id: string;
  sortOrder: number;
  status: 'active' | 'inactive';
};

export type AdminSupportFaq = {
  answer: string;
  categoryName?: string;
  cohortNames?: string[];
  featured: boolean;
  id: string;
  programKeys?: string[];
  question: string;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
};

export type AdminSupportTicket = {
  assignedAdminEmail?: string;
  categoryName: string;
  closedAt?: string;
  conversationMode: AdminSupportConversationMode;
  createdAt?: string;
  description?: string;
  id: string;
  lastAdminReplyAt?: string;
  lastMessageAt?: string;
  lastStudentReplyAt?: string;
  priority: AdminSupportTicketPriority;
  resolvedAt?: string;
  slaDueAt?: string;
  status: AdminSupportTicketStatus;
  studentEmail: string;
  studentName?: string;
  subject: string;
  ticketId?: string;
  updatedAt?: string;
};

export type AdminSupportTicketMessage = {
  authorEmail: string;
  authorName?: string;
  authorRole: AdminSupportMessageAuthorRole;
  body: string;
  createdAt: string;
  id: string;
  visibility: AdminSupportMessageVisibility;
};

export type AdminSupportTicketDetail = {
  hasMoreMessages: boolean;
  messageLimit: number;
  messages: AdminSupportTicketMessage[];
  ticket: AdminSupportTicket;
};

export type AdminSupportTicketUpdateInput = {
  assignedAdminEmail?: string;
  priority?: AdminSupportTicketPriority;
  status?: AdminSupportTicketStatus;
  ticketId: string;
};

export type AdminSupportTicketReplyInput = {
  body: string;
  sendEmail?: boolean;
  ticketId: string;
  visibility: AdminSupportMessageVisibility;
};

export type AdminSupportContactSettings = {
  settingKey: string;
  status: 'active' | 'inactive';
  supportContactNote: string;
  supportContactTitle: string;
  supportEmail: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export type AdminSupportTicketsQuery = {
  category?: string;
  limit?: number;
  page?: number;
  priority?: AdminSupportTicketPriority | 'all';
  search?: string;
  status?: AdminSupportTicketStatus | 'all';
};

export function useAdminSupportTickets(query: AdminSupportTicketsQuery) {
  const { accessToken } = useAuth();
  const category = query.category?.trim();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const priority = query.priority ?? 'all';
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminSupportTicket>>('/admins/support-tickets', {
        accessToken: accessToken ?? undefined,
        query: { category, limit, page, priority, search, status }
      }),
    queryKey: ['admin-support-tickets', accessToken, page, limit, status, priority, category, search],
    staleTime: 60_000
  });
}

export function useAdminSupportCategories() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminSupportCategory>>('/admins/support-categories', {
        accessToken: accessToken ?? undefined,
        query: { limit: 100, status: 'all' }
      }),
    queryKey: ['admin-support-categories', accessToken],
    staleTime: 5 * 60_000
  });
}

export function useAdminSupportFaqs() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<AdminSupportFaq>>('/admins/support-faqs', {
        accessToken: accessToken ?? undefined,
        query: { limit: 100, status: 'all' }
      }),
    queryKey: ['admin-support-faqs', accessToken],
    staleTime: 5 * 60_000
  });
}

export function useAdminSupportSettings() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<AdminSupportContactSettings>('/admins/support-settings', {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-support-settings', accessToken],
    staleTime: 5 * 60_000
  });
}

export function useUpdateAdminSupportSettings() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Partial<Pick<AdminSupportContactSettings, 'supportContactNote' | 'supportContactTitle' | 'supportEmail'>>) =>
      apiPatch<{ message: string; settings: AdminSupportContactSettings }, Partial<Pick<AdminSupportContactSettings, 'supportContactNote' | 'supportContactTitle' | 'supportEmail'>>>(
        '/admins/support-settings/student-contact',
        {
          accessToken: accessToken ?? undefined,
          body
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-support-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['student-support-settings'] });
    }
  });
}

export function useCreateAdminSupportCategory() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Partial<AdminSupportCategory>) =>
      apiPost<{ category: AdminSupportCategory; message: string }, Partial<AdminSupportCategory>>('/admins/support-categories', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-support-categories'] })
  });
}

export function useUpdateAdminSupportCategory() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AdminSupportCategory> & { id: string }) =>
      apiPatch<{ category: AdminSupportCategory; message: string }, Partial<AdminSupportCategory>>(`/admins/support-categories/${encodeURIComponent(id)}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-support-categories'] })
  });
}

export function useCreateAdminSupportFaq() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Partial<AdminSupportFaq>) =>
      apiPost<{ faq: AdminSupportFaq; message: string }, Partial<AdminSupportFaq>>('/admins/support-faqs', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-support-faqs'] })
  });
}

export function useUpdateAdminSupportFaq() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AdminSupportFaq> & { id: string }) =>
      apiPatch<{ faq: AdminSupportFaq; message: string }, Partial<AdminSupportFaq>>(`/admins/support-faqs/${encodeURIComponent(id)}`, {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-support-faqs'] })
  });
}

export function useDeleteAdminSupportFaq() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ message: string; faqId: string }>(`/admins/support-faqs/${encodeURIComponent(id)}`, {
        accessToken: accessToken ?? undefined
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-support-faqs'] })
  });
}

export function useAdminSupportTicketDetail(ticketId: string | undefined) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken && ticketId),
    queryFn: () =>
      apiGet<AdminSupportTicketDetail>(`/admins/support-tickets/${encodeURIComponent(ticketId ?? '')}`, {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['admin-support-ticket-detail', accessToken, ticketId],
    staleTime: 60_000
  });
}

export function useUpdateAdminSupportTicket() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, ...body }: AdminSupportTicketUpdateInput) =>
      apiPatch<{ message: string; ticket: AdminSupportTicket }, Omit<AdminSupportTicketUpdateInput, 'ticketId'>>(
        `/admins/support-tickets/${encodeURIComponent(ticketId)}`,
        {
          accessToken: accessToken ?? undefined,
          body
        }
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-support-ticket-detail', accessToken, variables.ticketId] });
    }
  });
}

export function useCreateAdminSupportTicketReply() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, sendEmail, ticketId, visibility }: AdminSupportTicketReplyInput) =>
      apiPost<{ message: string; reply: AdminSupportTicketMessage; ticket: AdminSupportTicket }, { body: string; sendEmail?: boolean; visibility: AdminSupportMessageVisibility }>(
        `/admins/support-tickets/${encodeURIComponent(ticketId)}/messages`,
        {
          accessToken: accessToken ?? undefined,
          body: { body, sendEmail, visibility }
        }
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-support-ticket-detail', accessToken, variables.ticketId] });
    }
  });
}

export function useCloseAdminSupportTicket() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) =>
      apiPatch<{ message: string; ticket: AdminSupportTicket }>(`/admins/support-tickets/${encodeURIComponent(ticketId)}/close`, {
        accessToken: accessToken ?? undefined
      }),
    onSuccess: (_data, ticketId) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-support-ticket-detail', accessToken, ticketId] });
    }
  });
}

export function useReopenAdminSupportTicket() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) =>
      apiPatch<{ message: string; ticket: AdminSupportTicket }>(`/admins/support-tickets/${encodeURIComponent(ticketId)}/reopen`, {
        accessToken: accessToken ?? undefined
      }),
    onSuccess: (_data, ticketId) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-support-ticket-detail', accessToken, ticketId] });
    }
  });
}
