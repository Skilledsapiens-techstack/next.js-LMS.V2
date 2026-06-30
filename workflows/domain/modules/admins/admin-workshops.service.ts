import { ConflictException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AdminWorkshopAccessType, AdminWorkshopListItemDto, AdminWorkshopsQueryDto, AdminWorkshopStatus } from './dto/admin-workshops.dto';
import { WorkshopStatusTransitionWorkflow } from '../workshops/workshop-status-transition.workflow';

type AdminWorkshopRow = {
  id: string;
  workshop_id: string | null;
  title: string;
  date: string;
  time: string | null;
  duration_minutes: number | string | null;
  program_key: string | null;
  domain_key: string | null;
  cohort_names: string[] | null;
  join_url: string | null;
  workshop_status: AdminWorkshopStatus;
  zoom_id: string | null;
  zoom_account: string | null;
  zoom_label: string | null;
  youtube_video_url: string | null;
  zoom_recording_url: string | null;
  access_type: AdminWorkshopAccessType;
  price: number | string | null;
  currency: string | null;
  payment_link: string | null;
  updated_at: string | null;
};
export class AdminWorkshopsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly workshopStatusTransitionWorkflow: WorkshopStatusTransitionWorkflow
  ) {}

  async listWorkshops(query: AdminWorkshopsQueryDto): Promise<PaginatedResponse<AdminWorkshopListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('workshops')
      .select(
        [
          'id',
          'workshop_id',
          'title',
          'date',
          'time',
          'duration_minutes',
          'program_key',
          'domain_key',
          'cohort_names',
          'join_url',
          'workshop_status',
          'zoom_id',
          'zoom_account',
          'zoom_label',
          'youtube_video_url',
          'zoom_recording_url',
          'access_type',
          'price',
          'currency',
          'payment_link',
          'updated_at'
        ].join(','),
        { count: 'exact' }
      )
      .order('date', { ascending: false, nullsFirst: false })
      .order('time', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('workshop_status', query.status);
   }

    if (query.accessType !== 'all') {
      request = request.eq('access_type', query.accessType);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(`title.ilike.%${escapedSearch}%,workshop_id.ilike.%${escapedSearch}%,program_key.ilike.%${escapedSearch}%,domain_key.ilike.%${escapedSearch}%,zoom_id.ilike.%${escapedSearch}%`);
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load workshops: ${error.message}`);
   }

    return createPaginatedResponse(this.asWorkshopRows(data).map((row) => this.toWorkshopListItem(row)), page, limit, count ?? 0);
 }

  async markWorkshopCompleted(workshopId: string, adminEmail: string) {
    const result = await this.workshopStatusTransitionWorkflow.transitionStatus({
      adminEmail,
      nextStatus: 'Completed',
      workshopId
   });

    if (result.status === 'updated' || result.status === 'skipped') {
      return result;
   }

    if (result.status === 'disabled' || result.status === 'failed') {
      throw new ServiceUnavailableException(result.message);
   }

    throw new ConflictException(result.message);
 }

  private asWorkshopRows(value: unknown): AdminWorkshopRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminWorkshopRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.title === 'string' &&
        typeof row.date === 'string' &&
        this.isWorkshopStatus(row.workshop_status) &&
        this.isAccessType(row.access_type)
      );
   });
 }

  private toWorkshopListItem(row: AdminWorkshopRow): AdminWorkshopListItemDto {
    const item: AdminWorkshopListItemDto = {
      id: row.id,
      title: row.title,
      date: row.date,
      cohortNames: Array.isArray(row.cohort_names) ? row.cohort_names : [],
      status: row.workshop_status,
      accessType: row.access_type
   };

    const durationMinutes = this.toOptionalNumber(row.duration_minutes);
    const price = this.toOptionalNumber(row.price);

    if (row.workshop_id) item.workshopId = row.workshop_id;
    if (row.time) item.time = row.time;
    if (durationMinutes !== undefined) item.durationMinutes = durationMinutes;
    if (row.program_key) item.programKey = row.program_key;
    if (row.domain_key) item.domainKey = row.domain_key;
    if (row.join_url) item.joinUrl = row.join_url;
    if (row.zoom_id) item.zoomId = row.zoom_id;
    if (row.zoom_account) item.zoomAccount = row.zoom_account;
    if (row.zoom_label) item.zoomLabel = row.zoom_label;
    if (row.youtube_video_url) item.youtubeVideoUrl = row.youtube_video_url;
    if (row.zoom_recording_url) item.zoomRecordingUrl = row.zoom_recording_url;
    if (price !== undefined) item.price = price;
    if (row.currency) item.currency = row.currency;
    if (row.payment_link) item.paymentLink = row.payment_link;
    if (row.updated_at) item.updatedAt = row.updated_at;

    return item;
 }

  private toOptionalNumber(value: number | string | null): number | undefined {
    if (value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isAccessType(value: unknown): value is AdminWorkshopAccessType {
    return value === 'free' || value === 'paid';
 }

  private isWorkshopStatus(value: unknown): value is AdminWorkshopStatus {
    return value === 'Upcoming' || value === 'Scheduled' || value === 'Live' || value === 'Completed' || value === 'Cancelled' || value === 'Inactive';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
