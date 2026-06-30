import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  StudentCertificateGenerationStatus,
  StudentCertificateListItemDto,
  StudentCertificatesQueryDto,
  StudentCertificateStatus,
  StudentCertificateType
 } from './dto/student-certificates.dto';
import { StudentsService } from './students.service';

type StudentCertificateRow = {
  id: string;
  certificate_id: string;
  certificate_type: StudentCertificateType;
  student_email: string;
  program_key: string | null;
  program_name: string | null;
  cohort_name: string | null;
  project_id: string | null;
  project_title: string | null;
  issue_date: string;
  status: StudentCertificateStatus;
  generation_status: StudentCertificateGenerationStatus;
  created_at: string | null;
  updated_at: string | null;
};
export class StudentCertificatesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyCertificates(user: User, query: StudentCertificatesQueryDto): Promise<PaginatedResponse<StudentCertificateListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
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
          'program_key',
          'program_name',
          'cohort_name',
          'project_id',
          'project_title',
          'issue_date',
          'status',
          'generation_status',
          'created_at',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .eq('student_email', studentEmail)
      .neq('status', 'revoked')
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
          `program_name.ilike.%${escapedSearch}%`,
          `cohort_name.ilike.%${escapedSearch}%`,
          `project_title.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your certificates: ${error.message}`);
   }

    return createPaginatedResponse(this.asStudentCertificateRows(data).map((row) => this.toStudentCertificateListItem(row)), page, limit, count ?? 0);
 }

  private asStudentCertificateRows(value: unknown): StudentCertificateRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is StudentCertificateRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.certificate_id === 'string' &&
        this.isCertificateType(row.certificate_type) &&
        typeof row.student_email === 'string' &&
        typeof row.issue_date === 'string' &&
        this.isCertificateStatus(row.status) &&
        this.isGenerationStatus(row.generation_status)
      );
   });
 }

  private toStudentCertificateListItem(row: StudentCertificateRow): StudentCertificateListItemDto {
    return {
      id: row.id,
      certificateId: row.certificate_id,
      certificateType: row.certificate_type,
      programKey: row.program_key ?? undefined,
      programName: row.program_name ?? undefined,
      cohortName: row.cohort_name ?? undefined,
      projectId: row.project_id ?? undefined,
      projectTitle: row.project_title ?? undefined,
      issueDate: row.issue_date,
      status: row.status,
      generationStatus: row.generation_status,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private isCertificateStatus(value: unknown): value is StudentCertificateStatus {
    return value === 'draft' || value === 'issued';
 }

  private isGenerationStatus(value: unknown): value is StudentCertificateGenerationStatus {
    return value === 'pending' || value === 'generating' || value === 'ready' || value === 'expired' || value === 'failed';
 }

  private isCertificateType(value: unknown): value is StudentCertificateType {
    return value === 'leadership' || value === 'live_project';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
