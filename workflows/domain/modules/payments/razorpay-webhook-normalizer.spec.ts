import { normalizeRazorpayWebhook } from './razorpay-webhook-normalizer';

describe('normalizeRazorpayWebhook', () => {
  it('normalizes captured payment payloads from Razorpay entities', () => {
    expect(
      normalizeRazorpayWebhook({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: 'order_123',
              amount: 199900,
              currency: 'INR',
              notes: {
                customer_email: ' Student@Example.com ',
                mobile: '+919999999999'
              }
            }
          }
        }
      })
    ).toEqual({
      received: true,
      event: 'payment.captured',
      eventId: 'payment.captured:pay_123',
      paymentId: 'pay_123',
      orderId: 'order_123',
      amount: 1999,
      currency: 'INR',
      studentEmail: 'student@example.com',
      studentPhone: '+919999999999',
      processingIntent: 'processable',
      suggestedStatus: 'received'
    });
  });

  it('marks failed payment events as skipped', () => {
    expect(
      normalizeRazorpayWebhook({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed'
            }
          }
        }
      })
    ).toMatchObject({
      event: 'payment.failed',
      eventId: 'payment.failed:pay_failed',
      processingIntent: 'skipped',
      suggestedStatus: 'skipped_failed'
    });
  });
});
