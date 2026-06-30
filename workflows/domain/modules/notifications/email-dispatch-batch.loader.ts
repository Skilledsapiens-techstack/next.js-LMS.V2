import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';

type EmailDispatchBatchRow = {
  idempotency_key: string;
  next_attempt_at: string | null;
  locked_until: string | null;
  attempt_count: number | null;
  max_attempts: number | null;
};

export type EmailDispatchBatchLoadInput = {
  now?: string;
  limit?: number;
  maxAttempts?: number;
};

export type EmailDispatchBatchLoadResult = {
  status: 'ready' | 'empty';
  idempotencyKeys: string[];
  message: string;
};

const defaultLimit = 25;
const maxLimit = 100;
const defaultMaxAttempts = 3;
export class EmailDispatchBatchLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPendingBatch(input: EmailDispatchBatchLoadInput = {}): Promise<EmailDispatchBatchLoadResult> {
    const now = this.parseDate(input.now ?? new Date().toISOString());

    if (!now) {
      return {
        status: 'empty',
        idempotencyKeys: [],
        message: 'Email dispatch batch was not loaded because the dispatch clock is invalid.'
     };
   }

    const limit = this.boundedLimit(input.limit);
    const rows = await this.loadPendingRows(now.toISOString(), limit);
    const maxAttempts = this.positiveInteger(input.maxAttempts, defaultMaxAttempts);
    const idempotencyKeys = rows
      .filter((row) => this.isDue(row, now) && this.hasAttemptsRemaining(row, maxAttempts))
      .map((row) => row.idempotency_key);

    return {
      status: idempotencyKeys.length > 0 ? 'ready' : 'empty',
      idempotencyKeys,
      message: idempotencyKeys.length > 0 ? 'Email dispatch batch loaded.' : 'No email dispatch jobs are ready.'
   };
 }

  private async loadPendingRows(now: string, limit: number): Promise<EmailDispatchBatchRow[]> {
    const { data, error } = await this.supabase.admin
      .from('email_outbox')
      .select('idempotency_key,next_attempt_at,locked_until,attempt_count,max_attempts')
      .eq('status', 'pending')
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
      .order('next_attempt_at', { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load email dispatch batch: ${error.message}`);
   }

    return this.asRows(data);
 }

  private isDue(row: EmailDispatchBatchRow, now: Date): boolean {
    const nextAttemptAt = this.parseDate(row.next_attempt_at ?? undefined);
    const lockedUntil = this.parseDate(row.locked_until ?? undefined);

    if (nextAttemptAt && nextAttemptAt.getTime() > now.getTime()) return false;
    if (lockedUntil && lockedUntil.getTime() > now.getTime()) return false;

    return true;
 }

  private hasAttemptsRemaining(row: EmailDispatchBatchRow, defaultAttempts: number): boolean {
    const attemptCount = this.positiveInteger(row.attempt_count ?? undefined, 0);
    const maxAttempts = this.positiveInteger(row.max_attempts ?? undefined, defaultAttempts);
    return attemptCount < maxAttempts;
 }

  private asRows(value: unknown): EmailDispatchBatchRow[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((row) => {
      const parsed = this.asRow(row);
      return parsed ? [parsed] : [];
   });
 }

  private asRow(value: unknown): EmailDispatchBatchRow | undefined {
    if (!this.isJsonObject(value) || typeof value.idempotency_key !== 'string') {
      return undefined;
   }

    return {
      idempotency_key: value.idempotency_key,
      next_attempt_at: typeof value.next_attempt_at === 'string' ? value.next_attempt_at : null,
      locked_until: typeof value.locked_until === 'string' ? value.locked_until : null,
      attempt_count: typeof value.attempt_count === 'number' ? value.attempt_count : null,
      max_attempts: typeof value.max_attempts === 'number' ? value.max_attempts : null
   };
 }

  private boundedLimit(value: number | undefined): number {
    if (!Number.isInteger(value) || value === undefined || value < 1) return defaultLimit;
    return Math.min(value, maxLimit);
 }

  private positiveInteger(value: number | undefined, defaultValue: number): number {
    return Number.isInteger(value) && value !== undefined && value >= 0 ? value : defaultValue;
 }

  private parseDate(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
