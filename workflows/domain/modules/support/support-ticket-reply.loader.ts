import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createSupportTicketReplyPlan,
  SupportTicketConversationMode,
  SupportTicketForReply,
  SupportTicketReplyActor,
  SupportTicketReplyInput,
  SupportTicketReplyPlan,
  SupportTicketStatus
 } from './support-ticket-reply-plan';

type SupportTicketReplyRow = {
  id: string;
  status: SupportTicketStatus;
  conversation_mode: SupportTicketConversationMode;
  student_email: string;
};

export type SupportTicketReplyLoadInput = {
  ticketId: string;
  actor: SupportTicketReplyActor;
  reply: SupportTicketReplyInput;
};

export type SupportTicketReplyLoadResult = {
  status: 'ready' | 'not_found';
  plan?: SupportTicketReplyPlan;
  message: string;
};
export class SupportTicketReplyLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: SupportTicketReplyLoadInput): Promise<SupportTicketReplyLoadResult> {
    const ticketId = this.cleanText(input.ticketId);
    const actorEmail = this.normalizeEmail(input.actor.email);

    if (!ticketId || !actorEmail) {
      return {
        status: 'not_found',
        message: 'Support ticket ID and actor email are required to load a reply plan.'
     };
   }

    const ticket = await this.loadTicket(ticketId);

    if (!ticket) {
      return {
        status: 'not_found',
        message: 'No support ticket matched the reply source identity.'
     };
   }

    if (input.actor.role === 'student' && this.normalizeEmail(ticket.student_email) !== actorEmail) {
      return {
        status: 'not_found',
        message: 'No support ticket matched the student reply source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createSupportTicketReplyPlan(this.toSupportTicketForReply(ticket), { ...input.actor, email: actorEmail }, input.reply),
      message: 'Support ticket reply plan loaded.'
   };
 }

  private async loadTicket(ticketId: string): Promise<SupportTicketReplyRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('support_tickets')
      .select(['id', 'status', 'conversation_mode', 'student_email'].join(','))
      .eq('id', ticketId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load support ticket for reply: ${error.message}`);
   }

    return this.asSupportTicketReplyRow(data);
 }

  private toSupportTicketForReply(row: SupportTicketReplyRow): SupportTicketForReply {
    return {
      id: row.id,
      status: row.status,
      conversationMode: row.conversation_mode,
      studentEmail: row.student_email
   };
 }

  private asSupportTicketReplyRow(value: unknown): SupportTicketReplyRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.id !== 'string' ||
      !this.isStatus(value.status) ||
      !this.isConversationMode(value.conversation_mode) ||
      typeof value.student_email !== 'string'
    ) {
      return undefined;
   }

    return {
      id: value.id,
      status: value.status,
      conversation_mode: value.conversation_mode,
      student_email: this.normalizeEmail(value.student_email)
   };
 }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
 }

  private cleanText(value: string): string {
    return value.trim();
 }

  private isStatus(value: unknown): value is SupportTicketStatus {
    return value === 'open' || value === 'in_review' || value === 'waiting_for_student' || value === 'resolved' || value === 'closed';
 }

  private isConversationMode(value: unknown): value is SupportTicketConversationMode {
    return value === 'two_way' || value === 'admin_only';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
