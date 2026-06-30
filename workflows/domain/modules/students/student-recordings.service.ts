import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { User } from '@supabase/supabase-js';
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  StudentRecordingAccessType,
  StudentRecordingListItemDto,
  StudentRecordingsQueryDto,
  StudentRecordingSource
 } from './dto/student-recordings.dto';
import { StudentsService } from './students.service';

type StudentRecordingWorkshopRow = {
  id: string;
  workshop_id: string | null;
  title: string;
  date: string;
  time: string | null;
  duration_minutes: number | string | null;
  program_key: string | null;
  domain_key: string | null;
  cohort_names: string[] | null;
  workshop_status: string;
  youtube_video_url: string | null;
  zoom_recording_url: string | null;
  access_type: StudentRecordingAccessType;
  hasAccess: boolean;
  locked: boolean;
  lockReason: string | null;
  price: number | string | null;
  currency: string | null;
};
export class StudentRecordingsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly studentsService: StudentsService
  ) {}

  async listMyRecordings(user: User, accessToken: string, query: StudentRecordingsQueryDto): Promise<PaginatedResponse<StudentRecordingListItemDto>> {
    const student = await this.studentsService.getCurrentStudent(user);
    const studentEmail = this.normalizeEmail(student.email);
    const userClient = this.supabase.forUser(accessToken);

    const { data, error } = await userClient.rpc('student_dashboard_bundle', { p_student_email: studentEmail });

    if (error) {
      throw new ServiceUnavailableException(`Unable to load your recordings: ${error.message}`);
   }

    const search = normalizeSearch(query.search);
    const allItems = this.asRecordingWorkshopRows(this.extractWorkshopRows(data))
      .filter((row) => row.workshop_status === 'Completed')
      .map((row) => this.toStudentRecordingListItem(row))
      .filter((item): item is StudentRecordingListItemDto & { source: StudentRecordingSource } => item.source !== undefined)
      .filter((item) => query.accessType === 'all' || item.accessType === query.accessType)
      .filter((item) => query.source === 'all' || item.source === query.source)
      .filter((item) => {
        return !search || [item.id, item.workshopId, item.title, item.programKey, item.domainKey, ...item.cohortNames].some((value) => {
          return String(value ?? '').toLowerCase().includes(search);
       });
     });

    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const items = allItems.slice(from, from + limit);

    return createPaginatedResponse(items, page, limit, allItems.length);
 }

  private extractWorkshopRows(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (!this.isJsonObject(value)) return [];

    const workshops = value.workshops ?? value.recordings ?? value.items;
    return Array.isArray(workshops) ? workshops : [];
 }

  private asRecordingWorkshopRows(value: unknown[]): StudentRecordingWorkshopRow[] {
    return value.filter((row): row is StudentRecordingWorkshopRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string'
        && typeof row.title === 'string'
        && typeof row.date === 'string'
        && typeof row.workshop_status === 'string'
        && this.isAccessType(row.access_type);
   });
 }

  private toStudentRecordingListItem(row: StudentRecordingWorkshopRow): StudentRecordingListItemDto {
    const hasAccess = row.hasAccess === true;
    const locked = row.locked === true;
    const recording = this.resolvePublishedRecording(row);

    const item: StudentRecordingListItemDto = {
      id: row.id,
      title: row.title,
      date: row.date,
      cohortNames: Array.isArray(row.cohort_names) ? row.cohort_names : [],
      accessType: row.access_type,
      hasAccess,
      locked,
   };

    const durationMinutes = this.toOptionalNumber(row.duration_minutes);
    const price = this.toOptionalNumber(row.price);
    const lockReason = this.cleanText(row.lockReason);

    if (row.workshop_id) item.workshopId = row.workshop_id;
    if (row.time) item.time = row.time;
    if (durationMinutes !== undefined) item.durationMinutes = durationMinutes;
    if (row.program_key) item.programKey = row.program_key;
    if (row.domain_key) item.domainKey = row.domain_key;
    if (lockReason) item.lockReason = lockReason;
    if (recording) item.source = recording.source;
    if (recording && hasAccess && !locked) item.recordingUrl = recording.url;
    if (price !== undefined) item.price = price;
    if (row.currency) item.currency = row.currency;

    return item;
 }

  private resolvePublishedRecording(row: StudentRecordingWorkshopRow): { source: StudentRecordingSource; url: string } | undefined {
    const youtubeUrl = this.cleanUrl(row.youtube_video_url);
    if (youtubeUrl) return { source: 'youtube', url: youtubeUrl };

    const zoomUrl = this.cleanUrl(row.zoom_recording_url);
    if (zoomUrl) return { source: 'zoom', url: zoomUrl };

    return undefined;
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private cleanUrl(value: string | null): string | undefined {
    const url = String(value ?? '').trim();
    return url || undefined;
 }

  private cleanText(value: string | null): string | undefined {
    const text = String(value ?? '').trim();
    return text || undefined;
 }

  private toOptionalNumber(value: number | string | null): number | undefined {
    if (value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isAccessType(value: unknown): value is StudentRecordingAccessType {
    return value === 'free' || value === 'paid';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
