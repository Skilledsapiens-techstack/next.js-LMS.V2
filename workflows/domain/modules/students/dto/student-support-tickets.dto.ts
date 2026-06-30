import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type StudentSupportTicketStatus = 'open' | 'in_review' | 'waiting_for_student' | 'resolved' | 'closed';
export type StudentSupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type StudentSupportConversationMode = 'two_way' | 'admin_only';
export type StudentSupportMessageAuthorRole = 'student' | 'admin' | 'system';

export class StudentSupportTicketsQueryDto extends PaginationQueryDto {
  status: StudentSupportTicketStatus | 'all' = 'all';
  search?: string;
}

export class StudentSupportTicketListItemDto {
  id!: string;
  ticketId?: string;
  categoryName!: string;
  priority!: StudentSupportTicketPriority;
  subject!: string;
  status!: StudentSupportTicketStatus;
  conversationMode!: StudentSupportConversationMode;
  canReply!: boolean;
  slaDueAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  lastMessageAt?: string;
  lastStudentReplyAt?: string;
  lastAdminReplyAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class StudentSupportTicketMessageDto {
  id!: string;
  authorRole!: StudentSupportMessageAuthorRole;
  authorName?: string;
  body!: string;
  createdAt!: string;
}

export class StudentSupportTicketDetailDto {
  ticket!: StudentSupportTicketListItemDto;
  messages!: StudentSupportTicketMessageDto[];
  messageLimit!: number;
  hasMoreMessages!: boolean;
}
