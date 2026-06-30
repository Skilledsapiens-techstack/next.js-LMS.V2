import { User } from '@supabase/supabase-js';
import { StudentPaidAccessService } from './student-paid-access.service';

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

describe('StudentPaidAccessService', () => {
  let supabase: MockSupabase;
  let studentsService: MockStudentsService;
  let service: StudentPaidAccessService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-26T00:00:00.000Z'));
    supabase = new MockSupabase();
    studentsService = new MockStudentsService();
    service = new StudentPaidAccessService(supabase as never, studentsService as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists only the authenticated student paid access records with bounded pagination', async () => {
    supabase.admin.paidAccessResult = {
      data: [
        {
          id: 'paid-access-uuid',
          access_id: 'PA-20260626-0001',
          student_email: 'student@example.com',
          item_type: 'group',
          item_id: 'group-1',
          status: 'active',
          source: 'razorpay',
          payment_id: 'pay_123',
          amount: '999',
          currency: 'INR',
          granted_at: '2026-06-25T00:00:00.000Z',
          expires_at: '2026-07-25T00:00:00.000Z',
          notes: 'should-not-be-selected'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listMyPaidAccess(createUser(), { page: 1, limit: 25, status: 'all', itemType: 'all' });

    expect(result.items[0]).toEqual({
      id: 'paid-access-uuid',
      accessId: 'PA-20260626-0001',
      itemType: 'group',
      itemId: 'group-1',
      status: 'active',
      activeNow: true,
      source: 'razorpay',
      paymentId: 'pay_123',
      amount: 999,
      currency: 'INR',
      grantedAt: '2026-06-25T00:00:00.000Z',
      expiresAt: '2026-07-25T00:00:00.000Z'
    });
    expect(result.items[0]).not.toHaveProperty('studentEmail');
    expect(result.items[0]).not.toHaveProperty('notes');
    expect(supabase.admin.lastPaidAccessQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'order', args: ['granted_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastPaidAccessQuery?.filters[0]?.args[0]).not.toContain('notes');
  });

  it('marks expired active records as not active now', async () => {
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
          expires_at: '2026-06-25T00:00:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listMyPaidAccess(createUser(), { page: 1, limit: 25, status: 'all', itemType: 'all' });

    expect(result.items[0]).toMatchObject({
      id: 'PA-20260601-0001',
      activeNow: false
    });
  });

  it('applies student-safe status, item type, and search filters', async () => {
    await service.listMyPaidAccess(createUser(), {
      page: 2,
      limit: 10,
      status: 'active',
      itemType: 'workshop',
      search: ' Workshop Access '
    });

    expect(supabase.admin.lastPaidAccessQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['student_email', 'student@example.com'] },
        { method: 'eq', args: ['status', 'active'] },
        { method: 'eq', args: ['item_type', 'workshop'] },
        {
          method: 'or',
          args: [['access_id.ilike.%workshop access%', 'item_id.ilike.%workshop access%', 'payment_id.ilike.%workshop access%'].join(',')]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });
});
