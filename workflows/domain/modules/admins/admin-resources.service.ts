import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AdminResourceAccessType, AdminResourceListItemDto, AdminResourcesQueryDto, AdminResourceStatus } from './dto/admin-resources.dto';

type AdminResourceRow = {
  id: string;
  resource_id: string | null;
  title: string;
  description: string | null;
  resource_type: string;
  resource_mode: string | null;
  phase: string | null;
  program_keys: string[] | null;
  domain_key: string | null;
  cohort_names: string[] | null;
  url: string | null;
  access_type: AdminResourceAccessType;
  price: number | string | null;
  currency: string;
  status: AdminResourceStatus;
  updated_at: string | null;
};
export class AdminResourcesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listResources(query: AdminResourcesQueryDto): Promise<PaginatedResponse<AdminResourceListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('resources')
      .select(
        [
          'id',
          'resource_id',
          'title',
          'description',
          'resource_type',
          'resource_mode',
          'phase',
          'program_keys',
          'domain_key',
          'cohort_names',
          'url',
          'access_type',
          'price',
          'currency',
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

    if (query.accessType !== 'all') {
      request = request.eq('access_type', query.accessType);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(`title.ilike.%${escapedSearch}%,resource_type.ilike.%${escapedSearch}%,domain_key.ilike.%${escapedSearch}%`);
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load resources: ${error.message}`);
   }

    return createPaginatedResponse(this.asAdminResourceRows(data).map((row) => this.toAdminResourceListItem(row)), page, limit, count ?? 0);
 }

  private asAdminResourceRows(value: unknown): AdminResourceRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminResourceRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.id === 'string' &&
        typeof row.title === 'string' &&
        typeof row.resource_type === 'string' &&
        typeof row.currency === 'string' &&
        this.isAccessType(row.access_type) &&
        this.isResourceStatus(row.status)
      );
   });
 }

  private toAdminResourceListItem(row: AdminResourceRow): AdminResourceListItemDto {
    return {
      id: row.id,
      resourceId: row.resource_id ?? undefined,
      title: row.title,
      description: row.description ?? undefined,
      resourceType: row.resource_type,
      resourceMode: row.resource_mode ?? undefined,
      phase: row.phase ?? undefined,
      programKeys: Array.isArray(row.program_keys) ? row.program_keys : [],
      domainKey: row.domain_key ?? undefined,
      cohortNames: Array.isArray(row.cohort_names) ? row.cohort_names : [],
      url: row.url ?? undefined,
      accessType: row.access_type,
      price: this.toOptionalNumber(row.price),
      currency: row.currency,
      status: row.status,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private toOptionalNumber(value: number | string | null): number | undefined {
    if (value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isAccessType(value: unknown): value is AdminResourceAccessType {
    return value === 'free' || value === 'paid';
 }

  private isResourceStatus(value: unknown): value is AdminResourceStatus {
    return value === 'active' || value === 'inactive';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
