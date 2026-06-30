import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { SupabaseClient, User } from '@supabase/supabase-js';
import { JsonObject, JsonValue } from '../../common/types/json.types';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { StudentDashboardDto, StudentProfileDto } from './dto/student-dashboard.dto';

type StudentRow = {
  id: string;
  student_id: string | null;
  full_name: string;
  email: string;
  college_name: string | null;
  cohort_name: string | null;
  program_name: string | null;
  track_role_ids: string[] | null;
  auth_user_id: string | null;
  active: boolean;
};

type SupabaseRpcName =
  | 'student_dashboard_bundle'
  | 'student_resources_view'
  | 'student_projects_bundle'
  | 'student_certificates_bundle';
export class StudentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getCurrentStudent(user: User): Promise<StudentProfileDto> {
    const student = await this.findActiveStudentForUser(user);
    return this.toStudentProfile(student);
 }

  async getCurrentStudentDashboard(user: User, accessToken: string): Promise<StudentDashboardDto> {
    const student = await this.findActiveStudentForUser(user);
    const email = this.normalizeEmail(student.email);
    const userClient = this.supabase.forUser(accessToken);

    const [dashboard, resources, projects, certificates] = await Promise.all([
      this.callStudentBundle(userClient, 'student_dashboard_bundle', email),
      this.callStudentBundle(userClient, 'student_resources_view', email),
      this.callStudentBundle(userClient, 'student_projects_bundle', email),
      this.callStudentBundle(userClient, 'student_certificates_bundle', email)
    ]);

    return {
      student: this.toStudentProfile(student),
      dashboard,
      resources,
      projects,
      certificates
   };
 }

  private async findActiveStudentForUser(user: User): Promise<StudentRow> {
    const authUserId = user.id;
    const authEmail = this.normalizeEmail(user.email);

    if (!authEmail) {
      throw new ForbiddenException('Supabase user email is required for student access.');
   }

    const { data, error } = await this.supabase.admin
      .from('students')
      .select(
        [
          'id',
          'student_id',
          'full_name',
          'email',
          'college_name',
          'cohort_name',
          'program_name',
          'track_role_ids',
          'auth_user_id',
          'active'
        ].join(',')
      )
      .or(`auth_user_id.eq.${authUserId},email.eq.${authEmail}`)
      .limit(2);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load student profile: ${error.message}`);
   }

    const rows = this.asStudentRows(data);
    const student =
      rows.find((row) => row.auth_user_id === authUserId && this.normalizeEmail(row.email) === authEmail) ??
      rows.find((row) => row.auth_user_id === authUserId) ??
      rows.find((row) => this.normalizeEmail(row.email) === authEmail);

    if (!student) {
      throw new NotFoundException('No student profile is linked to this Supabase user.');
   }

    if (!student.active) {
      throw new ForbiddenException('Student profile is inactive.');
   }

    return student;
 }

  private async callStudentBundle(client: SupabaseClient, functionName: SupabaseRpcName, studentEmail: string): Promise<JsonObject> {
    const { data, error } = await client.rpc(functionName, { p_student_email: studentEmail });

    if (error) {
      throw new ServiceUnavailableException(`Unable to load ${functionName}: ${error.message}`);
   }

    return this.asJsonObject(data);
 }

  private toStudentProfile(row: StudentRow): StudentProfileDto {
    return {
      id: row.id,
      studentId: row.student_id ?? undefined,
      fullName: row.full_name,
      email: this.normalizeEmail(row.email),
      collegeName: row.college_name ?? undefined,
      cohortName: row.cohort_name ?? undefined,
      programName: row.program_name ?? undefined,
      trackRoleIds: row.track_role_ids ?? [],
      active: row.active
   };
 }

  private normalizeEmail(email: string | undefined | null): string {
    return String(email ?? '')
      .trim()
      .toLowerCase();
 }

  private asStudentRows(value: unknown): StudentRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is StudentRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.full_name === 'string' &&
        typeof row.email === 'string' &&
        typeof row.active === 'boolean'
      );
   });
 }

  private asJsonObject(value: JsonValue | unknown): JsonObject {
    return this.isJsonObject(value) ? value : {};
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
