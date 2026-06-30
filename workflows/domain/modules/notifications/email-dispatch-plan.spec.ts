import { createEmailDispatchPlan, EmailOutboxJobForDispatch } from './email-dispatch-plan';

const job: EmailOutboxJobForDispatch = {
  idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
  status: 'pending',
  recipientEmail: ' Student@Example.com ',
  subject: ' Ticket SUP-123 created ',
  htmlBody: ' <p>Hello Student</p> ',
  textBody: ' Hello Student ',
  attemptCount: 0
};

describe('createEmailDispatchPlan', () => {
  it('builds provider-neutral dispatch payload and sending update for a pending job', () => {
    expect(
      createEmailDispatchPlan(job, {
        workerId: ' email-worker-1 ',
        now: '2026-06-27T10:00:00.000Z'
      })
    ).toEqual({
      shouldDispatch: true,
      reason: 'ready',
      idempotencyKey: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
      dispatchPayload: {
        to: 'student@example.com',
        subject: 'Ticket SUP-123 created',
        html: '<p>Hello Student</p>',
        text: 'Hello Student'
      },
      sendingUpdate: {
        idempotency_key: 'email:support.ticket.created:student@example.com:support_tickets:ticket-uuid:created',
        status: 'sending',
        worker_id: 'email-worker-1',
        attempt_count: 1,
        locked_until: '2026-06-27T10:05:00.000Z',
        updated_at: '2026-06-27T10:00:00.000Z'
      }
    });
  });

  it('increments the next attempt count from the existing attempt count', () => {
    expect(
      createEmailDispatchPlan({ ...job, attemptCount: 2 }, { workerId: 'email-worker-1', now: '2026-06-27T10:00:00.000Z', maxAttempts: 5 })
        .sendingUpdate
    ).toMatchObject({
      attempt_count: 3
    });
  });

  it('blocks missing worker, identity, recipient, subject, and body before dispatch', () => {
    expect(createEmailDispatchPlan(job, { workerId: ' ' })).toEqual({ shouldDispatch: false, reason: 'missing_worker' });
    expect(createEmailDispatchPlan({ ...job, idempotencyKey: ' ' }, { workerId: 'worker' })).toEqual({ shouldDispatch: false, reason: 'missing_job_identity' });
    expect(createEmailDispatchPlan({ ...job, recipientEmail: ' ' }, { workerId: 'worker' })).toEqual({
      shouldDispatch: false,
      reason: 'missing_recipient',
      idempotencyKey: job.idempotencyKey
    });
    expect(createEmailDispatchPlan({ ...job, subject: ' ' }, { workerId: 'worker' })).toEqual({
      shouldDispatch: false,
      reason: 'missing_subject',
      idempotencyKey: job.idempotencyKey
    });
    expect(createEmailDispatchPlan({ ...job, htmlBody: ' ' }, { workerId: 'worker' })).toEqual({
      shouldDispatch: false,
      reason: 'missing_body',
      idempotencyKey: job.idempotencyKey
    });
  });

  it('blocks jobs that are not pending', () => {
    expect(createEmailDispatchPlan({ ...job, status: 'sent' }, { workerId: 'worker' })).toEqual({
      shouldDispatch: false,
      reason: 'not_pending',
      idempotencyKey: job.idempotencyKey
    });
  });

  it('blocks jobs that reached the attempt limit', () => {
    expect(createEmailDispatchPlan({ ...job, attemptCount: 3 }, { workerId: 'worker', maxAttempts: 3 })).toEqual({
      shouldDispatch: false,
      reason: 'attempt_limit_reached',
      idempotencyKey: job.idempotencyKey
    });
  });

  it('blocks jobs scheduled for a future attempt', () => {
    expect(
      createEmailDispatchPlan(
        { ...job, nextAttemptAt: '2026-06-27T10:10:00.000Z' },
        { workerId: 'worker', now: '2026-06-27T10:00:00.000Z' }
      )
    ).toEqual({
      shouldDispatch: false,
      reason: 'scheduled_for_later',
      idempotencyKey: job.idempotencyKey
    });
  });

  it('blocks jobs locked by another active worker window', () => {
    expect(
      createEmailDispatchPlan(
        { ...job, lockedUntil: '2026-06-27T10:01:00.000Z' },
        { workerId: 'worker', now: '2026-06-27T10:00:00.000Z' }
      )
    ).toEqual({
      shouldDispatch: false,
      reason: 'locked',
      idempotencyKey: job.idempotencyKey
    });
  });
});
