import { ConflictException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { ConfigService } from "@app/common/runtime/config";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  AdminStudentAttemptLimitDto,
  AdminStudentAttemptLimitDtoOut,
  AdminStudentImportDto,
  AdminStudentImportResultDto,
  AdminStudentListItemDto,
  AdminStudentsQueryDto,
  AdminStudentWriteDto
 } from './dto/admin-students.dto';

type AdminStudentRow = {
  id: string;
  student_id: string | null;
  full_name: string;
  email: string;
  alt_email: string | null;
  phone: string | null;
  college_name: string | null;
  cohort_id: string | null;
  cohort_name: string | null;
  program_name: string | null;
  track_role_ids: string[] | null;
  slot: string | null;
  wa_group_name: string | null;
  onboarding_mail_status: string | null;
  active: boolean;
  date_of_onboarding: string | null;
  updated_at: string | null;
};

type StudentUpsertRow = {
  active: boolean;
  alt_email?: string;
  cohort_id?: string;
  cohort_name?: string;
  college_name?: string;
  date_of_onboarding?: string;
  email: string;
  full_name: string;
  onboarding_mail_status: string;
  phone?: string;
  program_name?: string;
  slot?: string;
  student_id?: string;
  track_role_ids: string[];
  updated_at: string;
  wa_group_name?: string;
};

type StudentAttemptLimitRow = {
  student_id: string;
  student_email: string;
  max_attempts: number;
  notes: string | null;
  updated_at: string | null;
};

type MaybeSingleResult = { data: unknown; error: { message: string } | null };
export class AdminStudentsService {
  private readonly studentSelectColumns = [
    'id',
    'student_id',
    'full_name',
    'email',
    'alt_email',
    'phone',
    'college_name',
    'cohort_id',
    'cohort_name',
    'program_name',
    'track_role_ids',
    'slot',
    'wa_group_name',
    'onboarding_mail_status',
    'active',
    'date_of_onboarding',
    'updated_at'
  ].join(',');

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService
  ) {}

  async listStudents(query: AdminStudentsQueryDto): Promise<PaginatedResponse<AdminStudentListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('students')
      .select(this.studentSelectColumns, { count: 'exact' })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status === 'active') {
      request = request.eq('active', true);
   }

    if (query.status === 'inactive') {
      request = request.eq('active', false);
   }

    if (query.cohortName) {
      request = request.eq('cohort_name', query.cohortName);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(`full_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,college_name.ilike.%${escapedSearch}%`);
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load students: ${error.message}`);
   }

    return createPaginatedResponse(this.asAdminStudentRows(data).map((row) => this.toAdminStudentListItem(row)), page, limit, count ?? 0);
 }

  async saveStudent(input: AdminStudentWriteDto, adminEmail: string): Promise<AdminStudentListItemDto> {
    this.assertWritesEnabled();
    const previous = await this.findStudentByEmail(input.email);
    const row = this.toStudentUpsertRow(input, new Date().toISOString(), previous);

    const { data, error } = await this.supabase.admin.from('students').upsert(row, { onConflict: 'email' }).select(this.studentSelectColumns).single();

    if (error) {
      throw new ConflictException(`Unable to save student: ${error.message}`);
   }

    const saved = this.asAdminStudentRows([data])[0];
    if (!saved) {
      throw new ServiceUnavailableException('Student was saved, but the saved row could not be read back safely.');
   }

    await this.writeStudentLinks(saved, input);
    await this.recordAudit(previous ? 'student.updated' : 'student.created', adminEmail, saved.id, previous, saved, {
      selectedCohortCount: input.cohortIds?.length ?? input.cohortNames?.length ?? 0,
      selectedProgramCount: input.programKeys?.length ?? input.programNames?.length ?? 0,
      passwordInviteRecorded: input.sendInvite === true
   });

    return this.toAdminStudentListItem(saved);
 }

  async updateStudent(studentId: string, input: AdminStudentWriteDto, adminEmail: string): Promise<AdminStudentListItemDto> {
    this.assertWritesEnabled();
    const previous = await this.loadStudentById(studentId);
    return this.saveStudent({ ...input, email: previous.email }, adminEmail);
 }

  async updateStudentActive(studentId: string, active: boolean, adminEmail: string): Promise<AdminStudentListItemDto> {
    this.assertWritesEnabled();
    const previous = await this.loadStudentById(studentId);
    const { data, error } = await this.supabase.admin
      .from('students')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', studentId)
      .select(this.studentSelectColumns)
      .single();

    if (error) {
      throw new ConflictException(`Unable to update student status: ${error.message}`);
   }

    const updated = this.asAdminStudentRows([data])[0];
    if (!updated) {
      throw new ServiceUnavailableException('Student status was updated, but the saved row could not be read back safely.');
   }

    await this.recordAudit(active ? 'student.reactivated' : 'student.deactivated', adminEmail, updated.id, previous, updated);
    return this.toAdminStudentListItem(updated);
 }

  async importStudents(input: AdminStudentImportDto, adminEmail: string): Promise<AdminStudentImportResultDto> {
    this.assertWritesEnabled();
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const student of input.students.slice(0, 250)) {
      try {
        const previous = await this.findStudentByEmail(student.email);
        await this.saveStudent(student, adminEmail);
        if (previous) updated += 1;
        else created += 1;
     } catch {
        failed += 1;
     }
   }

    await this.recordRawAudit('students.imported', adminEmail, 'students', 'batch', {
      created,
      updated,
      failed,
      requested: input.students.length
   });

    return { created, updated, failed };
 }

  async getAttemptLimit(studentId: string): Promise<AdminStudentAttemptLimitDtoOut> {
    const student = await this.loadStudentById(studentId);
    const { data, error } = await this.supabase.admin.from('project_submission_student_limits').select('student_id,student_email,max_attempts,notes,updated_at').eq('student_id', student.id).maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load student attempt limit: ${error.message}`);
   }

    const row = this.asAttemptLimitRow(data);
    return {
      studentEmail: student.email,
      studentId: student.id,
      maxAttempts: row?.max_attempts ?? 3,
      notes: row?.notes ?? undefined,
      updatedAt: row?.updated_at ?? undefined
   };
 }

  async updateAttemptLimit(studentId: string, input: AdminStudentAttemptLimitDto, adminEmail: string): Promise<AdminStudentAttemptLimitDtoOut> {
    this.assertWritesEnabled();
    const previous = await this.getAttemptLimit(studentId);
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.admin
      .from('project_submission_student_limits')
      .upsert(
        {
          student_id: previous.studentId,
          student_email: previous.studentEmail,
          max_attempts: input.maxAttempts,
          notes: this.cleanText(input.notes),
          updated_by: this.normalizeEmail(adminEmail),
          updated_at: now
       },
        { onConflict: 'student_id' }
      )
      .select('student_id,student_email,max_attempts,notes,updated_at')
      .single();

    if (error) {
      throw new ConflictException(`Unable to update LP attempt limit: ${error.message}`);
   }

    const row = this.asAttemptLimitRow(data);
    if (!row) {
      throw new ServiceUnavailableException('LP attempt limit was updated, but the row could not be read back safely.');
   }

    const next = this.toAttemptLimitDto(row);
    await this.recordRawAudit('student.lp_attempt_limit_updated', adminEmail, 'project_submission_student_limits', previous.studentId, {
      previousState: { ...previous },
      nextState: { ...next }
   });

    return next;
 }

  private assertWritesEnabled() {
    if (!this.config.get<boolean>('STUDENT_WRITES_ENABLED')) {
      throw new ServiceUnavailableException('Student writes are disabled. No Supabase write was attempted.');
   }
 }

  private async findStudentByEmail(email: string): Promise<AdminStudentRow | null> {
    const normalized = this.normalizeEmail(email);
    if (!normalized) return null;
    const { data, error } = (await this.supabase.admin.from('students').select(this.studentSelectColumns).eq('email', normalized).maybeSingle()) as MaybeSingleResult;
    if (error) {
      throw new ServiceUnavailableException(`Unable to load existing student: ${error.message}`);
   }
    return this.asAdminStudentRows(data ? [data] : [])[0] ?? null;
 }

  private async loadStudentById(studentId: string): Promise<AdminStudentRow> {
    const id = this.cleanText(studentId);
    if (!id) throw new ConflictException('Student ID is required.');
    const { data, error } = await this.supabase.admin.from('students').select(this.studentSelectColumns).eq('id', id).single();
    if (error) {
      throw new ServiceUnavailableException(`Unable to load student: ${error.message}`);
   }
    const row = this.asAdminStudentRows([data])[0];
    if (!row) throw new ServiceUnavailableException('Student could not be read safely.');
    return row;
 }

  private toStudentUpsertRow(input: AdminStudentWriteDto, now: string, previous: AdminStudentRow | null): StudentUpsertRow {
    const email = this.normalizeEmail(input.email);
    const fullName = this.cleanText(input.fullName);
    if (!email || !fullName) {
      throw new ConflictException('Student full name and email are required.');
   }

    const cohortIds = this.cleanStringArray(input.cohortIds);
    const cohortNames = this.cleanStringArray(input.cohortNames);
    const programKeys = this.cleanStringArray(input.programKeys);
    const programNames = this.cleanStringArray(input.programNames);

    return this.withOptionalFields(
      {
        active: input.active ?? previous?.active ?? true,
        email,
        full_name: fullName,
        onboarding_mail_status: input.sendInvite ? 'pending' : input.onboardingMailStatus ?? previous?.onboarding_mail_status ?? 'skipped',
        track_role_ids: programKeys.length > 0 ? programKeys : previous?.track_role_ids ?? [],
        updated_at: now
     },
      {
        alt_email: this.cleanText(input.altEmail),
        cohort_id: cohortIds[0],
        cohort_name: cohortNames[0],
        college_name: this.cleanText(input.collegeName),
        date_of_onboarding: previous?.date_of_onboarding ?? now.slice(0, 10),
        phone: this.cleanText(input.phone),
        program_name: (programNames.join(', ') || programKeys.join(', ') || previous?.program_name) ?? undefined,
        slot: this.cleanText(input.slot),
        student_id: this.cleanText(input.studentId),
        wa_group_name: this.cleanText(input.waGroup)
     }
    );
 }

  private async writeStudentLinks(student: AdminStudentRow, input: AdminStudentWriteDto) {
    const programKeys = this.cleanStringArray(input.programKeys);
    if (programKeys.length > 0) {
      const programRows = programKeys.map((programKey) => ({
        student_id: student.id,
        program_key: programKey,
        student_name: student.full_name
     }));
      const result = await this.supabase.admin.from('student_programs').upsert(programRows, { onConflict: 'student_id,program_key' });
      if (result.error) {
        throw new ServiceUnavailableException(`Student saved, but program linking failed: ${result.error.message}`);
     }
   }

    const cohortIds = this.cleanStringArray(input.cohortIds);
    const cohortNames = this.cleanStringArray(input.cohortNames);
    const cohortRows = cohortIds
      .map((cohortId, index) => ({
        student_id: student.id,
        cohort_id: cohortId,
        cohort_name: cohortNames[index] ?? cohortNames[0] ?? student.cohort_name ?? ''
     }))
      .filter((row) => row.cohort_name);
    if (cohortRows.length > 0) {
      const result = await this.supabase.admin.from('student_cohorts').upsert(cohortRows, { onConflict: 'student_id,cohort_id' });
      if (result.error) {
        throw new ServiceUnavailableException(`Student saved, but cohort linking failed: ${result.error.message}`);
     }
   }
 }

  private asAdminStudentRows(value: unknown): AdminStudentRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminStudentRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && typeof row.full_name === 'string' && typeof row.email === 'string' && typeof row.active === 'boolean';
   });
 }

  private toAdminStudentListItem(row: AdminStudentRow): AdminStudentListItemDto {
    const programs = String(row.program_name ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return {
      id: row.id,
      studentId: row.student_id ?? undefined,
      fullName: row.full_name,
      email: this.normalizeEmail(row.email),
      altEmail: row.alt_email ?? undefined,
      phone: row.phone ?? undefined,
      collegeName: row.college_name ?? undefined,
      cohortName: row.cohort_name ?? undefined,
      programName: row.program_name ?? undefined,
      programs,
      slot: row.slot ?? undefined,
      waGroup: row.wa_group_name ?? undefined,
      onboardingMailStatus: row.onboarding_mail_status ?? undefined,
      enrolledDate: row.date_of_onboarding ?? undefined,
      trackRoleIds: row.track_role_ids ?? [],
      active: row.active,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private asAttemptLimitRow(value: unknown): StudentAttemptLimitRow | null {
    if (!this.isJsonObject(value)) return null;
    return typeof value.student_id === 'string' && typeof value.student_email === 'string' && typeof value.max_attempts === 'number'
      ? (value as StudentAttemptLimitRow)
      : null;
 }

  private toAttemptLimitDto(row: StudentAttemptLimitRow): AdminStudentAttemptLimitDtoOut {
    return {
      studentId: row.student_id,
      studentEmail: this.normalizeEmail(row.student_email),
      maxAttempts: row.max_attempts,
      notes: row.notes ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private summarizeStudent(row: AdminStudentRow) {
    return {
      studentId: row.student_id,
      fullName: row.full_name,
      email: this.normalizeEmail(row.email),
      collegeName: row.college_name,
      cohortName: row.cohort_name,
      programName: row.program_name,
      active: row.active
   };
 }

  private async recordAudit(action: string, adminEmail: string, entityId: string, previous: AdminStudentRow | null, next: AdminStudentRow, extra?: JsonObject) {
    await this.recordRawAudit(action, adminEmail, 'students', entityId, {
      previousState: previous ? this.summarizeStudent(previous) : null,
      nextState: this.summarizeStudent(next),
      ...(extra ?? {})
   });
 }

  private async recordRawAudit(action: string, adminEmail: string, entityType: string, entityId: string, details: JsonObject) {
    const auditResult = await this.supabase.admin.from('audit_logs').insert({
      actor_email: this.normalizeEmail(adminEmail) || 'unknown-admin',
      actor_role: 'admin',
      action,
      entity_type: entityType,
      entity_id: entityId,
      status: 'success',
      details
   });

    if (auditResult.error) {
      throw new ServiceUnavailableException(`Student write completed, but audit logging failed: ${auditResult.error.message}`);
   }
 }

  private cleanStringArray(value: string[] | undefined): string[] {
    return Array.from(new Set((value ?? []).map((item) => this.cleanText(item)).filter((item): item is string => Boolean(item))));
 }

  private cleanText(value: string | undefined | null): string | undefined {
    const text = String(value ?? '').trim();
    return text || undefined;
 }

  private normalizeEmail(email: string | undefined | null): string {
    return String(email ?? '')
      .trim()
      .toLowerCase();
 }

  private withOptionalFields<T extends Record<string, unknown>>(base: T, optional: Record<string, unknown>): T {
    Object.entries(optional).forEach(([key, value]) => {
      if (value !== undefined) {
        base[key as keyof T] = value as T[keyof T];
     }
   });
    return base;
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
