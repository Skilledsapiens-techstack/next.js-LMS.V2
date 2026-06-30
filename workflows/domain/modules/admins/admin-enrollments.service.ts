import { NotFoundException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  AdminEnrollmentExceptionListItemDto,
  AdminEnrollmentExceptionsQueryDto,
  AdminEnrollmentExceptionStatus,
  AdminEnrollmentPaymentStatus,
  AdminEnrollmentRequestDetailDto,
  AdminEnrollmentRequestItemDto,
  AdminEnrollmentRequestItemType,
  AdminEnrollmentRequestListItemDto,
  AdminEnrollmentRequestsQueryDto,
  AdminEnrollmentStatusHistoryDto,
  AdminEnrollmentWebhookEventListItemDto,
  AdminEnrollmentWebhookEventsQueryDto,
  AdminEnrollmentWebhookEventStatus,
  AdminEnrollmentRequestType
 } from './dto/admin-enrollments.dto';

type AdminEnrollmentRequestRow = {
  id: string;
  request_id: string;
  student_name: string | null;
  email: string | null;
  phone: string | null;
  college_name: string | null;
  career_level: string | null;
  personal_mentor: string | null;
  request_type: AdminEnrollmentRequestType;
  payment_status: AdminEnrollmentPaymentStatus;
  payment_id: string | null;
  order_id: string | null;
  amount_paid: number | string | null;
  currency: string | null;
  payment_date: string | null;
  exception_count: number | null;
  activated_student_id: string | null;
  activated_at: string | null;
  activated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminEnrollmentRequestItemRow = {
  id: string;
  item_id: string;
  request_id: string;
  item_name: string;
  item_type: AdminEnrollmentRequestItemType;
  program_key: string | null;
  role_id: string | null;
  selection_order: number | string;
  assigned_cohort_id: string | null;
  assigned_cohort_name: string | null;
  alias_source: string | null;
  mapping_confidence: number | null;
  status: AdminEnrollmentPaymentStatus;
  assigned_at: string | null;
  assigned_by: string | null;
  activated_at: string | null;
  activated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminEnrollmentStatusHistoryRow = {
  id: string;
  request_id: string;
  item_id: string | null;
  previous_status: string | null;
  new_status: string;
  actor_email: string | null;
  notes: string | null;
  field_name: string | null;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
};

type AdminEnrollmentExceptionRow = {
  id: string;
  exception_id: string;
  request_id: string | null;
  item_id: string | null;
  payment_id: string | null;
  student_email: string | null;
  student_name: string | null;
  exception_type: string;
  error_message: string;
  raw_value: string | null;
  suggested_program_key: string | null;
  status: AdminEnrollmentExceptionStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminEnrollmentWebhookEventRow = {
  id: string;
  event_id: string;
  event_type: string | null;
  payment_id: string | null;
  order_id: string | null;
  request_id: string | null;
  status: AdminEnrollmentWebhookEventStatus;
  error_message: string | null;
  processed_at: string | null;
  created_at: string | null;
};
export class AdminEnrollmentsService {
  private readonly itemLimit = 100;
  private readonly historyLimit = 100;

  constructor(private readonly supabase: SupabaseService) {}

  async listEnrollmentRequests(query: AdminEnrollmentRequestsQueryDto): Promise<PaginatedResponse<AdminEnrollmentRequestListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('enrollment_requests')
      .select(
        [
          'id',
          'request_id',
          'student_name',
          'email',
          'phone',
          'college_name',
          'career_level',
          'personal_mentor',
          'request_type',
          'payment_status',
          'payment_id',
          'order_id',
          'amount_paid',
          'currency',
          'payment_date',
          'exception_count',
          'activated_student_id',
          'activated_at',
          'activated_by',
          'created_at',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('payment_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.paymentStatus !== 'all') {
      request = request.eq('payment_status', query.paymentStatus);
   }

    if (query.requestType !== 'all') {
      request = request.eq('request_type', query.requestType);
   }

    if (query.careerLevel) {
      request = request.eq('career_level', query.careerLevel);
   }

    if (query.personalMentor) {
      request = request.eq('personal_mentor', query.personalMentor);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `request_id.ilike.%${escapedSearch}%`,
          `student_name.ilike.%${escapedSearch}%`,
          `email.ilike.%${escapedSearch}%`,
          `phone.ilike.%${escapedSearch}%`,
          `payment_id.ilike.%${escapedSearch}%`,
          `order_id.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load enrollment requests: ${error.message}`);
   }

    return createPaginatedResponse(this.asEnrollmentRequestRows(data).map((row) => this.toEnrollmentRequestListItem(row)), page, limit, count ?? 0);
 }

  async getEnrollmentRequestDetail(requestId: string): Promise<AdminEnrollmentRequestDetailDto> {
    const { data: requestData, error: requestError } = await this.supabase.admin
      .from('enrollment_requests')
      .select(
        [
          'id',
          'request_id',
          'student_name',
          'email',
          'phone',
          'college_name',
          'career_level',
          'personal_mentor',
          'request_type',
          'payment_status',
          'payment_id',
          'order_id',
          'amount_paid',
          'currency',
          'payment_date',
          'exception_count',
          'activated_student_id',
          'activated_at',
          'activated_by',
          'created_at',
          'updated_at'
        ].join(',')
      )
      .eq('request_id', requestId)
      .single();

    if (requestError) {
      if (requestError.code === 'PGRST116') {
        throw new NotFoundException('Enrollment request was not found.');
     }
      throw new ServiceUnavailableException(`Unable to load enrollment request: ${requestError.message}`);
   }

    const [request] = this.asEnrollmentRequestRows([requestData]);
    if (!request) {
      throw new NotFoundException('Enrollment request was not found.');
   }

    const [itemsResult, historyResult] = await Promise.all([
      this.supabase.admin
        .from('enrollment_request_items')
        .select(
          [
            'id',
            'item_id',
            'request_id',
            'item_name',
            'item_type',
            'program_key',
            'role_id',
            'selection_order',
            'assigned_cohort_id',
            'assigned_cohort_name',
            'alias_source',
            'mapping_confidence',
            'status',
            'assigned_at',
            'assigned_by',
            'activated_at',
            'activated_by',
            'created_at',
            'updated_at'
          ].join(',')
        )
        .eq('request_id', request.request_id)
        .order('selection_order', { ascending: true })
        .limit(this.itemLimit + 1),
      this.supabase.admin
        .from('enrollment_status_history')
        .select(['id', 'request_id', 'item_id', 'previous_status', 'new_status', 'actor_email', 'notes', 'field_name', 'changed_by', 'reason', 'created_at'].join(','))
        .eq('request_id', request.request_id)
        .order('created_at', { ascending: true })
        .limit(this.historyLimit + 1)
    ]);

    if (itemsResult.error) {
      throw new ServiceUnavailableException(`Unable to load enrollment request items: ${itemsResult.error.message}`);
   }

    if (historyResult.error) {
      throw new ServiceUnavailableException(`Unable to load enrollment status history: ${historyResult.error.message}`);
   }

    const items = this.asEnrollmentRequestItemRows(itemsResult.data).map((row) => this.toEnrollmentRequestItem(row));
    const history = this.asEnrollmentStatusHistoryRows(historyResult.data).map((row) => this.toEnrollmentStatusHistory(row));

    return {
      request: this.toEnrollmentRequestListItem(request),
      items: items.slice(0, this.itemLimit),
      history: history.slice(0, this.historyLimit),
      itemLimit: this.itemLimit,
      historyLimit: this.historyLimit,
      hasMoreItems: items.length > this.itemLimit,
      hasMoreHistory: history.length > this.historyLimit
   };
 }

  async listEnrollmentExceptions(query: AdminEnrollmentExceptionsQueryDto): Promise<PaginatedResponse<AdminEnrollmentExceptionListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('enrollment_exceptions')
      .select(
        [
          'id',
          'exception_id',
          'request_id',
          'item_id',
          'payment_id',
          'student_email',
          'student_name',
          'exception_type',
          'error_message',
          'raw_value',
          'suggested_program_key',
          'status',
          'resolved_by',
          'resolved_at',
          'resolution_notes',
          'created_at',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.exceptionType) {
      request = request.eq('exception_type', query.exceptionType);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `exception_id.ilike.%${escapedSearch}%`,
          `request_id.ilike.%${escapedSearch}%`,
          `student_email.ilike.%${escapedSearch}%`,
          `student_name.ilike.%${escapedSearch}%`,
          `payment_id.ilike.%${escapedSearch}%`,
          `error_message.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load enrollment exceptions: ${error.message}`);
   }

    return createPaginatedResponse(this.asEnrollmentExceptionRows(data).map((row) => this.toEnrollmentExceptionListItem(row)), page, limit, count ?? 0);
 }

  async listEnrollmentWebhookEvents(query: AdminEnrollmentWebhookEventsQueryDto): Promise<PaginatedResponse<AdminEnrollmentWebhookEventListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('enrollment_webhook_events')
      .select(['id', 'event_id', 'event_type', 'payment_id', 'order_id', 'request_id', 'status', 'error_message', 'processed_at', 'created_at'].join(','), { count: 'exact' })
      .order('processed_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `event_id.ilike.%${escapedSearch}%`,
          `event_type.ilike.%${escapedSearch}%`,
          `payment_id.ilike.%${escapedSearch}%`,
          `order_id.ilike.%${escapedSearch}%`,
          `request_id.ilike.%${escapedSearch}%`,
          `error_message.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load enrollment webhook events: ${error.message}`);
   }

    return createPaginatedResponse(this.asEnrollmentWebhookEventRows(data).map((row) => this.toEnrollmentWebhookEventListItem(row)), page, limit, count ?? 0);
 }

  private asEnrollmentRequestRows(value: unknown): AdminEnrollmentRequestRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminEnrollmentRequestRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.request_id === 'string' &&
        this.isRequestType(row.request_type) &&
        this.isPaymentStatus(row.payment_status) &&
        (row.amount_paid === null || this.isNumericValue(row.amount_paid))
      );
   });
 }

  private toEnrollmentRequestListItem(row: AdminEnrollmentRequestRow): AdminEnrollmentRequestListItemDto {
    return {
      id: row.id,
      requestId: row.request_id,
      studentName: row.student_name ?? undefined,
      email: row.email ? this.normalizeEmail(row.email) : undefined,
      phone: row.phone ?? undefined,
      collegeName: row.college_name ?? undefined,
      careerLevel: row.career_level ?? undefined,
      personalMentor: row.personal_mentor ?? undefined,
      requestType: row.request_type,
      paymentStatus: row.payment_status,
      paymentId: row.payment_id ?? undefined,
      orderId: row.order_id ?? undefined,
      amountPaid: row.amount_paid === null ? undefined : this.toOptionalNumber(row.amount_paid),
      currency: row.currency ?? undefined,
      paymentDate: row.payment_date ?? undefined,
      exceptionCount: row.exception_count ?? 0,
      activatedStudentId: row.activated_student_id ?? undefined,
      activatedAt: row.activated_at ?? undefined,
      activatedBy: row.activated_by ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private asEnrollmentRequestItemRows(value: unknown): AdminEnrollmentRequestItemRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminEnrollmentRequestItemRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.item_id === 'string' &&
        typeof row.request_id === 'string' &&
        typeof row.item_name === 'string' &&
        this.isRequestItemType(row.item_type) &&
        this.isNumericValue(row.selection_order) &&
        this.isPaymentStatus(row.status)
      );
   });
 }

  private toEnrollmentRequestItem(row: AdminEnrollmentRequestItemRow): AdminEnrollmentRequestItemDto {
    return {
      id: row.id,
      itemId: row.item_id,
      requestId: row.request_id,
      itemName: row.item_name,
      itemType: row.item_type,
      programKey: row.program_key ?? undefined,
      roleId: row.role_id ?? undefined,
      selectionOrder: this.toOptionalNumber(row.selection_order) ?? 0,
      assignedCohortId: row.assigned_cohort_id ?? undefined,
      assignedCohortName: row.assigned_cohort_name ?? undefined,
      aliasSource: row.alias_source ?? undefined,
      mappingConfidence: row.mapping_confidence ?? undefined,
      status: row.status,
      assignedAt: row.assigned_at ?? undefined,
      assignedBy: row.assigned_by ?? undefined,
      activatedAt: row.activated_at ?? undefined,
      activatedBy: row.activated_by ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private asEnrollmentStatusHistoryRows(value: unknown): AdminEnrollmentStatusHistoryRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminEnrollmentStatusHistoryRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && typeof row.request_id === 'string' && typeof row.new_status === 'string' && typeof row.created_at === 'string';
   });
 }

  private toEnrollmentStatusHistory(row: AdminEnrollmentStatusHistoryRow): AdminEnrollmentStatusHistoryDto {
    return {
      id: row.id,
      requestId: row.request_id,
      itemId: row.item_id ?? undefined,
      previousStatus: row.previous_status ?? undefined,
      newStatus: row.new_status,
      actorEmail: row.actor_email ? this.normalizeEmail(row.actor_email) : undefined,
      notes: row.notes ?? undefined,
      fieldName: row.field_name ?? undefined,
      changedBy: row.changed_by ?? undefined,
      reason: row.reason ?? undefined,
      createdAt: row.created_at
   };
 }

  private asEnrollmentExceptionRows(value: unknown): AdminEnrollmentExceptionRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminEnrollmentExceptionRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.exception_id === 'string' &&
        typeof row.exception_type === 'string' &&
        typeof row.error_message === 'string' &&
        this.isExceptionStatus(row.status)
      );
   });
 }

  private toEnrollmentExceptionListItem(row: AdminEnrollmentExceptionRow): AdminEnrollmentExceptionListItemDto {
    return {
      id: row.id,
      exceptionId: row.exception_id,
      requestId: row.request_id ?? undefined,
      itemId: row.item_id ?? undefined,
      paymentId: row.payment_id ?? undefined,
      studentEmail: row.student_email ? this.normalizeEmail(row.student_email) : undefined,
      studentName: row.student_name ?? undefined,
      exceptionType: row.exception_type,
      errorMessage: row.error_message,
      rawValue: row.raw_value ?? undefined,
      suggestedProgramKey: row.suggested_program_key ?? undefined,
      status: row.status,
      resolvedBy: row.resolved_by ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      resolutionNotes: row.resolution_notes ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private asEnrollmentWebhookEventRows(value: unknown): AdminEnrollmentWebhookEventRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminEnrollmentWebhookEventRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && typeof row.event_id === 'string' && this.isWebhookEventStatus(row.status);
   });
 }

  private toEnrollmentWebhookEventListItem(row: AdminEnrollmentWebhookEventRow): AdminEnrollmentWebhookEventListItemDto {
    return {
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type ?? undefined,
      paymentId: row.payment_id ?? undefined,
      orderId: row.order_id ?? undefined,
      requestId: row.request_id ?? undefined,
      status: row.status,
      errorMessage: row.error_message ?? undefined,
      processedAt: row.processed_at ?? undefined,
      createdAt: row.created_at ?? undefined
   };
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private toOptionalNumber(value: number | string): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isNumericValue(value: unknown): value is number | string {
    if (typeof value !== 'number' && typeof value !== 'string') return false;
    return this.toOptionalNumber(value) !== undefined;
 }

  private isRequestType(value: unknown): value is AdminEnrollmentRequestType {
    return value === 'razorpay' || value === 'manual';
 }

  private isRequestItemType(value: unknown): value is AdminEnrollmentRequestItemType {
    return value === 'program' || value === 'role';
 }

  private isExceptionStatus(value: unknown): value is AdminEnrollmentExceptionStatus {
    return value === 'open' || value === 'resolved' || value === 'approved' || value === 'rejected';
 }

  private isWebhookEventStatus(value: unknown): value is AdminEnrollmentWebhookEventStatus {
    return (
      value === 'received' ||
      value === 'processed' ||
      value === 'processed_with_exceptions' ||
      value === 'duplicate' ||
      value === 'invalid_signature' ||
      value === 'skipped_failed' ||
      value === 'skipped_refunded' ||
      value === 'skipped_pending_payment' ||
      value === 'failed'
    );
 }

  private isPaymentStatus(value: unknown): value is AdminEnrollmentPaymentStatus {
    return (
      value === 'pending_payment' ||
      value === 'paid' ||
      value === 'payment_received' ||
      value === 'pending_review' ||
      value === 'approved' ||
      value === 'cohort_assigned' ||
      value === 'activated' ||
      value === 'completed' ||
      value === 'rejected' ||
      value === 'duplicate' ||
      value === 'on_hold' ||
      value === 'refunded' ||
      value === 'exception'
    );
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
