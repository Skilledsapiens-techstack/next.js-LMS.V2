import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  StudentScheduleAccessType,
  StudentScheduleListItemDto,
  StudentScheduleQueryDto,
  StudentScheduleStatus
 } from './dto/student-schedule.dto';
import { StudentsService } from './students.service';

type StudentScheduleRow = {
  id: string;
  workshop_id: string | null;
  title: string;
  date: string;
  time: string | null;
  duration_minutes: number | string | null;
  program_key: string | null;
  domain_key: string | null;
  cohort_names: string[] | null;
  workshop_status: StudentScheduleStatus;
  join_url: string | null;
  access_type: StudentScheduleAccessType;
  hasAccess: boolean;
  locked: boolean;
  lockReason: string | null;
  price: number | string | null;
  currency: string | null;
};
export class StudentScheduleService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMySchedule(user: User, accessToken: string, query: StudentScheduleQueryDto): Promise<PaginatedResponse<StudentScheduleListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
    const userClient = this.supabase.forUser(accessToken);

    const { data, error } = await userClient.rpc('student_schedule_view', { p_student_email: studentEmail });

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your schedule: ${error.message}`);
   }

    const search = normalizeSearch(query.search);
    const allItems = this.asStudentScheduleRows(this.extractScheduleRows(data))
      .map((row) => this.toStudentScheduleListItem(row))
      .filter((item) => query.accessType === 'all' || item.accessType === query.accessType)
      .filter((item) => query.status === 'all' || item.status === query.status)
      .filter((item) => !search || [item.id, item.workshopId, item.title, item.programKey, item.domainKey, ...item.cohortNames].some((value) => String(value ?? '').toLowerCase().includes(search)));

    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const items = allItems.slice(from, from + limit);

    return createPaginatedResponse(items, page, limit, allItems.length);
 }

  private extractScheduleRows(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!this.isJsonObject(value)) return [];

    const schedule = value.schedule ?? value.items;
    return Array.isArray(schedule) ? schedule : [];
 }

  private asStudentScheduleRows(value: unknown[]): StudentScheduleRow[] {
    return value.filter((row): row is StudentScheduleRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string'
        && typeof row.title === 'string'
        && typeof row.date === 'string'
        && this.isScheduleStatus(row.workshop_status)
        && this.isAccessType(row.access_type);
   });
 }

  private toStudentScheduleListItem(row: StudentScheduleRow): StudentScheduleListItemDto {
    const hasAccess = row.hasAccess === true;
    const locked = row.locked === true;
    const joinUrl = hasAccess && !locked ? row.join_url ?? undefined : undefined;

    const item: StudentScheduleListItemDto = {
      id: row.id,
      workshopId: row.workshop_id ?? undefined,
      title: row.title,
      date: row.date,
      time: row.time ?? undefined,
      durationMinutes: this.toOptionalNumber(row.duration_minutes),
      programKey: row.program_key ?? undefined,
      domainKey: row.domain_key ?? undefined,
      cohortNames: Array.isArray(row.cohort_names) ? row.cohort_names : [],
      status: row.workshop_status,
      accessType: row.access_type,
      hasAccess,
      locked,
      lockReason: row.lockReason ?? undefined,
      price: this.toOptionalNumber(row.price),
      currency: row.currency ?? undefined
   };

    if (joinUrl) item.joinUrl = joinUrl;

    return item;
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private toOptionalNumber(value: number | string | null): number | undefined {
    if (value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isAccessType(value: unknown): value is StudentScheduleAccessType {
    return value === 'free' || value === 'paid';
 }

  private isScheduleStatus(value: unknown): value is StudentScheduleStatus {
    return value === 'Upcoming' || value === 'Scheduled' || value === 'Live';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
