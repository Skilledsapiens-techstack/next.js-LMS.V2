import { RazorpayWebhookAcceptedDto } from './dto/razorpay-webhook.dto';

export type RazorpayWebhookProcessingDecision = NonNullable<RazorpayWebhookAcceptedDto['processingDecision']>;

export function decideRazorpayWebhookProcessing(event: RazorpayWebhookAcceptedDto): RazorpayWebhookProcessingDecision {
  if (!event.persistencePlan?.shouldPersist) {
    return {
      shouldProcessPayment: false,
      reason: 'missing_persistence_plan',
      nextStep: 'reject_before_persistence'
    };
  }

  if (event.processingIntent !== 'processable') {
    return {
      shouldProcessPayment: false,
      reason: 'skipped_event',
      nextStep: 'persist_event_only'
    };
  }

  return {
    shouldProcessPayment: true,
    reason: 'processable_payment_event',
    nextStep: 'persist_event_and_process_payment'
  };
}
