import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from '../student/useStudentAnnouncements';

export type AdminSupportTicketStatus = 'open' | 'in_review' | 'waiting_for_student' | 'resolved' | 'closed';
export type AdminSupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type AdminSupportConversationMode = 'two_way' | 'admin_only';
export type AdminSupportMessageAuthorRole = 'student' | 'admin' | 'system';
export type AdminSupportMessageVisibility = 'public' | 'internal';

export type AdminSupportTicket = {
  assignedAdminEmail?: string;
  categoryName: string;
  closedAt?: string;
  conversationMode: AdminSupportConversationMode;
  createdAt?: string;
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
