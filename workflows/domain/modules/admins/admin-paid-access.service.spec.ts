import { AdminPaidAccessService } from './admin-paid-access.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockPaidAccessQuery {
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
  paidAccessResult: QueryResult = { data: [], error: null, count: 0 };
  lastPaidAccessQuery?: MockPaidAccessQuery;

  from(tableName: string) {
    if (tableName !== 'paid_access') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    this.lastPaidAccessQuery = new MockPaidAccessQuery(this.paidAccessResult);
    return this.lastPaidAccessQuery;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminPaidAccessService', () => {
  let supabase: MockSupabase;
  let service: AdminPaidAccessService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-26T00:00:00.000Z'));
    supabase = new MockSupabase();
    service = new AdminPaidAccessService(supabase as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists paid access grants with bounded pagination metadata', async () => {
    supabase.admin.paidAccessResult = {
      data: [
        {
          id: 'paid-access-uuid',
          access_id: 'PA-20260626-0001',
          student_email: ' Student@Example.com ',
          item_type: 'group',
          item_id: 'group-1',
          status: 'active',
          source: 'manual',
          payment_id: 'pay_123',
          amount: '999',
          currency: 'INR',
          granted_at: '2026-06-25T00:00:00.000Z',
          expires_at: '2026-07-25T00:00:00.000Z',
          notes: 'Manual admin grant'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listPaidAccess({ page: 1, limit: 25, status: 'all', itemType: 'all' });

    expect(result.items[0]).toEqual({
      id: 'paid-access-uuid',
      accessId: 'PA-20260626-0001',
      studentEmail: 'student@example.com',
      itemType: 'group',
      itemId: 'group-1',
      status: 'active',
      activeNow: true,
      source: 'manual',
      paymentId: 'pay_123',
      amount: 999,
      currency: 'INR',
      grantedAt: '2026-06-25T00:00:00.000Z',
      expiresAt: '2026-07-25T00:00:00.000Z',
      notes: 'Manual admin grant'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastPaidAccessQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['granted_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
  });

  it('applies status, item type, and normalized search filters', async () => {
    await service.listPaidAccess({
      page: 2,
      limit: 10,
      status: 'active',
      itemType: 'resource',
      search: ' Student Grant '
    });

    expect(supabase.admin.lastPaidAccessQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'active'] },
        { method: 'eq', args: ['item_type', 'resource'] },
        {
          method: 'or',
          args: [
            [
              'access_id.ilike.%student grant%',
              'student_email.ilike.%student grant%',
              'item_id.ilike.%student grant%',
              'payment_id.ilike.%student grant%',
              'notes.ilike.%student grant%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });

  it('marks expired active grants as not active now', async () => {
    supabase.admin.paidAccessResult = {
      data: [
        {
          id: null,
          access_id: 'PA-20260601-0001',
          student_email: 'student@example.com',
          item_type: 'resource',
          item_id: 'resource-1',
          status: 'active',
          source: null,
          payment_id: null,
          amount: null,
          currency: null,
          granted_at: '2026-06-01T00:00:00.000Z',
          expires_at: '2026-06-25T00:00:00.000Z',
          notes: null
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listPaidAccess({ page: 1, limit: 25, status: 'all', itemType: 'all' });

    expect(result.items[0]).toMatchObject({
      id: 'PA-20260601-0001',
      activeNow: false
    });
  });
});
