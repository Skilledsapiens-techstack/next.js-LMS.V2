import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createEmailDeliveryResultPlan,
  EmailDeliveryJob,
  EmailDeliveryResultPlan,
  EmailProviderResultInput
 } from './email-delivery-result-plan';
import { EmailOutboxStatus } from './email-dispatch-plan';

type EmailDeliveryJobRow = {
  idempotency_key: string;
  status: EmailOutboxStatus;
  attempt_count: number | null;
  max_attempts: number | null;
  worker_id: string | null;
};

export type EmailDeliveryResultLoadInput = EmailProviderResultInput & {
  idempotencyKey: string;
};

export type EmailDeliveryResultLoadResult = {
  status: 'ready' | 'not_found';
  plan?: EmailDeliveryResultPlan;
  message: string;
};
export class EmailDeliveryResultLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: EmailDeliveryResultLoadInput): Promise<EmailDeliveryResultLoadResult> {
    const idempotencyKey = this.cleanText(input.idempotencyKey);

    if (!idempotencyKey) {
      return {
        status: 'not_found',
        message: 'Email outbox idempotency key is required to load a delivery result plan.'
     };
   }

    const job = await this.loadEmailJob(idempotencyKey);

    if (!job) {
      return {
        status: 'not_found',
        message: 'No email outbox job matched the delivery result source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createEmailDeliveryResultPlan(this.toEmailDeliveryJob(job), {
        workerId: input.workerId,
        deliveredAt: input.deliveredAt,
        providerMessageId: input.providerMessageId,
        success: input.success,
        errorMessage: input.errorMessage
     }),
      message: 'Email delivery result plan loaded.'
   };
 }

  private async loadEmailJob(idempotencyKey: string): Promise<EmailDeliveryJobRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('email_outbox')
      .select(['idempotency_key', 'status', 'attempt_count', 'max_attempts', 'worker_id'].join(','))
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load email outbox job for delivery result planning: ${error.message}`);
   }

    return this.asEmailDeliveryJobRow(data);
 }

  private toEmailDeliveryJob(row: EmailDeliveryJobRow): EmailDeliveryJob {
    return {
      idempotencyKey: row.idempotency_key,
      status: row.status,
      attemptCount: row.attempt_count ?? 0,
      maxAttempts: row.max_attempts ?? undefined,
      workerId: row.worker_id ?? undefined
   };
 }

  private asEmailDeliveryJobRow(value: unknown): EmailDeliveryJobRow | undefined {
    if (!this.isJsonObject(value) || typeof value.idempotency_key !== 'string' || !this.isEmailOutboxStatus(value.status)) {
      return undefined;
   }

    return {
      idempotency_key: value.idempotency_key,
      status: value.status,
      attempt_count: typeof value.attempt_count === 'number' ? value.attempt_count : null,
      max_attempts: typeof value.max_attempts === 'number' ? value.max_attempts : null,
      worker_id: typeof value.worker_id === 'string' ? value.worker_id : null
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
