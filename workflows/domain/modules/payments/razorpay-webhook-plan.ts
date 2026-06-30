import { RazorpayWebhookAcceptedDto } from './dto/razorpay-webhook.dto';

export type RazorpayWebhookPersistencePlan = NonNullable<RazorpayWebhookAcceptedDto['persistencePlan']>;

export function createRazorpayWebhookPersistencePlan(event: RazorpayWebhookAcceptedDto): RazorpayWebhookPersistencePlan | undefined {
  if (!event.event || !event.eventId) return undefined;

  return {
    table: 'enrollment_webhook_events',
    eventId: event.eventId,
    eventType: event.event,
    paymentId: event.paymentId,
    orderId: event.orderId,
    status: event.suggestedStatus,
    shouldPersist: true
  };
}
