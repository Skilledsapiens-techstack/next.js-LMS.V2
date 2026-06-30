import { ServiceUnavailableException } from "@app/common/runtime/errors";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AdminPaidAccessItemType, AdminPaidAccessListItemDto, AdminPaidAccessQueryDto, AdminPaidAccessStatus } from './dto/admin-paid-access.dto';

type AdminPaidAccessRow = {
  id?: string | null;
  access_id: string | null;
  student_email: string;
  item_type: AdminPaidAccessItemType;
  item_id: string;
  status: AdminPaidAccessStatus;
  source: string | null;
  payment_id: string | null;
  amount: number | string | null;
  currency: string | null;
  granted_at: string | null;
  expires_at: string | null;
  notes: string | null;
};
export class AdminPaidAccessService {
  constructor(private readonly supabase: SupabaseService) {}

  async listPaidAccess(query: AdminPaidAccessQueryDto): Promise<PaginatedResponse<AdminPaidAccessListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin
      .from('paid_access')
      .select(
        ['id', 'access_id', 'student_email', 'item_type', 'item_id', 'status', 'source', 'payment_id', 'amount', 'currency', 'granted_at', 'expires_at', 'notes'].join(','),
        { count: 'exact' }
      )
      .order('granted_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (query.itemType !== 'all') {
      request = request.eq('item_type', query.itemType);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(
        [
          `access_id.ilike.%${escapedSearch}%`,
          `student_email.ilike.%${escapedSearch}%`,
          `item_id.ilike.%${escapedSearch}%`,
          `payment_id.ilike.%${escapedSearch}%`,
          `notes.ilike.%${escapedSearch}%`
        ].join(',')
      );
   }

    const { data, error, count } = await request;

    if (error) {
      throw new ServiceUnavailableException(`Unable to load paid access grants: ${error.message}`);
   }

    return createPaginatedResponse(this.asAdminPaidAccessRows(data).map((row) => this.toAdminPaidAccessListItem(row)), page, limit, count ?? 0);
 }

  private asAdminPaidAccessRows(value: unknown): AdminPaidAccessRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminPaidAccessRow => {
      if (!this.isJsonObject(row)) return false;
      return (
        typeof row.student_email === 'string' &&
        this.isItemType(row.item_type) &&
        typeof row.item_id === 'string' &&
        this.isStatus(row.status) &&
        (row.amount === null || this.isNumericValue(row.amount))
      );
   });
 }

  private toAdminPaidAccessListItem(row: AdminPaidAccessRow): AdminPaidAccessListItemDto {
    return {
      id: row.id ?? row.access_id ?? `${row.student_email}:${row.item_type}:${row.item_id}`,
      accessId: row.access_id ?? undefined,
      studentEmail: this.normalizeEmail(row.student_email),
      itemType: row.item_type,
      itemId: row.item_id,
      status: row.status,
      activeNow: this.isActiveNow(row.status, row.expires_at),
      source: row.source ?? undefined,
      paymentId: row.payment_id ?? undefined,
      amount: row.amount === null ? undefined : this.toOptionalNumber(row.amount),
      currency: row.currency ?? undefined,
      grantedAt: row.granted_at ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      notes: row.notes ?? undefined
   };
 }

  private isActiveNow(status: AdminPaidAccessStatus, expiresAt: string | null): boolean {
    if (status !== 'active') return false;
    if (!expiresAt) return true;

    const parsed = Date.parse(expiresAt);
    return Number.isFinite(parsed) && parsed > Date.now();
 }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
 }

  private toOptionalNumber(value: number | string): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
 }

  private isNumericValue(value: unknown): value is number | string {
    if (typeof value !== 'number' && typeof value !== 'string') return false;
    return this.toOptionalNumber(value) !== undefined;
 }

  private isStatus(value: unknown): value is AdminPaidAccessStatus {
    return value === 'active' || value === 'inactive';
 }

  private isItemType(value: unknown): value is AdminPaidAccessItemType {
    return value === 'group' || value === 'workshop' || value === 'resource';
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }
}
