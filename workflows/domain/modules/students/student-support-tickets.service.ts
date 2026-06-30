import { NotFoundException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { StudentsService } from './students.service';
import { 
  StudentSupportConversationMode,
  StudentSupportMessageAuthorRole,
  StudentSupportTicketMessageDto,
  StudentSupportTicketDetailDto,
  StudentSupportTicketListItemDto,
  StudentSupportTicketPriority,
  StudentSupportTicketsQueryDto,
  StudentSupportTicketStatus
 } from './dto/student-support-tickets.dto';

type StudentSupportTicketRow = {
  id: string;
  ticket_id: string | null;
  student_email: string;
  category_name: string;
  priority: StudentSupportTicketPriority;
  subject: string;
  status: StudentSupportTicketStatus;
  conversation_mode: StudentSupportConversationMode;
  sla_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_message_at: string | null;
  last_student_reply_at: string | null;
  last_admin_reply_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type StudentSupportTicketMessageRow = {
  id: string;
  author_role: StudentSupportMessageAuthorRole;
  author_name: string | null;
  body: string;
  created_at: string;
};
export class StudentSupportTicketsService {
  private readonly messageLimit = 100;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyTickets(user: User, query: StudentSupportTicketsQueryDto): Promise<PaginatedResponse<StudentSupportTicketListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
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
          'category_name',
          'priority',
          'subject',
          'status',
          'conversation_mode',
          'sla_due_at',
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
      .eq('student_email', studentEmail)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or([`ticket_id.ilike.%${escapedSearch}%`, `category_name.ilike.%${escapedSearch}%`, `subject.ilike.%${escapedSearch}%`].join(','));
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your support tickets: ${error.message}`);
   }

    return createPaginatedResponse(this.asStudentSupportTicketRows(data).map((row) => this.toStudentSupportTicketListItem(row)), page, limit, count ?? 0);
 }

  async getMyTicketDetail(user: User, ticketId: string): Promise<StudentSupportTicketDetailDto> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);

    const { data: ticketData, error: ticketError } = await this.supabase.admin
      .from('support_tickets')
      .select(
        [
          'id',
          'ticket_id',
          'student_email',
          'category_name',
          'priority',
          'subject',
          'status',
          'conversation_mode',
          'sla_due_at',
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
      .eq('student_email', studentEmail)
      .single();

    if (ticketError) {
      if (ticketError.code === 'PGRST116') {
        throw new NotFoundException('Support ticket not found for this student.');
     }
      throw new ServiceUnavailableException(`Unable to load your support ticket: ${ticketError.message}`);
   }

    const [ticket] = this.asStudentSupportTicketRows([ticketData]);

    if (!ticket) {
      throw new NotFoundException('Support ticket not found for this student.');
   }

    const { data: messagesData, error: messagesError } = await this.supabase.admin
      .from('support_ticket_messages')
      .select(['id', 'author_role', 'author_name', 'body', 'created_at'].join(','))
      .eq('ticket_id', ticket.id)
      .eq('visibility', 'public')
      .order('created_at', { ascending: true })
      .limit(this.messageLimit + 1);

    if (messagesError) {
      throw new ServiceUnavailableException(`Unable to load your support ticket messages: ${messagesError.message}`);
   }

    const messages = this.asStudentSupportTicketMessageRows(messagesData).map((row) => this.toStudentSupportTicketMessage(row));

    return {
      ticket: this.toStudentSupportTicketListItem(ticket),
      messages: messages.slice(0, this.messageLimit),
      messageLimit: this.messageLimit,
      hasMoreMessages: messages.length > this.messageLimit
   };
 }

  private toStudentSupportTicketListItem(row: StudentSupportTicketRow): StudentSupportTicketListItemDto {
    return {
      id: row.id,
      ticketId: row.ticket_id ?? undefined,
      categoryName: row.category_name,
      priority: row.priority,
      subject: row.subject,
      status: row.status,
      conversationMode: row.conversation_mode,
      canReply: row.conversation_mode === 'two_way' && row.status !== 'resolved' && row.status !== 'closed',
      slaDueAt: row.sla_due_at ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      closedAt: row.closed_at ?? undefined,
      lastMessageAt: row.last_message_at ?? undefined,
      lastStudentReplyAt: row.last_student_reply_at ?? undefined,
      lastAdminReplyAt: row.last_admin_reply_at ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private toStudentSupportTicketMessage(row: StudentSupportTicketMessageRow): StudentSupportTicketMessageDto {
    return {
      id: row.id,
      authorRole: row.author_role,
      authorName: row.author_name ?? undefined,
      body: row.body,
      createdAt: row.created_at
   };
 }

  private asStudentSupportTicketRows(value: unknown): StudentSupportTicketRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is StudentSupportTicketRow => {
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

  private asStudentSupportTicketMessageRows(value: unknown): StudentSupportTicketMessageRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is StudentSupportTicketMessageRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && this.isAuthorRole(row.author_role) && typeof row.body === 'string' && typeof row.created_at === 'string';
   });
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private isStatus(value: unknown): value is StudentSupportTicketStatus {
    return value === 'open' || value === 'in_review' || value === 'waiting_for_student' || value === 'resolved' || value === 'closed';
 }

  private isPriority(value: unknown): value is StudentSupportTicketPriority {
    return value === 'low' || value === 'normal' || value === 'high' || value === 'urgent';
 }

  private isConversationMode(value: unknown): value is StudentSupportConversationMode {
    return value === 'two_way' || value === 'admin_only';
 }

  private isAuthorRole(value: unknown): value is StudentSupportMessageAuthorRole {
    return value === 'student' || value === 'admin' || value === 'system';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
