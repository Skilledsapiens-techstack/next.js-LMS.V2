import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { JsonObject } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  createProjectSubmissionPlan,
  ExistingProjectSubmission,
  ProjectSubmissionInput,
  ProjectSubmissionPlan,
  ProjectSubmissionProject,
  ProjectSubmissionStudent
 } from './project-submission-plan';

type StudentRow = {
  id: string | null;
  email: string;
  full_name: string | null;
  cohort_name: string | null;
};

type ProjectRow = {
  project_id: string;
  title: string;
  role_id: string | null;
  project_role: string | null;
  program_key: string | null;
  program_keys: string[] | null;
  cohort_key: string | null;
  cohort_name: string | null;
  max_attempts: number | string | null;
};

type SubmissionRow = {
  request_id: string;
  status: ExistingProjectSubmission['status'];
  attempt_number: number | string | null;
};

export type ProjectSubmissionLoadInput = {
  studentEmail: string;
  projectId: string;
  submission: ProjectSubmissionInput;
};

export type ProjectSubmissionLoadResult = {
  status: 'ready' | 'not_found';
  plan?: ProjectSubmissionPlan;
  message: string;
};
export class ProjectSubmissionLoader {
  constructor(private readonly supabase: SupabaseService) {}

  async loadPlan(input: ProjectSubmissionLoadInput): Promise<ProjectSubmissionLoadResult> {
    const studentEmail = this.normalizeEmail(input.studentEmail);
    const projectId = this.cleanText(input.projectId);

    if (!studentEmail || !projectId) {
      return {
        status: 'not_found',
        message: 'Student email and project ID are required to load a project submission plan.'
     };
   }

    const student = await this.loadStudent(studentEmail);

    if (!student) {
      return {
        status: 'not_found',
        message: 'No active student matched the project submission source.'
     };
   }

    const project = await this.loadProject(projectId);

    if (!project) {
      return {
        status: 'not_found',
        message: 'No project matched the project submission source.'
     };
   }

    const existingSubmissions = await this.loadExistingSubmissions(studentEmail, project.project_id);

    return {
      status: 'ready',
      plan: createProjectSubmissionPlan(this.toProjectSubmissionStudent(student), this.toProjectSubmissionProject(project), input.submission, existingSubmissions),
      message: 'Project submission plan loaded.'
   };
 }

  private async loadStudent(studentEmail: string): Promise<StudentRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('students')
      .select(['id', 'email', 'full_name', 'cohort_name', 'active'].join(','))
      .eq('email', studentEmail)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load student for project submission: ${error.message}`);
   }

    return this.asStudentRow(data);
 }

  private async loadProject(projectId: string): Promise<ProjectRow | undefined> {
    const { data, error } = await this.supabase.admin
      .from('projects')
      .select(['project_id', 'title', 'role_id', 'project_role', 'program_key', 'program_keys', 'cohort_key', 'cohort_name', 'max_attempts', 'status'].join(','))
      .eq('project_id', projectId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load project for submission: ${error.message}`);
   }

    return this.asProjectRow(data);
 }

  private async loadExistingSubmissions(studentEmail: string, projectId: string): Promise<ExistingProjectSubmission[]> {
    const { data, error } = await this.supabase.admin
      .from('project_submission_requests')
      .select(['request_id', 'status', 'attempt_number'].join(','))
      .eq('student_email', studentEmail)
      .eq('project_id', projectId);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load existing project submissions: ${error.message}`);
   }

    return this.asSubmissionRows(data).map((row) => ({
      requestId: row.request_id,
      status: row.status,
      attemptNumber: this.toOptionalNumber(row.attempt_number) ?? 0
   }));
 }

  private toProjectSubmissionStudent(row: StudentRow): ProjectSubmissionStudent {
    return {
      id: row.id ?? undefined,
      email: row.email,
      fullName: row.full_name ?? undefined,
      cohortName: row.cohort_name ?? undefined
   };
 }

  private toProjectSubmissionProject(row: ProjectRow): ProjectSubmissionProject {
    const programKeys = Array.isArray(row.program_keys) ? row.program_keys : [row.program_key].filter((value): value is string => Boolean(value));

    return {
      projectId: row.project_id,
      title: row.title,
      roleId: row.role_id ?? undefined,
      roleName: row.project_role ?? undefined,
      programKey: row.program_key ?? undefined,
      programKeys,
      cohortKey: row.cohort_key ?? undefined,
      cohortName: row.cohort_name ?? undefined,
      visibleToStudent: true,
      maxAttempts: this.toOptionalNumber(row.max_attempts)
   };
 }

  private asStudentRow(value: unknown): StudentRow | undefined {
    if (!this.isJsonObject(value) || typeof value.email !== 'string') return undefined;

    return {
      id: this.nullableString(value.id),
      email: this.normalizeEmail(value.email),
      full_name: this.nullableString(value.full_name),
      cohort_name: this.nullableString(value.cohort_name)
   };
 }

  private asProjectRow(value: unknown): ProjectRow | undefined {
    if (!this.isJsonObject(value) || typeof value.project_id !== 'string' || typeof value.title !== 'string') return undefined;

    return {
      project_id: value.project_id,
      title: value.title,
      role_id: this.nullableString(value.role_id),
      project_role: this.nullableString(value.project_role),
      program_key: this.nullableString(value.program_key),
      program_keys: Array.isArray(value.program_keys) ? value.program_keys.filter((item): item is string => typeof item === 'string') : null,
      cohort_key: this.nullableString(value.cohort_key),
      cohort_name: this.nullableString(value.cohort_name),
      max_attempts: typeof value.max_attempts === 'number' || typeof value.max_attempts === 'string' ? value.max_attempts : null
   };
 }

  private asSubmissionRows(value: unknown): SubmissionRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is SubmissionRow => {
      return this.isJsonObject(row) && typeof row.request_id === 'string' && this.isStatus(row.status);
   }).map((row) => ({
      request_id: row.request_id,
      status: row.status,
      attempt_number: typeof row.attempt_number === 'number' || typeof row.attempt_number === 'string' ? row.attempt_number : null
   }));
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

  private isStatus(value: unknown): value is ExistingProjectSubmission['status'] {
    return value === 'submitted' || value === 'under_review' || value === 'approved' || value === 'rejected';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
