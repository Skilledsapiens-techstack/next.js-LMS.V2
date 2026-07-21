import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet, apiPost } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentSupportTicketStatus = 'open' | 'in_review' | 'waiting_for_student' | 'resolved' | 'closed';
export type StudentSupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type StudentSupportConversationMode = 'two_way' | 'admin_only';
export type StudentSupportMessageAuthorRole = 'student' | 'admin' | 'system';

export type StudentSupportCategory = {
  allowAttachments: boolean;
  categoryKey: string;
  categoryName: string;
  conversationMode: StudentSupportConversationMode;
  defaultPriority: StudentSupportTicketPriority;
  id: string;
  sortOrder: number;
  status: 'active' | 'inactive';
};

export type StudentSupportFaq = {
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

export type StudentSupportTicket = {
  canReply: boolean;
  categoryName: string;
  closedAt?: string;
  conversationMode: StudentSupportConversationMode;
  createdAt?: string;
  description?: string;
  id: string;
  lastAdminReplyAt?: string;
  lastMessageAt?: string;
  lastStudentReplyAt?: string;
  priority: StudentSupportTicketPriority;
  resolvedAt?: string;
  slaDueAt?: string;
  status: StudentSupportTicketStatus;
  subject: string;
  ticketId?: string;
  updatedAt?: string;
};

export type StudentSupportTicketMessage = {
  authorName?: string;
  authorRole: StudentSupportMessageAuthorRole;
  body: string;
  createdAt: string;
  id: string;
};

export type StudentSupportTicketDetail = {
  hasMoreMessages: boolean;
  messageLimit: number;
  messages: StudentSupportTicketMessage[];
  ticket: StudentSupportTicket;
};

export type StudentSupportTicketCreateInput = {
  categoryName: string;
  description: string;
  priority: 'normal' | 'urgent';
  relatedUrl?: string;
  subject: string;
};

export type StudentSupportTicketReplyInput = {
  body: string;
  ticketId: string;
};

export type StudentSupportContactSettings = {
  settingKey: string;
  status: 'active' | 'inactive';
  supportContactNote: string;
  supportContactTitle: string;
  supportEmail: string;
  updatedAt?: string | null;
};

export type StudentSupportTicketsQuery = {
  limit?: number;
  page?: number;
  search?: string;
  status?: StudentSupportTicketStatus | 'all';
};

export function useStudentSupportTickets(query: StudentSupportTicketsQuery) {
  const { accessToken } = useAuth();
  const limit = query.limit ?? 25;
  const page = query.page ?? 1;
  const search = query.search?.trim();
  const status = query.status ?? 'all';

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentSupportTicket>>('/students/me/support-tickets', {
        accessToken: accessToken ?? undefined,
        query: {
          limit,
          page,
          search,
          status
        }
      }),
    queryKey: ['student-support-tickets', accessToken, page, limit, status, search],
    staleTime: 60_000
  });
}

export function useStudentSupportCategories() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentSupportCategory>>('/support/categories', {
        accessToken: accessToken ?? undefined,
        query: { limit: 100 }
      }),
    queryKey: ['student-support-categories', accessToken],
    staleTime: 5 * 60_000
  });
}

export function useStudentSupportFaqs() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentSupportFaq>>('/students/me/support-faqs', {
        accessToken: accessToken ?? undefined,
        query: { limit: 100 }
      }),
    queryKey: ['student-support-faqs', accessToken],
    staleTime: 5 * 60_000
  });
}

export function useStudentSupportSettings() {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      apiGet<StudentSupportContactSettings>('/students/me/support-settings', {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['student-support-settings', accessToken],
    staleTime: 5 * 60_000
  });
}

export function useStudentSupportTicketDetail(ticketId: string | undefined) {
  const { accessToken } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken && ticketId),
    queryFn: () =>
      apiGet<StudentSupportTicketDetail>(`/students/me/support-tickets/${encodeURIComponent(ticketId ?? '')}`, {
        accessToken: accessToken ?? undefined
      }),
    queryKey: ['student-support-ticket-detail', accessToken, ticketId],
    staleTime: 60_000
  });
}

export function useCreateStudentSupportTicket() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: StudentSupportTicketCreateInput) =>
      apiPost<{ message: string; ticket: StudentSupportTicket }, StudentSupportTicketCreateInput>('/students/me/support-tickets', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-support-tickets'] });
    }
  });
}

export function useCreateStudentSupportTicketReply() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, ticketId }: StudentSupportTicketReplyInput) =>
      apiPost<{ message: string; reply: StudentSupportTicketMessage; ticket: StudentSupportTicket }, { body: string }>(
        `/students/me/support-tickets/${encodeURIComponent(ticketId)}/messages`,
        {
          accessToken: accessToken ?? undefined,
          body: { body }
        }
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['student-support-tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['student-support-ticket-detail', accessToken, variables.ticketId] });
    }
  });
}
