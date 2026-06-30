import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  StudentProjectDeliverableDto,
  StudentProjectDocumentDto,
  StudentProjectListItemDto,
  StudentProjectsQueryDto,
  StudentProjectTaskDto
 } from './dto/student-projects.dto';
import { StudentsService } from './students.service';

type StudentProjectRow = {
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
  updated_at: string | null;
};
export class StudentProjectsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyProjects(user: User, accessToken: string, query: StudentProjectsQueryDto): Promise<PaginatedResponse<StudentProjectListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
    const userClient = this.supabase.forUser(accessToken);

    const { data, error } = await userClient.rpc('student_projects_bundle', { p_student_email: studentEmail });

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your projects: ${error.message}`);
   }

    const search = normalizeSearch(query.search);
    const allItems = this.asProjectRows(this.extractProjectRows(data))
      .map((row) => this.toProjectListItem(row))
      .filter((item) => !query.roleId || item.roleId === query.roleId)
      .filter((item) => !query.programKey || item.programKeys.includes(query.programKey))
      .filter((item) => {
        return !search || [item.id, item.title, item.projectRole, item.companyName, item.programName, ...item.programKeys].some((value) => {
          return String(value ?? '').toLowerCase().includes(search);
       });
     });

    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const items = allItems.slice(from, from + limit);

    return createPaginatedResponse(items, page, limit, allItems.length);
 }

  private extractProjectRows(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!this.isJsonObject(value)) return [];

    const projects = value.projects ?? value.items;
    return Array.isArray(projects) ? projects : [];
 }

  private asProjectRows(value: unknown[]): StudentProjectRow[] {
    return value.filter((row): row is StudentProjectRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.project_id === 'string' && typeof row.title === 'string';
   });
 }

  private toProjectListItem(row: StudentProjectRow): StudentProjectListItemDto {
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
      updatedAt: row.updated_at ?? undefined
   };
 }

  private parseTasks(value: unknown): StudentProjectTaskDto[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.parseTaskObject(item)).filter((item): item is StudentProjectTaskDto => Boolean(item));
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

  private parseDocuments(value: unknown): StudentProjectDocumentDto[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.parseDocumentObject(item)).filter((item): item is StudentProjectDocumentDto => Boolean(item));
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

  private parseDeliverables(value: unknown): StudentProjectDeliverableDto[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.parseDeliverableObject(item)).filter((item): item is StudentProjectDeliverableDto => Boolean(item));
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

  private parseTaskObject(value: unknown): StudentProjectTaskDto | undefined {
    if (!this.isJsonObject(value)) return undefined;
    const title = this.stringValue(value.title ?? value.t ?? value.name);
    if (!title) return undefined;
    return {
      title,
      description: this.stringValue(value.description ?? value.d ?? value.note) || undefined
   };
 }

  private parseDocumentObject(value: unknown): StudentProjectDocumentDto | undefined {
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

  private parseDeliverableObject(value: unknown): StudentProjectDeliverableDto | undefined {
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
