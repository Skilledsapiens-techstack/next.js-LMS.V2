import { getSupabaseClient, getSupabaseClientForAccessToken } from './supabaseClient';
import { webEnv } from '../config/env';

export type ApiClientOptions = {
  accessToken?: string;
  query?: Record<string, string | number | boolean | undefined>;
};

export type ApiMutationOptions<TBody = unknown> = ApiClientOptions & {
  body?: TBody;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type SupabaseQuery = {
  eq: (column: string, value: unknown) => SupabaseQuery;
  gte: (column: string, value: unknown) => SupabaseQuery;
  lt: (column: string, value: unknown) => SupabaseQuery;
  or: (filters: string) => SupabaseQuery;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery;
};

// Keeps existing feature hooks stable while the data layer moves from HTTP routes to Supabase tables/RPCs.
const STUDENT_BUNDLE_SECTIONS: Record<string, string[]> = {
  '/students/me/announcements': ['announcements', 'announcementList', 'studentAnnouncements'],
  '/students/me/cohorts': ['cohorts', 'studentCohorts'],
  '/students/me/recordings': ['recordings', 'workshopRecordings', 'workshops']
};

const RPC_LIST_ENDPOINTS: Record<string, { functionName: string; section?: string[] }> = {
  '/students/me/projects': { functionName: 'student_projects_bundle', section: ['projects', 'items'] },
  '/students/me/resources': { functionName: 'student_resources_view', section: ['resources', 'items'] },
  '/students/me/schedule': { functionName: 'student_schedule_view', section: ['schedule', 'items'] }
};

type TableEndpoint = {
  filterColumns?: Record<string, string>;
  filterValues?: Record<string, (value: string | number | boolean) => string | number | boolean | undefined>;
  searchColumns: string[];
  sortColumns?: Record<string, { ascending: boolean; column: string }>;
  studentOwned?: boolean;
  table: string;
};

const TABLE_ENDPOINTS: Record<string, TableEndpoint> = {
  '/admins/announcements': { table: 'announcements', searchColumns: ['title', 'message', 'audience'] },
  '/admins/certificate-requests': { table: 'certificate_requests', searchColumns: ['student_email', 'student_name', 'program_name'] },
  '/admins/certificates': { table: 'certificates', searchColumns: ['student_email', 'student_name', 'program_name', 'project_title'] },
  '/admins/cohorts': {
    table: 'cohorts',
    filterColumns: { program: 'program_key' },
    searchColumns: ['name', 'program_key', 'domain_key'],
    sortColumns: {
      name: { column: 'name', ascending: true },
      program: { column: 'program_key', ascending: true },
      start_newest: { column: 'start_date', ascending: false },
      start_oldest: { column: 'start_date', ascending: true },
      students_asc: { column: 'student_count', ascending: true },
      students_desc: { column: 'student_count', ascending: false }
    }
  },
  '/admins/enrollment-exceptions': { table: 'enrollment_exceptions', searchColumns: ['student_email', 'exception_type', 'notes'] },
  '/admins/enrollment-requests': { table: 'enrollment_requests', searchColumns: ['student_email', 'student_name', 'request_id'] },
  '/admins/enrollment-webhook-events': { table: 'enrollment_webhook_events', searchColumns: ['event_id', 'payment_id', 'order_id'] },
  '/admins/paid-access': { table: 'paid_access', searchColumns: ['student_email', 'item_id', 'item_type'] },
  '/admins/payment-orders': { table: 'payment_orders', searchColumns: ['student_email', 'item_id', 'item_type', 'razorpay_order_id'] },
  '/admins/programs': { table: 'programs', searchColumns: ['program_key', 'program_name', 'name'] },
  '/admins/project-roles': { table: 'role_master', filterColumns: { category: 'role_category' }, searchColumns: ['role_name', 'program_key', 'role_category'] },
  '/admins/project-submissions': {
    table: 'project_submission_requests',
    filterValues: { status: (value) => (value === 'pending' ? 'submitted' : value === 'duplicates' ? undefined : value) },
    searchColumns: ['student_email', 'student_name', 'project_title', 'request_number']
  },
  '/admins/projects': { table: 'projects', searchColumns: ['title', 'company_name', 'program_key'] },
  '/admins/recording-candidates': { table: 'workshop_recording_candidates', searchColumns: ['workshop_id', 'zoom_id', 'zoom_account'] },
  '/admins/resources': { table: 'resources', searchColumns: ['title', 'resource_type', 'domain_key'] },
  '/admins/students': {
    table: 'students',
    filterColumns: { status: 'active' },
    filterValues: { status: (value) => (value === 'active' ? true : value === 'inactive' ? false : undefined) },
    searchColumns: ['full_name', 'email', 'student_id', 'cohort_name', 'program_name']
  },
  '/admins/support-tickets': { table: 'support_tickets', filterColumns: { category: 'category_name' }, searchColumns: ['subject', 'student_email', 'category_name'] },
  '/admins/workshops': { table: 'workshops', filterColumns: { status: 'workshop_status' }, searchColumns: ['title', 'program_key', 'workshop_id', 'zoom_id'] },
  '/students/me/certificates': { table: 'certificates', searchColumns: ['program_name', 'project_title'], studentOwned: true },
  '/students/me/paid-access': { table: 'paid_access', searchColumns: ['item_id', 'item_type'], studentOwned: true },
  '/students/me/payment-orders': { table: 'payment_orders', searchColumns: ['item_id', 'item_type', 'razorpay_order_id'], studentOwned: true },
  '/students/me/project-submissions': { table: 'project_submission_requests', searchColumns: ['project_title', 'request_number'], studentOwned: true },
  '/students/me/support-tickets': { table: 'support_tickets', searchColumns: ['subject', 'category_name'], studentOwned: true }
};

export async function apiGet<TResponse>(path: string, options: ApiClientOptions = {}): Promise<TResponse> {
  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);

  if (cleanPath === '/students/me') return getStudentProfile(context) as Promise<TResponse>;
  if (cleanPath === '/admins/me') return getAdminProfile(context) as Promise<TResponse>;
  if (cleanPath === '/students/me/dashboard') return getStudentDashboard(context) as Promise<TResponse>;
  if (cleanPath === '/admins/dashboard') return getAdminDashboard(context) as Promise<TResponse>;

  const studentTicketMatch = cleanPath.match(/^\/students\/me\/support-tickets\/(.+)$/);
  if (studentTicketMatch) return getSupportTicketDetail(context, decodeURIComponent(studentTicketMatch[1]), false) as Promise<TResponse>;

  const adminTicketMatch = cleanPath.match(/^\/admins\/support-tickets\/(.+)$/);
  if (adminTicketMatch) return getSupportTicketDetail(context, decodeURIComponent(adminTicketMatch[1]), true) as Promise<TResponse>;

  const enrollmentMatch = cleanPath.match(/^\/admins\/enrollment-requests\/(.+)$/);
  if (enrollmentMatch) return getEnrollmentDetail(context, decodeURIComponent(enrollmentMatch[1])) as Promise<TResponse>;

  if (STUDENT_BUNDLE_SECTIONS[cleanPath]) {
    return getStudentBundleList(context, STUDENT_BUNDLE_SECTIONS[cleanPath], options.query) as Promise<TResponse>;
  }

  if (RPC_LIST_ENDPOINTS[cleanPath]) {
    return getRpcList(context, RPC_LIST_ENDPOINTS[cleanPath], options.query) as Promise<TResponse>;
  }

  if (TABLE_ENDPOINTS[cleanPath]) {
    return getTableList(context, TABLE_ENDPOINTS[cleanPath], options.query) as Promise<TResponse>;
  }

  throw new ApiClientError(`Unsupported Supabase route: ${cleanPath}`, 404);
}

export async function apiPatch<TResponse, TBody = unknown>(path: string, options: ApiMutationOptions<TBody> = {}): Promise<TResponse> {
  if (!webEnv.writeActionsEnabled) {
    return { message: 'Write actions are disabled in this environment.', status: 'disabled' } as TResponse;
  }

  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);

  const studentStatus = cleanPath.match(/^\/admins\/students\/([^/]+)\/status$/);
  if (studentStatus) return updateById(context, 'students', studentStatus[1], options.body) as Promise<TResponse>;

  const studentUpdate = cleanPath.match(/^\/admins\/students\/([^/]+)$/);
  if (studentUpdate) return updateById(context, 'students', studentUpdate[1], options.body) as Promise<TResponse>;

  const cohortStatus = cleanPath.match(/^\/admins\/cohorts\/([^/]+)\/status$/);
  if (cohortStatus) return updateById(context, 'cohorts', cohortStatus[1], options.body) as Promise<TResponse>;

  const cohortUpdate = cleanPath.match(/^\/admins\/cohorts\/([^/]+)$/);
  if (cohortUpdate) return updateById(context, 'cohorts', cohortUpdate[1], options.body) as Promise<TResponse>;

  throw new ApiClientError(`Unsupported Supabase write route: ${cleanPath}`, 404);
}

export async function apiPost<TResponse, TBody = unknown>(path: string, options: ApiMutationOptions<TBody> = {}): Promise<TResponse> {
  if (!webEnv.writeActionsEnabled) {
    return { message: 'Write actions are disabled in this environment.', status: 'disabled' } as TResponse;
  }

  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);

  if (cleanPath === '/admins/students') return insertRow(context, 'students', options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/cohorts') return insertRow(context, 'cohorts', options.body) as Promise<TResponse>;

  throw new ApiClientError(`Unsupported Supabase write route: ${cleanPath}`, 404);
}

async function createContext(accessToken?: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new ApiClientError('Supabase is not configured.', 503);
  if (!accessToken) throw new ApiClientError('Supabase access token is required.', 401);

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) throw new ApiClientError('Supabase session is invalid.', 401);

  const userSupabase = getSupabaseClientForAccessToken(accessToken);
  if (!userSupabase) throw new ApiClientError('Supabase is not configured.', 503);

  const email = normalizeEmail(data.user.email);
  return { accessToken, email, supabase: userSupabase, userId: data.user.id };
}

async function getStudentProfile(context: Awaited<ReturnType<typeof createContext>>) {
  const { data, error } = await context.supabase
    .from('students')
    .select('*')
    .or(`auth_user_id.eq.${context.userId},email.eq.${context.email}`)
    .limit(2);

  if (error) throw new ApiClientError(error.message, 503);

  const row = chooseIdentityRow(data, context);
  if (!row) throw new ApiClientError('No student profile is linked to this Supabase user.', 404);
  if (row.active === false) throw new ApiClientError('Student profile is inactive.', 403);
  return camelize(row);
}

async function getAdminProfile(context: Awaited<ReturnType<typeof createContext>>) {
  const { data, error } = await context.supabase
    .from('admin_users')
    .select('*')
    .or(`auth_user_id.eq.${context.userId},email.eq.${context.email}`)
    .limit(2);

  if (error) throw new ApiClientError(error.message, 503);

  const row = chooseIdentityRow(data, context);
  if (!row) throw new ApiClientError('No admin profile is linked to this Supabase user.', 404);
  if (row.status !== 'active') throw new ApiClientError('Admin profile is inactive.', 403);
  return camelize(row);
}

async function getStudentDashboard(context: Awaited<ReturnType<typeof createContext>>) {
  const student = await getStudentProfile(context);
  const [dashboard, resources, projects, certificates] = await Promise.all([
    callRpc(context, 'student_dashboard_bundle', { p_student_email: context.email }),
    callRpc(context, 'student_resources_view', { p_student_email: context.email }),
    callRpc(context, 'student_projects_bundle', { p_student_email: context.email }),
    callRpc(context, 'student_certificates_bundle', { p_student_email: context.email })
  ]);

  return { certificates, dashboard, projects, resources, student };
}

async function getAdminDashboard(context: Awaited<ReturnType<typeof createContext>>) {
  const admin = await getAdminProfile(context);
  const [summary, recordings] = await Promise.all([
    callRpc(context, 'lms_admin_dashboard_summary'),
    context.supabase.from('workshops').select('id', { count: 'exact', head: true }).eq('workshop_status', 'Completed')
  ]);

  const published = recordings.count ?? 0;
  return {
    admin,
    summary: {
      ...(isRecord(summary) ? summary : {}),
      publishedRecordings: { total: published },
      recordings: { ...(isRecord((summary as Record<string, unknown>)?.recordings) ? (summary as Record<string, Record<string, unknown>>).recordings : {}), published, total: published }
    }
  };
}

async function getStudentBundleList(context: Awaited<ReturnType<typeof createContext>>, sections: string[], query: ApiClientOptions['query']) {
  const bundle = await callRpc(context, 'student_dashboard_bundle', { p_student_email: context.email });
  return paginate(extractItems(bundle, sections), query);
}

async function getRpcList(context: Awaited<ReturnType<typeof createContext>>, endpoint: { functionName: string; section?: string[] }, query: ApiClientOptions['query']) {
  const data = await callRpc(context, endpoint.functionName, { p_student_email: context.email });
  return paginate(extractItems(data, endpoint.section ?? ['items']), query);
}

async function getTableList(context: Awaited<ReturnType<typeof createContext>>, endpoint: TableEndpoint, query: ApiClientOptions['query']) {
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 25), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let request = context.supabase.from(endpoint.table).select('*', { count: 'exact' });

  if (endpoint.studentOwned) {
    request = request.eq('student_email', context.email);
  }

  request = applyCommonFilters(request, query, endpoint);
  request = applyCommonSort(request, query, endpoint);
  const { count, data, error } = await request.range(from, to);
  if (error) throw new ApiClientError(error.message, 503);

  return createPaginatedResponse((data ?? []).map(enrichRow).map(camelize), count ?? 0, page, limit);
}

async function getSupportTicketDetail(context: Awaited<ReturnType<typeof createContext>>, ticketId: string, admin: boolean) {
  let ticketQuery = context.supabase.from('support_tickets').select('*').or(`id.eq.${ticketId},ticket_id.eq.${ticketId}`).limit(1);
  if (!admin) ticketQuery = ticketQuery.eq('student_email', context.email);
  const { data: tickets, error: ticketError } = await ticketQuery;
  if (ticketError) throw new ApiClientError(ticketError.message, 503);
  const ticket = tickets?.[0];
  if (!ticket) throw new ApiClientError('Support ticket was not found.', 404);

  let messagesQuery = context.supabase.from('support_ticket_messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true }).limit(101);
  if (!admin) messagesQuery = messagesQuery.eq('visibility', 'public');
  const { data: messages, error: messagesError } = await messagesQuery;
  if (messagesError) throw new ApiClientError(messagesError.message, 503);

  return {
    hasMoreMessages: (messages?.length ?? 0) > 100,
    messageLimit: 100,
    messages: (messages ?? []).slice(0, 100).map(camelize),
    ticket: camelize(ticket)
  };
}

async function getEnrollmentDetail(context: Awaited<ReturnType<typeof createContext>>, requestId: string) {
  const { data, error } = await context.supabase.from('enrollment_requests').select('*').or(`id.eq.${requestId},request_id.eq.${requestId}`).limit(1);
  if (error) throw new ApiClientError(error.message, 503);
  const request = data?.[0];
  if (!request) throw new ApiClientError('Enrollment request was not found.', 404);

  const [items, history] = await Promise.all([
    context.supabase.from('enrollment_request_items').select('*').eq('request_id', request.id).limit(100),
    context.supabase.from('enrollment_status_history').select('*').eq('request_id', request.id).order('created_at', { ascending: true }).limit(100)
  ]);

  if (items.error) throw new ApiClientError(items.error.message, 503);
  if (history.error) throw new ApiClientError(history.error.message, 503);

  return {
    history: (history.data ?? []).map(camelize),
    items: (items.data ?? []).map(camelize),
    request: camelize(request)
  };
}

async function updateById(context: Awaited<ReturnType<typeof createContext>>, table: string, id: string, body: unknown) {
  const payload = snakifyMutationBody(body);
  const { data, error } = await context.supabase.from(table).update(payload).eq('id', id).select('*').single();
  if (error) throw new ApiClientError(error.message, 503);
  return camelize(data);
}

async function insertRow(context: Awaited<ReturnType<typeof createContext>>, table: string, body: unknown) {
  const payload = snakifyMutationBody(body);
  const { data, error } = await context.supabase.from(table).insert(payload).select('*').single();
  if (error) throw new ApiClientError(error.message, 503);
  return camelize(data);
}

async function callRpc(context: Awaited<ReturnType<typeof createContext>>, functionName: string, params?: Record<string, string>) {
  const { data, error } = await context.supabase.rpc(functionName, params);
  if (error) throw new ApiClientError(error.message, 503);
  return camelize(data);
}

function applyCommonFilters<TQuery extends SupabaseQuery>(request: TQuery, query: ApiClientOptions['query'], endpoint: TableEndpoint): TQuery {
  const ignored = new Set(['limit', 'page', 'search', 'sort']);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (ignored.has(key) || value === undefined || value === '' || value === 'all' || value === 'any') return;
    if (key === 'submittedDate') {
      const start = String(value).slice(0, 10);
      if (!start) return;
      const end = new Date(`${start}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      request = request.gte('submitted_at', start).lt('submitted_at', end.toISOString().slice(0, 10)) as TQuery;
      return;
    }

    const normalizeValue = endpoint.filterValues?.[key];
    const normalizedValue = normalizeValue ? normalizeValue(value) : value;
    if (normalizedValue === undefined) return;

    request = request.eq(endpoint.filterColumns?.[key] ?? toSnakeCase(key), normalizedValue) as TQuery;
  });

  const search = String(query?.search ?? '').trim();
  if (search) {
    const safeSearch = search.replace(/[%(),]/g, '');
    request = request.or(endpoint.searchColumns.map((column) => `${column}.ilike.%${safeSearch}%`).join(',')) as TQuery;
  }

  return request;
}

function applyCommonSort<TQuery extends SupabaseQuery>(request: TQuery, query: ApiClientOptions['query'], endpoint: TableEndpoint): TQuery {
  const sort = String(query?.sort ?? '').trim();
  const order = sort ? endpoint.sortColumns?.[sort] : undefined;
  return order ? (request.order(order.column, { ascending: order.ascending }) as TQuery) : request;
}

function paginate(rawItems: unknown[], query: ApiClientOptions['query']) {
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 25), 100);
  const search = String(query?.search ?? '').trim().toLowerCase();
  const filtered = rawItems
    .map(enrichRow)
    .map(camelize)
    .filter((item) => matchesClientFilters(item, query))
    .filter((item) => !search || JSON.stringify(item).toLowerCase().includes(search));
  const start = (page - 1) * limit;
  return createPaginatedResponse(filtered.slice(start, start + limit), filtered.length, page, limit);
}

function matchesClientFilters(item: unknown, query: ApiClientOptions['query']) {
  if (!isRecord(item)) return true;

  const ignored = new Set(['limit', 'page', 'search', 'sort']);
  return Object.entries(query ?? {}).every(([key, value]) => {
    if (ignored.has(key) || value === undefined || value === '' || value === 'all' || value === 'any') return true;

    const expected = String(value);
    const camelKey = toCamelCase(key);
    const actual = item[camelKey] ?? item[key];

    if (key === 'programKey' && Array.isArray(item.programKeys)) {
      return item.programKeys.some((entry) => String(entry) === expected) || String(actual ?? '') === expected;
    }

    if (Array.isArray(actual)) {
      return actual.some((entry) => String(entry) === expected);
    }

    return String(actual ?? '') === expected;
  });
}

function createPaginatedResponse(items: unknown[], total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    items,
    limit,
    page,
    total,
    totalPages
  };
}

function extractItems(value: unknown, sections: string[]) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  for (const section of sections) {
    const candidate = value[section];
    if (Array.isArray(candidate)) return candidate;
    if (isRecord(candidate) && Array.isArray(candidate.items)) return candidate.items;
  }

  return [];
}

function chooseIdentityRow(rows: unknown, context: Awaited<ReturnType<typeof createContext>>) {
  if (!Array.isArray(rows)) return null;
  return (
    rows.find((row) => isRecord(row) && row.auth_user_id === context.userId && normalizeEmail(row.email) === context.email) ??
    rows.find((row) => isRecord(row) && row.auth_user_id === context.userId) ??
    rows.find((row) => isRecord(row) && normalizeEmail(row.email) === context.email) ??
    null
  );
}

function enrichRow(row: unknown) {
  if (!isRecord(row)) return row;
  return {
    ...row,
    active_now: computeActiveNow(row),
    deliverables: normalizeProjectList(row.deliverables, 'deliverable'),
    documents: normalizeProjectList(row.documents ?? row.resources, 'document'),
    id: row.id ?? row.request_id ?? row.ticket_id ?? row.student_id ?? row.workshop_id,
    join_url: row.locked === true ? null : row.join_url,
    category: row.category ?? row.role_category,
    name: row.name ?? row.role_name,
    recording_url: row.locked === true ? null : row.recording_url ?? row.youtube_video_url ?? row.zoom_recording_url,
    self_paced_resources: row.self_paced_resources ?? row.sp_resources,
    self_paced_sessions: row.self_paced_sessions ?? row.sp_sessions,
    source: row.source ?? (row.youtube_video_url ? 'youtube' : row.zoom_recording_url ? 'zoom' : undefined),
    status: row.status ?? row.workshop_status,
    tasks: normalizeProjectList(row.tasks ?? row.action_items, 'task')
  };
}

function normalizeProjectList(value: unknown, kind: 'deliverable' | 'document' | 'task') {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];

  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [title, detail, extra] = entry.split('|').map((part) => part.trim());
        if (kind === 'document') return { title, type: detail || undefined, link: extra || undefined };
        if (kind === 'deliverable') return { title, format: detail || undefined, note: extra || undefined };
        return { title, description: detail || undefined };
      });
  }

  if (isRecord(value)) {
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.tasks)) return value.tasks;
    if (Array.isArray(value.documents)) return value.documents;
    if (Array.isArray(value.deliverables)) return value.deliverables;
  }

  return [];
}

function computeActiveNow(row: Record<string, unknown>) {
  if (row.status && row.status !== 'active') return false;
  if (typeof row.expires_at === 'string') return new Date(row.expires_at).getTime() > Date.now();
  return row.status === 'active';
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (!isRecord(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [toCamelCase(key), camelize(item)]));
}

function snakify(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(snakify);
  if (!isRecord(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [toSnakeCase(key), snakify(item)]));
}

function snakifyMutationBody(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ApiClientError('Supabase write payload must be an object.', 400);
  }

  return snakify(value) as Record<string, unknown>;
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function stripQuery(path: string) {
  return path.split('?')[0];
}

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
