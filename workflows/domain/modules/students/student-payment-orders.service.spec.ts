import { User } from '@supabase/supabase-js';
import { StudentPaymentOrdersService } from './student-payment-orders.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockPaymentOrdersQuery {
  filters: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.filters.push({ method: 'select', args });
    return this;
  }

  order(...args: unknown[]) {
    this.filters.push({ method: 'order', args });
    return this;
  }

  range(...args: unknown[]) {
    this.filters.push({ method: 'range', args });
    return this;
  }

  eq(...args: unknown[]) {
    this.filters.push({ method: 'eq', args });
    return this;
  }

  or(...args: unknown[]) {
    this.filters.push({ method: 'or', args });
    return this;
  }

  then(resolve: (value: QueryResult) => void) {
    resolve(this.result);
  }
}

class MockSupabaseAdmin {
  paymentOrdersResult: QueryResult = { data: [], error: null, count: 0 };
  lastPaymentOrdersQuery?: MockPaymentOrdersQuery;

  from(tableName: string) {
    if (tableName !== 'payment_orders') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastPaymentOrdersQuery = new MockPaymentOrdersQuery(this.paymentOrdersResult);
    return this.lastPaymentOrdersQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

class MockStudentsService {
  getCurrentStudent = jest.fn().mockResolvedValue({
    id: 'student-uuid',
    fullName: 'Student One',
    email: ' Student@Example.com ',
    trackRoleIds: [],
    active: true
  });
}

function createUser(): User {
  return {
    id: 'auth-user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date('2026-06-26T00:00:00.000Z').toISOString(),
    email: 'student@example.com'
  };
}

describe('StudentPaymentOrdersService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentPaymentOrdersService;

  beforeEach(() => {
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentPaymentOrdersService(supabase as never, studentsService as never);
  });

  it('lists only the authenticated student payment orders with bounded pagination', async () => {
    supabase.admin.paymentOrdersResult = {
      data: [
        {
          id: 'order-uuid',
          order_id: 'PO-20260626-0001',
          student_email: 'student@example.com',
          item_type: 'resource',
          item_id: 'resource-1',
          item_title: 'Premium Resource',
          amount: '999',
          currency: 'INR',
          status: 'paid',
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          receipt: 'receipt-1',
          created_at: '2026-06-26T00:00:00.000Z',
          updated_at: '2026-06-26T01:00:00.000Z',
          razorpay_signature: 'should-not-be-selected'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listMyPaymentOrders(createUser(), { page: 1, limit: 25, status: 'all', itemType: 'all' });

    expect(result.items[0]).toEqual({
      id: 'order-uuid',
      orderId: 'PO-20260626-0001',
      itemType: 'resource',
      itemId: 'resource-1',
      itemTitle: 'Premium Resource',
      amount: 999,
      currency: 'INR',
      status: 'paid',
      razorpayOrderId: 'order_123',
      razorpayPaymentId: 'pay_123',
      receipt: 'receipt-1',
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T01:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty('studentEmail');
    expect(supabase.admin.lastPaymentOrdersQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'order', args: ['updated_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastPaymentOrdersQuery?.filters[0]?.args[0]).not.toContain('razorpay_signature');
  });

  it('applies student-safe status, item type, and search filters', async () => {
    await service.listMyPaymentOrders(createUser(), {
      page: 2,
      limit: 10,
      status: 'paid',
      itemType: 'resource',
      search: ' Premium Resource '
    });

    expect(supabase.admin.lastPaymentOrdersQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'eq', args: ['status', 'paid'] },
        { method: 'eq', args: ['item_type', 'resource'] },
        {
          method: 'or',
          args: [
            [
              'order_id.ilike.%premium resource%',
              'item_id.ilike.%premium resource%',
              'item_title.ilike.%premium resource%',
              'razorpay_order_id.ilike.%premium resource%',
              'razorpay_payment_id.ilike.%premium resource%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });
});
