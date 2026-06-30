import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CertificateGenerationJobStatus } from './certificate-generation-plan';

type CertificatePdfBatchRow = {
  idempotency_key: string;
  status: CertificateGenerationJobStatus;
  updated_at: string | null;
};

export type CertificatePdfBatchLoadInput = {
  now?: string;
  limit?: number;
  staleGeneratingMinutes?: number;
};

export type CertificatePdfBatchLoadResult = {
  status: 'ready' | 'empty';
  jobIdempotencyKeys: string[];
  message: string;
};

const defaultLimit = 25;
const maxLimit = 100;
const defaultStaleGeneratingMinutes = 30;
export class CertificatePdfBatchLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPendingBatch(input: CertificatePdfBatchLoadInput = {}): Promise<CertificatePdfBatchLoadResult> {
    const now = this.parseDate(input.now ?? new Date().toISOString());

    if (!now) {
      return {
        status: 'empty',
        jobIdempotencyKeys: [],
        message: 'Certificate PDF batch was not loaded because the batch clock is invalid.'
     };
   }

    const limit = this.boundedLimit(input.limit);
    const rows = await this.loadCandidateRows(limit);
    const staleGeneratingCutoff = new Date(now.getTime() - this.positiveInteger(input.staleGeneratingMinutes, defaultStaleGeneratingMinutes) * 60 * 1000);
    const jobIdempotencyKeys = rows
      .filter((row) => this.isRunnable(row, staleGeneratingCutoff))
      .map((row) => row.idempotency_key);

    return {
      status: jobIdempotencyKeys.length > 0 ? 'ready' : 'empty',
      jobIdempotencyKeys,
      message: jobIdempotencyKeys.length > 0 ? 'Certificate PDF batch loaded.' : 'No certificate PDF jobs are ready.'
   };
 }

  private async loadCandidateRows(limit: number): Promise<CertificatePdfBatchRow[]> {
    const { data, error } = await this.supabase.admin
      .from('certificate_generation_jobs')
      .select('idempotency_key,status,updated_at')
      .in('status', ['pending', 'generating'])
      .order('updated_at', { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load certificate PDF batch: ${error.message}`);
   }

    return this.asRows(data);
 }

  private isRunnable(row: CertificatePdfBatchRow, staleGeneratingCutoff: Date): boolean {
    if (row.status === 'pending') return true;

    const updatedAt = this.parseDate(row.updated_at ?? undefined);
    return row.status === 'generating' && Boolean(updatedAt && updatedAt.getTime() <= staleGeneratingCutoff.getTime());
 }

  private asRows(value: unknown): CertificatePdfBatchRow[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((row) => {
      const parsed = this.asRow(row);
      return parsed ? [parsed] : [];
   });
 }

  private asRow(value: unknown): CertificatePdfBatchRow | undefined {
    if (!this.isJsonObject(value) || typeof value.idempotency_key !== 'string' || !this.isJobStatus(value.status)) {
      return undefined;
   }

    return {
      idempotency_key: value.idempotency_key,
      status: value.status,
      updated_at: typeof value.updated_at === 'string' ? value.updated_at : null
   };
 }

  private isJobStatus(value: unknown): value is CertificateGenerationJobStatus {
    return value === 'pending' || value === 'generating' || value === 'ready' || value === 'failed';
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
