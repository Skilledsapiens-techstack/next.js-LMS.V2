import { EmailOutboxStatus } from './email-dispatch-plan';

export type EmailDeliveryJob = {
  idempotencyKey: string;
  status: EmailOutboxStatus;
  attemptCount: number;
  maxAttempts?: number;
  workerId?: string;
};

export type EmailProviderResultInput = {
  workerId: string;
  deliveredAt?: string;
  providerMessageId?: string;
  success: boolean;
  errorMessage?: string;
};

export type EmailDeliveryResultPlan = {
  shouldRecord: boolean;
  reason:
    | 'ready'
    | 'missing_worker'
    | 'missing_job_identity'
    | 'not_sending'
    | 'worker_mismatch'
    | 'missing_provider_message'
    | 'missing_error_message';
  idempotencyKey?: string;
  emailUpdate?: {
    idempotency_key: string;
    status: 'sent' | 'failed' | 'pending';
    provider_message_id?: string;
    sent_at?: string;
    last_error_message?: string;
    next_attempt_at?: string;
    locked_until: null;
    worker_id: null;
    updated_at: string;
  };
  errorLogRow?: {
    idempotency_key: string;
    entity_table: 'email_outbox';
    entity_id: string;
    error_type: 'email_provider';
    message: string;
    created_at: string;
  };
};

const defaultMaxAttempts = 3;
const retryDelayMs = 10 * 60 * 1000;

export function createEmailDeliveryResultPlan(job: EmailDeliveryJob, input: EmailProviderResultInput): EmailDeliveryResultPlan {
  const workerId = cleanText(input.workerId);

  if (!workerId) {
    return { shouldRecord: false, reason: 'missing_worker' };
  }

  const idempotencyKey = cleanText(job.idempotencyKey);

  if (!idempotencyKey) {
    return { shouldRecord: false, reason: 'missing_job_identity' };
  }

  if (job.status !== 'sending') {
    return { shouldRecord: false, reason: 'not_sending', idempotencyKey };
  }

  const jobWorkerId = cleanText(job.workerId);

  if (jobWorkerId && jobWorkerId !== workerId) {
    return { shouldRecord: false, reason: 'worker_mismatch', idempotencyKey };
  }

  const deliveredAt = cleanText(input.deliveredAt) ?? new Date().toISOString();

  if (input.success) {
    const providerMessageId = cleanText(input.providerMessageId);

    if (!providerMessageId) {
      return { shouldRecord: false, reason: 'missing_provider_message', idempotencyKey };
    }

    return {
      shouldRecord: true,
      reason: 'ready',
      idempotencyKey,
      emailUpdate: {
        idempotency_key: idempotencyKey,
        status: 'sent',
        provider_message_id: providerMessageId,
        sent_at: deliveredAt,
        locked_until: null,
        worker_id: null,
        updated_at: deliveredAt
      }
    };
  }

  const errorMessage = cleanText(input.errorMessage);

  if (!errorMessage) {
    return { shouldRecord: false, reason: 'missing_error_message', idempotencyKey };
  }

  const maxAttempts = job.maxAttempts ?? defaultMaxAttempts;
  const attemptCount = safeInteger(job.attemptCount);
  const hasAttemptsRemaining = attemptCount < maxAttempts;
  const nextAttemptAt = new Date(new Date(deliveredAt).getTime() + retryDelayMs).toISOString();

  return {
    shouldRecord: true,
    reason: 'ready',
    idempotencyKey,
    emailUpdate: {
      idempotency_key: idempotencyKey,
      status: hasAttemptsRemaining ? 'pending' : 'failed',
      last_error_message: errorMessage,
      next_attempt_at: hasAttemptsRemaining ? nextAttemptAt : undefined,
      locked_until: null,
      worker_id: null,
      updated_at: deliveredAt
    },
    errorLogRow: {
      idempotency_key: `email_delivery_error:${idempotencyKey}:${attemptCount}`,
      entity_table: 'email_outbox',
      entity_id: idempotencyKey,
      error_type: 'email_provider',
      message: errorMessage,
      created_at: deliveredAt
    }
  };
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function safeInteger(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 0;
}
