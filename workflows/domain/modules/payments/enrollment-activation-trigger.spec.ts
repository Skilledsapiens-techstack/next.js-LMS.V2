import { RazorpayWebhookAcceptedDto } from './dto/razorpay-webhook.dto';
import { decideEnrollmentActivationTrigger } from './enrollment-activation-trigger';

function event(overrides: Partial<RazorpayWebhookAcceptedDto> = {}): RazorpayWebhookAcceptedDto {
  return {
    received: true,
    event: 'payment.captured',
    orderId: 'order_123',
    paymentId: 'pay_123',
    processingIntent: 'processable',
    suggestedStatus: 'received',
    processingDecision: {
      shouldProcessPayment: true,
      reason: 'processable_payment_event',
      nextStep: 'persist_event_and_process_payment'
    },
    persistenceExecution: {
      enabled: true,
      attempted: true,
      status: 'persisted'
    },
    paymentOrderTransition: {
      table: 'payment_orders',
      lookup: {
        orderId: 'order_123',
        paymentId: 'pay_123'
      },
      sourceEvent: 'payment.captured',
      shouldUpdatePaymentOrder: true,
      targetStatus: 'paid',
      allowedCurrentStatuses: ['created', 'failed', 'cancelled'],
      blockedCurrentStatuses: [],
      reason: 'mark_paid'
    },
    paymentOrderTransitionExecution: {
      enabled: true,
      attempted: true,
      status: 'updated',
      orderId: 'order_123',
      paymentId: 'pay_123'
    },
    ...overrides
  };
}

describe('decideEnrollmentActivationTrigger', () => {
  it('allows activation only after a newly persisted paid payment-order update', () => {
    expect(decideEnrollmentActivationTrigger(event())).toEqual({
      shouldAttemptActivation: true,
      trigger: 'razorpay_webhook',
      reason: 'paid_payment_order_updated',
      orderId: 'order_123',
      paymentId: 'pay_123'
    });
  });

  it('blocks skipped webhook events', () => {
    expect(
      decideEnrollmentActivationTrigger(
        event({
          processingDecision: {
            shouldProcessPayment: false,
            reason: 'skipped_event',
            nextStep: 'persist_event_only'
          }
        })
      )
    ).toMatchObject({
      shouldAttemptActivation: false,
      reason: 'webhook_not_processable'
    });
  });

  it('blocks duplicate or non-newly-persisted webhooks', () => {
    expect(
      decideEnrollmentActivationTrigger(
        event({
          persistenceExecution: {
            enabled: true,
            attempted: true,
            status: 'duplicate'
          }
        })
      )
    ).toMatchObject({
      shouldAttemptActivation: false,
      reason: 'webhook_not_newly_persisted'
    });
  });

  it('blocks failed payment-order transitions', () => {
    expect(
      decideEnrollmentActivationTrigger(
        event({
          paymentOrderTransitionExecution: {
            enabled: true,
            attempted: true,
            status: 'not_found_or_blocked',
            orderId: 'order_123',
            paymentId: 'pay_123'
          }
        })
      )
    ).toMatchObject({
      shouldAttemptActivation: false,
      reason: 'payment_order_not_updated'
    });
  });

  it('blocks non-paid payment-order transitions', () => {
    expect(
      decideEnrollmentActivationTrigger(
        event({
          paymentOrderTransition: {
            table: 'payment_orders',
            lookup: {
              orderId: 'order_123',
              paymentId: 'pay_123'
            },
            sourceEvent: 'payment.failed',
            shouldUpdatePaymentOrder: true,
            targetStatus: 'failed',
            allowedCurrentStatuses: ['created'],
            blockedCurrentStatuses: ['paid', 'cancelled'],
            reason: 'mark_failed'
          }
        })
      )
    ).toMatchObject({
      shouldAttemptActivation: false,
      reason: 'payment_order_not_paid'
    });
  });
});
