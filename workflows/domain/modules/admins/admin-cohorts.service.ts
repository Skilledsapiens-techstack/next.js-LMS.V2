import { ConflictException, ServiceUnavailableException } from "@app/common/runtime/errors";
import { ConfigService } from "@app/common/runtime/config";
import { createPaginatedResponse, PaginatedResponse } from '../../common/dto/pagination.dto';
import { JsonObject, JsonValue } from '../../common/types/json.types';
import { escapePostgrestPattern, normalizeSearch } from '../../common/utils/search-query.util';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AdminCohortListItemDto, AdminCohortsQueryDto, AdminCohortSort, AdminCohortStatus, AdminCreateCohortDto, AdminUpdateCohortDto } from './dto/admin-cohorts.dto';

type AdminCohortRow = {
  id: string;
  cohort_id: string | null;
  name: string;
  program_key: string | null;
  domain_key: string | null;
  status: AdminCohortStatus;
  start_date: string | null;
  end_date: string | null;
  student_count: number | null;
  wa_link: string | null;
  wa_group_name: string | null;
  google_group: string | null;
  self_paced: boolean;
  sp_sessions: JsonValue[] | null;
  sp_resources: JsonValue[] | null;
  updated_at: string | null;
};

type CohortQueryBuilder = {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): CohortQueryBuilder;
  range(from: number, to: number): PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }>;
};

type CohortSingleQueryBuilder = {
  select(columns: string, options?: { count?: 'exact' }): CohortSingleQueryBuilder;
  eq(column: string, value: string): CohortSingleQueryBuilder;
  single(): Promise<{ data: unknown; error: { message: string } | null }>;
};

type CohortInsertRow = {
  cohort_id?: string;
  name: string;
  program_key: string;
  domain_key?: string;
  status: AdminCohortStatus;
  start_date?: string;
  end_date?: string;
  student_count: number;
  wa_link?: string;
  wa_group_name?: string;
  google_group?: string;
  self_paced: boolean;
  sp_sessions: JsonValue[];
  sp_resources: JsonValue[];
  updated_at: string;
};

type CohortUpdateRow = Partial<Omit<CohortInsertRow, 'self_paced' | 'sp_sessions' | 'sp_resources'>> & {
  self_paced?: boolean;
  sp_sessions?: JsonValue[];
  sp_resources?: JsonValue[];
};

const PROGRAM_ALIASES: Record<string, string[]> = {
  consulting: ['consulting', 'mclp'],
  finance_er: ['finance_er', 'flp_er'],
  finance_qf: ['finance_qf', 'flp_qf'],
  gd_pi: ['gd_pi', 'gdpi'],
  hr: ['hr', 'hrlp'],
  hr_projects: ['hr_projects', 'hrlp_projects'],
  management_projects: ['management_projects', 'mgmt_projects'],
  placement: ['placement'],
  product: ['product', 'pmlp'],
  sales_marketing: ['sales_marketing', 'smlp']
};
export class AdminCohortsService {
  private readonly cohortSelectColumns = [
    'id',
    'cohort_id',
    'name',
    'program_key',
    'domain_key',
    'status',
    'start_date',
    'end_date',
    'student_count',
    'wa_link',
    'wa_group_name',
    'google_group',
    'self_paced',
    'sp_sessions',
    'sp_resources',
    'updated_at'
  ].join(',');

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService
  ) {}

  async listCohorts(query: AdminCohortsQueryDto): Promise<PaginatedResponse<AdminCohortListItemDto>> {
    const page = query.page;
    const limit = query.limit;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const search = normalizeSearch(query.search);

    let request = this.supabase.admin.from('cohorts').select(this.cohortSelectColumns, { count: 'exact' });

    if (query.status !== 'all') {
      request = request.eq('status', query.status);
   }

    if (search) {
      const escapedSearch = escapePostgrestPattern(search);
      request = request.or(`name.ilike.%${escapedSearch}%,program_key.ilike.%${escapedSearch}%,domain_key.ilike.%${escapedSearch}%`);
   }

    if (query.program) {
      const keys = this.programFilterKeys(query.program);
      request = request.or(`program_key.in.(${keys.join(',')}),domain_key.in.(${keys.join(',')})`);
   }

    const sortedRequest = this.applySort(request, query.sort ?? 'name');

    const { data, error, count } = await sortedRequest.range(from, to);

    if (error) {
      throw new ServiceUnavailableException(`Unable to load cohorts: ${error.message}`);
   }

    return createPaginatedResponse(this.asAdminCohortRows(data).map((row) => this.toAdminCohortListItem(row)), page, limit, count ?? 0);
 }

  async createCohort(input: AdminCreateCohortDto, adminEmail: string): Promise<AdminCohortListItemDto> {
    this.assertWritesEnabled();

    const now = new Date().toISOString();
    const row = this.toCohortInsertRow(input, now);

    const { data, error } = await this.supabase.admin
      .from('cohorts')
      .insert(row)
      .select(this.cohortSelectColumns)
      .single();

    if (error) {
      throw new ConflictException(`Unable to create cohort: ${error.message}`);
   }

    const created = this.asAdminCohortRows([data])[0];
    if (!created) {
      throw new ServiceUnavailableException('Cohort was created, but the created row could not be read back safely.');
   }

    await this.recordAudit('cohort.created', adminEmail, created.id, null, created);

    return this.toAdminCohortListItem(created);
 }

  async updateCohort(cohortId: string, input: AdminUpdateCohortDto, adminEmail: string): Promise<AdminCohortListItemDto> {
    this.assertWritesEnabled();

    const previous = await this.loadCohortById(cohortId);
    const row = this.toCohortUpdateRow(input, previous, new Date().toISOString());

    if (Object.keys(row).length === 1 && row.updated_at) {
      throw new ConflictException('At least one cohort field must be changed.');
   }

    const { data, error } = await this.supabase.admin.from('cohorts').update(row).eq('id', cohortId).select(this.cohortSelectColumns).single();

    if (error) {
      throw new ConflictException(`Unable to update cohort: ${error.message}`);
   }

    const updated = this.asAdminCohortRows([data])[0];
    if (!updated) {
      throw new ServiceUnavailableException('Cohort was updated, but the updated row could not be read back safely.');
   }

    await this.recordAudit('cohort.updated', adminEmail, updated.id, previous, updated);

    return this.toAdminCohortListItem(updated);
 }

  async updateCohortStatus(cohortId: string, status: AdminCohortStatus, adminEmail: string): Promise<AdminCohortListItemDto> {
    this.assertWritesEnabled();

    const previous = await this.loadCohortById(cohortId);
    const { data, error } = await this.supabase.admin
      .from('cohorts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', cohortId)
      .select(this.cohortSelectColumns)
      .single();

    if (error) {
      throw new ConflictException(`Unable to update cohort status: ${error.message}`);
   }

    const updated = this.asAdminCohortRows([data])[0];
    if (!updated) {
      throw new ServiceUnavailableException('Cohort status was updated, but the updated row could not be read back safely.');
   }

    await this.recordAudit(status === 'inactive' ? 'cohort.deactivated' : 'cohort.status_updated', adminEmail, updated.id, previous, updated);

    return this.toAdminCohortListItem(updated);
 }

  private assertWritesEnabled() {
    if (!this.config.get<boolean>('COHORT_WRITES_ENABLED')) {
      throw new ServiceUnavailableException('Cohort writes are disabled. No Supabase write was attempted.');
   }
 }

  private async loadCohortById(cohortId: string): Promise<AdminCohortRow> {
    const id = this.cleanText(cohortId);
    if (!id) {
      throw new ConflictException('Cohort ID is required.');
   }

    const { data, error } = await (this.supabase.admin.from('cohorts') as unknown as CohortSingleQueryBuilder).select(this.cohortSelectColumns).eq('id', id).single();

    if (error) {
      throw new ServiceUnavailableException(`Unable to load cohort before write: ${error.message}`);
   }

    const row = this.asAdminCohortRows([data])[0];
    if (!row) {
      throw new ServiceUnavailableException('Cohort could not be read safely before write.');
   }

    return row;
 }

  private toCohortInsertRow(input: AdminCreateCohortDto, now: string): CohortInsertRow {
    const name = this.cleanText(input.name);
    const programKey = this.cleanText(input.programKey);

    if (!name || !programKey) {
      throw new ConflictException('Cohort name and program key are required.');
   }

    const selfPaced = input.selfPaced === true;

    return this.withOptionalFields(
      {
        name,
        program_key: programKey,
        status: input.status,
        student_count: input.studentCount ?? 0,
        self_paced: selfPaced,
        sp_sessions: selfPaced ? this.cleanJsonArray(input.selfPacedSessions) : [],
        sp_resources: selfPaced ? this.cleanJsonArray(input.selfPacedResources) : [],
        updated_at: now
     },
      {
        cohort_id: this.cleanText(input.cohortId),
        domain_key: this.cleanText(input.domainKey ?? input.programKey),
        start_date: this.cleanText(input.startDate),
        end_date: this.cleanText(input.endDate),
        wa_link: this.cleanText(input.waLink),
        wa_group_name: this.cleanText(input.waGroupName),
        google_group: this.cleanText(input.googleGroup)
     }
    );
 }

  private toCohortUpdateRow(input: AdminUpdateCohortDto, previous: AdminCohortRow, now: string): CohortUpdateRow {
    const row: CohortUpdateRow = { updated_at: now };

    if (this.hasOwn(input, 'cohortId')) row.cohort_id = this.cleanText(input.cohortId);
    if (this.hasOwn(input, 'name')) {
      const name = this.cleanText(input.name);
      if (!name) throw new ConflictException('Cohort name is required.');
      row.name = name;
   }
    if (this.hasOwn(input, 'programKey')) {
      const programKey = this.cleanText(input.programKey);
      if (!programKey) throw new ConflictException('Program key is required.');
      row.program_key = programKey;
   }
    if (this.hasOwn(input, 'domainKey')) row.domain_key = this.cleanText(input.domainKey ?? input.programKey);
    if (this.hasOwn(input, 'status') && input.status) row.status = input.status;
    if (this.hasOwn(input, 'startDate')) row.start_date = this.cleanText(input.startDate);
    if (this.hasOwn(input, 'endDate')) row.end_date = this.cleanText(input.endDate);
    if (this.hasOwn(input, 'studentCount')) row.student_count = input.studentCount ?? 0;
    if (this.hasOwn(input, 'waLink')) row.wa_link = this.cleanText(input.waLink);
    if (this.hasOwn(input, 'waGroupName')) row.wa_group_name = this.cleanText(input.waGroupName);
    if (this.hasOwn(input, 'googleGroup')) row.google_group = this.cleanText(input.googleGroup);

    if (this.hasOwn(input, 'selfPaced') || this.hasOwn(input, 'selfPacedSessions') || this.hasOwn(input, 'selfPacedResources')) {
      const selfPaced = input.selfPaced ?? previous.self_paced;
      row.self_paced = selfPaced;
      row.sp_sessions = selfPaced ? this.cleanJsonArray(input.selfPacedSessions ?? previous.sp_sessions ?? []) : [];
      row.sp_resources = selfPaced ? this.cleanJsonArray(input.selfPacedResources ?? previous.sp_resources ?? []) : [];
   }

    return row;
 }

  private asAdminCohortRows(value: unknown): AdminCohortRow[] {
    if (!Array.isArray(value)) return [];

    return value.filter((row): row is AdminCohortRow => {
      if (!this.isJsonObject(row)) return false;
      return typeof row.id === 'string' && typeof row.name === 'string' && this.isCohortStatus(row.status) && typeof row.self_paced === 'boolean';
   });
 }

  private toAdminCohortListItem(row: AdminCohortRow): AdminCohortListItemDto {
    return {
      id: row.id,
      cohortId: row.cohort_id ?? undefined,
      name: row.name,
      programKey: row.program_key ?? undefined,
      domainKey: row.domain_key ?? undefined,
      status: row.status,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      studentCount: row.student_count ?? 0,
      waLink: row.wa_link ?? undefined,
      waGroupName: row.wa_group_name ?? undefined,
      googleGroup: row.google_group ?? undefined,
      selfPaced: row.self_paced,
      selfPacedSessions: Array.isArray(row.sp_sessions) ? row.sp_sessions : [],
      selfPacedResources: Array.isArray(row.sp_resources) ? row.sp_resources : [],
      updatedAt: row.updated_at ?? undefined
   };
 }

  private isCohortStatus(value: unknown): value is AdminCohortStatus {
    return value === 'upcoming' || value === 'active' || value === 'completed' || value === 'inactive';
 }

  private applySort(request: CohortQueryBuilder, sort: AdminCohortSort): CohortQueryBuilder {
    if (sort === 'students_desc') return request.order('student_count', { ascending: false, nullsFirst: false }).order('name', { ascending: true });
    if (sort === 'students_asc') return request.order('student_count', { ascending: true, nullsFirst: false }).order('name', { ascending: true });
    if (sort === 'start_newest') return request.order('start_date', { ascending: false, nullsFirst: false }).order('name', { ascending: true });
    if (sort === 'start_oldest') return request.order('start_date', { ascending: true, nullsFirst: false }).order('name', { ascending: true });
    if (sort === 'program') {
      return request.order('domain_key', { ascending: true, nullsFirst: false }).order('program_key', { ascending: true, nullsFirst: false }).order('name', { ascending: true });
   }

    return request.order('name', { ascending: true });
 }

  private programFilterKeys(program: string): string[] {
    const normalized = program.trim().toLowerCase().replace(/[-\s]+/g, '_');
    return Array.from(new Set(PROGRAM_ALIASES[normalized] ?? [normalized])).filter((value) => /^[a-z0-9_]+$/.test(value));
 }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
 }

  private cleanText(value: string | undefined): string | undefined {
    const text = String(value ?? '').trim();
    return text || undefined;
 }

  private cleanJsonArray(value: JsonValue[] | undefined): JsonValue[] {
    return Array.isArray(value) ? value.filter((item): item is JsonValue => item !== null && item !== undefined) : [];
 }

  private normalizeEmail(value: string): string | undefined {
    const email = value.trim().toLowerCase();
    return email || undefined;
 }

  private hasOwn(value: object, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
 }

  private summarizeCohort(row: AdminCohortRow) {
    return {
      cohortId: row.cohort_id,
      name: row.name,
      programKey: row.program_key,
      domainKey: row.domain_key,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      studentCount: row.student_count ?? 0,
      waGroupName: row.wa_group_name,
      googleGroup: row.google_group,
      selfPaced: row.self_paced,
      selfPacedSessionCount: Array.isArray(row.sp_sessions) ? row.sp_sessions.length : 0,
      selfPacedResourceCount: Array.isArray(row.sp_resources) ? row.sp_resources.length : 0
   };
 }

  private async recordAudit(action: string, adminEmail: string, entityId: string, previous: AdminCohortRow | null, next: AdminCohortRow) {
    const auditResult = await this.supabase.admin.from('audit_logs').insert({
      actor_email: this.normalizeEmail(adminEmail) ?? 'unknown-admin',
      actor_role: 'admin',
      action,
      entity_type: 'cohorts',
      entity_id: entityId,
      status: 'success',
      details: {
        previousState: previous ? this.summarizeCohort(previous) : null,
        nextState: this.summarizeCohort(next)
     }
   });

    if (auditResult.error) {
      throw new ServiceUnavailableException(`Cohort write completed, but audit logging failed: ${auditResult.error.message}`);
   }
 }

  private withOptionalFields(base: CohortInsertRow, optional: Partial<CohortInsertRow>): CohortInsertRow {
    Object.entries(optional).forEach(([key, value]) => {
      if (value !== undefined) {
        (base as Record<string, unknown>)[key] = value;
     }
   });
    return base;
 }
}
