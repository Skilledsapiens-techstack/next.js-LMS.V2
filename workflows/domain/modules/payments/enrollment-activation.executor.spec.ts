import { EnrollmentActivationExecutor } from './enrollment-activation.executor';
import { createEnrollmentActivationPlan, EnrollmentActivationRequest, EnrollmentActivationRequestItem } from './enrollment-activation-plan';

class MockConfigService {
  constructor(private readonly values: Record<string, boolean | undefined>) {}

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

type QueryResult = { data: unknown; error: { message: string } | null };

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: QueryResult) {}

  upsert(...args: unknown[]) {
    this.calls.push({ method: 'upsert', args });
    return this;
  }

  update(...args: unknown[]) {
    this.calls.push({ method: 'update', args });
    return this;
  }

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args });
    return this;
  }

  maybeSingle() {
    this.calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(this.result);
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
  }

  in(...args: unknown[]) {
    this.calls.push({ method: 'in', args });
    return Promise.resolve(this.result);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

class MockSupabaseAdmin {
  queries: Array<{ table: string; query: MockQuery }> = [];
  tableResults = new Map<string, QueryResult>();

  from(table: string) {
    const query = new MockQuery(this.tableResults.get(table) ?? { data: {}, error: null });
    this.queries.push({ table, query });
    return query;
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

const readyRequest: EnrollmentActivationRequest = {
  requestId: 'enr_123',
  email: 'student@example.com',
  studentName: 'Student Name',
  phone: '+919999999999',
  paymentStatus: 'cohort_assigned'
};

const readyItems: EnrollmentActivationRequestItem[] = [
  {
    itemId: 'item_program',
    itemType: 'program',
    itemName: 'MBA Launchpad',
    programKey: 'mba',
    assignedCohortId: 'cohort-uuid',
    assignedCohortName: 'MBA June',
    status: 'cohort_assigned'
  },
  {
    itemId: 'item_role',
    itemType: 'role',
    itemName: 'Marketing Role',
    programKey: 'mba',
    roleId: 'marketing',
    assignedCohortId: 'cohort-uuid',
    assignedCohortName: 'MBA June',
    status: 'approved'
  }
];

function readyPlan() {
  return createEnrollmentActivationPlan({ status: 'paid', orderId: 'order_123', paymentId: 'pay_123' }, readyRequest, readyItems);
}

describe('EnrollmentActivationExecutor', () => {
  it('does not call Supabase when activation is disabled', async () => {
    const supabase = new MockSupabase();
    const executor = new EnrollmentActivationExecutor(new MockConfigService({ ENROLLMENT_ACTIVATION_ENABLED: false }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: false,
      attempted: false,
      status: 'disabled',
      requestId: 'enr_123',
      message: 'Enrollment activation is disabled. No Supabase write was attempted.',
      completedSteps: []
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('skips unsafe activation plans without Supabase writes', async () => {
    const supabase = new MockSupabase();
    const executor = new EnrollmentActivationExecutor(new MockConfigService({ ENROLLMENT_ACTIVATION_ENABLED: true }) as never, supabase as never);
    const plan = createEnrollmentActivationPlan({ status: 'failed' }, readyRequest, readyItems);

    await expect(executor.execute(plan)).resolves.toMatchObject({
      enabled: true,
      attempted: false,
      status: 'skipped',
      requestId: 'enr_123',
      message: 'Enrollment activation skipped: payment_not_paid.'
    });
    expect(supabase.admin.queries).toEqual([]);
  });

  it('runs the idempotent activation write sequence when enabled', async () => {
    const supabase = new MockSupabase();
    const executor = new EnrollmentActivationExecutor(new MockConfigService({ ENROLLMENT_ACTIVATION_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toMatchObject({
      enabled: true,
      attempted: true,
      status: 'activated',
      requestId: 'enr_123',
      completedSteps: [
        'students',
        'student_programs',
        'student_cohorts',
        'paid_access',
        'enrollment_request_items',
        'enrollment_requests',
        'enrollment_status_history',
        'audit_logs'
      ]
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual([
      'students',
      'student_programs',
      'student_cohorts',
      'paid_access',
      'enrollment_request_items',
      'enrollment_requests',
      'enrollment_status_history',
      'audit_logs'
    ]);
    expect(supabase.admin.queries[0]?.query.calls).toEqual(
      expect.arrayContaining([
        {
          method: 'upsert',
          args: [
            expect.objectContaining({
              email: 'student@example.com',
              full_name: 'Student Name',
              active: true
            }),
            { onConflict: 'email' }
          ]
        },
        { method: 'select', args: ['id,email'] },
        { method: 'maybeSingle', args: [] }
      ])
    );
    expect(supabase.admin.queries[3]?.query.calls[0]).toEqual({
      method: 'upsert',
      args: [
        expect.arrayContaining([
          expect.objectContaining({
            access_id: 'paid_access:student@example.com:program:mba',
            student_email: 'student@example.com',
            status: 'active'
          })
        ]),
        { onConflict: 'access_id' }
      ]
    });
  });

  it('stops at the failed activation step and reports completed steps', async () => {
    const supabase = new MockSupabase();
    supabase.admin.tableResults.set('paid_access', { data: null, error: { message: 'paid access write failed' } });
    const executor = new EnrollmentActivationExecutor(new MockConfigService({ ENROLLMENT_ACTIVATION_ENABLED: true }) as never, supabase as never);

    await expect(executor.execute(readyPlan())).resolves.toEqual({
      enabled: true,
      attempted: true,
      status: 'failed',
      requestId: 'enr_123',
      message: 'paid access write failed',
      completedSteps: ['students', 'student_programs', 'student_cohorts'],
      failedStep: 'paid_access'
    });
    expect(supabase.admin.queries.map((entry) => entry.table)).toEqual(['students', 'student_programs', 'student_cohorts', 'paid_access']);
  });
});
