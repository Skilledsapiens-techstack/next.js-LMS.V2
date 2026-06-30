import { decideRazorpayWebhookProcessing } from './razorpay-webhook-decision';

describe('decideRazorpayWebhookProcessing', () => {
  it('processes verified processable payment events with a persistence plan', () => {
    expect(
      decideRazorpayWebhookProcessing({
        received: true,
        event: 'payment.captured',
        eventId: 'evt_123',
        processingIntent: 'processable',
        suggestedStatus: 'received',
        persistencePlan: {
          table: 'enrollment_webhook_events',
          eventId: 'evt_123',
          eventType: 'payment.captured',
          status: 'received',
          shouldPersist: true
        }
      })
    ).toEqual({
      shouldProcessPayment: true,
      reason: 'processable_payment_event',
      nextStep: 'persist_event_and_process_payment'
    });
  });

  it('persists skipped events without payment processing', () => {
    expect(
      decideRazorpayWebhookProcessing({
        received: true,
        event: 'payment.failed',
        eventId: 'evt_failed',
        processingIntent: 'skipped',
        suggestedStatus: 'skipped_failed',
        persistencePlan: {
          table: 'enrollment_webhook_events',
          eventId: 'evt_failed',
          eventType: 'payment.failed',
          status: 'skipped_failed',
          shouldPersist: true
        }
      })
    ).toEqual({
      shouldProcessPayment: false,
      reason: 'skipped_event',
      nextStep: 'persist_event_only'
    });
  });
});
