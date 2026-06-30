import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { StudentResourceAccessType, StudentResourceListItemDto, StudentResourcesQueryDto } from './dto/student-resources.dto';
import { StudentsService } from './students.service';

type StudentResourceRow = {
  id: string;
  resource_id: string | null;
  title: string;
  description: string | null;
  resource_type: string;
  resource_mode: string | null;
  phase: string | null;
  program_keys: string[] | null;
  cohort_names: string[] | null;
  url: string | null;
  access_type: StudentResourceAccessType;
  hasAccess: boolean;
  locked: boolean;
  lockReason: string | null;
  price: number | string | null;
  currency: string | null;
  updated_at: string | null;
};
export class StudentResourcesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyResources(user: User, accessToken: string, query: StudentResourcesQueryDto): Promise<PaginatedResponse<StudentResourceListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
    const userClient = this.supabase.forUser(accessToken);

    const { data, error } = await userClient.rpc('student_resources_view', { p_student_email: studentEmail });

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your resources: ${error.message}`);
   }

    const search = normalizeSearch(query.search);
    const allItems = this.asStudentResourceRows(this.extractResourceRows(data))
      .map((row) => this.toStudentResourceListItem(row))
      .filter((item) => query.accessType === 'all' || item.accessType === query.accessType)
      .filter((item) => !query.resourceType || item.resourceType === query.resourceType)
      .filter((item) => !search || [item.id, item.resourceId, item.title, item.description, item.resourceType, item.resourceMode].some((value) => String(value ?? '').toLowerCase().includes(search)));

    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const items = allItems.slice(from, from + limit);

    return createPaginatedResponse(items, page, limit, allItems.length);
 }

  private extractResourceRows(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!this.isJsonObject(value)) return [];

    const resources = value.resources ?? value.items;
    return Array.isArray(resources) ? resources : [];
 }

  private asStudentResourceRows(value: unknown[]): StudentResourceRow[] {
    return value.filter((row): row is StudentResourceRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && typeof row.title === 'string' && typeof row.resource_type === 'string' && this.isAccessType(row.access_type);
   });
 }

  private toStudentResourceListItem(row: StudentResourceRow): StudentResourceListItemDto {
    return {
      id: row.id,
      resourceId: row.resource_id ?? undefined,
      title: row.title,
      description: row.description ?? undefined,
      resourceType: row.resource_type,
      resourceMode: row.resource_mode ?? undefined,
      phase: row.phase ?? undefined,
      programKeys: Array.isArray(row.program_keys) ? row.program_keys : [],
      cohortNames: Array.isArray(row.cohort_names) ? row.cohort_names : [],
      url: row.url ?? undefined,
      accessType: row.access_type,
      hasAccess: row.hasAccess === true,
      locked: row.locked === true,
      lockReason: row.lockReason ?? undefined,
      price: this.toOptionalNumber(row.price),
      currency: row.currency ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private toOptionalNumber(value: number | string | null): number | undefined {
    if (value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isAccessType(value: unknown): value is StudentResourceAccessType {
    return value === 'free' || value === 'paid';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
