import { createRazorpayWebhookPersistencePlan } from './razorpay-webhook-plan';

describe('createRazorpayWebhookPersistencePlan', () => {
  it('creates an enrollment webhook event persistence plan', () => {
    expect(
      createRazorpayWebhookPersistencePlan({
        received: true,
        event: 'payment.captured',
        eventId: 'evt_123',
        paymentId: 'pay_123',
        orderId: 'order_123',
        processingIntent: 'processable',
        suggestedStatus: 'received'
      })
    ).toEqual({
      table: 'enrollment_webhook_events',
      eventId: 'evt_123',
      eventType: 'payment.captured',
      paymentId: 'pay_123',
      orderId: 'order_123',
      status: 'received',
      shouldPersist: true
    });
  });
});
