import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  AdminProjectDeliverableDto,
  AdminProjectDocumentDto,
  AdminProjectListItemDto,
  AdminProjectsQueryDto,
  AdminProjectStatus,
  AdminProjectTaskDto
 } from './dto/admin-projects.dto';

type AdminProjectRow = {
  project_id: string;
  role_id: string | null;
  project_role: string | null;
  company_name: string | null;
  program_key: string | null;
  program_keys: string[] | null;
  program_name: string | null;
  title: string;
  brief: string | null;
  objectives: string | null;
  action_items: unknown;
  deliverables: unknown;
  resources: unknown;
  submission_link: string | null;
  deadline: string | null;
  status: AdminProjectStatus;
  updated_at: string | null;
};
export class AdminProjectsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listProjects(query: AdminProjectsQueryDto): Promise<PaginatedResponse<AdminProjectListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('projects')
      .select(
        [
          'project_id',
          'role_id',
          'project_role',
          'company_name',
          'program_key',
          'program_keys',
          'program_name',
          'title',
          'brief',
          'objectives',
          'action_items',
          'deliverables',
          'resources',
          'submission_link',
          'deadline',
          'status',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.roleId) {
      request = request.eq('role_id', query.roleId);
   }

    if (query.programKey) {
      request = request.contains('program_keys', [query.programKey]);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `project_id.ilike.%${escapedSearch}%`,
          `title.ilike.%${escapedSearch}%`,
          `project_role.ilike.%${escapedSearch}%`,
          `company_name.ilike.%${escapedSearch}%`,
          `program_name.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load projects: ${error.message}`);
   }

    return createPaginatedResponse(this.asProjectRows(data).map((row) => this.toProjectListItem(row)), page, limit, count ?? 0);
 }

  private asProjectRows(value: unknown): AdminProjectRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminProjectRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.project_id === 'string' && typeof row.title === 'string' && this.isStatus(row.status);
   });
 }

  private toProjectListItem(row: AdminProjectRow): AdminProjectListItemDto {
    return {
      id: row.project_id,
      roleId: row.role_id ?? undefined,
      projectRole: row.project_role ?? undefined,
      companyName: row.company_name ?? undefined,
      programKey: row.program_key ?? undefined,
      programKeys: Array.isArray(row.program_keys) ? row.program_keys : [row.program_key].filter((value): value is string => Boolean(value)),
      programName: row.program_name ?? undefined,
      title: row.title,
      brief: row.brief ?? undefined,
      objectives: row.objectives ?? undefined,
      tasks: this.parseTasks(row.action_items),
      documents: this.parseDocuments(row.resources),
      deliverables: this.parseDeliverables(row.deliverables),
      submissionLink: row.submission_link ?? undefined,
      deadline: row.deadline ?? undefined,
      status: row.status,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private parseTasks(value: unknown): AdminProjectTaskDto[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.parseTaskObject(item)).filter((item): item is AdminProjectTaskDto => Boolean(item));
   }

    return this.splitRows(value)
      .map((item) => {
        const [title, ...descriptionParts] = item.split(':');
        return {
          title: title.trim(),
          description: descriptionParts.join(':').trim() || undefined
       };
     })
      .filter((item) => item.title);
 }

  private parseDocuments(value: unknown): AdminProjectDocumentDto[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.parseDocumentObject(item)).filter((item): item is AdminProjectDocumentDto => Boolean(item));
   }

    return this.splitRows(value)
      .map((item) => {
        const parts = item.split('|').map((part) => part.trim());
        return {
          title: parts[0] || 'Project file',
          link: parts[1] || undefined,
          type: parts[2] || undefined,
          description: parts[3] || undefined
       };
     })
      .filter((item) => item.title);
 }

  private parseDeliverables(value: unknown): AdminProjectDeliverableDto[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.parseDeliverableObject(item)).filter((item): item is AdminProjectDeliverableDto => Boolean(item));
   }

    return this.splitRows(value)
      .map((item) => {
        const parts = item.split('|').map((part) => part.trim());
        if (parts.length >= 3) {
          return { title: parts[0], format: parts[1] || undefined, note: parts.slice(2).join(' | ') || undefined };
       }

        const [title, ...noteParts] = item.split(':');
        return { title: title.trim(), note: noteParts.join(':').trim() || undefined };
     })
      .filter((item) => item.title);
 }

  private parseTaskObject(value: unknown): AdminProjectTaskDto | undefined {
    if (!this.isJsonObject(value)) return undefined;
    const title = this.stringValue(value.title ?? value.t ?? value.name);
    if (!title) return undefined;
    return {
      title,
      description: this.stringValue(value.description ?? value.d ?? value.note) || undefined
   };
 }

  private parseDocumentObject(value: unknown): AdminProjectDocumentDto | undefined {
    if (!this.isJsonObject(value)) return undefined;
    const title = this.stringValue(value.title ?? value.name);
    if (!title) return undefined;
    return {
      title,
      link: this.stringValue(value.link ?? value.url) || undefined,
      type: this.stringValue(value.type) || undefined,
      description: this.stringValue(value.description ?? value.desc) || undefined
   };
 }

  private parseDeliverableObject(value: unknown): AdminProjectDeliverableDto | undefined {
    if (!this.isJsonObject(value)) return undefined;
    const title = this.stringValue(value.title ?? value.name);
    if (!title) return undefined;
    return {
      title,
      format: this.stringValue(value.format) || undefined,
      note: this.stringValue(value.note ?? value.description) || undefined
   };
 }

  private splitRows(value: unknown): string[] {
    return String(value ?? '')
      .split(/\r?\n|;;/)
      .map((item) => item.trim())
      .filter(Boolean);
 }

  private stringValue(value: unknown): string {
    return String(value ?? '').trim();
 }

  private isStatus(value: unknown): value is AdminProjectStatus {
    return value === 'active' || value === 'inactive';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
