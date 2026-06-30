import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { StudentCohortListItemDto, StudentCohortsQueryDto } from './dto/student-cohorts.dto';
import { StudentsService } from './students.service';

type StudentCohortRow = {
  id: string;
  cohort_id?: string | null;
  name: string;
  program_key?: string | null;
  domain_key?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  wa_group_name?: string | null;
  wa_link?: string | null;
  student_count?: number | string | null;
  self_paced?: boolean | null;
  updated_at?: string | null;
};
export class StudentCohortsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyCohorts(user: User, accessToken: string, query: StudentCohortsQueryDto): Promise<PaginatedResponse<StudentCohortListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
    const userClient = this.supabase.forUser(accessToken);

    const { data, error } = await userClient.rpc('student_dashboard_bundle', { p_student_email: studentEmail });

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your cohorts: ${error.message}`);
   }

    const search = normalizeSearch(query.search);
    const allItems = this.asCohortRows(this.extractCohortRows(data))
      .map((row) => this.toStudentCohortListItem(row))
      .filter((item) => query.status === 'all' || item.status === query.status)
      .filter((item) => {
        return !search || [item.id, item.cohortId, item.name, item.programKey, item.domainKey, item.status, item.whatsappGroupName].some((value) => {
          return String(value ?? '').toLowerCase().includes(search);
       });
     });

    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const items = allItems.slice(from, from + limit);

    return createPaginatedResponse(items, page, limit, allItems.length);
 }

  private extractCohortRows(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!this.isJsonObject(value)) return [];

    const cohorts = value.cohorts ?? value.items;
    return Array.isArray(cohorts) ? cohorts : [];
 }

  private asCohortRows(value: unknown[]): StudentCohortRow[] {
    return value.filter((row): row is StudentCohortRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && typeof row.name === 'string';
   });
 }

  private toStudentCohortListItem(row: StudentCohortRow): StudentCohortListItemDto {
    const item: StudentCohortListItemDto = {
      id: row.id,
      name: row.name,
      status: this.cleanText(row.status) ?? 'active',
      selfPaced: row.self_paced === true
   };

    const cohortId = this.cleanText(row.cohort_id);
    const programKey = this.cleanText(row.program_key);
    const domainKey = this.cleanText(row.domain_key);
    const startDate = this.cleanText(row.start_date);
    const endDate = this.cleanText(row.end_date);
    const whatsappGroupName = this.cleanText(row.wa_group_name);
    const whatsappLink = this.cleanText(row.wa_link);
    const studentCount = this.toOptionalNumber(row.student_count);
    const updatedAt = this.cleanText(row.updated_at);

    if (cohortId) item.cohortId = cohortId;
    if (programKey) item.programKey = programKey;
    if (domainKey) item.domainKey = domainKey;
    if (startDate) item.startDate = startDate;
    if (endDate) item.endDate = endDate;
    if (whatsappGroupName) item.whatsappGroupName = whatsappGroupName;
    if (whatsappLink) item.whatsappLink = whatsappLink;
    if (studentCount !== undefined) item.studentCount = studentCount;
    if (updatedAt) item.updatedAt = updatedAt;

    return item;
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private cleanText(value: string | null | undefined): string | undefined {
    const text = String(value ?? '').trim();
    return text || undefined;
 }

  private toOptionalNumber(value: number | string | null | undefined): number | undefined {
    if (value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
