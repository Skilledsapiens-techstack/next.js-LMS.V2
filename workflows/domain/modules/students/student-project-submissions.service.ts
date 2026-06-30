import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  StudentProjectSubmissionListItemDto,
  StudentProjectSubmissionsQueryDto,
  StudentProjectSubmissionStatus
 } from './dto/student-project-submissions.dto';
import { StudentsService } from './students.service';

type StudentProjectSubmissionRow = {
  request_id: string;
  request_number: string | null;
  student_email: string;
  project_id: string | null;
  project_title: string | null;
  role_id: string | null;
  role_name: string | null;
  program_key: string | null;
  cohort_key: string | null;
  cohort_name: string | null;
  submission_link: string | null;
  remarks: string | null;
  attempt_number: number | string | null;
  submitted_at: string | null;
  status: StudentProjectSubmissionStatus;
};
export class StudentProjectSubmissionsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyProjectSubmissions(user: User, query: StudentProjectSubmissionsQueryDto): Promise<PaginatedResponse<StudentProjectSubmissionListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('project_submission_requests')
      .select(
        [
          'request_id',
          'request_number',
          'student_email',
          'project_id',
          'project_title',
          'role_id',
          'role_name',
          'program_key',
          'cohort_key',
          'cohort_name',
          'submission_link',
          'remarks',
          'attempt_number',
          'submitted_at',
          'status'
        ].join(','),
        { count: 'exact' }
      )
      .eq('student_email', studentEmail)
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.programKey) {
      request = request.eq('program_key', query.programKey);
   }

    if (query.cohortName) {
      request = request.eq('cohort_name', query.cohortName);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `request_number.ilike.%${escapedSearch}%`,
          `project_title.ilike.%${escapedSearch}%`,
          `role_name.ilike.%${escapedSearch}%`,
          `cohort_name.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your project submissions: ${error.message}`);
   }

    return createPaginatedResponse(this.asProjectSubmissionRows(data).map((row) => this.toProjectSubmissionListItem(row)), page, limit, count ?? 0);
 }

  private asProjectSubmissionRows(value: unknown): StudentProjectSubmissionRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is StudentProjectSubmissionRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.request_id === 'string' && typeof row.student_email === 'string' && this.isStatus(row.status);
   });
 }

  private toProjectSubmissionListItem(row: StudentProjectSubmissionRow): StudentProjectSubmissionListItemDto {
    const attemptNumber = this.toOptionalNumber(row.attempt_number) ?? 0;

    return {
      id: row.request_id.trim(),
      requestNumber: row.request_number ?? undefined,
      projectId: row.project_id ?? undefined,
      projectTitle: row.project_title ?? undefined,
      roleId: row.role_id ?? undefined,
      roleName: row.role_name ?? undefined,
      programKey: row.program_key ?? undefined,
      cohortKey: row.cohort_key ?? undefined,
      cohortName: row.cohort_name ?? undefined,
      submissionLink: row.submission_link ?? undefined,
      remarks: row.remarks ?? undefined,
      attemptNumber,
      isRepeatSubmission: attemptNumber > 1,
      submittedAt: row.submitted_at ?? undefined,
      status: row.status
   };
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private toOptionalNumber(value: number | string | null): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isStatus(value: unknown): value is StudentProjectSubmissionStatus {
    return value === 'submitted' || value === 'under_review' || value === 'approved' || value === 'rejected';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
