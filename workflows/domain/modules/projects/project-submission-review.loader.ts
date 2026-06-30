import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createProjectSubmissionReviewPlan,
  ProjectSubmissionForReview,
  ProjectSubmissionReviewAction,
  ProjectSubmissionReviewPlan,
  ProjectSubmissionReviewStatus
 } from './project-submission-review-plan';

type ProjectSubmissionReviewRow = {
  request_id: string;
  status: ProjectSubmissionReviewStatus;
  student_email: string | null;
  project_id: string | null;
  attempt_number: number | string | null;
};

export type ProjectSubmissionReviewLoadInput = {
  requestId: string;
  action: ProjectSubmissionReviewAction;
  adminEmail: string;
  reviewNote?: string;
  reviewedAt?: string;
};

export type ProjectSubmissionReviewLoadResult = {
  status: 'ready' | 'not_found';
  plan?: ProjectSubmissionReviewPlan;
  message: string;
};
export class ProjectSubmissionReviewLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: ProjectSubmissionReviewLoadInput): Promise<ProjectSubmissionReviewLoadResult> {
    const requestId = this.cleanText(input.requestId);
    const adminEmail = this.normalizeEmail(input.adminEmail);

    if (!requestId || !adminEmail) {
      return {
        status: 'not_found',
        message: 'Project submission request ID and admin email are required to load a review plan.'
     };
   }

    const submission = await this.loadProjectSubmission(requestId);

    if (!submission) {
      return {
        status: 'not_found',
        message: 'No project submission matched the review source identity.'
     };
   }

    return {
      status: 'ready',
      plan: createProjectSubmissionReviewPlan(this.toProjectSubmissionForReview(submission), {
        action: input.action,
        adminEmail,
        reviewNote: input.reviewNote,
        reviewedAt: input.reviewedAt
     }),
      message: 'Project submission review plan loaded.'
   };
 }

  private async loadProjectSubmission(requestId: string): Promise<ProjectSubmissionReviewRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('project_submission_requests')
      .select(['request_id', 'status', 'student_email', 'project_id', 'attempt_number'].join(','))
      .eq('request_id', requestId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load project submission for review: ${error.message}`);
   }

    return this.asProjectSubmissionReviewRow(data);
 }

  private toProjectSubmissionForReview(row: ProjectSubmissionReviewRow): ProjectSubmissionForReview {
    return {
      requestId: row.request_id,
      status: row.status,
      studentEmail: row.student_email ?? undefined,
      projectId: row.project_id ?? undefined,
      attemptNumber: this.toOptionalNumber(row.attempt_number)
   };
 }

  private asProjectSubmissionReviewRow(value: unknown): ProjectSubmissionReviewRow | undefined {
    if (!this.isJsonObject(value) || typeof value.request_id !== 'string' || !this.isStatus(value.status)) return undefined;

    return {
      request_id: value.request_id,
      status: value.status,
      student_email: this.nullableString(value.student_email),
      project_id: this.nullableString(value.project_id),
      attempt_number: typeof value.attempt_number === 'number' || typeof value.attempt_number === 'string' ? value.attempt_number : null
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

  private toOptionalNumber(value: number | string | null): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isStatus(value: unknown): value is ProjectSubmissionReviewStatus {
    return value === 'submitted' || value === 'under_review' || value === 'approved' || value === 'rejected';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
