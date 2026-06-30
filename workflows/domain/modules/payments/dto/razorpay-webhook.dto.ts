
export class RazorpayWebhookAcceptedDto {
  received!: true;
  event!: string;
  eventId?: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  studentEmail?: string;
  studentPhone?: string;
  processingIntent!: 'processable' | 'skipped' | 'unknown';
  suggestedStatus!: 'received' | 'skipped_failed' | 'skipped_refunded' | 'skipped_pending_payment';
  persistencePlan?: {
    table: 'enrollment_webhook_events';
    eventId: string;
    eventType: string;
    paymentId?: string;
    orderId?: string;
    status: RazorpayWebhookAcceptedDto['suggestedStatus'];
    shouldPersist: boolean;
  };
  processingDecision?: {
    shouldProcessPayment: boolean;
    reason: 'processable_payment_event' | 'skipped_event' | 'missing_persistence_plan';
    nextStep: 'persist_event_and_process_payment' | 'persist_event_only' | 'reject_before_persistence';
  };
  paymentOrderTransition?: {
    table: 'payment_orders';
    lookup: {
      orderId?: string;
      paymentId?: string;
    };
    sourceEvent: string;
    shouldUpdatePaymentOrder: boolean;
    targetStatus?: 'paid' | 'failed';
    allowedCurrentStatuses: Array<'created' | 'failed' | 'cancelled'>;
    blockedCurrentStatuses: Array<'paid' | 'cancelled'>;
    reason: 'mark_paid' | 'mark_failed' | 'hold_authorized' | 'ignored_event' | 'missing_payment_order_identity';
  };
  persistenceExecution?: {
    enabled: boolean;
    attempted: boolean;
    status: 'disabled' | 'persisted' | 'duplicate' | 'skipped' | 'failed';
    eventId?: string;
    message?: string;
  };
  paymentOrderTransitionExecution?: {
    enabled: boolean;
    attempted: boolean;
    status: 'disabled' | 'updated' | 'not_found_or_blocked' | 'skipped' | 'failed';
    orderId?: string;
    paymentId?: string;
    message?: string;
  };
  webhookEventStatusExecution?: {
    enabled: boolean;
    attempted: boolean;
    status: 'disabled' | 'updated' | 'skipped' | 'failed';
    eventId?: string;
    targetStatus?: 'received' | 'processed' | 'processed_with_exceptions' | 'duplicate' | 'skipped_failed' | 'skipped_refunded' | 'skipped_pending_payment' | 'failed';
    message?: string;
  };
  activationTriggerDecision?: {
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
}
