import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createEmailDispatchPlan,
  EmailDispatchInput,
  EmailDispatchPlan,
  EmailOutboxJobForDispatch,
  EmailOutboxStatus
 } from './email-dispatch-plan';

type EmailOutboxDispatchRow = {
  idempotency_key: string;
  status: EmailOutboxStatus;
  recipient_email: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  attempt_count: number | null;
  max_attempts: number | null;
  next_attempt_at: string | null;
  locked_until: string | null;
  provider_message_id: string | null;
};

export type EmailDispatchLoadInput = EmailDispatchInput & {
  idempotencyKey: string;
};

export type EmailDispatchLoadResult = {
  status: 'ready' | 'not_found';
  plan?: EmailDispatchPlan;
  message: string;
};
export class EmailDispatchLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: EmailDispatchLoadInput): Promise<EmailDispatchLoadResult> {
    const idempotencyKey = this.cleanText(input.idempotencyKey);

    if (!idempotencyKey) {
      return {
        status: 'not_found',
        message: 'Email outbox idempotency key is required to load a dispatch plan.'
     };
   }

    const job = await this.loadEmailJob(idempotencyKey);

    if (!job) {
      return {
        status: 'not_found',
        message: 'No email outbox job matched the dispatch source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createEmailDispatchPlan(this.toEmailOutboxJob(job), {
        workerId: input.workerId,
        now: input.now,
        maxAttempts: input.maxAttempts
     }),
      message: 'Email dispatch plan loaded.'
   };
 }

  private async loadEmailJob(idempotencyKey: string): Promise<EmailOutboxDispatchRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('email_outbox')
      .select(
        [
          'idempotency_key',
          'status',
          'recipient_email',
          'subject',
          'html_body',
          'text_body',
          'attempt_count',
          'max_attempts',
          'next_attempt_at',
          'locked_until',
          'provider_message_id'
        ].join(',')
      )
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load email outbox job for dispatch planning: ${error.message}`);
   }

    return this.asEmailOutboxDispatchRow(data);
 }

  private toEmailOutboxJob(row: EmailOutboxDispatchRow): EmailOutboxJobForDispatch {
    return {
      idempotencyKey: row.idempotency_key,
      status: row.status,
      recipientEmail: row.recipient_email,
      subject: row.subject,
      htmlBody: row.html_body,
      textBody: row.text_body ?? undefined,
      attemptCount: row.attempt_count ?? 0,
      maxAttempts: row.max_attempts ?? undefined,
      nextAttemptAt: row.next_attempt_at ?? undefined,
      lockedUntil: row.locked_until ?? undefined,
      providerMessageId: row.provider_message_id ?? undefined
   };
 }

  private asEmailOutboxDispatchRow(value: unknown): EmailOutboxDispatchRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.idempotency_key !== 'string' ||
      !this.isEmailOutboxStatus(value.status) ||
      typeof value.recipient_email !== 'string' ||
      typeof value.subject !== 'string' ||
      typeof value.html_body !== 'string'
    ) {
      return undefined;
   }

    return {
      idempotency_key: value.idempotency_key,
      status: value.status,
      recipient_email: value.recipient_email,
      subject: value.subject,
      html_body: value.html_body,
      text_body: typeof value.text_body === 'string' ? value.text_body : null,
      attempt_count: typeof value.attempt_count === 'number' ? value.attempt_count : null,
      max_attempts: typeof value.max_attempts === 'number' ? value.max_attempts : null,
      next_attempt_at: typeof value.next_attempt_at === 'string' ? value.next_attempt_at : null,
      locked_until: typeof value.locked_until === 'string' ? value.locked_until : null,
      provider_message_id: typeof value.provider_message_id === 'string' ? value.provider_message_id : null
   };
 }

  private isEmailOutboxStatus(value: unknown): value is EmailOutboxStatus {
    return value === 'pending' || value === 'sending' || value === 'sent' || value === 'failed' || value === 'cancelled';
 }

  private cleanText(value: string): string {
    return value.trim();
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
