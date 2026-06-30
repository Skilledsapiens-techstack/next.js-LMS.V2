export type OperationalCleanupEntity = 'email_outbox' | 'certificate_generation_jobs' | 'enrollment_webhook_events' | 'error_logs';

export type OperationalCleanupCandidate = {
  entityTable: OperationalCleanupEntity;
  entityId: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  lockedUntil?: string;
  retryCount?: number;
};

export type OperationalCleanupInput = {
  now?: string;
  staleLockMinutes?: number;
  abandonedJobHours?: number;
  processedWebhookRetentionDays?: number;
  errorLogRetentionDays?: number;
  maxBatchSize?: number;
};

export type OperationalCleanupAction = {
  action: 'release_email_lock' | 'mark_certificate_job_failed' | 'archive_webhook_event' | 'purge_error_log';
  entityTable: OperationalCleanupEntity;
  entityId: string;
  reason: string;
  idempotencyKey: string;
  auditRow: {
    idempotency_key: string;
    actor_type: 'system';
    actor_id: 'maintenance-cleanup';
    entity_table: OperationalCleanupEntity;
    entity_id: string;
    action: string;
    previous_state?: string;
    next_state: string;
    created_at: string;
  };
};

export type OperationalCleanupPlan = {
  shouldRun: boolean;
  reason: 'ready' | 'empty_batch' | 'invalid_now' | 'invalid_batch_size';
  generatedAt?: string;
  actions: OperationalCleanupAction[];
  skipped: Array<{
    entityTable: OperationalCleanupEntity;
    entityId: string;
    reason: string;
  }>;
};

const defaultStaleLockMinutes = 15;
const defaultAbandonedJobHours = 2;
const defaultProcessedWebhookRetentionDays = 30;
const defaultErrorLogRetentionDays = 90;
const defaultMaxBatchSize = 100;

export function createOperationalCleanupPlan(
  candidates: OperationalCleanupCandidate[],
  input: OperationalCleanupInput = {}
): OperationalCleanupPlan {
  const now = parseDate(input.now ?? new Date().toISOString());

  if (!now) {
    return { shouldRun: false, reason: 'invalid_now', actions: [], skipped: [] };
  }

  const maxBatchSize = positiveInteger(input.maxBatchSize, defaultMaxBatchSize);

  if (maxBatchSize < 1) {
    return { shouldRun: false, reason: 'invalid_batch_size', generatedAt: now.toISOString(), actions: [], skipped: [] };
  }

  const batch = candidates.slice(0, maxBatchSize);

  if (batch.length === 0) {
    return { shouldRun: false, reason: 'empty_batch', generatedAt: now.toISOString(), actions: [], skipped: [] };
  }

  const thresholds = {
    staleLockMs: positiveInteger(input.staleLockMinutes, defaultStaleLockMinutes) * 60 * 1000,
    abandonedJobMs: positiveInteger(input.abandonedJobHours, defaultAbandonedJobHours) * 60 * 60 * 1000,
    processedWebhookRetentionMs: positiveInteger(input.processedWebhookRetentionDays, defaultProcessedWebhookRetentionDays) * 24 * 60 * 60 * 1000,
    errorLogRetentionMs: positiveInteger(input.errorLogRetentionDays, defaultErrorLogRetentionDays) * 24 * 60 * 60 * 1000
  };

  const actions: OperationalCleanupAction[] = [];
  const skipped: OperationalCleanupPlan['skipped'] = [];

  for (const candidate of batch) {
    const plan = planCandidate(candidate, now, thresholds);

    if (plan) {
      actions.push(plan);
    } else {
      skipped.push({
        entityTable: candidate.entityTable,
        entityId: candidate.entityId,
        reason: 'not_eligible'
      });
    }
  }

  return {
    shouldRun: actions.length > 0,
    reason: actions.length > 0 ? 'ready' : 'empty_batch',
    generatedAt: now.toISOString(),
    actions,
    skipped
  };
}

function planCandidate(
  candidate: OperationalCleanupCandidate,
  now: Date,
  thresholds: {
    staleLockMs: number;
    abandonedJobMs: number;
    processedWebhookRetentionMs: number;
    errorLogRetentionMs: number;
  }
): OperationalCleanupAction | undefined {
  if (!candidate.entityId.trim()) return undefined;

  if (candidate.entityTable === 'email_outbox') {
    return planEmailOutboxCleanup(candidate, now, thresholds.staleLockMs);
  }

  if (candidate.entityTable === 'certificate_generation_jobs') {
    return planCertificateJobCleanup(candidate, now, thresholds.abandonedJobMs);
  }

  if (candidate.entityTable === 'enrollment_webhook_events') {
    return planWebhookEventCleanup(candidate, now, thresholds.processedWebhookRetentionMs);
  }

  if (candidate.entityTable === 'error_logs') {
    return planErrorLogCleanup(candidate, now, thresholds.errorLogRetentionMs);
  }

  return undefined;
}

function planEmailOutboxCleanup(candidate: OperationalCleanupCandidate, now: Date, staleLockMs: number): OperationalCleanupAction | undefined {
  const lockedUntil = parseDate(candidate.lockedUntil);

  if (candidate.status !== 'sending' || !lockedUntil || now.getTime() - lockedUntil.getTime() < staleLockMs) {
    return undefined;
  }

  return createAction(candidate, now, 'release_email_lock', 'stale_email_dispatch_lock', 'pending');
}

function planCertificateJobCleanup(candidate: OperationalCleanupCandidate, now: Date, abandonedJobMs: number): OperationalCleanupAction | undefined {
  const updatedAt = parseDate(candidate.updatedAt);

  if (candidate.status !== 'rendering' || !updatedAt || now.getTime() - updatedAt.getTime() < abandonedJobMs) {
    return undefined;
  }

  return createAction(candidate, now, 'mark_certificate_job_failed', 'abandoned_certificate_render_job', 'failed');
}

function planWebhookEventCleanup(candidate: OperationalCleanupCandidate, now: Date, retentionMs: number): OperationalCleanupAction | undefined {
  const completedAt = parseDate(candidate.completedAt ?? candidate.updatedAt);
  const cleanStatus = candidate.status === 'processed' || candidate.status === 'skipped' || candidate.status === 'duplicate';

  if (!cleanStatus || !completedAt || now.getTime() - completedAt.getTime() < retentionMs) {
    return undefined;
  }

  return createAction(candidate, now, 'archive_webhook_event', 'processed_webhook_retention_elapsed', 'archived');
}

function planErrorLogCleanup(candidate: OperationalCleanupCandidate, now: Date, retentionMs: number): OperationalCleanupAction | undefined {
  const createdAt = parseDate(candidate.createdAt);

  if (!createdAt || now.getTime() - createdAt.getTime() < retentionMs) {
    return undefined;
  }

  return createAction(candidate, now, 'purge_error_log', 'error_log_retention_elapsed', 'purged');
}

function createAction(
  candidate: OperationalCleanupCandidate,
  now: Date,
  action: OperationalCleanupAction['action'],
  reason: string,
  nextState: string
): OperationalCleanupAction {
  const idempotencyKey = `maintenance:${action}:${candidate.entityTable}:${candidate.entityId}:${now.toISOString().slice(0, 10)}`;

  return {
    action,
    entityTable: candidate.entityTable,
    entityId: candidate.entityId,
    reason,
    idempotencyKey,
    auditRow: {
      idempotency_key: `audit:${idempotencyKey}`,
      actor_type: 'system',
      actor_id: 'maintenance-cleanup',
      entity_table: candidate.entityTable,
      entity_id: candidate.entityId,
      action,
      previous_state: candidate.status,
      next_state: nextState,
      created_at: now.toISOString()
    }
  };
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function positiveInteger(value: number | undefined, defaultValue: number): number {
  return Number.isInteger(value) && value !== undefined && value >= 0 ? value : defaultValue;
}
