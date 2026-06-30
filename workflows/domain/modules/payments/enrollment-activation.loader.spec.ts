import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { EnrollmentActivationLoader } from './enrollment-activation.loader';

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
 }

  limit(...args: unknown[]) {
    this.calls.push({ method: 'limit', args });
    return this;
 }

  or(...args: unknown[]) {
    this.calls.push({ method: 'or', args });
    return this;
 }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
 }

  order(...args: unknown[]) {
    this.calls.push({ method: 'order', args });
    return Promise.resolve(this.result);
 }

  maybeSingle() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.result);
 }
}

class MockSupabaseAdmin {
  results = new Map<string, QueryResult>([
    [
      'payment_orders',
      {
        data: {
          status: 'paid',
          order_id: 'order_internal',
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123'
       },
        error: null
     }
    ],
    [
      'enrollment_requests',
      {
        data: {
          request_id: 'enr_123',
          email: ' Student@Example.com ',
          student_name: 'Student Name',
          phone: '+919999999999',
          payment_status: 'cohort_assigned',
          activated_student_id: null
       },
        error: null
     }
    ],
    [
      'enrollment_request_items',
      {
        data: [
          {
            item_id: 'item_program',
            item_type: 'program',
            item_name: 'MBA Launchpad',
            program_key: 'mba',
            role_id: null,
            assigned_cohort_id: 'cohort-uuid',
            assigned_cohort_name: 'MBA June',
            status: 'cohort_assigned'
         }
        ],
        error: null
     }
    ]
  ]);
  queries: Array<{ table: string; query: MockQuery }> = [];

  from(table: string) {
    const query = new MockQuery(this.results.get(table) ?? { data: null, error: null });
    this.queries.push({ table, query });
    return query;
 }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('EnrollmentActivationLoader', () => {
  it('loads payment order, enrollment request, and request items into an activation plan', async () => {
    const supabase = new MockSupabase();
    const loader = new EnrollmentActivationLoader(supabase as never);

    await expect(loader.loadPlan({ orderId: 'order_123', paymentId: 'pay_123' })).resolves.toMatchObject({
      status: 'ready',
      message: 'Enrollment activation plan loaded.',
      plan: {
        shouldActivate: true,
        reason: 'ready',
        requestId: 'enr_123',
        normalizedEmail: 'student@example.com',
        studentProfile: {
          idempotencyKey: 'student:student@example.com'
       },
        paidAccessGrants: [
          {
            idempotencyKey: 'paid_access:student@example.com:program:mba'
         }
        ]
     }
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['payment_orders', 'enrollment_requests', 'enrollment_request_items']);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'limit', args: [1] },
        { method: 'or', args: ['order_id.eq.order_123,razorpay_order_id.eq.order_123,razorpay_payment_id.eq.pay_123'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
    expect(supabase.admin.queries[1]?.query.calls).toEqual(
      expect.arrayContaining([
        { method: 'limit', args: [1] },
        { method: 'or', args: ['order_id.eq.order_123,payment_id.eq.pay_123'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
 });

  it('returns not found without Supabase calls when payment identity is missing', async () => {
    const supabase = new MockSupabase();
    const loader = new EnrollmentActivationLoader(supabase as never);

    await expect(loader.loadPlan({})).resolves.toEqual({
      status: 'not_found',
      message: 'Payment order identity is required to load an enrollment activation plan.'
   });
    expect(supabase.admin.queries).toEqual([]);
 });

  it('returns not found when no enrollment request matches the payment order', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('enrollment_requests', { data: null, error: null });
    const loader = new EnrollmentActivationLoader(supabase as never);

    await expect(loader.loadPlan({ orderId: 'order_123' })).resolves.toEqual({
      status: 'not_found',
      message: 'No enrollment request matched the paid payment order.'
   });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['payment_orders', 'enrollment_requests']);
 });

  it('throws service unavailable when source loading fails', async () => {
    const supabase = new MockSupabase();
    supabase.admin.results.set('payment_orders', { data: null, error: { message: 'payment query failed' } });
    const loader = new EnrollmentActivationLoader(supabase as never);

    await expect(loader.loadPlan({ paymentId: 'pay_123' })).rejects.toThrow(ServiceUnavailableException);
 });
});
