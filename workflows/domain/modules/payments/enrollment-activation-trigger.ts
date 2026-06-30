import { RazorpayWebhookAcceptedDto } from './dto/razorpay-webhook.dto';

export type EnrollmentActivationTriggerDecision = {
  shouldAttemptActivation: boolean;
  trigger: 'razorpay_webhook';
  reason:
    | 'paid_payment_order_updated'
    | 'payment_order_not_paid'
    | 'payment_order_not_updated'
    | 'missing_payment_identity'
    | 'webhook_not_processable'
    | 'webhook_not_newly_persisted';
  orderId?: string;
  paymentId?: string;
};

export function decideEnrollmentActivationTrigger(event: RazorpayWebhookAcceptedDto): EnrollmentActivationTriggerDecision {
  const orderId = event.paymentOrderTransition?.lookup.orderId ?? event.orderId;
  const paymentId = event.paymentOrderTransition?.lookup.paymentId ?? event.paymentId;
  const base = {
    trigger: 'razorpay_webhook' as const,
    orderId,
    paymentId
  };

  if (event.processingDecision?.shouldProcessPayment !== true) {
    return {
      ...base,
      shouldAttemptActivation: false,
      reason: 'webhook_not_processable'
    };
  }

  if (event.persistenceExecution?.status !== 'persisted') {
    return {
      ...base,
      shouldAttemptActivation: false,
      reason: 'webhook_not_newly_persisted'
    };
  }

  if (!orderId && !paymentId) {
    return {
      ...base,
      shouldAttemptActivation: false,
      reason: 'missing_payment_identity'
    };
  }

  if (event.paymentOrderTransition?.targetStatus !== 'paid') {
    return {
      ...base,
      shouldAttemptActivation: false,
      reason: 'payment_order_not_paid'
    };
  }

  if (event.paymentOrderTransitionExecution?.status !== 'updated') {
    return {
      ...base,
      shouldAttemptActivation: false,
      reason: 'payment_order_not_updated'
    };
  }

  return {
    ...base,
    shouldAttemptActivation: true,
    reason: 'paid_payment_order_updated'
  };
}
