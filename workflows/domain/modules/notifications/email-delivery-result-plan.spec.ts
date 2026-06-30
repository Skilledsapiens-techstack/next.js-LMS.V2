import { createEmailDeliveryResultPlan, EmailDeliveryJob } from './email-delivery-result-plan';

const job: EmailDeliveryJob = {
  idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
  status: 'sending',
  attemptCount: 1,
  maxAttempts: 3,
  workerId: 'email-worker-1'
};

describe('createEmailDeliveryResultPlan', () => {
  it('marks a provider-success result as sent and releases the lock', () => {
    expect(
      createEmailDeliveryResultPlan(job, {
        workerId: ' email-worker-1 ',
        success: true,
        providerMessageId: ' provider-message-123 ',
        deliveredAt: '2026-06-27T10:01:00.000Z'
      })
    ).toEqual({
      shouldRecord: true,
      reason: 'ready',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      emailUpdate: {
        idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        status: 'sent',
        provider_message_id: 'provider-message-123',
        sent_at: '2026-06-27T10:01:00.000Z',
        locked_until: null,
        worker_id: null,
        updated_at: '2026-06-27T10:01:00.000Z'
      }
    });
  });

  it('marks a provider failure as pending retry when attempts remain', () => {
    expect(
      createEmailDeliveryResultPlan(job, {
        workerId: 'email-worker-1',
        success: false,
        errorMessage: 'Provider timeout',
        deliveredAt: '2026-06-27T10:01:00.000Z'
      })
    ).toEqual({
      shouldRecord: true,
      reason: 'ready',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      emailUpdate: {
        idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        status: 'pending',
        last_error_message: 'Provider timeout',
        next_attempt_at: '2026-06-27T10:11:00.000Z',
        locked_until: null,
        worker_id: null,
        updated_at: '2026-06-27T10:01:00.000Z'
      },
      errorLogRow: {
        idempotency_key: 'email_delivery_error:email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created:1',
        entity_table: 'email_outbox',
        entity_id: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        error_type: 'email_provider',
        message: 'Provider timeout',
        created_at: '2026-06-27T10:01:00.000Z'
      }
    });
  });

  it('marks a provider failure as terminal failed when attempts are exhausted', () => {
    expect(
      createEmailDeliveryResultPlan(
        { ...job, attemptCount: 3 },
        {
          workerId: 'email-worker-1',
          success: false,
          errorMessage: 'Mailbox unavailable',
          deliveredAt: '2026-06-27T10:01:00.000Z'
        }
      ).emailUpdate
    ).toMatchObject({
      status: 'failed',
      next_attempt_at: undefined
    });
  });

  it('blocks incomplete or unsafe success/failure result records', () => {
    expect(createEmailDeliveryResultPlan(job, { workerId: ' ', success: true, providerMessageId: 'message-1' })).toEqual({
      shouldRecord: false,
      reason: 'missing_worker'
    });
    expect(createEmailDeliveryResultPlan({ ...job, idempotencyKey: ' ' }, { workerId: 'worker', success: true, providerMessageId: 'message-1' })).toEqual({
      shouldRecord: false,
      reason: 'missing_job_identity'
    });
    expect(createEmailDeliveryResultPlan({ ...job, status: 'pending' }, { workerId: 'worker', success: true, providerMessageId: 'message-1' })).toEqual({
      shouldRecord: false,
      reason: 'not_sending',
      idempotencyKey: job.idempotencyKey
    });
    expect(createEmailDeliveryResultPlan(job, { workerId: 'other-worker', success: true, providerMessageId: 'message-1' })).toEqual({
      shouldRecord: false,
      reason: 'worker_mismatch',
      idempotencyKey: job.idempotencyKey
    });
    expect(createEmailDeliveryResultPlan(job, { workerId: 'email-worker-1', success: true, providerMessageId: ' ' })).toEqual({
      shouldRecord: false,
      reason: 'missing_provider_message',
      idempotencyKey: job.idempotencyKey
    });
    expect(createEmailDeliveryResultPlan(job, { workerId: 'email-worker-1', success: false, errorMessage: ' ' })).toEqual({
      shouldRecord: false,
      reason: 'missing_error_message',
      idempotencyKey: job.idempotencyKey
    });
  });
});
