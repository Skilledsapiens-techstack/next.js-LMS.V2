import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { webEnv } from '../config/env';
import { getEffectiveAdminPermissions, hasAdminPermission, normalizeAdminRole, type AdminPermission } from '../auth/adminPermissions';

const CERTIFICATE_VERIFY_BASE_URL = 'https://skilledsapiens.com/verify-your-certificate/';

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
  contains: (column: string, value: string | readonly unknown[] | Record<string, unknown>) => SupabaseQuery;
  eq: (column: string, value: unknown) => SupabaseQuery;
  gte: (column: string, value: unknown) => SupabaseQuery;
  in: (column: string, values: readonly unknown[]) => SupabaseQuery;
  lt: (column: string, value: unknown) => SupabaseQuery;
  or: (filters: string) => SupabaseQuery;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery;
};

type LightweightCountRequest = SupabaseQuery &
  PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>;

type AdminProfileRecord = Record<string, unknown> & {
  email?: string;
  permissions: AdminPermission[];
  role: string;
};

let requestClientCache: { client: SupabaseClient; key: string } | null = null;

// Keeps existing feature hooks stable while the data layer moves from HTTP routes to Supabase tables/RPCs.
const STUDENT_BUNDLE_SECTIONS: Record<string, string[]> = {
  '/students/me/announcements': ['announcements', 'announcementList', 'studentAnnouncements'],
  '/students/me/cohorts': ['cohorts', 'studentCohorts']
};

const ADMIN_READ_PERMISSIONS_BY_PATH: Record<string, AdminPermission> = {
  '/admins/announcements': 'admin.announcements.view',
  '/admins/announcements/recipient-count': 'admin.announcements.view',
  '/admins/audit-logs': 'admin.observability.view',
  '/admins/certificate-program-settings': 'admin.certificates.view',
  '/admins/certificate-requests': 'admin.certificates.view',
  '/admins/certificates': 'admin.certificates.view',
  '/admins/cohorts': 'admin.cohorts.view',
  '/admins/dashboard': 'admin.dashboard.view',
  '/admins/email-queue': 'admin.email.view',
  '/admins/email-templates': 'admin.email.view',
  '/admins/enrollment-exceptions': 'admin.enrollments.view',
  '/admins/enrollment-requests': 'admin.enrollments.view',
  '/admins/enrollment-webhook-events': 'admin.enrollments.view',
  '/admins/admin-users': 'admin.admin_users.view',
  '/admins/feature-controls': 'admin.feature_control.manage',
  '/admins/observability': 'admin.observability.view',
  '/admins/paid-access': 'admin.paid_access.view',
  '/admins/payment-orders': 'admin.payments.view',
  '/admins/programs': 'admin.programs.view',
  '/admins/project-roles': 'admin.projects.view',
  '/admins/project-toolkit': 'admin.projects.view',
  '/admins/project-submissions': 'admin.submissions.view',
  '/admins/projects': 'admin.projects.view',
  '/admins/recording-candidates': 'admin.recordings.view',
  '/admins/recording-sequences': 'admin.recordings.view',
  '/admins/resources': 'admin.resources.view',
  '/admins/student-audit-logs': 'admin.observability.view',
  '/admins/students': 'admin.students.view',
  '/admins/students/college-options': 'admin.students.view',
  '/admins/support-categories': 'admin.support.view',
  '/admins/support-faqs': 'admin.support.view',
  '/admins/support-tickets': 'admin.support.view',
  '/admins/workshops': 'admin.meetings.view'
};

const RPC_LIST_ENDPOINTS: Record<string, { functionName: string; section?: string[] }> = {
  '/students/me/projects': { functionName: 'student_projects_bundle', section: ['projects', 'items'] },
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

type StudentWriteMetadata = {
  assignmentMode: 'add' | 'replace';
  cohortIds: string[];
  cohortNames: string[];
  programKeys: string[];
  programNames: string[];
  sendInvite: boolean;
  sendOnboardingMail: boolean;
};

const STUDENT_WRITE_COLUMNS = new Set([
  'active',
  'alt_email',
  'cohort_id',
  'cohort_name',
  'college_name',
  'duration',
  'email',
  'full_name',
  'live_project_role_ids',
  'onboarding_mail_status',
  'personalmentor',
  'phone',
  'program_name',
  'project_start_date',
  'slot',
  'student_id',
  'track_role_ids',
  'wa_group_name',
  'you_are_from'
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
  'zoom_recording_password',
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

const PROGRAM_WRITE_COLUMNS = new Set([
  'domain_label',
  'name',
  'program_key',
  'short_name',
  'status'
]);

const PROJECT_ROLE_WRITE_COLUMNS = new Set([
  'program_key',
  'role_category',
  'role_id',
  'role_name',
  'status'
]);

const PROJECT_WRITE_COLUMNS = new Set([
  'action_items',
  'brief',
  'company_name',
  'deadline',
  'deliverables',
  'objectives',
  'program_key',
  'program_keys',
  'program_name',
  'project_id',
  'project_role',
  'resources',
  'role_id',
  'status',
  'title'
]);

const PROJECT_TOOLKIT_WRITE_COLUMNS = new Set([
  'content',
  'item_type',
  'link_label',
  'link_url',
  'program_keys',
  'sort_order',
  'status',
  'summary',
  'title',
  'toolkit_id'
]);

const RECORDING_SEQUENCE_WRITE_COLUMNS = new Set([
  'match_aliases',
  'program_key',
  'recording_section',
  'sequence_number',
  'status',
  'title'
]);

const RECORDING_SECTION_KEYS = new Set(['induction_live_project', 'core_modules', 'placement_mentorship', 'other_workshops']);

const ANNOUNCEMENT_WRITE_COLUMNS = new Set([
  'announcement_id',
  'audience',
  'cohort_names',
  'created_by',
  'custom_emoji',
  'end_date',
  'link_label',
  'link_url',
  'message',
  'pinned',
  'priority',
  'program_keys',
  'start_date',
  'status',
  'title',
  'type',
  'updated_by'
]);

const FEATURE_CONTROL_WRITE_COLUMNS = new Set([
  'module_id',
  'settings',
  'student_label',
  'student_path',
  'status',
  'upcoming_message',
  'updated_by'
]);

const EMAIL_TEMPLATE_WRITE_COLUMNS = new Set([
  'allowed_variables',
  'body',
  'brevo_template_id',
  'category',
  'default_tags',
  'description',
  'is_system',
  'phase',
  'sample_params',
  'sort_order',
  'status',
  'subject',
  'template_key',
  'template_name'
]);

const EMAIL_TEMPLATE_PHASE_KEYS = new Set([
  'custom',
  'auth',
  'onboarding',
  'workshop_link',
  'reminder',
  'recording_update',
  'resource_share',
  'certificate',
  'support',
  'project_submission',
  'payment',
  'enrollment',
  'placement',
  'general'
]);

const EMAIL_TEMPLATE_PHASE_ALIASES: Record<string, string> = {
  auth_portal_access: 'auth',
  custom_mail: 'custom',
  recording: 'recording_update',
  recording_available: 'recording_update',
  resource: 'resource_share',
  resource_sharing: 'resource_share',
  workshop: 'workshop_link'
};

const TABLE_ENDPOINTS: Record<string, TableEndpoint> = {
  '/admins/announcements': { table: 'announcements', searchColumns: ['title', 'message', 'audience'] },
  '/admins/audit-logs': {
    table: 'audit_logs',
    filterColumns: { entityId: 'entity_id', entityType: 'entity_type' },
    searchColumns: ['action', 'actor_email', 'entity_type'],
    sortColumns: { newest: { column: 'created_at', ascending: false } }
  },
  '/admins/certificate-program-settings': {
    table: 'certificate_program_settings',
    filterColumns: { programKey: 'program_key', status: 'status' },
    searchColumns: ['program_key', 'status']
  },
  '/admins/certificate-requests': { table: 'certificate_requests', searchColumns: ['student_email', 'student_name', 'program_name'] },
  '/admins/certificates': { table: 'certificates', searchColumns: ['student_email', 'student_name', 'program_name', 'project_title'] },
  '/admins/cohorts': {
    table: 'cohorts',
    filterColumns: { program: 'program_key' },
    searchColumns: ['name', 'cohort_id', 'program_key', 'domain_key'],
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
  '/admins/email-queue': {
    table: 'email_queue',
    filterColumns: { category: 'category', status: 'status' },
    searchColumns: ['recipient_email', 'recipient_name', 'subject', 'template_key', 'category', 'status'],
    sortColumns: { newest: { column: 'created_at', ascending: false } }
  },
  '/admins/email-templates': {
    table: 'email_templates',
    filterColumns: { category: 'category', phase: 'phase', status: 'status' },
    searchColumns: ['template_name', 'template_key', 'phase', 'category', 'subject', 'description'],
    sortColumns: { order: { column: 'sort_order', ascending: true }, updated: { column: 'updated_at', ascending: false } }
  },
  '/admins/feature-controls': {
    table: 'feature_controls',
    searchColumns: ['module_id', 'student_label', 'student_path'],
    sortColumns: { order: { column: 'sort_order', ascending: true } }
  },
  '/admins/paid-access': { table: 'paid_access', searchColumns: ['student_email', 'item_id', 'item_type'] },
  '/admins/payment-orders': { table: 'payment_orders', searchColumns: ['student_email', 'item_id', 'item_type', 'razorpay_order_id'] },
  '/admins/programs': { table: 'programs', filterColumns: { domain: 'domain_label' }, searchColumns: ['program_key', 'name', 'short_name', 'domain_label'] },
  '/admins/project-roles': { table: 'role_master', filterColumns: { category: 'role_category' }, searchColumns: ['role_name', 'program_key', 'role_category'] },
  '/admins/project-toolkit': {
    table: 'project_toolkit_items',
    filterColumns: { type: 'item_type' },
    searchColumns: ['toolkit_id', 'item_type', 'title', 'summary'],
    sortColumns: {
      order: { column: 'sort_order', ascending: true },
      updated: { column: 'updated_at', ascending: false }
    }
  },
  '/admins/project-submissions': {
    table: 'project_submission_requests',
    filterValues: { status: (value) => (value === 'pending' ? 'submitted' : value === 'duplicates' ? undefined : value) },
    searchColumns: ['student_email', 'student_name', 'project_title', 'request_number']
  },
  '/admins/projects': { table: 'projects', searchColumns: ['title', 'company_name', 'program_key'] },
  '/admins/recording-candidates': { table: 'workshop_recording_candidates', searchColumns: ['workshop_id', 'zoom_id', 'zoom_account'] },
  '/admins/recording-sequences': {
    table: 'recording_sequence_rules',
    filterColumns: { programKey: 'program_key', status: 'status' },
    searchColumns: ['program_key', 'title'],
    sortColumns: { order: { column: 'sequence_number', ascending: true }, updated: { column: 'updated_at', ascending: false } }
  },
  '/admins/resources': {
    table: 'resources',
    searchColumns: ['title', 'resource_type', 'resource_mode', 'domain_key'],
    sortColumns: { newest: { column: 'updated_at', ascending: false }, title: { column: 'title', ascending: true } }
  },
  '/admins/students': {
    table: 'students',
    filterColumns: { status: 'active' },
    filterValues: { status: (value) => (value === 'active' ? true : value === 'inactive' ? false : undefined) },
    searchColumns: ['full_name', 'email', 'alt_email', 'phone', 'student_id', 'college_name', 'cohort_name', 'program_name', 'wa_group_name', 'you_are_from', 'duration'],
    sortColumns: {
      access: { column: 'program_name', ascending: true },
      auth: { column: 'onboarding_mail_status', ascending: true },
      duration: { column: 'duration', ascending: true },
      education: { column: 'you_are_from', ascending: true },
      mentor: { column: 'personalmentor', ascending: true },
      newest: { column: 'created_at', ascending: false },
      onboarding: { column: 'project_start_date', ascending: true },
      sequence: { column: 'onboarding_sequence', ascending: true },
      status: { column: 'active', ascending: false },
      student: { column: 'full_name', ascending: true }
    }
  },
  '/admins/support-tickets': { table: 'support_tickets', filterColumns: { category: 'category_name' }, searchColumns: ['subject', 'student_email', 'category_name'] },
  '/admins/workshops': { table: 'workshops', filterColumns: { status: 'workshop_status' }, searchColumns: ['title', 'program_key', 'workshop_id', 'zoom_id'] },
  '/students/me/certificates': { table: 'certificates', searchColumns: ['program_name', 'project_title'], studentOwned: true },
  '/students/me/feature-controls': {
    table: 'feature_controls',
    searchColumns: ['module_id', 'student_label', 'student_path'],
    sortColumns: { order: { column: 'sort_order', ascending: true } }
  },
  '/students/me/paid-access': { table: 'paid_access', searchColumns: ['item_id', 'item_type'], studentOwned: true },
  '/students/me/payment-orders': { table: 'payment_orders', searchColumns: ['item_id', 'item_type', 'razorpay_order_id'], studentOwned: true },
  '/students/me/project-submissions': {
    table: 'project_submission_requests',
    filterColumns: { projectId: 'project_id' },
    searchColumns: ['project_title', 'request_number', 'project_id'],
    studentOwned: true
  },
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
  },
  programs: {
    columns: PROGRAM_WRITE_COLUMNS,
    normalizeBody: normalizeProgramWriteBody,
    table: 'programs',
    validateBody: validateProgramWriteBody
  },
  projects: {
    columns: PROJECT_WRITE_COLUMNS,
    normalizeBody: normalizeProjectWriteBody,
    table: 'projects',
    validateBody: validateProjectWriteBody
  },
  role_master: {
    columns: PROJECT_ROLE_WRITE_COLUMNS,
    normalizeBody: normalizeProjectRoleWriteBody,
    table: 'role_master',
    validateBody: validateProjectRoleWriteBody
  },
  project_toolkit_items: {
    columns: PROJECT_TOOLKIT_WRITE_COLUMNS,
    normalizeBody: normalizeProjectToolkitWriteBody,
    table: 'project_toolkit_items',
    validateBody: validateProjectToolkitWriteBody
  },
  recording_sequence_rules: {
    columns: RECORDING_SEQUENCE_WRITE_COLUMNS,
    normalizeBody: normalizeRecordingSequenceWriteBody,
    table: 'recording_sequence_rules',
    validateBody: validateRecordingSequenceWriteBody
  },
  announcements: {
    columns: ANNOUNCEMENT_WRITE_COLUMNS,
    normalizeBody: normalizeAnnouncementWriteBody,
    table: 'announcements',
    validateBody: validateAnnouncementWriteBody
  },
  feature_controls: {
    columns: FEATURE_CONTROL_WRITE_COLUMNS,
    normalizeBody: normalizeFeatureControlWriteBody,
    table: 'feature_controls',
    validateBody: validateFeatureControlWriteBody
  },
  email_templates: {
    columns: EMAIL_TEMPLATE_WRITE_COLUMNS,
    normalizeBody: normalizeEmailTemplateWriteBody,
    table: 'email_templates',
    validateBody: validateEmailTemplateWriteBody
  }
};

export async function apiGet<TResponse>(path: string, options: ApiClientOptions = {}): Promise<TResponse> {
  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);

  if (cleanPath === '/students/me') return getStudentProfile(context) as Promise<TResponse>;
  if (cleanPath === '/admins/me') return getAdminProfile(context) as Promise<TResponse>;
  const readPermission = getAdminReadPermission(cleanPath);
  if (readPermission) await requireAdminPermission(context, readPermission);
  if (cleanPath === '/students/me/dashboard') return getStudentDashboard(context) as Promise<TResponse>;
  if (cleanPath === '/admins/dashboard') return getAdminDashboard(context) as Promise<TResponse>;
  if (cleanPath === '/admins/observability') return getAdminObservability(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/student-audit-logs') return getStudentAuditLogs(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/certificate-requests') return getLiveProjectCertificateRequests(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/announcements/recipient-count') return getAnnouncementRecipientCount(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/support/categories') return getSupportCategories(context, options.query, false) as Promise<TResponse>;
  if (cleanPath === '/students/me/support-faqs') return getStudentSupportFaqs(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/support-categories') return getSupportCategories(context, options.query, true) as Promise<TResponse>;
  if (cleanPath === '/admins/support-faqs') return getAdminSupportFaqs(context, options.query) as Promise<TResponse>;

  const studentAttempts = cleanPath.match(/^\/admins\/students\/([^/]+)\/lp-attempts$/);
  if (studentAttempts) return getStudentAttemptLimit(context, decodeURIComponent(studentAttempts[1])) as Promise<TResponse>;

  const studentAccessPreview = cleanPath.match(/^\/admins\/students\/([^/]+)\/access-preview$/);
  if (studentAccessPreview) return getStudentAccessPreview(context, decodeURIComponent(studentAccessPreview[1])) as Promise<TResponse>;

  const adminStudentPreview = cleanPath.match(/^\/admins\/students\/([^/]+)\/preview$/);
  if (adminStudentPreview) return getAdminStudentPreview(context, decodeURIComponent(adminStudentPreview[1])) as Promise<TResponse>;

  if (cleanPath === '/admins/recordings/resources-summary') return getAdminRecordingResourceSummary(context, options.query) as Promise<TResponse>;

  const adminRecordingResources = cleanPath.match(/^\/admins\/recordings\/([^/]+)\/resources$/);
  if (adminRecordingResources) return getAdminRecordingResourceLinks(context, decodeURIComponent(adminRecordingResources[1])) as Promise<TResponse>;

  const studentRecordingResources = cleanPath.match(/^\/students\/me\/recordings\/([^/]+)\/resources$/);
  if (studentRecordingResources) return getStudentRecordingResources(context, decodeURIComponent(studentRecordingResources[1])) as Promise<TResponse>;

  const studentTicketMatch = cleanPath.match(/^\/students\/me\/support-tickets\/(.+)$/);
  if (studentTicketMatch) return getSupportTicketDetail(context, decodeURIComponent(studentTicketMatch[1]), false) as Promise<TResponse>;

  const adminTicketMatch = cleanPath.match(/^\/admins\/support-tickets\/(.+)$/);
  if (adminTicketMatch) return getSupportTicketDetail(context, decodeURIComponent(adminTicketMatch[1]), true) as Promise<TResponse>;

  const enrollmentMatch = cleanPath.match(/^\/admins\/enrollment-requests\/(.+)$/);
  if (enrollmentMatch) return getEnrollmentDetail(context, decodeURIComponent(enrollmentMatch[1])) as Promise<TResponse>;

  if (STUDENT_BUNDLE_SECTIONS[cleanPath]) {
    return getStudentBundleList(context, STUDENT_BUNDLE_SECTIONS[cleanPath], options.query) as Promise<TResponse>;
  }

  if (cleanPath === '/students/me/recordings') {
    return getStudentRecordingsList(context, options.query) as Promise<TResponse>;
  }

  if (cleanPath === '/students/me/project-toolkit') return getStudentProjectToolkit(context, options.query) as Promise<TResponse>;

  if (cleanPath === '/students/me/resources') return getStudentResourcesList(context, options.query) as Promise<TResponse>;

  if (cleanPath === '/admins/students/college-options') return getAdminStudentCollegeOptions(context) as Promise<TResponse>;

  if (cleanPath === '/admins/students') return getAdminStudentsList(context, options.query) as Promise<TResponse>;

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
  const writePermission = getAdminWritePermission(cleanPath, 'patch');
  if (writePermission) await requireAdminPermission(context, writePermission);

  const studentStatus = cleanPath.match(/^\/admins\/students\/([^/]+)\/status$/);
  if (studentStatus) return updateById(context, 'students', studentStatus[1], options.body, 'status_changed') as Promise<TResponse>;

  const studentAttempts = cleanPath.match(/^\/admins\/students\/([^/]+)\/lp-attempts$/);
  if (studentAttempts) return updateStudentAttemptLimit(context, decodeURIComponent(studentAttempts[1]), options.body) as Promise<TResponse>;

  const studentUpdate = cleanPath.match(/^\/admins\/students\/([^/]+)$/);
  if (studentUpdate) return updateById(context, 'students', studentUpdate[1], options.body, 'updated') as Promise<TResponse>;

  const projectSubmissionReview = cleanPath.match(/^\/admins\/project-submissions\/([^/]+)\/(approve|reject|changes-requested)$/);
  if (projectSubmissionReview) return reviewProjectSubmission(context, decodeURIComponent(projectSubmissionReview[1]), projectSubmissionReview[2], options.body) as Promise<TResponse>;

  const certificateRevoke = cleanPath.match(/^\/admins\/certificates\/([^/]+)\/revoke$/);
  if (certificateRevoke) return revokeCertificate(context, decodeURIComponent(certificateRevoke[1]), options.body) as Promise<TResponse>;

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

  const announcementArchive = cleanPath.match(/^\/admins\/announcements\/([^/]+)\/archive$/);
  if (announcementArchive) {
    return updateById(context, 'announcements', decodeURIComponent(announcementArchive[1]), { status: 'inactive', updatedBy: context.email }, 'archived') as Promise<TResponse>;
  }

  const announcementStatus = cleanPath.match(/^\/admins\/announcements\/([^/]+)\/status$/);
  if (announcementStatus) {
    return updateById(
      context,
      'announcements',
      decodeURIComponent(announcementStatus[1]),
      { ...(isRecord(options.body) ? options.body : {}), updatedBy: context.email },
      'status_changed'
    ) as Promise<TResponse>;
  }

  const announcementUpdate = cleanPath.match(/^\/admins\/announcements\/([^/]+)$/);
  if (announcementUpdate) {
    return updateById(
      context,
      'announcements',
      decodeURIComponent(announcementUpdate[1]),
      { ...(isRecord(options.body) ? options.body : {}), updatedBy: context.email },
      'updated'
    ) as Promise<TResponse>;
  }

  const featureControlUpdate = cleanPath.match(/^\/admins\/feature-controls\/([^/]+)$/);
  if (featureControlUpdate) {
    return updateById(
      context,
      'feature_controls',
      decodeURIComponent(featureControlUpdate[1]),
      { ...(isRecord(options.body) ? options.body : {}), updatedBy: context.email },
      'updated'
    ) as Promise<TResponse>;
  }

  const emailTemplateArchive = cleanPath.match(/^\/admins\/email-templates\/([^/]+)\/archive$/);
  if (emailTemplateArchive) {
    const templateId = decodeURIComponent(emailTemplateArchive[1]);
    const { data: template, error } = await context.supabase.from('email_templates').select('id,is_system').eq('id', templateId).maybeSingle();
    if (error) throw new ApiClientError(error.message, 503);
    if (template?.is_system) throw new ApiClientError('System email templates cannot be archived or deleted.', 400);
    return updateById(context, 'email_templates', templateId, { status: 'inactive' }, 'archived') as Promise<TResponse>;
  }

  const emailTemplateUpdate = cleanPath.match(/^\/admins\/email-templates\/([^/]+)$/);
  if (emailTemplateUpdate) {
    return updateById(context, 'email_templates', decodeURIComponent(emailTemplateUpdate[1]), options.body, 'updated') as Promise<TResponse>;
  }

  const programStatus = cleanPath.match(/^\/admins\/programs\/([^/]+)\/status$/);
  if (programStatus) return updateById(context, 'programs', decodeURIComponent(programStatus[1]), options.body, 'status_changed') as Promise<TResponse>;

  const programUpdate = cleanPath.match(/^\/admins\/programs\/([^/]+)$/);
  if (programUpdate) return updateById(context, 'programs', decodeURIComponent(programUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  const projectRoleStatus = cleanPath.match(/^\/admins\/project-roles\/([^/]+)\/status$/);
  if (projectRoleStatus) return updateById(context, 'role_master', decodeURIComponent(projectRoleStatus[1]), options.body, 'status_changed') as Promise<TResponse>;

  const projectRoleUpdate = cleanPath.match(/^\/admins\/project-roles\/([^/]+)$/);
  if (projectRoleUpdate) return updateById(context, 'role_master', decodeURIComponent(projectRoleUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  const projectToolkitStatus = cleanPath.match(/^\/admins\/project-toolkit\/([^/]+)\/status$/);
  if (projectToolkitStatus) return updateById(context, 'project_toolkit_items', decodeURIComponent(projectToolkitStatus[1]), options.body, 'status_changed') as Promise<TResponse>;

  const projectToolkitUpdate = cleanPath.match(/^\/admins\/project-toolkit\/([^/]+)$/);
  if (projectToolkitUpdate) return updateById(context, 'project_toolkit_items', decodeURIComponent(projectToolkitUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  const recordingSequenceUpdate = cleanPath.match(/^\/admins\/recording-sequences\/([^/]+)$/);
  if (recordingSequenceUpdate) return updateById(context, 'recording_sequence_rules', decodeURIComponent(recordingSequenceUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  const recordingResourcesUpdate = cleanPath.match(/^\/admins\/recordings\/([^/]+)\/resources$/);
  if (recordingResourcesUpdate) return updateAdminRecordingResourceLinks(context, decodeURIComponent(recordingResourcesUpdate[1]), options.body) as Promise<TResponse>;

  const projectStatus = cleanPath.match(/^\/admins\/projects\/([^/]+)\/status$/);
  if (projectStatus) return updateById(context, 'projects', decodeURIComponent(projectStatus[1]), options.body, 'status_changed') as Promise<TResponse>;

  const projectUpdate = cleanPath.match(/^\/admins\/projects\/([^/]+)$/);
  if (projectUpdate) return updateById(context, 'projects', decodeURIComponent(projectUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  const adminSupportTicketUpdate = cleanPath.match(/^\/admins\/support-tickets\/([^/]+)$/);
  if (adminSupportTicketUpdate) return updateSupportTicket(context, decodeURIComponent(adminSupportTicketUpdate[1]), options.body) as Promise<TResponse>;

  const adminSupportCategoryUpdate = cleanPath.match(/^\/admins\/support-categories\/([^/]+)$/);
  if (adminSupportCategoryUpdate) return updateSupportCategory(context, decodeURIComponent(adminSupportCategoryUpdate[1]), options.body) as Promise<TResponse>;

  const adminSupportFaqUpdate = cleanPath.match(/^\/admins\/support-faqs\/([^/]+)$/);
  if (adminSupportFaqUpdate) return updateSupportFaq(context, decodeURIComponent(adminSupportFaqUpdate[1]), options.body) as Promise<TResponse>;

  const adminSupportTicketClose = cleanPath.match(/^\/admins\/support-tickets\/([^/]+)\/close$/);
  if (adminSupportTicketClose) return updateSupportTicket(context, decodeURIComponent(adminSupportTicketClose[1]), { status: 'closed' }) as Promise<TResponse>;

  const adminSupportTicketReopen = cleanPath.match(/^\/admins\/support-tickets\/([^/]+)\/reopen$/);
  if (adminSupportTicketReopen) return updateSupportTicket(context, decodeURIComponent(adminSupportTicketReopen[1]), { status: 'open' }) as Promise<TResponse>;

  throw new ApiClientError(`Unsupported Supabase write route: ${cleanPath}`, 404);
}

export async function apiDelete<TResponse>(path: string, options: ApiClientOptions = {}): Promise<TResponse> {
  if (!webEnv.writeActionsEnabled) {
    throw new ApiClientError('Write actions are disabled in this environment.', 403);
  }

  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);
  const writePermission = getAdminWritePermission(cleanPath, 'delete');
  if (writePermission) await requireAdminPermission(context, writePermission);

  const adminSupportFaqDelete = cleanPath.match(/^\/admins\/support-faqs\/([^/]+)$/);
  if (adminSupportFaqDelete) return deleteSupportFaq(context, decodeURIComponent(adminSupportFaqDelete[1])) as Promise<TResponse>;

  const recordingSequenceDelete = cleanPath.match(/^\/admins\/recording-sequences\/([^/]+)$/);
  if (recordingSequenceDelete) return deleteById(context, 'recording_sequence_rules', decodeURIComponent(recordingSequenceDelete[1]), 'deleted') as Promise<TResponse>;

  throw new ApiClientError(`Unsupported Supabase delete route: ${cleanPath}`, 404);
}

export async function apiPost<TResponse, TBody = unknown>(path: string, options: ApiMutationOptions<TBody> = {}): Promise<TResponse> {
  if (!webEnv.writeActionsEnabled) {
    throw new ApiClientError('Write actions are disabled in this environment.', 403);
  }

  const context = await createContext(options.accessToken);
  const cleanPath = stripQuery(path);
  const writePermission = getAdminWritePermission(cleanPath, 'post');
  if (writePermission) await requireAdminPermission(context, writePermission);

  if (cleanPath === '/admins/students/import') return importStudents(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/students/bulk') return bulkUpdateStudents(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/students/resend-invites') return resendStudentInvites(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/students') return insertRow(context, 'students', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/cohorts') return insertRow(context, 'cohorts', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/workshops') return insertRow(context, 'workshops', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/resources') return insertRow(context, 'resources', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/announcements') {
    return insertRow(
      context,
      'announcements',
      {
        ...(isRecord(options.body) ? options.body : {}),
        announcementId: `ANN-${Date.now()}`,
        createdBy: context.email,
        updatedBy: context.email
      },
      'created'
    ) as Promise<TResponse>;
  }
  if (cleanPath === '/admins/email-templates') return insertRow(context, 'email_templates', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/programs') return insertRow(context, 'programs', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/project-roles') return insertRow(context, 'role_master', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/project-toolkit') return insertRow(context, 'project_toolkit_items', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/recording-sequences') return insertRow(context, 'recording_sequence_rules', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/projects') return insertRow(context, 'projects', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/certificate-program-settings') return saveCertificateProgramSetting(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/certificates/leadership') return issueLeadershipCertificates(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/certificates/live-project') return issueLiveProjectCertificate(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/certificates/manual') return issueManualCertificate(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/students/me/presence') return updateStudentPresence(context) as Promise<TResponse>;
  if (cleanPath === '/students/me/project-submissions') return submitStudentProjectReport(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/students/me/support-tickets') return createStudentSupportTicket(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/support-categories') return createSupportCategory(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/support-faqs') return createSupportFaq(context, options.body) as Promise<TResponse>;

  const studentSupportReply = cleanPath.match(/^\/students\/me\/support-tickets\/([^/]+)\/messages$/);
  if (studentSupportReply) return createSupportTicketMessage(context, decodeURIComponent(studentSupportReply[1]), options.body, 'student') as Promise<TResponse>;

  const adminSupportReply = cleanPath.match(/^\/admins\/support-tickets\/([^/]+)\/messages$/);
  if (adminSupportReply) return createSupportTicketMessage(context, decodeURIComponent(adminSupportReply[1]), options.body, 'admin') as Promise<TResponse>;

  throw new ApiClientError(`Unsupported Supabase write route: ${cleanPath}`, 404);
}

export async function apiInvokeFunction<TResponse, TBody = unknown>(functionName: string, options: ApiMutationOptions<TBody> = {}): Promise<TResponse> {
  if (!webEnv.writeActionsEnabled) {
    throw new ApiClientError('Write actions are disabled in this environment.', 403);
  }

  const context = await createContext(options.accessToken);
  const functionPermission = getFunctionPermission(functionName, options.body);
  if (functionPermission) await requireAdminPermission(context, functionPermission);
  const { data, error } = await context.supabase.functions.invoke(functionName, {
    body: options.body as Record<string, unknown> | undefined
  });

  if (error) {
    const message = getFunctionErrorMessage(data, error);
    throw new ApiClientError(message, 503);
  }
  if (isRecord(data) && typeof data.error === 'string') throw new ApiClientError(data.error, 400);
  return data as TResponse;
}

function getFunctionErrorMessage(data: unknown, error: unknown) {
  if (isRecord(data)) {
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  }
  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) return error.message.trim();
  return 'Request could not be completed. Please try again.';
}

function getAdminReadPermission(path: string): AdminPermission | undefined {
  if (!path.startsWith('/admins/')) return undefined;
  if (path === '/admins/recordings/resources-summary') return 'admin.recordings.view';
  if (path.match(/^\/admins\/recordings\/[^/]+\/resources$/)) return 'admin.recordings.view';
  if (path.match(/^\/admins\/students\/[^/]+\/lp-attempts$/)) return 'admin.students.view';
  if (path.match(/^\/admins\/students\/[^/]+\/access-preview$/)) return 'admin.students.view';
  if (path.match(/^\/admins\/students\/[^/]+\/preview$/)) return 'admin.students.view';
  if (path.match(/^\/admins\/support-tickets\/[^/]+$/)) return 'admin.support.view';
  if (path.match(/^\/admins\/enrollment-requests\/[^/]+$/)) return 'admin.enrollments.view';
  return ADMIN_READ_PERMISSIONS_BY_PATH[path];
}

function getAdminWritePermission(path: string, method: 'delete' | 'patch' | 'post'): AdminPermission | undefined {
  if (!path.startsWith('/admins/')) return undefined;

  if (path === '/admins/students/import' || path === '/admins/students/bulk') return 'admin.students.import';
  if (path === '/admins/students/resend-invites') return 'admin.students.invite';
  if (path === '/admins/students') return 'admin.students.manage';
  if (path.match(/^\/admins\/students\/[^/]+\/lp-attempts$/)) return 'admin.students.manage';
  if (path.match(/^\/admins\/students\/[^/]+/)) return 'admin.students.manage';

  if (path === '/admins/cohorts' || path.match(/^\/admins\/cohorts\/[^/]+/)) return 'admin.cohorts.manage';
  if (path === '/admins/programs' || path.match(/^\/admins\/programs\/[^/]+/)) return 'admin.programs.manage';
  if (
    path === '/admins/projects' ||
    path === '/admins/project-roles' ||
    path === '/admins/project-toolkit' ||
    path.match(/^\/admins\/projects\/[^/]+/) ||
    path.match(/^\/admins\/project-roles\/[^/]+/) ||
    path.match(/^\/admins\/project-toolkit\/[^/]+/)
  ) {
    return 'admin.projects.manage';
  }
  if (path.match(/^\/admins\/project-submissions\/[^/]+\/(approve|reject|changes-requested)$/)) return 'admin.submissions.review';
  if (path === '/admins/recording-sequences' || path.match(/^\/admins\/recording-sequences\/[^/]+/)) return 'admin.recordings.manage';
  if (path.match(/^\/admins\/recordings\/[^/]+\/resources$/)) return 'admin.recordings.manage';
  if (path === '/admins/workshops' || path.match(/^\/admins\/workshops\/[^/]+/)) return 'admin.meetings.manage';
  if (path === '/admins/resources' || path.match(/^\/admins\/resources\/[^/]+/)) return 'admin.resources.manage';
  if (path === '/admins/announcements' || path.match(/^\/admins\/announcements\/[^/]+/)) return 'admin.announcements.manage';
  if (path === '/admins/email-templates' || path.match(/^\/admins\/email-templates\/[^/]+/)) return 'admin.email.manage';
  if (path === '/admins/feature-controls' || path.match(/^\/admins\/feature-controls\/[^/]+/)) return 'admin.feature_control.manage';
  if (path === '/admins/certificate-program-settings' || path === '/admins/certificates/leadership' || path === '/admins/certificates/live-project' || path === '/admins/certificates/manual') return 'admin.certificates.issue';
  if (path.match(/^\/admins\/certificates\/[^/]+\/revoke$/)) return 'admin.certificates.issue';
  if (path === '/admins/support-categories' || path === '/admins/support-faqs') return 'admin.support.manage';
  if (path.match(/^\/admins\/support-(categories|faqs)\/[^/]+/)) return 'admin.support.manage';
  if (path.match(/^\/admins\/support-tickets\/[^/]+/)) return 'admin.support.manage';

  return method === 'post' || method === 'patch' ? 'admin.dashboard.view' : undefined;
}

function getFunctionPermission(functionName: string, body: unknown): AdminPermission | undefined {
  if (functionName === 'admin-users') return 'admin.admin_users.manage';
  if (functionName === 'zoom-meetings') return 'admin.meetings.manage';
  if (functionName === 'certificate-issuance') return isRecord(body) && 'sendEmail' in body ? 'admin.certificates.issue' : undefined;
  if (functionName === 'admin-students') {
    const action = isRecord(body) ? String(body.action ?? '') : '';
    if (action === 'status-summary' || action === 'invite-health') return 'admin.students.view';
    if (action === 'resend-invite') return 'admin.students.invite';
    return 'admin.students.manage';
  }
  if (functionName === 'transactional-email') return 'admin.email.manage';
  return undefined;
}

function getRequestSupabaseClient(accessToken: string, userId: string) {
  if (!webEnv.supabaseUrl || !webEnv.supabaseAnonKey) {
    throw new ApiClientError('Supabase is not configured.', 503);
  }

  const cacheKey = `${userId}:${accessToken}`;
  if (requestClientCache?.key === cacheKey) return requestClientCache.client;

  const client = createClient(webEnv.supabaseUrl, webEnv.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `lms-request-${userId}-${accessToken.slice(-12)}`
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

  requestClientCache = { client, key: cacheKey };
  return client;
}

async function createContext(accessToken?: string) {
  const authClient = getSupabaseClient();
  if (!authClient || !webEnv.supabaseUrl || !webEnv.supabaseAnonKey) {
    throw new ApiClientError('Supabase is not configured.', 503);
  }
  if (!accessToken) throw new ApiClientError('Supabase access token is required.', 401);

  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user?.email) throw new ApiClientError('Supabase session is invalid.', 401);

  const supabase = getRequestSupabaseClient(accessToken, data.user.id);
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
  if (!row.auth_user_id && row.id && normalizeEmail(row.email) === context.email) {
    void context.supabase
      .from('students')
      .update({ auth_user_id: context.userId, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('auth_user_id', null)
      .then(() => undefined);
  }

  const liveProjectRoleIds = asStringArray(row.live_project_role_ids);
  const liveProjectRoleNameById = new Map<string, string>();
  if (liveProjectRoleIds.length > 0) {
    const { data: roleRows, error: roleError } = await context.supabase.from('role_master').select('role_id,role_name').in('role_id', liveProjectRoleIds).limit(500);
    if (roleError) throw new ApiClientError(roleError.message, 503);
    (roleRows ?? []).forEach((role) => {
      const roleId = String(role.role_id ?? '').trim();
      const roleName = String(role.role_name ?? roleId).trim();
      if (roleId) liveProjectRoleNameById.set(roleId, roleName || roleId);
    });
  }

  return camelize({
    ...row,
    live_project_role_ids: liveProjectRoleIds,
    live_project_roles: uniqueStrings(liveProjectRoleIds.map((roleId) => liveProjectRoleNameById.get(roleId) ?? roleId))
  });
}

async function updateStudentPresence(context: Awaited<ReturnType<typeof createContext>>) {
  const { data, error } = await context.supabase.rpc('update_student_last_seen');
  if (error) throw new ApiClientError(error.message, 503);
  return { lastSeenAt: data };
}

async function getAdminProfile(context: Awaited<ReturnType<typeof createContext>>): Promise<AdminProfileRecord> {
  const { data, error } = await context.supabase
    .from('admin_users')
    .select('*')
    .or(`auth_user_id.eq.${context.userId},email.eq.${context.email}`)
    .limit(2);

  if (error) throw new ApiClientError(error.message, 503);

  const row = chooseIdentityRow(data, context);
  if (!row) throw new ApiClientError('No admin profile is linked to this Supabase user.', 404);
  if (row.status !== 'active') throw new ApiClientError('Admin profile is inactive.', 403);
  const role = normalizeAdminRole(row.role);
  const profile = camelize(row) as Record<string, unknown>;
  const permissions = Array.isArray(profile.permissions) ? (profile.permissions as AdminPermission[]) : null;
  return {
    ...profile,
    permissions: getEffectiveAdminPermissions(role, permissions),
    role
  };
}

async function requireAdminPermission(context: Awaited<ReturnType<typeof createContext>>, permission: AdminPermission) {
  const admin = await getAdminProfile(context);
  if (!hasAdminPermission((admin as Record<string, unknown>).role, permission, admin.permissions)) {
    throw new ApiClientError('Your admin role does not have permission for this action.', 403);
  }
  return admin;
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

async function enrichStudentCohortProgramNames(context: Awaited<ReturnType<typeof createContext>>, items: unknown[]) {
  const rows = items.map((item) => (isRecord(item) ? item : null));
  const programKeys = uniqueStrings(
    rows
      .map((row) => String(row?.program_key ?? row?.programKey ?? '').trim().toLowerCase())
      .filter(Boolean)
  );
  if (programKeys.length === 0) return items;

  const { data, error } = await context.supabase
    .from('programs')
    .select('program_key,name,short_name')
    .in('program_key', programKeys)
    .limit(500);
  if (error) throw new ApiClientError(`Student program names could not be loaded: ${error.message}`, 503);

  const programNameByKey = new Map(
    (data ?? []).map((program) => [
      String(program.program_key ?? '').trim().toLowerCase(),
      String(program.name ?? program.short_name ?? program.program_key ?? '').trim()
    ])
  );

  return items.map((item) => {
    if (!isRecord(item)) return item;
    const programKey = String(item.program_key ?? item.programKey ?? '').trim().toLowerCase();
    const programName = programNameByKey.get(programKey);
    return programName ? { ...item, program_name: programName } : item;
  });
}

async function getStudentProjectToolkit(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const student = await getStudentProfile(context);
  const studentId = String((student as Record<string, unknown>).id ?? '');
  const directProgramValues = [
    ...asStringArray((student as Record<string, unknown>).trackRoleIds),
    ...String((student as Record<string, unknown>).programName ?? '').split(',')
  ];
  const { data: programRows, error: programError } = studentId
    ? await context.supabase
      .from('student_programs')
      .select('program_key')
      .eq('student_id', studentId)
      .limit(500)
    : { data: [], error: null };
  if (programError) throw new ApiClientError(`Project toolkit program lookup failed: ${programError.message}`, 503);

  const studentProgramKeys = new Set(
    uniqueStrings([
      ...directProgramValues,
      ...(programRows ?? []).map((row) => String(row.program_key ?? ''))
    ].map((key) => key.trim().toLowerCase()).filter(Boolean))
  );

  const { data, error } = await context.supabase
    .from('project_toolkit_items')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })
    .limit(500);
  if (error) throw new ApiClientError(`Project toolkit could not be loaded: ${error.message}`, 503);

  const items = (data ?? [])
    .map(enrichRow)
    .map(camelize)
    .filter((item) => {
      if (!isRecord(item)) return false;
      const itemProgramKeys = asStringArray(item.programKeys).map((key) => key.trim().toLowerCase()).filter(Boolean);
      return itemProgramKeys.length === 0 || itemProgramKeys.some((key) => studentProgramKeys.has(key));
    });

  return paginate(items, query);
}

async function getAdminDashboard(context: Awaited<ReturnType<typeof createContext>>) {
  const admin = await getAdminProfile(context);
  const [summaryResult, recordings, lightweightOps] = await Promise.all([
    safeCallRpc(context, 'lms_admin_dashboard_summary'),
    safeCountRows(context, 'workshops', (request) => request.eq('workshop_status', 'Completed')),
    safeLightweightOperationsSummary(context)
  ]);

  const published = recordings;
  const baseSummary = isRecord(summaryResult) ? summaryResult : {};
  const baseOperations = isRecord(baseSummary.operations) ? baseSummary.operations : {};
  const baseActiveUsers = isRecord(baseSummary.activeUsers) ? baseSummary.activeUsers : {};
  const baseMeetings = isRecord(baseSummary.meetings) ? baseSummary.meetings : {};

  return {
    admin,
    summary: {
      ...baseSummary,
      activeUsers: { ...baseActiveUsers, ...lightweightOps.activeUsers },
      meetings: { ...baseMeetings, ...lightweightOps.meetings },
      operations: { ...baseOperations, ...lightweightOps.operations },
      publishedRecordings: { total: published },
      recordings: { ...(isRecord(baseSummary.recordings) ? baseSummary.recordings : {}), published, total: published }
    }
  };
}

async function getAdminObservability(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const admin = await getAdminProfile(context);
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 20), 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const severity = String(query?.severity ?? 'all');
  const moduleFilter = String(query?.module ?? 'all');
  const actionType = String(query?.actionType ?? 'all');
  const search = String(query?.search ?? '').trim().toLowerCase();

  let auditRequest = context.supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (moduleFilter !== 'all') auditRequest = auditRequest.eq('entity_type', moduleFilter);
  if (actionType !== 'all') {
    if (actionType === 'meetings') auditRequest = auditRequest.eq('entity_type', 'workshop');
    else auditRequest = auditRequest.eq('action', actionType);
  }
  if (search) {
    const safeSearch = search.replace(/[%(),]/g, '');
    auditRequest = auditRequest.or(`action.ilike.%${safeSearch}%,actor_email.ilike.%${safeSearch}%,entity_type.ilike.%${safeSearch}%`);
  }

  let eventRequest = context.supabase.from('system_event_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (severity !== 'all') eventRequest = eventRequest.eq('severity', severity);
  if (moduleFilter !== 'all') eventRequest = eventRequest.eq('module', moduleFilter);
  if (search) {
    const safeSearch = search.replace(/[%(),]/g, '');
    eventRequest = eventRequest.or(`message.ilike.%${safeSearch}%,event_type.ilike.%${safeSearch}%,module.ilike.%${safeSearch}%`);
  }

  const [summary, auditLogs, eventLogs, alerts] = await Promise.all([
    getLightweightOperationsSummary(context),
    auditRequest.range(from, to),
    eventRequest.range(0, 19),
    context.supabase.from('system_alerts').select('*', { count: 'exact' }).eq('status', 'open').order('created_at', { ascending: false }).limit(10)
  ]);

  if (auditLogs.error && !isObservabilityReadError(auditLogs.error)) throw new ApiClientError(auditLogs.error.message, 503);
  if (eventLogs.error && !isMissingSchemaError(eventLogs.error)) throw new ApiClientError(eventLogs.error.message, 503);
  if (alerts.error && !isMissingSchemaError(alerts.error)) throw new ApiClientError(alerts.error.message, 503);

  const auditRows = auditLogs.error ? [] : auditLogs.data ?? [];
  const actorEmails = uniqueStrings(auditRows.map((row) => normalizeEmail(row.actor_email)));
  const actorNamesByEmail = await getAdminNamesByEmail(context, actorEmails);

  return {
    admin,
    alerts: createPaginatedResponse((alerts.error ? [] : alerts.data ?? []).map(enrichRow).map(camelize), alerts.error ? 0 : alerts.count ?? 0, 1, 10),
    auditLogs: createPaginatedResponse(
      auditRows.map((row) => {
        const enriched = enrichRow(row);
        const base = isRecord(enriched) ? enriched : row;
        return camelize({ ...base, actor_name: actorNamesByEmail.get(normalizeEmail(row.actor_email)) ?? row.actor_email });
      }),
      auditLogs.error ? 0 : auditLogs.count ?? 0,
      page,
      limit
    ),
    eventLogs: createPaginatedResponse((eventLogs.error ? [] : eventLogs.data ?? []).map(enrichRow).map(camelize), eventLogs.error ? 0 : eventLogs.count ?? 0, 1, 20),
    summary
  };
}

async function getLightweightOperationsSummary(context: Awaited<ReturnType<typeof createContext>>) {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const today = startOfDayIso(now);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    activeFiveMinutes,
    activeOneHour,
    activeToday,
    recentStudents,
    recentAdminActions,
    recentErrors,
    openAlerts,
    failedAdminLogins,
    meetingsCreatedToday,
    meetingsScheduledWeek,
    meetingsCancelledWeek,
    recordingsAddedToday,
    completedMeetings,
    completedMeetingsWithRecordings,
    recentlyChangedMeetings
  ] = await Promise.all([
    safeCountRows(context, 'students', (request) => request.eq('active', true).gte('last_seen_at', fiveMinutesAgo)),
    safeCountRows(context, 'students', (request) => request.eq('active', true).gte('last_seen_at', oneHourAgo)),
    safeCountRows(context, 'students', (request) => request.eq('active', true).gte('last_seen_at', today)),
    context.supabase.from('students').select('id,email,full_name,student_id,last_seen_at,cohort_name,program_name').eq('active', true).gte('last_seen_at', oneHourAgo).order('last_seen_at', { ascending: false }).limit(8),
    safeCountRows(context, 'audit_logs', (request) => request.gte('created_at', twentyFourHoursAgo)),
    safeCountRows(context, 'system_event_logs', (request) => request.in('severity', ['error', 'critical']).gte('created_at', twentyFourHoursAgo)),
    safeCountRows(context, 'system_alerts', (request) => request.eq('status', 'open')),
    safeCountRows(context, 'system_event_logs', (request) => request.eq('event_type', 'admin_login_failed').gte('created_at', today)),
    safeCountRows(context, 'audit_logs', (request) => request.eq('entity_type', 'workshop').eq('action', 'admin_workshop_created').gte('created_at', today)),
    countRows(context, 'workshops', (request) => request.in('workshop_status', ['Scheduled', 'Upcoming', 'Live']).gte('date', now.toISOString().slice(0, 10)).lt('date', weekEnd)),
    safeCountRows(context, 'audit_logs', (request) => request.eq('entity_type', 'workshop').eq('action', 'admin_workshop_cancelled').gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())),
    safeCountRows(context, 'audit_logs', (request) => request.eq('entity_type', 'workshop').in('action', ['admin_workshop_recording_updated', 'admin_workshop_recording_published']).gte('created_at', today)),
    countRows(context, 'workshops', (request) => request.eq('workshop_status', 'Completed')),
    countRows(context, 'workshops', (request) => request.eq('workshop_status', 'Completed').or('youtube_video_url.not.is.null,zoom_recording_url.not.is.null')),
    context.supabase.from('workshops').select('id,title,workshop_id,workshop_status,date,updated_at,youtube_video_url,zoom_recording_url').order('updated_at', { ascending: false }).limit(6)
  ]);

  if (recentStudents.error && !isMissingSchemaError(recentStudents.error)) throw new ApiClientError(recentStudents.error.message, 503);
  if (recentlyChangedMeetings.error) throw new ApiClientError(recentlyChangedMeetings.error.message, 503);

  const changedMeetings = (recentlyChangedMeetings.data ?? []).map(enrichRow).map(camelize);
  const completedWithoutRecordings = Math.max(0, completedMeetings - completedMeetingsWithRecordings);

  return {
    activeUsers: {
      studentsLastFiveMinutes: activeFiveMinutes,
      studentsLastHour: activeOneHour,
      studentsToday: activeToday,
      totalLastHour: activeOneHour
    },
    meetings: {
      cancelledThisWeek: meetingsCancelledWeek,
      createdToday: meetingsCreatedToday,
      recordingsAddedToday,
      scheduledThisWeek: meetingsScheduledWeek,
      withoutRecordings: completedWithoutRecordings
    },
    operations: {
      failedAdminLoginsToday: failedAdminLogins,
      openAlerts,
      recentAdminActions,
      recentErrors
    },
    recentStudents: (recentStudents.error ? [] : recentStudents.data ?? []).map(enrichRow).map(camelize),
    recentlyChangedMeetings: changedMeetings
  };
}

async function safeLightweightOperationsSummary(context: Awaited<ReturnType<typeof createContext>>) {
  try {
    return await getLightweightOperationsSummary(context);
  } catch (error) {
    return emptyLightweightOperationsSummary();
  }
}

function emptyLightweightOperationsSummary() {
  return {
    activeUsers: {
      studentsLastFiveMinutes: 0,
      studentsLastHour: 0,
      studentsToday: 0,
      totalLastHour: 0
    },
    meetings: {
      cancelledThisWeek: 0,
      createdToday: 0,
      recordingsAddedToday: 0,
      scheduledThisWeek: 0,
      withoutRecordings: 0
    },
    operations: {
      failedAdminLoginsToday: 0,
      openAlerts: 0,
      recentAdminActions: 0,
      recentErrors: 0
    },
    recentStudents: [],
    recentlyChangedMeetings: []
  };
}

async function safeCallRpc(context: Awaited<ReturnType<typeof createContext>>, functionName: string, params?: Record<string, string>) {
  try {
    return await callRpc(context, functionName, params);
  } catch (error) {
    return {};
  }
}

async function safeCountRows(
  context: Awaited<ReturnType<typeof createContext>>,
  table: string,
  build?: (request: SupabaseQuery) => SupabaseQuery
) {
  try {
    return await countRows(context, table, build);
  } catch (error) {
    if (error instanceof ApiClientError && isObservabilityReadError(error)) return 0;
    throw error;
  }
}

async function countRows(
  context: Awaited<ReturnType<typeof createContext>>,
  table: string,
  build?: (request: SupabaseQuery) => SupabaseQuery
) {
  let request = context.supabase.from(table).select('id', { count: 'exact', head: true }) as unknown as LightweightCountRequest;
  if (build) request = build(request) as unknown as LightweightCountRequest;
  const { count, error } = await request;
  if (error) throw new ApiClientError(error.message, 503);
  return count ?? 0;
}

async function getAdminNamesByEmail(context: Awaited<ReturnType<typeof createContext>>, emails: string[]) {
  if (emails.length === 0) return new Map<string, string>();
  const { data, error } = await context.supabase.from('admin_users').select('email,full_name').in('email', emails).limit(100);
  if (error) return new Map<string, string>();
  const entries: Array<[string, string]> = (data ?? [])
    .map((row) => [normalizeEmail(row.email), String(row.full_name || row.email || '').trim()] as [string, string])
    .filter(([email]) => Boolean(email));
  return new Map(entries);
}

function isMissingSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : isRecord(error) && typeof error.message === 'string' ? error.message : '';
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : '';
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    /relation .* does not exist|column .* does not exist|could not find .* column|schema cache/i.test(message)
  );
}

function isObservabilityReadError(error: unknown) {
  const message = error instanceof Error ? error.message : isRecord(error) && typeof error.message === 'string' ? error.message : '';
  return isMissingSchemaError(error) || /permission denied|row-level security|not authorized|not allowed/i.test(message);
}

async function getStudentBundleList(context: Awaited<ReturnType<typeof createContext>>, sections: string[], query: ApiClientOptions['query']) {
  const bundle = await callRpc(context, 'student_dashboard_bundle', { p_student_email: context.email });
  const items = extractItems(bundle, sections);
  const activeOnly = query?.activeOnly === true || query?.activeOnly === 'true';
  const filteredItems = activeOnly && sections.includes('announcements') ? items.filter(isVisibleAnnouncementNow) : items;
  const enrichedItems = sections.includes('cohorts') || sections.includes('studentCohorts')
    ? await enrichStudentCohortProgramNames(context, filteredItems)
    : filteredItems;
  return paginate(enrichedItems, query);
}

async function getStudentRecordingsList(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const bundle = await callRpc(context, 'student_dashboard_bundle', { p_student_email: context.email });
  const workshops = extractItems(bundle, ['recordings', 'workshopRecordings', 'workshops']);
  const cohorts = extractItems(bundle, ['cohorts', 'studentCohorts']);
  const enrolledPrograms = extractItems(bundle, ['studentPrograms', 'programs', 'activePrograms']);
  const rows = workshops.filter(isStudentRecordingRow).map(enrichRow).map(camelize).filter(studentRecordingHasAudienceScope);
  const sequencedItems = await enrichStudentRecordingsWithSequence(context, rows, [...cohorts, ...enrolledPrograms]);
  const items = await enrichStudentRecordingsWithRelatedResources(context, sequencedItems);
  const search = String(query?.search ?? '').trim().toLowerCase();
  const filtered = items
    .filter((item) => matchesClientFilters(item, query))
    .filter((item) => !search || JSON.stringify(item).toLowerCase().includes(search))
    .sort(compareStudentRecordingsWithSequence);
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 25), 500);
  const start = (page - 1) * limit;
  return createPaginatedResponse(filtered.slice(start, start + limit), filtered.length, page, limit);
}

async function getAdminRecordingResourceLinks(context: Awaited<ReturnType<typeof createContext>>, recordingId: string) {
  const cleanRecordingId = recordingId.trim();
  if (!cleanRecordingId) throw new ApiClientError('Recording ID is required.', 400);

  const { data, error } = await context.supabase
    .from('recording_resource_links')
    .select('resource_id')
    .eq('recording_id', cleanRecordingId)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw new ApiClientError(error.message, 503);

  return {
    recordingId: cleanRecordingId,
    resourceIds: (data ?? []).map((row) => String(row.resource_id ?? '')).filter(Boolean)
  };
}

async function getAdminRecordingResourceSummary(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const recordingIds = uniqueStrings(splitCommaValues(String(query?.recordingIds ?? query?.recording_ids ?? '')).map((recordingId) => recordingId.trim()).filter(Boolean));
  if (recordingIds.length === 0) {
    return { items: [] };
  }

  const { data, error } = await context.supabase
    .from('recording_resource_links')
    .select('recording_id,resource_id')
    .in('recording_id', recordingIds)
    .limit(5000);

  if (error) throw new ApiClientError(error.message, 503);

  const resourceIdsByRecordingId = new Map<string, Set<string>>();
  (data ?? []).forEach((link) => {
    const recordingId = String(link.recording_id ?? '');
    const resourceId = String(link.resource_id ?? '');
    if (!recordingId || !resourceId) return;
    const resourceIds = resourceIdsByRecordingId.get(recordingId) ?? new Set<string>();
    resourceIds.add(resourceId);
    resourceIdsByRecordingId.set(recordingId, resourceIds);
  });

  return {
    items: recordingIds.map((recordingId) => ({
      recordingId,
      resourceCount: resourceIdsByRecordingId.get(recordingId)?.size ?? 0
    }))
  };
}

async function updateAdminRecordingResourceLinks(context: Awaited<ReturnType<typeof createContext>>, recordingId: string, body: unknown) {
  const cleanRecordingId = recordingId.trim();
  if (!cleanRecordingId) throw new ApiClientError('Recording ID is required.', 400);
  if (!isRecord(body)) throw new ApiClientError('Resource link payload must be an object.', 400);

  const resourceIds = uniqueStrings(asStringArray(body.resourceIds ?? body.resource_ids))
    .map((resourceId) => resourceId.trim())
    .filter(Boolean);

  const { data: workshop, error: workshopError } = await context.supabase
    .from('workshops')
    .select('id,title')
    .eq('id', cleanRecordingId)
    .maybeSingle();
  if (workshopError) throw new ApiClientError(workshopError.message, 503);
  if (!workshop) throw new ApiClientError('Recording workshop was not found.', 404);

  if (resourceIds.length > 0) {
    const { data: resources, error: resourcesError } = await context.supabase
      .from('resources')
      .select('id')
      .in('id', resourceIds)
      .eq('status', 'active')
      .limit(resourceIds.length);
    if (resourcesError) throw new ApiClientError(resourcesError.message, 503);
    const foundIds = new Set((resources ?? []).map((resource) => String(resource.id ?? '')));
    const missingIds = resourceIds.filter((resourceId) => !foundIds.has(resourceId));
    if (missingIds.length > 0) throw new ApiClientError('Only active Resource Library items can be linked to recordings.', 400);
  }

  const { error: deleteError } = await context.supabase.from('recording_resource_links').delete().eq('recording_id', cleanRecordingId);
  if (deleteError) throw new ApiClientError(deleteError.message, 503);

  if (resourceIds.length > 0) {
    const rows = resourceIds.map((resourceId) => ({
      created_by: context.email,
      recording_id: cleanRecordingId,
      resource_id: resourceId
    }));
    const { error: insertError } = await context.supabase.from('recording_resource_links').insert(rows);
    if (insertError) throw new ApiClientError(insertError.message, 503);
  }

  return {
    recordingId: cleanRecordingId,
    resourceIds
  };
}

function recordingResourceLookupIds(recording: Record<string, unknown>) {
  return uniqueStrings(
    [
      recording.id,
      recording.workshopId,
      recording.workshop_id
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
  );
}

async function getStudentRecordingResources(context: Awaited<ReturnType<typeof createContext>>, recordingId: string) {
  const cleanRecordingId = recordingId.trim();
  if (!cleanRecordingId) throw new ApiClientError('Recording ID is required.', 400);

  const resourceIdsByRecordingId = await getStudentVisibleRecordingResourceMap(context, [cleanRecordingId]);
  return {
    recordingId: cleanRecordingId,
    resources: resourceIdsByRecordingId.get(cleanRecordingId) ?? []
  };
}

async function getStudentVisibleRecordingResourceMap(context: Awaited<ReturnType<typeof createContext>>, recordingIds: string[]) {
  const cleanRecordingIds = uniqueStrings(recordingIds.map((recordingId) => recordingId.trim()).filter(Boolean));
  const resourcesByRecordingId = new Map<string, Array<Record<string, unknown>>>();
  if (cleanRecordingIds.length === 0) return resourcesByRecordingId;

  const { data: links, error } = await context.supabase
    .from('recording_resource_links')
    .select('recording_id,resource_id')
    .in('recording_id', cleanRecordingIds)
    .limit(5000);

  if (error) {
    console.warn('Recording resource links unavailable; hiding related resources.', error.message);
    return resourcesByRecordingId;
  }

  const resourceIdsByRecordingId = new Map<string, string[]>();
  (links ?? []).forEach((link) => {
    const recordingId = String(link.recording_id ?? '');
    const resourceId = String(link.resource_id ?? '');
    if (!recordingId || !resourceId) return;
    const current = resourceIdsByRecordingId.get(recordingId) ?? [];
    current.push(resourceId);
    resourceIdsByRecordingId.set(recordingId, current);
  });

  if (resourceIdsByRecordingId.size === 0) return resourcesByRecordingId;

  const resourcesData = await callRpc(context, 'student_resources_view', { p_student_email: context.email });
  const visibleResources = extractItems(resourcesData, ['resources', 'items'])
    .map(enrichRow)
    .map(camelize)
    .filter(isRecord)
    .filter((resource) => resource.locked !== true && resource.hasAccess !== false);
  const visibleResourceById = new Map(visibleResources.map((resource) => [String(resource.id ?? ''), resource]));

  resourceIdsByRecordingId.forEach((resourceIds, recordingId) => {
    const relatedResources = uniqueStrings(resourceIds)
      .map((resourceId) => visibleResourceById.get(resourceId))
      .filter(isRecord)
      .map((resource) => ({
        description: resource.description ?? null,
        id: String(resource.id ?? ''),
        resourceMode: resource.resourceMode ?? resource.resource_mode ?? null,
        resourceType: resource.resourceType ?? resource.resource_type ?? 'general',
        title: String(resource.title ?? 'Resource'),
        url: resource.url ?? null
      }))
      .filter((resource) => resource.id && resource.url);
    resourcesByRecordingId.set(recordingId, relatedResources);
  });

  return resourcesByRecordingId;
}

async function enrichStudentRecordingsWithRelatedResources(context: Awaited<ReturnType<typeof createContext>>, recordings: unknown[]) {
  const rows = recordings.filter(isRecord);
  const recordingIds = uniqueStrings(rows.flatMap(recordingResourceLookupIds));
  if (recordingIds.length === 0) return recordings;

  const resourcesByRecordingId = await getStudentVisibleRecordingResourceMap(context, recordingIds);
  if (resourcesByRecordingId.size === 0) return recordings;

  return rows.map((recording) => {
    const relatedResourcesById = new Map<string, Record<string, unknown>>();
    recordingResourceLookupIds(recording).forEach((recordingId) => {
      (resourcesByRecordingId.get(recordingId) ?? []).forEach((resource) => {
        const resourceId = String(resource.id ?? '');
        if (resourceId) relatedResourcesById.set(resourceId, resource);
      });
    });

    return {
      ...recording,
      relatedResources: Array.from(relatedResourcesById.values())
    };
  });
}

async function enrichStudentRecordingsWithSequence(context: Awaited<ReturnType<typeof createContext>>, recordings: unknown[], cohorts: unknown[] = []) {
  const rows = recordings.filter(isRecord);
  const cohortProgramMap = buildRecordingCohortProgramMap(cohorts);
  const enrolledProgramKeys = uniqueStrings(Array.from(cohortProgramMap.values())).map((key) => key.toLowerCase());
  const programKeys = uniqueStrings(rows.flatMap((row) => recordingProgramKeys(row, cohortProgramMap, enrolledProgramKeys)).filter(Boolean));
  if (programKeys.length === 0) return recordings;

  const { data, error } = await context.supabase
    .from('recording_sequence_rules')
    .select('*')
    .eq('status', 'active')
    .in('program_key', programKeys)
    .order('sequence_number', { ascending: true })
    .limit(1000);

  if (error) {
    console.warn('Recording sequence rules unavailable; falling back to standard recording order.', error.message);
    return recordings;
  }

  const rules = (data ?? []).map((item) => camelize(item)).filter(isRecord);
  if (rules.length === 0) return recordings;

  return rows.map((recording) => {
    const inferredProgramKeys = recordingProgramKeys(recording, cohortProgramMap, enrolledProgramKeys);
    const match = findRecordingSequenceRule(recording, rules, inferredProgramKeys);
    return match
      ? {
          ...recording,
          programKey: String(recording.programKey ?? recording.program_key ?? '') || inferredProgramKeys[0],
          recordingSequenceMatched: true,
          recordingSequenceNumber: Number(match.sequenceNumber),
          recordingSequenceProgramKey: String(match.programKey ?? ''),
          recordingSection: normalizeRecordingSection(match.recordingSection ?? match.recording_section),
          recordingSequenceTitle: String(match.title ?? '')
        }
      : {
          ...recording,
          recordingSection: normalizeRecordingSection(recording.recordingSection ?? recording.recording_section)
        };
  });
}

function compareStudentRecordingsWithSequence(left: unknown, right: unknown) {
  if (isRecord(left) && isRecord(right)) {
    const leftSequence = Number(left.recordingSequenceNumber);
    const rightSequence = Number(right.recordingSequenceNumber);
    const leftSequenced = Number.isFinite(leftSequence);
    const rightSequenced = Number.isFinite(rightSequence);

    if (leftSequenced && rightSequenced && leftSequence !== rightSequence) return leftSequence - rightSequence;
    if (leftSequenced !== rightSequenced) return leftSequenced ? -1 : 1;

    const scheduledDiff = recordingScheduledTime(right, 0) - recordingScheduledTime(left, 0);
    if (scheduledDiff !== 0) return scheduledDiff;

    return String(left.title ?? '').localeCompare(String(right.title ?? ''));
  }

  return 0;
}

function findRecordingSequenceRule(recording: Record<string, unknown>, rules: Record<string, unknown>[], programKeys = recordingProgramKeys(recording)) {
  if (programKeys.length === 0) return undefined;
  const programKeySet = new Set(programKeys);
  return rules.find((rule) => programKeySet.has(String(rule.programKey ?? '').trim().toLowerCase()) && recordingMatchesSequenceRule(recording, rule));
}

function buildRecordingCohortProgramMap(cohorts: unknown[]) {
  const map = new Map<string, string>();
  cohorts.filter(isRecord).forEach((cohort) => {
    const programKey = recordingProgramKey(cohort);
    if (!programKey) return;
    const names = uniqueStrings([
      cohort.name,
      cohort.cohortName,
      cohort.cohort_name,
      cohort.cohortId,
      cohort.cohort_id
    ]).map((name) => name.toLowerCase());
    names.forEach((name) => map.set(name, programKey));
  });
  return map;
}

function recordingProgramKeys(recording: Record<string, unknown>, cohortProgramMap = new Map<string, string>(), enrolledProgramKeys: string[] = []) {
  const directProgramKey = recordingProgramKey(recording);
  const cohortProgramKeys = recordingCohortNames(recording)
    .map((cohortName) => cohortProgramMap.get(cohortName))
    .filter(Boolean);
  const inferredFallback = directProgramKey || cohortProgramKeys.length > 0 || enrolledProgramKeys.length !== 1 ? [] : enrolledProgramKeys;
  return uniqueStrings([directProgramKey, ...cohortProgramKeys, ...inferredFallback]).map((key) => key.toLowerCase());
}

function recordingProgramKey(recording: Record<string, unknown>) {
  return String(recording.programKey ?? recording.program_key ?? recording.domainKey ?? recording.domain_key ?? '').trim().toLowerCase();
}

function recordingCohortNames(recording: Record<string, unknown>) {
  return uniqueStrings([
    ...asStringArray(recording.cohortNames ?? recording.cohort_names),
    recording.cohortName,
    recording.cohort_name,
    recording.cohort,
    recording.cohortId,
    recording.cohort_id
  ]).map((cohortName) => cohortName.toLowerCase());
}

function studentRecordingHasAudienceScope(recording: unknown) {
  if (!isRecord(recording)) return false;
  return Boolean(recordingProgramKey(recording)) || recordingCohortNames(recording).length > 0;
}

function recordingMatchesSequenceRule(recording: Record<string, unknown>, rule: Record<string, unknown>) {
  const recordingTitle = normalizeRecordingSequenceText(String(recording.title ?? ''));
  if (!recordingTitle) return false;
  const candidates = uniqueStrings([String(rule.title ?? ''), ...asStringArray(rule.matchAliases ?? rule.match_aliases)])
    .map(normalizeRecordingSequenceText)
    .filter(Boolean);
  return candidates.some(
    (candidate) =>
      candidate === recordingTitle ||
      (candidate.length >= 8 && recordingTitle.includes(candidate)) ||
      (recordingTitle.length >= 8 && candidate.includes(recordingTitle))
  );
}

function normalizeRecordingSequenceText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRecordingSection(value: unknown) {
  const section = String(value ?? '').trim().toLowerCase();
  return RECORDING_SECTION_KEYS.has(section) ? section : 'other_workshops';
}

function recordingScheduledTime(recording: Record<string, unknown>, fallback = Number.POSITIVE_INFINITY) {
  const dateValue = String(recording.date ?? '').trim();
  const timeValue = String(recording.time ?? '').trim();
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})/);

  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;
    const scheduledAt = new Date(Number(year), Number(month) - 1, Number(day), hour, minute).getTime();
    return Number.isFinite(scheduledAt) ? scheduledAt : fallback;
  }

  const fallbackDate = dateValue ? new Date(dateValue).getTime() : Number.NaN;
  return Number.isFinite(fallbackDate) ? fallbackDate : fallback;
}

async function getStudentResourcesList(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const data = await callRpc(context, 'student_resources_view', { p_student_email: context.email });
  const items = extractItems(data, ['resources', 'items']).map(enrichRow).map(camelize).filter((item) => matchesClientFilters(item, query));
  const search = String(query?.search ?? '').trim().toLowerCase();
  const filtered = search ? items.filter((item) => JSON.stringify(item).toLowerCase().includes(search)) : items;
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 25), 500);
  const start = (page - 1) * limit;
  const summary = summarizeStudentResources(filtered);
  return { ...createPaginatedResponse(filtered.slice(start, start + limit), filtered.length, page, limit), summary };
}

function summarizeStudentResources(items: unknown[]) {
  const typeCounts: Record<string, number> = {};
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let available = 0;
  let free = 0;
  let locked = 0;
  let paid = 0;
  let recentlyAdded = 0;

  items.forEach((item) => {
    if (!isRecord(item)) return;
    const isLocked = item.locked === true;
    const accessType = String(item.accessType ?? item.access_type ?? '');
    const resourceType = String(item.resourceType ?? item.resource_type ?? 'general') || 'general';
    const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : typeof item.updated_at === 'string' ? item.updated_at : '';
    const updatedTime = updatedAt ? new Date(updatedAt).getTime() : Number.NaN;

    if (!isLocked && item.hasAccess !== false) available += 1;
    if (isLocked) locked += 1;
    if (accessType === 'paid') paid += 1;
    if (accessType !== 'paid') free += 1;
    if (!Number.isNaN(updatedTime) && updatedTime >= oneWeekAgo) recentlyAdded += 1;
    typeCounts[resourceType] = (typeCounts[resourceType] ?? 0) + 1;
  });

  return { available, free, locked, paid, recentlyAdded, typeCounts };
}

async function getRpcList(context: Awaited<ReturnType<typeof createContext>>, endpoint: { functionName: string; section?: string[] }, query: ApiClientOptions['query']) {
  const params: Record<string, boolean | string> = { p_student_email: context.email };
  if (endpoint.functionName === 'student_schedule_view' && query?.includePast === true) {
    params.p_include_past = true;
  }
  const data = await callRpc(context, endpoint.functionName, params);
  const items = extractItems(data, endpoint.section ?? ['items']);
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

async function getAdminStudentsList(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const endpoint = TABLE_ENDPOINTS['/admins/students'];
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 25), 500);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const cohortName = String(query?.cohortName ?? '').trim();
  const programKey = String(query?.programKey ?? '').trim();
  const queryWithoutJoins = { ...(query ?? {}) };
  delete queryWithoutJoins.cohortName;
  delete queryWithoutJoins.programKey;

  let request = context.supabase.from(endpoint.table).select('*', { count: 'exact' });
  const joinedStudentIdSets: string[][] = [];

  if (cohortName && cohortName !== 'all') {
    const { data: cohortRows, error: cohortError } = await context.supabase.from('student_cohorts').select('student_id').eq('cohort_name', cohortName).limit(5000);
    if (cohortError) throw new ApiClientError(cohortError.message, 503);
    joinedStudentIdSets.push((cohortRows ?? []).map((row) => String(row.student_id ?? '')).filter(Boolean));
  }

  if (programKey && programKey !== 'all') {
    const { data: programRows, error: programError } = await context.supabase.from('student_programs').select('student_id').eq('program_key', programKey).limit(5000);
    if (programError) throw new ApiClientError(programError.message, 503);
    joinedStudentIdSets.push((programRows ?? []).map((row) => String(row.student_id ?? '')).filter(Boolean));
  }

  if (joinedStudentIdSets.length > 0) {
    const studentIds = intersectStringSets(joinedStudentIdSets);
    if (studentIds.length === 0) return createPaginatedResponse([], 0, page, limit);
    request = request.in('id', studentIds);
  }

  request = applyCommonFilters(request, queryWithoutJoins, endpoint);
  request = applyCommonSort(request, queryWithoutJoins, endpoint);
  if (!String(queryWithoutJoins?.sort ?? '').trim()) {
    request = request.order('onboarding_sequence', { ascending: true }).order('created_at', { ascending: true });
  }

  const { count, data, error } = await request.range(from, to);
  if (error) throw new ApiClientError(error.message, 503);

  const enriched = await enrichAdminStudents(context, data ?? []);
  return createPaginatedResponse(enriched, count ?? 0, page, limit);
}

async function getAdminStudentCollegeOptions(context: Awaited<ReturnType<typeof createContext>>) {
  const { data, error } = await context.supabase.from('students').select('college_name').not('college_name', 'is', null).limit(10000);
  if (error) throw new ApiClientError(error.message, 503);

  const collegeByNormalizedName = new Map<string, string>();
  (data ?? []).forEach((row) => {
    const collegeName = String(row.college_name ?? '').trim();
    if (!collegeName) return;
    const normalizedName = collegeName.toLowerCase();
    if (!collegeByNormalizedName.has(normalizedName)) collegeByNormalizedName.set(normalizedName, collegeName);
  });
  const items = Array.from(collegeByNormalizedName.values()).sort((a, b) => a.localeCompare(b));
  return { items };
}

async function getAnnouncementRecipientCount(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  await getAdminProfile(context);
  const audience = String(query?.audience ?? 'all').trim();
  const cohortNames = splitCommaValues(query?.cohortNames);
  const programKeys = splitCommaValues(query?.programKeys);

  if (audience === 'all') {
    const { count, error } = await context.supabase.from('students').select('id', { count: 'exact', head: true }).eq('active', true);
    if (error) throw new ApiClientError(error.message, 503);
    return { total: count ?? 0 };
  }

  const studentIdSets: string[][] = [];

  if (audience === 'cohort' && cohortNames.length > 0) {
    const { data, error } = await context.supabase.from('student_cohorts').select('student_id').in('cohort_name', cohortNames).limit(10000);
    if (error) throw new ApiClientError(error.message, 503);
    studentIdSets.push((data ?? []).map((row) => String(row.student_id ?? '')).filter(Boolean));
  }

  if (audience === 'program' && programKeys.length > 0) {
    const { data, error } = await context.supabase.from('student_programs').select('student_id').in('program_key', programKeys).limit(10000);
    if (error) throw new ApiClientError(error.message, 503);
    studentIdSets.push((data ?? []).map((row) => String(row.student_id ?? '')).filter(Boolean));
  }

  const studentIds = uniqueStrings(studentIdSets.flat());
  if (studentIds.length === 0) return { total: 0 };

  const { count, error } = await context.supabase.from('students').select('id', { count: 'exact', head: true }).eq('active', true).in('id', studentIds);
  if (error) throw new ApiClientError(error.message, 503);
  return { total: count ?? 0 };
}

async function getStudentAuditLogs(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 12), 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { count, data, error } = await context.supabase.from('audit_logs').select('*', { count: 'exact' }).eq('entity_type', 'student').order('created_at', { ascending: false }).range(from, to);
  if (error) throw new ApiClientError(error.message, 503);
  return createPaginatedResponse((data ?? []).map(enrichRow).map(camelize), count ?? 0, page, limit);
}

async function enrichAdminStudents(context: Awaited<ReturnType<typeof createContext>>, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return [];

  const studentIds = rows.map((row) => String(row.id)).filter(Boolean);
  const [cohortsResult, programsResult] = await Promise.all([
    context.supabase.from('student_cohorts').select('*').in('student_id', studentIds).limit(5000),
    context.supabase.from('student_programs').select('*').in('student_id', studentIds).limit(5000)
  ]);

  if (cohortsResult.error) throw new ApiClientError(cohortsResult.error.message, 503);
  if (programsResult.error) throw new ApiClientError(programsResult.error.message, 503);

  const programKeys = Array.from(new Set((programsResult.data ?? []).map((row) => String(row.program_key ?? '').trim()).filter(Boolean)));
  const programNameByKey = new Map<string, string>();
  if (programKeys.length > 0) {
    const { data: programRows, error: programError } = await context.supabase.from('programs').select('program_key,name').in('program_key', programKeys).limit(500);
    if (programError) throw new ApiClientError(programError.message, 503);
    (programRows ?? []).forEach((program) => {
      const key = String(program.program_key ?? '').trim();
      const name = String(program.name ?? key).trim();
      if (key) programNameByKey.set(key, name);
    });
  }

  const cohortsByStudent = groupByStudentId(cohortsResult.data ?? []);
  const programsByStudent = groupByStudentId(programsResult.data ?? []);
  const studentEmails = uniqueStrings(rows.map((row) => String(row.email ?? '').trim().toLowerCase()));
  const latestInviteByEmail = new Map<string, Record<string, unknown>>();
  if (studentEmails.length > 0) {
    const { data: inviteRows, error: inviteError } = await context.supabase
      .from('email_queue')
      .select('recipient_email,status,failure_message,sent_at,updated_at,created_at')
      .in('recipient_email', studentEmails)
      .contains('tags', ['portal-invite'])
      .order('created_at', { ascending: false })
      .limit(2000);
    if (inviteError) throw new ApiClientError(inviteError.message, 503);
    (inviteRows ?? []).forEach((invite) => {
      const email = String(invite.recipient_email ?? '').trim().toLowerCase();
      if (email && !latestInviteByEmail.has(email)) latestInviteByEmail.set(email, invite);
    });
  }
  const liveProjectRoleIds = uniqueStrings(rows.flatMap((row) => asStringArray(row.live_project_role_ids)));
  const liveProjectRoleNameById = new Map<string, string>();
  if (liveProjectRoleIds.length > 0) {
    const { data: roleRows, error: roleError } = await context.supabase.from('role_master').select('role_id,role_name').in('role_id', liveProjectRoleIds).limit(1000);
    if (roleError) throw new ApiClientError(roleError.message, 503);
    (roleRows ?? []).forEach((role) => {
      const roleId = String(role.role_id ?? '').trim();
      const roleName = String(role.role_name ?? roleId).trim();
      if (roleId) liveProjectRoleNameById.set(roleId, roleName || roleId);
    });
  }

  return rows.map((row) => {
    const studentId = String(row.id);
    const cohortRows = cohortsByStudent.get(studentId) ?? [];
    const programRows = programsByStudent.get(studentId) ?? [];
    const cohortNames = uniqueStrings([
      ...cohortRows.map((cohort) => cohort.cohort_name),
      row.cohort_name
    ]);
    const studentProgramKeys = uniqueStrings([
      ...programRows.map((program) => program.program_key),
      ...asStringArray(row.track_role_ids)
    ]);
    const programNames = uniqueStrings([
      ...studentProgramKeys.map((key) => programNameByKey.get(key) ?? key),
      ...String(row.program_name ?? '')
        .split(',')
        .map((value) => value.trim())
    ]);
    const studentLiveProjectRoleIds = asStringArray(row.live_project_role_ids);
    const liveProjectRoles = uniqueStrings(studentLiveProjectRoleIds.map((roleId) => liveProjectRoleNameById.get(roleId) ?? roleId));
    const latestInvite = latestInviteByEmail.get(String(row.email ?? '').trim().toLowerCase());

    return camelize(
      enrichRow({
        ...row,
        auth_account_exists: Boolean(row.auth_user_id),
        cohort_names: cohortNames,
        cohorts: cohortRows.map((cohort) => ({
          cohort_id: cohort.cohort_id,
          cohort_name: cohort.cohort_name
        })),
        latest_invite_created_at: latestInvite?.created_at ?? null,
        latest_invite_error: latestInvite?.failure_message ?? null,
        latest_invite_sent_at: latestInvite?.sent_at ?? null,
        latest_invite_status: latestInvite?.status ?? row.onboarding_mail_status ?? null,
        latest_invite_updated_at: latestInvite?.updated_at ?? null,
        live_project_role_ids: studentLiveProjectRoleIds,
        live_project_roles: liveProjectRoles,
        program_keys: studentProgramKeys,
        programs: programNames
      })
    );
  });
}

function groupByStudentId(rows: Record<string, unknown>[]) {
  return rows.reduce<Map<string, Record<string, unknown>[]>>((groups, row) => {
    const studentId = String(row.student_id ?? '');
    if (!studentId) return groups;
    const existing = groups.get(studentId) ?? [];
    existing.push(row);
    groups.set(studentId, existing);
    return groups;
  }, new Map());
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

async function getSupportCategories(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query'], admin: boolean) {
  if (admin) await getAdminProfile(context);
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 100), 500);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const status = String(query?.status ?? '').trim();
  const search = String(query?.search ?? '').trim();

  let request = context.supabase.from('support_categories').select('*', { count: 'exact' });
  if (!admin) request = request.eq('status', 'active');
  else if (status && status !== 'all') request = request.eq('status', status);
  if (search) request = request.or(`category_name.ilike.%${search}%,category_key.ilike.%${search}%`);

  const { count, data, error } = await request.order('sort_order', { ascending: true }).order('category_name', { ascending: true }).range(from, to);
  if (error) throw new ApiClientError(error.message, 503);
  return createPaginatedResponse((data ?? []).map(camelize), count ?? 0, page, limit);
}

async function getSupportCategoryForTicket(context: Awaited<ReturnType<typeof createContext>>, rawCategory: unknown) {
  const categoryName = normalizeSupportCategory(rawCategory);
  const normalized = categoryName.toLowerCase();
  const { data, error } = await context.supabase
    .from('support_categories')
    .select('*')
    .eq('status', 'active')
    .limit(500);

  if (error) throw new ApiClientError(error.message, 503);
  const key = normalized.replace(/[^a-z0-9]+/g, '_');
  const row = (data ?? []).find((item) => String(item.category_name ?? '').trim().toLowerCase() === normalized || String(item.category_key ?? '').trim().toLowerCase() === key);
  if (!row) throw new ApiClientError('Selected support category is not active.', 400);
  return row;
}

async function getStudentSupportFaqs(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const student = await getStudentProfile(context);
  const studentId = String((student as Record<string, unknown>).id ?? '');
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 25), 200);
  const search = String(query?.search ?? '').trim().toLowerCase();

  const [cohortResult, programResult, faqResult] = await Promise.all([
    studentId ? context.supabase.from('student_cohorts').select('cohort_name').eq('student_id', studentId).limit(500) : Promise.resolve({ data: [], error: null }),
    studentId ? context.supabase.from('student_programs').select('program_key').eq('student_id', studentId).limit(500) : Promise.resolve({ data: [], error: null }),
    context.supabase.from('support_faqs').select('*').eq('status', 'published').order('featured', { ascending: false }).order('sort_order', { ascending: true }).limit(500)
  ]);

  if (cohortResult.error) throw new ApiClientError(cohortResult.error.message, 503);
  if (programResult.error) throw new ApiClientError(programResult.error.message, 503);
  if (faqResult.error) throw new ApiClientError(faqResult.error.message, 503);

  const cohortNames = new Set((cohortResult.data ?? []).map((row) => String(row.cohort_name ?? '').trim()).filter(Boolean));
  const programKeys = new Set((programResult.data ?? []).map((row) => String(row.program_key ?? '').trim().toLowerCase()).filter(Boolean));
  const visible = (faqResult.data ?? [])
    .filter((faq) => {
      const faqPrograms = asStringArray(faq.program_keys).map((key) => key.toLowerCase());
      const faqCohorts = asStringArray(faq.cohort_names);
      const programVisible = faqPrograms.length === 0 || faqPrograms.some((key) => programKeys.has(key));
      const cohortVisible = faqCohorts.length === 0 || faqCohorts.some((name) => cohortNames.has(name));
      return programVisible && cohortVisible;
    })
    .map(camelize)
    .filter((faq) => !search || JSON.stringify(faq).toLowerCase().includes(search));

  const start = (page - 1) * limit;
  return createPaginatedResponse(visible.slice(start, start + limit), visible.length, page, limit);
}

async function getAdminSupportFaqs(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  await getAdminProfile(context);
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 100), 500);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const status = String(query?.status ?? '').trim();
  const category = String(query?.category ?? '').trim();
  const search = String(query?.search ?? '').trim();

  let request = context.supabase.from('support_faqs').select('*', { count: 'exact' });
  if (status && status !== 'all') request = request.eq('status', status);
  if (category && category !== 'all') request = request.eq('category_name', category);
  if (search) request = request.or(`question.ilike.%${search}%,answer.ilike.%${search}%,category_name.ilike.%${search}%`);

  const { count, data, error } = await request.order('featured', { ascending: false }).order('sort_order', { ascending: true }).range(from, to);
  if (error) throw new ApiClientError(error.message, 503);
  return createPaginatedResponse((data ?? []).map(camelize), count ?? 0, page, limit);
}

async function createStudentSupportTicket(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  if (!isRecord(body)) throw new ApiClientError('Support ticket payload must be an object.', 400);

  const category = await getSupportCategoryForTicket(context, body.categoryName ?? body.category_name);
  const categoryName = String(category.category_name ?? '');
  const priority = normalizeSupportPriority(body.priority);
  const subject = normalizeBoundedText(body.subject, 'Subject', 8, 120);
  const description = normalizeBoundedText(body.description ?? body.body, 'Description', 20, 2000);
  const relatedUrl = String(body.relatedUrl ?? body.related_url ?? '').trim();
  if (relatedUrl && !isHttpUrl(relatedUrl)) throw new ApiClientError('Related link must start with http:// or https://.', 400);

  const student = await getStudentProfile(context);
  const now = new Date().toISOString();
  const ticketId = `SUP-${formatCompactDate(new Date())}-${Math.floor(100000 + Math.random() * 900000)}`;
  const studentName = String((student as Record<string, unknown>).fullName ?? context.email);
  const initialBody = relatedUrl ? `${description}\n\nRelated link: ${relatedUrl}` : description;

  const ticketPayload = {
    category_id: category.id,
    category_name: categoryName,
    conversation_mode: category.conversation_mode ?? 'two_way',
    description,
    last_message_at: now,
    last_student_reply_at: now,
    priority,
    related_link: relatedUrl || null,
    status: 'open',
    student_id: (student as Record<string, unknown>).id ?? null,
    student_email: context.email,
    student_name: studentName,
    subject,
    ticket_id: ticketId,
    updated_at: now
  };

  const { data: ticket, error: ticketError } = await context.supabase.from('support_tickets').insert(ticketPayload).select('*').single();
  if (ticketError) throw mutationError(ticketError, 'support_tickets');

  let initialMessageId = '';
  if (String(category.conversation_mode ?? 'two_way') === 'two_way') {
    const messagePayload = {
      author_email: context.email,
      author_name: studentName,
      author_role: 'student',
      body: initialBody,
      ticket_id: ticket.id,
      visibility: 'public'
    };

    const { data: message, error: messageError } = await context.supabase.from('support_ticket_messages').insert(messagePayload).select('id').single();
    if (messageError) throw mutationError(messageError, 'support_ticket_messages');
    initialMessageId = String(message?.id ?? '');
  }

  await notifySupportTicketEmail(context, 'ticket_created', String(ticket.id), initialMessageId, false);

  return {
    message: 'Support ticket created successfully.',
    ticket: camelize(ticket)
  };
}

async function createSupportTicketMessage(context: Awaited<ReturnType<typeof createContext>>, ticketId: string, body: unknown, actorRole: 'admin' | 'student') {
  if (!isRecord(body)) throw new ApiClientError('Support reply payload must be an object.', 400);

  const ticket = await getSupportTicketForWrite(context, ticketId, actorRole === 'admin');
  if (actorRole === 'student') {
    const status = String(ticket.status ?? '');
    const conversationMode = String(ticket.conversation_mode ?? 'two_way');
    if (conversationMode !== 'two_way') throw new ApiClientError('This support ticket is read-only.', 403);
    if (status === 'closed' || status === 'resolved') throw new ApiClientError('This support ticket is already closed.', 409);
  }

  const text = normalizeBoundedText(body.body ?? body.message, 'Reply', 2, 2000);
  const visibility = actorRole === 'admin' && body.visibility === 'internal' ? 'internal' : 'public';
  const now = new Date().toISOString();
  const authorName = actorRole === 'admin' ? context.email : String((await getStudentProfile(context) as Record<string, unknown>).fullName ?? context.email);

  const messagePayload = {
    author_email: context.email,
    author_name: authorName,
    author_role: actorRole,
    body: text,
    ticket_id: ticket.id,
    visibility
  };

  const { data: message, error: messageError } = await context.supabase.from('support_ticket_messages').insert(messagePayload).select('*').single();
  if (messageError) throw mutationError(messageError, 'support_ticket_messages');

  const ticketPatch =
    actorRole === 'admin'
      ? { last_admin_reply_at: now, last_message_at: now, status: visibility === 'public' ? 'waiting_for_student' : ticket.status, updated_at: now, updated_by_email: context.email }
      : { last_message_at: now, last_student_reply_at: now, status: 'in_review', updated_at: now };

  const { data: updatedTicket, error: ticketError } = await context.supabase.from('support_tickets').update(ticketPatch).eq('id', ticket.id).select('*').single();
  if (ticketError) throw mutationError(ticketError, 'support_tickets');
  if (actorRole === 'admin') {
    await writeSupportAuditLog(context, visibility === 'internal' ? 'internal_note_added' : 'replied', updatedTicket, ticketPatch);
    if (visibility === 'public' && body.sendEmail === true) await notifySupportTicketEmail(context, 'admin_reply', String(updatedTicket.id), String(message.id), true);
  } else {
    await notifySupportTicketEmail(context, 'student_reply', String(updatedTicket.id), String(message.id), false);
  }

  return {
    message: actorRole === 'admin' ? 'Support reply saved.' : 'Reply sent successfully.',
    reply: camelize(message),
    ticket: camelize(updatedTicket)
  };
}

async function notifySupportTicketEmail(
  context: Awaited<ReturnType<typeof createContext>>,
  event: 'ticket_created' | 'student_reply' | 'admin_reply',
  ticketId: string,
  messageId: string,
  required: boolean
) {
  const { data, error } = await context.supabase.functions.invoke('support-ticket-email', {
    body: {
      event,
      message_id: messageId || undefined,
      ticket_id: ticketId
    }
  });

  if (error || (isRecord(data) && data.ok === false)) {
    const message = error?.message ?? (isRecord(data) && typeof data.error === 'string' ? data.error : 'Support email could not be sent.');
    if (required) throw new ApiClientError(message, 503);
  }
}

async function createSupportCategory(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  await getAdminProfile(context);
  const payload = normalizeSupportCategoryPayload(body, true, context.email);
  const { data, error } = await context.supabase.from('support_categories').insert(payload).select('*').single();
  if (error) throw mutationError(error, 'support_categories');
  return { category: camelize(data), message: 'Support category created.' };
}

async function updateSupportCategory(context: Awaited<ReturnType<typeof createContext>>, categoryId: string, body: unknown) {
  await getAdminProfile(context);
  const payload = normalizeSupportCategoryPayload(body, false, context.email);
  const { data, error } = await context.supabase.from('support_categories').update(payload).eq('id', categoryId).select('*').single();
  if (error) throw mutationError(error, 'support_categories');
  return { category: camelize(data), message: 'Support category updated.' };
}

async function createSupportFaq(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  await getAdminProfile(context);
  const payload = normalizeSupportFaqPayload(body, true, context.email);
  const { data, error } = await context.supabase.from('support_faqs').insert(payload).select('*').single();
  if (error) throw mutationError(error, 'support_faqs');
  return { faq: camelize(data), message: 'Support FAQ created.' };
}

async function updateSupportFaq(context: Awaited<ReturnType<typeof createContext>>, faqId: string, body: unknown) {
  await getAdminProfile(context);
  const payload = normalizeSupportFaqPayload(body, false, context.email);
  const { data, error } = await context.supabase.from('support_faqs').update(payload).eq('id', faqId).select('*').single();
  if (error) throw mutationError(error, 'support_faqs');
  return { faq: camelize(data), message: 'Support FAQ updated.' };
}

async function deleteSupportFaq(context: Awaited<ReturnType<typeof createContext>>, faqId: string) {
  await getAdminProfile(context);
  const { error } = await context.supabase.from('support_faqs').delete().eq('id', faqId).select('id').single();
  if (error) throw mutationError(error, 'support_faqs');
  return { faqId, message: 'Support FAQ deleted.' };
}

async function updateSupportTicket(context: Awaited<ReturnType<typeof createContext>>, ticketId: string, body: unknown) {
  await getAdminProfile(context);
  if (!isRecord(body)) throw new ApiClientError('Support ticket update payload must be an object.', 400);

  const currentTicket = await getSupportTicketForWrite(context, ticketId, true);
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by_email: context.email };

  if (body.status !== undefined) {
    const status = normalizeSupportStatus(body.status);
    payload.status = status;
    if (status === 'resolved') payload.resolved_at = new Date().toISOString();
    if (status === 'closed') payload.closed_at = new Date().toISOString();
    if (status === 'open' || status === 'in_review' || status === 'waiting_for_student') {
      payload.closed_at = null;
      payload.resolved_at = null;
    }
  }

  if (body.priority !== undefined) payload.priority = normalizeSupportPriority(body.priority);
  if (body.assignedAdminEmail !== undefined || body.assigned_admin_email !== undefined) {
    const assignedAdminEmail = String(body.assignedAdminEmail ?? body.assigned_admin_email ?? '').trim().toLowerCase();
    payload.assigned_admin_email = assignedAdminEmail || null;
  }

  if (Object.keys(payload).length === 2) throw new ApiClientError('No support ticket changes were provided.', 400);

  const { data, error } = await context.supabase.from('support_tickets').update(payload).eq('id', currentTicket.id).select('*').single();
  if (error) throw mutationError(error, 'support_tickets');

  await writeSupportAuditLog(context, 'updated', data, payload);

  return {
    message: 'Support ticket updated successfully.',
    ticket: camelize(data)
  };
}

async function getSupportTicketForWrite(context: Awaited<ReturnType<typeof createContext>>, ticketId: string, admin: boolean) {
  if (admin) await getAdminProfile(context);
  let ticketQuery = context.supabase.from('support_tickets').select('*').or(`id.eq.${ticketId},ticket_id.eq.${ticketId}`).limit(1);
  if (!admin) ticketQuery = ticketQuery.eq('student_email', context.email);
  const { data, error } = await ticketQuery;
  if (error) throw new ApiClientError(error.message, 503);
  const ticket = data?.[0];
  if (!ticket) throw new ApiClientError('Support ticket was not found.', 404);
  return ticket;
}

async function writeSupportAuditLog(context: Awaited<ReturnType<typeof createContext>>, action: string, row: Record<string, unknown>, payload: Record<string, unknown>) {
  const auditRow = {
    action: `admin_support_ticket_${action}`,
    actor_email: context.email,
    actor_role: 'admin',
    details: {
      changedFields: Object.keys(payload).sort(),
      ticketId: row.ticket_id ?? row.id
    },
    entity_id: String(row.id ?? ''),
    entity_type: 'support_ticket',
    status: 'success'
  };

  const { error } = await context.supabase.from('audit_logs').insert(auditRow);
  if (error) return;
}

function normalizeSupportCategory(value: unknown) {
  const categoryName = String(value ?? '').trim();
  if (categoryName.length < 2) throw new ApiClientError('Select a support category.', 400);
  if (categoryName.length > 80) throw new ApiClientError('Support category must be 80 characters or fewer.', 400);
  return categoryName;
}

function normalizeSupportPriority(value: unknown) {
  const priority = String(value ?? 'normal').trim().toLowerCase();
  if (!['low', 'normal', 'high', 'urgent'].includes(priority)) throw new ApiClientError('Support priority is invalid.', 400);
  return priority;
}

function normalizeSupportStatus(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase();
  if (!['open', 'in_review', 'waiting_for_student', 'resolved', 'closed'].includes(status)) throw new ApiClientError('Support status is invalid.', 400);
  return status;
}

function normalizeSupportCategoryStatus(value: unknown) {
  const status = String(value ?? 'active').trim().toLowerCase();
  if (!['active', 'inactive'].includes(status)) throw new ApiClientError('Support category status is invalid.', 400);
  return status;
}

function normalizeSupportConversationMode(value: unknown) {
  const mode = String(value ?? 'two_way').trim().toLowerCase();
  if (!['two_way', 'admin_only'].includes(mode)) throw new ApiClientError('Support conversation mode is invalid.', 400);
  return mode;
}

function normalizeSupportFaqStatus(value: unknown) {
  const status = String(value ?? 'published').trim().toLowerCase();
  if (!['draft', 'published', 'archived'].includes(status)) throw new ApiClientError('Support FAQ status is invalid.', 400);
  return status;
}

function normalizeSupportSortOrder(value: unknown) {
  const sortOrder = Number(value ?? 100);
  if (!Number.isFinite(sortOrder)) throw new ApiClientError('Sort order must be a number.', 400);
  return Math.max(1, Math.min(9999, Math.round(sortOrder)));
}

function normalizeSupportKey(value: unknown, fallback: string) {
  const raw = String(value ?? fallback).trim().toLowerCase();
  const key = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (key.length < 2) throw new ApiClientError('Category key is required.', 400);
  if (key.length > 80) throw new ApiClientError('Category key must be 80 characters or fewer.', 400);
  return key;
}

function normalizeSupportCategoryPayload(body: unknown, creating: boolean, adminEmail: string) {
  if (!isRecord(body)) throw new ApiClientError('Support category payload must be an object.', 400);
  const now = new Date().toISOString();
  const categoryName = normalizeBoundedText(body.categoryName ?? body.category_name, 'Category name', 2, 80);
  return {
    allow_attachments: body.allowAttachments ?? body.allow_attachments ?? true,
    category_key: normalizeSupportKey(body.categoryKey ?? body.category_key, categoryName),
    category_name: categoryName,
    conversation_mode: normalizeSupportConversationMode(body.conversationMode ?? body.conversation_mode),
    created_by: creating ? adminEmail : undefined,
    default_priority: normalizeSupportPriority(body.defaultPriority ?? body.default_priority),
    sort_order: normalizeSupportSortOrder(body.sortOrder ?? body.sort_order),
    status: normalizeSupportCategoryStatus(body.status),
    updated_at: now,
    updated_by: adminEmail
  };
}

function normalizeSupportFaqPayload(body: unknown, creating: boolean, adminEmail: string) {
  if (!isRecord(body)) throw new ApiClientError('Support FAQ payload must be an object.', 400);
  const now = new Date().toISOString();
  const question = normalizeBoundedText(body.question, 'FAQ question', 5, 240);
  const answer = normalizeBoundedText(body.answer, 'FAQ answer', 10, 3000);
  const categoryName = String(body.categoryName ?? body.category_name ?? '').trim();
  return {
    answer,
    category_key: categoryName ? normalizeSupportKey(body.categoryKey ?? body.category_key, categoryName) : null,
    category_name: categoryName || null,
    cohort_names: uniqueStrings([...asStringArray(body.cohortNames ?? body.cohort_names), ...splitCommaValues(body.cohorts)]),
    created_by: creating ? adminEmail : undefined,
    featured: Boolean(body.featured),
    program_keys: uniqueStrings([...asStringArray(body.programKeys ?? body.program_keys), ...splitCommaValues(body.programs)].map((key) => String(key).toLowerCase())),
    question,
    sort_order: normalizeSupportSortOrder(body.sortOrder ?? body.sort_order),
    status: normalizeSupportFaqStatus(body.status),
    updated_at: now,
    updated_by: adminEmail
  };
}

function normalizeBoundedText(value: unknown, label: string, minLength: number, maxLength: number) {
  const text = String(value ?? '').trim();
  if (text.length < minLength) throw new ApiClientError(`${label} must be at least ${minLength} characters.`, 400);
  if (text.length > maxLength) throw new ApiClientError(`${label} must be ${maxLength} characters or fewer.`, 400);
  return text;
}

function formatCompactDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function startOfDayIso(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
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
    maxAttempts: Number(data?.max_attempts ?? 1),
    notes: data?.notes ?? undefined,
    studentEmail: student.email,
    studentId: student.id,
    updatedAt: data?.updated_at ?? undefined
  };
}

async function getStudentAccessPreview(context: Awaited<ReturnType<typeof createContext>>, studentId: string) {
  const student = await getStudentById(context, studentId);
  const [dashboard, schedule, resources, projects, certificates, enrichedStudent] = await Promise.all([
    callRpc(context, 'student_dashboard_bundle', { p_student_email: student.email }),
    callRpc(context, 'student_schedule_view', { p_student_email: student.email }),
    callRpc(context, 'student_resources_view', { p_student_email: student.email }),
    callRpc(context, 'student_projects_bundle', { p_student_email: student.email }),
    callRpc(context, 'student_certificates_bundle', { p_student_email: student.email }),
    enrichAdminStudents(context, [student])
  ]);

  const studentRow = enrichedStudent[0] as Record<string, unknown> | undefined;
  const cohorts = Array.isArray(studentRow?.cohortNames) ? (studentRow.cohortNames as string[]) : student.cohort_name ? [student.cohort_name] : [];
  const recordings = extractItems(dashboard, ['recordings', 'workshopRecordings', 'workshops']).filter(isStudentRecordingRow);

  return {
    certificates: extractItems(certificates, ['certificates', 'items']).length,
    cohorts,
    projects: extractItems(projects, ['projects', 'items']).length,
    recordings: recordings.length,
    resources: extractItems(resources, ['resources', 'items']).length,
    schedule: extractItems(schedule, ['schedule', 'items']).length,
    studentEmail: student.email,
    studentName: student.full_name
  };
}

async function getAdminStudentPreview(context: Awaited<ReturnType<typeof createContext>>, studentId: string) {
  const student = await getStudentById(context, studentId);
  const [dashboard, schedule, resources, projects, certificates, enrichedStudent] = await Promise.all([
    callRpc(context, 'student_dashboard_bundle', { p_student_email: student.email }),
    callRpc(context, 'student_schedule_view', { p_student_email: student.email }),
    callRpc(context, 'student_resources_view', { p_student_email: student.email }),
    callRpc(context, 'student_projects_bundle', { p_student_email: student.email }),
    callRpc(context, 'student_certificates_bundle', { p_student_email: student.email }),
    enrichAdminStudents(context, [student])
  ]);

  const studentRow = enrichedStudent[0] as Record<string, unknown> | undefined;
  const cohorts = Array.isArray(studentRow?.cohortNames) ? (studentRow.cohortNames as string[]) : student.cohort_name ? [student.cohort_name] : [];
  const programs = Array.isArray(studentRow?.programs) ? (studentRow.programs as string[]) : splitCommaValues(student.program_name);
  const liveProjectRoles = Array.isArray(studentRow?.liveProjectRoles) ? (studentRow.liveProjectRoles as string[]) : [];
  const studentCohorts = extractItems(dashboard, ['cohorts', 'studentCohorts']);
  const enrolledPrograms = extractItems(dashboard, ['studentPrograms', 'programs', 'activePrograms']);
  const recordings = extractItems(dashboard, ['recordings', 'workshopRecordings', 'workshops'])
    .filter(isStudentRecordingRow)
    .map(enrichRow)
    .map(camelize)
    .filter(studentRecordingHasAudienceScope);
  const sequencedRecordings = (await enrichStudentRecordingsWithSequence(context, recordings, [...studentCohorts, ...enrolledPrograms]))
    .filter(isRecord)
    .sort(compareStudentRecordingsWithSequence);
  const scheduleItems = extractItems(schedule, ['schedule', 'items']).map(enrichRow).map(camelize).filter(isRecord).sort(comparePreviewScheduleItems);
  const resourceItems = extractItems(resources, ['resources', 'items']).map(enrichRow).map(camelize).filter(isRecord).sort(comparePreviewUpdatedItems);
  const projectItems = extractItems(projects, ['projects', 'items']).map(enrichRow).map(camelize).filter(isRecord).sort(comparePreviewTitleItems);
  const certificateItems = extractItems(certificates, ['certificates', 'items']).map(enrichRow).map(camelize).filter(isRecord).sort(comparePreviewCertificateItems);

  await writeAuditLog(context, 'students', 'preview_started', student, {
    previewMode: 'read_only',
    studentEmail: student.email
  });

  return {
    counts: {
      certificates: extractItems(certificates, ['certificates', 'items']).length,
      projects: extractItems(projects, ['projects', 'items']).length,
      recordings: sequencedRecordings.length,
      resources: extractItems(resources, ['resources', 'items']).length,
      schedule: extractItems(schedule, ['schedule', 'items']).length
    },
    cohorts,
    generatedAt: new Date().toISOString(),
    previewMode: true,
    programs,
    student: {
      active: Boolean(student.active),
      collegeName: String(student.college_name ?? studentRow?.collegeName ?? '').trim() || undefined,
      email: student.email,
      fullName: student.full_name,
      id: student.id,
      liveProjectRoles,
      programName: String(student.program_name ?? studentRow?.programName ?? '').trim() || undefined,
      studentId: String(student.student_id ?? studentRow?.studentId ?? '').trim() || undefined
    },
    modules: {
      certificates: createAdminPreviewModule(certificateItems, toCertificatePreviewItem),
      projects: createAdminPreviewModule(projectItems, toProjectPreviewItem),
      recordings: createAdminPreviewModule(sequencedRecordings, toRecordingPreviewItem),
      resources: createAdminPreviewModule(resourceItems, toResourcePreviewItem),
      schedule: createAdminPreviewModule(scheduleItems, toSchedulePreviewItem)
    }
  };
}

type AdminPreviewItem = {
  id: string;
  title: string;
  eyebrow?: string;
  meta: string[];
  status?: string;
  locked?: boolean;
};

function createAdminPreviewModule(rows: Record<string, unknown>[], mapItem: (row: Record<string, unknown>, index: number) => AdminPreviewItem) {
  const previewLimit = 6;
  return {
    items: rows.slice(0, previewLimit).map(mapItem),
    total: rows.length
  };
}

function toSchedulePreviewItem(row: Record<string, unknown>, index: number): AdminPreviewItem {
  return {
    id: previewItemId(row, index),
    title: previewTitle(row, 'Untitled workshop'),
    eyebrow: previewText(row.status) || 'Workshop',
    meta: compactPreviewMeta([previewDateTime(row), previewText(row.durationMinutes ?? row.duration_minutes, ' min'), previewArrayLabel(row.cohortNames ?? row.cohort_names)]),
    status: previewText(row.lockReason ?? row.lock_reason) || (row.locked ? 'Locked' : 'Visible'),
    locked: Boolean(row.locked)
  };
}

function toRecordingPreviewItem(row: Record<string, unknown>, index: number): AdminPreviewItem {
  const sequenceNumber = Number(row.recordingSequenceNumber);
  return {
    id: previewItemId(row, index),
    title: previewTitle(row, 'Untitled recording'),
    eyebrow: Number.isFinite(sequenceNumber) ? `Step ${sequenceNumber}` : previewText(row.recordingSection) || 'Recording',
    meta: compactPreviewMeta([previewDateTime(row), previewText(row.durationMinutes ?? row.duration_minutes, ' min'), previewArrayLabel(row.cohortNames ?? row.cohort_names)]),
    status: row.locked ? 'Locked' : 'Visible',
    locked: Boolean(row.locked)
  };
}

function toResourcePreviewItem(row: Record<string, unknown>, index: number): AdminPreviewItem {
  return {
    id: previewItemId(row, index),
    title: previewTitle(row, 'Untitled resource'),
    eyebrow: previewText(row.resourceType ?? row.resource_type) || 'Resource',
    meta: compactPreviewMeta([previewText(row.phase), previewArrayLabel(row.programKeys ?? row.program_keys), previewDateLabel(row.updatedAt ?? row.updated_at, 'Updated')]),
    status: previewText(row.lockReason ?? row.lock_reason) || (row.locked ? 'Locked' : 'Visible'),
    locked: Boolean(row.locked)
  };
}

function toProjectPreviewItem(row: Record<string, unknown>, index: number): AdminPreviewItem {
  return {
    id: previewItemId(row, index),
    title: previewTitle(row, 'Untitled project'),
    eyebrow: previewText(row.projectRole ?? row.project_role) || 'Live Project',
    meta: compactPreviewMeta([previewText(row.companyName ?? row.company_name), previewText(row.programName ?? row.program_name), previewDateLabel(row.deadline, 'Deadline')]),
    status: previewText(row.status) || 'Visible'
  };
}

function toCertificatePreviewItem(row: Record<string, unknown>, index: number): AdminPreviewItem {
  return {
    id: previewItemId(row, index),
    title: previewTitle(row, 'Certificate'),
    eyebrow: previewText(row.certificateType ?? row.certificate_type) || 'Certificate',
    meta: compactPreviewMeta([previewText(row.programName ?? row.program_name), previewText(row.projectTitle ?? row.project_title), previewDateLabel(row.issueDate ?? row.issue_date, 'Issued')]),
    status: previewText(row.generationStatus ?? row.generation_status ?? row.status) || 'Available'
  };
}

function previewItemId(row: Record<string, unknown>, index: number) {
  return String(row.id ?? row.workshopId ?? row.workshop_id ?? row.resourceId ?? row.resource_id ?? row.projectId ?? row.project_id ?? row.certificateId ?? row.certificate_id ?? index);
}

function previewTitle(row: Record<string, unknown>, fallback: string) {
  return previewText(row.title ?? row.sessionTitle ?? row.session_title ?? row.projectTitle ?? row.project_title ?? row.certificateId ?? row.certificate_id) || fallback;
}

function previewText(value: unknown, suffix = '') {
  const text = String(value ?? '').trim();
  return text ? `${text}${suffix}` : '';
}

function previewArrayLabel(value: unknown) {
  const values = Array.isArray(value) ? asStringArray(value) : splitCommaValues(value);
  return values.slice(0, 3).join(', ');
}

function previewDateTime(row: Record<string, unknown>) {
  const date = previewText(row.date ?? row.scheduledDate ?? row.scheduled_date ?? row.startDate ?? row.start_date);
  const time = previewText(row.time ?? row.scheduledTime ?? row.scheduled_time);
  return compactPreviewMeta([date, time]).join(' · ');
}

function previewDateLabel(value: unknown, label: string) {
  const text = previewText(value);
  if (!text) return '';
  return `${label}: ${text}`;
}

function compactPreviewMeta(values: unknown[]) {
  return values.map((value) => String(value ?? '').trim()).filter(Boolean);
}

function comparePreviewScheduleItems(left: Record<string, unknown>, right: Record<string, unknown>) {
  return recordingScheduledTime(left, Number.POSITIVE_INFINITY) - recordingScheduledTime(right, Number.POSITIVE_INFINITY);
}

function comparePreviewUpdatedItems(left: Record<string, unknown>, right: Record<string, unknown>) {
  return previewTime(right.updatedAt ?? right.updated_at) - previewTime(left.updatedAt ?? left.updated_at) || comparePreviewTitleItems(left, right);
}

function comparePreviewCertificateItems(left: Record<string, unknown>, right: Record<string, unknown>) {
  return previewTime(right.issueDate ?? right.issue_date ?? right.createdAt ?? right.created_at) - previewTime(left.issueDate ?? left.issue_date ?? left.createdAt ?? left.created_at) || comparePreviewTitleItems(left, right);
}

function comparePreviewTitleItems(left: Record<string, unknown>, right: Record<string, unknown>) {
  return previewTitle(left, '').localeCompare(previewTitle(right, ''));
}

function previewTime(value: unknown) {
  const time = new Date(String(value ?? '')).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function updateStudentAttemptLimit(context: Awaited<ReturnType<typeof createContext>>, studentId: string, body: unknown) {
  const payload = snakifyMutationBody(body);
  const maxAttempts = Number(payload.max_attempts);
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : undefined;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 1000) {
    throw new ApiClientError('LP project limit must be a whole number between 1 and 1000.', 400);
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

async function reviewProjectSubmission(context: Awaited<ReturnType<typeof createContext>>, requestId: string, action: string, body: unknown) {
  await getAdminProfile(context);
  const payload = isRecord(body) ? snakify(body) as Record<string, unknown> : {};
  const reviewNote = typeof payload.review_note === 'string' ? payload.review_note.trim() : '';
  const status = action === 'approve' ? 'approved' : action === 'changes-requested' ? 'changes_requested' : 'rejected';

  if ((status === 'rejected' || status === 'changes_requested') && !reviewNote) {
    throw new ApiClientError(status === 'changes_requested' ? 'Changes requested needs a review note.' : 'Reject needs a review note.', 400);
  }

  const { data, error } = await context.supabase
    .from('project_submission_requests')
    .update({
      remarks: reviewNote || undefined,
      status,
      updated_at: new Date().toISOString()
    })
    .or(`id.eq.${requestId},request_id.eq.${requestId}`)
    .select('*')
    .single();

  if (error) throw mutationError(error, 'project_submission_requests');

  return {
    message: `Submission marked ${status.replace(/_/g, ' ')}.`,
    requestId: data.id,
    status: 'updated'
  };
}

async function getLiveProjectCertificateRequests(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  await getAdminProfile(context);

  const [submissionsResult, certificatesResult, cohortsResult, programsResult] = await Promise.all([
    context.supabase
      .from('project_submission_requests')
      .select('*')
      .eq('status', 'approved')
      .order('attempt_number', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(5000),
    context.supabase
      .from('certificates')
      .select('id,certificate_id,certificate_type,student_email,project_id,cohort_name,submission_id,status')
      .eq('certificate_type', 'live_project')
      .limit(5000),
    context.supabase.from('cohorts').select('cohort_id,name,program_key,start_date').limit(5000),
    context.supabase.from('programs').select('program_key,name').limit(500)
  ]);

  if (submissionsResult.error) throw new ApiClientError(submissionsResult.error.message, 503);
  if (certificatesResult.error) throw new ApiClientError(certificatesResult.error.message, 503);
  if (cohortsResult.error) throw new ApiClientError(cohortsResult.error.message, 503);
  if (programsResult.error) throw new ApiClientError(programsResult.error.message, 503);

  const cohortByNameOrId = new Map<string, Record<string, unknown>>();
  (cohortsResult.data ?? []).forEach((cohort) => {
    const name = String(cohort.name ?? '').trim().toLowerCase();
    const cohortId = String(cohort.cohort_id ?? '').trim().toLowerCase();
    if (name) cohortByNameOrId.set(name, cohort);
    if (cohortId) cohortByNameOrId.set(cohortId, cohort);
  });

  const programNameByKey = new Map<string, string>();
  (programsResult.data ?? []).forEach((program) => {
    const key = String(program.program_key ?? '').trim().toLowerCase();
    const name = String(program.name ?? '').trim();
    if (key && name) programNameByKey.set(key, name);
  });

  const certificateKeys = new Set<string>();
  (certificatesResult.data ?? []).forEach((certificate) => {
    const submissionId = String(certificate.submission_id ?? '').trim();
    if (submissionId) certificateKeys.add(`submission:${submissionId}`);
    certificateKeys.add(
      liveProjectCertificateKey(certificate.student_email, certificate.project_id, certificate.cohort_name)
    );
  });

  const latestByEnrollment = new Map<string, Record<string, unknown>>();
  (submissionsResult.data ?? []).forEach((submission) => {
    const key = liveProjectCertificateKey(submission.student_email, submission.project_id, submission.cohort_name);
    const existing = latestByEnrollment.get(key);
    const attempt = Number(submission.attempt_number ?? 0);
    const existingAttempt = Number(existing?.attempt_number ?? 0);
    if (!existing || attempt > existingAttempt) latestByEnrollment.set(key, submission);
  });

  const requests = Array.from(latestByEnrollment.values())
    .filter((submission) => {
      const submissionId = String(submission.request_id ?? '').trim();
      const enrollmentKey = liveProjectCertificateKey(submission.student_email, submission.project_id, submission.cohort_name);
      return !certificateKeys.has(`submission:${submissionId}`) && !certificateKeys.has(enrollmentKey);
    })
    .map((submission) => {
      const cohortName = String(submission.cohort_name ?? '').trim();
      const cohort = cohortByNameOrId.get(cohortName.toLowerCase()) ?? cohortByNameOrId.get(String(submission.cohort_key ?? '').trim().toLowerCase());
      const programKey = String(submission.program_key ?? cohort?.program_key ?? '').trim();
      const requestNumber = String(submission.request_number ?? submission.request_id ?? submission.id);
      return {
        admin_status: 'pending',
        attempt_number: Number(submission.attempt_number ?? 1),
        cohort_name: cohortName || undefined,
        cohort_start_date: cohort?.start_date ?? undefined,
        created_at: submission.created_at,
        id: String(submission.id),
        moderator_status: 'approved',
        program_key: programKey || undefined,
        program_name: programNameByKey.get(programKey.toLowerCase()) ?? (programKey || undefined),
        project_id: String(submission.project_id ?? ''),
        project_role: String(submission.role_name ?? submission.project_role ?? ''),
        project_title: String(submission.project_title ?? submission.project_id ?? ''),
        request_id: requestNumber,
        request_number: requestNumber,
        request_type: 'live_project',
        student_email: String(submission.student_email ?? ''),
        student_id: String(submission.student_id ?? ''),
        student_name: String(submission.student_name ?? submission.student_email ?? ''),
        submission_url: String(submission.submission_link ?? ''),
        submitted_at: submission.submitted_at,
        updated_at: submission.updated_at
      };
    })
    .sort((left, right) => String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? '')));

  return paginate(requests, query);
}

async function saveCertificateProgramSetting(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  await getAdminProfile(context);
  const payload = snakifyMutationBody(body);
  const programKey = String(payload.program_key ?? '').trim();
  const modulesCovered = asStringArray(payload.modules_covered);
  const status = String(payload.status ?? 'active').trim();

  if (!programKey) throw new ApiClientError('Program is required before saving certificate modules.', 400);
  if (modulesCovered.length === 0) throw new ApiClientError('Add at least one module before saving.', 400);
  if (!['active', 'inactive'].includes(status)) throw new ApiClientError('Certificate module status is invalid.', 400);

  const row = {
    modules_covered: modulesCovered,
    program_key: programKey,
    status,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await context.supabase
    .from('certificate_program_settings')
    .upsert(row, { onConflict: 'program_key' })
    .select('*')
    .single();

  if (error) throw mutationError(error, 'certificate_program_settings');

  return camelize(enrichRow(data));
}

async function issueLeadershipCertificates(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  const admin = await getAdminProfile(context);
  const adminEmail = isRecord(admin) ? String(admin.email ?? context.email) : context.email;
  const payload = snakifyMutationBody(body);
  const studentIds = asStringArray(payload.student_ids);
  const programKey = String(payload.program_key ?? '').trim();
  const programName = String(payload.program_name ?? programKey).trim();
  const cohortName = String(payload.cohort_name ?? '').trim();
  const issueDate = String(payload.issue_date ?? todayIsoDate()).slice(0, 10);
  const modulesCovered = asStringArray(payload.modules_covered);
  const sendEmail = payload.send_email !== false;

  if (!programKey) throw new ApiClientError('Program is required before issuing leadership certificates.', 400);
  if (!cohortName) throw new ApiClientError('Cohort is required before issuing leadership certificates.', 400);
  if (!isIsoDate(issueDate)) throw new ApiClientError('Issue date is required before issuing leadership certificates.', 400);
  if (modulesCovered.length === 0) throw new ApiClientError('Add at least one module before issuing leadership certificates.', 400);
  if (studentIds.length === 0) throw new ApiClientError('Select at least one student before issuing certificates.', 400);
  if (studentIds.length > 250) throw new ApiClientError('Leadership certificate issuance is limited to 250 students at a time.', 400);

  const { data: students, error: studentsError } = await context.supabase
    .from('students')
    .select('id,email,full_name,student_id')
    .in('id', studentIds)
    .eq('active', true)
    .limit(300);

  if (studentsError) throw new ApiClientError(studentsError.message, 503);
  const studentRows = students ?? [];
  if (studentRows.length === 0) throw new ApiClientError('No active students found for issuance.', 404);

  const studentEmails = studentRows.map((student) => String(student.email ?? '').trim()).filter(Boolean);
  const { data: existingCertificates, error: existingError } = await context.supabase
    .from('certificates')
    .select('id,certificate_id,student_email')
    .eq('certificate_type', 'leadership')
    .eq('program_key', programKey)
    .eq('cohort_name', cohortName)
    .in('student_email', studentEmails)
    .limit(500);

  if (existingError) throw new ApiClientError(existingError.message, 503);

  const existingEmails = new Set((existingCertificates ?? []).map((certificate) => normalizeEmail(certificate.student_email)));
  const now = new Date();
  const rows = [];
  const skipped: Array<{ reason: string; studentId?: string }> = [];

  for (const student of studentRows) {
    const studentEmail = String(student.email ?? '').trim();
    if (!studentEmail) {
      skipped.push({ reason: 'Student email is missing.', studentId: String(student.id ?? '') });
      continue;
    }
    if (existingEmails.has(normalizeEmail(studentEmail))) {
      skipped.push({ reason: 'Leadership certificate already exists for this student, program, and cohort.', studentId: String(student.id ?? '') });
      continue;
    }

    const certificateId = `SS-LP-${programKey.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${now.getFullYear()}-${randomHex(8).toUpperCase()}`;
    const verificationToken = randomHex(24);
    const verificationUrl = certificateVerificationUrl(certificateId);
    rows.push({
      certificate_id: certificateId,
      certificate_payload: {
        cohortName,
        issueDate,
        modulesCovered,
        programKey,
        programName
      },
      certificate_type: 'leadership',
      cohort_name: cohortName,
      email_requested: sendEmail,
      generation_status: 'pending',
      issue_date: issueDate,
      issued_by: adminEmail,
      modules_covered: modulesCovered,
      program_key: programKey,
      program_name: programName || programKey,
      status: 'issued',
      student_email: studentEmail,
      student_id: student.id,
      student_name: String(student.full_name ?? studentEmail),
      verification_token: verificationToken,
      verification_url: verificationUrl
    });
  }

  if (rows.length === 0) {
    return {
      certificates: [],
      message: `No new certificates issued. ${skipped.length} skipped.`,
      skipped
    };
  }

  const { data, error } = await context.supabase.from('certificates').insert(rows).select('*');
  if (error) throw mutationError(error, 'certificates');

  await writeAuditLog(context, 'certificates', 'leadership_issued', { id: `bulk-${Date.now()}`, certificate_count: rows.length }, {
    cohort_name: cohortName,
    program_key: programKey,
    student_count: rows.length
  });

  const generationMessage = await triggerCertificateGeneration(context, (data ?? []).map((certificate) => String(certificate.id)), sendEmail);

  return {
    certificates: (data ?? []).map(enrichRow).map(camelize),
    message: `${rows.length} leadership certificate${rows.length === 1 ? '' : 's'} issued.${skipped.length ? ` ${skipped.length} skipped.` : ''}${generationMessage ? ` ${generationMessage}` : ''}`,
    skipped
  };
}

async function issueLiveProjectCertificate(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  const admin = await getAdminProfile(context);
  const adminEmail = isRecord(admin) ? String(admin.email ?? context.email) : context.email;
  const payload = snakifyMutationBody(body);
  const requestId = String(payload.request_id ?? '').trim();
  const durationWeeks = Number(payload.duration_weeks ?? 4);
  const startDate = String(payload.start_date ?? '').slice(0, 10);
  const issueDate = String(payload.issue_date ?? todayIsoDate()).slice(0, 10);
  const sendEmail = payload.send_email !== false;

  if (!requestId) throw new ApiClientError('Certificate request is required.', 400);
  if (![2, 4, 6, 8].includes(durationWeeks)) throw new ApiClientError('Duration must be 2, 4, 6, or 8 weeks.', 400);
  if (!isIsoDate(startDate)) throw new ApiClientError('Start date is required before issuing a live project certificate.', 400);
  if (!isIsoDate(issueDate)) throw new ApiClientError('Issue date is required before issuing a live project certificate.', 400);

  const { data: submission, error: submissionError } = await context.supabase
    .from('project_submission_requests')
    .select('*')
    .or(`id.eq.${requestId},request_id.eq.${requestId},request_number.eq.${requestId}`)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();

  if (submissionError) throw new ApiClientError(submissionError.message, 503);
  if (!submission) throw new ApiClientError('Approved project submission was not found.', 404);

  const { data: existingCertificates, error: existingError } = await context.supabase
    .from('certificates')
    .select('id,certificate_id,submission_id')
    .eq('certificate_type', 'live_project')
    .eq('student_email', submission.student_email)
    .eq('project_id', submission.project_id)
    .eq('cohort_name', submission.cohort_name)
    .limit(1);

  if (existingError) throw new ApiClientError(existingError.message, 503);
  if ((existingCertificates ?? []).length > 0) throw new ApiClientError('A live project certificate already exists for this student, project, and cohort.', 409);

  const [programResult] = await Promise.all([
    context.supabase.from('programs').select('name').eq('program_key', submission.program_key).limit(1).maybeSingle()
  ]);
  if (programResult.error) throw new ApiClientError(programResult.error.message, 503);

  const now = new Date();
  const certificateId = `SS-PROJ-${now.getFullYear()}-${randomHex(10).toUpperCase()}`;
  const verificationToken = randomHex(24);
  const verificationUrl = certificateVerificationUrl(certificateId);
  const endDate = addDays(startDate, durationWeeks * 7 - 1);
  const row = {
    certificate_id: certificateId,
    certificate_payload: {
      cohortName: submission.cohort_name,
      durationWeeks,
      issueDate,
      projectEndDate: endDate,
      projectStartDate: startDate,
      requestNumber: submission.request_number,
      submissionId: submission.request_id,
      submissionLink: submission.submission_link
    },
    certificate_type: 'live_project',
    cohort_name: submission.cohort_name,
    duration_label: `${durationWeeks} weeks`,
    email_requested: sendEmail,
    generation_status: 'pending',
    issue_date: issueDate,
    issued_by: adminEmail,
    modules_covered: [String(submission.role_name ?? ''), String(submission.project_title ?? '')].filter(Boolean),
    program_key: submission.program_key,
    program_name: programResult.data?.name ?? submission.program_key,
    project_end_date: endDate,
    project_id: submission.project_id,
    project_role: submission.role_name,
    project_start_date: startDate,
    project_title: submission.project_title,
    role_id: submission.role_id,
    role_name: submission.role_name,
    status: 'issued',
    student_email: submission.student_email,
    student_id: submission.student_id,
    student_name: submission.student_name,
    submission_id: submission.request_id,
    verification_token: verificationToken,
    verification_url: verificationUrl
  };

  const { data, error } = await context.supabase.from('certificates').insert(row).select('*').single();
  if (error) throw mutationError(error, 'certificates');

  await writeAuditLog(context, 'certificates', 'live_project_issued', data, {
    request_id: requestId,
    send_email: sendEmail
  });

  const generationMessage = await triggerCertificateGeneration(context, [String(data.id)], sendEmail);

  return {
    certificate: camelize(enrichRow(data)),
    message: `${certificateId} issued.${generationMessage ? ` ${generationMessage}` : ''}`
  };
}

async function issueManualCertificate(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  const admin = await getAdminProfile(context);
  const adminEmail = isRecord(admin) ? String(admin.email ?? context.email) : context.email;
  const payload = snakifyMutationBody(body);
  const certificateType = String(payload.certificate_type ?? '').trim();
  const issueDate = String(payload.issue_date ?? todayIsoDate()).slice(0, 10);
  const sendEmail = payload.send_email !== false;
  const acknowledgeDuplicate = payload.acknowledge_duplicate === true;
  const durationWeeks = Number(payload.duration_weeks ?? 4);
  const projectStartDate = String(payload.project_start_date ?? '').slice(0, 10);
  const projectTitle = String(payload.project_title ?? '').trim();
  const projectRole = String(payload.project_role ?? '').trim();
  const studentId = String(payload.student_id ?? '').trim();
  const programKey = String(payload.program_key ?? '').trim();
  let programName = String(payload.program_name ?? programKey).trim();
  let studentEmail = normalizeEmail(payload.manual_student_email);
  let studentName = String(payload.manual_student_name ?? '').trim();
  let rosterStudentId: string | null = null;

  if (!['leadership', 'live_project'].includes(certificateType)) {
    throw new ApiClientError('Select a valid manual certificate type.', 400);
  }
  if (!isIsoDate(issueDate)) throw new ApiClientError('Issue date is required before issuing a manual certificate.', 400);

  if (studentId) {
    const { data: student, error: studentError } = await context.supabase
      .from('students')
      .select('id,email,full_name,student_id,program_name,active')
      .eq('id', studentId)
      .limit(1)
      .maybeSingle();
    if (studentError) throw new ApiClientError(studentError.message, 503);
    if (!student) throw new ApiClientError('Selected student was not found.', 404);
    if (student.active === false) throw new ApiClientError('Selected student is inactive.', 400);
    studentEmail = normalizeEmail(student.email);
    studentName = String(student.full_name ?? studentEmail).trim();
    rosterStudentId = String(student.id ?? '');
    if (!programName && student.program_name) programName = String(student.program_name).split(',')[0]?.trim() ?? '';
  }

  if (!studentName) throw new ApiClientError('Student name is required before issuing a manual certificate.', 400);
  if (!isValidEmail(studentEmail)) throw new ApiClientError('A valid student email is required before issuing a manual certificate.', 400);
  if (!programName && !programKey) throw new ApiClientError('Program is required before issuing a manual certificate.', 400);

  let modulesCovered = asStringArray(payload.modules_covered);
  const now = new Date();
  const verificationToken = randomHex(24);
  const row: Record<string, unknown> = {
    certificate_id: '',
    certificate_payload: {
      issueDate,
      manualIssue: true,
      programKey,
      programName
    },
    certificate_type: certificateType,
    email_requested: sendEmail,
    generation_status: 'pending',
    issue_date: issueDate,
    issued_by: adminEmail,
    program_key: programKey || null,
    program_name: programName || programKey,
    status: 'issued',
    student_email: studentEmail,
    student_id: rosterStudentId,
    student_name: studentName,
    verification_token: verificationToken
  };

  const duplicateQuery = context.supabase
    .from('certificates')
    .select('id,certificate_id,certificate_type,status')
    .eq('certificate_type', certificateType)
    .eq('student_email', studentEmail)
    .neq('status', 'revoked')
    .limit(10);

  if (certificateType === 'leadership') {
    duplicateQuery.eq('program_name', programName || programKey);
    if (programKey) duplicateQuery.eq('program_key', programKey);
  } else {
    duplicateQuery.eq('project_title', projectTitle);
  }

  const { data: duplicates, error: duplicateError } = await duplicateQuery;
  if (duplicateError) throw new ApiClientError(duplicateError.message, 503);
  const duplicateWarnings = (duplicates ?? []).map((certificate) => `Possible duplicate: ${String(certificate.certificate_id ?? certificate.id)} already exists.`);
  if (duplicateWarnings.length > 0 && !acknowledgeDuplicate) {
    throw new ApiClientError(`${duplicateWarnings[0]} Confirm duplicate override to issue another certificate.`, 409);
  }

  if (certificateType === 'leadership') {
    if (modulesCovered.length === 0) modulesCovered = [programName || programKey].filter(Boolean);
    row.certificate_id = `SS-LP-${(programKey || programName).toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${now.getFullYear()}-${randomHex(8).toUpperCase()}`;
    row.certificate_payload = {
      cohortName: 'Manual Issue',
      issueDate,
      manualIssue: true,
      modulesCovered,
      programKey,
      programName
    };
    row.cohort_name = 'Manual Issue';
    row.modules_covered = modulesCovered;
  } else {
    if (!projectTitle) throw new ApiClientError('Project title is required before issuing a manual live project certificate.', 400);
    if (!projectRole) throw new ApiClientError('Project role is required before issuing a manual live project certificate.', 400);
    if (![2, 4, 6, 8].includes(durationWeeks)) throw new ApiClientError('Duration must be 2, 4, 6, or 8 weeks.', 400);
    if (!isIsoDate(projectStartDate)) throw new ApiClientError('Project start date is required before issuing a manual live project certificate.', 400);
    const projectEndDate = addDays(projectStartDate, durationWeeks * 7 - 1);
    const projectId = `MANUAL-${slugifyKey(projectTitle).toUpperCase()}-${now.getFullYear()}-${randomHex(4).toUpperCase()}`;
    row.certificate_id = `SS-PROJ-${now.getFullYear()}-${randomHex(10).toUpperCase()}`;
    row.certificate_payload = {
      durationWeeks,
      issueDate,
      manualIssue: true,
      projectEndDate,
      projectStartDate,
      projectTitle,
      projectRole
    };
    row.duration_label = `${durationWeeks} weeks`;
    row.modules_covered = [projectRole, projectTitle].filter(Boolean);
    row.project_end_date = projectEndDate;
    row.project_id = projectId;
    row.project_role = projectRole;
    row.project_start_date = projectStartDate;
    row.project_title = projectTitle;
    row.role_name = projectRole;
    row.submission_id = `manual:${Date.now()}:${randomHex(6)}`;
  }

  row.verification_url = certificateVerificationUrl(String(row.certificate_id));

  const { data, error } = await context.supabase.from('certificates').insert(row).select('*').single();
  if (error) throw mutationError(error, 'certificates');

  await writeAuditLog(context, 'certificates', 'manual_issued', data, {
    certificate_type: certificateType,
    duplicate_override: acknowledgeDuplicate && duplicateWarnings.length > 0,
    manual_issue: true,
    send_email: sendEmail,
    student_email: studentEmail
  });

  const generationMessage = await triggerCertificateGeneration(context, [String(data.id)], sendEmail);

  return {
    certificate: camelize(enrichRow(data)),
    duplicateWarnings,
    message: `${String(row.certificate_id)} manually issued.${duplicateWarnings.length ? ` ${duplicateWarnings.length} duplicate warning${duplicateWarnings.length === 1 ? '' : 's'} acknowledged.` : ''}${generationMessage ? ` ${generationMessage}` : ''}`
  };
}

async function revokeCertificate(context: Awaited<ReturnType<typeof createContext>>, certificateId: string, body: unknown) {
  const admin = await getAdminProfile(context);
  const adminEmail = isRecord(admin) ? String(admin.email ?? context.email) : context.email;
  const payload = snakifyMutationBody(body ?? {});
  const reason = String(payload.reason ?? '').trim();

  if (!certificateId) throw new ApiClientError('Certificate is required.', 400);
  if (reason.length < 8) throw new ApiClientError('Add a clear revocation reason before revoking.', 400);

  const { data, error } = await context.supabase
    .from('certificates')
    .update({
      generation_status: 'expired',
      revocation_reason: reason,
      revoked_at: new Date().toISOString(),
      revoked_by: adminEmail,
      status: 'revoked',
      updated_at: new Date().toISOString()
    })
    .eq('id', certificateId)
    .neq('status', 'revoked')
    .select('*')
    .single();

  if (error) throw mutationError(error, 'certificates');

  await writeAuditLog(context, 'certificates', 'revoked', data, {
    reason
  });

  return camelize(enrichRow(data));
}

async function submitStudentProjectReport(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  const payload = snakifyMutationBody(body);
  const projectId = typeof payload.project_id === 'string' ? payload.project_id.trim() : '';
  const cohortId = typeof payload.cohort_id === 'string' ? payload.cohort_id.trim() : '';
  const submissionLink = typeof payload.submission_link === 'string' ? payload.submission_link.trim() : '';
  const remarks = typeof payload.remarks === 'string' ? payload.remarks.trim() : '';
  const studentFeedback = typeof payload.student_feedback === 'string' ? payload.student_feedback.trim() : '';
  const declarationConfirmations = asStringArray(payload.declaration_confirmations).map((item) => item.trim()).filter(Boolean);
  const declarationAccepted = payload.declaration_accepted === true;

  if (!projectId) throw new ApiClientError('Select a project before submitting.', 400);
  if (!cohortId) throw new ApiClientError('Select the cohort for this submission.', 400);
  if (!isHttpUrl(submissionLink)) throw new ApiClientError('Enter a valid report link that starts with http:// or https://.', 400);
  if (studentFeedback.length < 30) throw new ApiClientError('Add detailed project feedback before submitting.', 400);
  if (!declarationAccepted) throw new ApiClientError('Confirm the project declaration before submitting.', 400);
  if (declarationConfirmations.length < 6) throw new ApiClientError('Confirm all project submission declarations before submitting.', 400);

  const [profile, dashboard, projectBundle] = await Promise.all([
    getStudentProfile(context),
    callRpc(context, 'student_dashboard_bundle', { p_student_email: context.email }),
    callRpc(context, 'student_projects_bundle', { p_student_email: context.email })
  ]);

  const student = isRecord(profile) ? profile : {};
  const studentId = String(student.id ?? '');
  const studentName = String(student.fullName ?? student.full_name ?? context.email);
  const projects = extractItems(projectBundle, ['projects', 'items']).filter(isRecord);
  const cohorts = extractItems(dashboard, ['cohorts', 'studentCohorts']).filter(isRecord);
  const submissions = extractItems(projectBundle, ['projectSubmissionRequests', 'project_submission_requests']).filter(isRecord);
  const limitRows = extractItems(projectBundle, ['projectSubmissionStudentLimits', 'project_submission_student_limits']).filter(isRecord);
  const maxAttempts = Math.max(1, Number(limitRows[0]?.maxAttempts ?? limitRows[0]?.max_attempts ?? 1) || 1);

  const project = projects.find((item) => String(item.projectId ?? item.project_id ?? item.id) === projectId);
  if (!project) throw new ApiClientError('This project is not available to your account.', 403);
  if (String(project.status ?? '').toLowerCase() !== 'active') throw new ApiClientError('This project is not active for submission.', 403);

  const projectExternalId = String(project.projectId ?? project.project_id ?? project.id);
  const projectPrograms = uniqueStrings([...asStringArray(project.programKeys ?? project.program_keys), String(project.programKey ?? project.program_key ?? '')]).map((item) => item.toLowerCase());
  const cohort = cohorts.find((item) => String(item.id ?? '') === cohortId || String(item.cohortId ?? item.cohort_id ?? '') === cohortId || String(item.name ?? '') === cohortId);
  if (!cohort) throw new ApiClientError('This cohort is not available to your account.', 403);
  if (String(cohort.status ?? '').toLowerCase() !== 'active') throw new ApiClientError('This cohort is not active for submissions.', 403);

  const cohortProgramKey = String(cohort.programKey ?? cohort.program_key ?? '').toLowerCase();
  if (!cohortProgramKey || !projectPrograms.includes(cohortProgramKey)) {
    throw new ApiClientError('This project is not mapped to the selected cohort.', 403);
  }

  const cohortName = String(cohort.name ?? '');
  const cohortKey = slugifyKey(cohortName || String(cohort.cohortId ?? cohort.cohort_id ?? cohort.id));
  const cohortSubmissions = submissions
    .filter((item) => {
      const sameCohort = String(item.cohortKey ?? item.cohort_key ?? '') === cohortKey || String(item.cohortName ?? item.cohort_name ?? '') === cohortName;
      return sameCohort;
    })
    .sort((left, right) => Number(right.attemptNumber ?? right.attempt_number ?? 0) - Number(left.attemptNumber ?? left.attempt_number ?? 0));
  const projectCohortSubmissions = cohortSubmissions.filter((item) => String(item.projectId ?? item.project_id ?? '') === projectExternalId);
  const latest = projectCohortSubmissions[0];
  const latestStatus = String(latest?.status ?? '');
  const isChangesRequestedRetry = latestStatus === 'changes_requested';

  if (['submitted', 'under_review', 'approved'].includes(latestStatus)) {
    throw new ApiClientError('A project report has already been submitted for this cohort.', 409);
  }

  const highestAttempt = projectCohortSubmissions.reduce((max, item) => Math.max(max, Number(item.attemptNumber ?? item.attempt_number ?? 0)), 0);
  if (highestAttempt > 0 && !isChangesRequestedRetry) {
    throw new ApiClientError('A project report has already been submitted for this cohort.', 409);
  }

  const submittedProjectIds = uniqueStrings(cohortSubmissions.map((item) => String(item.projectId ?? item.project_id ?? '')).filter(Boolean));
  const hasSubmittedThisProject = submittedProjectIds.includes(projectExternalId);
  if (!hasSubmittedThisProject && submittedProjectIds.length >= maxAttempts) {
    throw new ApiClientError(`Your LP project submission limit for this cohort is ${maxAttempts}.`, 409);
  }

  const now = new Date();
  const attemptNumber = highestAttempt + 1;
  const deadline = typeof project.deadline === 'string' && project.deadline.trim() ? new Date(`${project.deadline.slice(0, 10)}T23:59:59.999`) : null;
  const isLate = deadline ? now.getTime() > deadline.getTime() : false;
  const stamp = compactTimestamp(now);
  const requestId = `PSR-${Date.now()}`;
  const requestNumber = `LPR-${stamp}-${String(Date.now()).slice(-4)}`;

  const row = {
    attempt_number: attemptNumber,
    cohort_key: cohortKey,
    cohort_name: cohortName,
    is_late: isLate,
    program_key: cohortProgramKey,
    project_id: projectExternalId,
    project_title: String(project.title ?? projectExternalId),
    remarks: remarks || null,
    request_id: requestId,
    request_number: requestNumber,
    role_id: String(project.roleId ?? project.role_id ?? ''),
    role_name: String(project.projectRole ?? project.project_role ?? project.roleName ?? project.role_name ?? ''),
    status: 'submitted',
    student_email: context.email,
    student_feedback: studentFeedback,
    student_id: studentId,
    student_name: studentName,
    declaration_confirmations: declarationConfirmations,
    submission_link: submissionLink,
    submitted_at: now.toISOString()
  };

  const { data, error } = await context.supabase.from('project_submission_requests').insert(row).select('*').single();
  if (error) throw mutationError(error, 'project_submission_requests');

  return {
    isLate,
    message: isLate ? 'Project report submitted as a late submission.' : 'Project report submitted for admin review.',
    submission: camelize(data)
  };
}

async function updateById(context: Awaited<ReturnType<typeof createContext>>, table: string, id: string, body: unknown, auditAction?: string) {
  const endpoint = getWriteEndpoint(table);
  const metadata = getWriteMetadata(endpoint.table, body);
  const payload = prepareWritePayload(endpoint, body, false);
  const { data, error } = await context.supabase.from(endpoint.table).update(payload).eq('id', id).select('*').single();
  if (error) throw mutationError(error, endpoint.table);
  if (endpoint.table === 'students') await syncStudentAssignments(context, data, metadata);
  if (auditAction) await writeAuditLog(context, endpoint.table, auditAction, data, payload);
  if (metadata.sendInvite && endpoint.table === 'students') await queueStudentInvite(context, data);
  if (metadata.sendOnboardingMail && endpoint.table === 'students') await queueStudentOnboardingMail(context, data);
  return endpoint.table === 'students' ? (await enrichAdminStudents(context, [data]))[0] : camelize(enrichRow(data));
}

async function deleteById(context: Awaited<ReturnType<typeof createContext>>, table: string, id: string, auditAction?: string) {
  const endpoint = getWriteEndpoint(table);
  const { data, error } = await context.supabase.from(endpoint.table).delete().eq('id', id).select('*').single();
  if (error) throw mutationError(error, endpoint.table);
  if (auditAction) await writeAuditLog(context, endpoint.table, auditAction, data, {});
  return camelize(enrichRow(data));
}

async function insertRow(context: Awaited<ReturnType<typeof createContext>>, table: string, body: unknown, auditAction?: string) {
  const endpoint = getWriteEndpoint(table);
  const metadata = getWriteMetadata(endpoint.table, body);
  const payload = prepareWritePayload(endpoint, body, true);
  if (endpoint.table === 'students') {
    const email = normalizeEmail(payload.email);
    const existing = email ? await context.supabase.from('students').select('*').ilike('email', email).limit(1).maybeSingle() : { data: null, error: null };
    if (existing.error) throw mutationError(existing.error, endpoint.table);
    if (existing.data) {
      const existingCohortNames = await getStudentLinkedCohortNames(context, String(existing.data.id ?? ''));
      const scopedOnboardingCohortNames = resolveFreshOnboardingCohortNames(metadata.cohortNames, existingCohortNames);
      const assignmentMetadata = metadata.assignmentMode === 'add' ? await mergeExistingStudentAssignmentMetadata(context, existing.data, metadata) : metadata;
      const updatePayload: Record<string, unknown> = { ...payload, email, updated_at: new Date().toISOString() };
      if (metadata.assignmentMode === 'add') {
        updatePayload.cohort_id = assignmentMetadata.cohortIds[0] || updatePayload.cohort_id;
        updatePayload.cohort_name = assignmentMetadata.cohortNames[0] || updatePayload.cohort_name;
        updatePayload.track_role_ids = assignmentMetadata.programKeys.length > 0 ? assignmentMetadata.programKeys : updatePayload.track_role_ids;
        updatePayload.program_name = assignmentMetadata.programNames.length > 0 ? assignmentMetadata.programNames.join(', ') : updatePayload.program_name;
      }
      const { data, error } = await context.supabase.from('students').update(updatePayload).eq('id', existing.data.id).select('*').single();
      if (error) throw mutationError(error, endpoint.table);
      await syncStudentAssignments(context, data, assignmentMetadata);
      if (auditAction) await writeAuditLog(context, endpoint.table, 'updated', data, updatePayload);
      if (metadata.sendOnboardingMail && scopedOnboardingCohortNames.length > 0) await queueStudentOnboardingMail(context, data, scopedOnboardingCohortNames);
      return (await enrichAdminStudents(context, [data]))[0];
    }
  }
  const insertPayload = endpoint.table === 'students' && !payload.student_id ? { ...payload, student_id: generateStudentRosterId() } : payload;
  const { data, error } = await context.supabase.from(endpoint.table).insert(insertPayload).select('*').single();
  if (error) throw mutationError(error, endpoint.table);
  if (endpoint.table === 'students') await syncStudentAssignments(context, data, metadata);
  if (auditAction) await writeAuditLog(context, endpoint.table, auditAction, data, insertPayload);
  if (metadata.sendInvite && endpoint.table === 'students') await queueStudentInvite(context, data);
  if (metadata.sendOnboardingMail && endpoint.table === 'students') await queueStudentOnboardingMail(context, data, metadata.cohortNames);
  return endpoint.table === 'students' ? (await enrichAdminStudents(context, [data]))[0] : camelize(enrichRow(data));
}

async function importStudents(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.students)) {
    throw new ApiClientError('Student import payload must include a students list.', 400);
  }

  if (body.students.length > 500) {
    throw new ApiClientError('Student import is limited to 500 rows at a time.', 400);
  }

  const endpoint = getWriteEndpoint('students');
  const result = {
    created: 0,
    failed: 0,
    rows: [] as Array<{ action?: 'created' | 'updated' | 'skipped'; email?: string; error?: string; rowNumber: number; status: 'success' | 'failed' }>,
    updated: 0
  };

  for (const [index, studentBody] of body.students.entries()) {
    const rowNumber = index + 2;
    let rowEmail = '';
    try {
      const metadata = getWriteMetadata('students', studentBody);
      const payload = prepareWritePayload(endpoint, studentBody, true);
      const email = normalizeEmail(payload.email);
      rowEmail = email;
      const existing = await context.supabase.from('students').select('*').ilike('email', email).limit(1).maybeSingle();
      if (existing.error) throw existing.error;

      if (existing.data) {
        const existingCohortNames = await getStudentLinkedCohortNames(context, String(existing.data.id ?? ''));
        const scopedOnboardingCohortNames = resolveFreshOnboardingCohortNames(metadata.cohortNames, existingCohortNames);
        const assignmentMetadata = metadata.assignmentMode === 'add' ? await mergeExistingStudentAssignmentMetadata(context, existing.data, metadata) : metadata;
        const updatePayload: Record<string, unknown> = { ...payload, email, updated_at: new Date().toISOString() };
        if (metadata.assignmentMode === 'add') {
          updatePayload.cohort_id = assignmentMetadata.cohortIds[0] || updatePayload.cohort_id;
          updatePayload.cohort_name = assignmentMetadata.cohortNames[0] || updatePayload.cohort_name;
          updatePayload.track_role_ids = assignmentMetadata.programKeys.length > 0 ? assignmentMetadata.programKeys : updatePayload.track_role_ids;
          updatePayload.program_name = assignmentMetadata.programNames.length > 0 ? assignmentMetadata.programNames.join(', ') : updatePayload.program_name;
        }
        const { data, error } = await context.supabase.from('students').update(updatePayload).eq('id', existing.data.id).select('*').single();
        if (error) throw error;
        await syncStudentAssignments(context, data, assignmentMetadata);
        const warnings: string[] = [];
        try {
          await writeAuditLog(context, 'students', 'updated', data, updatePayload);
        } catch (auditError) {
          warnings.push(auditError instanceof Error ? auditError.message : 'Audit logging failed after the student was updated.');
        }
        if (metadata.sendOnboardingMail && scopedOnboardingCohortNames.length > 0) {
          try {
            await queueStudentOnboardingMail(context, data, scopedOnboardingCohortNames);
          } catch (mailError) {
            warnings.push(mailError instanceof Error ? mailError.message : 'Onboarding mail failed after the student was updated.');
          }
        }
        result.updated += 1;
        result.rows.push({ action: 'updated', email, error: warnings.join(' '), rowNumber, status: 'success' });
      } else {
        const insertPayload = { ...payload, email, student_id: payload.student_id || generateStudentRosterId() };
        const { data, error } = await context.supabase.from('students').insert(insertPayload).select('*').single();
        if (error) throw error;
        await syncStudentAssignments(context, data, metadata);
        const warnings: string[] = [];
        try {
          await writeAuditLog(context, 'students', 'created', data, insertPayload);
        } catch (auditError) {
          warnings.push(auditError instanceof Error ? auditError.message : 'Audit logging failed after the student was created.');
        }
        if (metadata.sendInvite) {
          try {
            await queueStudentInvite(context, data);
          } catch (inviteError) {
            warnings.push(inviteError instanceof Error ? inviteError.message : 'Invite delivery failed after the student was created.');
          }
        }
        if (metadata.sendOnboardingMail) {
          try {
            await queueStudentOnboardingMail(context, data, metadata.cohortNames);
          } catch (mailError) {
            warnings.push(mailError instanceof Error ? mailError.message : 'Onboarding mail failed after the student was created.');
          }
        }
        result.created += 1;
        result.rows.push({ action: 'created', email, error: warnings.join(' '), rowNumber, status: 'success' });
      }
    } catch (error) {
      result.failed += 1;
      result.rows.push({ email: rowEmail, error: error instanceof Error ? error.message : 'Import failed for this row.', rowNumber, status: 'failed' });
    }
  }

  return result;
}

async function bulkUpdateStudents(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.studentIds)) {
    throw new ApiClientError('Bulk update payload must include selected students.', 400);
  }

  const studentIds = uniqueStrings(body.studentIds).slice(0, 500);
  if (studentIds.length === 0) throw new ApiClientError('Select at least one student.', 400);

  const active = typeof body.active === 'boolean' ? body.active : undefined;
  const addCohortIds = asStringArray(body.cohortIds);
  const addCohortNames = asStringArray(body.cohortNames);
  const addProgramKeys = asStringArray(body.programKeys);
  const addProgramNames = asStringArray(body.programNames);
  const assignmentMode = body.assignmentMode === 'replace' ? 'replace' : 'add';
  const resendInvite = body.resendInvite === true;
  const result = { failed: 0, rows: [] as Array<{ email?: string; error?: string; status: 'success' | 'failed'; studentId: string }>, updated: 0 };

  const { data: students, error } = await context.supabase.from('students').select('*').in('id', studentIds).limit(500);
  if (error) throw new ApiClientError(error.message, 503);
  const studentsById = new Map((students ?? []).map((student) => [String(student.id), student]));

  for (const studentId of studentIds) {
    const student = studentsById.get(studentId);
    if (!student) {
      result.failed += 1;
      result.rows.push({ error: 'Student not found.', status: 'failed', studentId });
      continue;
    }

    try {
      let currentStudent = student as Record<string, unknown>;
      if (active !== undefined) {
        const { data, error: updateError } = await context.supabase.from('students').update({ active, updated_at: new Date().toISOString() }).eq('id', studentId).select('*').single();
        if (updateError) throw updateError;
        currentStudent = data;
        await writeAuditLog(context, 'students', 'status_changed', data, { active });
      }

      if (addCohortNames.length > 0 || addCohortIds.length > 0 || addProgramKeys.length > 0 || addProgramNames.length > 0) {
        const [cohortsResult, programsResult] = await Promise.all([
          context.supabase.from('student_cohorts').select('cohort_id,cohort_name').eq('student_id', studentId).limit(500),
          context.supabase.from('student_programs').select('program_key').eq('student_id', studentId).limit(500)
        ]);
        if (cohortsResult.error) throw cohortsResult.error;
        if (programsResult.error) throw programsResult.error;

        await syncStudentAssignments(context, currentStudent, {
          assignmentMode,
          cohortIds: assignmentMode === 'replace' ? addCohortIds : uniqueStrings([...(cohortsResult.data ?? []).map((cohort) => cohort.cohort_id), ...addCohortIds]),
          cohortNames: assignmentMode === 'replace' ? addCohortNames : uniqueStrings([...(cohortsResult.data ?? []).map((cohort) => cohort.cohort_name), ...addCohortNames]),
          programKeys: assignmentMode === 'replace' ? addProgramKeys : uniqueStrings([...(programsResult.data ?? []).map((program) => program.program_key), ...addProgramKeys]),
          programNames: addProgramNames,
          sendInvite: false,
          sendOnboardingMail: false
        });
        await writeAuditLog(context, 'students', 'updated', currentStudent, { assignment_mode: assignmentMode, bulk_assignment: true, cohort_names: addCohortNames, program_keys: addProgramKeys });
      }

      if (resendInvite) await queueStudentInvite(context, currentStudent);
      result.updated += 1;
      result.rows.push({ email: normalizeEmail(currentStudent.email), status: 'success', studentId });
    } catch (bulkError) {
      result.failed += 1;
      result.rows.push({ email: normalizeEmail(student.email), error: bulkError instanceof Error ? bulkError.message : 'Bulk update failed.', status: 'failed', studentId });
    }
  }

  return result;
}

async function resendStudentInvites(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.studentIds)) {
    throw new ApiClientError('Resend invite payload must include selected students.', 400);
  }

  const result = await bulkUpdateStudents(context, { resendInvite: true, studentIds: body.studentIds });
  return { queued: result.failed === 0, ...result };
}

async function getStudentById(context: Awaited<ReturnType<typeof createContext>>, studentId: string) {
  const { data, error } = await context.supabase.from('students').select('id,email,full_name,student_id,cohort_name,program_name,college_name,live_project_role_ids,active').eq('id', studentId).single();
  if (error) throw new ApiClientError(error.message, error.code === 'PGRST116' ? 404 : 503);
  return data;
}

async function getStudentLinkedCohortNames(context: Awaited<ReturnType<typeof createContext>>, studentId: string) {
  if (!studentId) return [];
  const { data, error } = await context.supabase
    .from('student_cohorts')
    .select('cohort_name')
    .eq('student_id', studentId)
    .limit(500);
  if (error) throw new ApiClientError(`Student cohorts lookup failed: ${error.message}`, 503);
  return uniqueStrings((data ?? []).map((row) => String(row.cohort_name ?? '').trim()).filter(Boolean));
}

function resolveFreshOnboardingCohortNames(selectedCohortNames: string[], existingCohortNames: string[]) {
  const existing = new Set(existingCohortNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  return uniqueStrings(selectedCohortNames).filter((name) => name.trim() && !existing.has(name.trim().toLowerCase()));
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
  await processQueuedStudentEmail(context, String(data.id ?? ''), 'invite');
}

async function studentOnboardingContext(context: Awaited<ReturnType<typeof createContext>>, student: Record<string, unknown>, scopedCohortNames?: string[]) {
  const studentId = String(student.id ?? '');
  const requestedCohortNames = uniqueStrings((scopedCohortNames ?? []).map((name) => String(name ?? '').trim()).filter(Boolean));
  if (!studentId) {
    return {
      cohort_group_details: '',
      cohorts: requestedCohortNames.join(', ') || String(student.cohort_name ?? ''),
      google_groups: '',
      programs: String(student.program_name ?? ''),
      whatsapp_groups: ''
    };
  }

  const links = requestedCohortNames.length > 0
    ? requestedCohortNames.map((cohortName) => ({ cohort_name: cohortName }))
    : await (async () => {
      const { data, error } = await context.supabase
        .from('student_cohorts')
        .select('cohort_name')
        .eq('student_id', studentId)
        .limit(100);
      if (error) throw new ApiClientError(`Student was saved, but onboarding context failed: ${error.message}`, 503);
      return data ?? [];
    })();

  const { data: studentPrograms, error: studentProgramError } = await context.supabase
    .from('student_programs')
    .select('program_key')
    .eq('student_id', studentId)
    .limit(100);
  if (studentProgramError) throw new ApiClientError(`Student was saved, but onboarding program context failed: ${studentProgramError.message}`, 503);

  const cohortNames = uniqueStrings([
    ...(links ?? []).map((row) => String(row.cohort_name ?? '')),
    ...(requestedCohortNames.length > 0 ? [] : [String(student.cohort_name ?? '')])
  ]);

  const { data: cohorts, error: cohortError } = cohortNames.length
    ? await context.supabase
      .from('cohorts')
      .select('name,program_key,google_group,wa_group_name,wa_link')
      .in('name', cohortNames)
      .limit(100)
    : { data: [], error: null };
  if (cohortError) throw new ApiClientError(`Student was saved, but cohort group details failed: ${cohortError.message}`, 503);

  const programKeys = uniqueStrings([
    ...(requestedCohortNames.length > 0 ? [] : (studentPrograms ?? []).map((row) => String(row.program_key ?? ''))),
    ...(cohorts ?? []).map((cohort) => String(cohort.program_key ?? ''))
  ].map((key) => key.toLowerCase()));
  const { data: programs, error: programError } = programKeys.length
    ? await context.supabase
      .from('programs')
      .select('program_key,name,short_name')
      .in('program_key', programKeys)
      .limit(100)
    : { data: [], error: null };
  if (programError) throw new ApiClientError(`Student was saved, but program details failed: ${programError.message}`, 503);

  const programNameByKey = new Map((programs ?? []).map((program) => [
    String(program.program_key ?? '').toLowerCase(),
    String(program.name ?? program.short_name ?? program.program_key ?? '')
  ]));
  const programNames = cleanProgramNames([
    ...programKeys.map((key) => programNameByKey.get(key) || key),
    ...(requestedCohortNames.length > 0 ? [] : String(student.program_name ?? '').split(',').map((item) => item.trim())),
    ...programKeys
  ], programNameByKey);

  const cohortDetails = (cohorts ?? []).map((cohort) => [
    cohort.name ? `Cohort: ${cohort.name}` : '',
    cohort.program_key ? `Program: ${programNameByKey.get(String(cohort.program_key).toLowerCase()) || cohort.program_key}` : '',
    cohort.wa_group_name ? `WhatsApp group: ${cohort.wa_group_name}` : '',
    cohort.wa_link ? `WhatsApp link: ${cohort.wa_link}` : '',
    cohort.google_group ? `Google group: ${cohort.google_group}` : ''
  ].filter(Boolean).join('\n'));

  return {
    cohort_group_details: cohortDetails.join('\n\n'),
    cohorts: cohortNames.join(', '),
    google_groups: (cohorts ?? []).map((cohort) => String(cohort.google_group ?? '')).filter(Boolean).join('\n'),
    programs: programNames.join(', '),
    whatsapp_groups: (cohorts ?? []).map((cohort) => [cohort.wa_group_name, cohort.wa_link].filter(Boolean).join(' - ')).filter(Boolean).join('\n')
  };
}

function cleanProgramNames(values: string[], programNameByKey: Map<string, string>) {
  return uniqueStrings(values).filter((value) => {
    const key = value.toLowerCase();
    const resolvedName = programNameByKey.get(key);
    return !resolvedName || resolvedName.toLowerCase() === key;
  });
}

async function queueStudentOnboardingMail(context: Awaited<ReturnType<typeof createContext>>, student: Record<string, unknown>, scopedCohortNames?: string[]) {
  const email = normalizeEmail(student.email);
  if (!email) throw new ApiClientError('Student was saved, but onboarding mail queueing failed because the email is missing.', 400);
  const onboardingContext = await studentOnboardingContext(context, student, scopedCohortNames);

  const queueRow = {
    category: 'auth',
    created_by: context.email,
    params: {
      cohort: student.cohort_name ?? null,
      cohort_group_details: onboardingContext.cohort_group_details,
      cohorts: onboardingContext.cohorts,
      google_groups: onboardingContext.google_groups,
      program: student.program_name ?? null,
      programs: onboardingContext.programs,
      student_id: student.student_id ?? student.id,
      student_name: student.full_name ?? email,
      whatsapp_groups: onboardingContext.whatsapp_groups
    },
    recipient_email: email,
    recipient_name: student.full_name ?? null,
    related_entity_id: String(student.id ?? ''),
    related_entity_type: 'student',
    status: 'queued',
    subject: 'Welcome to Skilled Sapiens LMS',
    tags: ['lms', 'lms-auth', 'onboarding'],
    template_key: 'onboarding_welcome'
  };

  const { data, error } = await context.supabase.from('email_queue').insert(queueRow).select('*').single();
  if (error) throw new ApiClientError(`Student was saved, but onboarding mail queueing failed: ${error.message}`, 503);
  await writeAuditLog(context, 'students', 'onboarding_mail_queued', student, { email_queue_id: data.id, template_key: 'onboarding_welcome' });
  await processQueuedStudentEmail(context, String(data.id ?? ''), 'onboarding mail');
}

async function processQueuedStudentEmail(context: Awaited<ReturnType<typeof createContext>>, queueId: string, label: string) {
  if (!queueId) throw new ApiClientError(`Student was saved, but ${label} delivery failed because the queue id is missing.`, 503);
  const { data, error } = await context.supabase.functions.invoke('transactional-email', {
    body: {
      action: 'processQueuedStudentEmail',
      queueId
    }
  });
  if (error) {
    const message = getFunctionErrorMessage(data, error);
    throw new ApiClientError(`Student was saved, but ${label} delivery failed: ${message}`, 503);
  }
  if (isRecord(data) && typeof data.error === 'string') {
    throw new ApiClientError(`Student was saved, but ${label} delivery failed: ${data.error}`, 503);
  }
}

async function callRpc(context: Awaited<ReturnType<typeof createContext>>, functionName: string, params?: Record<string, boolean | string>) {
  const { data, error } = await context.supabase.rpc(functionName, params);
  if (error) throw new ApiClientError(error.message, 503);
  return camelize(data);
}

function applyCommonFilters<TQuery extends SupabaseQuery>(request: TQuery, query: ApiClientOptions['query'], endpoint: TableEndpoint): TQuery {
  const ignored = new Set(['activeOnly', 'direction', 'includePast', 'limit', 'page', 'search', 'sort']);
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

    if ((endpoint.table === 'resources' || endpoint.table === 'projects') && key === 'programKey') {
      request = request.contains('program_keys', [String(normalizedValue)]) as TQuery;
      return;
    }

    if (endpoint.table === 'resources' && key === 'cohortName') {
      request = request.contains('cohort_names', [String(normalizedValue)]) as TQuery;
      return;
    }

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
  const direction = String(query?.direction ?? '').trim().toLowerCase();
  const ascending = direction === 'asc' ? true : direction === 'desc' ? false : order?.ascending;
  return order ? (request.order(order.column, { ascending }) as TQuery) : request;
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

  const ignored = new Set(['activeOnly', 'direction', 'includePast', 'limit', 'page', 'search', 'sort']);
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

function isStudentRecordingRow(item: unknown) {
  if (!isRecord(item)) return false;
  const status = String(item.status ?? item.workshop_status ?? item.workshopStatus ?? '');
  const recordingUrl = item.recording_url ?? item.recordingUrl ?? item.youtube_video_url ?? item.youtubeVideoUrl ?? item.zoom_recording_url ?? item.zoomRecordingUrl;
  return status === 'Completed' && typeof recordingUrl === 'string' && recordingUrl.trim().length > 0;
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
    education_year: row.education_year ?? row.you_are_from,
    join_url: row.locked === true ? null : row.join_url ?? row.joinUrl,
    live_project_duration: row.live_project_duration ?? row.duration,
    category: row.category ?? row.role_category,
    name: row.name ?? row.role_name,
    onboarding_date: row.onboarding_date ?? row.project_start_date,
    personal_mentor: row.personal_mentor ?? row.personalmentor,
    recording_password: row.locked === true ? null : row.recording_password ?? row.recordingPassword ?? row.zoom_recording_password ?? row.zoomRecordingPassword,
    recording_url: row.locked === true ? null : row.recording_url ?? row.recordingUrl ?? row.youtube_video_url ?? row.youtubeVideoUrl ?? row.zoom_recording_url ?? row.zoomRecordingUrl,
    self_paced_resources: row.self_paced_resources ?? row.sp_resources,
    self_paced_sessions: row.self_paced_sessions ?? row.sp_sessions,
    source: row.source ?? (row.youtube_video_url || row.youtubeVideoUrl ? 'youtube' : row.zoom_recording_url || row.zoomRecordingUrl ? 'zoom' : undefined),
    status: row.status ?? row.workshop_status ?? row.workshopStatus,
    tasks: normalizeProjectList(row.tasks ?? row.action_items ?? row.actionItems, 'task'),
    whatsapp_group_name: row.whatsapp_group_name ?? row.whatsappGroupName ?? row.wa_group_name ?? row.waGroupName,
    whatsapp_link: row.whatsapp_link ?? row.whatsappLink ?? row.wa_link ?? row.waLink
  };
}

function normalizeProjectList(value: unknown, kind: 'deliverable' | 'document' | 'task') {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeProjectListItem(item, kind))
      .filter(Boolean);
  }
  if (value === null || value === undefined || value === '') return [];

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmedValue);
        const parsedItems = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.items) ? parsed.items : [];
        return parsedItems.map((item) => normalizeProjectListItem(item, kind)).filter(Boolean);
      } catch {
        // Fall back to the legacy line parser below.
      }
    }

    return value
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [title, detail, extra] = entry.split('|').map((part) => part.trim());
        if (kind === 'document') {
          const twoPartLink = detail && !extra && isHttpUrl(detail);
          const inlineTitleLink = extractHttpUrl(title);
          const inlineDetailLink = extractHttpUrl(detail);
          const link = twoPartLink ? detail : extra || inlineTitleLink || inlineDetailLink || undefined;
          const cleanTitle = inlineTitleLink ? title.replace(inlineTitleLink, '').replace(/[:\-–—|]+$/g, '').trim() : title;
          const cleanDetail = inlineDetailLink ? detail.replace(inlineDetailLink, '').replace(/[:\-–—|]+$/g, '').trim() : detail;
          return {
            title: cleanTitle || title,
            type: twoPartLink ? undefined : cleanDetail || undefined,
            link
          };
        }
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

function normalizeProjectListItem(item: unknown, kind: 'deliverable' | 'document' | 'task') {
  if (!isRecord(item)) return item;
  if (kind === 'document') {
    const rawLink = item.link ?? item.url ?? item.resource_url ?? item.resourceUrl ?? item.file_url ?? item.fileUrl;
    const rawTitle = item.title ?? item.name ?? item.label ?? (typeof rawLink === 'string' ? rawLink : 'Document');
    const rawDescription = item.description ?? item.note;
    const titleLink = typeof rawTitle === 'string' ? extractHttpUrl(rawTitle) : undefined;
    const descriptionLink = typeof rawDescription === 'string' ? extractHttpUrl(rawDescription) : undefined;
    const link = typeof rawLink === 'string' && isHttpUrl(rawLink) ? rawLink : titleLink || descriptionLink;
    const title =
      typeof rawTitle === 'string' && titleLink
        ? rawTitle.replace(titleLink, '').replace(/[:\-–—|]+$/g, '').trim() || 'Document'
        : rawTitle;

    return {
      ...item,
      title,
      type: item.type ?? item.file_type ?? item.fileType,
      link,
      description: rawDescription
    };
  }

  if (kind === 'deliverable') {
    return {
      ...item,
      title: item.title ?? item.name ?? 'Deliverable',
      format: item.format ?? item.type,
      note: item.note ?? item.description
    };
  }

  return {
    ...item,
    title: item.title ?? item.name ?? 'Task',
    description: item.description ?? item.note
  };
}

function computeActiveNow(row: Record<string, unknown>) {
  if (row.status && row.status !== 'active') return false;
  if (typeof row.expires_at === 'string') return new Date(row.expires_at).getTime() > Date.now();
  return row.status === 'active';
}

function isVisibleAnnouncementNow(item: unknown) {
  if (!isRecord(item)) return false;

  const status = String(item.status ?? item.announcement_status ?? item.announcementStatus ?? 'active').toLowerCase();
  if (status && status !== 'active') return false;

  const now = Date.now();
  const startDate = item.start_date ?? item.startDate;
  const endDate = item.end_date ?? item.endDate;
  const startsAt = typeof startDate === 'string' && startDate.trim() ? new Date(startDate).getTime() : Number.NaN;
  const endsAt = typeof endDate === 'string' && endDate.trim() ? new Date(endDate).getTime() : Number.NaN;

  if (!Number.isNaN(startsAt) && startsAt > now) return false;
  if (!Number.isNaN(endsAt) && endsAt < now) return false;

  return true;
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

function getWriteMetadata(table: string, body: unknown): StudentWriteMetadata {
  if (table !== 'students' || !isRecord(body)) return { assignmentMode: 'replace', cohortIds: [], cohortNames: [], programKeys: [], programNames: [], sendInvite: false, sendOnboardingMail: false };
  const rawPayload = snakify(body) as Record<string, unknown>;
  return {
    assignmentMode: rawPayload.assignment_mode === 'add' ? 'add' : 'replace',
    cohortIds: asStringArray(rawPayload.cohort_ids),
    cohortNames: asStringArray(rawPayload.cohort_names),
    programKeys: asStringArray(rawPayload.program_keys),
    programNames: asStringArray(rawPayload.program_names),
    sendInvite: rawPayload.send_invite === true,
    sendOnboardingMail: rawPayload.send_onboarding_mail === true
  };
}

async function syncStudentAssignments(context: Awaited<ReturnType<typeof createContext>>, student: Record<string, unknown>, metadata: StudentWriteMetadata) {
  const studentId = String(student.id ?? '');
  if (!studentId) return;

  const cohortIds = uniqueStrings(metadata.cohortIds);
  const cohortNames = uniqueStrings(metadata.cohortNames.length > 0 ? metadata.cohortNames : [student.cohort_name]);
  const programKeys = uniqueStrings(metadata.programKeys.length > 0 ? metadata.programKeys : asStringArray(student.track_role_ids));
  const programNames = uniqueStrings(metadata.programNames);

  const selectedCohorts = await resolveStudentCohortAssignments(context, cohortIds, cohortNames);

  const deleteCohorts = await context.supabase.from('student_cohorts').delete().eq('student_id', studentId);
  if (deleteCohorts.error) throw new ApiClientError(`Student cohorts sync failed: ${deleteCohorts.error.message}`, 503);

  if (selectedCohorts.length > 0) {
    const { error } = await context.supabase.from('student_cohorts').insert(
      selectedCohorts.map((cohort) => ({
        cohort_id: cohort.id,
        cohort_name: cohort.name,
        student_id: studentId
      }))
    );
    if (error) throw new ApiClientError(`Student cohorts sync failed: ${error.message}`, 503);
  }

  const deletePrograms = await context.supabase.from('student_programs').delete().eq('student_id', studentId);
  if (deletePrograms.error) throw new ApiClientError(`Student programs sync failed: ${deletePrograms.error.message}`, 503);

  if (programKeys.length > 0) {
    const nameByKey = await resolveProgramNamesByKey(context, programKeys, programNames);
    const { error } = await context.supabase.from('student_programs').insert(
      programKeys.map((programKey) => ({
        program_key: programKey,
        student_id: studentId,
        student_name: nameByKey.get(programKey) ?? String(student.full_name ?? student.email ?? '')
      }))
    );
    if (error) throw new ApiClientError(`Student programs sync failed: ${error.message}`, 503);
  }
}

async function mergeExistingStudentAssignmentMetadata(context: Awaited<ReturnType<typeof createContext>>, student: Record<string, unknown>, metadata: StudentWriteMetadata): Promise<StudentWriteMetadata> {
  const studentId = String(student.id ?? '');
  if (!studentId || metadata.assignmentMode !== 'add') return metadata;

  const [cohortsResult, programsResult] = await Promise.all([
    context.supabase.from('student_cohorts').select('cohort_id,cohort_name').eq('student_id', studentId).limit(500),
    context.supabase.from('student_programs').select('program_key,student_name').eq('student_id', studentId).limit(500)
  ]);
  if (cohortsResult.error) throw new ApiClientError(`Student cohorts lookup failed: ${cohortsResult.error.message}`, 503);
  if (programsResult.error) throw new ApiClientError(`Student programs lookup failed: ${programsResult.error.message}`, 503);

  return {
    ...metadata,
    cohortIds: uniqueStrings([...(cohortsResult.data ?? []).map((cohort) => cohort.cohort_id), ...metadata.cohortIds]),
    cohortNames: uniqueStrings([...(cohortsResult.data ?? []).map((cohort) => cohort.cohort_name), ...metadata.cohortNames]),
    programKeys: uniqueStrings([...(programsResult.data ?? []).map((program) => program.program_key), ...metadata.programKeys]),
    programNames: uniqueStrings([...(programsResult.data ?? []).map((program) => program.student_name), ...metadata.programNames])
  };
}

async function resolveStudentCohortAssignments(context: Awaited<ReturnType<typeof createContext>>, cohortIds: string[], cohortNames: string[]) {
  if (cohortIds.length === 0 && cohortNames.length === 0) return [];

  const lookups = [];
  if (cohortIds.length > 0) lookups.push(context.supabase.from('cohorts').select('id,name').in('id', cohortIds).limit(500));
  if (cohortNames.length > 0) lookups.push(context.supabase.from('cohorts').select('id,name').in('name', cohortNames).limit(500));

  const results = await Promise.all(lookups);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new ApiClientError(`Student cohort lookup failed: ${failed.error.message}`, 503);
  const data = results.flatMap((result) => result.data ?? []);

  return uniqueBy(
    data.map((cohort) => ({ id: String(cohort.id), name: String(cohort.name ?? '').trim() })).filter((cohort) => cohort.id && cohort.name),
    (cohort) => cohort.id
  );
}

async function resolveProgramNamesByKey(context: Awaited<ReturnType<typeof createContext>>, programKeys: string[], programNames: string[]) {
  const nameByKey = new Map<string, string>();
  programKeys.forEach((key, index) => nameByKey.set(key, programNames[index] ?? key));

  if (programKeys.length === 0) return nameByKey;

  const { data, error } = await context.supabase.from('programs').select('program_key,name').in('program_key', programKeys).limit(500);
  if (error) throw new ApiClientError(`Student program lookup failed: ${error.message}`, 503);

  (data ?? []).forEach((program) => {
    const key = String(program.program_key ?? '').trim();
    const name = String(program.name ?? key).trim();
    if (key && name) nameByKey.set(key, name);
  });

  return nameByKey;
}

function normalizeStudentWriteBody(payload: Record<string, unknown>) {
  const cohortIds = asStringArray(payload.cohort_ids);
  const cohortNames = asStringArray(payload.cohort_names);
  const programNames = asStringArray(payload.program_names);
  const programKeys = asStringArray(payload.program_keys);
  const liveProjectRoleIds = payload.live_project_role_ids === undefined ? undefined : asStringArray(payload.live_project_role_ids);

  return {
    ...payload,
    cohort_id: cohortIds[0] || payload.cohort_id,
    cohort_name: cohortNames[0] || payload.cohort_name,
    duration: payload.duration ?? payload.live_project_duration,
    email: payload.email ? normalizeEmail(payload.email) : payload.email,
    alt_email: payload.alt_email ? normalizeEmail(payload.alt_email) : payload.alt_email,
    live_project_role_ids: liveProjectRoleIds,
    onboarding_mail_status: typeof payload.onboarding_mail_status === 'string' ? payload.onboarding_mail_status.toLowerCase() : payload.onboarding_mail_status,
    personalmentor: payload.personalmentor ?? payload.personal_mentor,
    program_name: programNames.join(', ') || programKeys.join(', ') || payload.program_name,
    project_start_date: payload.project_start_date ?? payload.onboarding_date,
    track_role_ids: programKeys.length > 0 ? programKeys : payload.track_role_ids,
    wa_group_name: payload.wa_group_name ?? payload.wa_group,
    you_are_from: payload.you_are_from ?? payload.education_year,
    cohort_ids: undefined,
    cohort_names: undefined,
    education_year: undefined,
    live_project_duration: undefined,
    live_project_roles: undefined,
    onboarding_date: undefined,
    personal_mentor: undefined,
    program_keys: undefined,
    program_names: undefined,
    send_onboarding_mail: undefined,
    send_invite: undefined,
    assignment_mode: undefined,
    wa_group: undefined
  };
}

function generateStudentRosterId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `STU-${year}${month}${day}-${random}`;
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
  const zoomRecordingPassword = payload.zoom_recording_password === '' ? null : payload.zoom_recording_password;
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
    zoom_recording_password: zoomRecordingPassword,
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

function normalizeProgramWriteBody(payload: Record<string, unknown>) {
  return {
    ...payload,
    domain_label: typeof payload.domain_label === 'string' ? payload.domain_label.trim() : payload.domain_label,
    name: typeof payload.name === 'string' ? payload.name.trim() : payload.name,
    program_key: typeof payload.program_key === 'string' ? payload.program_key.trim().toLowerCase().replace(/[\s-]+/g, '_') : payload.program_key,
    short_name: typeof payload.short_name === 'string' ? payload.short_name.trim() : payload.short_name,
    status: typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status
  };
}

function normalizeProjectRoleWriteBody(payload: Record<string, unknown>) {
  return {
    ...payload,
    program_key: typeof payload.program_key === 'string' ? payload.program_key.trim().toLowerCase() : payload.program_key,
    role_category: typeof payload.role_category === 'string' ? payload.role_category.trim() : typeof payload.category === 'string' ? payload.category.trim() : payload.role_category,
    role_id: typeof payload.role_id === 'string' ? payload.role_id.trim().toLowerCase().replace(/[\s-]+/g, '_') : payload.role_id,
    role_name: typeof payload.role_name === 'string' ? payload.role_name.trim() : typeof payload.name === 'string' ? payload.name.trim() : payload.role_name,
    status: typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    category: undefined,
    name: undefined
  };
}

function normalizeProjectWriteBody(payload: Record<string, unknown>) {
  const programKeys =
    payload.program_keys === undefined
      ? undefined
      : uniqueStrings(asStringArray(payload.program_keys).map((key) => key.trim().toLowerCase()).filter(Boolean));
  const primaryProgramKey = programKeys?.[0] ?? (typeof payload.program_key === 'string' ? payload.program_key.trim().toLowerCase() : payload.program_key);
  const deadline = payload.deadline === '' ? null : payload.deadline;

  return {
    ...payload,
    action_items: typeof payload.action_items === 'string' ? payload.action_items.trim() : payload.action_items,
    brief: typeof payload.brief === 'string' ? payload.brief.trim() : payload.brief,
    company_name: typeof payload.company_name === 'string' ? payload.company_name.trim() : payload.company_name,
    deadline,
    deliverables: typeof payload.deliverables === 'string' ? payload.deliverables.trim() : payload.deliverables,
    objectives: typeof payload.objectives === 'string' ? payload.objectives.trim() : payload.objectives,
    program_key: primaryProgramKey,
    program_keys: programKeys,
    program_name: typeof payload.program_name === 'string' ? payload.program_name.trim() : payload.program_name,
    project_id: typeof payload.project_id === 'string' ? payload.project_id.trim() : payload.project_id,
    project_role: typeof payload.project_role === 'string' ? payload.project_role.trim() : payload.project_role,
    resources: typeof payload.resources === 'string' ? payload.resources.trim() : payload.resources,
    role_id: typeof payload.role_id === 'string' ? payload.role_id.trim() : payload.role_id,
    status: typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    title: typeof payload.title === 'string' ? payload.title.trim() : payload.title
  };
}

function normalizeProjectToolkitWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const programKeys = has('program_keys')
    ? uniqueStrings(asStringArray(payload.program_keys).map((key) => key.trim().toLowerCase()).filter(Boolean))
    : undefined;
  const sortOrder = has('sort_order') && payload.sort_order !== '' && payload.sort_order !== null ? Number(payload.sort_order) : payload.sort_order;

  return {
    ...payload,
    content: has('content') && typeof payload.content === 'string' ? payload.content.trim() : payload.content,
    item_type: has('item_type') && typeof payload.item_type === 'string' ? payload.item_type.trim().toLowerCase() : payload.item_type,
    link_label: has('link_label') ? String(payload.link_label ?? '').trim() || null : payload.link_label,
    link_url: has('link_url') ? String(payload.link_url ?? '').trim() || null : payload.link_url,
    program_keys: programKeys,
    sort_order: sortOrder,
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    summary: has('summary') && typeof payload.summary === 'string' ? payload.summary.trim() : payload.summary,
    title: has('title') && typeof payload.title === 'string' ? payload.title.trim() : payload.title,
    toolkit_id: has('toolkit_id') && typeof payload.toolkit_id === 'string' ? payload.toolkit_id.trim().toLowerCase().replace(/[\s-]+/g, '_') : payload.toolkit_id
  };
}

function normalizeRecordingSequenceWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const sequenceNumber = has('sequence_number') && payload.sequence_number !== '' && payload.sequence_number !== null ? Number(payload.sequence_number) : payload.sequence_number;
  const matchAliases = has('match_aliases')
    ? uniqueStrings(asStringArray(payload.match_aliases).map((alias) => alias.trim()).filter(Boolean))
    : payload.match_aliases;

  return {
    ...payload,
    match_aliases: matchAliases,
    program_key: has('program_key') && typeof payload.program_key === 'string' ? payload.program_key.trim().toLowerCase() : payload.program_key,
    recording_section: has('recording_section') ? normalizeRecordingSection(payload.recording_section) : payload.recording_section,
    sequence_number: sequenceNumber,
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    title: has('title') && typeof payload.title === 'string' ? payload.title.trim() : payload.title
  };
}

function normalizeAnnouncementWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const normalizeOptionalText = (key: string) => {
    if (!has(key)) return undefined;
    const value = payload[key];
    if (value === null) return null;
    const text = String(value ?? '').trim();
    return text || null;
  };
  const normalizeOptionalDate = (key: string) => {
    if (!has(key)) return undefined;
    const value = payload[key];
    if (value === null) return null;
    const text = String(value ?? '').trim();
    return text || null;
  };
  const audience = has('audience') && typeof payload.audience === 'string' ? payload.audience.trim().toLowerCase() : payload.audience;
  const type = has('type') && typeof payload.type === 'string' ? payload.type.trim().toLowerCase() : payload.type;
  const customEmoji = normalizeOptionalText('custom_emoji');
  const cohortNames = has('cohort_names') ? uniqueStrings(asStringArray(payload.cohort_names)) : undefined;
  const programKeys = has('program_keys') ? uniqueStrings(asStringArray(payload.program_keys).map((key) => key.trim().toLowerCase()).filter(Boolean)) : undefined;

  return {
    ...payload,
    announcement_id: has('announcement_id') ? String(payload.announcement_id ?? '').trim() : payload.announcement_id,
    audience,
    cohort_names: cohortNames,
    custom_emoji: customEmoji === undefined ? undefined : customEmoji,
    end_date: normalizeOptionalDate('end_date'),
    link_label: normalizeOptionalText('link_label'),
    link_url: normalizeOptionalText('link_url'),
    message: has('message') && typeof payload.message === 'string' ? payload.message.trim() : payload.message,
    pinned: has('pinned') ? payload.pinned === true : payload.pinned,
    priority: has('priority') && typeof payload.priority === 'string' ? payload.priority.trim().toLowerCase() : payload.priority,
    program_keys: programKeys,
    start_date: normalizeOptionalDate('start_date'),
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    title: has('title') && typeof payload.title === 'string' ? payload.title.trim() : payload.title,
    type,
    updated_by: normalizeOptionalText('updated_by')
  };
}

function normalizeFeatureControlWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const normalizeOptionalText = (key: string) => {
    if (!has(key)) return undefined;
    const value = payload[key];
    if (value === null) return null;
    const text = String(value ?? '').trim();
    return text || null;
  };

  return {
    ...payload,
    module_id: has('module_id') && typeof payload.module_id === 'string' ? payload.module_id.trim() : payload.module_id,
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    student_label: has('student_label') && typeof payload.student_label === 'string' ? payload.student_label.trim() : payload.student_label,
    student_path: has('student_path') && typeof payload.student_path === 'string' ? payload.student_path.trim() : payload.student_path,
    upcoming_message: normalizeOptionalText('upcoming_message'),
    settings: has('settings') && payload.settings && typeof payload.settings === 'object' && !Array.isArray(payload.settings) ? payload.settings : payload.settings,
    updated_by: normalizeOptionalText('updated_by')
  };
}

function normalizeEmailTemplatePhase(value: unknown) {
  const key = slugifyKey(String(value ?? ''));
  const aliased = EMAIL_TEMPLATE_PHASE_ALIASES[key] ?? key;
  if (EMAIL_TEMPLATE_PHASE_KEYS.has(aliased)) return aliased;
  return aliased || 'general';
}

function normalizeEmailTemplateCategory(value: unknown, phase?: string) {
  const key = slugifyKey(String(value ?? ''));
  if (['auth', 'transactional', 'general'].includes(key)) return key;

  const phaseKey = normalizeEmailTemplatePhase(phase || key || 'general');
  if (phaseKey === 'auth' || phaseKey === 'onboarding') return 'auth';
  if (phaseKey === 'custom' || phaseKey === 'general' || phaseKey === 'placement') return 'general';
  return 'transactional';
}

function normalizeEmailTemplateWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const templateName = has('template_name') && typeof payload.template_name === 'string' ? payload.template_name.trim() : payload.template_name;
  const phase = has('phase') && typeof payload.phase === 'string' ? normalizeEmailTemplatePhase(payload.phase) : payload.phase;
  const category = has('category') && typeof payload.category === 'string' ? normalizeEmailTemplateCategory(payload.category, typeof phase === 'string' ? phase : undefined) : payload.category;
  const templateKey =
    has('template_key') && typeof payload.template_key === 'string'
      ? slugifyKey(payload.template_key)
      : typeof templateName === 'string' && templateName.trim()
        ? `${String(phase || category || 'custom').replace(/[^a-z0-9]+/g, '_')}_${slugifyKey(templateName)}`
        : payload.template_key;

  return {
    ...payload,
    allowed_variables: has('allowed_variables') ? uniqueStrings(asStringArray(payload.allowed_variables).map((item) => item.replace(/[{}]/g, '').trim()).filter(Boolean)) : payload.allowed_variables,
    body: has('body') && typeof payload.body === 'string' ? payload.body.trim() : payload.body,
    brevo_template_id: payload.brevo_template_id === '' || payload.brevo_template_id === null ? null : payload.brevo_template_id,
    category: category || normalizeEmailTemplateCategory(undefined, typeof phase === 'string' ? phase : undefined),
    default_tags: has('default_tags') ? uniqueStrings(asStringArray(payload.default_tags).map((item) => item.toLowerCase())) : payload.default_tags,
    description: has('description') ? String(payload.description ?? '').trim() || null : payload.description,
    is_system: has('is_system') ? payload.is_system === true : payload.is_system,
    phase: phase || normalizeEmailTemplatePhase(typeof category === 'string' ? category : 'general'),
    sample_params: isRecord(payload.sample_params) ? payload.sample_params : {},
    sort_order: payload.sort_order === '' || payload.sort_order === undefined ? 100 : Number(payload.sort_order),
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    subject: has('subject') && typeof payload.subject === 'string' ? payload.subject.trim() : payload.subject,
    template_key: templateKey,
    template_name: templateName
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

function validateProgramWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const programKey = typeof payload.program_key === 'string' ? payload.program_key.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;

  if (inserting && !name) throw new ApiClientError('Program name is required.', 400);
  if (inserting && !programKey) throw new ApiClientError('Program key is required.', 400);
  if (programKey && !/^[a-z0-9_]+$/.test(programKey)) {
    throw new ApiClientError('Program key can use lowercase letters, numbers, and underscores only.', 400);
  }
  if (status && !['active', 'inactive'].includes(status)) {
    throw new ApiClientError('Program status is invalid.', 400);
  }
}

function validateProjectRoleWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const roleId = typeof payload.role_id === 'string' ? payload.role_id.trim() : '';
  const roleName = typeof payload.role_name === 'string' ? payload.role_name.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const programKey = typeof payload.program_key === 'string' ? payload.program_key.trim() : '';

  if (inserting && !roleId) throw new ApiClientError('Role ID is required.', 400);
  if (inserting && !roleName) throw new ApiClientError('Role name is required.', 400);
  if (roleId && !/^[a-z0-9_]+$/.test(roleId)) throw new ApiClientError('Role ID can use lowercase letters, numbers, and underscores only.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Role status is invalid.', 400);
  if (programKey && !/^[a-z0-9_]+$/.test(programKey)) throw new ApiClientError('Program key is invalid.', 400);
}

function validateProjectWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const projectId = typeof payload.project_id === 'string' ? payload.project_id.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const programKeys = payload.program_keys;
  const programKey = typeof payload.program_key === 'string' ? payload.program_key.trim() : '';
  const deadline = typeof payload.deadline === 'string' ? payload.deadline.trim() : '';
  const requiresProgramMapping = inserting || 'program_keys' in payload || 'program_key' in payload || 'title' in payload || 'role_id' in payload;

  if (inserting && !projectId) throw new ApiClientError('Project ID is required.', 400);
  if (inserting && !title) throw new ApiClientError('Project title is required.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Project status is invalid.', 400);
  if (programKeys !== undefined && !Array.isArray(programKeys)) throw new ApiClientError('Project programs must be a list.', 400);
  if (requiresProgramMapping && (!Array.isArray(programKeys) || programKeys.length === 0 || !programKey)) throw new ApiClientError('Select at least one program.', 400);
  if (deadline && Number.isNaN(new Date(`${deadline}T00:00:00.000Z`).getTime())) throw new ApiClientError('Project deadline is invalid.', 400);
}

function validateProjectToolkitWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const toolkitId = typeof payload.toolkit_id === 'string' ? payload.toolkit_id.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const itemType = typeof payload.item_type === 'string' ? payload.item_type.trim() : undefined;
  const status = typeof payload.status === 'string' ? payload.status.trim() : undefined;
  const linkUrl = typeof payload.link_url === 'string' ? payload.link_url.trim() : '';
  const programKeys = payload.program_keys;
  const sortOrder = payload.sort_order;

  if (inserting && !toolkitId) throw new ApiClientError('Toolkit ID is required.', 400);
  if (inserting && !title) throw new ApiClientError('Toolkit title is required.', 400);
  if (inserting && !itemType) throw new ApiClientError('Toolkit type is required.', 400);
  if ('toolkit_id' in payload && (!toolkitId || !/^[a-z0-9_]+$/.test(toolkitId))) throw new ApiClientError('Toolkit ID can use lowercase letters, numbers, and underscores only.', 400);
  if ('title' in payload && !title) throw new ApiClientError('Toolkit title is required.', 400);
  if (itemType && !['guidelines', 'sow_link', 'framework', 'custom'].includes(itemType)) throw new ApiClientError('Toolkit type is invalid.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Toolkit status is invalid.', 400);
  if (programKeys !== undefined && !Array.isArray(programKeys)) throw new ApiClientError('Toolkit programs must be a list.', 400);
  if (linkUrl && !isHttpUrl(linkUrl)) throw new ApiClientError('Toolkit link must start with http:// or https://.', 400);
  if (sortOrder !== undefined && sortOrder !== null && sortOrder !== '' && !Number.isFinite(Number(sortOrder))) throw new ApiClientError('Toolkit sort order is invalid.', 400);
}

function validateRecordingSequenceWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const programKey = typeof payload.program_key === 'string' ? payload.program_key.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const sequenceNumber = payload.sequence_number;
  const recordingSection = typeof payload.recording_section === 'string' ? payload.recording_section.trim() : undefined;
  const status = typeof payload.status === 'string' ? payload.status.trim() : undefined;
  const aliases = payload.match_aliases;

  if (inserting && !programKey) throw new ApiClientError('Program is required for sequence rules.', 400);
  if (inserting && !title) throw new ApiClientError('Workshop title is required for sequence rules.', 400);
  if (inserting && !Number.isInteger(Number(sequenceNumber))) throw new ApiClientError('Sequence number is required.', 400);
  if ('program_key' in payload && (!programKey || !/^[a-z0-9_]+$/.test(programKey))) throw new ApiClientError('Program key is invalid.', 400);
  if ('title' in payload && !title) throw new ApiClientError('Workshop title is required for sequence rules.', 400);
  if (recordingSection && !RECORDING_SECTION_KEYS.has(recordingSection)) throw new ApiClientError('Recording section is invalid.', 400);
  if (sequenceNumber !== undefined && (!Number.isInteger(Number(sequenceNumber)) || Number(sequenceNumber) < 1)) throw new ApiClientError('Sequence number must be a positive whole number.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Sequence status is invalid.', 400);
  if (aliases !== undefined && !Array.isArray(aliases)) throw new ApiClientError('Sequence aliases must be a list.', 400);
}

function validateAnnouncementWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const audience = typeof payload.audience === 'string' ? payload.audience : undefined;
  const priority = typeof payload.priority === 'string' ? payload.priority : undefined;
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const type = typeof payload.type === 'string' ? payload.type : undefined;
  const cohortNames = payload.cohort_names;
  const programKeys = payload.program_keys;
  const startDate = typeof payload.start_date === 'string' ? payload.start_date.trim() : '';
  const endDate = typeof payload.end_date === 'string' ? payload.end_date.trim() : '';
  const linkUrl = typeof payload.link_url === 'string' ? payload.link_url.trim() : '';

  if (inserting && !title) throw new ApiClientError('Announcement title is required.', 400);
  if (inserting && !message) throw new ApiClientError('Announcement message is required.', 400);
  if ('title' in payload && !title) throw new ApiClientError('Announcement title is required.', 400);
  if ('message' in payload && !message) throw new ApiClientError('Announcement message is required.', 400);
  if (title.length > 160) throw new ApiClientError('Announcement title must be 160 characters or fewer.', 400);
  if (message.length > 2500) throw new ApiClientError('Announcement message must be 2500 characters or fewer.', 400);
  if (audience && !['all', 'cohort', 'program'].includes(audience)) throw new ApiClientError('Announcement audience is invalid.', 400);
  if (priority && !['normal', 'urgent'].includes(priority)) throw new ApiClientError('Announcement priority is invalid.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Announcement status is invalid.', 400);
  if (type && !['general', 'alert', 'session', 'resource', 'project', 'custom'].includes(type)) throw new ApiClientError('Announcement type is invalid.', 400);
  if (cohortNames !== undefined && !Array.isArray(cohortNames)) throw new ApiClientError('Announcement cohorts must be a list.', 400);
  if (programKeys !== undefined && !Array.isArray(programKeys)) throw new ApiClientError('Announcement programs must be a list.', 400);
  if (audience === 'cohort' && Array.isArray(cohortNames) && cohortNames.length === 0) throw new ApiClientError('Select at least one cohort.', 400);
  if (audience === 'program' && Array.isArray(programKeys) && programKeys.length === 0) throw new ApiClientError('Select at least one program.', 400);
  if (startDate && Number.isNaN(new Date(`${startDate}T00:00:00.000Z`).getTime())) throw new ApiClientError('Announcement start date is invalid.', 400);
  if (endDate && Number.isNaN(new Date(`${endDate}T00:00:00.000Z`).getTime())) throw new ApiClientError('Announcement end date is invalid.', 400);
  if (startDate && endDate && startDate > endDate) throw new ApiClientError('Announcement end date cannot be before the start date.', 400);
  if (linkUrl && !isHttpUrl(linkUrl)) throw new ApiClientError('Announcement link must start with http:// or https://.', 400);
}

function validateFeatureControlWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const moduleId = typeof payload.module_id === 'string' ? payload.module_id.trim() : '';
  const label = typeof payload.student_label === 'string' ? payload.student_label.trim() : '';
  const path = typeof payload.student_path === 'string' ? payload.student_path.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const message = typeof payload.upcoming_message === 'string' ? payload.upcoming_message.trim() : '';
  const settings = payload.settings;

  if (inserting && !moduleId) throw new ApiClientError('Feature module ID is required.', 400);
  if (inserting && !label) throw new ApiClientError('Feature student label is required.', 400);
  if (inserting && !path) throw new ApiClientError('Feature student URL is required.', 400);
  if (moduleId && !/^[a-z0-9-]+$/.test(moduleId)) throw new ApiClientError('Feature module ID is invalid.', 400);
  if (status && !['show', 'upcoming', 'hide'].includes(status)) throw new ApiClientError('Feature status is invalid.', 400);
  if (moduleId === 'dashboard' && status && status !== 'show') throw new ApiClientError('Dashboard must remain visible.', 400);
  if (message.length > 500) throw new ApiClientError('Upcoming message must be 500 characters or fewer.', 400);
  if (settings !== undefined && settings !== null && (typeof settings !== 'object' || Array.isArray(settings))) {
    throw new ApiClientError('Feature settings must be a valid object.', 400);
  }
}

function validateEmailTemplateWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const templateName = typeof payload.template_name === 'string' ? payload.template_name.trim() : '';
  const templateKey = typeof payload.template_key === 'string' ? payload.template_key.trim() : '';
  const phase = typeof payload.phase === 'string' ? payload.phase.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status.trim() : undefined;
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const allowedVariables = payload.allowed_variables;
  const defaultTags = payload.default_tags;
  const sortOrder = payload.sort_order;

  if (inserting && !templateName) throw new ApiClientError('Template name is required.', 400);
  if (inserting && !templateKey) throw new ApiClientError('Template key is required.', 400);
  if (inserting && !phase) throw new ApiClientError('Template phase is required.', 400);
  if ('template_name' in payload && !templateName) throw new ApiClientError('Template name is required.', 400);
  if ('template_key' in payload && (!templateKey || !/^[a-z0-9_]+$/.test(templateKey))) throw new ApiClientError('Template key can use lowercase letters, numbers, and underscores only.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Template status is invalid.', 400);
  if ('subject' in payload && !subject) throw new ApiClientError('Template subject is required.', 400);
  if ('body' in payload && !body) throw new ApiClientError('Template body is required.', 400);
  if (subject.length > 240) throw new ApiClientError('Template subject must be 240 characters or fewer.', 400);
  if (body.length > 8000) throw new ApiClientError('Template body must be 8000 characters or fewer.', 400);
  if (allowedVariables !== undefined && !Array.isArray(allowedVariables)) throw new ApiClientError('Template variables must be a list.', 400);
  if (defaultTags !== undefined && !Array.isArray(defaultTags)) throw new ApiClientError('Template tags must be a list.', 400);
  if (sortOrder !== undefined && !Number.isFinite(Number(sortOrder))) throw new ApiClientError('Template sort order is invalid.', 400);
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
  const educationYear = typeof payload.you_are_from === 'string' ? payload.you_are_from.trim() : '';
  const liveProjectDuration = typeof payload.duration === 'string' ? payload.duration.trim() : '';
  const onboardingMailStatus = typeof payload.onboarding_mail_status === 'string' ? payload.onboarding_mail_status : undefined;
  const onboardingDate = typeof payload.project_start_date === 'string' ? payload.project_start_date.trim() : '';
  const personalMentor = typeof payload.personalmentor === 'string' ? payload.personalmentor.trim() : '';
  const trackRoleIds = payload.track_role_ids;
  const liveProjectRoleIds = payload.live_project_role_ids;

  if (inserting && !fullName) throw new ApiClientError('Student full name is required.', 400);
  if (inserting && !email) throw new ApiClientError('Student email is required.', 400);
  if (email && !isValidEmail(email)) throw new ApiClientError('Student email is invalid.', 400);
  if (altEmail && !isValidEmail(altEmail)) throw new ApiClientError('Alternative email is invalid.', 400);
  if (personalMentor && !['Yes', 'No'].includes(personalMentor)) {
    throw new ApiClientError('Opted for Personal Mentor must be Yes or No.', 400);
  }
  if (educationYear && !['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', 'Working Professional'].includes(educationYear)) {
    throw new ApiClientError('Education Year is invalid.', 400);
  }
  if (liveProjectDuration && !['2 weeks', '4 weeks', '6 weeks', '8 weeks'].includes(liveProjectDuration)) {
    throw new ApiClientError('Live Project Duration is invalid.', 400);
  }
  if (onboardingDate && Number.isNaN(new Date(`${onboardingDate}T00:00:00`).getTime())) {
    throw new ApiClientError('Onboarding Date is invalid.', 400);
  }
  if (onboardingMailStatus && !['pending', 'sent', 'failed', 'skipped', 'dry-run'].includes(onboardingMailStatus)) {
    throw new ApiClientError('Onboarding mail status is invalid.', 400);
  }
  if (trackRoleIds !== undefined && !Array.isArray(trackRoleIds)) {
    throw new ApiClientError('Student program role IDs must be a list.', 400);
  }
  if (liveProjectRoleIds !== undefined && !Array.isArray(liveProjectRoleIds)) {
    throw new ApiClientError('Student live project roles must be a list.', 400);
  }
}

async function writeAuditLog(
  context: Awaited<ReturnType<typeof createContext>>,
  table: string,
  action: string,
  row: Record<string, unknown>,
  payload: Record<string, unknown>
) {
  if (
    table !== 'announcements' &&
    table !== 'cohorts' &&
    table !== 'students' &&
    table !== 'workshops' &&
    table !== 'resources' &&
    table !== 'programs' &&
    table !== 'projects' &&
    table !== 'project_toolkit_items' &&
    table !== 'role_master' &&
    table !== 'certificates' &&
    table !== 'feature_controls' &&
    table !== 'email_templates'
  ) return;
  const entityType =
    table === 'cohorts'
      ? 'cohort'
      : table === 'workshops'
        ? 'workshop'
        : table === 'resources'
          ? 'resource'
          : table === 'programs'
            ? 'program'
            : table === 'projects'
              ? 'project'
              : table === 'project_toolkit_items'
                ? 'project_toolkit_item'
                : table === 'role_master'
                  ? 'project_role'
                  : table === 'certificates'
                    ? 'certificate'
                    : table === 'feature_controls'
                      ? 'feature_control'
                      : table === 'email_templates'
                        ? 'email_template'
                        : 'student';

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
  if (error) {
    throw new ApiClientError(
      `${entityType === 'cohort' ? 'Cohort' : entityType === 'workshop' ? 'Workshop' : entityType === 'resource' ? 'Resource' : entityType === 'program' ? 'Program' : entityType === 'project' ? 'Project' : entityType === 'project_toolkit_item' ? 'Project toolkit item' : entityType === 'project_role' ? 'Project role' : entityType === 'certificate' ? 'Certificate' : entityType === 'feature_control' ? 'Feature control' : entityType === 'email_template' ? 'Email template' : 'Student'} was saved, but audit logging failed: ${error.message}`,
      503
    );
  }
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

  if (table === 'programs') {
    return {
      ...base,
      name: row.name,
      programKey: row.program_key,
      status: row.status
    };
  }

  if (table === 'projects') {
    return {
      ...base,
      projectId: row.project_id,
      status: row.status,
      title: row.title
    };
  }

  if (table === 'project_toolkit_items') {
    return {
      ...base,
      status: row.status,
      title: row.title,
      toolkitId: row.toolkit_id
    };
  }

  if (table === 'role_master') {
    return {
      ...base,
      programKey: row.program_key,
      roleId: row.role_id,
      roleName: row.role_name,
      status: row.status
    };
  }

  if (table === 'email_templates') {
    return {
      ...base,
      category: row.category,
      phase: row.phase,
      status: row.status,
      templateKey: row.template_key,
      templateName: row.template_name
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
  if (error.code === '23514' && /linked to (an Admin|a Student|an admin|a student|Admin|Student) account/i.test(error.message)) {
    return new ApiClientError(error.message, 409);
  }

  if (error.code === '23505') {
    if (table === 'cohorts') return new ApiClientError('A cohort with this name or cohort ID already exists.', 409);
    if (table === 'students') return new ApiClientError('A student with this email already exists.', 409);
    if (table === 'resources') return new ApiClientError('A resource with this Resource ID already exists.', 409);
    if (table === 'projects') return new ApiClientError('A project with this Project ID already exists.', 409);
    if (table === 'role_master') return new ApiClientError('A project role with this Role ID already exists.', 409);
    if (table === 'recording_sequence_rules') return new ApiClientError('This sequence number already exists for the selected program and section.', 409);
    if (table === 'project_submission_requests') return new ApiClientError('A project report attempt already exists for this cohort.', 409);
    return new ApiClientError('A record with this unique value already exists.', 409);
  }

  return new ApiClientError(error.message, 503);
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function splitCommaValues(value: unknown) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function uniqueBy<TItem>(items: TItem[], getKey: (item: TItem) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function intersectStringSets(sets: string[][]) {
  const [first, ...rest] = sets.map((set) => new Set(set));
  if (!first) return [];
  return Array.from(first).filter((value) => rest.every((set) => set.has(value)));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function extractHttpUrl(value: string | undefined) {
  if (!value) return undefined;
  return value.match(/https?:\/\/[^\s,;]+/i)?.[0];
}

function slugifyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function compactTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function liveProjectCertificateKey(studentEmail: unknown, projectId: unknown, cohortName: unknown) {
  return [normalizeEmail(studentEmail), String(projectId ?? '').trim().toLowerCase(), String(cohortName ?? '').trim().toLowerCase()].join('|');
}

function certificateVerificationUrl(certificateId: string) {
  const base = CERTIFICATE_VERIFY_BASE_URL.endsWith('/') ? CERTIFICATE_VERIFY_BASE_URL : `${CERTIFICATE_VERIFY_BASE_URL}/`;
  return `${base}?certId=${encodeURIComponent(certificateId)}`;
}

async function triggerCertificateGeneration(context: Awaited<ReturnType<typeof createContext>>, certificateIds: string[], sendEmail: boolean) {
  const ids = certificateIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return '';

  try {
    const { data, error } = await context.supabase.functions.invoke('certificate-issuance', {
      body: {
        certificateIds: ids,
        sendEmail
      }
    });
    if (error) throw error;
    const message = isRecord(data) && typeof data.message === 'string' ? data.message : '';
    return message || 'PDF generation started.';
  } catch (error) {
    return `Certificate row saved, but PDF generation needs retry: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
}

function randomHex(length: number) {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  globalThis.crypto?.getRandomValues(bytes);
  const fallback = () => Math.floor(Math.random() * 256);
  const values = Array.from(bytes, (value) => value || fallback());
  return values.map((value) => value.toString(16).padStart(2, '0')).join('').slice(0, length);
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
