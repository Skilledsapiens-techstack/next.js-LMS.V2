import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  AdminSupportConversationMode,
  AdminSupportMessageAuthorRole,
  AdminSupportMessageVisibility,
  AdminSupportTicketDetailDto,
  AdminSupportTicketListItemDto,
  AdminSupportTicketMessageDto,
  AdminSupportTicketPriority,
  AdminSupportTicketsQueryDto,
  AdminSupportTicketStatus
 } from './dto/admin-support-tickets.dto';

type AdminSupportTicketRow = {
  id: string;
  ticket_id: string | null;
  student_email: string;
  student_name: string | null;
  category_name: string;
  priority: AdminSupportTicketPriority;
  subject: string;
  status: AdminSupportTicketStatus;
  conversation_mode: AdminSupportConversationMode;
  sla_due_at: string | null;
  assigned_admin_email: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_message_at: string | null;
  last_student_reply_at: string | null;
  last_admin_reply_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminSupportTicketMessageRow = {
  id: string;
  author_role: AdminSupportMessageAuthorRole;
  author_email: string;
  author_name: string | null;
  body: string;
  visibility: AdminSupportMessageVisibility;
  created_at: string;
};
export class AdminSupportTicketsService {
  private readonly messageLimit = 100;

  constructor(private readonly supabase: SupabaseService) {}

  async listTickets(query: AdminSupportTicketsQueryDto): Promise<PaginatedResponse<AdminSupportTicketListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('support_tickets')
      .select(
        [
          'id',
          'ticket_id',
          'student_email',
          'student_name',
          'category_name',
          'priority',
          'subject',
          'status',
          'conversation_mode',
          'sla_due_at',
          'assigned_admin_email',
          'resolved_at',
          'closed_at',
          'last_message_at',
          'last_student_reply_at',
          'last_admin_reply_at',
          'created_at',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.priority !== 'all') {
      request = request.eq('priority', query.priority);
   }

    if (query.category) {
      request = request.eq('category_name', query.category);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `ticket_id.ilike.%${escapedSearch}%`,
          `student_email.ilike.%${escapedSearch}%`,
          `student_name.ilike.%${escapedSearch}%`,
          `category_name.ilike.%${escapedSearch}%`,
          `subject.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load support tickets: ${error.message}`);
   }

    return createPaginatedResponse(this.asAdminSupportTicketRows(data).map((row) => this.toAdminSupportTicketListItem(row)), page, limit, count ?? 0);
 }

  async getTicketDetail(ticketId: string): Promise<AdminSupportTicketDetailDto> {
    const { data: ticketData, error: ticketError } = await this.supabase.admin
      .from('support_tickets')
      .select(
        [
          'id',
          'ticket_id',
          'student_email',
          'student_name',
          'category_name',
          'priority',
          'subject',
          'status',
          'conversation_mode',
          'sla_due_at',
          'assigned_admin_email',
          'resolved_at',
          'closed_at',
          'last_message_at',
          'last_student_reply_at',
          'last_admin_reply_at',
          'created_at',
          'updated_at'
        ].join(',')
      )
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      throw new ServiceUnavailableException(`Unable to load support ticket: ${ticketError.message}`);
   }

    const [ticket] = this.asAdminSupportTicketRows([ticketData]);

    if (!ticket) {
      throw new ServiceUnavailableException('Unable to load support ticket: invalid ticket response.');
   }

    const { data: messagesData, error: messagesError } = await this.supabase.admin
      .from('support_ticket_messages')
      .select(['id', 'author_role', 'author_email', 'author_name', 'body', 'visibility', 'created_at'].join(','))
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
      .limit(this.messageLimit + 1);

    if (messagesError) {
      throw new ServiceUnavailableException(`Unable to load support ticket messages: ${messagesError.message}`);
   }

    const messages = this.asAdminSupportTicketMessageRows(messagesData).map((row) => this.toAdminSupportTicketMessage(row));

    return {
      ticket: this.toAdminSupportTicketListItem(ticket),
      messages: messages.slice(0, this.messageLimit),
      messageLimit: this.messageLimit,
      hasMoreMessages: messages.length > this.messageLimit
   };
 }

  private asAdminSupportTicketRows(value: unknown): AdminSupportTicketRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminSupportTicketRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.student_email === 'string' &&
        typeof row.category_name === 'string' &&
        this.isPriority(row.priority) &&
        typeof row.subject === 'string' &&
        this.isStatus(row.status) &&
        this.isConversationMode(row.conversation_mode)
      );
   });
 }

  private toAdminSupportTicketListItem(row: AdminSupportTicketRow): AdminSupportTicketListItemDto {
    return {
      id: row.id,
      ticketId: row.ticket_id ?? undefined,
      studentEmail: this.normalizeEmail(row.student_email),
      studentName: row.student_name ?? undefined,
      categoryName: row.category_name,
      priority: row.priority,
      subject: row.subject,
      status: row.status,
      conversationMode: row.conversation_mode,
      slaDueAt: row.sla_due_at ?? undefined,
      assignedAdminEmail: row.assigned_admin_email ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      closedAt: row.closed_at ?? undefined,
      lastMessageAt: row.last_message_at ?? undefined,
      lastStudentReplyAt: row.last_student_reply_at ?? undefined,
      lastAdminReplyAt: row.last_admin_reply_at ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private asAdminSupportTicketMessageRows(value: unknown): AdminSupportTicketMessageRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminSupportTicketMessageRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        this.isAuthorRole(row.author_role) &&
        typeof row.author_email === 'string' &&
        typeof row.body === 'string' &&
        this.isMessageVisibility(row.visibility) &&
        typeof row.created_at === 'string'
      );
   });
 }

  private toAdminSupportTicketMessage(row: AdminSupportTicketMessageRow): AdminSupportTicketMessageDto {
    return {
      id: row.id,
      authorRole: row.author_role,
      authorEmail: this.normalizeEmail(row.author_email),
      authorName: row.author_name ?? undefined,
      body: row.body,
      visibility: row.visibility,
      createdAt: row.created_at
   };
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private isStatus(value: unknown): value is AdminSupportTicketStatus {
    return value === 'open' || value === 'in_review' || value === 'waiting_for_student' || value === 'resolved' || value === 'closed';
 }

  private isPriority(value: unknown): value is AdminSupportTicketPriority {
    return value === 'low' || value === 'normal' || value === 'high' || value === 'urgent';
 }

  private isConversationMode(value: unknown): value is AdminSupportConversationMode {
    return value === 'two_way' || value === 'admin_only';
 }

  private isAuthorRole(value: unknown): value is AdminSupportMessageAuthorRole {
    return value === 'student' || value === 'admin' || value === 'system';
 }

  private isMessageVisibility(value: unknown): value is AdminSupportMessageVisibility {
    return value === 'public' || value === 'internal';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
