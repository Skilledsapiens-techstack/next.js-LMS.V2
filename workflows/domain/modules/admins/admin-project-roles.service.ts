import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AdminProjectRoleListItemDto, AdminProjectRolesQueryDto, AdminProjectRoleStatus } from './dto/admin-project-roles.dto';

type AdminProjectRoleRow = {
  role_id: string;
  role_name: string;
  role_category: string | null;
  program_key: string | null;
  status: AdminProjectRoleStatus;
  updated_at: string | null;
};
export class AdminProjectRolesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listProjectRoles(query: AdminProjectRolesQueryDto): Promise<PaginatedResponse<AdminProjectRoleListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('role_master')
      .select(['role_id', 'role_name', 'role_category', 'program_key', 'status', 'updated_at'].join(','), { count: 'exact' })
      .order('role_name', { ascending: true, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.programKey) {
      request = request.eq('program_key', query.programKey);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [`role_id.ilike.%${escapedSearch}%`, `role_name.ilike.%${escapedSearch}%`, `role_category.ilike.%${escapedSearch}%`, `program_key.ilike.%${escapedSearch}%`].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load project roles: ${error.message}`);
   }

    return createPaginatedResponse(this.asProjectRoleRows(data).map((row) => this.toProjectRoleListItem(row)), page, limit, count ?? 0);
 }

  private asProjectRoleRows(value: unknown): AdminProjectRoleRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminProjectRoleRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.role_id === 'string' && typeof row.role_name === 'string' && this.isStatus(row.status);
   });
 }

  private toProjectRoleListItem(row: AdminProjectRoleRow): AdminProjectRoleListItemDto {
    return {
      id: row.role_id,
      name: row.role_name,
      category: row.role_category ?? undefined,
      programKey: row.program_key ?? undefined,
      status: row.status,
      updatedAt: row.updated_at ?? undefined
   };
 }

  private isStatus(value: unknown): value is AdminProjectRoleStatus {
    return value === 'active' || value === 'inactive';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
