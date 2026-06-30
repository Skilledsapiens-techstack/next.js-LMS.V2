import { createHmac } from 'node:crypto';
import { RazorpayWebhookService } from './razorpay-webhook.service';

class MockConfigService {
  constructor(private readonly values: Record<string, string | boolean | undefined>) {}

  getOrThrow<T extends string>(key: string): T {
    return (this.values[key] ?? '') as T;
  }

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

type PersistResult = { data: unknown; error: { message: string } | null };

class MockWebhookEventQuery {
  filters: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: PersistResult) {}

  update(...args: unknown[]) {
    this.filters.push({ method: 'update', args });
    return this;
  }

  upsert(...args: unknown[]) {
    this.filters.push({ method: 'upsert', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.filters.push({ method: 'eq', args });
    return this;
  }

  select(...args: unknown[]) {
    this.filters.push({ method: 'select', args });
    return this;
  }

  maybeSingle() {
    this.filters.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.result);
  }
}

class MockPaymentOrderQuery {
  filters: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: PersistResult) {}

  update(...args: unknown[]) {
    this.filters.push({ method: 'update', args });
    return this;
  }

  in(...args: unknown[]) {
    this.filters.push({ method: 'in', args });
    return this;
  }

  or(...args: unknown[]) {
    this.filters.push({ method: 'or', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.filters.push({ method: 'eq', args });
    return this;
  }

  select(...args: unknown[]) {
    this.filters.push({ method: 'select', args });
    return this;
  }

  maybeSingle() {
    this.filters.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.result);
  }
}

class MockSupabaseAdmin {
  persistResult: PersistResult = { data: { event_id: 'evt_123', status: 'received' }, error: null };
  webhookStatusResult: PersistResult = { data: { event_id: 'evt_123', status: 'processed' }, error: null };
  paymentOrderResult: PersistResult = { data: { id: 'order-row-1', status: 'paid' }, error: null };
  lastQuery?: MockWebhookEventQuery;
  lastWebhookPersistQuery?: MockWebhookEventQuery;
  lastWebhookStatusQuery?: MockWebhookEventQuery;
  lastPaymentOrderQuery?: MockPaymentOrderQuery;
  private webhookEventCallCount = 0;

  from(tableName: string) {
    if (tableName === 'enrollment_webhook_events') {
      this.webhookEventCallCount += 1;
      this.lastQuery = new MockWebhookEventQuery(this.webhookEventCallCount === 1 ? this.persistResult : this.webhookStatusResult);
      if (this.webhookEventCallCount === 1) {
        this.lastWebhookPersistQuery = this.lastQuery;
      } else {
        this.lastWebhookStatusQuery = this.lastQuery;
      }
      return this.lastQuery;
    }

    if (tableName === 'payment_orders') {
      this.lastPaymentOrderQuery = new MockPaymentOrderQuery(this.paymentOrderResult);
      return this.lastPaymentOrderQuery;
    }

    throw new Error(`Unexpected table: ${tableName}`);
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('RazorpayWebhookService', () => {
  it('verifies signed webhook payloads and returns the local processing contract', () => {
    const secret = 'webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            order_id: 'order_123',
            amount: 10000,
            notes: { student_email: 'student@example.com' }
          }
        }
      }
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    const service = new RazorpayWebhookService(new MockConfigService({ RAZORPAY_WEBHOOK_SECRET: secret }) as never, new MockSupabase() as never);

    expect(service.verifyAndParse(rawBody, signature, payload)).toMatchObject({
      received: true,
      event: 'payment.captured',
      paymentId: 'pay_123',
      orderId: 'order_123',
      amount: 100,
      studentEmail: 'student@example.com',
      persistencePlan: {
        table: 'enrollment_webhook_events',
        eventType: 'payment.captured',
        paymentId: 'pay_123'
      },
      processingDecision: {
        shouldProcessPayment: true,
        reason: 'processable_payment_event',
        nextStep: 'persist_event_and_process_payment'
      }
    });
  });

  it('fails closed when the webhook secret is missing', () => {
    const service = new RazorpayWebhookService(new MockConfigService({}) as never, new MockSupabase() as never);

    expect(() => service.verifyAndParse(Buffer.from('{}'), 'signature', {})).toThrow('Razorpay webhook secret is not configured.');
  });

  it('rejects invalid signatures', () => {
    const service = new RazorpayWebhookService(new MockConfigService({ RAZORPAY_WEBHOOK_SECRET: 'secret' }) as never, new MockSupabase() as never);

    expect(() => service.verifyAndParse(Buffer.from('{}'), 'bad-signature', {})).toThrow('Razorpay webhook signature is invalid.');
  });

  it('does not attempt Supabase persistence unless the gate is enabled', async () => {
    const secret = 'webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            order_id: 'order_123',
            amount: 10000,
            notes: { student_email: 'student@example.com' }
          }
        }
      }
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    const supabase = new MockSupabase();
    const service = new RazorpayWebhookService(
      new MockConfigService({
        RAZORPAY_WEBHOOK_SECRET: secret,
        RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED: false
      }) as never,
      supabase as never
    );

    await expect(service.verifyParseAndMaybePersist(rawBody, signature, payload)).resolves.toMatchObject({
      persistenceExecution: {
        enabled: false,
        attempted: false,
        status: 'disabled',
        eventId: 'payment.captured:pay_123'
      },
      paymentOrderTransitionExecution: {
        enabled: false,
        attempted: false,
        status: 'disabled',
        orderId: 'order_123',
        paymentId: 'pay_123'
      },
      webhookEventStatusExecution: {
        enabled: false,
        attempted: false,
        status: 'disabled',
        eventId: 'payment.captured:pay_123'
      },
      activationTriggerDecision: {
        shouldAttemptActivation: false,
        trigger: 'razorpay_webhook',
        reason: 'webhook_not_newly_persisted',
        orderId: 'order_123',
        paymentId: 'pay_123'
      }
    });
    expect(supabase.admin.lastQuery).toBeUndefined();
    expect(supabase.admin.lastPaymentOrderQuery).toBeUndefined();
  });

  it('persists verified webhook events with duplicate-safe upsert when enabled while payment order transitions stay disabled', async () => {
    const secret = 'webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            order_id: 'order_123',
            amount: 10000,
            notes: { student_email: 'student@example.com' }
          }
        }
      }
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    const supabase = new MockSupabase();
    const service = new RazorpayWebhookService(
      new MockConfigService({
        RAZORPAY_WEBHOOK_SECRET: secret,
        RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED: true
      }) as never,
      supabase as never
    );

    await expect(service.verifyParseAndMaybePersist(rawBody, signature, payload)).resolves.toMatchObject({
      persistenceExecution: {
        enabled: true,
        attempted: true,
        status: 'persisted',
        eventId: 'payment.captured:pay_123'
      },
      paymentOrderTransitionExecution: {
        enabled: false,
        attempted: false,
        status: 'disabled',
        orderId: 'order_123',
        paymentId: 'pay_123'
      },
      webhookEventStatusExecution: {
        enabled: true,
        attempted: true,
        status: 'updated',
        eventId: 'payment.captured:pay_123',
        targetStatus: 'processed_with_exceptions'
      },
      activationTriggerDecision: {
        shouldAttemptActivation: false,
        trigger: 'razorpay_webhook',
        reason: 'payment_order_not_updated',
        orderId: 'order_123',
        paymentId: 'pay_123'
      }
    });
    expect(supabase.admin.lastWebhookPersistQuery?.filters).toEqual(
      expect.arrayContaining([
        {
          method: 'upsert',
          args: [
            expect.objectContaining({
              event_id: 'payment.captured:pay_123',
              event_type: 'payment.captured',
              payment_id: 'pay_123',
              order_id: 'order_123',
              status: 'received',
              payload
            }),
            { onConflict: 'event_id', ignoreDuplicates: true }
          ]
        },
        { method: 'select', args: ['event_id,status'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
    expect(supabase.admin.lastWebhookStatusQuery?.filters).toEqual(
      expect.arrayContaining([
        {
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'processed_with_exceptions',
              error_message: 'Payment order transitions are disabled. No Supabase write was attempted.'
            })
          ]
        },
        { method: 'eq', args: ['event_id', 'payment.captured:pay_123'] },
        { method: 'select', args: ['event_id,status,error_message'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
    expect(supabase.admin.lastPaymentOrderQuery).toBeUndefined();
  });

  it('updates payment orders only when transition writes are explicitly enabled and the webhook is newly persisted', async () => {
    const secret = 'webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            order_id: 'order_123',
            amount: 10000,
            notes: { student_email: 'student@example.com' }
          }
        }
      }
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    const supabase = new MockSupabase();
    const service = new RazorpayWebhookService(
      new MockConfigService({
        RAZORPAY_WEBHOOK_SECRET: secret,
        RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED: true,
        RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED: true
      }) as never,
      supabase as never
    );

    await expect(service.verifyParseAndMaybePersist(rawBody, signature, payload)).resolves.toMatchObject({
      persistenceExecution: {
        status: 'persisted'
      },
      paymentOrderTransitionExecution: {
        enabled: true,
        attempted: true,
        status: 'updated',
        orderId: 'order_123',
        paymentId: 'pay_123'
      },
      webhookEventStatusExecution: {
        enabled: true,
        attempted: true,
        status: 'updated',
        eventId: 'payment.captured:pay_123',
        targetStatus: 'processed'
      },
      activationTriggerDecision: {
        shouldAttemptActivation: true,
        trigger: 'razorpay_webhook',
        reason: 'paid_payment_order_updated',
        orderId: 'order_123',
        paymentId: 'pay_123'
      }
    });
    expect(supabase.admin.lastPaymentOrderQuery?.filters).toEqual(
      expect.arrayContaining([
        {
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'paid',
              razorpay_payment_id: 'pay_123'
            })
          ]
        },
        { method: 'in', args: ['status', ['created', 'failed', 'cancelled']] },
        { method: 'or', args: ['razorpay_order_id.eq.order_123,razorpay_payment_id.eq.pay_123'] },
        { method: 'select', args: ['id,status,razorpay_order_id,razorpay_payment_id'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
    expect(supabase.admin.lastWebhookStatusQuery?.filters).toEqual(
      expect.arrayContaining([
        {
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'processed',
              error_message: null
            })
          ]
        },
        { method: 'eq', args: ['event_id', 'payment.captured:pay_123'] },
        { method: 'select', args: ['event_id,status,error_message'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
  });

  it('records failed webhook-event status when payment order updates fail', async () => {
    const secret = 'webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            order_id: 'order_123',
            amount: 10000,
            notes: { student_email: 'student@example.com' }
          }
        }
      }
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    const supabase = new MockSupabase();
    supabase.admin.paymentOrderResult = { data: null, error: { message: 'payment update failed' } };
    const service = new RazorpayWebhookService(
      new MockConfigService({
        RAZORPAY_WEBHOOK_SECRET: secret,
        RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED: true,
        RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED: true
      }) as never,
      supabase as never
    );

    await expect(service.verifyParseAndMaybePersist(rawBody, signature, payload)).resolves.toMatchObject({
      paymentOrderTransitionExecution: {
        status: 'failed',
        message: 'payment update failed'
      },
      webhookEventStatusExecution: {
        enabled: true,
        attempted: true,
        status: 'updated',
        targetStatus: 'failed'
      }
    });
    expect(supabase.admin.lastWebhookStatusQuery?.filters).toEqual(
      expect.arrayContaining([
        {
          method: 'update',
          args: [
            expect.objectContaining({
              status: 'failed',
              error_message: 'payment update failed'
            })
          ]
        }
      ])
    );
  });

  it('reports duplicate webhook events without failing the provider response', async () => {
    const secret = 'webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            order_id: 'order_123',
            amount: 10000,
            notes: { student_email: 'student@example.com' }
          }
        }
      }
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
    const supabase = new MockSupabase();
    supabase.admin.persistResult = { data: null, error: null };
    const service = new RazorpayWebhookService(
      new MockConfigService({
        RAZORPAY_WEBHOOK_SECRET: secret,
        RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED: true,
        RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED: true
      }) as never,
      supabase as never
    );

    await expect(service.verifyParseAndMaybePersist(rawBody, signature, payload)).resolves.toMatchObject({
      persistenceExecution: {
        enabled: true,
        attempted: true,
        status: 'duplicate',
        eventId: 'payment.captured:pay_123'
      },
      paymentOrderTransitionExecution: {
        enabled: true,
        attempted: false,
        status: 'skipped',
        orderId: 'order_123',
        paymentId: 'pay_123'
      },
      webhookEventStatusExecution: {
        enabled: true,
        attempted: false,
        status: 'skipped',
        eventId: 'payment.captured:pay_123'
      },
      activationTriggerDecision: {
        shouldAttemptActivation: false,
        trigger: 'razorpay_webhook',
        reason: 'webhook_not_newly_persisted',
        orderId: 'order_123',
        paymentId: 'pay_123'
      }
    });
    expect(supabase.admin.lastPaymentOrderQuery).toBeUndefined();
    expect(supabase.admin.lastWebhookStatusQuery).toBeUndefined();
  });
});
