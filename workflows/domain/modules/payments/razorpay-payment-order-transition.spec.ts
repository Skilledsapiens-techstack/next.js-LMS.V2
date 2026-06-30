import { RazorpayWebhookAcceptedDto } from './dto/razorpay-webhook.dto';
import { createRazorpayPaymentOrderTransitionPlan } from './razorpay-payment-order-transition';

function event(overrides: Partial<RazorpayWebhookAcceptedDto>): RazorpayWebhookAcceptedDto {
  return {
    received: true,
    event: 'payment.captured',
    processingIntent: 'processable',
    suggestedStatus: 'received',
    ...overrides
  };
}

describe('createRazorpayPaymentOrderTransitionPlan', () => {
  it('marks captured payments as paid and allows recovery from non-terminal statuses', () => {
    expect(
      createRazorpayPaymentOrderTransitionPlan(
        event({
          event: 'payment.captured',
          paymentId: 'pay_123',
          orderId: 'order_123'
        })
      )
    ).toEqual({
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
    });
  });

  it('marks order.paid as paid using the order identity', () => {
    expect(
      createRazorpayPaymentOrderTransitionPlan(
        event({
          event: 'order.paid',
          orderId: 'order_123'
        })
      )
    ).toMatchObject({
      lookup: {
        orderId: 'order_123',
        paymentId: undefined
      },
      shouldUpdatePaymentOrder: true,
      targetStatus: 'paid',
      reason: 'mark_paid'
    });
  });

  it('allows failed updates only from created orders to avoid paid-order downgrades', () => {
    expect(
      createRazorpayPaymentOrderTransitionPlan(
        event({
          event: 'payment.failed',
          paymentId: 'pay_failed',
          orderId: 'order_123'
        })
      )
    ).toMatchObject({
      shouldUpdatePaymentOrder: true,
      targetStatus: 'failed',
      allowedCurrentStatuses: ['created'],
      blockedCurrentStatuses: ['paid', 'cancelled'],
      reason: 'mark_failed'
    });
  });

  it('does not update orders for authorized payments before capture', () => {
    const plan = createRazorpayPaymentOrderTransitionPlan(
      event({
        event: 'payment.authorized',
        paymentId: 'pay_authorized',
        orderId: 'order_123'
      })
    );

    expect(plan).toMatchObject({
      shouldUpdatePaymentOrder: false,
      reason: 'hold_authorized'
    });
    expect(plan).not.toHaveProperty('targetStatus');
  });

  it('does not update payment orders when the webhook has no payment or order identity', () => {
    expect(
      createRazorpayPaymentOrderTransitionPlan(
        event({
          event: 'payment.captured'
        })
      )
    ).toMatchObject({
      lookup: {},
      shouldUpdatePaymentOrder: false,
      reason: 'missing_payment_order_identity'
    });
  });
});
