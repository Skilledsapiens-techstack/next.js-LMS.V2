import { createOperationalCleanupPlan, OperationalCleanupCandidate } from './operational-cleanup-plan';

const now = '2026-06-27T12:00:00.000Z';

describe('createOperationalCleanupPlan', () => {
  it('plans conservative cleanup actions for eligible operational records', () => {
    const candidates: OperationalCleanupCandidate[] = [
      {
        entityTable: 'email_outbox',
        entityId: 'email-job-1',
        status: 'sending',
        lockedUntil: '2026-06-27T11:30:00.000Z'
      },
      {
        entityTable: 'certificate_generation_jobs',
        entityId: 'cert-job-1',
        status: 'rendering',
        updatedAt: '2026-06-27T09:00:00.000Z'
      },
      {
        entityTable: 'enrollment_webhook_events',
        entityId: 'event-1',
        status: 'processed',
        completedAt: '2026-05-01T12:00:00.000Z'
      },
      {
        entityTable: 'error_logs',
        entityId: 'error-1',
        createdAt: '2026-01-01T12:00:00.000Z'
      }
    ];

    expect(createOperationalCleanupPlan(candidates, { now }).actions).toEqual([
      expect.objectContaining({
        action: 'release_email_lock',
        entityTable: 'email_outbox',
        entityId: 'email-job-1',
        reason: 'stale_email_dispatch_lock'
      }),
      expect.objectContaining({
        action: 'mark_certificate_job_failed',
        entityTable: 'certificate_generation_jobs',
        entityId: 'cert-job-1',
        reason: 'abandoned_certificate_render_job'
      }),
      expect.objectContaining({
        action: 'archive_webhook_event',
        entityTable: 'enrollment_webhook_events',
        entityId: 'event-1',
        reason: 'processed_webhook_retention_elapsed'
      }),
      expect.objectContaining({
        action: 'purge_error_log',
        entityTable: 'error_logs',
        entityId: 'error-1',
        reason: 'error_log_retention_elapsed'
      })
    ]);
  });

  it('skips records that are not eligible yet', () => {
    const plan = createOperationalCleanupPlan(
      [
        {
          entityTable: 'email_outbox',
          entityId: 'email-job-1',
          status: 'sending',
          lockedUntil: '2026-06-27T11:55:00.000Z'
        },
        {
          entityTable: 'certificate_generation_jobs',
          entityId: 'cert-job-1',
          status: 'completed',
          updatedAt: '2026-06-27T09:00:00.000Z'
        }
      ],
      { now }
    );

    expect(plan).toMatchObject({
      shouldRun: false,
      reason: 'empty_batch',
      actions: [],
      skipped: [
        { entityTable: 'email_outbox', entityId: 'email-job-1', reason: 'not_eligible' },
        { entityTable: 'certificate_generation_jobs', entityId: 'cert-job-1', reason: 'not_eligible' }
      ]
    });
  });

  it('caps the candidate batch size before planning', () => {
    const plan = createOperationalCleanupPlan(
      [
        {
          entityTable: 'email_outbox',
          entityId: 'email-job-1',
          status: 'sending',
          lockedUntil: '2026-06-27T11:30:00.000Z'
        },
        {
          entityTable: 'error_logs',
          entityId: 'error-1',
          createdAt: '2026-01-01T12:00:00.000Z'
        }
      ],
      { now, maxBatchSize: 1 }
    );

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ entityId: 'email-job-1' });
  });

  it('rejects invalid clock input without planning cleanup', () => {
    expect(createOperationalCleanupPlan([], { now: 'not-a-date' })).toEqual({
      shouldRun: false,
      reason: 'invalid_now',
      actions: [],
      skipped: []
    });
  });
});
