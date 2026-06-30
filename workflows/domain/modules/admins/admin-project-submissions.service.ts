import { ConflictException, NotFoundException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { ProjectSubmissionReviewWorkflow } from '../projects/project-submission-review.workflow';
import { 
  AdminProjectSubmissionListItemDto,
  AdminProjectSubmissionsQueryDto,
  AdminProjectSubmissionStatus
 } from './dto/admin-project-submissions.dto';

type AdminProjectSubmissionRow = {
  request_id: string;
  request_number: string | null;
  student_id: string | null;
  student_email: string;
  student_name: string | null;
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
  status: AdminProjectSubmissionStatus;
};
export class AdminProjectSubmissionsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reviewWorkflow: ProjectSubmissionReviewWorkflow
  ) {}

  async listProjectSubmissions(query: AdminProjectSubmissionsQueryDto): Promise<PaginatedResponse<AdminProjectSubmissionListItemDto>> {
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
          'student_id',
          'student_email',
          'student_name',
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
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status === 'pending') {
      request = request.in('status', ['submitted', 'under_review']);
   } else if (query.status === 'duplicates') {
      request = request.in('status', ['submitted', 'under_review']).gt('attempt_number', 1);
   } else if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.roleId) {
      request = request.eq('role_id', query.roleId);
   }

    if (query.programKey) {
      request = request.eq('program_key', query.programKey);
   }

    if (query.cohortName) {
      request = request.eq('cohort_name', query.cohortName);
   }

    if (query.submittedDate) {
      const nextDate = this.nextIsoDateStart(query.submittedDate);
      if (nextDate) {
        request = request.gte('submitted_at', `${query.submittedDate}T00:00:00Z`).lt('submitted_at', nextDate);
     }
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `request_number.ilike.%${escapedSearch}%`,
          `student_name.ilike.%${escapedSearch}%`,
          `student_email.ilike.%${escapedSearch}%`,
          `project_title.ilike.%${escapedSearch}%`,
          `role_name.ilike.%${escapedSearch}%`,
          `cohort_name.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load project submissions: ${error.message}`);
   }

    const rows = this.annotateProjectSubmissions(this.asProjectSubmissionRows(data).map((row) => this.toProjectSubmissionListItem(row)));
    return createPaginatedResponse(rows, page, limit, count ?? 0);
 }

  async approveSubmission(requestId: string, adminEmail: string) {
    return this.reviewSubmission(requestId, adminEmail, 'approve');
 }

  async rejectSubmission(requestId: string, adminEmail: string, reviewNote?: string) {
    return this.reviewSubmission(requestId, adminEmail, 'reject', reviewNote);
 }

  private async reviewSubmission(requestId: string, adminEmail: string, action: 'approve' | 'reject', reviewNote?: string) {
    const result = await this.reviewWorkflow.reviewSubmission({
      requestId,
      action,
      adminEmail,
      reviewNote
   });

    if (result.status === 'not_found') {
      throw new NotFoundException(result.message);
   }

    if (result.status === 'disabled' || result.status === 'failed') {
      throw new ServiceUnavailableException(result.message);
   }

    if (result.status === 'skipped') {
      throw new ConflictException(result.message);
   }

    return result;
 }

  private asProjectSubmissionRows(value: unknown): AdminProjectSubmissionRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminProjectSubmissionRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.request_id === 'string' && typeof row.student_email === 'string' && this.isStatus(row.status);
   });
 }

  private toProjectSubmissionListItem(row: AdminProjectSubmissionRow): AdminProjectSubmissionListItemDto {
    const attemptNumber = this.toOptionalNumber(row.attempt_number) ?? 0;

    return {
      id: row.request_id.trim(),
      requestNumber: row.request_number ?? undefined,
      studentId: row.student_id ?? undefined,
      studentEmail: this.normalizeEmail(row.student_email),
      studentName: row.student_name ?? undefined,
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
      previousRequestIds: [],
      previousRequestNumbers: [],
      duplicateGroupKey: undefined,
      duplicateGroupCount: 0,
      submittedAt: row.submitted_at ?? undefined,
      status: row.status
   };
 }

  private annotateProjectSubmissions(items: AdminProjectSubmissionListItemDto[]): AdminProjectSubmissionListItemDto[] {
    const groups = new Map<string, AdminProjectSubmissionListItemDto[]>();

    for (const item of items) {
      const key = this.projectSubmissionDuplicateKey(item);
      item.duplicateGroupKey = key;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
   }

    for (const group of groups.values()) {
      group.sort((left, right) => {
        const attemptDelta = left.attemptNumber - right.attemptNumber;
        if (attemptDelta) return attemptDelta;
        return String(left.submittedAt ?? '').localeCompare(String(right.submittedAt ?? ''));
     });

      group.forEach((item, index) => {
        const previous = group.slice(0, index);
        item.duplicateGroupCount = group.length;
        item.previousRequestIds = previous.map((row) => row.id).filter(Boolean);
        item.previousRequestNumbers = previous.map((row) => row.requestNumber ?? row.id).filter(Boolean);
        item.isRepeatSubmission = item.isRepeatSubmission || item.attemptNumber > 1 || previous.length > 0;
     });
   }

    return items;
 }

  private projectSubmissionDuplicateKey(item: AdminProjectSubmissionListItemDto): string {
    const studentKey = item.studentEmail || String(item.studentId ?? '').trim();
    const cohortKey = String(item.cohortKey ?? this.slugify(item.cohortName ?? '')).trim();
    return [studentKey, cohortKey].join('|');
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private nextIsoDateStart(dateText: string): string {
    const date = new Date(`${dateText}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return '';
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
 }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
 }

  private toOptionalNumber(value: number | string | null): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isStatus(value: unknown): value is AdminProjectSubmissionStatus {
    return value === 'submitted' || value === 'under_review' || value === 'approved' || value === 'rejected';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
