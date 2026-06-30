import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createEnrollmentActivationPlan,
  EnrollmentActivationItemType,
  EnrollmentActivationPaymentOrder,
  EnrollmentActivationPaymentStatus,
  EnrollmentActivationPlan,
  EnrollmentActivationRequest,
  EnrollmentActivationRequestItem
 } from './enrollment-activation-plan';

type PaymentOrderRow = {
  status: EnrollmentActivationPaymentOrder['status'];
  order_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
};

type EnrollmentRequestRow = {
  request_id: string;
  email: string | null;
  student_name: string | null;
  phone: string | null;
  payment_status: EnrollmentActivationPaymentStatus;
  activated_student_id: string | null;
};

type EnrollmentRequestItemRow = {
  item_id: string;
  item_type: EnrollmentActivationItemType;
  item_name: string;
  program_key: string | null;
  role_id: string | null;
  assigned_cohort_id: string | null;
  assigned_cohort_name: string | null;
  status: EnrollmentActivationPaymentStatus;
};

export type EnrollmentActivationLoadInput = {
  orderId?: string;
  paymentId?: string;
};

export type EnrollmentActivationLoadResult = {
  status: 'ready' | 'not_found';
  plan?: EnrollmentActivationPlan;
  message: string;
};
export class EnrollmentActivationLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: EnrollmentActivationLoadInput): Promise<EnrollmentActivationLoadResult> {
    const orderId = this.cleanText(input.orderId);
    const paymentId = this.cleanText(input.paymentId);

    if (!orderId && !paymentId) {
      return {
        status: 'not_found',
        message: 'Payment order identity is required to load an enrollment activation plan.'
     };
   }

    const paymentOrder = await this.loadPaymentOrder(orderId, paymentId);

    if (!paymentOrder) {
      return {
        status: 'not_found',
        message: 'No payment order matched the activation source identity.'
     };
   }

    const enrollmentRequest = await this.loadEnrollmentRequest(paymentOrder, orderId, paymentId);

    if (!enrollmentRequest) {
      return {
        status: 'not_found',
        message: 'No enrollment request matched the paid payment order.'
     };
   }

    const items = await this.loadEnrollmentRequestItems(enrollmentRequest.request_id);

    return {
      status: 'ready',
      plan: createEnrollmentActivationPlan(
        {
          status: paymentOrder.status,
          orderId: paymentOrder.razorpay_order_id ?? paymentOrder.order_id ?? orderId,
          paymentId: paymentOrder.razorpay_payment_id ?? paymentId
       },
        this.toEnrollmentActivationRequest(enrollmentRequest),
        items.map((item) => this.toEnrollmentActivationRequestItem(item))
      ),
      message: 'Enrollment activation plan loaded.'
   };
 }

  private async loadPaymentOrder(orderId: string | undefined, paymentId: string | undefined): Promise<PaymentOrderRow | undefined> {
    let request = this.supabase.admin.from('payment_orders').select(['status', 'order_id', 'razorpay_order_id', 'razorpay_payment_id'].join(',')).limit(1);

    if (orderId && paymentId) {
      request = request.or(`order_id.eq.${orderId},razorpay_order_id.eq.${orderId},razorpay_payment_id.eq.${paymentId}`);
   } else if (orderId) {
      request = request.or(`order_id.eq.${orderId},razorpay_order_id.eq.${orderId}`);
   } else if (paymentId) {
      request = request.eq('razorpay_payment_id', paymentId);
   }

    const { data, error } = await request.maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load payment order for activation: ${error.message}`);
   }

    return this.asPaymentOrderRow(data);
 }

  private async loadEnrollmentRequest(paymentOrder: PaymentOrderRow, orderId: string | undefined, paymentId: string | undefined): Promise<EnrollmentRequestRow | undefined> {
    const lookupOrderId = paymentOrder.razorpay_order_id ?? paymentOrder.order_id ?? orderId;
    const lookupPaymentId = paymentOrder.razorpay_payment_id ?? paymentId;
    let request = this.supabase.admin
      .from('enrollment_requests')
      .select(['request_id', 'email', 'student_name', 'phone', 'payment_status', 'activated_student_id'].join(','))
      .limit(1);

    if (lookupOrderId && lookupPaymentId) {
      request = request.or(`order_id.eq.${lookupOrderId},payment_id.eq.${lookupPaymentId}`);
   } else if (lookupOrderId) {
      request = request.eq('order_id', lookupOrderId);
   } else if (lookupPaymentId) {
      request = request.eq('payment_id', lookupPaymentId);
   }

    const { data, error } = await request.maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load enrollment request for activation: ${error.message}`);
   }

    return this.asEnrollmentRequestRow(data);
 }

  private async loadEnrollmentRequestItems(requestId: string): Promise<EnrollmentRequestItemRow[]> {
    const { data, error } = await this.supabase.admin
      .from('enrollment_request_items')
      .select(['item_id', 'item_type', 'item_name', 'program_key', 'role_id', 'assigned_cohort_id', 'assigned_cohort_name', 'status'].join(','))
      .eq('request_id', requestId)
      .order('selection_order', { ascending: true });

    if (error) {
      throw new ServiceUnavailableException(`Unable to load enrollment request items for activation: ${error.message}`);
   }

    return this.asEnrollmentRequestItemRows(data);
 }

  private asPaymentOrderRow(value: unknown): PaymentOrderRow | undefined {
    if (!this.isJsonObject(value) || !this.isPaymentOrderStatus(value.status)) return undefined;

    return {
      status: value.status,
      order_id: this.nullableString(value.order_id),
      razorpay_order_id: this.nullableString(value.razorpay_order_id),
      razorpay_payment_id: this.nullableString(value.razorpay_payment_id)
   };
 }

  private asEnrollmentRequestRow(value: unknown): EnrollmentRequestRow | undefined {
    if (!this.isJsonObject(value) || typeof value.request_id !== 'string' || !this.isEnrollmentStatus(value.payment_status)) return undefined;

    return {
      request_id: value.request_id,
      email: this.nullableString(value.email),
      student_name: this.nullableString(value.student_name),
      phone: this.nullableString(value.phone),
      payment_status: value.payment_status,
      activated_student_id: this.nullableString(value.activated_student_id)
   };
 }

  private asEnrollmentRequestItemRows(value: unknown): EnrollmentRequestItemRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is EnrollmentRequestItemRow => {
      return (
        this.isJsonObject(row) &&
        typeof row.item_id === 'string' &&
        this.isItemType(row.item_type) &&
        typeof row.item_name === 'string' &&
        this.isEnrollmentStatus(row.status)
      );
   }).map((row) => ({
      item_id: row.item_id,
      item_type: row.item_type,
      item_name: row.item_name,
      program_key: this.nullableString(row.program_key),
      role_id: this.nullableString(row.role_id),
      assigned_cohort_id: this.nullableString(row.assigned_cohort_id),
      assigned_cohort_name: this.nullableString(row.assigned_cohort_name),
      status: row.status
   }));
 }

  private toEnrollmentActivationRequest(row: EnrollmentRequestRow): EnrollmentActivationRequest {
    return {
      requestId: row.request_id,
      email: row.email,
      studentName: row.student_name,
      phone: row.phone,
      paymentStatus: row.payment_status,
      activatedStudentId: row.activated_student_id
   };
 }

  private toEnrollmentActivationRequestItem(row: EnrollmentRequestItemRow): EnrollmentActivationRequestItem {
    return {
      itemId: row.item_id,
      itemType: row.item_type,
      itemName: row.item_name,
      programKey: row.program_key,
      roleId: row.role_id,
      assignedCohortId: row.assigned_cohort_id,
      assignedCohortName: row.assigned_cohort_name,
      status: row.status
   };
 }

  private cleanText(value: string | undefined): string | undefined {
    const text = value?.trim();
    return text || undefined;
 }

  private nullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
 }

  private isPaymentOrderStatus(value: unknown): value is EnrollmentActivationPaymentOrder['status'] {
    return value === 'created' || value === 'paid' || value === 'failed' || value === 'cancelled';
 }

  private isEnrollmentStatus(value: unknown): value is EnrollmentActivationPaymentStatus {
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

  private isItemType(value: unknown): value is EnrollmentActivationItemType {
    return value === 'program' || value === 'role';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
