import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createSupportTicketStatusTransitionPlan,
  SupportTicketForStatusTransition,
  SupportTicketStatus,
  SupportTicketStatusTransitionPlan
 } from './support-ticket-status-transition-plan';

type SupportTicketStatusTransitionRow = {
  id: string;
  status: SupportTicketStatus;
  assigned_admin_email?: string;
};

export type SupportTicketStatusTransitionLoadInput = {
  ticketId: string;
  targetStatus: SupportTicketStatus;
  adminEmail: string;
  note?: string;
  changedAt?: string;
};

export type SupportTicketStatusTransitionLoadResult = {
  status: 'ready' | 'not_found';
  plan?: SupportTicketStatusTransitionPlan;
  message: string;
};
export class SupportTicketStatusTransitionLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: SupportTicketStatusTransitionLoadInput): Promise<SupportTicketStatusTransitionLoadResult> {
    const ticketId = this.cleanText(input.ticketId);
    const adminEmail = this.normalizeEmail(input.adminEmail);

    if (!ticketId || !adminEmail) {
      return {
        status: 'not_found',
        message: 'Support ticket ID and admin email are required to load a status transition plan.'
     };
   }

    const ticket = await this.loadTicket(ticketId);

    if (!ticket) {
      return {
        status: 'not_found',
        message: 'No support ticket matched the status transition source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createSupportTicketStatusTransitionPlan(this.toSupportTicketForStatusTransition(ticket), {
        targetStatus: input.targetStatus,
        adminEmail,
        note: input.note,
        changedAt: input.changedAt
     }),
      message: 'Support ticket status transition plan loaded.'
   };
 }

  private async loadTicket(ticketId: string): Promise<SupportTicketStatusTransitionRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('support_tickets')
      .select(['id', 'status', 'assigned_admin_email'].join(','))
      .eq('id', ticketId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load support ticket for status transition: ${error.message}`);
   }

    return this.asSupportTicketStatusTransitionRow(data);
 }

  private toSupportTicketForStatusTransition(row: SupportTicketStatusTransitionRow): SupportTicketForStatusTransition {
    return {
      id: row.id,
      status: row.status,
      assignedAdminEmail: row.assigned_admin_email
   };
 }

  private asSupportTicketStatusTransitionRow(value: unknown): SupportTicketStatusTransitionRow | undefined {
    if (!this.isJsonObject(value) || typeof value.id !== 'string' || !this.isStatus(value.status)) {
      return undefined;
   }

    const assignedAdminEmail =
      typeof value.assigned_admin_email === 'string' ? this.normalizeEmail(value.assigned_admin_email) : undefined;

    return {
      id: value.id,
      status: value.status,
      assigned_admin_email: assignedAdminEmail || undefined
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

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
