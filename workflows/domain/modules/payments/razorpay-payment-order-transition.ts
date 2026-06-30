import { RazorpayWebhookAcceptedDto } from './dto/razorpay-webhook.dto';

export type RazorpayPaymentOrderTransitionPlan = NonNullable<RazorpayWebhookAcceptedDto['paymentOrderTransition']>;

const PAID_BLOCKED_STATUSES: RazorpayPaymentOrderTransitionPlan['blockedCurrentStatuses'] = ['paid', 'cancelled'];
const FAILED_ALLOWED_STATUSES: RazorpayPaymentOrderTransitionPlan['allowedCurrentStatuses'] = ['created'];
const PAID_ALLOWED_STATUSES: RazorpayPaymentOrderTransitionPlan['allowedCurrentStatuses'] = ['created', 'failed', 'cancelled'];

export function createRazorpayPaymentOrderTransitionPlan(event: RazorpayWebhookAcceptedDto): RazorpayPaymentOrderTransitionPlan {
  const lookup = {
    orderId: event.orderId,
    paymentId: event.paymentId
  };

  const base = {
    table: 'payment_orders' as const,
    lookup,
    sourceEvent: event.event,
    allowedCurrentStatuses: [] as RazorpayPaymentOrderTransitionPlan['allowedCurrentStatuses'],
    blockedCurrentStatuses: PAID_BLOCKED_STATUSES
  };

  if (!event.orderId && !event.paymentId) {
    return {
      ...base,
      shouldUpdatePaymentOrder: false,
      reason: 'missing_payment_order_identity'
    };
  }

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    return {
      ...base,
      shouldUpdatePaymentOrder: true,
      targetStatus: 'paid',
      allowedCurrentStatuses: PAID_ALLOWED_STATUSES,
      blockedCurrentStatuses: [],
      reason: 'mark_paid'
    };
  }

  if (event.event === 'payment.failed') {
    return {
      ...base,
      shouldUpdatePaymentOrder: true,
      targetStatus: 'failed',
      allowedCurrentStatuses: FAILED_ALLOWED_STATUSES,
      reason: 'mark_failed'
    };
  }

  if (event.event === 'payment.authorized') {
    return {
      ...base,
      shouldUpdatePaymentOrder: false,
      reason: 'hold_authorized'
    };
  }

  return {
    ...base,
    shouldUpdatePaymentOrder: false,
    reason: 'ignored_event'
  };
}
