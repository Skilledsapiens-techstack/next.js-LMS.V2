import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export type AdminSupportTicketStatus = 'open' | 'in_review' | 'waiting_for_student' | 'resolved' | 'closed';
export type AdminSupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type AdminSupportConversationMode = 'two_way' | 'admin_only';
export type AdminSupportMessageAuthorRole = 'student' | 'admin' | 'system';
export type AdminSupportMessageVisibility = 'public' | 'internal';

export class AdminSupportTicketsQueryDto extends PaginationQueryDto {
  search?: string;
  status: AdminSupportTicketStatus | 'all' = 'all';
  priority: AdminSupportTicketPriority | 'all' = 'all';
  category?: string;
}

export class AdminSupportTicketListItemDto {
  id!: string;
  ticketId?: string;
  studentEmail!: string;
  studentName?: string;
  categoryName!: string;
  priority!: AdminSupportTicketPriority;
  subject!: string;
  status!: AdminSupportTicketStatus;
  conversationMode!: AdminSupportConversationMode;
  slaDueAt?: string;
  assignedAdminEmail?: string;
  resolvedAt?: string;
  closedAt?: string;
  lastMessageAt?: string;
  lastStudentReplyAt?: string;
  lastAdminReplyAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class AdminSupportTicketMessageDto {
  id!: string;
  authorRole!: AdminSupportMessageAuthorRole;
  authorEmail!: string;
  authorName?: string;
  body!: string;
  visibility!: AdminSupportMessageVisibility;
  createdAt!: string;
}

export class AdminSupportTicketDetailDto {
  ticket!: AdminSupportTicketListItemDto;
  messages!: AdminSupportTicketMessageDto[];
  messageLimit!: number;
  hasMoreMessages!: boolean;
}
