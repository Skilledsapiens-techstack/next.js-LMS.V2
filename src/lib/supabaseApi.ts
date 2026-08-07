import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';
import { webEnv } from '../config/env';
import { getEffectiveAdminPermissions, hasAdminPermission, normalizeAdminRole, type AdminPermission } from '../auth/adminPermissions';

const CERTIFICATE_VERIFY_BASE_URL = 'https://skilledsapiens.com/verify-your-certificate/';
const STUDENT_SUPPORT_CONTACT_SETTING_KEY = 'student_contact';
const DEFAULT_STUDENT_SUPPORT_CONTACT = {
  supportContactNote: 'Email us with your registered LMS email, module name, and the issue you are facing.',
  supportContactTitle: 'Need help from the support team?',
  supportEmail: ''
};

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
  '/admins/career-readiness-content': 'admin.resources.view',
  '/admins/certificate-program-settings': 'admin.certificates.view',
  '/admins/certificate-requests': 'admin.certificates.view',
  '/admins/certificate-review-items': 'admin.certificates.view',
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
  '/admins/student-guidance-content': 'admin.programs.view',
  '/admins/project-roles': 'admin.projects.view',
  '/admins/project-toolkit': 'admin.projects.view',
  '/admins/project-submissions': 'admin.submissions.view',
  '/admins/projects': 'admin.projects.view',
  '/admins/recording-candidates': 'admin.recordings.view',
  '/admins/recording-sequences': 'admin.recordings.view',
  '/admins/resource-domains': 'admin.resources.view',
  '/admins/resources': 'admin.resources.view',
  '/admins/student-audit-logs': 'admin.observability.view',
  '/admins/student-roster-snapshots': 'admin.students.manage',
  '/admins/students': 'admin.students.view',
  '/admins/students/college-options': 'admin.students.view',
  '/admins/support-categories': 'admin.support.view',
  '/admins/support-faqs': 'admin.support.view',
  '/admins/support-settings': 'admin.support.view',
  '/admins/support-tickets': 'admin.support.view',
  '/admins/whatsapp-categories': 'admin.community.view',
  '/admins/whatsapp-groups': 'admin.community.view',
  '/admins/whatsapp-logs': 'admin.community.view',
  '/admins/whatsapp-templates': 'admin.community.view',
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

const STUDENT_ROSTER_SNAPSHOT_COLUMNS = [
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
  'onboarding_sequence',
  'personalmentor',
  'phone',
  'program_name',
  'project_start_date',
  'slot',
  'student_id',
  'track_role_ids',
  'wa_group_name',
  'you_are_from'
];

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
  'guest_access_enabled',
  'guest_access_expires_at',
  'guest_cta_label',
  'guest_cta_url',
  'guest_registration_required',
  'join_url',
  'payment_link',
  'price',
  'program_key',
  'session_type',
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
  'guest_access_enabled',
  'guest_access_expires_at',
  'guest_cta_label',
  'guest_cta_url',
  'guest_registration_required',
  'payment_link',
  'price',
  'program_keys',
  'resource_domain_key',
  'resource_id',
  'resource_mode',
  'resource_type',
  'status',
  'title',
  'url'
]);

const RESOURCE_DOMAIN_WRITE_COLUMNS = new Set([
  'description',
  'domain_key',
  'label',
  'sort_order',
  'status'
]);

const PROGRAM_WRITE_COLUMNS = new Set([
  'banner_url',
  'career_outcomes',
  'catalogue_badge',
  'certificate_details',
  'cta_buttons',
  'curriculum',
  'domain_label',
  'duration',
  'faqs',
  'guest_catalogue_enabled',
  'highlights',
  'live_project_details',
  'mentor_support',
  'name',
  'next_batch_date',
  'outcomes',
  'overview',
  'pricing',
  'program_key',
  'schedule_format',
  'short_description',
  'short_name',
  'status',
  'thumbnail_url',
  'tools_covered',
  'what_you_will_learn',
  'who_should_join'
]);

const STUDENT_GUIDANCE_CONTENT_WRITE_COLUMNS = new Set([
  'audience',
  'content',
  'content_key',
  'sort_order',
  'status',
  'summary',
  'title'
]);

const CAREER_READINESS_CONTENT_WRITE_COLUMNS = new Set([
  'category',
  'cohort_names',
  'content',
  'created_by',
  'description',
  'guest_access_enabled',
  'guest_access_expires_at',
  'guest_cta_label',
  'guest_cta_url',
  'guest_registration_required',
  'is_published',
  'link_buttons',
  'link_label',
  'link_url',
  'program_keys',
  'section_title',
  'sort_order',
  'title',
  'updated_by'
]);

const WHATSAPP_GROUP_WRITE_COLUMNS = new Set([
  'cohort_name',
  'created_by',
  'direct_chat_link',
  'group_name',
  'invite_link',
  'notes',
  'program_name',
  'status',
  'updated_by'
]);

const WHATSAPP_CATEGORY_WRITE_COLUMNS = new Set([
  'created_by',
  'name',
  'sort_order',
  'status',
  'updated_by'
]);

const WHATSAPP_TEMPLATE_WRITE_COLUMNS = new Set([
  'category_id',
  'created_by',
  'message_body',
  'notes',
  'status',
  'title',
  'updated_by'
]);

const WHATSAPP_LOG_WRITE_COLUMNS = new Set([
  'category_id',
  'cohort_name',
  'group_id',
  'group_name',
  'message_body',
  'message_title',
  'metadata',
  'notes',
  'program_name',
  'sent_at',
  'sent_by',
  'status',
  'template_id'
]);

const LEADERSHIP_PROGRAM_KEYS = new Set(['mclp', 'smlp', 'hrlp', 'flp_er', 'flp_pevc', 'flp_qf', 'pmlp']);

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
  'expires_at',
  'link_label',
  'link_url',
  'message',
  'metadata',
  'pinned',
  'priority',
  'program_keys',
  'source_id',
  'source_key',
  'source_type',
  'start_date',
  'status',
  'student_emails',
  'system_generated',
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
  '/admins/certificate-review-items': {
    table: 'certificate_review_items',
    filterColumns: { certificateType: 'certificate_type', programKey: 'program_key', status: 'review_status' },
    searchColumns: ['student_email', 'student_name', 'program_name', 'cohort_name', 'reason'],
    sortColumns: { newest: { column: 'updated_at', ascending: false } }
  },
  '/admins/certificates': {
    table: 'certificates',
    filterColumns: { certificateType: 'certificate_type', generationStatus: 'generation_status', programKey: 'program_key', status: 'status' },
    searchColumns: ['student_email', 'student_name', 'program_name', 'project_title']
  },
  '/admins/career-readiness-content': {
    table: 'career_readiness_content',
    filterColumns: { category: 'category', published: 'is_published' },
    filterValues: { published: (value) => (value === 'published' ? true : value === 'draft' ? false : undefined) },
    searchColumns: ['title', 'description', 'content', 'category'],
    sortColumns: { order: { column: 'sort_order', ascending: true }, updated: { column: 'updated_at', ascending: false } }
  },
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
  '/admins/whatsapp-categories': {
    table: 'whatsapp_message_categories',
    filterColumns: { status: 'status' },
    searchColumns: ['name'],
    sortColumns: { order: { column: 'sort_order', ascending: true }, updated: { column: 'updated_at', ascending: false } }
  },
  '/admins/whatsapp-groups': {
    table: 'whatsapp_groups',
    filterColumns: { cohortName: 'cohort_name', status: 'status' },
    searchColumns: ['group_name', 'cohort_name', 'program_name', 'notes'],
    sortColumns: { cohort: { column: 'cohort_name', ascending: true }, group: { column: 'group_name', ascending: true }, updated: { column: 'updated_at', ascending: false } }
  },
  '/admins/whatsapp-logs': {
    table: 'whatsapp_message_logs',
    filterColumns: { categoryId: 'category_id', groupId: 'group_id', status: 'status' },
    searchColumns: ['group_name', 'cohort_name', 'program_name', 'message_title', 'message_body', 'sent_by'],
    sortColumns: { newest: { column: 'sent_at', ascending: false } }
  },
  '/admins/whatsapp-templates': {
    table: 'whatsapp_message_templates',
    filterColumns: { categoryId: 'category_id', status: 'status' },
    searchColumns: ['title', 'message_body', 'notes'],
    sortColumns: { title: { column: 'title', ascending: true }, updated: { column: 'updated_at', ascending: false } }
  },
  '/admins/paid-access': { table: 'paid_access', searchColumns: ['student_email', 'item_id', 'item_type'] },
  '/admins/payment-orders': { table: 'payment_orders', searchColumns: ['student_email', 'item_id', 'item_type', 'razorpay_order_id'] },
  '/admins/programs': { table: 'programs', filterColumns: { domain: 'domain_label' }, searchColumns: ['program_key', 'name', 'short_name', 'domain_label'] },
  '/admins/student-guidance-content': {
    table: 'student_guidance_content',
    filterColumns: { status: 'status' },
    searchColumns: ['content_key', 'title', 'summary'],
    sortColumns: { order: { column: 'sort_order', ascending: true }, updated: { column: 'updated_at', ascending: false } }
  },
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
    filterColumns: { resourceDomainKey: 'resource_domain_key' },
    searchColumns: ['title', 'resource_type', 'resource_mode', 'domain_key', 'resource_domain_key'],
    sortColumns: { newest: { column: 'updated_at', ascending: false }, title: { column: 'title', ascending: true } }
  },
  '/admins/resource-domains': {
    table: 'resource_domains',
    filterColumns: { status: 'status' },
    searchColumns: ['label', 'domain_key', 'description'],
    sortColumns: { order: { column: 'sort_order', ascending: true }, label: { column: 'label', ascending: true } }
  },
  '/admins/students': {
    table: 'students',
    filterColumns: { status: 'active' },
    filterValues: { status: (value) => (value === 'active' ? true : value === 'inactive' ? false : undefined) },
    searchColumns: ['full_name', 'email', 'alt_email', 'phone', 'student_id', 'college_name', 'cohort_name', 'program_name', 'wa_group_name', 'you_are_from', 'duration'],
    sortColumns: {
      access: { column: 'program_name', ascending: true },
      actions: { column: 'id', ascending: true },
      auth: { column: 'onboarding_mail_status', ascending: true },
      duration: { column: 'duration', ascending: true },
      education: { column: 'you_are_from', ascending: true },
      mentor: { column: 'personalmentor', ascending: true },
      newest: { column: 'created_at', ascending: false },
      onboarding: { column: 'project_start_date', ascending: true },
      role: { column: 'live_project_role_ids', ascending: true },
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
  resource_domains: {
    columns: RESOURCE_DOMAIN_WRITE_COLUMNS,
    normalizeBody: normalizeResourceDomainWriteBody,
    table: 'resource_domains',
    validateBody: validateResourceDomainWriteBody
  },
  programs: {
    columns: PROGRAM_WRITE_COLUMNS,
    normalizeBody: normalizeProgramWriteBody,
    table: 'programs',
    validateBody: validateProgramWriteBody
  },
  student_guidance_content: {
    columns: STUDENT_GUIDANCE_CONTENT_WRITE_COLUMNS,
    normalizeBody: normalizeStudentGuidanceContentWriteBody,
    table: 'student_guidance_content',
    validateBody: validateStudentGuidanceContentWriteBody
  },
  career_readiness_content: {
    columns: CAREER_READINESS_CONTENT_WRITE_COLUMNS,
    normalizeBody: normalizeCareerReadinessContentWriteBody,
    table: 'career_readiness_content',
    validateBody: validateCareerReadinessContentWriteBody
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
  },
  whatsapp_groups: {
    columns: WHATSAPP_GROUP_WRITE_COLUMNS,
    normalizeBody: normalizeWhatsAppGroupWriteBody,
    table: 'whatsapp_groups',
    validateBody: validateWhatsAppGroupWriteBody
  },
  whatsapp_message_categories: {
    columns: WHATSAPP_CATEGORY_WRITE_COLUMNS,
    normalizeBody: normalizeWhatsAppCategoryWriteBody,
    table: 'whatsapp_message_categories',
    validateBody: validateWhatsAppCategoryWriteBody
  },
  whatsapp_message_logs: {
    columns: WHATSAPP_LOG_WRITE_COLUMNS,
    normalizeBody: normalizeWhatsAppLogWriteBody,
    table: 'whatsapp_message_logs',
    validateBody: validateWhatsAppLogWriteBody
  },
  whatsapp_message_templates: {
    columns: WHATSAPP_TEMPLATE_WRITE_COLUMNS,
    normalizeBody: normalizeWhatsAppTemplateWriteBody,
    table: 'whatsapp_message_templates',
    validateBody: validateWhatsAppTemplateWriteBody
  }
};

export async function apiGet<TResponse>(path: string, options: ApiClientOptions = {}): Promise<TResponse> {
  const cleanPath = stripQuery(path);
  if (cleanPath === '/public/feature-controls/guest-login') return getPublicGuestLoginFeatureControl() as Promise<TResponse>;
  if (cleanPath === '/public/feature-controls/login-create-password') return getPublicLoginCreatePasswordFeatureControl() as Promise<TResponse>;
  if (cleanPath === '/public/feature-controls/whatsapp-widget') return getPublicWhatsAppWidgetFeatureControl() as Promise<TResponse>;

  const context = await createContext(options.accessToken);

  if (cleanPath === '/students/me') return getStudentProfile(context) as Promise<TResponse>;
  if (cleanPath === '/admins/me') return getAdminProfile(context) as Promise<TResponse>;
  if (cleanPath === '/guests/me') return getGuestProfile(context) as Promise<TResponse>;
  if (cleanPath === '/guests/programs') return getGuestProgramCatalogue(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/guests/resources') return getGuestResources(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/guests/career-readiness') return getGuestCareerReadiness(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/guests/schedule') return getGuestWorkshops(context, options.query, 'schedule') as Promise<TResponse>;
  if (cleanPath === '/guests/recordings') return getGuestWorkshops(context, options.query, 'recordings') as Promise<TResponse>;
  const readPermission = getAdminReadPermission(cleanPath);
  if (readPermission) await requireAdminPermission(context, readPermission);
  if (cleanPath === '/students/me/dashboard') return getStudentDashboard(context) as Promise<TResponse>;
  if (cleanPath === '/admins/dashboard') return getAdminDashboard(context) as Promise<TResponse>;
  if (cleanPath === '/admins/observability') return getAdminObservability(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/student-audit-logs') return getStudentAuditLogs(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/certificate-requests') return getLiveProjectCertificateRequests(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/announcements/recipient-count') return getAnnouncementRecipientCount(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/student-roster-snapshots') return getStudentRosterSnapshots(context) as Promise<TResponse>;
  if (cleanPath === '/support/categories') return getSupportCategories(context, options.query, false) as Promise<TResponse>;
  if (cleanPath === '/students/me/support-settings') return getSupportContactSettings(context, false) as Promise<TResponse>;
  if (cleanPath === '/students/me/support-faqs') return getStudentSupportFaqs(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/support-categories') return getSupportCategories(context, options.query, true) as Promise<TResponse>;
  if (cleanPath === '/admins/support-faqs') return getAdminSupportFaqs(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/admins/support-settings') return getSupportContactSettings(context, true) as Promise<TResponse>;

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

  if (cleanPath === '/students/me/recording-progress') {
    return getStudentRecordingProgress(context, options.query) as Promise<TResponse>;
  }

  if (cleanPath === '/students/me/guidance-content') return getStudentGuidanceContent(context, options.query) as Promise<TResponse>;

  if (cleanPath === '/students/me/career-readiness') return getStudentCareerReadinessContent(context, options.query) as Promise<TResponse>;

  if (cleanPath === '/students/me/project-toolkit') return getStudentProjectToolkit(context, options.query) as Promise<TResponse>;

  if (cleanPath === '/students/me/resources') return getStudentResourcesList(context, options.query) as Promise<TResponse>;
  if (cleanPath === '/students/me/resource-domains') return getStudentResourceDomainOptions(context, options.query) as Promise<TResponse>;

  if (cleanPath === '/admins/students/college-options') return getAdminStudentCollegeOptions(context) as Promise<TResponse>;

  if (cleanPath === '/admins/students') return getAdminStudentsList(context, options.query) as Promise<TResponse>;

  if (cleanPath === '/admins/project-submissions') return getAdminProjectSubmissionsList(context, options.query) as Promise<TResponse>;

  if (cleanPath === '/admins/guest-leads') return getAdminGuestLeadsList(context, options.query) as Promise<TResponse>;

  const adminGuestLeadDetail = cleanPath.match(/^\/admins\/guest-leads\/([^/]+)$/);
  if (adminGuestLeadDetail) return getAdminGuestLeadDetail(context, decodeURIComponent(adminGuestLeadDetail[1])) as Promise<TResponse>;

  if (RPC_LIST_ENDPOINTS[cleanPath]) {
    return getRpcList(context, RPC_LIST_ENDPOINTS[cleanPath], options.query) as Promise<TResponse>;
  }

  if (TABLE_ENDPOINTS[cleanPath]) {
    return getTableList(context, TABLE_ENDPOINTS[cleanPath], options.query) as Promise<TResponse>;
  }

  throw new ApiClientError(`Unsupported Supabase route: ${cleanPath}`, 404);
}

async function getPublicGuestLoginFeatureControl() {
  return getPublicFeatureControl('guest-login', getDefaultGuestLoginFeatureControl);
}

async function getPublicLoginCreatePasswordFeatureControl() {
  return getPublicFeatureControl('login-create-password', getDefaultLoginCreatePasswordFeatureControl);
}

async function getPublicWhatsAppWidgetFeatureControl() {
  return getPublicFeatureControl('whatsapp-widget', getDefaultWhatsAppWidgetFeatureControl);
}

async function getPublicFeatureControl(moduleId: string, getDefaultFeatureControl: () => unknown) {
  const supabase = getSupabaseClient();
  if (!supabase) return getDefaultFeatureControl();
  const { data, error } = await supabase
    .from('feature_controls')
    .select('id,module_id,student_label,student_path,status,upcoming_message,is_core,sort_order,settings,created_at,updated_at,updated_by')
    .eq('module_id', moduleId)
    .maybeSingle();

  if (error) throw new ApiClientError(error.message, 503);
  if (!data) return getDefaultFeatureControl();

  return camelize(data);
}

function getDefaultGuestLoginFeatureControl() {
  return camelize({
    id: 'guest-login-default',
    is_core: false,
    module_id: 'guest-login',
    settings: {},
    sort_order: 140,
    status: 'show',
    student_label: 'Guest Login Entry',
    student_path: '/guest-signup',
    upcoming_message: 'Guest access is currently unavailable.'
  });
}

function getDefaultLoginCreatePasswordFeatureControl() {
  return camelize({
    id: 'login-create-password-default',
    is_core: false,
    module_id: 'login-create-password',
    settings: {},
    sort_order: 150,
    status: 'show',
    student_label: 'Create Password CTA',
    student_path: '/login?portal=student',
    upcoming_message: 'Create password is currently unavailable.'
  });
}

function getDefaultWhatsAppWidgetFeatureControl() {
  return camelize({
    id: 'whatsapp-widget-default',
    is_core: false,
    module_id: 'whatsapp-widget',
    settings: {},
    sort_order: 160,
    status: 'hide',
    student_label: 'Contact Program Coordinator',
    student_path: '/student',
    upcoming_message: 'Contact Program Coordinator'
  });
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

  const guestLeadStatus = cleanPath.match(/^\/admins\/guest-leads\/([^/]+)\/status$/);
  if (guestLeadStatus) return updateGuestLeadStatus(context, decodeURIComponent(guestLeadStatus[1]), options.body) as Promise<TResponse>;

  const guestLeadAccess = cleanPath.match(/^\/admins\/guest-leads\/([^/]+)\/access$/);
  if (guestLeadAccess) return updateGuestLeadAccess(context, decodeURIComponent(guestLeadAccess[1]), options.body) as Promise<TResponse>;

  const projectSubmissionReview = cleanPath.match(/^\/admins\/project-submissions\/([^/]+)\/(approve|reject|changes-requested)$/);
  if (projectSubmissionReview) return reviewProjectSubmission(context, decodeURIComponent(projectSubmissionReview[1]), projectSubmissionReview[2], options.body) as Promise<TResponse>;

  const certificateRevoke = cleanPath.match(/^\/admins\/certificates\/([^/]+)\/revoke$/);
  if (certificateRevoke) return revokeCertificate(context, decodeURIComponent(certificateRevoke[1]), options.body) as Promise<TResponse>;

  const certificateReviewResolve = cleanPath.match(/^\/admins\/certificate-review-items\/([^/]+)\/resolve$/);
  if (certificateReviewResolve) return resolveCertificateReviewItem(context, decodeURIComponent(certificateReviewResolve[1]), options.body) as Promise<TResponse>;

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

  const resourceDomainUpdate = cleanPath.match(/^\/admins\/resource-domains\/([^/]+)$/);
  if (resourceDomainUpdate) return updateById(context, 'resource_domains', decodeURIComponent(resourceDomainUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  const careerReadinessStatus = cleanPath.match(/^\/admins\/career-readiness-content\/([^/]+)\/status$/);
  if (careerReadinessStatus) {
    return updateById(
      context,
      'career_readiness_content',
      decodeURIComponent(careerReadinessStatus[1]),
      { ...(isRecord(options.body) ? options.body : {}), updatedBy: context.email },
      'status_changed'
    ) as Promise<TResponse>;
  }

  const careerReadinessUpdate = cleanPath.match(/^\/admins\/career-readiness-content\/([^/]+)$/);
  if (careerReadinessUpdate) {
    return updateById(
      context,
      'career_readiness_content',
      decodeURIComponent(careerReadinessUpdate[1]),
      { ...(isRecord(options.body) ? options.body : {}), updatedBy: context.email },
      'updated'
    ) as Promise<TResponse>;
  }

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

  const whatsAppGroup = cleanPath.match(/^\/admins\/whatsapp-groups\/([^/]+)$/);
  if (whatsAppGroup) return updateById(context, 'whatsapp_groups', decodeURIComponent(whatsAppGroup[1]), { ...(isRecord(options.body) ? options.body : {}), updatedBy: context.email }, 'updated') as Promise<TResponse>;

  const whatsAppCategory = cleanPath.match(/^\/admins\/whatsapp-categories\/([^/]+)$/);
  if (whatsAppCategory) return updateById(context, 'whatsapp_message_categories', decodeURIComponent(whatsAppCategory[1]), { ...(isRecord(options.body) ? options.body : {}), updatedBy: context.email }, 'updated') as Promise<TResponse>;

  const whatsAppTemplate = cleanPath.match(/^\/admins\/whatsapp-templates\/([^/]+)$/);
  if (whatsAppTemplate) return updateById(context, 'whatsapp_message_templates', decodeURIComponent(whatsAppTemplate[1]), { ...(isRecord(options.body) ? options.body : {}), updatedBy: context.email }, 'updated') as Promise<TResponse>;

  const whatsAppLog = cleanPath.match(/^\/admins\/whatsapp-logs\/([^/]+)$/);
  if (whatsAppLog) return updateById(context, 'whatsapp_message_logs', decodeURIComponent(whatsAppLog[1]), options.body, 'updated') as Promise<TResponse>;

  const emailTemplateUpdate = cleanPath.match(/^\/admins\/email-templates\/([^/]+)$/);
  if (emailTemplateUpdate) {
    return updateById(context, 'email_templates', decodeURIComponent(emailTemplateUpdate[1]), options.body, 'updated') as Promise<TResponse>;
  }

  const programStatus = cleanPath.match(/^\/admins\/programs\/([^/]+)\/status$/);
  if (programStatus) return updateById(context, 'programs', decodeURIComponent(programStatus[1]), options.body, 'status_changed') as Promise<TResponse>;

  const programUpdate = cleanPath.match(/^\/admins\/programs\/([^/]+)$/);
  if (programUpdate) return updateById(context, 'programs', decodeURIComponent(programUpdate[1]), options.body, 'updated') as Promise<TResponse>;

  const studentGuidanceContentUpdate = cleanPath.match(/^\/admins\/student-guidance-content\/([^/]+)$/);
  if (studentGuidanceContentUpdate) return updateById(context, 'student_guidance_content', decodeURIComponent(studentGuidanceContentUpdate[1]), options.body, 'updated') as Promise<TResponse>;

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

  if (cleanPath === '/admins/support-settings/student-contact') return updateSupportContactSettings(context, options.body) as Promise<TResponse>;

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
  if (cleanPath === '/admins/student-roster-snapshots') return createStudentRosterSnapshot(context) as Promise<TResponse>;
  const studentRosterRestore = cleanPath.match(/^\/admins\/student-roster-snapshots\/([^/]+)\/restore$/);
  if (studentRosterRestore) return restoreStudentRosterSnapshot(context, decodeURIComponent(studentRosterRestore[1]), options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/students') return insertRow(context, 'students', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/cohorts') return insertRow(context, 'cohorts', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/workshops') return insertRow(context, 'workshops', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/resources') return insertRow(context, 'resources', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/resource-domains') return insertRow(context, 'resource_domains', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/career-readiness-content') {
    return insertRow(
      context,
      'career_readiness_content',
      {
        ...(isRecord(options.body) ? options.body : {}),
        createdBy: context.email,
        updatedBy: context.email
      },
      'created'
    ) as Promise<TResponse>;
  }
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
  if (cleanPath === '/admins/whatsapp-groups') return insertRow(context, 'whatsapp_groups', { ...(isRecord(options.body) ? options.body : {}), createdBy: context.email, updatedBy: context.email }, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/whatsapp-categories') return insertRow(context, 'whatsapp_message_categories', { ...(isRecord(options.body) ? options.body : {}), createdBy: context.email, updatedBy: context.email }, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/whatsapp-templates') return insertRow(context, 'whatsapp_message_templates', { ...(isRecord(options.body) ? options.body : {}), createdBy: context.email, updatedBy: context.email }, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/whatsapp-logs') return insertRow(context, 'whatsapp_message_logs', { ...(isRecord(options.body) ? options.body : {}), sentBy: context.email }, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/programs') return insertRow(context, 'programs', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/project-roles') return insertRow(context, 'role_master', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/project-toolkit') return insertRow(context, 'project_toolkit_items', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/recording-sequences') return insertRow(context, 'recording_sequence_rules', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/projects') return insertRow(context, 'projects', options.body, 'created') as Promise<TResponse>;
  if (cleanPath === '/admins/certificate-program-settings') return saveCertificateProgramSetting(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/certificates/leadership') return issueLeadershipCertificates(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/certificates/live-project/bulk') return bulkIssueLiveProjectCertificates(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/certificates/live-project') return issueLiveProjectCertificate(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/certificates/manual') return issueManualCertificate(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/students/me/presence') return updateStudentPresence(context) as Promise<TResponse>;
  const studentRecordingProgress = cleanPath.match(/^\/students\/me\/recordings\/([^/]+)\/progress$/);
  if (studentRecordingProgress) return markStudentRecordingComplete(context, decodeURIComponent(studentRecordingProgress[1])) as Promise<TResponse>;
  if (cleanPath === '/students/me/project-submissions') return submitStudentProjectReport(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/students/me/support-tickets') return createStudentSupportTicket(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/support-categories') return createSupportCategory(context, options.body) as Promise<TResponse>;
  if (cleanPath === '/admins/support-faqs') return createSupportFaq(context, options.body) as Promise<TResponse>;

  const adminGuestLeadNote = cleanPath.match(/^\/admins\/guest-leads\/([^/]+)\/notes$/);
  if (adminGuestLeadNote) return createGuestLeadNote(context, decodeURIComponent(adminGuestLeadNote[1]), options.body) as Promise<TResponse>;

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
  const { data, error, response } = await context.supabase.functions.invoke(functionName, {
    body: options.body as Record<string, unknown> | undefined
  });

  if (error) {
    const message = await getFunctionErrorMessage(data, error, response);
    throw new ApiClientError(message, 503);
  }
  if (isRecord(data) && typeof data.error === 'string') throw new ApiClientError(data.error, 400);
  return data as TResponse;
}

async function getFunctionErrorMessage(data: unknown, error: unknown, response?: unknown) {
  if (isRecord(data)) {
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  }
  const context = response || (isRecord(error) ? error.context : undefined);
  if (isFunctionErrorResponse(context)) {
    try {
      const payload = await context.clone().json();
      if (isRecord(payload)) {
        if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
        if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
      }
    } catch (_jsonError) {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch (_textError) {
        // Fall through to the Supabase client error message.
      }
    }
  }
  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) return error.message.trim();
  return 'Request could not be completed. Please try again.';
}

function isFunctionErrorResponse(value: unknown): value is Response {
  return Boolean(value && typeof value === 'object' && 'clone' in value && typeof (value as { clone?: unknown }).clone === 'function' && 'json' in value && typeof (value as { json?: unknown }).json === 'function');
}

function getAdminReadPermission(path: string): AdminPermission | undefined {
  if (!path.startsWith('/admins/')) return undefined;
  if (path === '/admins/recordings/resources-summary') return 'admin.recordings.view';
  if (path.match(/^\/admins\/recordings\/[^/]+\/resources$/)) return 'admin.recordings.view';
  if (path.match(/^\/admins\/students\/[^/]+\/lp-attempts$/)) return 'admin.students.view';
  if (path.match(/^\/admins\/students\/[^/]+\/access-preview$/)) return 'admin.students.view';
  if (path.match(/^\/admins\/students\/[^/]+\/preview$/)) return 'admin.students.view';
  if (path === '/admins/guest-leads' || path.match(/^\/admins\/guest-leads\/[^/]+$/)) return 'admin.students.view';
  if (path.match(/^\/admins\/support-tickets\/[^/]+$/)) return 'admin.support.view';
  if (path.match(/^\/admins\/enrollment-requests\/[^/]+$/)) return 'admin.enrollments.view';
  return ADMIN_READ_PERMISSIONS_BY_PATH[path];
}

function getAdminWritePermission(path: string, method: 'delete' | 'patch' | 'post'): AdminPermission | undefined {
  if (!path.startsWith('/admins/')) return undefined;

  if (path === '/admins/students/import' || path === '/admins/students/bulk') return 'admin.students.import';
  if (path === '/admins/student-roster-snapshots' || path.match(/^\/admins\/student-roster-snapshots\/[^/]+\/restore$/)) return 'admin.students.manage';
  if (path === '/admins/students/resend-invites') return 'admin.students.invite';
  if (path === '/admins/students') return 'admin.students.manage';
  if (path.match(/^\/admins\/students\/[^/]+\/lp-attempts$/)) return 'admin.students.manage';
  if (path.match(/^\/admins\/students\/[^/]+/)) return 'admin.students.manage';
  if (path.match(/^\/admins\/guest-leads\/[^/]+\/(status|access|notes)$/)) return 'admin.students.manage';

  if (path === '/admins/cohorts' || path.match(/^\/admins\/cohorts\/[^/]+/)) return 'admin.cohorts.manage';
  if (path === '/admins/programs' || path.match(/^\/admins\/programs\/[^/]+/)) return 'admin.programs.manage';
  if (path === '/admins/student-guidance-content' || path.match(/^\/admins\/student-guidance-content\/[^/]+/)) return 'admin.programs.manage';
  if (path === '/admins/career-readiness-content' || path.match(/^\/admins\/career-readiness-content\/[^/]+/)) return 'admin.resources.manage';
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
  if (path === '/admins/resource-domains' || path.match(/^\/admins\/resource-domains\/[^/]+/)) return 'admin.resources.manage';
  if (path === '/admins/resources' || path.match(/^\/admins\/resources\/[^/]+/)) return 'admin.resources.manage';
  if (path === '/admins/announcements' || path.match(/^\/admins\/announcements\/[^/]+/)) return 'admin.announcements.manage';
  if (path === '/admins/email-templates' || path.match(/^\/admins\/email-templates\/[^/]+/)) return 'admin.email.manage';
  if (path === '/admins/whatsapp-groups' || path.match(/^\/admins\/whatsapp-groups\/[^/]+/)) return 'admin.community.manage';
  if (path === '/admins/whatsapp-categories' || path.match(/^\/admins\/whatsapp-categories\/[^/]+/)) return 'admin.community.manage';
  if (path === '/admins/whatsapp-templates' || path.match(/^\/admins\/whatsapp-templates\/[^/]+/)) return 'admin.community.manage';
  if (path === '/admins/whatsapp-logs' || path.match(/^\/admins\/whatsapp-logs\/[^/]+/)) return 'admin.community.manage';
  if (path === '/admins/feature-controls' || path.match(/^\/admins\/feature-controls\/[^/]+/)) return 'admin.feature_control.manage';
  if (path === '/admins/certificate-program-settings' || path === '/admins/certificate-review-items' || path.match(/^\/admins\/certificate-review-items\/[^/]+/) || path === '/admins/certificates/leadership' || path === '/admins/certificates/live-project' || path === '/admins/certificates/live-project/bulk' || path === '/admins/certificates/manual') return 'admin.certificates.issue';
  if (path.match(/^\/admins\/certificates\/[^/]+\/revoke$/)) return 'admin.certificates.issue';
  if (path === '/admins/support-categories' || path === '/admins/support-faqs' || path === '/admins/support-settings/student-contact') return 'admin.support.manage';
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
  return { accessToken, email, emailVerifiedAt: data.user.email_confirmed_at ?? null, supabase, userId: data.user.id };
}

async function getStudentProfile(context: Awaited<ReturnType<typeof createContext>>) {
  const { data, error } = await context.supabase
    .from('students')
    .select('*')
    .or(`auth_user_id.eq.${context.userId},email.eq.${context.email},alt_email.eq.${context.email}`)
    .limit(2);

  if (error) throw new ApiClientError(error.message, 503);

  const row = chooseIdentityRow(data, context);
  if (!row) throw new ApiClientError('No student profile is linked to this Supabase user.', 404);
  if (row.active === false) throw new ApiClientError('Student profile is inactive.', 403);
  if (!row.auth_user_id && row.id && [row.email, row.alt_email].some((email) => normalizeEmail(email) === context.email)) {
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

async function getGuestProfile(context: Awaited<ReturnType<typeof createContext>>) {
  const { data, error } = await context.supabase
    .from('guest_leads')
    .select('*')
    .or(`auth_user_id.eq.${context.userId},personal_email.eq.${context.email}`)
    .limit(2);

  if (error) throw new ApiClientError(error.message, 503);

  const row = chooseGuestIdentityRow(data, context);
  if (!row) throw new ApiClientError('No guest profile is linked to this Supabase user.', 404);
  if (row.deactivated_at) throw new ApiClientError('Guest access is inactive.', 403);
  if (!context.emailVerifiedAt && !row.email_verified_at) throw new ApiClientError('Verify your email before opening guest access.', 403);

  return camelize({
    ...row,
    access_label: 'Free Access'
  });
}

async function getGuestProgramCatalogue(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query'] = {}) {
  await getGuestProfile(context);

  const search = String(query?.search ?? '').trim();
  let request = context.supabase
    .from('programs')
    .select(
      'id,program_key,name,short_name,domain_label,status,guest_catalogue_enabled,catalogue_badge,thumbnail_url,banner_url,short_description,overview,who_should_join,what_you_will_learn,live_project_details,tools_covered,career_outcomes,duration,schedule_format,mentor_support,certificate_details,pricing,next_batch_date,highlights,curriculum,outcomes,faqs,cta_buttons,created_at,updated_at',
      { count: 'exact' }
    )
    .eq('status', 'active')
    .eq('guest_catalogue_enabled', true)
    .order('name', { ascending: true })
    .limit(100);

  if (search) {
    const escaped = search.replace(/[%(),]/g, '');
    request = request.or(`program_key.ilike.%${escaped}%,name.ilike.%${escaped}%,short_name.ilike.%${escaped}%,domain_label.ilike.%${escaped}%`);
  }

  const { count, data, error } = await request;
  if (error) throw new ApiClientError(error.message, 503);

  const items = (data ?? []).map((program) =>
    camelize({
      ...program,
      cta_label: 'Request Access',
      overview: program.overview,
      pricing_note: program.pricing || ''
    })
  );

  return {
    hasNextPage: false,
    items,
    page: 1,
    pageSize: 100,
    total: count ?? items.length,
    totalPages: 1
  };
}

async function getGuestResources(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query'] = {}) {
  await getGuestProfile(context);
  const page = Math.max(1, Number(query?.page ?? 1));
  const limit = Math.min(Math.max(1, Number(query?.limit ?? 25)), 100);
  const search = String(query?.search ?? '').trim();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = context.supabase
    .from('resources')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .eq('guest_access_enabled', true)
    .or(`guest_access_expires_at.is.null,guest_access_expires_at.gte.${new Date().toISOString()}`)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (search) {
    const escaped = search.replace(/[%(),]/g, '');
    request = request.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,resource_type.ilike.%${escaped}%,resource_mode.ilike.%${escaped}%`);
  }

  const { count, data, error } = await request;
  if (error) throw new ApiClientError(error.message, 503);
  return createPaginatedResponse((data ?? []).map(enrichRow).map(camelize), count ?? 0, page, limit);
}

async function getGuestCareerReadiness(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query'] = {}) {
  await getGuestProfile(context);
  const page = Math.max(1, Number(query?.page ?? 1));
  const limit = Math.min(Math.max(1, Number(query?.limit ?? 25)), 100);
  const search = String(query?.search ?? '').trim();
  const category = String(query?.category ?? '').trim();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = context.supabase
    .from('career_readiness_content')
    .select('*', { count: 'exact' })
    .eq('is_published', true)
    .eq('guest_access_enabled', true)
    .or(`guest_access_expires_at.is.null,guest_access_expires_at.gte.${new Date().toISOString()}`)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (category && category !== 'all') request = request.eq('category', category);
  if (search) {
    const escaped = search.replace(/[%(),]/g, '');
    request = request.or(`title.ilike.%${escaped}%,section_title.ilike.%${escaped}%,description.ilike.%${escaped}%,content.ilike.%${escaped}%`);
  }

  const { count, data, error } = await request;
  if (error) throw new ApiClientError(error.message, 503);
  return createPaginatedResponse((data ?? []).map(camelize), count ?? 0, page, limit);
}

async function getGuestWorkshops(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query'] = {}, mode: 'recordings' | 'schedule') {
  await getGuestProfile(context);
  const page = Math.max(1, Number(query?.page ?? 1));
  const limit = Math.min(Math.max(1, Number(query?.limit ?? 25)), 100);
  const search = String(query?.search ?? '').trim();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let request = context.supabase
    .from('workshops')
    .select('*', { count: 'exact' })
    .eq('guest_access_enabled', true)
    .or(`guest_access_expires_at.is.null,guest_access_expires_at.gte.${new Date().toISOString()}`)
    .order('date', { ascending: mode === 'schedule' })
    .order('time', { ascending: true })
    .range(from, to);

  if (mode === 'recordings') {
    request = request.eq('workshop_status', 'Completed').or('youtube_video_url.not.is.null,zoom_recording_url.not.is.null');
  } else {
    request = request.in('workshop_status', ['Upcoming', 'Scheduled', 'Live']).gte('date', new Date().toISOString().slice(0, 10));
  }

  if (search) {
    const escaped = search.replace(/[%(),]/g, '');
    request = request.or(`title.ilike.%${escaped}%,program_key.ilike.%${escaped}%,zoom_label.ilike.%${escaped}%`);
  }

  const { count, data, error } = await request;
  if (error) throw new ApiClientError(error.message, 503);
  return createPaginatedResponse((data ?? []).map(enrichRow).map(camelize), count ?? 0, page, limit);
}

async function getAdminGuestLeadsList(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query'] = {}) {
  const page = Math.max(1, Number(query?.page ?? 1));
  const limit = Math.min(Math.max(1, Number(query?.limit ?? 25)), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const search = String(query?.search ?? '').trim();
  const leadStatus = String(query?.leadStatus ?? 'all').trim();
  const audienceType = String(query?.audienceType ?? 'all').trim();
  const city = String(query?.city ?? '').trim();
  const interestedRole = String(query?.interestedRole ?? '').trim();
  const mentor = String(query?.mentor ?? '').trim();
  const sort = String(query?.sort ?? 'newest').trim();

  let request = context.supabase
    .from('guest_leads')
    .select('*', { count: 'exact' })
    .order(sort === 'last_active' ? 'last_active_at' : 'created_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  if (leadStatus && leadStatus !== 'all') request = request.eq('lead_status', leadStatus);
  if (audienceType && audienceType !== 'all') request = request.eq('audience_type', audienceType);
  if (city) request = request.ilike('current_city', `%${city.replace(/[%(),]/g, '')}%`);
  if (mentor) request = request.eq('mentor_allocation_interest', mentor);
  if (interestedRole) request = request.contains('interested_roles', [interestedRole]);
  if (search) {
    const escaped = search.replace(/[%(),]/g, '');
    request = request.or(`full_name.ilike.%${escaped}%,personal_email.ilike.%${escaped}%,official_email.ilike.%${escaped}%,whatsapp_number.ilike.%${escaped}%,college_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,current_city.ilike.%${escaped}%,interested_program.ilike.%${escaped}%`);
  }

  const { count, data, error } = await request;
  if (error) throw new ApiClientError(error.message, 503);
  return createPaginatedResponse((data ?? []).map(camelize), count ?? 0, page, limit);
}

async function getAdminGuestLeadDetail(context: Awaited<ReturnType<typeof createContext>>, guestLeadId: string) {
  const { data, error } = await context.supabase.from('guest_leads').select('*').eq('id', guestLeadId).single();
  if (error) throw new ApiClientError(error.message, 503);

  const notes = await context.supabase
    .from('guest_lead_notes')
    .select('*')
    .eq('guest_lead_id', guestLeadId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (notes.error) throw new ApiClientError(notes.error.message, 503);

  return camelize({
    ...data,
    notes: notes.data ?? []
  });
}

async function updateGuestLeadStatus(context: Awaited<ReturnType<typeof createContext>>, guestLeadId: string, body: unknown) {
  const allowedStatuses = new Set(['new', 'contacted', 'interested', 'converted', 'not_interested']);
  const leadStatus = isRecord(body) ? String(body.leadStatus ?? body.lead_status ?? '').trim() : '';
  if (!allowedStatuses.has(leadStatus)) throw new ApiClientError('Select a valid guest lead status.', 400);

  const { data, error } = await context.supabase
    .from('guest_leads')
    .update({ lead_status: leadStatus, updated_at: new Date().toISOString() })
    .eq('id', guestLeadId)
    .select('*')
    .single();
  if (error) throw new ApiClientError(error.message, 503);
  await writeAuditLog(context, 'guest_leads', 'status_changed', data, { lead_status: leadStatus });
  return camelize(data);
}

async function updateGuestLeadAccess(context: Awaited<ReturnType<typeof createContext>>, guestLeadId: string, body: unknown) {
  const active = isRecord(body) ? body.active === true : false;
  const payload = active
    ? { deactivated_at: null, deactivated_by: null, updated_at: new Date().toISOString() }
    : { deactivated_at: new Date().toISOString(), deactivated_by: context.email, updated_at: new Date().toISOString() };
  const { data, error } = await context.supabase.from('guest_leads').update(payload).eq('id', guestLeadId).select('*').single();
  if (error) throw new ApiClientError(error.message, 503);
  await writeAuditLog(context, 'guest_leads', active ? 'access_reactivated' : 'access_deactivated', data, payload);
  return camelize(data);
}

async function createGuestLeadNote(context: Awaited<ReturnType<typeof createContext>>, guestLeadId: string, body: unknown) {
  const note = isRecord(body) ? String(body.note ?? '').trim() : '';
  if (!note) throw new ApiClientError('Note is required.', 400);
  if (note.length > 2000) throw new ApiClientError('Note must be 2000 characters or fewer.', 400);

  const { data, error } = await context.supabase
    .from('guest_lead_notes')
    .insert({ created_by: context.email, guest_lead_id: guestLeadId, note })
    .select('*')
    .single();
  if (error) throw new ApiClientError(error.message, 503);
  await writeAuditLog(context, 'guest_leads', 'note_added', { id: guestLeadId }, { note: note.slice(0, 160) });
  return camelize(data);
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
  const [dashboard, resources, projects, certificates, guidanceContent] = await Promise.all([
    callRpc(context, 'student_dashboard_bundle', { p_student_email: context.email }),
    callRpc(context, 'student_resources_view', { p_student_email: context.email }),
    callRpc(context, 'student_projects_bundle', { p_student_email: context.email }),
    callRpc(context, 'student_certificates_bundle', { p_student_email: context.email }),
    getStudentGuidanceContent(context, { limit: 10, page: 1 }).catch(() => paginate([], { limit: 10, page: 1 }))
  ]);

  return { certificates, dashboard, guidanceContent, projects, resources, student };
}

async function getStudentGuidanceContent(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
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
  const linkedProgramRows = programError ? [] : (programRows ?? []);

  const programKeys = uniqueStrings([
    ...directProgramValues,
    ...linkedProgramRows.map((row) => String(row.program_key ?? ''))
  ].map((value) => slugifyKey(value)).filter(Boolean));
  const hasLeadershipProgram = programKeys.some((key) => LEADERSHIP_PROGRAM_KEYS.has(key)) || /leadership program/i.test(String((student as Record<string, unknown>).programName ?? ''));

  if (!hasLeadershipProgram) {
    return paginate([], query);
  }

  const { data, error } = await context.supabase
    .from('student_guidance_content')
    .select('*')
    .eq('status', 'active')
    .eq('audience', 'leadership')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })
    .limit(20);
  if (error) return paginate([], query);

  return paginate((data ?? []).map(enrichRow).map(camelize), query);
}

async function getStudentCareerReadinessContent(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const data = await callRpc(context, 'student_career_readiness_content', { p_student_email: context.email });
  const items = Array.isArray(data) ? data.map(enrichRow).map(camelize) : [];
  const category = String(query?.category ?? '').trim();
  const search = String(query?.search ?? '').trim().toLowerCase();
  const filtered = items
    .filter((item) => !category || (isRecord(item) && String(item.category ?? '') === category))
    .filter((item) => !search || JSON.stringify(item).toLowerCase().includes(search));
  return paginate(filtered, query);
}

async function enrichStudentCohortProgramNames(context: Awaited<ReturnType<typeof createContext>>, items: unknown[]) {
  const rows = items.map((item) => (isRecord(item) ? item : null));
  const programKeys = uniqueStrings(
    rows
      .map((row) => String(row?.program_key ?? row?.programKey ?? '').trim().toLowerCase())
      .filter(Boolean)
  );
  if (programKeys.length === 0) return items;

  const student = await getStudentProfile(context);
  const liveProjectRoleIds = asStringArray((student as Record<string, unknown>).liveProjectRoleIds);
  const [programResult, roleResult] = await Promise.all([
    context.supabase
      .from('programs')
      .select('program_key,name,short_name')
      .in('program_key', programKeys)
      .limit(500),
    liveProjectRoleIds.length > 0
      ? context.supabase
        .from('role_master')
        .select('role_id,role_name,program_key')
        .in('role_id', liveProjectRoleIds)
        .limit(500)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (programResult.error) throw new ApiClientError(`Student program names could not be loaded: ${programResult.error.message}`, 503);
  if (roleResult.error) throw new ApiClientError(`Student live project roles could not be loaded: ${roleResult.error.message}`, 503);

  const programNameByKey = new Map(
    (programResult.data ?? []).map((program) => [
      String(program.program_key ?? '').trim().toLowerCase(),
      String(program.name ?? program.short_name ?? program.program_key ?? '').trim()
    ])
  );
  const liveProjectRoles = (roleResult.data ?? [])
    .map((role) => ({
      id: String(role.role_id ?? '').trim(),
      name: String(role.role_name ?? role.role_id ?? '').trim(),
      programKey: String(role.program_key ?? '').trim().toLowerCase()
    }))
    .filter((role) => role.id && role.name);

  return items.map((item) => {
    if (!isRecord(item)) return item;
    const programKey = String(item.program_key ?? item.programKey ?? '').trim().toLowerCase();
    const programName = programNameByKey.get(programKey);
    const matchingRoles = liveProjectRoles.filter((role) => roleMatchesCohortProgram(role, programKey));
    const rolesForCohort = matchingRoles.length > 0 ? matchingRoles : liveProjectRoles.length === 1 ? liveProjectRoles : [];
    return {
      ...item,
      ...(programName ? { program_name: programName } : {}),
      live_project_role_ids: uniqueStrings(rolesForCohort.map((role) => role.id)),
      live_project_roles: uniqueStrings(rolesForCohort.map((role) => role.name))
    };
  });
}

function normalizeProgramMatchKey(value: string) {
  const key = value.trim().toLowerCase();
  if (key === 'flp_pvec') return 'flp_pevc';
  return key;
}

function inferredProgramKeysForRole(role: { id: string; name: string; programKey: string }) {
  const text = `${role.id} ${role.name} ${role.programKey}`.toLowerCase();
  const keys = new Set<string>();
  if (role.programKey) keys.add(normalizeProgramMatchKey(role.programKey));
  if (/private[_\s-]*equity|venture[_\s-]*capital|pevc|pvec/.test(text)) keys.add('flp_pevc');
  if (/equity[_\s-]*research|financial[_\s-]*model(l)?ing/.test(text)) keys.add('flp_er');
  if (/portfolio|quantitative|quant|qf/.test(text)) keys.add('flp_qf');
  if (/growth[_\s-]*strategy|business[_\s-]*(analyst|analysis)|consulting|management/.test(text)) {
    keys.add('mclp');
    keys.add('live_mgmt');
  }
  if (/digital[_\s-]*marketing|sales[_\s-]*marketing|market[_\s-]*research|product[_\s-]*marketing/.test(text)) {
    keys.add('smlp');
    keys.add('live_mgmt');
  }
  if (/product(?![_\s-]*marketing)|brand/.test(text)) keys.add('pmlp');
  if (/\bhr\b|human[_\s-]*resources/.test(text)) keys.add('hrlp');
  return keys;
}

function roleMatchesCohortProgram(role: { id: string; name: string; programKey: string }, programKey: string) {
  const normalizedProgramKey = normalizeProgramMatchKey(programKey);
  if (!normalizedProgramKey) return false;
  return inferredProgramKeysForRole(role).has(normalizedProgramKey);
}

function certificateProgramNameForLeadershipRole(role: { id: string; name: string; programKey: string }) {
  const text = `${role.id} ${role.name} ${role.programKey}`.toLowerCase();
  if (/digital[_\s-]*marketing/.test(text)) return 'Digital Marketing Specialist Leadership Program';
  if (/product[_\s-]*marketing/.test(text)) return 'Product Marketing Leadership Program';
  if (/market[_\s-]*research/.test(text)) return 'Market Research & Analytics Leadership Program';
  if (/sales[_\s-]*marketing/.test(text)) return 'Sales & Marketing Leadership Program';
  if (/growth[_\s-]*strategy/.test(text)) return 'Growth & Strategy Leadership Program';
  if (/business[_\s-]*(analyst|analysis)/.test(text)) return 'Business Analyst Leadership Program';
  if (/product.*brand|brand.*product/.test(text)) return 'Product & Brand Manager Leadership Program';
  if (/associate[_\s-]*product|product[_\s-]*manager/.test(text)) return 'Product Management Leadership Program';
  if (/equity[_\s-]*research|financial[_\s-]*model(l)?ing/.test(text)) return 'Equity Research Leadership Program';
  if (/private[_\s-]*equity|venture[_\s-]*capital|pevc|pvec/.test(text)) return 'Private Equity & Venture Capital Leadership Program';
  if (/portfolio|quantitative|quant|qf/.test(text)) return 'Quantitative Finance Leadership Program';
  if (/\bhr\b|human[_\s-]*resources/.test(text)) return 'HR Leadership Program';
  return role.name ? `${role.name} Leadership Program` : '';
}

function leadershipCertificateDuplicateKey(studentEmail: unknown, programKey: unknown, projectRole: unknown, programName: unknown) {
  return [
    normalizeEmail(studentEmail),
    normalizeProgramMatchKey(String(programKey ?? '')),
    slugifyKey(String(projectRole ?? '')),
    slugifyKey(String(programName ?? ''))
  ].join('|');
}

function leadershipCertificateReviewKey(studentId: unknown, studentEmail: unknown, programKey: unknown, cohortName: unknown, reasonCode: string) {
  const studentPart = String(studentId ?? '').trim() || normalizeEmail(studentEmail);
  return ['leadership', studentPart, normalizeProgramMatchKey(String(programKey ?? '')), slugifyKey(String(cohortName ?? '')), reasonCode].join('|');
}

async function upsertLeadershipCertificateReviewItem(
  context: Awaited<ReturnType<typeof createContext>>,
  input: {
    cohortName: string;
    liveProjectRoleIds: string[];
    programKey: string;
    programName: string;
    reason: string;
    reasonCode: string;
    studentEmail: string;
    studentId: string;
    studentName: string;
  }
) {
  const reviewKey = leadershipCertificateReviewKey(input.studentId, input.studentEmail, input.programKey, input.cohortName, input.reasonCode);
  const now = new Date().toISOString();
  const row = {
    certificate_type: 'leadership',
    cohort_name: input.cohortName,
    expected_action: 'Update the student live project leadership role mapping, then re-run leadership certificate issuance.',
    live_project_role_ids: input.liveProjectRoleIds,
    metadata: {
      source: 'leadership_certificate_issuance',
      suggestedAction: 'Add a role that maps to the selected cohort/program.'
    },
    program_key: input.programKey,
    program_name: input.programName,
    reason: input.reason,
    reason_code: input.reasonCode,
    review_key: reviewKey,
    review_status: 'pending',
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
    student_email: input.studentEmail,
    student_id: input.studentId || null,
    student_name: input.studentName,
    updated_at: now
  };

  const { error } = await context.supabase
    .from('certificate_review_items')
    .upsert(row, { onConflict: 'review_key' });
  if (error) throw new ApiClientError(`Certificate review item could not be saved: ${error.message}`, 503);
}

async function resolveLeadershipCertificateReviewItems(context: Awaited<ReturnType<typeof createContext>>, reviewKeys: string[], note: string) {
  const keys = uniqueStrings(reviewKeys);
  if (keys.length === 0) return;
  const { error } = await context.supabase
    .from('certificate_review_items')
    .update({
      resolution_note: note,
      resolved_at: new Date().toISOString(),
      resolved_by: context.email,
      review_status: 'resolved',
      updated_at: new Date().toISOString()
    })
    .in('review_key', keys)
    .eq('review_status', 'pending');
  if (error) throw new ApiClientError(`Certificate review items could not be resolved: ${error.message}`, 503);
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
    activeTwentyFourHours,
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
    safeCountRows(context, 'students', (request) => request.eq('active', true).gte('last_seen_at', twentyFourHoursAgo)),
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
      studentsLastTwentyFourHours: activeTwentyFourHours,
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
      studentsLastTwentyFourHours: 0,
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

async function getStudentRecordingProgress(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const student = (await getStudentProfile(context)) as Record<string, unknown>;
  const studentId = String(student.id ?? '').trim();
  if (!studentId) throw new ApiClientError('Student profile is unavailable.', 404);

  const requestedRecordingIds = uniqueStrings(splitCommaValues(query?.recordingIds ?? query?.recording_ids).slice(0, 500))
    .map((recordingId) => recordingId.trim())
    .filter(Boolean);
  const recordingIds = requestedRecordingIds.filter((recordingId) => UUID_VALUE_PATTERN.test(recordingId));

  if (requestedRecordingIds.length > 0 && recordingIds.length === 0) {
    return { items: [] };
  }

  let request = context.supabase
    .from('student_recording_progress')
    .select('recording_id,completed_at')
    .eq('student_id', studentId)
    .order('completed_at', { ascending: false })
    .limit(500);

  if (recordingIds.length > 0) {
    request = request.in('recording_id', recordingIds);
  }

  const { data, error } = await request;
  if (error) {
    if (isMissingSchemaError(error)) {
      return { items: [] };
    }
    throw new ApiClientError(error.message, 503);
  }

  return {
    items: (data ?? []).map((row) => ({
      completedAt: row.completed_at,
      recordingId: row.recording_id
    }))
  };
}

function isStudentRecordingCompletable(recording: unknown) {
  if (!isRecord(recording)) return false;
  const recordingUrl = String(recording.recordingUrl ?? recording.recording_url ?? '').trim();
  return Boolean(recordingUrl) && recording.locked !== true && recording.hasAccess !== false;
}

const UUID_VALUE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function studentRecordingIdentityValues(recording: Record<string, unknown>) {
  return uniqueStrings([
    recording.id,
    recording.workshopUuid,
    recording.workshop_uuid,
    recording.workshopId,
    recording.workshop_id
  ].map((value) => String(value ?? '').trim()).filter(Boolean));
}

function getStudentRecordingCanonicalId(recording: Record<string, unknown>, fallback: string) {
  const canonicalId = studentRecordingIdentityValues(recording).find((value) => UUID_VALUE_PATTERN.test(value));
  if (canonicalId) return canonicalId;
  if (UUID_VALUE_PATTERN.test(fallback)) return fallback;
  throw new ApiClientError('Recording cannot be marked complete because its workshop ID is unavailable.', 503);
}

async function ensureStudentCanCompleteRecording(context: Awaited<ReturnType<typeof createContext>>, recordingId: string) {
  const list = await getStudentRecordingsList(context, { limit: 500, page: 1 });
  const items = Array.isArray(list.items) ? list.items : [];
  const recording = items.find((item): item is Record<string, unknown> => isRecord(item) && studentRecordingIdentityValues(item).includes(recordingId));
  if (!recording) throw new ApiClientError('Recording is not visible to this student.', 404);
  if (!isStudentRecordingCompletable(recording)) throw new ApiClientError('Only accessible recordings can be marked complete.', 403);
  return recording;
}

async function markStudentRecordingComplete(context: Awaited<ReturnType<typeof createContext>>, recordingId: string) {
  const cleanRecordingId = recordingId.trim();
  if (!cleanRecordingId) throw new ApiClientError('Recording ID is required.', 400);

  const student = (await getStudentProfile(context)) as Record<string, unknown>;
  const studentId = String(student.id ?? '').trim();
  if (!studentId) throw new ApiClientError('Student profile is unavailable.', 404);
  const recording = await ensureStudentCanCompleteRecording(context, cleanRecordingId);
  const canonicalRecordingId = getStudentRecordingCanonicalId(recording, cleanRecordingId);

  const { data: existing, error: existingError } = await context.supabase
    .from('student_recording_progress')
    .select('recording_id,completed_at')
    .eq('student_id', studentId)
    .eq('recording_id', canonicalRecordingId)
    .maybeSingle();

  if (existingError) {
    if (isMissingSchemaError(existingError)) {
      throw new ApiClientError('Recording progress is not available yet.', 503);
    }
    throw new ApiClientError(existingError.message, 503);
  }

  if (existing) {
    return {
      completedAt: existing.completed_at,
      recordingId: existing.recording_id
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await context.supabase
    .from('student_recording_progress')
    .insert(
      {
        completed_at: now,
        recording_id: canonicalRecordingId,
        student_id: studentId,
        updated_at: now
      }
    )
    .select('recording_id,completed_at')
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      throw new ApiClientError('Recording progress is not available yet.', 503);
    }
    if (error.code === '23505') {
      const { data: completed, error: completedError } = await context.supabase
        .from('student_recording_progress')
        .select('recording_id,completed_at')
        .eq('student_id', studentId)
        .eq('recording_id', canonicalRecordingId)
        .single();
      if (!completedError && completed) {
        return {
          completedAt: completed.completed_at,
          recordingId: completed.recording_id
        };
      }
    }
    throw new ApiClientError(error.message, 503);
  }

  return {
    completedAt: data.completed_at,
    recordingId: data.recording_id
  };
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
  return rules
    .filter((rule) => programKeySet.has(String(rule.programKey ?? '').trim().toLowerCase()))
    .map((rule) => ({ rule, score: recordingSequenceRuleMatchScore(recording, rule) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftSequence = Number(left.rule.sequenceNumber ?? left.rule.sequence_number);
      const rightSequence = Number(right.rule.sequenceNumber ?? right.rule.sequence_number);
      if (Number.isFinite(leftSequence) && Number.isFinite(rightSequence) && leftSequence !== rightSequence) return leftSequence - rightSequence;
      return String(left.rule.title ?? '').localeCompare(String(right.rule.title ?? ''));
    })[0]?.rule;
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

function recordingSequenceRuleMatchScore(recording: Record<string, unknown>, rule: Record<string, unknown>) {
  const recordingTitle = normalizeRecordingSequenceText(String(recording.title ?? ''));
  if (!recordingTitle) return 0;

  const ruleTitle = normalizeRecordingSequenceText(String(rule.title ?? ''));
  const aliases = uniqueStrings(asStringArray(rule.matchAliases ?? rule.match_aliases))
    .map(normalizeRecordingSequenceText)
    .filter(Boolean);

  if (ruleTitle && ruleTitle === recordingTitle) return 100;
  if (aliases.some((alias) => alias === recordingTitle)) return 95;

  if (ruleTitle && isStrongRecordingSequencePartialMatch(recordingTitle, ruleTitle)) return 80;
  if (aliases.some((alias) => isStrongRecordingSequencePartialMatch(recordingTitle, alias))) return 70;

  return 0;
}

function isStrongRecordingSequencePartialMatch(recordingTitle: string, candidate: string) {
  if (!recordingTitle || !candidate) return false;
  const shorter = recordingTitle.length <= candidate.length ? recordingTitle : candidate;
  const longer = recordingTitle.length > candidate.length ? recordingTitle : candidate;
  if (shorter.length < 16 || !longer.includes(shorter)) return false;

  const candidateWords = new Set(candidate.split(' ').filter((word) => word.length >= 4));
  const recordingWords = new Set(recordingTitle.split(' ').filter((word) => word.length >= 4));
  if (candidateWords.size === 0 || recordingWords.size === 0) return false;

  const overlap = Array.from(candidateWords).filter((word) => recordingWords.has(word)).length;
  return overlap >= Math.min(3, candidateWords.size);
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

async function getStudentResourceDomainOptions(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const filterQuery = { ...(query ?? {}) };
  delete filterQuery.page;
  delete filterQuery.limit;
  delete filterQuery.resourceDomainKey;
  delete filterQuery.search;

  const data = await callRpc(context, 'student_resources_view', { p_student_email: context.email });
  const visibleResources = extractItems(data, ['resources', 'items'])
    .map(enrichRow)
    .map(camelize)
    .filter((item) => matchesClientFilters(item, filterQuery));
  const domainCounts = summarizeStudentResources(visibleResources).domainCounts;
  const activeDomainKeys = Object.keys(domainCounts).filter((key) => domainCounts[key] > 0);
  if (activeDomainKeys.length === 0) return [];

  const { data: domains, error } = await context.supabase
    .from('resource_domains')
    .select('id, domain_key, label, description, sort_order, status')
    .eq('status', 'active')
    .in('domain_key', activeDomainKeys)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) throw new ApiClientError(error.message, 503);
  const knownDomains = new Set((domains ?? []).map((domain) => String(domain.domain_key)));
  const fallbackDomains = activeDomainKeys
    .filter((domainKey) => !knownDomains.has(domainKey))
    .map((domainKey, index) => ({
      description: null,
      domain_key: domainKey,
      id: domainKey,
      label: formatResourceDomainFallbackLabel(domainKey),
      sort_order: 10_000 + index,
      status: 'active'
    }));

  return [...(domains ?? []), ...fallbackDomains].map((domain) => {
    const camelizedDomain = camelize(domain);
    return {
      ...(isRecord(camelizedDomain) ? camelizedDomain : {}),
      count: domainCounts[String(domain.domain_key)] ?? 0
    };
  });
}

function summarizeStudentResources(items: unknown[]) {
  const domainCounts: Record<string, number> = {};
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
    const resourceDomainKey = String(item.resourceDomainKey ?? item.resource_domain_key ?? '').trim();
    const resourceType = String(item.resourceType ?? item.resource_type ?? 'general') || 'general';
    const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : typeof item.updated_at === 'string' ? item.updated_at : '';
    const updatedTime = updatedAt ? new Date(updatedAt).getTime() : Number.NaN;

    if (!isLocked && item.hasAccess !== false) available += 1;
    if (isLocked) locked += 1;
    if (accessType === 'paid') paid += 1;
    if (accessType !== 'paid') free += 1;
    if (!Number.isNaN(updatedTime) && updatedTime >= oneWeekAgo) recentlyAdded += 1;
    if (resourceDomainKey) domainCounts[resourceDomainKey] = (domainCounts[resourceDomainKey] ?? 0) + 1;
    typeCounts[resourceType] = (typeCounts[resourceType] ?? 0) + 1;
  });

  return { available, domainCounts, free, locked, paid, recentlyAdded, typeCounts };
}

function formatResourceDomainFallbackLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function getRpcList(context: Awaited<ReturnType<typeof createContext>>, endpoint: { functionName: string; section?: string[] }, query: ApiClientOptions['query']) {
  const params: Record<string, boolean | string> = { p_student_email: context.email };
  if (endpoint.functionName === 'student_schedule_view' && query?.includePast === true) {
    params.p_include_past = true;
  }
  let requestedSessionType = '';
  if (endpoint.functionName === 'student_schedule_view') {
    const sessionType = String(query?.sessionType ?? '').trim();
    if (sessionType && sessionType !== 'all') {
      requestedSessionType = sessionType;
      params.p_session_type = sessionType;
    }
  }
  let data: unknown;
  try {
    data = await callRpc(context, endpoint.functionName, params);
  } catch (error) {
    if (endpoint.functionName !== 'student_schedule_view' || !requestedSessionType || !isScheduleSessionTypeRpcError(error)) {
      throw error;
    }
    const fallbackParams = { ...params };
    delete fallbackParams.p_session_type;
    data = await callRpc(context, endpoint.functionName, fallbackParams);
  }
  let items = extractItems(data, endpoint.section ?? ['items']);
  if (endpoint.functionName === 'student_projects_bundle') {
    const student = isRecord(data) && isRecord(data.student) ? data.student : {};
    const projectStartDate = student.project_start_date ?? student.projectStartDate;
    items = items.map((item) => isRecord(item) ? { ...item, studentProjectStartDate: item.studentProjectStartDate ?? projectStartDate ?? null } : item);
  }
  return paginate(items, query);
}

function isScheduleSessionTypeRpcError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /p_session_type|student_schedule_view|function.*not.*found|schema cache/i.test(error.message);
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

async function getAdminProjectSubmissionsList(context: Awaited<ReturnType<typeof createContext>>, query: ApiClientOptions['query']) {
  const endpoint = TABLE_ENDPOINTS['/admins/project-submissions'];
  const page = Number(query?.page ?? 1);
  const limit = Math.min(Number(query?.limit ?? 25), 500);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let request = context.supabase.from(endpoint.table).select('*', { count: 'exact' });

  request = applyCommonFilters(request, query, endpoint);
  request = applyCommonSort(request, query, endpoint);
  const { count, data, error } = await request.range(from, to);
  if (error) throw new ApiClientError(error.message, 503);

  const rows = data ?? [];
  const studentIds = uniqueStrings(rows.map((row) => String(row.student_id ?? '').trim()).filter(Boolean));
  const studentEmails = uniqueStrings(rows.map((row) => normalizeEmail(row.student_email)).filter(Boolean));
  let studentRows: Array<Record<string, unknown>> = [];

  if (studentIds.length > 0) {
    const studentsResult = await context.supabase
      .from('students')
      .select('id,email,college_name')
      .in('id', studentIds)
      .limit(5000);

    if (studentsResult.error) throw new ApiClientError(studentsResult.error.message, 503);
    studentRows = [...studentRows, ...(studentsResult.data ?? [])];
  }

  if (studentEmails.length > 0) {
    const studentsResult = await context.supabase
      .from('students')
      .select('id,email,college_name')
      .in('email', studentEmails)
      .limit(5000);

    if (studentsResult.error) throw new ApiClientError(studentsResult.error.message, 503);
    studentRows = [...studentRows, ...(studentsResult.data ?? [])];
  }

  const studentById = new Map<string, Record<string, unknown>>();
  const studentByEmail = new Map<string, Record<string, unknown>>();
  studentRows.forEach((student) => {
    const id = String(student.id ?? '').trim();
    const email = normalizeEmail(student.email);
    if (id) studentById.set(id, student);
    if (email) studentByEmail.set(email, student);
  });

  const enrichedRows = rows.map((row) => {
    const student = studentById.get(String(row.student_id ?? '').trim()) ?? studentByEmail.get(normalizeEmail(row.student_email));
    return {
      ...row,
      college_name: row.college_name ?? student?.college_name ?? null
    };
  });

  return createPaginatedResponse(enrichedRows.map(enrichRow).map(camelize), count ?? 0, page, limit);
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

function pickSnapshotStudentFields(student: Record<string, unknown>) {
  return {
    id: student.id,
    ...Object.fromEntries(STUDENT_ROSTER_SNAPSHOT_COLUMNS.map((column) => [column, student[column] ?? null]))
  };
}

function normalizeSnapshotRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

async function buildStudentRosterSnapshotPayload(context: Awaited<ReturnType<typeof createContext>>) {
  const [studentsResult, cohortsResult, programsResult] = await Promise.all([
    context.supabase.from('students').select('*').order('onboarding_sequence', { ascending: true }).order('created_at', { ascending: true }).limit(10000),
    context.supabase.from('student_cohorts').select('student_id,cohort_id,cohort_name').limit(20000),
    context.supabase.from('student_programs').select('student_id,program_key,student_name').limit(20000)
  ]);

  if (studentsResult.error) throw new ApiClientError(`Student roster snapshot failed: ${studentsResult.error.message}`, 503);
  if (cohortsResult.error) throw new ApiClientError(`Student cohort snapshot failed: ${cohortsResult.error.message}`, 503);
  if (programsResult.error) throw new ApiClientError(`Student program snapshot failed: ${programsResult.error.message}`, 503);

  const students = (studentsResult.data ?? []).filter(isRecord);
  return {
    capturedAt: new Date().toISOString(),
    scope: 'student_roster',
    studentCohorts: (cohortsResult.data ?? []).filter(isRecord),
    studentPrograms: (programsResult.data ?? []).filter(isRecord),
    students: students.map(pickSnapshotStudentFields),
    version: 1
  };
}

function studentRosterSnapshotSummary(row: Record<string, unknown>) {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by,
    id: row.id,
    restoredAt: row.restored_at,
    restoredBy: row.restored_by,
    restoreNote: row.restore_note,
    snapshotDate: row.snapshot_date,
    studentCount: row.student_count
  };
}

async function pruneStudentRosterSnapshots(context: Awaited<ReturnType<typeof createContext>>) {
  const { data, error } = await context.supabase
    .from('student_roster_snapshots')
    .select('id')
    .order('snapshot_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(3, 100);
  if (error) throw new ApiClientError(`Student roster snapshot cleanup failed: ${error.message}`, 503);
  const oldIds = (data ?? []).map((row) => String(row.id ?? '')).filter(Boolean);
  if (oldIds.length === 0) return;
  const deleteResult = await context.supabase.from('student_roster_snapshots').delete().in('id', oldIds);
  if (deleteResult.error) throw new ApiClientError(`Student roster snapshot cleanup failed: ${deleteResult.error.message}`, 503);
}

async function createStudentRosterSnapshot(context: Awaited<ReturnType<typeof createContext>>, snapshotDate = todayLocalDate()) {
  const existing = await context.supabase.from('student_roster_snapshots').select('*').eq('snapshot_date', snapshotDate).limit(1).maybeSingle();
  if (existing.error) throw new ApiClientError(`Student roster snapshot lookup failed: ${existing.error.message}`, 503);
  if (existing.data) return { created: false, item: camelize(studentRosterSnapshotSummary(existing.data)) };

  const payload = await buildStudentRosterSnapshotPayload(context);
  const students = normalizeSnapshotRows((payload as Record<string, unknown>).students);
  const { data, error } = await context.supabase
    .from('student_roster_snapshots')
    .insert({
      created_by: context.email,
      payload,
      snapshot_date: snapshotDate,
      student_count: students.length
    })
    .select('*')
    .single();
  if (error) throw new ApiClientError(`Student roster snapshot could not be created: ${error.message}`, 503);

  await pruneStudentRosterSnapshots(context);
  await writeAuditLog(context, 'students', 'roster_snapshot_created', data, { snapshot_date: snapshotDate, student_count: students.length });
  return { created: true, item: camelize(studentRosterSnapshotSummary(data)) };
}

async function getStudentRosterSnapshots(context: Awaited<ReturnType<typeof createContext>>) {
  if (webEnv.writeActionsEnabled) {
    try {
      await createStudentRosterSnapshot(context);
    } catch (error) {
      console.warn('Student roster auto-snapshot could not be created', error);
    }
  }
  const { data, error } = await context.supabase
    .from('student_roster_snapshots')
    .select('id,snapshot_date,student_count,created_at,created_by,restored_at,restored_by,restore_note')
    .order('snapshot_date', { ascending: false })
    .limit(3);
  if (error) throw new ApiClientError(`Student roster snapshots could not be loaded: ${error.message}`, 503);
  return { items: (data ?? []).map((row) => camelize(studentRosterSnapshotSummary(row))) };
}

function restoreStudentUpdatePayload(student: Record<string, unknown>) {
  return {
    ...Object.fromEntries(STUDENT_ROSTER_SNAPSHOT_COLUMNS.map((column) => [column, student[column] ?? null])),
    updated_at: new Date().toISOString()
  };
}

async function restoreStudentRosterSnapshot(context: Awaited<ReturnType<typeof createContext>>, snapshotId: string, body: unknown) {
  const confirmed = isRecord(body) && body.confirm === true;
  const restoreNote = isRecord(body) && typeof body.restoreNote === 'string' ? body.restoreNote.trim().slice(0, 500) : '';
  if (!confirmed) throw new ApiClientError('Confirm the student roster restore before applying it.', 400);

  const snapshotResult = await context.supabase.from('student_roster_snapshots').select('*').eq('id', snapshotId).limit(1).maybeSingle();
  if (snapshotResult.error) throw new ApiClientError(`Student roster snapshot lookup failed: ${snapshotResult.error.message}`, 503);
  if (!snapshotResult.data) throw new ApiClientError('Student roster snapshot was not found.', 404);

  const payload = isRecord(snapshotResult.data.payload) ? snapshotResult.data.payload : {};
  const students = normalizeSnapshotRows(payload.students);
  const studentIds = uniqueStrings(students.map((student) => String(student.id ?? '')).filter(Boolean));
  if (studentIds.length === 0) throw new ApiClientError('Snapshot has no student roster rows to restore.', 400);

  const currentStudentsResult = await context.supabase.from('students').select('id').in('id', studentIds).limit(10000);
  if (currentStudentsResult.error) throw new ApiClientError(`Current roster lookup failed: ${currentStudentsResult.error.message}`, 503);
  const existingIds = new Set((currentStudentsResult.data ?? []).map((student) => String(student.id ?? '')));

  let restoredStudents = 0;
  let skippedStudents = 0;
  for (const student of students) {
    const studentId = String(student.id ?? '');
    if (!studentId || !existingIds.has(studentId)) {
      skippedStudents += 1;
      continue;
    }
    const { error } = await context.supabase.from('students').update(restoreStudentUpdatePayload(student)).eq('id', studentId);
    if (error) throw new ApiClientError(`Student roster restore failed for ${student.email ?? studentId}: ${error.message}`, 503);
    restoredStudents += 1;
  }

  const deleteCohorts = await context.supabase.from('student_cohorts').delete().in('student_id', studentIds);
  if (deleteCohorts.error) throw new ApiClientError(`Student cohort restore cleanup failed: ${deleteCohorts.error.message}`, 503);
  const snapshotCohorts = normalizeSnapshotRows(payload.studentCohorts)
    .filter((row) => existingIds.has(String(row.student_id ?? '')))
    .map((row) => ({
      cohort_id: row.cohort_id,
      cohort_name: row.cohort_name,
      student_id: row.student_id
    }));
  if (snapshotCohorts.length > 0) {
    const { error } = await context.supabase.from('student_cohorts').insert(snapshotCohorts);
    if (error) throw new ApiClientError(`Student cohort restore failed: ${error.message}`, 503);
  }

  const deletePrograms = await context.supabase.from('student_programs').delete().in('student_id', studentIds);
  if (deletePrograms.error) throw new ApiClientError(`Student program restore cleanup failed: ${deletePrograms.error.message}`, 503);
  const snapshotPrograms = normalizeSnapshotRows(payload.studentPrograms)
    .filter((row) => existingIds.has(String(row.student_id ?? '')))
    .map((row) => ({
      program_key: row.program_key,
      student_id: row.student_id,
      student_name: row.student_name
    }));
  if (snapshotPrograms.length > 0) {
    const { error } = await context.supabase.from('student_programs').insert(snapshotPrograms);
    if (error) throw new ApiClientError(`Student program restore failed: ${error.message}`, 503);
  }

  const restoredAt = new Date().toISOString();
  const updateSnapshot = await context.supabase
    .from('student_roster_snapshots')
    .update({
      restore_note: restoreNote || null,
      restored_at: restoredAt,
      restored_by: context.email
    })
    .eq('id', snapshotId)
    .select('*')
    .single();
  if (updateSnapshot.error) throw new ApiClientError(`Student roster restore audit failed: ${updateSnapshot.error.message}`, 503);

  await writeAuditLog(context, 'students', 'roster_restored', updateSnapshot.data, {
    restored_students: restoredStudents,
    skipped_students: skippedStudents,
    snapshot_date: snapshotResult.data.snapshot_date
  });

  return {
    item: camelize(studentRosterSnapshotSummary(updateSnapshot.data)),
    restoredStudents,
    skippedStudents,
    status: 'restored'
  };
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

function mapSupportContactSettings(row: Record<string, unknown> | null | undefined) {
  const rawSettings = isRecord(row?.setting_value) ? row.setting_value : {};
  const supportEmail = typeof rawSettings.support_email === 'string' ? rawSettings.support_email.trim() : DEFAULT_STUDENT_SUPPORT_CONTACT.supportEmail;
  const supportContactTitle =
    typeof rawSettings.support_contact_title === 'string' && rawSettings.support_contact_title.trim()
      ? rawSettings.support_contact_title.trim()
      : DEFAULT_STUDENT_SUPPORT_CONTACT.supportContactTitle;
  const supportContactNote =
    typeof rawSettings.support_contact_note === 'string' && rawSettings.support_contact_note.trim()
      ? rawSettings.support_contact_note.trim()
      : DEFAULT_STUDENT_SUPPORT_CONTACT.supportContactNote;

  return {
    settingKey: String(row?.setting_key ?? STUDENT_SUPPORT_CONTACT_SETTING_KEY),
    status: row?.status === 'inactive' ? 'inactive' : 'active',
    supportContactNote,
    supportContactTitle,
    supportEmail,
    updatedAt: typeof row?.updated_at === 'string' ? row.updated_at : null,
    updatedBy: typeof row?.updated_by === 'string' ? row.updated_by : null
  };
}

async function getSupportContactSettings(context: Awaited<ReturnType<typeof createContext>>, admin: boolean) {
  if (admin) await getAdminProfile(context);

  let request = context.supabase.from('support_settings').select('*').eq('setting_key', STUDENT_SUPPORT_CONTACT_SETTING_KEY);
  if (!admin) request = request.eq('status', 'active');

  const { data, error } = await request.maybeSingle();
  if (error) throw new ApiClientError(error.message, 503);
  return mapSupportContactSettings(data as Record<string, unknown> | null);
}

function normalizeSupportContactSettingsPayload(body: unknown) {
  if (!isRecord(body)) throw new ApiClientError('Support settings payload must be an object.', 400);

  const supportEmail = String(body.supportEmail ?? body.support_email ?? '').trim().toLowerCase();
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    throw new ApiClientError('Enter a valid support email address.', 400);
  }

  const supportContactTitle = String(body.supportContactTitle ?? body.support_contact_title ?? DEFAULT_STUDENT_SUPPORT_CONTACT.supportContactTitle).trim();
  const supportContactNote = String(body.supportContactNote ?? body.support_contact_note ?? DEFAULT_STUDENT_SUPPORT_CONTACT.supportContactNote).trim();
  if (supportContactTitle.length > 140) throw new ApiClientError('Support card title must be 140 characters or less.', 400);
  if (supportContactNote.length > 800) throw new ApiClientError('Support help note must be 800 characters or less.', 400);

  return {
    support_contact_note: supportContactNote || DEFAULT_STUDENT_SUPPORT_CONTACT.supportContactNote,
    support_contact_title: supportContactTitle || DEFAULT_STUDENT_SUPPORT_CONTACT.supportContactTitle,
    support_email: supportEmail
  };
}

async function updateSupportContactSettings(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  await getAdminProfile(context);
  const settingValue = normalizeSupportContactSettingsPayload(body);
  const now = new Date().toISOString();
  const { data, error } = await context.supabase
    .from('support_settings')
    .upsert(
      {
        setting_key: STUDENT_SUPPORT_CONTACT_SETTING_KEY,
        setting_value: settingValue,
        status: 'active',
        updated_at: now,
        updated_by: context.email
      },
      { onConflict: 'setting_key' }
    )
    .select('*')
    .single();

  if (error) throw mutationError(error, 'support_settings');
  return {
    message: 'Support contact details updated.',
    settings: mapSupportContactSettings(data as Record<string, unknown>)
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
    if (visibility === 'public') await recordSupportTicketSmartPortalUpdate(context, 'support_ticket_answered', updatedTicket, String(message.id));
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

async function recordSupportTicketSmartPortalUpdate(
  context: Awaited<ReturnType<typeof createContext>>,
  eventType: Extract<SmartPortalUpdateInput['eventType'], 'support_ticket_answered' | 'support_ticket_resolved'>,
  ticket: Record<string, unknown>,
  messageId?: string
) {
  const studentEmail = normalizeEmail(ticket.student_email);
  if (!studentEmail) return;

  const ticketId = String(ticket.ticket_id ?? ticket.id ?? '').trim();
  const subject = String(ticket.subject ?? 'Support ticket').trim() || 'Support ticket';
  const sourceId = eventType === 'support_ticket_answered' ? messageId || `${ticket.id ?? ticketId}:answer` : String(ticket.id ?? ticketId);
  const linkUrl = `/student/support/${encodeURIComponent(String(ticket.id ?? ticketId))}`;

  await recordSmartPortalUpdate(context, {
    eventType,
    linkLabel: 'Open support ticket',
    linkUrl,
    metadata: { ticketId },
    sourceId,
    sourceType: 'support_ticket',
    studentEmails: [studentEmail],
    summary: eventType === 'support_ticket_answered' ? 'The support team has replied to your ticket.' : 'Your support ticket has been marked resolved.',
    title: eventType === 'support_ticket_answered' ? `Support reply: ${subject}` : `Support ticket resolved: ${subject}`
  });
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
  if (payload.status === 'resolved' && String(currentTicket.status ?? '') !== 'resolved') {
    await recordSupportTicketSmartPortalUpdate(context, 'support_ticket_resolved', data);
  }

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
    callRpc(context, 'student_schedule_view', { p_session_type: 'workshop', p_student_email: student.email }),
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
    callRpc(context, 'student_schedule_view', { p_session_type: 'workshop', p_student_email: student.email }),
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
        live_project_total_days: submission.live_project_total_days ?? undefined,
        project_end_date: submission.project_end_date ?? undefined,
        project_id: String(submission.project_id ?? ''),
        project_role: String(submission.role_name ?? submission.project_role ?? ''),
        project_start_date: submission.project_start_date ?? undefined,
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

async function resolveCertificateReviewItem(context: Awaited<ReturnType<typeof createContext>>, reviewItemId: string, body: unknown) {
  const admin = await getAdminProfile(context);
  const adminEmail = isRecord(admin) ? String(admin.email ?? context.email) : context.email;
  const payload = isRecord(body) ? snakify(body) as Record<string, unknown> : {};
  const resolutionNote = String(payload.resolution_note ?? payload.note ?? 'Resolved by admin.').trim() || 'Resolved by admin.';

  const { data, error } = await context.supabase
    .from('certificate_review_items')
    .update({
      resolution_note: resolutionNote,
      resolved_at: new Date().toISOString(),
      resolved_by: adminEmail,
      review_status: 'resolved',
      updated_at: new Date().toISOString()
    })
    .eq('id', reviewItemId)
    .select('*')
    .single();

  if (error) throw mutationError(error, 'certificate_review_items');
  await writeAuditLog(context, 'certificate_review_items', 'resolved', data, { resolution_note: resolutionNote });
  return camelize(enrichRow(data));
}

async function issueLeadershipCertificates(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  const admin = await getAdminProfile(context);
  const adminEmail = isRecord(admin) ? String(admin.email ?? context.email) : context.email;
  const payload = snakifyMutationBody(body);
  const studentIds = asStringArray(payload.student_ids);
  const programKey = String(payload.program_key ?? '').trim();
  const selectedProgramName = String(payload.program_name ?? programKey).trim();
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
    .select('id,email,full_name,student_id,live_project_role_ids')
    .in('id', studentIds)
    .eq('active', true)
    .limit(300);

  if (studentsError) throw new ApiClientError(studentsError.message, 503);
  const studentRows = students ?? [];
  if (studentRows.length === 0) throw new ApiClientError('No active students found for issuance.', 404);

  const studentEmails = studentRows.map((student) => String(student.email ?? '').trim()).filter(Boolean);
  const studentEmailSet = new Set(studentEmails.map(normalizeEmail));
  const roleIds = uniqueStrings(studentRows.flatMap((student) => asStringArray(student.live_project_role_ids)));
  const { data: roleRows, error: roleError } = roleIds.length
    ? await context.supabase.from('role_master').select('role_id,role_name,program_key').in('role_id', roleIds).limit(1000)
    : { data: [], error: null };

  if (roleError) throw new ApiClientError(roleError.message, 503);

  const roleById = new Map(
    (roleRows ?? []).map((role) => [
      String(role.role_id ?? '').trim(),
      {
        id: String(role.role_id ?? '').trim(),
        name: String(role.role_name ?? role.role_id ?? '').trim(),
        programKey: String(role.program_key ?? '').trim().toLowerCase()
      }
    ])
  );
  const { data: existingCertificates, error: existingError } = await context.supabase
    .from('certificates')
    .select('id,certificate_id,student_email,program_key,program_name,project_role,role_name')
    .eq('certificate_type', 'leadership')
    .eq('program_key', programKey)
    .neq('status', 'revoked')
    .limit(5000);

  if (existingError) throw new ApiClientError(existingError.message, 503);

  const existingByRole = new Map<string, Record<string, unknown>>();
  (existingCertificates ?? [])
    .filter((certificate) => studentEmailSet.has(normalizeEmail(certificate.student_email)))
    .forEach((certificate) => {
      const projectRole = String(certificate.project_role ?? certificate.role_name ?? '').trim();
      const certificateProgramName = String(certificate.program_name ?? '').trim();
      existingByRole.set(leadershipCertificateDuplicateKey(certificate.student_email, certificate.program_key, projectRole, certificateProgramName), certificate);
    });
  const now = new Date();
  const rows = [];
  const skipped: Array<{ reason: string; studentId?: string; studentName?: string; certificateId?: string }> = [];
  const reviewItemWrites: Array<Promise<void>> = [];
  const reviewKeysToResolve: string[] = [];

  for (const student of studentRows) {
    const studentEmail = String(student.email ?? '').trim();
    const studentId = String(student.id ?? '');
    const studentName = String(student.full_name ?? studentEmail);
    const studentRoleIds = uniqueStrings(asStringArray(student.live_project_role_ids));
    if (!studentEmail) {
      skipped.push({ reason: 'Student email is missing.', studentId, studentName });
      continue;
    }
    const selectedRoles = studentRoleIds
      .map((roleId) => roleById.get(roleId) ?? { id: roleId, name: roleId, programKey: '' })
      .filter((role) => role.name);
    const matchingRoles = uniqueBy(
      selectedRoles.filter((role) => roleMatchesCohortProgram(role, programKey)),
      (role) => role.id || role.name
    );

    if (matchingRoles.length === 0) {
      skipped.push({
        reason: 'Needs review: no live project leadership role is mapped to this cohort/program.',
        studentId,
        studentName
      });
      reviewItemWrites.push(
        upsertLeadershipCertificateReviewItem(context, {
          cohortName,
          liveProjectRoleIds: studentRoleIds,
          programKey,
          programName: selectedProgramName || programKey,
          reason: 'No live project leadership role is mapped to this selected cohort/program.',
          reasonCode: 'missing_matching_live_project_role',
          studentEmail,
          studentId,
          studentName
        })
      );
      continue;
    }

    reviewKeysToResolve.push(leadershipCertificateReviewKey(studentId, studentEmail, programKey, cohortName, 'missing_matching_live_project_role'));

    for (const role of matchingRoles) {
      const projectRole = role.name;
      const certificateProgramName = certificateProgramNameForLeadershipRole(role) || selectedProgramName || programKey;
      const existingCertificate = existingByRole.get(leadershipCertificateDuplicateKey(studentEmail, programKey, projectRole, certificateProgramName));
      if (existingCertificate) {
        skipped.push({
          certificateId: String(existingCertificate.certificate_id ?? ''),
          reason: `Leadership certificate already exists for ${projectRole}.`,
          studentId,
          studentName
        });
        continue;
      }

      const certificateId = `SS-LP-${programKey.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${now.getFullYear()}-${randomHex(8).toUpperCase()}`;
      const verificationToken = randomHex(24);
      const verificationUrl = certificateVerificationUrl(certificateId);
      rows.push({
        certificate_id: certificateId,
        certificate_payload: {
          certificateProgramName,
          cohortName,
          issueDate,
          learningTrackName: selectedProgramName || programKey,
          modulesCovered,
          programKey,
          projectRole
        },
        certificate_type: 'leadership',
        cohort_name: cohortName,
        email_requested: sendEmail,
        generation_status: 'pending',
        issue_date: issueDate,
        issued_by: adminEmail,
        modules_covered: modulesCovered,
        program_key: programKey,
        program_name: certificateProgramName,
        project_role: projectRole,
        role_name: projectRole,
        status: 'issued',
        student_email: studentEmail,
        student_id: student.id,
        student_name: studentName,
        verification_token: verificationToken,
        verification_url: verificationUrl
      });
    }
  }

  await Promise.all(reviewItemWrites);
  await resolveLeadershipCertificateReviewItems(context, reviewKeysToResolve, 'Matching live project leadership role was found during certificate issuance.');

  if (rows.length === 0) {
    return {
      certificates: [],
      message: `No new certificates issued. ${skipped.length} item${skipped.length === 1 ? '' : 's'} skipped because a role certificate already exists or needs review.`,
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

  await Promise.all(
    (data ?? []).map((certificate) =>
      recordSmartPortalUpdate(context, {
        eventType: 'certificate_issued',
        linkLabel: 'View certificates',
        linkUrl: '/student/certificates',
        metadata: { certificateId: certificate.certificate_id, certificateType: certificate.certificate_type },
        sourceId: String(certificate.id ?? certificate.certificate_id),
        sourceType: 'certificate',
        studentEmails: [String(certificate.student_email ?? '')],
        summary: `${String(certificate.program_name ?? (selectedProgramName || programKey))} certificate is now available.`,
        title: 'Certificate issued'
      })
    )
  );

  const generationMessage = await triggerCertificateGeneration(context, (data ?? []).map((certificate) => String(certificate.id)), sendEmail);

  return {
    certificates: (data ?? []).map(enrichRow).map(camelize),
    message: `${rows.length} leadership certificate${rows.length === 1 ? '' : 's'} issued.${skipped.length ? ` ${skipped.length} skipped because a role certificate already exists or needs review.` : ''}${generationMessage ? ` ${generationMessage}` : ''}`,
    skipped
  };
}

async function issueLiveProjectCertificate(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  const admin = await getAdminProfile(context);
  const adminEmail = isRecord(admin) ? String(admin.email ?? context.email) : context.email;
  const payload = snakifyMutationBody(body);
  const requestId = String(payload.request_id ?? '').trim();
  const rawDurationWeeks = payload.duration_weeks === undefined || payload.duration_weeks === null || payload.duration_weeks === '' ? undefined : Number(payload.duration_weeks);
  const startDate = String(payload.start_date ?? '').slice(0, 10);
  const submittedEndDate = String(payload.end_date ?? '').slice(0, 10);
  const issueDate = String(payload.issue_date ?? todayIsoDate()).slice(0, 10);
  const submittedProjectRole = String(payload.project_role ?? '').trim();
  const sendEmail = payload.send_email !== false;

  if (!requestId) throw new ApiClientError('Certificate request is required.', 400);
  if (rawDurationWeeks !== undefined && ![1, 2, 3, 4, 5, 6].includes(rawDurationWeeks)) throw new ApiClientError('Duration must be between 1 and 6 weeks, or use custom dates.', 400);
  if (!isIsoDate(startDate)) throw new ApiClientError('Start date is required before issuing a live project certificate.', 400);
  const endDate = isIsoDate(submittedEndDate)
    ? submittedEndDate
    : rawDurationWeeks
      ? addDays(startDate, rawDurationWeeks * 7 - 1)
      : '';
  if (!isIsoDate(endDate)) throw new ApiClientError('End date is required before issuing a live project certificate.', 400);
  if (dateInputTime(endDate) < dateInputTime(startDate)) throw new ApiClientError('End date cannot be before the project start date.', 400);
  if (dateInputTime(endDate) > dateInputTime(todayLocalDate())) throw new ApiClientError('End date is a future date, please edit it before issuing certificate.', 400);
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
  const projectRole = submittedProjectRole || String(submission.role_name ?? submission.project_role ?? '').trim();
  if (!projectRole) throw new ApiClientError('Project role is required before issuing a live project certificate.', 400);

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
  const durationLabel = rawDurationWeeks ? `${rawDurationWeeks} ${rawDurationWeeks === 1 ? 'week' : 'weeks'}` : 'Custom dates';
  const row = {
    certificate_id: certificateId,
    certificate_payload: {
      cohortName: submission.cohort_name,
      durationLabel,
      durationWeeks: rawDurationWeeks ?? null,
      issueDate,
      projectEndDate: endDate,
      projectRole,
      projectStartDate: startDate,
      requestNumber: submission.request_number,
      submissionId: submission.request_id,
      submissionLink: submission.submission_link
    },
    certificate_type: 'live_project',
    cohort_name: submission.cohort_name,
    duration_label: durationLabel,
    email_requested: sendEmail,
    generation_status: 'pending',
    issue_date: issueDate,
    issued_by: adminEmail,
    modules_covered: [projectRole, String(submission.project_title ?? '')].filter(Boolean),
    program_key: submission.program_key,
    program_name: programResult.data?.name ?? submission.program_key,
    project_end_date: endDate,
    project_id: submission.project_id,
    project_role: projectRole,
    project_start_date: startDate,
    project_title: submission.project_title,
    role_id: submission.role_id,
    role_name: projectRole,
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

  await recordSmartPortalUpdate(context, {
    eventType: 'certificate_issued',
    linkLabel: 'View certificates',
    linkUrl: '/student/certificates',
    metadata: { certificateId: data.certificate_id, certificateType: data.certificate_type },
    sourceId: String(data.id ?? data.certificate_id),
    sourceType: 'certificate',
    studentEmails: [String(data.student_email ?? '')],
    summary: `${String(data.project_title ?? 'Live project')} certificate is now available.`,
    title: 'Certificate issued'
  });

  const generationMessage = await triggerCertificateGeneration(context, [String(data.id)], sendEmail);
  const needsAttention = certificateDeliveryNeedsAttention(generationMessage);

  return {
    certificate: camelize(enrichRow(data)),
    message: needsAttention
      ? `${certificateId} issued, but PDF delivery needs attention.${generationMessage ? ` ${generationMessage}` : ''}`
      : `${certificateId} issued.${generationMessage ? ` ${generationMessage}` : ''}`
  };
}

async function bulkIssueLiveProjectCertificates(context: Awaited<ReturnType<typeof createContext>>, body: unknown) {
  const payload = snakifyMutationBody(body);
  const requestIds = uniqueStrings(asStringArray(payload.request_ids));
  const endDate = String(payload.end_date ?? '').slice(0, 10);
  const issueDate = String(payload.issue_date ?? todayIsoDate()).slice(0, 10);
  const sendEmail = payload.send_email !== false;

  if (requestIds.length === 0) throw new ApiClientError('Select at least one live project certificate request.', 400);
  if (requestIds.length > 100) throw new ApiClientError('Bulk live project certificate issue is limited to 100 requests at a time.', 400);
  if (!isIsoDate(endDate)) throw new ApiClientError('Bulk end date is required before issuing live project certificates.', 400);
  if (!isIsoDate(issueDate)) throw new ApiClientError('Issue date is required before issuing live project certificates.', 400);
  if (dateInputTime(endDate) > dateInputTime(todayLocalDate())) throw new ApiClientError('End date is a future date, please edit it before issuing certificates.', 400);

  const certificates: Array<Record<string, unknown>> = [];
  const failed: Array<{ error: string; requestId: string }> = [];

  for (const requestId of requestIds) {
    try {
      const { data: submission, error: submissionError } = await context.supabase
        .from('project_submission_requests')
        .select('id,request_id,request_number,project_start_date,role_name')
        .or(`id.eq.${requestId},request_id.eq.${requestId},request_number.eq.${requestId}`)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      if (submissionError) throw new ApiClientError(submissionError.message, 503);
      if (!submission) throw new ApiClientError('Approved project submission was not found.', 404);

      const startDate = String(submission.project_start_date ?? '').slice(0, 10);
      if (!isIsoDate(startDate)) throw new ApiClientError('Project start date is missing for this request.', 400);
      if (dateInputTime(endDate) < dateInputTime(startDate)) throw new ApiClientError('End date cannot be before the project start date.', 400);
      const totalDays = Math.floor((dateInputTime(endDate) - dateInputTime(startDate)) / 86_400_000) + 1;
      if (totalDays > 30) throw new ApiClientError('Maximum allowed live project duration is 30 days.', 400);

      const result = await issueLiveProjectCertificate(context, {
        endDate,
        issueDate,
        projectRole: String(submission.role_name ?? '').trim(),
        requestId,
        sendEmail,
        startDate
      });
      certificates.push(result.certificate as unknown as Record<string, unknown>);
    } catch (issueError) {
      failed.push({
        error: issueError instanceof Error ? issueError.message : 'Certificate issue failed.',
        requestId
      });
    }
  }

  const deliverySummary = await summarizeIssuedCertificateDelivery(context, certificates, sendEmail);
  const needsAttention = failed.length > 0 || certificateDeliveryNeedsAttention(deliverySummary);

  return {
    certificates,
    failed,
    message: needsAttention
      ? `${certificates.length} live project certificate row${certificates.length === 1 ? '' : 's'} issued, but some items need attention.${failed.length ? ` ${failed.length} issue request${failed.length === 1 ? '' : 's'} failed.` : ''}${deliverySummary ? ` ${deliverySummary}` : ''}`
      : `${certificates.length} live project certificate${certificates.length === 1 ? '' : 's'} issued.${deliverySummary ? ` ${deliverySummary}` : ''}`
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
  const rawDurationWeeks = payload.duration_weeks === undefined || payload.duration_weeks === null || payload.duration_weeks === '' ? undefined : Number(payload.duration_weeks);
  const projectStartDate = String(payload.project_start_date ?? '').slice(0, 10);
  const submittedProjectEndDate = String(payload.project_end_date ?? '').slice(0, 10);
  const submittedProjectTitle = String(payload.project_title ?? '').trim();
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
  if (certificateType === 'leadership' && !programName && !programKey) throw new ApiClientError('Program is required before issuing a manual certificate.', 400);
  if (certificateType === 'live_project' && !programName && !programKey) programName = 'Live Project';

  let modulesCovered = asStringArray(payload.modules_covered);
  const projectTitle = submittedProjectTitle || projectRole;
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
    if (!projectRole) throw new ApiClientError('Project role is required before issuing a manual live project certificate.', 400);
    if (rawDurationWeeks !== undefined && ![1, 2, 3, 4, 5, 6].includes(rawDurationWeeks)) throw new ApiClientError('Duration must be between 1 and 6 weeks, or use custom dates.', 400);
    if (!isIsoDate(projectStartDate)) throw new ApiClientError('Project start date is required before issuing a manual live project certificate.', 400);
    const projectEndDate = rawDurationWeeks ? addDays(projectStartDate, rawDurationWeeks * 7 - 1) : submittedProjectEndDate;
    if (!isIsoDate(projectEndDate)) throw new ApiClientError('Project end date is required before issuing a manual live project certificate.', 400);
    if (dateInputTime(projectEndDate) < dateInputTime(projectStartDate)) throw new ApiClientError('Project end date cannot be before the project start date.', 400);
    const projectId = `MANUAL-${slugifyKey(projectTitle).toUpperCase()}-${now.getFullYear()}-${randomHex(4).toUpperCase()}`;
    const durationLabel = rawDurationWeeks ? `${rawDurationWeeks} ${rawDurationWeeks === 1 ? 'week' : 'weeks'}` : 'Custom dates';
    row.certificate_id = `SS-PROJ-${now.getFullYear()}-${randomHex(10).toUpperCase()}`;
    row.certificate_payload = {
      durationWeeks: rawDurationWeeks ?? null,
      issueDate,
      manualIssue: true,
      projectEndDate,
      projectStartDate,
      projectTitle,
      projectRole
    };
    row.duration_label = durationLabel;
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

  await recordSmartPortalUpdate(context, {
    eventType: 'certificate_issued',
    linkLabel: 'View certificates',
    linkUrl: '/student/certificates',
    metadata: { certificateId: data.certificate_id, certificateType: data.certificate_type },
    sourceId: String(data.id ?? data.certificate_id),
    sourceType: 'certificate',
    studentEmails: [String(data.student_email ?? studentEmail)],
    summary: `${String(data.program_name ?? data.project_title ?? 'Your')} certificate is now available.`,
    title: 'Certificate issued'
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
  const requestedProjectEndDate = String(payload.project_end_date ?? '').slice(0, 10);
  const linkedinProfileId = typeof payload.linkedin_profile_id === 'string' ? payload.linkedin_profile_id.trim() : '';
  const collegeClubMember = typeof payload.college_club_member === 'boolean' ? payload.college_club_member : null;
  const collegeClubName = typeof payload.college_club_name === 'string' ? payload.college_club_name.trim() : '';
  const collegeClubOther = typeof payload.college_club_other === 'string' ? payload.college_club_other.trim() : '';
  const wantsSkilledSapiensCollaboration = typeof payload.wants_skilled_sapiens_collaboration === 'boolean' ? payload.wants_skilled_sapiens_collaboration : null;
  const skilledSapiensSupportDetails = typeof payload.skilled_sapiens_support_details === 'string' ? payload.skilled_sapiens_support_details.trim() : '';
  const declarationConfirmations = asStringArray(payload.declaration_confirmations).map((item) => item.trim()).filter(Boolean);
  const declarationAccepted = payload.declaration_accepted === true;
  const durationConfirmed = payload.duration_confirmed === true;

  if (!projectId) throw new ApiClientError('Select a project before submitting.', 400);
  if (!cohortId) throw new ApiClientError('Select the cohort for this submission.', 400);
  if (!isHttpUrl(submissionLink)) throw new ApiClientError('Enter a valid report link that starts with http:// or https://.', 400);
  if (!linkedinProfileId) throw new ApiClientError('Enter your LinkedIn profile link before submitting.', 400);
  if (!isLinkedInProfileUrl(linkedinProfileId)) {
    throw new ApiClientError('Enter a valid LinkedIn profile link that starts with http:// or https://.', 400);
  }
  if (studentFeedback.length < 30) throw new ApiClientError('Add detailed project feedback before submitting.', 400);
  if (!declarationAccepted) throw new ApiClientError('Confirm the project declaration before submitting.', 400);
  if (declarationConfirmations.length < 6) throw new ApiClientError('Confirm all project submission declarations before submitting.', 400);
  if (!durationConfirmed) throw new ApiClientError('Confirm that you understand your live project duration before submitting.', 400);
  if (collegeClubMember === null) throw new ApiClientError('Select whether you are a member of any club or committee in your college.', 400);
  if (collegeClubMember && !collegeClubName) throw new ApiClientError('Select your club or committee name.', 400);
  if (collegeClubMember && collegeClubName === 'Other' && !collegeClubOther) throw new ApiClientError('Enter your club or committee name.', 400);
  if (collegeClubMember && wantsSkilledSapiensCollaboration === null) {
    throw new ApiClientError('Select whether you want to collaborate with Skilled Sapiens for events or club support.', 400);
  }
  if (collegeClubMember && wantsSkilledSapiensCollaboration === true && !skilledSapiensSupportDetails) {
    throw new ApiClientError('Tell us what support you need from Skilled Sapiens.', 400);
  }

  const [profile, dashboard, projectBundle] = await Promise.all([
    getStudentProfile(context),
    callRpc(context, 'student_dashboard_bundle', { p_student_email: context.email }),
    callRpc(context, 'student_projects_bundle', { p_student_email: context.email })
  ]);

  const student = isRecord(profile) ? profile : {};
  const studentId = String(student.id ?? '');
  const studentName = String(student.fullName ?? student.full_name ?? context.email);
  const projectStartDate = String(student.projectStartDate ?? student.project_start_date ?? '').slice(0, 10);
  const projects = extractItems(projectBundle, ['projects', 'items']).filter(isRecord);
  const cohorts = extractItems(dashboard, ['cohorts', 'studentCohorts']).filter(isRecord);
  const submissions = extractItems(projectBundle, ['projectSubmissionRequests', 'project_submission_requests']).filter(isRecord);
  const limitRows = extractItems(projectBundle, ['projectSubmissionStudentLimits', 'project_submission_student_limits']).filter(isRecord);
  const maxAttempts = Math.max(1, Number(limitRows[0]?.maxAttempts ?? limitRows[0]?.max_attempts ?? 1) || 1);

  const project = projects.find((item) => String(item.projectId ?? item.project_id ?? item.id) === projectId);
  if (!project) throw new ApiClientError('This project is not available to your account.', 403);
  if (String(project.status ?? '').toLowerCase() !== 'active') throw new ApiClientError('This project is not active for submission.', 403);
  if (!isIsoDate(projectStartDate)) throw new ApiClientError('Your onboarding date is not available. Please contact the support team before submitting this report.', 400);
  if (!isIsoDate(requestedProjectEndDate)) throw new ApiClientError('Select your live project end date before submitting.', 400);
  if (dateInputTime(requestedProjectEndDate) < dateInputTime(projectStartDate)) throw new ApiClientError('End date cannot be before your onboarding date.', 400);
  if (dateInputTime(requestedProjectEndDate) > dateInputTime(todayLocalDate())) {
    throw new ApiClientError("Future end dates are not allowed. Please select today's date or an earlier date within your allowed project duration.", 400);
  }
  const liveProjectTotalDays = Math.floor((dateInputTime(requestedProjectEndDate) - dateInputTime(projectStartDate)) / 86_400_000) + 1;
  if (liveProjectTotalDays > 30) {
    throw new ApiClientError('Maximum allowed live project duration is 30 days. Please select an end date within 30 days of your project start date.', 400);
  }

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
    college_club_member: collegeClubMember,
    college_club_name: collegeClubMember ? collegeClubName : null,
    college_club_other: collegeClubMember && collegeClubName === 'Other' ? collegeClubOther : null,
    program_key: cohortProgramKey,
    project_id: projectExternalId,
    project_end_date: requestedProjectEndDate,
    project_start_date: projectStartDate,
    live_project_total_days: liveProjectTotalDays,
    linkedin_profile_id: linkedinProfileId || null,
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
    duration_confirmation_accepted: durationConfirmed,
    submission_link: submissionLink,
    submitted_at: now.toISOString(),
    skilled_sapiens_support_details: collegeClubMember && wantsSkilledSapiensCollaboration ? skilledSapiensSupportDetails : null,
    wants_skilled_sapiens_collaboration: collegeClubMember ? wantsSkilledSapiensCollaboration : null
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
  const { data: previousRow, error: previousError } =
    endpoint.table === 'workshops' || endpoint.table === 'resources' || endpoint.table === 'career_readiness_content'
      ? await context.supabase.from(endpoint.table).select('*').eq('id', id).limit(1).maybeSingle()
      : { data: null, error: null };
  if (previousError) throw mutationError(previousError, endpoint.table);
  const { data, error } = await context.supabase.from(endpoint.table).update(payload).eq('id', id).select('*').single();
  if (error) throw mutationError(error, endpoint.table);
  if (endpoint.table === 'students') await syncStudentAssignments(context, data, metadata);
  if (auditAction) await writeAuditLog(context, endpoint.table, auditAction, data, payload);
  if (endpoint.table === 'workshops' && !hasPublishedRecording(previousRow) && hasPublishedRecording(data) && hasAudienceScope(data)) {
    await recordWorkshopSmartPortalUpdate(context, 'recording_published', data);
  }
  if (endpoint.table === 'workshops' && hasAudienceScope(data)) {
    const previousStatus = workshopStatus(previousRow);
    const currentStatus = workshopStatus(data);
    if (currentStatus === 'Cancelled' && previousStatus !== 'Cancelled') {
      await recordWorkshopSmartPortalUpdate(context, 'session_cancelled', data);
    } else if (currentStatus === 'Completed' && previousStatus !== 'Completed') {
      await recordWorkshopSmartPortalUpdate(context, 'session_completed', data);
    } else if (hasWorkshopScheduleChanged(previousRow, data) && isStudentVisibleSession(data)) {
      await recordWorkshopSmartPortalUpdate(context, 'session_rescheduled', data);
    }
  }
  if (endpoint.table === 'resources' && shouldRecordResourceSmartPortalUpdate(previousRow, data)) {
    await recordResourceSmartPortalUpdate(context, data);
  }
  if (endpoint.table === 'career_readiness_content' && shouldRecordCareerReadinessSmartPortalUpdate(previousRow, data)) {
    await recordCareerReadinessSmartPortalUpdate(context, data);
  }
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
  if (endpoint.table === 'resources' && hasAudienceScope(data) && String(data.status ?? 'active').toLowerCase() === 'active') {
    await recordResourceSmartPortalUpdate(context, data);
  }
  if (endpoint.table === 'career_readiness_content' && data.is_published === true) {
    await recordCareerReadinessSmartPortalUpdate(context, data);
  }
  if (endpoint.table === 'workshops' && hasAudienceScope(data)) {
    if (hasPublishedRecording(data)) {
      await recordWorkshopSmartPortalUpdate(context, 'recording_published', data);
    } else if (isStudentVisibleSession(data)) {
      await recordWorkshopSmartPortalUpdate(context, 'session_scheduled', data);
    }
  }
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
  const profileUpdatePayload = buildBulkStudentProfileUpdatePayload(body);
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

      if (Object.keys(profileUpdatePayload).length > 0) {
        const updatePayload = { ...profileUpdatePayload, updated_at: new Date().toISOString() };
        const { data, error: updateError } = await context.supabase.from('students').update(updatePayload).eq('id', studentId).select('*').single();
        if (updateError) throw updateError;
        currentStudent = data;
        await writeAuditLog(context, 'students', 'bulk_profile_updated', data, updatePayload);
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

function buildBulkStudentProfileUpdatePayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, 'collegeName')) {
    payload.college_name = normalizeNullableText(body.collegeName);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'educationYear')) {
    const value = normalizeNullableText(body.educationYear);
    if (value && !['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', 'Working Professional'].includes(value)) {
      throw new ApiClientError('Education Year is invalid.', 400);
    }
    payload.you_are_from = value;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'personalMentor')) {
    const value = normalizeNullableText(body.personalMentor);
    if (value && !['Yes', 'No'].includes(value)) {
      throw new ApiClientError('Opted for Personal Mentor must be Yes or No.', 400);
    }
    payload.personalmentor = value;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'liveProjectDuration')) {
    const value = normalizeNullableText(body.liveProjectDuration);
    if (value && !['2 weeks', '4 weeks', '6 weeks', '8 weeks'].includes(value)) {
      throw new ApiClientError('Live Project Duration is invalid.', 400);
    }
    payload.duration = value;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'onboardingDate')) {
    const value = normalizeNullableText(body.onboardingDate);
    if (value && Number.isNaN(new Date(`${value}T00:00:00`).getTime())) {
      throw new ApiClientError('Onboarding Date is invalid.', 400);
    }
    payload.project_start_date = value;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'waGroup')) {
    payload.wa_group_name = normalizeNullableText(body.waGroup);
  }

  return payload;
}

function normalizeNullableText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
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

async function callRpc(context: Awaited<ReturnType<typeof createContext>>, functionName: string, params?: Record<string, boolean | string | string[] | Record<string, unknown> | null>) {
  const { data, error } = await context.supabase.rpc(functionName, params);
  if (error) throw new ApiClientError(error.message, 503);
  return camelize(data);
}

type SmartPortalUpdateInput = {
  cohortNames?: string[];
  eventType:
    | 'career_readiness_added'
    | 'certificate_issued'
    | 'recording_published'
    | 'resource_added'
    | 'session_cancelled'
    | 'session_completed'
    | 'session_rescheduled'
    | 'session_scheduled'
    | 'support_ticket_answered'
    | 'support_ticket_resolved';
  linkLabel?: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
  programKeys?: string[];
  sourceId: string;
  sourceType: string;
  studentEmails?: string[];
  summary?: string;
  title: string;
};

async function recordSmartPortalUpdate(context: Awaited<ReturnType<typeof createContext>>, input: SmartPortalUpdateInput) {
  try {
    await callRpc(context, 'record_portal_update_event', {
      p_cohort_names: uniqueStrings(input.cohortNames ?? []),
      p_created_by: context.email,
      p_event_type: input.eventType,
      p_link_label: input.linkLabel ?? null,
      p_link_url: input.linkUrl ?? null,
      p_metadata: input.metadata ?? {},
      p_program_keys: uniqueStrings((input.programKeys ?? []).map((key) => key.trim().toLowerCase()).filter(Boolean)),
      p_source_id: input.sourceId,
      p_source_type: input.sourceType,
      p_student_emails: uniqueStrings((input.studentEmails ?? []).map(normalizeEmail).filter(Boolean)),
      p_summary: input.summary ?? null,
      p_title: input.title
    });
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      console.warn('Smart portal update digest was skipped:', error);
    }
  }
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

    if (key === 'sessionType') {
      const normalizedActual = String(actual ?? 'workshop');
      return normalizedActual === expected;
    }

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

function hasPublishedRecording(item: unknown) {
  return isStudentRecordingRow(item);
}

function isStudentVisibleSession(item: unknown) {
  if (!isRecord(item)) return false;
  const status = String(item.status ?? item.workshop_status ?? item.workshopStatus ?? '');
  return ['Upcoming', 'Scheduled', 'Live'].includes(status);
}

function workshopStatus(item: unknown) {
  if (!isRecord(item)) return '';
  return String(item.status ?? item.workshop_status ?? item.workshopStatus ?? '').trim();
}

function hasWorkshopScheduleChanged(previousItem: unknown, nextItem: unknown) {
  if (!isRecord(previousItem) || !isRecord(nextItem)) return false;
  return (
    String(previousItem.date ?? '') !== String(nextItem.date ?? '') ||
    String(previousItem.time ?? '') !== String(nextItem.time ?? '') ||
    String(previousItem.duration_minutes ?? previousItem.durationMinutes ?? '') !== String(nextItem.duration_minutes ?? nextItem.durationMinutes ?? '')
  );
}

function hasAudienceScope(item: unknown) {
  if (!isRecord(item)) return false;
  const primaryProgramKey = String(item.program_key ?? item.programKey ?? '').trim();
  const programKeys = uniqueStrings([...asStringArray(item.program_keys ?? item.programKeys), primaryProgramKey]);
  const cohortNames = asStringArray(item.cohort_names ?? item.cohortNames);
  return programKeys.length > 0 || cohortNames.length > 0;
}

function isActiveResource(item: unknown) {
  if (!isRecord(item)) return false;
  return String(item.status ?? '').trim().toLowerCase() === 'active';
}

function isPublishedCareerReadiness(item: unknown) {
  return isRecord(item) && item.is_published === true;
}

function sortedAudienceValues(values: string[]) {
  return uniqueStrings(values.map((value) => value.trim().toLowerCase()).filter(Boolean)).sort();
}

function hasPortalAudienceChanged(previousItem: unknown, nextItem: unknown) {
  const previousProgramKeys = sortedAudienceValues(itemProgramKeys(previousItem));
  const nextProgramKeys = sortedAudienceValues(itemProgramKeys(nextItem));
  const previousCohortNames = sortedAudienceValues(itemCohortNames(previousItem));
  const nextCohortNames = sortedAudienceValues(itemCohortNames(nextItem));
  return previousProgramKeys.join('\n') !== nextProgramKeys.join('\n') || previousCohortNames.join('\n') !== nextCohortNames.join('\n');
}

function shouldRecordResourceSmartPortalUpdate(previousItem: unknown, nextItem: unknown) {
  return (
    isActiveResource(nextItem) &&
    hasAudienceScope(nextItem) &&
    (!isActiveResource(previousItem) || !hasAudienceScope(previousItem) || hasPortalAudienceChanged(previousItem, nextItem))
  );
}

function shouldRecordCareerReadinessSmartPortalUpdate(previousItem: unknown, nextItem: unknown) {
  return isPublishedCareerReadiness(nextItem) && (!isPublishedCareerReadiness(previousItem) || hasPortalAudienceChanged(previousItem, nextItem));
}

function itemTitle(item: unknown, fallback: string) {
  if (!isRecord(item)) return fallback;
  return String(item.title ?? item.name ?? fallback).trim() || fallback;
}

function itemSourceId(item: unknown) {
  if (!isRecord(item)) return '';
  return String(item.id ?? item.workshop_id ?? item.workshopId ?? item.resource_id ?? item.resourceId ?? '').trim();
}

function itemProgramKeys(item: unknown) {
  if (!isRecord(item)) return [];
  const primaryProgramKey = String(item.program_key ?? item.programKey ?? '').trim();
  return uniqueStrings([
    ...asStringArray(item.program_keys ?? item.programKeys),
    primaryProgramKey
  ].map((key) => key.trim().toLowerCase()).filter(Boolean));
}

function itemCohortNames(item: unknown) {
  if (!isRecord(item)) return [];
  return uniqueStrings(asStringArray(item.cohort_names ?? item.cohortNames).map((name) => name.trim()).filter(Boolean));
}

function formatPortalUpdateScheduleSummary(item: unknown) {
  if (!isRecord(item)) return undefined;
  const date = String(item.date ?? '').trim();
  const time = String(item.time ?? '').trim();
  const duration = item.duration_minutes ?? item.durationMinutes;
  return [date, time, duration ? `${duration} min` : undefined].filter(Boolean).join(' · ') || undefined;
}

function workshopPortalUpdateCopy(
  eventType: Extract<SmartPortalUpdateInput['eventType'], 'recording_published' | 'session_cancelled' | 'session_completed' | 'session_rescheduled' | 'session_scheduled'>,
  item: unknown
) {
  const title = itemTitle(item, 'Workshop');
  const schedule = formatPortalUpdateScheduleSummary(item) ?? 'A new session has been added to your schedule.';

  if (eventType === 'recording_published') {
    return {
      linkLabel: 'Watch recording',
      linkUrl: '/student/recordings',
      sourceType: 'workshop_recording',
      summary: 'The session recording is now available.',
      title: `Recording published: ${title}`
    };
  }

  if (eventType === 'session_rescheduled') {
    return {
      linkLabel: 'View schedule',
      linkUrl: '/student/schedule',
      sourceType: 'workshop_session',
      summary: `The session schedule has been updated: ${schedule}.`,
      title: `Workshop rescheduled: ${title}`
    };
  }

  if (eventType === 'session_cancelled') {
    return {
      linkLabel: 'View schedule',
      linkUrl: '/student/schedule',
      sourceType: 'workshop_session',
      summary: 'This session has been cancelled.',
      title: `Workshop cancelled: ${title}`
    };
  }

  if (eventType === 'session_completed') {
    return {
      linkLabel: 'View schedule',
      linkUrl: '/student/schedule',
      sourceType: 'workshop_session',
      summary: 'This session has been marked completed.',
      title: `Workshop completed: ${title}`
    };
  }

  return {
    linkLabel: 'View schedule',
    linkUrl: '/student/schedule',
    sourceType: 'workshop_session',
    summary: schedule,
    title: `New session scheduled: ${title}`
  };
}

async function recordWorkshopSmartPortalUpdate(
  context: Awaited<ReturnType<typeof createContext>>,
  eventType: Extract<SmartPortalUpdateInput['eventType'], 'recording_published' | 'session_cancelled' | 'session_completed' | 'session_rescheduled' | 'session_scheduled'>,
  item: unknown
) {
  const copy = workshopPortalUpdateCopy(eventType, item);
  await recordSmartPortalUpdate(context, {
    cohortNames: itemCohortNames(item),
    eventType,
    linkLabel: copy.linkLabel,
    linkUrl: copy.linkUrl,
    metadata: { workshopId: isRecord(item) ? item.workshop_id ?? item.workshopId ?? item.id : undefined },
    programKeys: itemProgramKeys(item),
    sourceId: itemSourceId(item),
    sourceType: copy.sourceType,
    summary: copy.summary,
    title: copy.title
  });
}

async function recordResourceSmartPortalUpdate(context: Awaited<ReturnType<typeof createContext>>, item: unknown) {
  await recordSmartPortalUpdate(context, {
    cohortNames: itemCohortNames(item),
    eventType: 'resource_added',
    linkLabel: 'Open resources',
    linkUrl: '/student/resources',
    metadata: { resourceId: isRecord(item) ? item.resource_id ?? item.resourceId ?? item.id : undefined },
    programKeys: itemProgramKeys(item),
    sourceId: itemSourceId(item),
    sourceType: 'resource',
    summary: 'A new item is available in your Resource Library.',
    title: `New resource added: ${itemTitle(item, 'Resource')}`
  });
}

async function recordCareerReadinessSmartPortalUpdate(context: Awaited<ReturnType<typeof createContext>>, item: unknown) {
  const programKeys = itemProgramKeys(item);
  const cohortNames = itemCohortNames(item);
  const studentEmails = programKeys.length === 0 && cohortNames.length === 0 ? await getActiveStudentEmails(context) : [];

  await recordSmartPortalUpdate(context, {
    cohortNames,
    eventType: 'career_readiness_added',
    linkLabel: 'Open career readiness',
    linkUrl: '/student/career-readiness',
    metadata: { contentId: isRecord(item) ? item.id : undefined },
    programKeys,
    sourceId: itemSourceId(item),
    sourceType: 'career_readiness_content',
    studentEmails,
    summary: 'New career readiness content is available.',
    title: `New career readiness content: ${itemTitle(item, 'Career readiness')}`
  });
}

async function getActiveStudentEmails(context: Awaited<ReturnType<typeof createContext>>) {
  const { data, error } = await context.supabase
    .from('students')
    .select('email')
    .eq('active', true)
    .not('email', 'is', null)
    .limit(10000);
  if (error) throw mutationError(error, 'students');
  return uniqueStrings((data ?? []).map((row) => normalizeEmail(row.email)).filter(Boolean));
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
    rows.find((row) => isRecord(row) && row.auth_user_id === context.userId && normalizeEmail(row.alt_email) === context.email) ??
    rows.find((row) => isRecord(row) && row.auth_user_id === context.userId) ??
    rows.find((row) => isRecord(row) && normalizeEmail(row.email) === context.email) ??
    rows.find((row) => isRecord(row) && normalizeEmail(row.alt_email) === context.email) ??
    null
  );
}

function chooseGuestIdentityRow(rows: unknown, context: Awaited<ReturnType<typeof createContext>>) {
  if (!Array.isArray(rows)) return null;
  return (
    rows.find((row) => isRecord(row) && row.auth_user_id === context.userId && normalizeEmail(row.personal_email) === context.email) ??
    rows.find((row) => isRecord(row) && row.auth_user_id === context.userId) ??
    rows.find((row) => isRecord(row) && normalizeEmail(row.personal_email) === context.email) ??
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
  const expiresAt = item.expires_at ?? item.expiresAt;
  const startsAt = typeof startDate === 'string' && startDate.trim() ? new Date(startDate).getTime() : Number.NaN;
  const endsAt = typeof endDate === 'string' && endDate.trim() ? new Date(endDate).getTime() : Number.NaN;
  const expiresAtTime = typeof expiresAt === 'string' && expiresAt.trim() ? new Date(expiresAt).getTime() : Number.NaN;

  if (!Number.isNaN(startsAt) && startsAt > now) return false;
  if (!Number.isNaN(endsAt) && endsAt < now) return false;
  if (!Number.isNaN(expiresAtTime) && expiresAtTime <= now) return false;

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

function normalizeOnboardingMailStatus(value: unknown) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  return normalized === 'skip' ? 'skipped' : normalized;
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
    onboarding_mail_status: normalizeOnboardingMailStatus(payload.onboarding_mail_status),
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
  const resourceDomainKey = payload.resource_domain_key === '' ? null : payload.resource_domain_key;

  return {
    ...payload,
    access_type: accessType,
    cohort_names: cohortNames,
    currency: typeof payload.currency === 'string' ? payload.currency.trim().toUpperCase() : payload.currency,
    payment_link: paymentLink,
    price: payload.price === '' || payload.price === undefined ? null : Number(payload.price),
    program_keys: programKeys,
    resource_domain_key: typeof resourceDomainKey === 'string' ? normalizeResourceDomainKey(resourceDomainKey) : resourceDomainKey,
    resource_mode: typeof payload.resource_mode === 'string' ? payload.resource_mode.trim().toLowerCase() : payload.resource_mode,
    resource_type: typeof payload.resource_type === 'string' ? payload.resource_type.trim().toLowerCase() : payload.resource_type,
    url
  };
}

function normalizeResourceDomainKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeResourceDomainWriteBody(payload: Record<string, unknown>) {
  return {
    ...payload,
    description: typeof payload.description === 'string' && payload.description.trim() ? payload.description.trim() : null,
    domain_key: typeof payload.domain_key === 'string' ? normalizeResourceDomainKey(payload.domain_key) : payload.domain_key,
    label: typeof payload.label === 'string' ? payload.label.trim() : payload.label,
    sort_order: payload.sort_order === '' || payload.sort_order === undefined ? 100 : Number(payload.sort_order),
    status: typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status
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

function normalizeStudentGuidanceContentWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  return {
    ...payload,
    audience: has('audience') && typeof payload.audience === 'string' ? payload.audience.trim().toLowerCase() : payload.audience,
    content: has('content') && typeof payload.content === 'string' ? payload.content.trim() : payload.content,
    content_key: has('content_key') && typeof payload.content_key === 'string' ? payload.content_key.trim().toLowerCase() : payload.content_key,
    sort_order: has('sort_order') && payload.sort_order !== '' && payload.sort_order !== null ? Number(payload.sort_order) : payload.sort_order,
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    summary: has('summary') ? String(payload.summary ?? '').trim() || null : payload.summary,
    title: has('title') && typeof payload.title === 'string' ? payload.title.trim() : payload.title
  };
}

function normalizeCareerReadinessContentWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const linkUrl = has('link_url') ? String(payload.link_url ?? '').trim() || null : payload.link_url;
  const linkButtons = has('link_buttons') ? normalizeCareerReadinessLinkButtons(payload.link_buttons) : payload.link_buttons;
  return {
    ...payload,
    category: has('category') && typeof payload.category === 'string' ? slugifyKey(payload.category).slice(0, 80) : payload.category,
    cohort_names: has('cohort_names') ? uniqueStrings(asStringArray(payload.cohort_names).map((item) => item.trim()).filter(Boolean)) : payload.cohort_names,
    content: has('content') ? String(payload.content ?? '').trim() || null : payload.content,
    description: has('description') ? String(payload.description ?? '').trim() || null : payload.description,
    is_published: has('is_published') ? payload.is_published === true : payload.is_published,
    link_buttons: linkButtons,
    link_label: has('link_label') ? String(payload.link_label ?? '').trim() || null : payload.link_label,
    link_url: linkUrl,
    program_keys: has('program_keys') ? uniqueStrings(asStringArray(payload.program_keys).map((item) => slugifyKey(item)).filter(Boolean)) : payload.program_keys,
    section_title: has('section_title') ? String(payload.section_title ?? '').trim() || 'Custom Section' : payload.section_title,
    sort_order: has('sort_order') && payload.sort_order !== '' && payload.sort_order !== null ? Number(payload.sort_order) : payload.sort_order,
    title: has('title') && typeof payload.title === 'string' ? payload.title.trim() : payload.title
  };
}

function normalizeCareerReadinessLinkButtons(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = String(item.label ?? '').trim();
      const url = String(item.url ?? '').trim();
      if (!label && !url) return null;
      return { label, url };
    })
    .filter((item): item is { label: string; url: string } => Boolean(item));
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
  const studentEmails = has('student_emails') ? uniqueStrings(asStringArray(payload.student_emails).map(normalizeEmail).filter(Boolean)) : undefined;

  return {
    ...payload,
    announcement_id: has('announcement_id') ? String(payload.announcement_id ?? '').trim() : payload.announcement_id,
    audience,
    cohort_names: cohortNames,
    custom_emoji: customEmoji === undefined ? undefined : customEmoji,
    expires_at: normalizeOptionalText('expires_at'),
    end_date: normalizeOptionalDate('end_date'),
    link_label: normalizeOptionalText('link_label'),
    link_url: normalizeOptionalText('link_url'),
    message: has('message') && typeof payload.message === 'string' ? payload.message.trim() : payload.message,
    metadata: has('metadata') && isRecord(payload.metadata) ? payload.metadata : payload.metadata,
    pinned: has('pinned') ? payload.pinned === true : payload.pinned,
    priority: has('priority') && typeof payload.priority === 'string' ? payload.priority.trim().toLowerCase() : payload.priority,
    program_keys: programKeys,
    source_id: normalizeOptionalText('source_id'),
    source_key: normalizeOptionalText('source_key'),
    source_type: normalizeOptionalText('source_type'),
    start_date: normalizeOptionalDate('start_date'),
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    student_emails: studentEmails,
    system_generated: has('system_generated') ? payload.system_generated === true : payload.system_generated,
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

function normalizeWhatsAppGroupWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  return {
    ...payload,
    cohort_name: has('cohort_name') ? String(payload.cohort_name ?? '').trim() || null : payload.cohort_name,
    direct_chat_link: has('direct_chat_link') ? String(payload.direct_chat_link ?? '').trim() || null : payload.direct_chat_link,
    group_name: has('group_name') ? String(payload.group_name ?? '').trim() : payload.group_name,
    invite_link: has('invite_link') ? String(payload.invite_link ?? '').trim() || null : payload.invite_link,
    notes: has('notes') ? String(payload.notes ?? '').trim() || null : payload.notes,
    program_name: has('program_name') ? String(payload.program_name ?? '').trim() || null : payload.program_name,
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status
  };
}

function normalizeWhatsAppCategoryWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  return {
    ...payload,
    name: has('name') ? String(payload.name ?? '').trim() : payload.name,
    sort_order: has('sort_order') && payload.sort_order !== '' ? Number(payload.sort_order) : payload.sort_order,
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status
  };
}

function normalizeWhatsAppTemplateWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  return {
    ...payload,
    category_id: has('category_id') ? String(payload.category_id ?? '').trim() || null : payload.category_id,
    message_body: has('message_body') ? String(payload.message_body ?? '').trim() : payload.message_body,
    notes: has('notes') ? String(payload.notes ?? '').trim() || null : payload.notes,
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    title: has('title') ? String(payload.title ?? '').trim() : payload.title
  };
}

function normalizeWhatsAppLogWriteBody(payload: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  return {
    ...payload,
    category_id: has('category_id') ? String(payload.category_id ?? '').trim() || null : payload.category_id,
    cohort_name: has('cohort_name') ? String(payload.cohort_name ?? '').trim() || null : payload.cohort_name,
    group_id: has('group_id') ? String(payload.group_id ?? '').trim() || null : payload.group_id,
    group_name: has('group_name') ? String(payload.group_name ?? '').trim() : payload.group_name,
    message_body: has('message_body') ? String(payload.message_body ?? '').trim() : payload.message_body,
    message_title: has('message_title') ? String(payload.message_title ?? '').trim() : payload.message_title,
    metadata: isRecord(payload.metadata) ? payload.metadata : {},
    notes: has('notes') ? String(payload.notes ?? '').trim() || null : payload.notes,
    program_name: has('program_name') ? String(payload.program_name ?? '').trim() || null : payload.program_name,
    sent_at: has('sent_at') && payload.sent_at ? new Date(String(payload.sent_at)).toISOString() : payload.sent_at,
    status: has('status') && typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : payload.status,
    template_id: has('template_id') ? String(payload.template_id ?? '').trim() || null : payload.template_id
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

function validateStudentGuidanceContentWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const contentKey = typeof payload.content_key === 'string' ? payload.content_key.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const audience = typeof payload.audience === 'string' ? payload.audience : undefined;
  const sortOrder = payload.sort_order;

  if (inserting && !contentKey) throw new ApiClientError('Guidance content key is required.', 400);
  if (contentKey && !['program_structure', 'certificate_structure'].includes(contentKey)) {
    throw new ApiClientError('Guidance content key is not supported for this version.', 400);
  }
  if (inserting && !title) throw new ApiClientError('Guidance title is required.', 400);
  if (status && !['active', 'inactive'].includes(status)) {
    throw new ApiClientError('Guidance status is invalid.', 400);
  }
  if (audience && audience !== 'leadership') {
    throw new ApiClientError('Guidance audience is invalid.', 400);
  }
  if (sortOrder !== undefined && sortOrder !== null && (!Number.isInteger(Number(sortOrder)) || Number(sortOrder) < 0)) {
    throw new ApiClientError('Guidance sort order must be zero or a positive whole number.', 400);
  }
}

function validateCareerReadinessContentWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const category = typeof payload.category === 'string' ? payload.category.trim() : '';
  const sectionTitle = typeof payload.section_title === 'string' ? payload.section_title.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const sortOrder = payload.sort_order;
  const linkUrl = typeof payload.link_url === 'string' ? payload.link_url.trim() : '';
  const linkButtons = Array.isArray(payload.link_buttons) ? payload.link_buttons : undefined;

  if (inserting && !category) throw new ApiClientError('Career readiness category is required.', 400);
  if (category && !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(category)) throw new ApiClientError('Career readiness category is invalid.', 400);
  if (inserting && !sectionTitle) throw new ApiClientError('Career readiness section title is required.', 400);
  if (sectionTitle && (sectionTitle.length < 2 || sectionTitle.length > 120)) throw new ApiClientError('Career readiness section title must be 2 to 120 characters.', 400);
  if (inserting && !title) throw new ApiClientError('Career readiness title is required.', 400);
  if (sortOrder !== undefined && sortOrder !== null && (!Number.isInteger(Number(sortOrder)) || Number(sortOrder) < 0)) {
    throw new ApiClientError('Career readiness sort order must be zero or a positive whole number.', 400);
  }
  if (linkUrl && !/^https?:\/\//i.test(linkUrl) && !linkUrl.startsWith('/')) {
    throw new ApiClientError('Career readiness link must start with http://, https://, or /.', 400);
  }
  if (payload.link_buttons !== undefined && !Array.isArray(payload.link_buttons)) {
    throw new ApiClientError('Career readiness CTA buttons must be a list.', 400);
  }
  if (linkButtons && linkButtons.length > 8) {
    throw new ApiClientError('Career readiness can include up to 8 CTA buttons.', 400);
  }
  linkButtons?.forEach((button, index) => {
    if (!isRecord(button)) throw new ApiClientError(`CTA button ${index + 1} is invalid.`, 400);
    const label = typeof button.label === 'string' ? button.label.trim() : '';
    const url = typeof button.url === 'string' ? button.url.trim() : '';
    if (!label || !url) throw new ApiClientError(`CTA button ${index + 1} needs both a label and a URL.`, 400);
    if (label.length > 80) throw new ApiClientError(`CTA button ${index + 1} label must be 80 characters or fewer.`, 400);
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      throw new ApiClientError(`CTA button ${index + 1} URL must start with http://, https://, or /.`, 400);
    }
  });
  if (payload.program_keys !== undefined && !Array.isArray(payload.program_keys)) {
    throw new ApiClientError('Career readiness program targeting must be a list.', 400);
  }
  if (payload.cohort_names !== undefined && !Array.isArray(payload.cohort_names)) {
    throw new ApiClientError('Career readiness cohort targeting must be a list.', 400);
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
  const studentEmails = payload.student_emails;
  const startDate = typeof payload.start_date === 'string' ? payload.start_date.trim() : '';
  const endDate = typeof payload.end_date === 'string' ? payload.end_date.trim() : '';
  const expiresAt = typeof payload.expires_at === 'string' ? payload.expires_at.trim() : '';
  const linkUrl = typeof payload.link_url === 'string' ? payload.link_url.trim() : '';

  if (inserting && !title) throw new ApiClientError('Announcement title is required.', 400);
  if (inserting && !message) throw new ApiClientError('Announcement message is required.', 400);
  if ('title' in payload && !title) throw new ApiClientError('Announcement title is required.', 400);
  if ('message' in payload && !message) throw new ApiClientError('Announcement message is required.', 400);
  if (title.length > 160) throw new ApiClientError('Announcement title must be 160 characters or fewer.', 400);
  if (message.length > 2500) throw new ApiClientError('Announcement message must be 2500 characters or fewer.', 400);
  if (audience && !['all', 'cohort', 'program', 'student'].includes(audience)) throw new ApiClientError('Announcement audience is invalid.', 400);
  if (priority && !['normal', 'urgent'].includes(priority)) throw new ApiClientError('Announcement priority is invalid.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Announcement status is invalid.', 400);
  if (type && !['general', 'alert', 'session', 'resource', 'project', 'custom'].includes(type)) throw new ApiClientError('Announcement type is invalid.', 400);
  if (cohortNames !== undefined && !Array.isArray(cohortNames)) throw new ApiClientError('Announcement cohorts must be a list.', 400);
  if (programKeys !== undefined && !Array.isArray(programKeys)) throw new ApiClientError('Announcement programs must be a list.', 400);
  if (studentEmails !== undefined && !Array.isArray(studentEmails)) throw new ApiClientError('Announcement student emails must be a list.', 400);
  if (audience === 'cohort' && Array.isArray(cohortNames) && cohortNames.length === 0) throw new ApiClientError('Select at least one cohort.', 400);
  if (audience === 'program' && Array.isArray(programKeys) && programKeys.length === 0) throw new ApiClientError('Select at least one program.', 400);
  if (audience === 'student' && Array.isArray(studentEmails) && studentEmails.length === 0) throw new ApiClientError('Select at least one student.', 400);
  if (startDate && Number.isNaN(new Date(`${startDate}T00:00:00.000Z`).getTime())) throw new ApiClientError('Announcement start date is invalid.', 400);
  if (endDate && Number.isNaN(new Date(`${endDate}T00:00:00.000Z`).getTime())) throw new ApiClientError('Announcement end date is invalid.', 400);
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) throw new ApiClientError('Announcement expiry time is invalid.', 400);
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

function validateWhatsAppStatus(value: string | undefined, label: string) {
  if (value && !['active', 'inactive'].includes(value)) throw new ApiClientError(`${label} status is invalid.`, 400);
}

function validateOptionalUrl(value: string, label: string) {
  if (value && !isHttpUrl(value)) throw new ApiClientError(`${label} must start with http:// or https://.`, 400);
}

function validateWhatsAppGroupWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const groupName = typeof payload.group_name === 'string' ? payload.group_name.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const inviteLink = typeof payload.invite_link === 'string' ? payload.invite_link.trim() : '';
  const directChatLink = typeof payload.direct_chat_link === 'string' ? payload.direct_chat_link.trim() : '';
  if (inserting && !groupName) throw new ApiClientError('WhatsApp group name is required.', 400);
  if ('group_name' in payload && !groupName) throw new ApiClientError('WhatsApp group name is required.', 400);
  validateWhatsAppStatus(status, 'WhatsApp group');
  validateOptionalUrl(inviteLink, 'WhatsApp invite link');
  validateOptionalUrl(directChatLink, 'WhatsApp direct chat link');
}

function validateWhatsAppCategoryWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  const sortOrder = payload.sort_order;
  if (inserting && !name) throw new ApiClientError('WhatsApp category name is required.', 400);
  if ('name' in payload && !name) throw new ApiClientError('WhatsApp category name is required.', 400);
  validateWhatsAppStatus(status, 'WhatsApp category');
  if (sortOrder !== undefined && sortOrder !== null && sortOrder !== '' && (!Number.isInteger(Number(sortOrder)) || Number(sortOrder) < 0)) {
    throw new ApiClientError('WhatsApp category order must be zero or a positive whole number.', 400);
  }
}

function validateWhatsAppTemplateWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.message_body === 'string' ? payload.message_body.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  if (inserting && !title) throw new ApiClientError('WhatsApp template title is required.', 400);
  if (inserting && !body) throw new ApiClientError('WhatsApp template message is required.', 400);
  if ('title' in payload && !title) throw new ApiClientError('WhatsApp template title is required.', 400);
  if ('message_body' in payload && !body) throw new ApiClientError('WhatsApp template message is required.', 400);
  if (title.length > 160) throw new ApiClientError('WhatsApp template title must be 160 characters or fewer.', 400);
  if (body.length > 4000) throw new ApiClientError('WhatsApp template message must be 4000 characters or fewer.', 400);
  validateWhatsAppStatus(status, 'WhatsApp template');
}

function validateWhatsAppLogWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const groupName = typeof payload.group_name === 'string' ? payload.group_name.trim() : '';
  const title = typeof payload.message_title === 'string' ? payload.message_title.trim() : '';
  const body = typeof payload.message_body === 'string' ? payload.message_body.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status : undefined;
  if (inserting && !groupName) throw new ApiClientError('WhatsApp log group name is required.', 400);
  if (inserting && !title) throw new ApiClientError('WhatsApp log title is required.', 400);
  if (inserting && !body) throw new ApiClientError('WhatsApp log message is required.', 400);
  if (status && !['draft', 'sent', 'skipped'].includes(status)) throw new ApiClientError('WhatsApp log status is invalid.', 400);
  if (title.length > 160) throw new ApiClientError('WhatsApp log title must be 160 characters or fewer.', 400);
  if (body.length > 4000) throw new ApiClientError('WhatsApp log message must be 4000 characters or fewer.', 400);
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
  const resourceDomainKey = typeof payload.resource_domain_key === 'string' ? payload.resource_domain_key.trim() : '';
  const cohortNames = payload.cohort_names;
  const programKeys = payload.program_keys;

  if (inserting && !resourceId) throw new ApiClientError('Resource ID is required.', 400);
  if (inserting && !title) throw new ApiClientError('Resource title is required.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Resource status is invalid.', 400);
  if (accessType && !['free', 'paid'].includes(accessType)) throw new ApiClientError('Resource access type is invalid.', 400);
  if (cohortNames !== undefined && !Array.isArray(cohortNames)) throw new ApiClientError('Resource cohorts must be a list.', 400);
  if (programKeys !== undefined && !Array.isArray(programKeys)) throw new ApiClientError('Resource programs must be a list.', 400);
  if (resourceDomainKey && !/^[a-z0-9_]+$/.test(resourceDomainKey)) throw new ApiClientError('Resource Domain is invalid.', 400);
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

function validateResourceDomainWriteBody(payload: Record<string, unknown>, inserting: boolean) {
  const domainKey = typeof payload.domain_key === 'string' ? payload.domain_key.trim() : '';
  const label = typeof payload.label === 'string' ? payload.label.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status.trim() : '';
  const sortOrder = Number(payload.sort_order ?? 100);

  if (inserting && !domainKey) throw new ApiClientError('Resource Domain key is required.', 400);
  if (!domainKey || !/^[a-z0-9_]+$/.test(domainKey)) throw new ApiClientError('Resource Domain key can use lowercase letters, numbers, and underscores only.', 400);
  if (!label) throw new ApiClientError('Resource Domain label is required.', 400);
  if (label.length > 80) throw new ApiClientError('Resource Domain label must be 80 characters or fewer.', 400);
  if (status && !['active', 'inactive'].includes(status)) throw new ApiClientError('Resource Domain status is invalid.', 400);
  if (!Number.isFinite(sortOrder)) throw new ApiClientError('Resource Domain sort order is invalid.', 400);
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
  const requiresLiveProjectRole =
    inserting ||
    typeof payload.full_name === 'string' ||
    typeof payload.email === 'string' ||
    payload.cohort_name !== undefined ||
    payload.program_name !== undefined ||
    payload.track_role_ids !== undefined ||
    payload.live_project_role_ids !== undefined;
  if (requiresLiveProjectRole && (!Array.isArray(liveProjectRoleIds) || liveProjectRoleIds.length === 0)) {
    throw new ApiClientError('Live project role is required.', 400);
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
    table !== 'resource_domains' &&
    table !== 'programs' &&
    table !== 'projects' &&
    table !== 'project_toolkit_items' &&
    table !== 'role_master' &&
    table !== 'certificates' &&
    table !== 'feature_controls' &&
    table !== 'email_templates' &&
    table !== 'student_guidance_content' &&
    table !== 'career_readiness_content' &&
    table !== 'whatsapp_groups' &&
    table !== 'whatsapp_message_categories' &&
    table !== 'whatsapp_message_templates' &&
    table !== 'whatsapp_message_logs'
  ) return;
  const entityType =
    table === 'cohorts'
      ? 'cohort'
      : table === 'workshops'
        ? 'workshop'
        : table === 'resources'
          ? 'resource'
          : table === 'resource_domains'
            ? 'resource_domain'
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
                          : table === 'student_guidance_content'
                            ? 'student_guidance_content'
                            : table === 'career_readiness_content'
                              ? 'career_readiness_content'
                              : table.startsWith('whatsapp_')
                                ? table
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
      `${entityType === 'cohort' ? 'Cohort' : entityType === 'workshop' ? 'Workshop' : entityType === 'resource' ? 'Resource' : entityType === 'resource_domain' ? 'Resource Domain' : entityType === 'program' ? 'Program' : entityType === 'project' ? 'Project' : entityType === 'project_toolkit_item' ? 'Project toolkit item' : entityType === 'project_role' ? 'Project role' : entityType === 'certificate' ? 'Certificate' : entityType === 'feature_control' ? 'Feature control' : entityType === 'email_template' ? 'Email template' : entityType === 'student_guidance_content' ? 'Student guidance content' : entityType === 'career_readiness_content' ? 'Career readiness content' : entityType.startsWith('whatsapp_') ? 'WhatsApp record' : 'Student'} was saved, but audit logging failed: ${error.message}`,
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
      resourceDomainKey: row.resource_domain_key,
      resourceId: row.resource_id,
      status: row.status,
      title: row.title
    };
  }

  if (table === 'resource_domains') {
    return {
      ...base,
      domainKey: row.domain_key,
      label: row.label,
      status: row.status
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

  if (table === 'student_guidance_content') {
    return {
      ...base,
      contentKey: row.content_key,
      status: row.status,
      title: row.title
    };
  }

  if (table === 'whatsapp_groups') {
    return {
      ...base,
      cohortName: row.cohort_name,
      groupName: row.group_name,
      status: row.status
    };
  }

  if (table === 'whatsapp_message_categories') {
    return {
      ...base,
      name: row.name,
      status: row.status
    };
  }

  if (table === 'whatsapp_message_templates') {
    return {
      ...base,
      categoryId: row.category_id,
      status: row.status,
      title: row.title
    };
  }

  if (table === 'whatsapp_message_logs') {
    return {
      ...base,
      groupName: row.group_name,
      messageTitle: row.message_title,
      sentAt: row.sent_at,
      status: row.status
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
    if (table === 'certificates') return new ApiClientError('A certificate already exists for this student and program. Refresh the list and issue only eligible students.', 409);
    if (table === 'whatsapp_message_categories') return new ApiClientError('A WhatsApp category with this name already exists.', 409);
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

function isLinkedInProfileUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isLinkedInHost = hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
    return (url.protocol === 'https:' || url.protocol === 'http:') && isLinkedInHost && /^\/(in|pub)\/[^/]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
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

function todayLocalDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateInputTime(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`).getTime();
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
    const generatedSummary = summarizeCertificateGenerationResponse(data, sendEmail);
    if (generatedSummary) return generatedSummary;
    const message = isRecord(data) && typeof data.message === 'string' ? data.message : '';
    return message || 'PDF generation started.';
  } catch (error) {
    return `Certificate row saved, but PDF generation needs retry: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
}

function summarizeCertificateGenerationResponse(data: unknown, sendEmail: boolean) {
  if (!isRecord(data) || !Array.isArray(data.results)) return '';
  const results = data.results.filter(isRecord);
  if (results.length === 0) return '';

  const failedResults = results.filter((result) => String(result.status ?? '') === 'failed');
  const readyResults = results.filter((result) => String(result.status ?? '') !== 'failed');
  const emailFailedResults = readyResults.filter((result) => {
    const certificate = isRecord(result.certificate) ? result.certificate : {};
    const generationError = String(certificate.generation_error ?? certificate.generationError ?? '');
    return /email failed/i.test(generationError);
  });
  const readyCount = readyResults.length;
  const failedCount = failedResults.length;
  const pieces = [`${readyCount} certificate PDF${readyCount === 1 ? '' : 's'} ready.`];

  if (sendEmail && readyCount > 0 && emailFailedResults.length === 0) {
    pieces.push(`${readyCount} certificate email${readyCount === 1 ? '' : 's'} sent.`);
  }
  if (sendEmail && emailFailedResults.length > 0) {
    pieces.push(`${emailFailedResults.length} certificate email${emailFailedResults.length === 1 ? '' : 's'} failed. Use Email PDF to retry.`);
  }
  if (failedCount > 0) {
    pieces.push(`${failedCount} PDF generation failed.${sendEmail ? ' Email was not sent for failed certificate(s).' : ''} Use Retry PDF after fixing the error.`);
    const firstError = failedResults
      .map((result) => String(result.error ?? '').trim())
      .find(Boolean);
    if (firstError) pieces.push(`First error: ${firstError}`);
  }

  return pieces.join(' ');
}

function certificateDeliveryNeedsAttention(message: string) {
  return /PDF generation failed|0 certificate PDFs? ready|needs retry|Email was not sent|email failed/i.test(message);
}

async function summarizeIssuedCertificateDelivery(context: Awaited<ReturnType<typeof createContext>>, certificates: Array<Record<string, unknown>>, sendEmail: boolean) {
  const ids = certificates.map((certificate) => String(certificate.id ?? '').trim()).filter(Boolean);
  if (ids.length === 0) return '';

  const { data, error } = await context.supabase
    .from('certificates')
    .select('id,certificate_id,generation_status,generation_error,email_requested,email_sent_at')
    .in('id', ids);
  if (error) return '';

  const rows = (data ?? []).filter(isRecord);
  if (rows.length === 0) return '';

  const readyCount = rows.filter((row) => String(row.generation_status ?? '') === 'ready').length;
  const failedRows = rows.filter((row) => String(row.generation_status ?? '') === 'failed');
  const emailFailedCount = rows.filter((row) => /email failed/i.test(String(row.generation_error ?? ''))).length;
  const emailSentCount = rows.filter((row) => row.email_sent_at).length;
  const pieces = [`${readyCount} certificate PDF${readyCount === 1 ? '' : 's'} ready.`];

  if (failedRows.length > 0) {
    pieces.push(`${failedRows.length} PDF generation failed.${sendEmail ? ' Email was not sent for failed certificate(s).' : ''} Use the Issued Certificates tab to retry PDF generation.`);
    const firstError = failedRows.map((row) => String(row.generation_error ?? '').trim()).find(Boolean);
    if (firstError) pieces.push(`First error: ${firstError}`);
  } else if (sendEmail) {
    pieces.push(`${emailSentCount} certificate email${emailSentCount === 1 ? '' : 's'} sent.`);
  }

  if (sendEmail && emailFailedCount > 0) {
    pieces.push(`${emailFailedCount} certificate email${emailFailedCount === 1 ? '' : 's'} failed. Use Email PDF to retry.`);
  }

  return pieces.join(' ');
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
