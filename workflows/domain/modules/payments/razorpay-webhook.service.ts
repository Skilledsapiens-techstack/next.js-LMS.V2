import { ServiceUnavailableException, UnauthorizedException } from "@app/common/runtime/errors";
import { ConfigService } from "@app/common/runtime/config";
import { createHmac, timingSafeEqual } from 'node:crypto';
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { RazorpayWebhookAcceptedDto } from './dto/razorpay-webhook.dto';
import { decideEnrollmentActivationTrigger } from './enrollment-activation-trigger';
import { createRazorpayPaymentOrderTransitionPlan } from './razorpay-payment-order-transition';
import { decideRazorpayWebhookProcessing } from './razorpay-webhook-decision';
import { normalizeRazorpayWebhook } from './razorpay-webhook-normalizer';
import { createRazorpayWebhookPersistencePlan } from './razorpay-webhook-plan';
export class RazorpayWebhookService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService
  ) {}

  verifyAndParse(rawBody: Buffer, signature: string | undefined, parsedBody: unknown): RazorpayWebhookAcceptedDto {
    const secret = this.config.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET');

    if (!secret) {
      throw new ServiceUnavailableException('Razorpay webhook secret is not configured.');
   }

    if (!signature) {
      throw new UnauthorizedException('Razorpay webhook signature is required.');
   }

    if (!this.isValidSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Razorpay webhook signature is invalid.');
   }

    const body = this.asJsonObject(parsedBody);
    const event = typeof body.event === 'string' ? body.event : '';

    if (!event) {
      throw new UnauthorizedException('Razorpay webhook event is required.');
   }

    const normalized = normalizeRazorpayWebhook(body);
    const withPlan = {
      ...normalized,
      persistencePlan: createRazorpayWebhookPersistencePlan(normalized)
   };
    return {
      ...withPlan,
      paymentOrderTransition: createRazorpayPaymentOrderTransitionPlan(withPlan),
      processingDecision: decideRazorpayWebhookProcessing(withPlan)
   };
 }

  async verifyParseAndMaybePersist(rawBody: Buffer, signature: string | undefined, parsedBody: unknown): Promise<RazorpayWebhookAcceptedDto> {
    const accepted = this.verifyAndParse(rawBody, signature, parsedBody);

    if (!this.config.get<boolean>('RAZORPAY_WEBHOOK_PERSISTENCE_ENABLED')) {
      const persistenceExecution: NonNullable<RazorpayWebhookAcceptedDto['persistenceExecution']> = {
        enabled: false,
        attempted: false,
        status: 'disabled',
        eventId: accepted.persistencePlan?.eventId,
        message: 'Persistence is disabled. No Supabase write was attempted.'
      };
      const paymentOrderTransitionExecution = await this.executePaymentOrderTransition(accepted, persistenceExecution);
      const atsCreditGrantExecution = await this.executeAtsCreditGrant(accepted, paymentOrderTransitionExecution);

      return {
        ...accepted,
        persistenceExecution,
        paymentOrderTransitionExecution,
        atsCreditGrantExecution,
        webhookEventStatusExecution: {
          enabled: false,
          attempted: false,
          status: 'disabled',
          eventId: accepted.persistencePlan?.eventId,
          message: 'Webhook event status recording is disabled because persistence is disabled.'
       },
        activationTriggerDecision: decideEnrollmentActivationTrigger({
          ...accepted,
          persistenceExecution,
          paymentOrderTransitionExecution
       })
     };
   }

    const persistenceExecution = await this.persistWebhookEvent(accepted, this.asJsonObject(parsedBody));
    const paymentOrderTransitionExecution = await this.executePaymentOrderTransition(accepted, persistenceExecution);
    const atsCreditGrantExecution = await this.executeAtsCreditGrant(accepted, paymentOrderTransitionExecution);
    const withExecutions = {
      ...accepted,
      persistenceExecution,
      paymentOrderTransitionExecution,
      atsCreditGrantExecution
   };

    return {
      ...withExecutions,
      persistenceExecution,
      paymentOrderTransitionExecution,
      atsCreditGrantExecution,
      webhookEventStatusExecution: await this.recordWebhookEventStatus(accepted, persistenceExecution, paymentOrderTransitionExecution),
      activationTriggerDecision: decideEnrollmentActivationTrigger(withExecutions)
   };
 }

  private async persistWebhookEvent(event: RazorpayWebhookAcceptedDto, payload: JsonObject): Promise<NonNullable<RazorpayWebhookAcceptedDto['persistenceExecution']>> {
    if (!event.persistencePlan?.shouldPersist || !event.persistencePlan.eventId) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        message: 'Missing persistence plan.'
     };
   }

    const row = {
      event_id: event.persistencePlan.eventId,
      event_type: event.persistencePlan.eventType,
      payment_id: event.persistencePlan.paymentId ?? null,
      order_id: event.persistencePlan.orderId ?? null,
      status: event.persistencePlan.status,
      payload,
      processed_at: new Date().toISOString()
   };

    const { data, error } = await this.supabase.admin
      .from('enrollment_webhook_events')
      .upsert(row, { onConflict: 'event_id', ignoreDuplicates: true })
      .select('event_id,status')
      .maybeSingle();

    if (error) {
      return {
        enabled: true,
        attempted: true,
        status: 'failed',
        eventId: event.persistencePlan.eventId,
        message: error.message
     };
   }

    return {
      enabled: true,
      attempted: true,
      status: data ? 'persisted' : 'duplicate',
      eventId: event.persistencePlan.eventId,
      message: data ? 'Webhook event persisted.' : 'Duplicate webhook event ignored.'
   };
 }

  private async executePaymentOrderTransition(
    event: RazorpayWebhookAcceptedDto,
    persistenceExecution: NonNullable<RazorpayWebhookAcceptedDto['persistenceExecution']>
  ): Promise<NonNullable<RazorpayWebhookAcceptedDto['paymentOrderTransitionExecution']>> {
    const transition = event.paymentOrderTransition;

    if (!this.config.get<boolean>('RAZORPAY_PAYMENT_ORDER_TRANSITIONS_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        orderId: transition?.lookup.orderId,
        paymentId: transition?.lookup.paymentId,
        message: 'Payment order transitions are disabled. No Supabase write was attempted.'
     };
   }

    if (persistenceExecution.status !== 'persisted') {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        orderId: transition?.lookup.orderId,
        paymentId: transition?.lookup.paymentId,
        message: 'Payment order transition skipped because the webhook event was not newly persisted.'
     };
   }

    if (!transition?.shouldUpdatePaymentOrder || !transition.targetStatus || transition.allowedCurrentStatuses.length === 0) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        orderId: transition?.lookup.orderId,
        paymentId: transition?.lookup.paymentId,
        message: transition?.reason ?? 'Missing payment order transition plan.'
     };
   }

    const update = {
      status: transition.targetStatus,
      razorpay_payment_id: transition.lookup.paymentId ?? null,
      updated_at: new Date().toISOString()
   };

    let request = this.supabase.admin
      .from('payment_orders')
      .update(update)
      .in('status', transition.allowedCurrentStatuses);

    if (transition.lookup.orderId && transition.lookup.paymentId) {
      request = request.or(`razorpay_order_id.eq.${transition.lookup.orderId},razorpay_payment_id.eq.${transition.lookup.paymentId}`);
   } else if (transition.lookup.orderId) {
      request = request.eq('razorpay_order_id', transition.lookup.orderId);
   } else if (transition.lookup.paymentId) {
      request = request.eq('razorpay_payment_id', transition.lookup.paymentId);
   }

    const { data, error } = await request.select('id,status,razorpay_order_id,razorpay_payment_id').maybeSingle();

    if (error) {
      return {
        enabled: true,
        attempted: true,
        status: 'failed',
        orderId: transition.lookup.orderId,
        paymentId: transition.lookup.paymentId,
        message: error.message
     };
   }

    return {
      enabled: true,
      attempted: true,
      status: data ? 'updated' : 'not_found_or_blocked',
      orderId: transition.lookup.orderId,
      paymentId: transition.lookup.paymentId,
      message: data ? 'Payment order transition applied.' : 'No payment order matched the allowed transition state.'
   };
 }

  private async executeAtsCreditGrant(
    event: RazorpayWebhookAcceptedDto,
    paymentOrderTransitionExecution: NonNullable<RazorpayWebhookAcceptedDto['paymentOrderTransitionExecution']>
  ): Promise<NonNullable<RazorpayWebhookAcceptedDto['atsCreditGrantExecution']>> {
    const orderId = paymentOrderTransitionExecution.orderId ?? event.orderId;
    const paymentId = paymentOrderTransitionExecution.paymentId ?? event.paymentId;

    if (!this.config.get<boolean>('ATS_CREDIT_GRANTS_ENABLED')) {
      return {
        enabled: false,
        attempted: false,
        status: 'disabled',
        orderId,
        paymentId,
        message: 'ATS credit grants are disabled. No Supabase write was attempted.'
     };
   }

    if (paymentOrderTransitionExecution.status !== 'updated') {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        orderId,
        paymentId,
        message: 'ATS credit grant skipped because the payment order was not newly marked paid.'
     };
   }

    const order = await this.loadPaidAtsPackageOrder(orderId, paymentId);
    if (!order) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        orderId,
        paymentId,
        message: 'No paid ATS package order matched this webhook.'
     };
   }

    const atsPackage = await this.loadAtsPackage(order.item_id);
    if (!atsPackage) {
      return {
        enabled: true,
        attempted: true,
        status: 'failed',
        orderId,
        paymentId,
        studentEmail: order.student_email,
        packageKey: order.item_id,
        message: 'Paid ATS package was not found or is inactive.'
     };
   }

    const student = await this.loadStudentForAtsGrant(order.student_email);
    const grantRow = {
      student_id: student?.id ?? null,
      student_email: order.student_email.trim().toLowerCase(),
      package_id: atsPackage.id,
      source: 'payment',
      source_payment_order_id: order.id,
      source_payment_id: order.razorpay_payment_id ?? paymentId ?? null,
      purchased_scans: atsPackage.scan_credits,
      remaining_scans: atsPackage.scan_credits,
      notes: `Granted from paid ATS package order ${order.order_id ?? order.razorpay_order_id ?? order.id}`
   };

    const { data, error } = await this.supabase.admin
      .from('ats_student_credit_grants')
      .upsert(grantRow, { onConflict: 'source_payment_order_id', ignoreDuplicates: true })
      .select('id,student_email,purchased_scans,remaining_scans')
      .maybeSingle();

    if (error) {
      return {
        enabled: true,
        attempted: true,
        status: 'failed',
        orderId,
        paymentId,
        studentEmail: order.student_email,
        packageKey: atsPackage.package_key,
        scanCredits: atsPackage.scan_credits,
        message: error.message
     };
   }

    if (data) {
      await this.supabase.admin.from('ats_usage_events').insert({
        student_id: student?.id ?? null,
        student_email: order.student_email.trim().toLowerCase(),
        event_type: 'credit_granted',
        metadata: {
          package_id: atsPackage.id,
          package_key: atsPackage.package_key,
          payment_order_id: order.id,
          payment_id: order.razorpay_payment_id ?? paymentId ?? null,
          scan_credits: atsPackage.scan_credits
       }
     });
   }

    return {
      enabled: true,
      attempted: true,
      status: data ? 'granted' : 'duplicate',
      orderId,
      paymentId,
      studentEmail: order.student_email,
      packageKey: atsPackage.package_key,
      scanCredits: atsPackage.scan_credits,
      message: data ? 'ATS scan credits granted.' : 'ATS scan credits were already granted for this payment order.'
  };
 }

  private async loadPaidAtsPackageOrder(orderId: string | undefined, paymentId: string | undefined): Promise<
    | {
        id: string;
        order_id: string | null;
        razorpay_order_id: string | null;
        razorpay_payment_id: string | null;
        student_email: string;
        item_id: string;
      }
    | undefined
  > {
    let request = this.supabase.admin
      .from('payment_orders')
      .select(['id', 'order_id', 'razorpay_order_id', 'razorpay_payment_id', 'student_email', 'item_type', 'item_id', 'status'].join(','))
      .eq('status', 'paid')
      .eq('item_type', 'ats_package')
      .limit(1);

    if (orderId && paymentId) {
      request = request.or(`order_id.eq.${orderId},razorpay_order_id.eq.${orderId},razorpay_payment_id.eq.${paymentId}`);
   } else if (orderId) {
      request = request.or(`order_id.eq.${orderId},razorpay_order_id.eq.${orderId}`);
   } else if (paymentId) {
      request = request.eq('razorpay_payment_id', paymentId);
   } else {
      return undefined;
   }

    const { data, error } = await request.maybeSingle();
    if (error) return undefined;
    const row = this.asJsonObject(data);
    if (typeof row.id !== 'string' || typeof row.student_email !== 'string' || typeof row.item_id !== 'string') return undefined;

    return {
      id: row.id,
      order_id: typeof row.order_id === 'string' ? row.order_id : null,
      razorpay_order_id: typeof row.razorpay_order_id === 'string' ? row.razorpay_order_id : null,
      razorpay_payment_id: typeof row.razorpay_payment_id === 'string' ? row.razorpay_payment_id : null,
      student_email: row.student_email,
      item_id: row.item_id
   };
 }

  private async loadAtsPackage(itemId: string): Promise<{ id: string; package_key: string; scan_credits: number } | undefined> {
    const byKey = await this.supabase.admin
      .from('ats_packages')
      .select('id,package_key,scan_credits,status')
      .eq('package_key', itemId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (byKey.data && this.asJsonObject(byKey.data) && typeof byKey.data.id === 'string' && typeof byKey.data.package_key === 'string') {
      const scanCredits = Number(byKey.data.scan_credits);
      if (Number.isInteger(scanCredits) && scanCredits > 0) return { id: byKey.data.id, package_key: byKey.data.package_key, scan_credits: scanCredits };
   }

    if (!this.isUuid(itemId)) return undefined;

    const byId = await this.supabase.admin
      .from('ats_packages')
      .select('id,package_key,scan_credits,status')
      .eq('id', itemId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (byId.data && this.asJsonObject(byId.data) && typeof byId.data.id === 'string' && typeof byId.data.package_key === 'string') {
      const scanCredits = Number(byId.data.scan_credits);
      if (Number.isInteger(scanCredits) && scanCredits > 0) return { id: byId.data.id, package_key: byId.data.package_key, scan_credits: scanCredits };
   }

    return undefined;
 }

  private async loadStudentForAtsGrant(studentEmail: string): Promise<{ id: string } | undefined> {
    const email = studentEmail.trim().toLowerCase();
    if (!email) return undefined;

    const { data } = await this.supabase.admin
      .from('students')
      .select('id,email')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    const row = this.asJsonObject(data);
    return typeof row.id === 'string' ? { id: row.id } : undefined;
 }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 }

  private async recordWebhookEventStatus(
    event: RazorpayWebhookAcceptedDto,
    persistenceExecution: NonNullable<RazorpayWebhookAcceptedDto['persistenceExecution']>,
    paymentOrderTransitionExecution: NonNullable<RazorpayWebhookAcceptedDto['paymentOrderTransitionExecution']>
  ): Promise<NonNullable<RazorpayWebhookAcceptedDto['webhookEventStatusExecution']>> {
    const eventId = event.persistencePlan?.eventId;

    if (persistenceExecution.status !== 'persisted' || !eventId) {
      return {
        enabled: true,
        attempted: false,
        status: 'skipped',
        eventId,
        message: 'Webhook event status recording skipped because the event was not newly persisted.'
     };
   }

    const targetStatus = this.webhookEventTargetStatus(event, paymentOrderTransitionExecution);
    const errorMessage = this.webhookEventErrorMessage(paymentOrderTransitionExecution);
    const update = {
      status: targetStatus,
      error_message: errorMessage,
      processed_at: new Date().toISOString()
   };

    const { error } = await this.supabase.admin
      .from('enrollment_webhook_events')
      .update(update)
      .eq('event_id', eventId)
      .select('event_id,status,error_message')
      .maybeSingle();

    if (error) {
      return {
        enabled: true,
        attempted: true,
        status: 'failed',
        eventId,
        targetStatus,
        message: error.message
     };
   }

    return {
      enabled: true,
      attempted: true,
      status: 'updated',
      eventId,
      targetStatus,
      message: 'Webhook event status recorded.'
   };
 }

  private webhookEventTargetStatus(
    event: RazorpayWebhookAcceptedDto,
    paymentOrderTransitionExecution: NonNullable<RazorpayWebhookAcceptedDto['paymentOrderTransitionExecution']>
  ): NonNullable<RazorpayWebhookAcceptedDto['webhookEventStatusExecution']>['targetStatus'] {
    if (event.processingDecision?.shouldProcessPayment === false) {
      return event.suggestedStatus;
   }

    if (paymentOrderTransitionExecution.status === 'updated') {
      return 'processed';
   }

    if (paymentOrderTransitionExecution.status === 'failed') {
      return 'failed';
   }

    return 'processed_with_exceptions';
 }

  private webhookEventErrorMessage(paymentOrderTransitionExecution: NonNullable<RazorpayWebhookAcceptedDto['paymentOrderTransitionExecution']>): string | null {
    if (paymentOrderTransitionExecution.status === 'updated') return null;
    return paymentOrderTransitionExecution.message ?? paymentOrderTransitionExecution.status;
 }

  private isValidSignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
   }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
 }

  private asJsonObject(value: unknown): JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonObject) : {};
 }
}
