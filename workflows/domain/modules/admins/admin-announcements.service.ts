import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { 
  AdminAnnouncementAudience,
  AdminAnnouncementListItemDto,
  AdminAnnouncementPriority,
  AdminAnnouncementsQueryDto,
  AdminAnnouncementStatus
 } from './dto/admin-announcements.dto';

type AdminAnnouncementRow = {
  id: string;
  announcement_id: string | null;
  type: string | null;
  title: string;
  message: string;
  audience: AdminAnnouncementAudience;
  program_keys: string[] | null;
  cohort_names: string[] | null;
  priority: AdminAnnouncementPriority;
  status: AdminAnnouncementStatus;
  pinned: boolean | null;
  start_date: string | null;
  end_date: string | null;
  link_label: string | null;
  link_url: string | null;
  updated_at: string | null;
};
export class AdminAnnouncementsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listAnnouncements(query: AdminAnnouncementsQueryDto): Promise<PaginatedResponse<AdminAnnouncementListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('announcements')
      .select(
        [
          'id',
          'announcement_id',
          'type',
          'title',
          'message',
          'audience',
          'program_keys',
          'cohort_names',
          'priority',
          'status',
          'pinned',
          'start_date',
          'end_date',
          'link_label',
          'link_url',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('pinned', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.priority !== 'all') {
      request = request.eq('priority', query.priority);
   }

    if (query.audience !== 'any') {
      request = request.eq('audience', query.audience);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(`title.ilike.%${escapedSearch}%,message.ilike.%${escapedSearch}%,type.ilike.%${escapedSearch}%`);
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load announcements: ${error.message}`);
   }

    return createPaginatedResponse(this.asAnnouncementRows(data).map((row) => this.toAnnouncementListItem(row)), page, limit, count ?? 0);
 }

  private asAnnouncementRows(value: unknown): AdminAnnouncementRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminAnnouncementRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.title === 'string' &&
        typeof row.message === 'string' &&
        this.isAudience(row.audience) &&
        this.isPriority(row.priority) &&
        this.isStatus(row.status)
      );
   });
 }

  private toAnnouncementListItem(row: AdminAnnouncementRow): AdminAnnouncementListItemDto {
    return {
      id: row.id,
      announcementId: row.announcement_id ?? undefined,
      type: row.type ?? undefined,
      title: row.title,
      message: row.message,
      audience: row.audience,
      programKeys: Array.isArray(row.program_keys) ? row.program_keys : [],
      cohortNames: Array.isArray(row.cohort_names) ? row.cohort_names : [],
      priority: row.priority,
      status: row.status,
      pinned: row.pinned === true,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      linkLabel: row.link_label ?? undefined,
      linkUrl: row.link_url ?? undefined,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private isAudience(value: unknown): value is AdminAnnouncementAudience {
    return value === 'all' || value === 'program' || value === 'cohort';
 }

  private isPriority(value: unknown): value is AdminAnnouncementPriority {
    return value === 'normal' || value === 'important' || value === 'urgent';
 }

  private isStatus(value: unknown): value is AdminAnnouncementStatus {
    return value === 'active' || value === 'inactive';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
