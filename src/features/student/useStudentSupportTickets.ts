import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiGet } from '../../lib/supabaseApi';
import { PaginatedResponse } from './useStudentAnnouncements';

export type StudentSupportTicketStatus = 'open' | 'in_review' | 'waiting_for_student' | 'resolved' | 'closed';
export type StudentSupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type StudentSupportConversationMode = 'two_way' | 'admin_only';
export type StudentSupportMessageAuthorRole = 'student' | 'admin' | 'system';

export type StudentSupportTicket = {
  canReply: boolean;
  categoryName: string;
  closedAt?: string;
  conversationMode: StudentSupportConversationMode;
  createdAt?: string;
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
