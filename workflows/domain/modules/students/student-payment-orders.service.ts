import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { StudentPaymentItemType, StudentPaymentOrderListItemDto, StudentPaymentOrdersQueryDto, StudentPaymentOrderStatus } from './dto/student-payment-orders.dto';
import { StudentsService } from './students.service';

type StudentPaymentOrderRow = {
  id: string;
  order_id: string | null;
  student_email: string;
  item_type: StudentPaymentItemType;
  item_id: string;
  item_title: string | null;
  amount: number | string;
  currency: string;
  status: StudentPaymentOrderStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  receipt: string | null;
  created_at: string | null;
  updated_at: string | null;
};
export class StudentPaymentOrdersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyPaymentOrders(user: User, query: StudentPaymentOrdersQueryDto): Promise<PaginatedResponse<StudentPaymentOrderListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('payment_orders')
      .select(
        [
          'id',
          'order_id',
          'student_email',
          'item_type',
          'item_id',
          'item_title',
          'amount',
          'currency',
          'status',
          'razorpay_order_id',
          'razorpay_payment_id',
          'receipt',
          'created_at',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .eq('student_email', studentEmail)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.itemType !== 'all') {
      request = request.eq('item_type', query.itemType);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `order_id.ilike.%${escapedSearch}%`,
          `item_id.ilike.%${escapedSearch}%`,
          `item_title.ilike.%${escapedSearch}%`,
          `razorpay_order_id.ilike.%${escapedSearch}%`,
          `razorpay_payment_id.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your payment orders: ${error.message}`);
   }

    return createPaginatedResponse(this.asStudentPaymentOrderRows(data).map((row) => this.toStudentPaymentOrderListItem(row)), page, limit, count ?? 0);
 }

  private asStudentPaymentOrderRows(value: unknown): StudentPaymentOrderRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is StudentPaymentOrderRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.student_email === 'string' &&
        this.isItemType(row.item_type) &&
        typeof row.item_id === 'string' &&
        this.isNumericValue(row.amount) &&
        typeof row.currency === 'string' &&
        this.isStatus(row.status)
      );
   });
 }

  private toStudentPaymentOrderListItem(row: StudentPaymentOrderRow): StudentPaymentOrderListItemDto {
    return {
      id: row.id,
      orderId: row.order_id ?? undefined,
      itemType: row.item_type,
      itemId: row.item_id,
      itemTitle: row.item_title ?? undefined,
      amount: this.toOptionalNumber(row.amount) ?? 0,
      currency: row.currency,
      status: row.status,
      razorpayOrderId: row.razorpay_order_id ?? undefined,
      razorpayPaymentId: row.razorpay_payment_id ?? undefined,
      receipt: row.receipt ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
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

  private isStatus(value: unknown): value is StudentPaymentOrderStatus {
    return value === 'created' || value === 'paid' || value === 'failed' || value === 'cancelled';
 }

  private isItemType(value: unknown): value is StudentPaymentItemType {
    return value === 'group' || value === 'workshop' || value === 'resource';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
