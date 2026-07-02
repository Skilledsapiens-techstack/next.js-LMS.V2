import { getSupabaseClient } from './supabaseClient';
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

type WriteEndpoint = {
  columns: Set<string>;
  normalizeBody?: (body: Record<string, unknown>) => Record<string, unknown>;
  table: string;
  validateBody?: (body: Record<string, unknown>, inserting: boolean) => void;
};

const STUDENT_WRITE_COLUMNS = new Set([
  'active',
  'alt_email',
  'cohort_id',
  'cohort_name',
  'college_name',
  'email',
  'full_name',
  'onboarding_mail_status',
  'phone',
  'program_name',
  'slot',
  'student_id',
  'track_role_ids',
  'wa_group_name'
]);

const COHORT_WRITE_COLUMNS = new Set([
  'cohort_id',
  'domain_key',
  'end_date',
  'google_group',
  'name',
  'program_key',
  'self_paced',
  'sp_resources',
  'sp_sessions',
  'start_date',
  'status',
  'student_count',
  'wa_group_name',
  'wa_link'
]);

const WORKSHOP_WRITE_COLUMNS = new Set([
  'access_type',
  'cohort_names',
  'currency',
  'date',
  'domain_key',
  'duration_minutes',
  'join_url',
  'payment_link',
  'price',
  'program_key',
  'time',
  'title',
  'workshop_id',
  'workshop_status',
  'youtube_video_url',
  'zoom_account',
  'zoom_id',
  'zoom_label',
  'zoom_recording_url'
]);

const RESOURCE_WRITE_COLUMNS = new Set([
  'access_type',
  'cohort_names',
  'currency',
  'description',
  'domain_key',
  'payment_link',
  'price',
  'program_keys',
  'resource_id',
  'resource_mode',
  'resource_type',
  'status',
  'title',
  'url'
]);

const TABLE_ENDPOINTS: Record<string, TableEndpoint> = {
  '/admins/announcements': { table: 'announcements', searchColumns: ['title', 'message', 'audience'] },
  '/admins/audit-logs': {
    table: 'audit_logs',
    filterColumns: { entityId: 'entity_id', entityType: 'entity_type' },
    searchColumns: ['action', 'actor_email', 'entity_type'],
    sortColumns: { newest: { column: 'created_at', ascending: false } }
  },
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

const WRITE_ENDPOINTS: Record<string, WriteEndpoint> = {
  cohorts: {
    columns: COHORT_WRITE_COLUMNS,
    normalizeBody: normalizeCohortWriteBody,
    table: 'cohorts',
    validateBody: validateCohortWriteBody
  },
  students: {
    columns: STUDENT_WRITE_COLUMNS,
    normalizeBody: normalizeStudentWriteBody,
    table: 'students',
    validateBody: validateStudentWriteBody
  },
  workshops: {
    columns: WORKSHOP_WRITE_COLUMNS,
    normalizeBody: normalizeWorkshopWriteBody,
    table: 'workshops',
    validateBody: validateWorkshopWriteBody
  },
  resources: {
    columns: RESOURCE_WRITE_COLUMNS,
    normalizeBody: normalizeResourceWriteBody,
    table: 'resources',
    validateBody: validateResourceWriteBody
  }
};

export async function apiGet<TResponse>(path: string, options: ApiClientOptions = {}): Promise<TResponse> {
  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);

  if (cleanPath === '/students/me') return getStudentProfile(context) as Promise<TResponse>;
  if (cleanPath === '/admins/me') return getAdminProfile(context) as Promise<TResponse>;
  if (cleanPath === '/students/me/dashboard') return getStudentDashboard(context) as Promise<TResponse>;
  if (cleanPath === '/admins/dashboard') return getAdminDashboard(context) as Promise<TResponse>;

  const studentAttempts = cleanPath.match(/^\/admins\/students\/([^/]+)\/lp-attempts$/);
  if (studentAttempts) return getStudentAttemptLimit(context, decodeURIComponent(studentAttempts[1])) as Promise<TResponse>;

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
    throw new ApiClientError('Write actions are disabled in this environment.', 403);
  }

  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);

  const studentStatus = cleanPath.match(/^\/admins\/students\/([^/]+)\/status$/);
  if (studentStatus) return updateById(context, 'students', studentStatus[1], options.body, 'status_changed') as Promise<TResponse>;

  const studentAttempts = cleanPath.match(/^\/admins\/students\/([^/]+)\/lp-attempts$/);
  if (studentAttempts) return updateStudentAttemptLimit(context, decodeURIComponent(studentAttempts[1]), options.body) as Promise<TResponse>;

  const studentUpdate = cleanPath.match(/^\/admins\/students\/([^/]+)$/);
  if (studentUpdate) return updateById(context, 'students', studentUpdate[1], options.body, 'updated') as Promise<TResponse>;

  const cohortStatus = cleanPath.match(/^\/admins\/cohorts\/([^/]+)\/status$/);
  if (cohortStatus) return updateById(context, 'cohorts', cohortStatus[1], options.body, 'status_changed') as Promise<TResponse>;

  const cohortUpdate = cleanPath.match(/^\/admins\/cohorts\/([^/]+)$/);
  if (cohortUpdate) return updateById(context, 'cohorts', cohortUpdate[1], options.body, 'updated') as Promise<TResponse>;

  const workshopComplete = cleanPath.match(/^\/admins\/workshops\/([^/]+)\/complete$/);
  if (workshopComplete) return updateById(context, 'workshops', decodeURIComponent(workshopComplete[1]), { workshopStatus: 'Completed' }, 'status_changed') as Promise<TResponse>;

  const workshopRecording = cleanPath.match(/^\/admins\/workshops\/([^/]+)\/recording$/);
  if (workshopRecording) return updateById(context, 'workshops', decodeURIComponent(workshopRecording[1]), options.body, 'recording_updated') as Promise<TResponse>;

  const workshopUpdate = cleanPath.match(/^\/admins\/workshops\/([^/]+)$/);
  if (workshopUpdate) return updateById(context, 'workshops', decodeURIComponent(workshopUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  const resourceArchive = cleanPath.match(/^\/admins\/resources\/([^/]+)\/archive$/);
  if (resourceArchive) return updateById(context, 'resources', decodeURIComponent(resourceArchive[1]), { status: 'inactive' }, 'archived') as Promise<TResponse>;

  const resourceRestore = cleanPath.match(/^\/admins\/resources\/([^/]+)\/restore$/);
  if (resourceRestore) return updateById(context, 'resources', decodeURIComponent(resourceRestore[1]), { status: 'active' }, 'status_changed') as Promise<TResponse>;

  const resourceUpdate = cleanPath.match(/^\/admins\/resources\/([^/]+)$/);
  if (resourceUpdate) return updateById(context, 'resources', decodeURIComponent(resourceUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  throw new ApiClientError(`Unsupported Supabase write route: ${cleanPath}`, 404);
}

export async function apiPost<TResponse, TBody = unknown>(path: string, options: ApiMutationOptions<TBody> = {}): Promise<TResponse> {
  if (!webEnv.writeActionsEnabled) {
    throw new ApiClientError('Write actions are disabled in this environment.', 403);
  }

  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);

  if (cleanPath === '/admins/students/import') return importStudents(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/students') return insertRow(context, 'students', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/cohorts') return insertRow(context, 'cohorts', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/workshops') return insertRow(context, 'workshops', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/resources') return insertRow(context, 'resources', options.body, 'created') as Promise<TResponse>;

  throw new ApiClientError(`Unsupported Supabase write route: ${cleanPath}`, 404);
}

export async function apiInvokeFunction<TResponse, TBody = unknown>(functionName: string, options: ApiMutationOptions<TBody> = {}): Promise<TResponse> {
  if (!webEnv.writeActionsEnabled) {
    throw new ApiClientError('Write actions are disabled in this environment.', 403);
  }

  const context = await createContext(options.accessToken);
  const { data, error } = await context.supabase.functions.invoke(functionName, {
    body: options.body as Record<string, unknown> | undefined
  });

  if (error) throw new ApiClientError(error.message, 503);
  if (isRecord(data) && typeof data.error === 'string') throw new ApiClientError(data.error, 400);
  return data as TResponse;
}

async function createContext(accessToken?: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new ApiClientError('Supabase is not configured.', 503);
  if (!accessToken) throw new ApiClientError('Supabase access token is required.', 401);

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) throw new ApiClientError('Supabase session is invalid.', 401);

  const email = normalizeEmail(data.user.email);
  return { accessToken, email, supabase, userId: data.user.id };
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
  const items = extractItems(data, endpoint.section ?? ['items']);
  if (endpoint.functionName === 'student_schedule_view') {
    return paginate(items.filter(isVisibleStudentScheduleItem), query);
  }
  return paginate(items, query);
}

async function getTableList(context: Awaited<ReturnType<typeof createContext>>, endpoint: TableEndpoint, query: ApiClientOptions['query']) {
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 25), 500);
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

async function getStudentAttemptLimit(context: Awaited<ReturnType<typeof createContext>>, studentId: string) {
  const student = await getStudentById(context, studentId);
  const { data, error } = await context.supabase.from('project_submission_student_limits').select('*').eq('student_id', student.id).maybeSingle();
  if (error) throw new ApiClientError(error.message, 503);

  return {
    maxAttempts: Number(data?.max_attempts ?? 3),
    notes: data?.notes ?? undefined,
    studentEmail: student.email,
    studentId: student.id,
    updatedAt: data?.updated_at ?? undefined
  };
}

async function updateStudentAttemptLimit(context: Awaited<ReturnType<typeof createContext>>, studentId: string, body: unknown) {
  const payload = snakifyMutationBody(body);
  const maxAttempts = Number(payload.max_attempts);
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : undefined;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 1000) {
    throw new ApiClientError('LP max attempts must be a whole number between 1 and 1000.', 400);
  }

  const student = await getStudentById(context, studentId);
  const row = {
    max_attempts: maxAttempts,
    notes: notes || null,
    student_email: student.email,
    student_id: student.id,
    updated_at: new Date().toISOString(),
    updated_by: context.email
  };

  const { data, error } = await context.supabase.from('project_submission_student_limits').upsert(row, { onConflict: 'student_id' }).select('*').single();
  if (error) throw mutationError(error, 'project_submission_student_limits');

  await writeAuditLog(context, 'students', 'lp_attempts_updated', student, {
    max_attempts: data.max_attempts,
    notes: data.notes,
    updated_by: context.email
  });

  return {
    maxAttempts: Number(data.max_attempts),
    notes: data.notes ?? undefined,
    studentEmail: data.student_email,
    studentId: data.student_id,
    updatedAt: data.updated_at
  };
}

async function updateById(context: Awaited<ReturnType<typeof createContext>>, table: string, id: string, body: unknown, auditAction?: string) {
  const endpoint = getWriteEndpoint(table);
  const metadata = getWriteMetadata(endpoint.table, body);
  const payload = prepareWritePayload(endpoint, body, false);
  const { data, error } = await context.supabase.from(endpoint.table).update(payload).eq('id', id).select('*').single();
  if (error) throw mutationError(error, endpoint.table);
  if (auditAction) await writeAuditLog(context, endpoint.table, auditAction, data, payload);
  if (metadata.sendInvite && endpoint.table === 'students') await queueStudentInvite(context, data);
  return camelize(enrichRow(data));
}

async function insertRow(context: Awaited<ReturnType<typeof createContext>>, table: string, body: unknown, auditAction?: string) {
  const endpoint = getWriteEndpoint(table);
  const metadata = getWriteMetadata(endpoint.table, body);
  const payload = prepareWritePayload(endpoint, body, true);
  const { data, error } = await context.supabase.from(endpoint.table).insert(payload).select('*').single();
  if (error) throw mutationError(error, endpoint.table);
  if (auditAction) await writeAuditLog(context, endpoint.table, auditAction, data, payload);
  if (metadata.sendInvite && endpoint.table === 'students') await queueStudentInvite(context, data);
  return camelize(enrichRow(data));
}

async function importStudents(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.students)) {
    throw new ApiClientError('Student import payload must include a students list.', 400);
  }

  if (body.students.length > 500) {
    throw new ApiClientError('Student import is limited to 500 rows at a time.', 400);
  }

  const endpoint = getWriteEndpoint('students');
  const result = { created: 0, failed: 0, updated: 0 };

  for (const studentBody of body.students) {
    try {
      const metadata = getWriteMetadata('students', studentBody);
      const payload = prepareWritePayload(endpoint, studentBody, true);
      const email = normalizeEmail(payload.email);
      const existing = await context.supabase.from('students').select('*').ilike('email', email).limit(1).maybeSingle();
      if (existing.error) throw existing.error;

      if (existing.data) {
        const updatePayload = { ...payload, email, updated_at: new Date().toISOString() };
        const { data, error } = await context.supabase.from('students').update(updatePayload).eq('id', existing.data.id).select('*').single();
        if (error) throw error;
        await writeAuditLog(context, 'students', 'updated', data, updatePayload);
        if (metadata.sendInvite) await queueStudentInvite(context, data);
        result.updated += 1;
      } else {
        const insertPayload = { ...payload, email };
        const { data, error } = await context.supabase.from('students').insert(insertPayload).select('*').single();
        if (error) throw error;
        await writeAuditLog(context, 'students', 'created', data, insertPayload);
        if (metadata.sendInvite) await queueStudentInvite(context, data);
        result.created += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

async function getStudentById(context: Awaited<ReturnType<typeof createContext>>, studentId: string) {
  const { data, error } = await context.supabase.from('students').select('id,email,full_name,student_id,cohort_name,program_name,active').eq('id', studentId).single();
  if (error) throw new ApiClientError(error.message, error.code === 'PGRST116' ? 404 : 503);
  return data;
}

async function queueStudentInvite(context: Awaited<ReturnType<typeof createContext>>, student: Record<string, unknown>) {
  const email = normalizeEmail(student.email);
  if (!email) throw new ApiClientError('Student was saved, but invite queueing failed because the email is missing.', 400);

  const queueRow = {
    category: 'auth',
    created_by: context.email,
    params: {
      cohort: student.cohort_name ?? null,
      program: student.program_name ?? null,
      student_id: student.student_id ?? student.id,
      student_name: student.full_name ?? email
    },
    recipient_email: email,
    recipient_name: student.full_name ?? null,
    related_entity_id: String(student.id ?? ''),
    related_entity_type: 'student',
    status: 'queued',
    subject: 'Create your Skilled Sapiens LMS password',
    tags: ['lms', 'lms-auth', 'portal-invite'],
    template_key: 'portal_invite'
  };

  const { data, error } = await context.supabase.from('email_queue').insert(queueRow).select('*').single();
  if (error) throw new ApiClientError(`Student was saved, but invite queueing failed: ${error.message}`, 503);
  await writeAuditLog(context, 'students', 'invite_queued', student, { email_queue_id: data.id, template_key: 'portal_invite' });
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
  const limit = Math.min(Number(query?.limit ?? 25), 500);
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

function isVisibleStudentScheduleItem(item: unknown) {
  if (!isRecord(item)) return false;
  const status = String(item.status ?? item.workshop_status ?? '');
  const joinUrl = item.join_url ?? item.joinUrl;
  return ['Scheduled', 'Live'].includes(status) && typeof joinUrl === 'string' && joinUrl.trim().length > 0;
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

function getWriteEndpoint(table: string) {
  const endpoint = WRITE_ENDPOINTS[table];
  if (!endpoint) throw new ApiClientError(`Unsupported Supabase write table: ${table}`, 404);
  return endpoint;
}

function prepareWritePayload(endpoint: WriteEndpoint, body: unknown, inserting: boolean) {
  const rawPayload = snakifyMutationBody(body);
  const normalizedPayload = endpoint.normalizeBody ? endpoint.normalizeBody(rawPayload) : rawPayload;
  const payload = Object.fromEntries(
    Object.entries(normalizedPayload).filter(([, value]) => value !== undefined)
  );
  const unsupportedColumns = Object.keys(payload).filter((column) => !endpoint.columns.has(column));

  if (unsupportedColumns.length > 0) {
    throw new ApiClientError(`Unsupported write fields for ${endpoint.table}: ${unsupportedColumns.join(', ')}`, 400);
  }

  endpoint.validateBody?.(payload, inserting);

  if (inserting) return payload;
  return { ...payload, updated_at: new Date().toISOString() };
}

function getWriteMetadata(table: string, body: unknown) {
  if (table !== 'students' || !isRecord(body)) return { sendInvite: false };
  const rawPayload = snakify(body) as Record<string, unknown>;
  return { sendInvite: rawPayload.send_invite === true };
}

function normalizeStudentWriteBody(payload: Record<string, unknown>) {
  const cohortIds = asStringArray(payload.cohort_ids);
  const cohortNames = asStringArray(payload.cohort_names);
  const programNames = asStringArray(payload.program_names);
  const programKeys = asStringArray(payload.program_keys);

  return {
    ...payload,
    cohort_id: cohortIds[0] || payload.cohort_id,
    cohort_name: cohortNames[0] || payload.cohort_name,
    email: payload.email ? normalizeEmail(payload.email) : payload.email,
    alt_email: payload.alt_email ? normalizeEmail(payload.alt_email) : payload.alt_email,
    onboarding_mail_status: typeof payload.onboarding_mail_status === 'string' ? payload.onboarding_mail_status.toLowerCase() : payload.onboarding_mail_status,
    program_name: programNames.join(', ') || programKeys.join(', ') || payload.program_name,
    track_role_ids: programKeys.length > 0 ? programKeys : payload.track_role_ids,
    wa_group_name: payload.wa_group_name ?? payload.wa_group,
    cohort_ids: undefined,
    cohort_names: undefined,
    program_keys: undefined,
    program_names: undefined,
    send_invite: undefined,
    wa_group: undefined
  };
}

function normalizeCohortWriteBody(payload: Record<string, unknown>) {
  return {
    ...payload,
    sp_resources: payload.sp_resources ?? payload.self_paced_resources,
    sp_sessions: payload.sp_sessions ?? payload.self_paced_sessions,
    self_paced_resources: undefined,
    self_paced_sessions: undefined
  };
}

function normalizeWorkshopWriteBody(payload: Record<string, unknown>) {
  const status = typeof payload.workshop_status === 'string' ? payload.workshop_status : typeof payload.status === 'string' ? payload.status : undefined;
  const accessType = typeof payload.access_type === 'string' ? payload.access_type.toLowerCase() : payload.access_type;
  const cohortNames = payload.cohort_names === undefined ? undefined : asStringArray(payload.cohort_names);
  const youtubeVideoUrl = payload.youtube_video_url === '' ? null : payload.youtube_video_url;
  const zoomRecordingUrl = payload.zoom_recording_url === '' ? null : payload.zoom_recording_url;

  return {
    ...payload,
    access_type: accessType,
    cohort_names: cohortNames,
    duration_minutes: payload.duration_minutes === '' || payload.duration_minutes === undefined ? undefined : Number(payload.duration_minutes),
    price: payload.price === '' || payload.price === undefined ? undefined : Number(payload.price),
    workshop_status: status,
    status: undefined,
    youtube_video_url: youtubeVideoUrl,
    zoom_recording_url: zoomRecordingUrl
  };
}

function normalizeResourceWriteBody(payload: Record<string, unknown>) {
  const accessType = typeof payload.access_type === 'string' ? payload.access_type.toLowerCase() : payload.access_type;
  const cohortNames = payload.cohort_names === undefined ? undefined : asStringArray(payload.cohort_names);
  const programKeys = payload.program_keys === undefined ? undefined : asStringArray(payload.program_keys);
  const paymentLink = payload.payment_link === '' ? null : payload.payment_link;
  const url = payload.url === '' ? null : payload.url;

  return {
    ...payload,
    access_type: accessType,
    cohort_names: cohortNames,
    currency: typeof payload.currency === 'string' ? payload.currency.trim().toUpperCase() : payload.currency,
    payment_link: paymentLink,
    price: payload.price === '' || payload.price === undefined ? null : Number(payload.price),
    program_keys: programKeys,
    resource_mode: typeof payload.resource_mode === 'string' ? payload.resource_mode.trim().toLowerCase() : payload.resource_mode,
    resource_type: typeof payload.resource_type === 'string' ? payload.resource_type.trim().toLowerCase() : payload.resource_type,
    url
  };
}

function validateCohortWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const studentCount = payload.student_count;
  const startDate = typeof payload.start_date === 'string' ? payload.start_date : undefined;
  const endDate = typeof payload.end_date === 'string' ? payload.end_date : undefined;

  if (inserting && !name) throw new ApiClientError('Cohort name is required.', 400);
  if (status && !['upcoming', 'active', 'completed', 'inactive'].includes(status)) {
    throw new ApiClientError('Cohort status is invalid.', 400);
  }
  if (studentCount !== undefined && (!Number.isInteger(Number(studentCount)) || Number(studentCount) < 0)) {
    throw new ApiClientError('Cohort student count must be zero or a positive whole number.', 400);
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ApiClientError('Cohort end date cannot be before the start date.', 400);
  }
}

function validateWorkshopWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const date = typeof payload.date === 'string' ? payload.date.trim() : '';
  const status = typeof payload.workshop_status === 'string' ? payload.workshop_status : undefined;
  const accessType = typeof payload.access_type === 'string' ? payload.access_type : undefined;
  const durationMinutes = payload.duration_minutes;
  const price = payload.price;
  const youtubeVideoUrl = typeof payload.youtube_video_url === 'string' ? payload.youtube_video_url.trim() : '';
  const zoomRecordingUrl = typeof payload.zoom_recording_url === 'string' ? payload.zoom_recording_url.trim() : '';

  if (inserting && !title) throw new ApiClientError('Workshop title is required.', 400);
  if (inserting && !date) throw new ApiClientError('Workshop date is required.', 400);
  if (date && Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) {
    throw new ApiClientError('Workshop date is invalid.', 400);
  }
  if (status && !['Upcoming', 'Scheduled', 'Live', 'Completed', 'Cancelled', 'Inactive'].includes(status)) {
    throw new ApiClientError('Workshop status is invalid.', 400);
  }
  if (accessType && !['free', 'paid'].includes(accessType)) {
    throw new ApiClientError('Workshop access type is invalid.', 400);
  }
  if (durationMinutes !== undefined && (!Number.isInteger(Number(durationMinutes)) || Number(durationMinutes) <= 0)) {
    throw new ApiClientError('Workshop duration must be a positive whole number.', 400);
  }
  if (price !== undefined && Number(price) < 0) {
    throw new ApiClientError('Workshop price cannot be negative.', 400);
  }
  if (youtubeVideoUrl && !isHttpUrl(youtubeVideoUrl)) throw new ApiClientError('YouTube recording URL must start with http:// or https://.', 400);
  if (zoomRecordingUrl && !isHttpUrl(zoomRecordingUrl)) throw new ApiClientError('Alternate recording URL must start with http:// or https://.', 400);
}

function validateResourceWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const resourceId = typeof payload.resource_id === 'string' ? payload.resource_id.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const accessType = typeof payload.access_type === 'string' ? payload.access_type : undefined;
  const price = payload.price;
  const currency = typeof payload.currency === 'string' ? payload.currency.trim() : '';
  const paymentLink = typeof payload.payment_link === 'string' ? payload.payment_link.trim() : '';
  const url = typeof payload.url === 'string' ? payload.url.trim() : '';
  const cohortNames = payload.cohort_names;
  const programKeys = payload.program_keys;

  if (inserting && !resourceId) throw new ApiClientError('Resource ID is required.', 400);
  if (inserting && !title) throw new ApiClientError('Resource title is required.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Resource status is invalid.', 400);
  if (accessType && !['free', 'paid'].includes(accessType)) throw new ApiClientError('Resource access type is invalid.', 400);
  if (cohortNames !== undefined && !Array.isArray(cohortNames)) throw new ApiClientError('Resource cohorts must be a list.', 400);
  if (programKeys !== undefined && !Array.isArray(programKeys)) throw new ApiClientError('Resource programs must be a list.', 400);
  if (Array.isArray(cohortNames) && Array.isArray(programKeys) && cohortNames.length === 0 && programKeys.length === 0) {
    throw new ApiClientError('Select at least one cohort or one program.', 400);
  }
  if (url && !isHttpUrl(url)) throw new ApiClientError('Resource URL must start with http:// or https://.', 400);
  if (paymentLink && !isHttpUrl(paymentLink)) throw new ApiClientError('Payment link must start with http:// or https://.', 400);
  if (price !== null && price !== undefined && Number(price) < 0) throw new ApiClientError('Resource price cannot be negative.', 400);
  if (accessType === 'paid') {
    if (price === null || price === undefined || Number(price) <= 0) throw new ApiClientError('Paid resources require a positive price.', 400);
    if (!paymentLink) throw new ApiClientError('Paid resources require a payment link.', 400);
  }
  if (currency && currency.length > 10) throw new ApiClientError('Currency must be 10 characters or fewer.', 400);
}

function validateStudentWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const altEmail = typeof payload.alt_email === 'string' ? payload.alt_email.trim() : '';
  const onboardingMailStatus = typeof payload.onboarding_mail_status === 'string' ? payload.onboarding_mail_status : undefined;
  const trackRoleIds = payload.track_role_ids;

  if (inserting && !fullName) throw new ApiClientError('Student full name is required.', 400);
  if (inserting && !email) throw new ApiClientError('Student email is required.', 400);
  if (email && !isValidEmail(email)) throw new ApiClientError('Student email is invalid.', 400);
  if (altEmail && !isValidEmail(altEmail)) throw new ApiClientError('Alternative email is invalid.', 400);
  if (onboardingMailStatus && !['pending', 'sent', 'failed', 'skipped', 'dry-run'].includes(onboardingMailStatus)) {
    throw new ApiClientError('Onboarding mail status is invalid.', 400);
  }
  if (trackRoleIds !== undefined && !Array.isArray(trackRoleIds)) {
    throw new ApiClientError('Student program role IDs must be a list.', 400);
  }
}

async function writeAuditLog(
  context: Awaited<ReturnType<typeof createContext>>,
  table: string,
  action: string,
  row: Record<string, unknown>,
  payload: Record<string, unknown>
) {
  if (table !== 'cohorts' && table !== 'students' && table !== 'workshops' && table !== 'resources') return;
  const entityType = table === 'cohorts' ? 'cohort' : table === 'workshops' ? 'workshop' : table === 'resources' ? 'resource' : 'student';

  const auditRow = {
    action: `admin_${entityType}_${action}`,
    actor_email: context.email,
    actor_role: 'admin',
    details: buildAuditDetails(table, row, payload),
    entity_id: String(row.id ?? ''),
    entity_type: entityType,
    status: 'success'
  };

  const { error } = await context.supabase.from('audit_logs').insert(auditRow);
  if (error) throw new ApiClientError(`${entityType === 'cohort' ? 'Cohort' : entityType === 'workshop' ? 'Workshop' : entityType === 'resource' ? 'Resource' : 'Student'} was saved, but audit logging failed: ${error.message}`, 503);
}

function buildAuditDetails(table: string, row: Record<string, unknown>, payload: Record<string, unknown>) {
  const base = {
    changedFields: Object.keys(payload).sort()
  };

  if (table === 'cohorts') {
    return {
      ...base,
      cohortId: row.cohort_id,
      name: row.name,
      status: row.status
    };
  }

  if (table === 'workshops') {
    return {
      ...base,
      date: row.date,
      status: row.workshop_status,
      title: row.title,
      workshopId: row.workshop_id
    };
  }

  if (table === 'resources') {
    return {
      ...base,
      accessType: row.access_type,
      resourceId: row.resource_id,
      status: row.status,
      title: row.title
    };
  }

  return {
    ...base,
    active: row.active,
    email: row.email,
    fullName: row.full_name,
    studentId: row.student_id
  };
}

function mutationError(error: { code?: string; message: string }, table: string) {
  if (error.code === '23505') {
    if (table === 'cohorts') return new ApiClientError('A cohort with this name or cohort ID already exists.', 409);
    if (table === 'students') return new ApiClientError('A student with this email already exists.', 409);
    if (table === 'resources') return new ApiClientError('A resource with this Resource ID already exists.', 409);
    return new ApiClientError('A record with this unique value already exists.', 409);
  }

  return new ApiClientError(error.message, 503);
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
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
