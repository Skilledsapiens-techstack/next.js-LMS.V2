import { AdminEnrollmentsService } from './admin-enrollments.service';

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

class MockEnrollmentRequestsQuery {
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

  single() {
    this.filters.push({ method: 'single', args: [] });
    return this;
  }

  limit(...args: unknown[]) {
    this.filters.push({ method: 'limit', args });
    return this;
  }

  then(resolve: (value: QueryResult) => void) {
    resolve(this.result);
  }
}

class MockSupabaseAdmin {
  enrollmentRequestsResult: QueryResult = { data: [], error: null, count: 0 };
  enrollmentRequestItemsResult: QueryResult = { data: [], error: null, count: 0 };
  enrollmentStatusHistoryResult: QueryResult = { data: [], error: null, count: 0 };
  enrollmentExceptionsResult: QueryResult = { data: [], error: null, count: 0 };
  enrollmentWebhookEventsResult: QueryResult = { data: [], error: null, count: 0 };
  lastEnrollmentRequestsQuery?: MockEnrollmentRequestsQuery;
  lastEnrollmentRequestItemsQuery?: MockEnrollmentRequestsQuery;
  lastEnrollmentStatusHistoryQuery?: MockEnrollmentRequestsQuery;
  lastEnrollmentExceptionsQuery?: MockEnrollmentRequestsQuery;
  lastEnrollmentWebhookEventsQuery?: MockEnrollmentRequestsQuery;

  from(tableName: string) {
    if (tableName === 'enrollment_requests') {
      this.lastEnrollmentRequestsQuery = new MockEnrollmentRequestsQuery(this.enrollmentRequestsResult);
      return this.lastEnrollmentRequestsQuery;
    }

    if (tableName === 'enrollment_request_items') {
      this.lastEnrollmentRequestItemsQuery = new MockEnrollmentRequestsQuery(this.enrollmentRequestItemsResult);
      return this.lastEnrollmentRequestItemsQuery;
    }

    if (tableName === 'enrollment_status_history') {
      this.lastEnrollmentStatusHistoryQuery = new MockEnrollmentRequestsQuery(this.enrollmentStatusHistoryResult);
      return this.lastEnrollmentStatusHistoryQuery;
    }

    if (tableName === 'enrollment_exceptions') {
      this.lastEnrollmentExceptionsQuery = new MockEnrollmentRequestsQuery(this.enrollmentExceptionsResult);
      return this.lastEnrollmentExceptionsQuery;
    }

    if (tableName === 'enrollment_webhook_events') {
      this.lastEnrollmentWebhookEventsQuery = new MockEnrollmentRequestsQuery(this.enrollmentWebhookEventsResult);
      return this.lastEnrollmentWebhookEventsQuery;
    }

    throw new Error(`Unexpected table: ${tableName}`);
  }
}

class MockSupabase {
  admin = new MockSupabaseAdmin();
}

describe('AdminEnrollmentsService', () => {
  let supabase: MockSupabase;
  let service: AdminEnrollmentsService;

  beforeEach(() => {
    supabase = new MockSupabase();
    service = new AdminEnrollmentsService(supabase as never);
  });

  it('lists enrollment requests with bounded pagination metadata', async () => {
    supabase.admin.enrollmentRequestsResult = {
      data: [
        {
          id: 'enrollment-uuid',
          request_id: 'ENR-20260626-0001',
          student_name: 'Student One',
          email: ' Student@Example.com ',
          phone: '9999999999',
          college_name: 'College',
          career_level: 'Student',
          personal_mentor: 'Mentor One',
          request_type: 'razorpay',
          payment_status: 'payment_received',
          payment_id: 'pay_123',
          order_id: 'order_123',
          amount_paid: '2500',
          currency: 'INR',
          payment_date: '2026-06-26T01:00:00.000Z',
          exception_count: 1,
          activated_student_id: null,
          activated_at: null,
          activated_by: null,
          created_at: '2026-06-26T00:00:00.000Z',
          updated_at: '2026-06-26T02:00:00.000Z',
          raw_payload: { secret: 'should-not-be-selected' },
          custom_fields: { private: 'should-not-be-selected' }
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listEnrollmentRequests({ page: 1, limit: 25, paymentStatus: 'all', requestType: 'all' });

    expect(result.items[0]).toEqual({
      id: 'enrollment-uuid',
      requestId: 'ENR-20260626-0001',
      studentName: 'Student One',
      email: 'student@example.com',
      phone: '9999999999',
      collegeName: 'College',
      careerLevel: 'Student',
      personalMentor: 'Mentor One',
      requestType: 'razorpay',
      paymentStatus: 'payment_received',
      paymentId: 'pay_123',
      orderId: 'order_123',
      amountPaid: 2500,
      currency: 'INR',
      paymentDate: '2026-06-26T01:00:00.000Z',
      exceptionCount: 1,
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T02:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastEnrollmentRequestsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['payment_date', { ascending: false, nullsFirst: false }] },
        { method: 'order', args: ['created_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastEnrollmentRequestsQuery?.filters[0]?.args[0]).not.toContain('raw_payload');
    expect(supabase.admin.lastEnrollmentRequestsQuery?.filters[0]?.args[0]).not.toContain('custom_fields');
    expect(supabase.admin.lastEnrollmentRequestsQuery?.filters[0]?.args[0]).not.toContain('mapped_fields');
  });

  it('applies status, type, career, mentor, and normalized search filters', async () => {
    await service.listEnrollmentRequests({
      page: 2,
      limit: 10,
      paymentStatus: 'payment_received',
      requestType: 'razorpay',
      careerLevel: 'Student',
      personalMentor: 'Mentor One',
      search: ' Student Pay '
    });

    expect(supabase.admin.lastEnrollmentRequestsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['payment_status', 'payment_received'] },
        { method: 'eq', args: ['request_type', 'razorpay'] },
        { method: 'eq', args: ['career_level', 'Student'] },
        { method: 'eq', args: ['personal_mentor', 'Mentor One'] },
        {
          method: 'or',
          args: [
            [
              'request_id.ilike.%student pay%',
              'student_name.ilike.%student pay%',
              'email.ilike.%student pay%',
              'phone.ilike.%student pay%',
              'payment_id.ilike.%student pay%',
              'order_id.ilike.%student pay%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });

  it('loads enrollment request detail with bounded items and status history', async () => {
    supabase.admin.enrollmentRequestsResult = {
      data: {
        id: 'enrollment-uuid',
        request_id: 'ENR-20260626-0001',
        student_name: 'Student One',
        email: ' Student@Example.com ',
        phone: '9999999999',
        college_name: 'College',
        career_level: 'Student',
        personal_mentor: 'Mentor One',
        request_type: 'razorpay',
        payment_status: 'payment_received',
        payment_id: 'pay_123',
        order_id: 'order_123',
        amount_paid: '2500',
        currency: 'INR',
        payment_date: '2026-06-26T01:00:00.000Z',
        exception_count: 0,
        activated_student_id: null,
        activated_at: null,
        activated_by: null,
        created_at: '2026-06-26T00:00:00.000Z',
        updated_at: '2026-06-26T02:00:00.000Z',
        raw_payload: { secret: 'should-not-be-selected' }
      },
      error: null
    };
    supabase.admin.enrollmentRequestItemsResult = {
      data: [
        {
          id: 'item-uuid',
          item_id: 'ITEM-1',
          request_id: 'ENR-20260626-0001',
          item_name: 'Live Projects',
          item_type: 'program',
          program_key: 'live_projects',
          role_id: null,
          selection_order: '1',
          assigned_cohort_id: 'cohort-uuid',
          assigned_cohort_name: 'Cohort A',
          alias_source: 'checkout',
          mapping_confidence: 100,
          status: 'pending_review',
          assigned_at: null,
          assigned_by: null,
          activated_at: null,
          activated_by: null,
          created_at: '2026-06-26T00:05:00.000Z',
          updated_at: '2026-06-26T00:05:00.000Z',
          raw_payload: { secret: 'should-not-be-selected' }
        }
      ],
      error: null
    };
    supabase.admin.enrollmentStatusHistoryResult = {
      data: [
        {
          id: 'history-uuid',
          request_id: 'ENR-20260626-0001',
          item_id: 'ITEM-1',
          previous_status: null,
          new_status: 'payment_received',
          actor_email: ' Admin@Example.com ',
          notes: 'Payment received.',
          field_name: null,
          changed_by: 'system',
          reason: null,
          created_at: '2026-06-26T00:10:00.000Z',
          details: { secret: 'should-not-be-selected' }
        }
      ],
      error: null
    };

    const result = await service.getEnrollmentRequestDetail('ENR-20260626-0001');

    expect(result.request).toMatchObject({
      requestId: 'ENR-20260626-0001',
      email: 'student@example.com',
      paymentStatus: 'payment_received'
    });
    expect(result.items).toEqual([
      {
        id: 'item-uuid',
        itemId: 'ITEM-1',
        requestId: 'ENR-20260626-0001',
        itemName: 'Live Projects',
        itemType: 'program',
        programKey: 'live_projects',
        selectionOrder: 1,
        assignedCohortId: 'cohort-uuid',
        assignedCohortName: 'Cohort A',
        aliasSource: 'checkout',
        mappingConfidence: 100,
        status: 'pending_review',
        createdAt: '2026-06-26T00:05:00.000Z',
        updatedAt: '2026-06-26T00:05:00.000Z'
      }
    ]);
    expect(result.history).toEqual([
      {
        id: 'history-uuid',
        requestId: 'ENR-20260626-0001',
        itemId: 'ITEM-1',
        newStatus: 'payment_received',
        actorEmail: 'admin@example.com',
        notes: 'Payment received.',
        changedBy: 'system',
        createdAt: '2026-06-26T00:10:00.000Z'
      }
    ]);
    expect(result.itemLimit).toBe(100);
    expect(result.historyLimit).toBe(100);
    expect(result.hasMoreItems).toBe(false);
    expect(result.hasMoreHistory).toBe(false);
    expect(supabase.admin.lastEnrollmentRequestsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['request_id', 'ENR-20260626-0001'] },
        { method: 'single', args: [] }
      ])
    );
    expect(supabase.admin.lastEnrollmentRequestItemsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['request_id', 'ENR-20260626-0001'] },
        { method: 'order', args: ['selection_order', { ascending: true }] },
        { method: 'limit', args: [101] }
      ])
    );
    expect(supabase.admin.lastEnrollmentStatusHistoryQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['request_id', 'ENR-20260626-0001'] },
        { method: 'order', args: ['created_at', { ascending: true }] },
        { method: 'limit', args: [101] }
      ])
    );
    expect(supabase.admin.lastEnrollmentStatusHistoryQuery?.filters[0]?.args[0]).not.toContain('details');
  });

  it('marks enrollment detail when more items or history rows are available', async () => {
    supabase.admin.enrollmentRequestsResult = {
      data: {
        id: 'enrollment-uuid',
        request_id: 'ENR-20260626-0001',
        student_name: null,
        email: null,
        phone: null,
        college_name: null,
        career_level: null,
        personal_mentor: null,
        request_type: 'manual',
        payment_status: 'pending_review',
        payment_id: null,
        order_id: null,
        amount_paid: null,
        currency: null,
        payment_date: null,
        exception_count: null,
        activated_student_id: null,
        activated_at: null,
        activated_by: null,
        created_at: null,
        updated_at: null
      },
      error: null
    };
    supabase.admin.enrollmentRequestItemsResult = {
      data: Array.from({ length: 101 }, (_, index) => ({
        id: `item-${index}`,
        item_id: `ITEM-${index}`,
        request_id: 'ENR-20260626-0001',
        item_name: `Item ${index}`,
        item_type: 'program',
        program_key: null,
        role_id: null,
        selection_order: index + 1,
        assigned_cohort_id: null,
        assigned_cohort_name: null,
        alias_source: null,
        mapping_confidence: null,
        status: 'pending_review',
        assigned_at: null,
        assigned_by: null,
        activated_at: null,
        activated_by: null,
        created_at: null,
        updated_at: null
      })),
      error: null
    };
    supabase.admin.enrollmentStatusHistoryResult = {
      data: Array.from({ length: 101 }, (_, index) => ({
        id: `history-${index}`,
        request_id: 'ENR-20260626-0001',
        item_id: null,
        previous_status: null,
        new_status: 'pending_review',
        actor_email: null,
        notes: null,
        field_name: null,
        changed_by: null,
        reason: null,
        created_at: '2026-06-26T00:10:00.000Z'
      })),
      error: null
    };

    const result = await service.getEnrollmentRequestDetail('ENR-20260626-0001');

    expect(result.items).toHaveLength(100);
    expect(result.history).toHaveLength(100);
    expect(result.hasMoreItems).toBe(true);
    expect(result.hasMoreHistory).toBe(true);
  });

  it('lists enrollment exceptions with bounded pagination metadata', async () => {
    supabase.admin.enrollmentExceptionsResult = {
      data: [
        {
          id: 'exception-uuid',
          exception_id: 'EX-20260626-0001',
          request_id: 'ENR-20260626-0001',
          item_id: 'ITEM-1',
          payment_id: 'pay_123',
          student_email: ' Student@Example.com ',
          student_name: 'Student One',
          exception_type: 'program_mapping',
          error_message: 'Program could not be mapped.',
          raw_value: 'Unknown Program',
          suggested_program_key: 'live_projects',
          suggested_mapping: { secret: 'should-not-be-selected' },
          raw_payload: { secret: 'should-not-be-selected' },
          status: 'open',
          resolved_by: null,
          resolved_at: null,
          resolution_notes: null,
          created_at: '2026-06-26T00:00:00.000Z',
          updated_at: '2026-06-26T01:00:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listEnrollmentExceptions({ page: 1, limit: 25, status: 'all' });

    expect(result.items[0]).toEqual({
      id: 'exception-uuid',
      exceptionId: 'EX-20260626-0001',
      requestId: 'ENR-20260626-0001',
      itemId: 'ITEM-1',
      paymentId: 'pay_123',
      studentEmail: 'student@example.com',
      studentName: 'Student One',
      exceptionType: 'program_mapping',
      errorMessage: 'Program could not be mapped.',
      rawValue: 'Unknown Program',
      suggestedProgramKey: 'live_projects',
      status: 'open',
      createdAt: '2026-06-26T00:00:00.000Z',
      updatedAt: '2026-06-26T01:00:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastEnrollmentExceptionsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['created_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastEnrollmentExceptionsQuery?.filters[0]?.args[0]).not.toContain('suggested_mapping');
    expect(supabase.admin.lastEnrollmentExceptionsQuery?.filters[0]?.args[0]).not.toContain('raw_payload');
  });

  it('applies enrollment exception status, type, and normalized search filters', async () => {
    await service.listEnrollmentExceptions({
      page: 2,
      limit: 10,
      status: 'open',
      exceptionType: 'program_mapping',
      search: ' Student Exception '
    });

    expect(supabase.admin.lastEnrollmentExceptionsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'open'] },
        { method: 'eq', args: ['exception_type', 'program_mapping'] },
        {
          method: 'or',
          args: [
            [
              'exception_id.ilike.%student exception%',
              'request_id.ilike.%student exception%',
              'student_email.ilike.%student exception%',
              'student_name.ilike.%student exception%',
              'payment_id.ilike.%student exception%',
              'error_message.ilike.%student exception%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });

  it('lists enrollment webhook events with bounded pagination metadata and no payload exposure', async () => {
    supabase.admin.enrollmentWebhookEventsResult = {
      data: [
        {
          id: 'webhook-uuid',
          event_id: 'evt_123',
          event_type: 'payment.captured',
          payment_id: 'pay_123',
          order_id: 'order_123',
          request_id: 'ENR-20260626-0001',
          status: 'processed_with_exceptions',
          error_message: 'Program mapping needed.',
          payload: { secret: 'should-not-be-selected' },
          processed_at: '2026-06-26T00:30:00.000Z',
          created_at: '2026-06-26T00:29:00.000Z'
        }
      ],
      error: null,
      count: 1
    };

    const result = await service.listEnrollmentWebhookEvents({ page: 1, limit: 25, status: 'all' });

    expect(result.items[0]).toEqual({
      id: 'webhook-uuid',
      eventId: 'evt_123',
      eventType: 'payment.captured',
      paymentId: 'pay_123',
      orderId: 'order_123',
      requestId: 'ENR-20260626-0001',
      status: 'processed_with_exceptions',
      errorMessage: 'Program mapping needed.',
      processedAt: '2026-06-26T00:30:00.000Z',
      createdAt: '2026-06-26T00:29:00.000Z'
    });
    expect(result.total).toBe(1);
    expect(supabase.admin.lastEnrollmentWebhookEventsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'order', args: ['processed_at', { ascending: false, nullsFirst: false }] },
        { method: 'range', args: [0, 24] }
      ])
    );
    expect(supabase.admin.lastEnrollmentWebhookEventsQuery?.filters[0]?.args[0]).not.toContain('payload');
  });

  it('applies enrollment webhook event status and normalized search filters', async () => {
    await service.listEnrollmentWebhookEvents({
      page: 2,
      limit: 10,
      status: 'failed',
      search: ' Payment Failed '
    });

    expect(supabase.admin.lastEnrollmentWebhookEventsQuery?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['status', 'failed'] },
        {
          method: 'or',
          args: [
            [
              'event_id.ilike.%payment failed%',
              'event_type.ilike.%payment failed%',
              'payment_id.ilike.%payment failed%',
              'order_id.ilike.%payment failed%',
              'request_id.ilike.%payment failed%',
              'error_message.ilike.%payment failed%'
            ].join(',')
          ]
        },
        { method: 'range', args: [10, 19] }
      ])
    );
  });
});
