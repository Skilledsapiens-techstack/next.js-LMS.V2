import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AdminProgramListItemDto, AdminProgramsQueryDto, AdminProgramStatus } from './dto/admin-programs.dto';

type AdminProgramRow = {
  id: string;
  program_key: string;
  name: string;
  short_name: string | null;
  domain_label: string | null;
  status: AdminProgramStatus;
  updated_at: string | null;
};
export class AdminProgramsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listPrograms(query: AdminProgramsQueryDto): Promise<PaginatedResponse<AdminProgramListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('programs')
      .select(['id', 'program_key', 'name', 'short_name', 'domain_label', 'status', 'updated_at'].join(','), { count: 'exact' })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(`program_key.ilike.%${escapedSearch}%,name.ilike.%${escapedSearch}%,short_name.ilike.%${escapedSearch}%`);
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load programs: ${error.message}`);
   }

    return createPaginatedResponse(this.asAdminProgramRows(data).map((row) => this.toAdminProgramListItem(row)), page, limit, count ?? 0);
 }

  private asAdminProgramRows(value: unknown): AdminProgramRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminProgramRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && typeof row.program_key === 'string' && typeof row.name === 'string' && this.isProgramStatus(row.status);
   });
 }

  private toAdminProgramListItem(row: AdminProgramRow): AdminProgramListItemDto {
    return {
      id: row.id,
      programKey: row.program_key,
      name: row.name,
      shortName: row.short_name ?? undefined,
      domainLabel: row.domain_label ?? undefined,
      status: row.status,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private isProgramStatus(value: unknown): value is AdminProgramStatus {
    return value === 'active' || value === 'inactive';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
