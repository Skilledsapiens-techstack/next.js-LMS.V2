import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createSupportTicketCreationPlan,
  SupportTicketCreationInput,
  SupportTicketCreationPlan,
  SupportTicketCreationStudent
 } from './support-ticket-creation-plan';

type StudentRow = {
  id: string | null;
  email: string;
  full_name: string | null;
};

export type SupportTicketCreationLoadInput = {
  studentEmail: string;
  ticket: SupportTicketCreationInput;
};

export type SupportTicketCreationLoadResult = {
  status: 'ready' | 'not_found';
  plan?: SupportTicketCreationPlan;
  message: string;
};
export class SupportTicketCreationLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: SupportTicketCreationLoadInput): Promise<SupportTicketCreationLoadResult> {
    const studentEmail = this.normalizeEmail(input.studentEmail);

    if (!studentEmail) {
      return {
        status: 'not_found',
        message: 'Student email is required to load a support ticket creation plan.'
     };
   }

    const student = await this.loadStudent(studentEmail);

    if (!student) {
      return {
        status: 'not_found',
        message: 'No active student matched the support ticket creation source.'
     };
   }

    return {
      status: 'ready',
      plan: createSupportTicketCreationPlan(this.toSupportTicketCreationStudent(student), input.ticket),
      message: 'Support ticket creation plan loaded.'
   };
 }

  private async loadStudent(studentEmail: string): Promise<StudentRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('students')
      .select(['id', 'email', 'full_name', 'active'].join(','))
      .eq('email', studentEmail)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load student for support ticket creation: ${error.message}`);
   }

    return this.asStudentRow(data);
 }

  private toSupportTicketCreationStudent(row: StudentRow): SupportTicketCreationStudent {
    return {
      id: row.id ?? undefined,
      email: row.email,
      fullName: row.full_name ?? undefined
   };
 }

  private asStudentRow(value: unknown): StudentRow | undefined {
    if (!this.isJsonObject(value) || typeof value.email !== 'string') return undefined;

    return {
      id: this.nullableString(value.id),
      email: this.normalizeEmail(value.email),
      full_name: this.nullableString(value.full_name)
   };
 }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
 }

  private nullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
