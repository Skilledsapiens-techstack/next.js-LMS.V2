import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  StudentAnnouncementListItemDto,
  StudentAnnouncementPriority,
  StudentAnnouncementsQueryDto
 } from './dto/student-announcements.dto';
import { StudentsService } from './students.service';

type StudentAnnouncementRow = {
  id: string;
  announcement_id?: string | null;
  type?: string | null;
  title: string;
  message: string;
  audience?: string | null;
  programs?: string[] | null;
  program_keys?: string[] | null;
  cohorts?: string[] | null;
  cohort_names?: string[] | null;
  priority?: string | null;
  pinned?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
  link_label?: string | null;
  link_url?: string | null;
  updated_at?: string | null;
};
export class StudentAnnouncementsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyAnnouncements(user: User, accessToken: string, query: StudentAnnouncementsQueryDto): Promise<PaginatedResponse<StudentAnnouncementListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
    const userClient = this.supabase.forUser(accessToken);

    const { data, error } = await userClient.rpc('student_dashboard_bundle', { p_student_email: studentEmail });

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your announcements: ${error.message}`);
   }

    const search = normalizeSearch(query.search);
    const allItems = this.asAnnouncementRows(this.extractAnnouncementRows(data))
      .map((row) => this.toStudentAnnouncementListItem(row))
      .filter((item) => query.priority === 'all' || item.priority === query.priority)
      .filter((item) => {
        return !search || [item.id, item.announcementId, item.type, item.title, item.message, item.audience, ...item.programKeys, ...item.cohortNames].some((value) => {
          return String(value ?? '').toLowerCase().includes(search);
       });
     });

    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const items = allItems.slice(from, from + limit);

    return createPaginatedResponse(items, page, limit, allItems.length);
 }

  private extractAnnouncementRows(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!this.isJsonObject(value)) return [];

    const announcements = value.announcements ?? value.items;
    return Array.isArray(announcements) ? announcements : [];
 }

  private asAnnouncementRows(value: unknown[]): StudentAnnouncementRow[] {
    return value.filter((row): row is StudentAnnouncementRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && typeof row.title === 'string' && typeof row.message === 'string';
   });
 }

  private toStudentAnnouncementListItem(row: StudentAnnouncementRow): StudentAnnouncementListItemDto {
    const item: StudentAnnouncementListItemDto = {
      id: row.id,
      title: row.title,
      message: row.message,
      programKeys: this.stringArray(row.program_keys ?? row.programs),
      cohortNames: this.stringArray(row.cohort_names ?? row.cohorts),
      priority: this.toPriority(row.priority),
      pinned: row.pinned === true
   };

    const announcementId = this.cleanText(row.announcement_id);
    const type = this.cleanText(row.type);
    const audience = this.cleanText(row.audience);
    const startDate = this.cleanText(row.start_date);
    const endDate = this.cleanText(row.end_date);
    const linkLabel = this.cleanText(row.link_label);
    const linkUrl = this.cleanText(row.link_url);
    const updatedAt = this.cleanText(row.updated_at);

    if (announcementId) item.announcementId = announcementId;
    if (type) item.type = type;
    if (audience) item.audience = audience;
    if (startDate) item.startDate = startDate;
    if (endDate) item.endDate = endDate;
    if (linkLabel) item.linkLabel = linkLabel;
    if (linkUrl) item.linkUrl = linkUrl;
    if (updatedAt) item.updatedAt = updatedAt;

    return item;
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private toPriority(value: string | null | undefined): StudentAnnouncementPriority {
    if (value === 'urgent' || value === 'important' || value === 'normal') return value;
    return 'normal';
 }

  private stringArray(value: string[] | null | undefined): string[] {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim() !== '') : [];
 }

  private cleanText(value: string | null | undefined): string | undefined {
    const text = String(value ?? '').trim();
    return text || undefined;
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
