export type EmailOutboxStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export type EmailOutboxJobForDispatch = {
  idempotencyKey: string;
  status: EmailOutboxStatus;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  attemptCount: number;
  maxAttempts?: number;
  nextAttemptAt?: string;
  lockedUntil?: string;
  providerMessageId?: string;
};

export type EmailDispatchInput = {
  workerId: string;
  now?: string;
  maxAttempts?: number;
};

export type EmailDispatchPlan = {
  shouldDispatch: boolean;
  reason:
    | 'ready'
    | 'missing_worker'
    | 'missing_job_identity'
    | 'not_pending'
    | 'missing_recipient'
    | 'missing_subject'
    | 'missing_body'
    | 'attempt_limit_reached'
    | 'scheduled_for_later'
    | 'locked';
  idempotencyKey?: string;
  dispatchPayload?: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  };
  sendingUpdate?: {
    idempotency_key: string;
    status: 'sending';
    worker_id: string;
    attempt_count: number;
    locked_until: string;
    updated_at: string;
  };
};

const defaultMaxAttempts = 3;
const lockMs = 5 * 60 * 1000;

export function createEmailDispatchPlan(job: EmailOutboxJobForDispatch, input: EmailDispatchInput): EmailDispatchPlan {
  const workerId = cleanText(input.workerId);

  if (!workerId) {
    return { shouldDispatch: false, reason: 'missing_worker' };
  }

  const idempotencyKey = cleanText(job.idempotencyKey);

  if (!idempotencyKey) {
    return { shouldDispatch: false, reason: 'missing_job_identity' };
  }

  if (job.status !== 'pending') {
    return { shouldDispatch: false, reason: 'not_pending', idempotencyKey };
  }

  const recipientEmail = normalizeEmail(job.recipientEmail);

  if (!recipientEmail) {
    return { shouldDispatch: false, reason: 'missing_recipient', idempotencyKey };
  }

  const subject = cleanText(job.subject);

  if (!subject) {
    return { shouldDispatch: false, reason: 'missing_subject', idempotencyKey };
  }

  const htmlBody = cleanText(job.htmlBody);

  if (!htmlBody) {
    return { shouldDispatch: false, reason: 'missing_body', idempotencyKey };
  }

  const maxAttempts = job.maxAttempts ?? input.maxAttempts ?? defaultMaxAttempts;
  const attemptCount = safeInteger(job.attemptCount);

  if (attemptCount >= maxAttempts) {
    return { shouldDispatch: false, reason: 'attempt_limit_reached', idempotencyKey };
  }

  const now = parseDate(input.now) ?? new Date();
  const nextAttemptAt = parseDate(job.nextAttemptAt);

  if (nextAttemptAt && nextAttemptAt.getTime() > now.getTime()) {
    return { shouldDispatch: false, reason: 'scheduled_for_later', idempotencyKey };
  }

  const lockedUntil = parseDate(job.lockedUntil);

  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    return { shouldDispatch: false, reason: 'locked', idempotencyKey };
  }

  const updatedAt = now.toISOString();

  return {
    shouldDispatch: true,
    reason: 'ready',
    idempotencyKey,
    dispatchPayload: {
      to: recipientEmail,
      subject,
      html: htmlBody,
      text: cleanText(job.textBody)
    },
    sendingUpdate: {
      idempotency_key: idempotencyKey,
      status: 'sending',
      worker_id: workerId,
      attempt_count: attemptCount + 1,
      locked_until: new Date(now.getTime() + lockMs).toISOString(),
      updated_at: updatedAt
    }
  };
}

function normalizeEmail(value: string): string | undefined {
  const email = value.trim().toLowerCase();
  return email || undefined;
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function safeInteger(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
