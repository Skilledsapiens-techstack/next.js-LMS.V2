import { JsonObject, JsonValue } from '../../common/types/json.types';
import { RazorpayWebhookAcceptedDto } from './dto/razorpay-webhook.dto';

type NormalizedStatus = RazorpayWebhookAcceptedDto['suggestedStatus'];
type ProcessingIntent = RazorpayWebhookAcceptedDto['processingIntent'];

export function normalizeRazorpayWebhook(body: JsonObject): RazorpayWebhookAcceptedDto {
  const event = stringValue(body.event) ?? '';
  const paymentEntity = entity(body, 'payment');
  const orderEntity = entity(body, 'order');
  const paymentId = stringValue(paymentEntity.id);
  const orderId = stringValue(paymentEntity.order_id) ?? stringValue(orderEntity.id);
  const eventId = stringValue(body.id) ?? stableEventId(event, paymentId, orderId);
  const notes = notesFrom(body, paymentEntity, orderEntity);

  return {
    received: true,
    event,
    eventId,
    paymentId,
    orderId,
    amount: amountMajorUnit(paymentEntity.amount ?? orderEntity.amount, true) ?? amountMajorUnit(body.amount_paid ?? body.amount, false),
    currency: stringValue(paymentEntity.currency) ?? stringValue(orderEntity.currency) ?? stringValue(body.currency) ?? 'INR',
    studentEmail: normalizeEmail(
      firstValue(valueFromRecord(notes, ['email', 'customer_email', 'student_email', 'email_address', 'most_active_email_id']), paymentEntity.email, body.email)
    ),
    studentPhone: stringValue(firstValue(valueFromRecord(notes, ['phone', 'mobile', 'phone_number', 'contact']), paymentEntity.contact, body.phone)),
    processingIntent: processingIntentFor(event),
    suggestedStatus: suggestedStatusFor(event)
  };
}

function entity(body: JsonObject, key: 'payment' | 'order'): JsonObject {
  const container = objectValue(body.payload) ?? {};
  const nested = objectValue(container[key]) ?? {};
  return objectValue(nested.entity) ?? objectValue(body[key]) ?? {};
}

function processingIntentFor(event: string): ProcessingIntent {
  if (event === 'payment.captured' || event === 'order.paid') return 'processable';
  if (!event) return 'unknown';
  return 'skipped';
}

function suggestedStatusFor(event: string): NormalizedStatus {
  if (event === 'payment.captured' || event === 'order.paid') return 'received';
  if (event.startsWith('payment.failed')) return 'skipped_failed';
  if (event.startsWith('payment.refund') || event.startsWith('refund.')) return 'skipped_refunded';
  return 'skipped_pending_payment';
}

function stableEventId(event: string, paymentId: string | undefined, orderId: string | undefined): string {
  const identity = paymentId ?? orderId ?? 'unknown';
  return `${event || 'unknown'}:${identity}`;
}

function notesFrom(body: JsonObject, paymentEntity: JsonObject, orderEntity: JsonObject): JsonObject {
  return {
    ...objectValue(body.notes),
    ...objectValue(orderEntity.notes),
    ...objectValue(paymentEntity.notes)
  };
}

function amountMajorUnit(value: JsonValue | undefined, minorUnit: boolean): number | undefined {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numberValue)) return undefined;
  return minorUnit ? numberValue / 100 : numberValue;
}

function normalizeEmail(value: JsonValue | undefined): string | undefined {
  const email = stringValue(value)?.trim().toLowerCase();
  return email || undefined;
}

function firstValue(...values: Array<JsonValue | undefined>): JsonValue | undefined {
  return values.find((value) => stringValue(value));
}

function valueFromRecord(record: JsonObject, keys: string[]): JsonValue | undefined {
  for (const key of keys) {
    const value = record[key];
    if (stringValue(value)) return value;
  }
  return undefined;
}

function stringValue(value: JsonValue | undefined): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function objectValue(value: JsonValue | undefined): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonObject) : undefined;
}
