import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  CertificateRequestAdminStatus,
  CertificateRequestApprovalInput,
  CertificateRequestApprovalPlan,
  CertificateRequestForApproval,
  CertificateRequestReviewStatus,
  createCertificateRequestApprovalPlan
 } from './certificate-request-approval-plan';

type CertificateRequestApprovalRow = {
  request_id: string;
  request_type: 'live_project';
  student_email: string;
  student_name: string;
  project_id: string;
  project_title: string | null;
  project_role: string;
  program_key: string | null;
  cohort_name: string | null;
  moderator_status: CertificateRequestReviewStatus;
  admin_status: CertificateRequestAdminStatus;
};

export type CertificateRequestApprovalLoadInput = CertificateRequestApprovalInput & {
  requestId: string;
};

export type CertificateRequestApprovalLoadResult = {
  status: 'ready' | 'not_found';
  plan?: CertificateRequestApprovalPlan;
  message: string;
};
export class CertificateRequestApprovalLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: CertificateRequestApprovalLoadInput): Promise<CertificateRequestApprovalLoadResult> {
    const requestId = this.cleanText(input.requestId);
    const adminEmail = this.normalizeEmail(input.adminEmail);

    if (!requestId || !adminEmail) {
      return {
        status: 'not_found',
        message: 'Certificate request ID and admin email are required to load an approval plan.'
     };
   }

    const request = await this.loadCertificateRequest(requestId);

    if (!request) {
      return {
        status: 'not_found',
        message: 'No certificate request matched the approval source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createCertificateRequestApprovalPlan(this.toCertificateRequestForApproval(request), {
        decision: input.decision,
        adminEmail,
        note: input.note,
        decidedAt: input.decidedAt,
        certificateId: input.certificateId
     }),
      message: 'Certificate request approval plan loaded.'
   };
 }

  private async loadCertificateRequest(requestId: string): Promise<CertificateRequestApprovalRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('certificate_requests')
      .select(
        [
          'request_id',
          'request_type',
          'student_email',
          'student_name',
          'project_id',
          'project_title',
          'project_role',
          'program_key',
          'cohort_name',
          'moderator_status',
          'admin_status'
        ].join(',')
      )
      .eq('request_id', requestId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load certificate request for approval: ${error.message}`);
   }

    return this.asCertificateRequestApprovalRow(data);
 }

  private toCertificateRequestForApproval(row: CertificateRequestApprovalRow): CertificateRequestForApproval {
    return {
      requestId: row.request_id,
      requestType: row.request_type,
      studentEmail: row.student_email,
      studentName: row.student_name,
      projectId: row.project_id,
      projectTitle: row.project_title ?? undefined,
      projectRole: row.project_role,
      programKey: row.program_key ?? undefined,
      cohortName: row.cohort_name ?? undefined,
      moderatorStatus: row.moderator_status,
      adminStatus: row.admin_status
   };
 }

  private asCertificateRequestApprovalRow(value: unknown): CertificateRequestApprovalRow | undefined {
    if (
      !this.isJsonObject(value) ||
      typeof value.request_id !== 'string' ||
      value.request_type !== 'live_project' ||
      typeof value.student_email !== 'string' ||
      typeof value.student_name !== 'string' ||
      typeof value.project_id !== 'string' ||
      typeof value.project_role !== 'string' ||
      !this.isReviewStatus(value.moderator_status) ||
      !this.isAdminStatus(value.admin_status)
    ) {
      return undefined;
   }

    return {
      request_id: value.request_id,
      request_type: value.request_type,
      student_email: this.normalizeEmail(value.student_email),
      student_name: value.student_name,
      project_id: value.project_id,
      project_title: this.nullableString(value.project_title),
      project_role: value.project_role,
      program_key: this.nullableString(value.program_key),
      cohort_name: this.nullableString(value.cohort_name),
      moderator_status: value.moderator_status,
      admin_status: value.admin_status
   };
 }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
 }

  private cleanText(value: string): string {
    return value.trim();
 }

  private nullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
 }

  private isReviewStatus(value: unknown): value is CertificateRequestReviewStatus {
    return value === 'pending' || value === 'approved' || value === 'rejected';
 }

  private isAdminStatus(value: unknown): value is CertificateRequestAdminStatus {
    return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'issued';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
