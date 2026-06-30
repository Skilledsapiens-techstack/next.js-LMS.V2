import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  CertificateGenerationJob,
  CertificateGenerationJobStatus,
  CertificateGenerationPlan,
  CertificateGenerationResultInput,
  CertificateType,
  createCertificateGenerationPlan
 } from './certificate-generation-plan';

type CertificateGenerationJobRow = {
  idempotency_key: string;
  request_id: string;
  certificate_id: string;
  certificate_type: CertificateType;
  status: CertificateGenerationJobStatus;
  requested_by: string;
  payload: JsonObject;
};

export type CertificateGenerationLoadInput = CertificateGenerationResultInput & {
  jobIdempotencyKey: string;
};

export type CertificateGenerationLoadResult = {
  status: 'ready' | 'not_found';
  plan?: CertificateGenerationPlan;
  message: string;
};
export class CertificateGenerationLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: CertificateGenerationLoadInput): Promise<CertificateGenerationLoadResult> {
    const jobIdempotencyKey = this.cleanText(input.jobIdempotencyKey);
    const workerId = this.cleanText(input.workerId);

    if (!jobIdempotencyKey || !workerId) {
      return {
        status: 'not_found',
        message: 'Certificate generation job idempotency key and worker ID are required to load a finalization plan.'
     };
   }

    const job = await this.loadGenerationJob(jobIdempotencyKey);

    if (!job) {
      return {
        status: 'not_found',
        message: 'No certificate generation job matched the finalization source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createCertificateGenerationPlan(this.toCertificateGenerationJob(job), {
        workerId,
        generatedAt: input.generatedAt,
        issueDate: input.issueDate,
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        pdfSha256: input.pdfSha256,
        publicVerificationUrl: input.publicVerificationUrl
     }),
      message: 'Certificate generation finalization plan loaded.'
   };
 }

  private async loadGenerationJob(idempotencyKey: string): Promise<CertificateGenerationJobRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('certificate_generation_jobs')
      .select(['idempotency_key', 'request_id', 'certificate_id', 'certificate_type', 'status', 'requested_by', 'payload'].join(','))
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load certificate generation job: ${error.message}`);
   }

    return this.asCertificateGenerationJobRow(data);
 }

  private toCertificateGenerationJob(row: CertificateGenerationJobRow): CertificateGenerationJob {
    return {
      idempotencyKey: row.idempotency_key,
      requestId: row.request_id,
      certificateId: row.certificate_id,
      certificateType: row.certificate_type,
      status: row.status,
      requestedBy: this.normalizeEmail(row.requested_by),
      payload: {
        studentEmail: this.requiredString(row.payload.studentEmail),
        studentName: this.requiredString(row.payload.studentName),
        projectId: this.optionalString(row.payload.projectId),
        projectTitle: this.optionalString(row.payload.projectTitle),
        projectRole: this.optionalString(row.payload.projectRole),
        programKey: this.optionalString(row.payload.programKey),
        programName: this.optionalString(row.payload.programName),
        cohortName: this.optionalString(row.payload.cohortName)
     }
   };
 }

  private asCertificateGenerationJobRow(value: unknown): CertificateGenerationJobRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.idempotency_key !== 'string' ||
      typeof value.request_id !== 'string' ||
      typeof value.certificate_id !== 'string' ||
      !this.isCertificateType(value.certificate_type) ||
      !this.isJobStatus(value.status) ||
      typeof value.requested_by !== 'string' ||
      !this.isJsonObject(value.payload) ||
      typeof value.payload.studentEmail !== 'string' ||
      typeof value.payload.studentName !== 'string'
    ) {
      return undefined;
   }

    return {
      idempotency_key: value.idempotency_key,
      request_id: value.request_id,
      certificate_id: value.certificate_id,
      certificate_type: value.certificate_type,
      status: value.status,
      requested_by: value.requested_by,
      payload: value.payload
   };
 }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
 }

  private cleanText(value: string): string {
    return value.trim();
 }

  private requiredString(value: unknown): string {
    return typeof value === 'string' ? value : '';
 }

  private optionalString(value: unknown): string | undefined {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || undefined;
 }

  private isCertificateType(value: unknown): value is CertificateType {
    return value === 'leadership' || value === 'live_project';
 }

  private isJobStatus(value: unknown): value is CertificateGenerationJobStatus {
    return value === 'pending' || value === 'generating' || value === 'ready' || value === 'failed';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
