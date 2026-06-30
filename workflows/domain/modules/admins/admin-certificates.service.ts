import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  AdminCertificateGenerationStatus,
  AdminCertificateListItemDto,
  AdminCertificateRequestAdminStatus,
  AdminCertificateRequestListItemDto,
  AdminCertificateRequestsQueryDto,
  AdminCertificateReviewStatus,
  AdminCertificatesQueryDto,
  AdminCertificateStatus,
  AdminCertificateType
 } from './dto/admin-certificates.dto';

type AdminCertificateRow = {
  id: string;
  certificate_id: string;
  certificate_type: AdminCertificateType;
  student_email: string;
  student_name: string;
  program_key: string | null;
  program_name: string | null;
  cohort_name: string | null;
  project_id: string | null;
  project_title: string | null;
  issue_date: string;
  status: AdminCertificateStatus;
  generation_status: AdminCertificateGenerationStatus;
  issued_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminCertificateRequestRow = {
  id: string;
  request_id: string;
  request_type: 'live_project';
  student_email: string;
  student_name: string;
  project_id: string;
  project_title: string | null;
  project_role: string;
  program_key: string | null;
  cohort_name: string | null;
  submitted_at: string;
  moderator_status: AdminCertificateReviewStatus;
  moderator_email: string | null;
  moderator_reviewed_at: string | null;
  admin_status: AdminCertificateRequestAdminStatus;
  admin_email: string | null;
  admin_reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};
export class AdminCertificatesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listCertificates(query: AdminCertificatesQueryDto): Promise<PaginatedResponse<AdminCertificateListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('certificates')
      .select(
        [
          'id',
          'certificate_id',
          'certificate_type',
          'student_email',
          'student_name',
          'program_key',
          'program_name',
          'cohort_name',
          'project_id',
          'project_title',
          'issue_date',
          'status',
          'generation_status',
          'issued_by',
          'created_at',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('issue_date', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.generationStatus !== 'all') {
      request = request.eq('generation_status', query.generationStatus);
   }

    if (query.certificateType !== 'all') {
      request = request.eq('certificate_type', query.certificateType);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `certificate_id.ilike.%${escapedSearch}%`,
          `student_email.ilike.%${escapedSearch}%`,
          `student_name.ilike.%${escapedSearch}%`,
          `program_name.ilike.%${escapedSearch}%`,
          `project_title.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load certificates: ${error.message}`);
   }

    return createPaginatedResponse(this.asAdminCertificateRows(data).map((row) => this.toAdminCertificateListItem(row)), page, limit, count ?? 0);
 }

  async listCertificateRequests(query: AdminCertificateRequestsQueryDto): Promise<PaginatedResponse<AdminCertificateRequestListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('certificate_requests')
      .select(
        [
          'id',
          'request_id',
          'request_type',
          'student_email',
          'student_name',
          'project_id',
          'project_title',
          'project_role',
          'program_key',
          'cohort_name',
          'submitted_at',
          'moderator_status',
          'moderator_email',
          'moderator_reviewed_at',
          'admin_status',
          'admin_email',
          'admin_reviewed_at',
          'created_at',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.moderatorStatus !== 'all') {
      request = request.eq('moderator_status', query.moderatorStatus);
   }

    if (query.adminStatus !== 'all') {
      request = request.eq('admin_status', query.adminStatus);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `request_id.ilike.%${escapedSearch}%`,
          `student_email.ilike.%${escapedSearch}%`,
          `student_name.ilike.%${escapedSearch}%`,
          `project_id.ilike.%${escapedSearch}%`,
          `project_title.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load certificate requests: ${error.message}`);
   }

    return createPaginatedResponse(
      this.asAdminCertificateRequestRows(data).map((row) => this.toAdminCertificateRequestListItem(row)),
      page,
      limit,
      count ?? 0
    );
 }

  private asAdminCertificateRows(value: unknown): AdminCertificateRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminCertificateRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.certificate_id === 'string' &&
        this.isCertificateType(row.certificate_type) &&
        typeof row.student_email === 'string' &&
        typeof row.student_name === 'string' &&
        typeof row.issue_date === 'string' &&
        this.isCertificateStatus(row.status) &&
        this.isGenerationStatus(row.generation_status)
      );
   });
 }

  private toAdminCertificateListItem(row: AdminCertificateRow): AdminCertificateListItemDto {
    return {
      id: row.id,
      certificateId: row.certificate_id,
      certificateType: row.certificate_type,
      studentEmail: this.normalizeEmail(row.student_email),
      studentName: row.student_name,
      programKey: row.program_key ?? undefined,
      programName: row.program_name ?? undefined,
      cohortName: row.cohort_name ?? undefined,
      projectId: row.project_id ?? undefined,
      projectTitle: row.project_title ?? undefined,
      issueDate: row.issue_date,
      status: row.status,
      generationStatus: row.generation_status,
      issuedBy: row.issued_by ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private asAdminCertificateRequestRows(value: unknown): AdminCertificateRequestRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminCertificateRequestRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.request_id === 'string' &&
        row.request_type === 'live_project' &&
        typeof row.student_email === 'string' &&
        typeof row.student_name === 'string' &&
        typeof row.project_id === 'string' &&
        typeof row.project_role === 'string' &&
        typeof row.submitted_at === 'string' &&
        this.isReviewStatus(row.moderator_status) &&
        this.isRequestAdminStatus(row.admin_status)
      );
   });
 }

  private toAdminCertificateRequestListItem(row: AdminCertificateRequestRow): AdminCertificateRequestListItemDto {
    return {
      id: row.id,
      requestId: row.request_id,
      requestType: row.request_type,
      studentEmail: this.normalizeEmail(row.student_email),
      studentName: row.student_name,
      projectId: row.project_id,
      projectTitle: row.project_title ?? undefined,
      projectRole: row.project_role,
      programKey: row.program_key ?? undefined,
      cohortName: row.cohort_name ?? undefined,
      submittedAt: row.submitted_at,
      moderatorStatus: row.moderator_status,
      moderatorEmail: row.moderator_email ?? undefined,
      moderatorReviewedAt: row.moderator_reviewed_at ?? undefined,
      adminStatus: row.admin_status,
      adminEmail: row.admin_email ?? undefined,
      adminReviewedAt: row.admin_reviewed_at ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private isCertificateStatus(value: unknown): value is AdminCertificateStatus {
    return value === 'draft' || value === 'issued' || value === 'revoked';
 }

  private isGenerationStatus(value: unknown): value is AdminCertificateGenerationStatus {
    return value === 'pending' || value === 'generating' || value === 'ready' || value === 'expired' || value === 'failed';
 }

  private isCertificateType(value: unknown): value is AdminCertificateType {
    return value === 'leadership' || value === 'live_project';
 }

  private isReviewStatus(value: unknown): value is AdminCertificateReviewStatus {
    return value === 'pending' || value === 'approved' || value === 'rejected';
 }

  private isRequestAdminStatus(value: unknown): value is AdminCertificateRequestAdminStatus {
    return this.isReviewStatus(value) || value === 'issued';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
