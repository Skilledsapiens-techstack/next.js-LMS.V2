import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createOperationalCleanupPlan,
  OperationalCleanupCandidate,
  OperationalCleanupInput,
  OperationalCleanupPlan
 } from './operational-cleanup-plan';

type EmailOutboxCleanupRow = {
  idempotency_key: string;
  status: string;
  locked_until: string | null;
  updated_at: string | null;
};

type CertificateGenerationJobCleanupRow = {
  id: string;
  status: string;
  updated_at: string | null;
};

type WebhookEventCleanupRow = {
  event_id: string;
  status: string;
  processed_at: string | null;
  updated_at: string | null;
};

type ErrorLogCleanupRow = {
  idempotency_key: string;
  created_at: string | null;
};

export type OperationalCleanupLoadInput = OperationalCleanupInput & {
  perSourceLimit?: number;
};

export type OperationalCleanupLoadResult = {
  status: 'ready' | 'empty';
  plan: OperationalCleanupPlan;
  message: string;
  candidateCount: number;
};

const defaultPerSourceLimit = 25;
export class OperationalCleanupLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: OperationalCleanupLoadInput = {}): Promise<OperationalCleanupLoadResult> {
    const perSourceLimit = this.positiveInteger(input.perSourceLimit, defaultPerSourceLimit);
    const candidates = [
      ...(await this.loadEmailOutboxCandidates(perSourceLimit)),
      ...(await this.loadCertificateGenerationJobCandidates(perSourceLimit)),
      ...(await this.loadWebhookEventCandidates(perSourceLimit)),
      ...(await this.loadErrorLogCandidates(perSourceLimit))
    ];
    const plan = createOperationalCleanupPlan(candidates, input);

    return {
      status: plan.shouldRun ? 'ready' : 'empty',
      plan,
      message: plan.shouldRun ? 'Operational cleanup plan loaded.' : 'No operational cleanup candidates are ready.',
      candidateCount: candidates.length
   };
 }

  private async loadEmailOutboxCandidates(limit: number): Promise<OperationalCleanupCandidate[]> {
    const { data, error } = await this.supabase.admin
      .from('email_outbox')
      .select('idempotency_key,status,locked_until,updated_at')
      .eq('status', 'sending')
      .order('locked_until', { ascending: true })
      .limit(limit);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load email cleanup candidates: ${error.message}`);
   }

    return this.asArray(data).flatMap((row) => {
      const candidate = this.asEmailOutboxCleanupRow(row);
      return candidate
        ? [
            {
              entityTable: 'email_outbox',
              entityId: candidate.idempotency_key,
              status: candidate.status,
              lockedUntil: candidate.locked_until ?? undefined,
              updatedAt: candidate.updated_at ?? undefined
           } satisfies OperationalCleanupCandidate
          ]
        : [];
   });
 }

  private async loadCertificateGenerationJobCandidates(limit: number): Promise<OperationalCleanupCandidate[]> {
    const { data, error } = await this.supabase.admin
      .from('certificate_generation_jobs')
      .select('id,status,updated_at')
      .eq('status', 'rendering')
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load certificate cleanup candidates: ${error.message}`);
   }

    return this.asArray(data).flatMap((row) => {
      const candidate = this.asCertificateGenerationJobCleanupRow(row);
      return candidate
        ? [
            {
              entityTable: 'certificate_generation_jobs',
              entityId: candidate.id,
              status: candidate.status,
              updatedAt: candidate.updated_at ?? undefined
           } satisfies OperationalCleanupCandidate
          ]
        : [];
   });
 }

  private async loadWebhookEventCandidates(limit: number): Promise<OperationalCleanupCandidate[]> {
    const { data, error } = await this.supabase.admin
      .from('enrollment_webhook_events')
      .select('event_id,status,processed_at,updated_at')
      .in('status', ['processed', 'skipped', 'duplicate'])
      .order('processed_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load webhook cleanup candidates: ${error.message}`);
   }

    return this.asArray(data).flatMap((row) => {
      const candidate = this.asWebhookEventCleanupRow(row);
      return candidate
        ? [
            {
              entityTable: 'enrollment_webhook_events',
              entityId: candidate.event_id,
              status: candidate.status,
              completedAt: candidate.processed_at ?? undefined,
              updatedAt: candidate.updated_at ?? undefined
           } satisfies OperationalCleanupCandidate
          ]
        : [];
   });
 }

  private async loadErrorLogCandidates(limit: number): Promise<OperationalCleanupCandidate[]> {
    const { data, error } = await this.supabase.admin
      .from('error_logs')
      .select('idempotency_key,created_at')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load error-log cleanup candidates: ${error.message}`);
   }

    return this.asArray(data).flatMap((row) => {
      const candidate = this.asErrorLogCleanupRow(row);
      return candidate
        ? [
            {
              entityTable: 'error_logs',
              entityId: candidate.idempotency_key,
              createdAt: candidate.created_at ?? undefined
           } satisfies OperationalCleanupCandidate
          ]
        : [];
   });
 }

  private asEmailOutboxCleanupRow(value: unknown): EmailOutboxCleanupRow | undefined {
    if (!this.isJsonObject(value) || typeof value.idempotency_key !== 'string' || typeof value.status !== 'string') return undefined;

    return {
      idempotency_key: value.idempotency_key,
      status: value.status,
      locked_until: typeof value.locked_until === 'string' ? value.locked_until : null,
      updated_at: typeof value.updated_at === 'string' ? value.updated_at : null
   };
 }

  private asCertificateGenerationJobCleanupRow(value: unknown): CertificateGenerationJobCleanupRow | undefined {
    if (!this.isJsonObject(value) || typeof value.id !== 'string' || typeof value.status !== 'string') return undefined;

    return {
      id: value.id,
      status: value.status,
      updated_at: typeof value.updated_at === 'string' ? value.updated_at : null
   };
 }

  private asWebhookEventCleanupRow(value: unknown): WebhookEventCleanupRow | undefined {
    if (!this.isJsonObject(value) || typeof value.event_id !== 'string' || typeof value.status !== 'string') return undefined;

    return {
      event_id: value.event_id,
      status: value.status,
      processed_at: typeof value.processed_at === 'string' ? value.processed_at : null,
      updated_at: typeof value.updated_at === 'string' ? value.updated_at : null
   };
 }

  private asErrorLogCleanupRow(value: unknown): ErrorLogCleanupRow | undefined {
    if (!this.isJsonObject(value) || typeof value.idempotency_key !== 'string') return undefined;

    return {
      idempotency_key: value.idempotency_key,
      created_at: typeof value.created_at === 'string' ? value.created_at : null
   };
 }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }

  private positiveInteger(value: number | undefined, defaultValue: number): number {
    return Number.isInteger(value) && value !== undefined && value > 0 ? value : defaultValue;
 }
}
