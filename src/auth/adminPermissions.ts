export type AdminRoleKey = 'super_admin' | 'admin' | 'moderator';

export type AdminPermission =
  | 'admin.dashboard.view'
  | 'admin.students.view'
  | 'admin.students.manage'
  | 'admin.students.import'
  | 'admin.students.export'
  | 'admin.students.invite'
  | 'admin.cohorts.view'
  | 'admin.cohorts.manage'
  | 'admin.programs.view'
  | 'admin.programs.manage'
  | 'admin.projects.view'
  | 'admin.projects.manage'
  | 'admin.submissions.view'
  | 'admin.submissions.review'
  | 'admin.meetings.view'
  | 'admin.meetings.manage'
  | 'admin.recordings.view'
  | 'admin.recordings.manage'
  | 'admin.resources.view'
  | 'admin.resources.manage'
  | 'admin.certificates.view'
  | 'admin.certificates.issue'
  | 'admin.enrollments.view'
  | 'admin.announcements.view'
  | 'admin.announcements.manage'
  | 'admin.community.view'
  | 'admin.community.manage'
  | 'admin.support.view'
  | 'admin.support.manage'
  | 'admin.email.view'
  | 'admin.email.manage'
  | 'admin.observability.view'
  | 'admin.admin_users.view'
  | 'admin.admin_users.manage'
  | 'admin.feature_control.manage'
  | 'admin.payments.view'
  | 'admin.paid_access.view';

const ADMIN_READ_PERMISSIONS: AdminPermission[] = [
  'admin.dashboard.view',
  'admin.students.view',
  'admin.cohorts.view',
  'admin.programs.view',
  'admin.projects.view',
  'admin.submissions.view',
  'admin.meetings.view',
  'admin.recordings.view',
  'admin.resources.view',
  'admin.certificates.view',
  'admin.enrollments.view',
  'admin.announcements.view',
  'admin.community.view',
  'admin.support.view',
  'admin.observability.view'
];

const MODERATOR_READ_PERMISSIONS: AdminPermission[] = [
  'admin.dashboard.view',
  'admin.students.view',
  'admin.submissions.view',
  'admin.recordings.view',
  'admin.certificates.view',
  'admin.announcements.view',
  'admin.community.view',
  'admin.support.view',
  'admin.observability.view'
];

export const ROLE_LABELS: Record<AdminRoleKey, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  super_admin: 'Super Admin'
};

export const ROLE_PERMISSIONS: Record<AdminRoleKey, AdminPermission[]> = {
  super_admin: [
    ...ADMIN_READ_PERMISSIONS,
    'admin.students.manage',
    'admin.students.import',
    'admin.students.export',
    'admin.students.invite',
    'admin.cohorts.manage',
    'admin.programs.manage',
    'admin.projects.manage',
    'admin.submissions.review',
    'admin.meetings.manage',
    'admin.recordings.manage',
    'admin.resources.manage',
    'admin.certificates.issue',
    'admin.announcements.manage',
    'admin.community.manage',
    'admin.support.manage',
    'admin.email.view',
    'admin.email.manage',
    'admin.admin_users.view',
    'admin.admin_users.manage',
    'admin.feature_control.manage',
    'admin.payments.view',
    'admin.paid_access.view'
  ],
  admin: [
    ...ADMIN_READ_PERMISSIONS,
    'admin.students.manage',
    'admin.students.import',
    'admin.students.export',
    'admin.students.invite',
    'admin.cohorts.manage',
    'admin.programs.manage',
    'admin.projects.manage',
    'admin.submissions.review',
    'admin.meetings.manage',
    'admin.recordings.manage',
    'admin.resources.manage',
    'admin.certificates.issue',
    'admin.announcements.manage',
    'admin.community.manage',
    'admin.support.manage'
  ],
  moderator: [
    ...MODERATOR_READ_PERMISSIONS,
    'admin.submissions.review',
    'admin.recordings.manage',
    'admin.support.manage'
  ]
};

export const MODULE_VIEW_PERMISSIONS: Record<string, AdminPermission> = {
  announcements: 'admin.announcements.view',
  certificates: 'admin.certificates.view',
  cohorts: 'admin.cohorts.view',
  community: 'admin.community.view',
  dashboard: 'admin.dashboard.view',
  'email-center': 'admin.email.view',
  enrollments: 'admin.enrollments.view',
  'admin-users': 'admin.admin_users.view',
  'feature-control': 'admin.feature_control.manage',
  observability: 'admin.observability.view',
  'paid-access': 'admin.paid_access.view',
  'payment-orders': 'admin.payments.view',
  programs: 'admin.programs.view',
  projects: 'admin.projects.view',
  'project-submissions': 'admin.submissions.view',
  'recording-candidates': 'admin.recordings.view',
  resources: 'admin.resources.view',
  students: 'admin.students.view',
  support: 'admin.support.view',
  workshops: 'admin.meetings.view'
};

export type AdminPermissionModule = {
  description: string;
  id: string;
  label: string;
  permissions: AdminPermission[];
};

export const ADMIN_PERMISSION_MODULES: AdminPermissionModule[] = [
  {
    description: 'Dashboard summary and admin landing page.',
    id: 'dashboard',
    label: 'Dashboard',
    permissions: ['admin.dashboard.view']
  },
  {
    description: 'Roster, add/import/export students, invites, and student access changes.',
    id: 'students',
    label: 'Students',
    permissions: ['admin.students.view', 'admin.students.manage', 'admin.students.import', 'admin.students.export', 'admin.students.invite']
  },
  {
    description: 'Create and update cohorts.',
    id: 'cohorts',
    label: 'Cohorts',
    permissions: ['admin.cohorts.view', 'admin.cohorts.manage']
  },
  {
    description: 'Create and update programs.',
    id: 'programs',
    label: 'Programs',
    permissions: ['admin.programs.view', 'admin.programs.manage']
  },
  {
    description: 'Projects and project role setup.',
    id: 'projects',
    label: 'Projects',
    permissions: ['admin.projects.view', 'admin.projects.manage']
  },
  {
    description: 'Review and update project submissions.',
    id: 'submissions',
    label: 'Submissions',
    permissions: ['admin.submissions.view', 'admin.submissions.review']
  },
  {
    description: 'Schedule, edit, cancel, and review workshops.',
    id: 'meetings',
    label: 'Schedule Meetings',
    permissions: ['admin.meetings.view', 'admin.meetings.manage']
  },
  {
    description: 'Fetch, review, publish, and reject recordings.',
    id: 'recordings',
    label: 'Recordings',
    permissions: ['admin.recordings.view', 'admin.recordings.manage']
  },
  {
    description: 'Create and update learning resources.',
    id: 'resources',
    label: 'Resources',
    permissions: ['admin.resources.view', 'admin.resources.manage']
  },
  {
    description: 'Certificate requests, settings, and issuance.',
    id: 'certificates',
    label: 'Certificates',
    permissions: ['admin.certificates.view', 'admin.certificates.issue']
  },
  {
    description: 'Enrollment requests, exceptions, webhook events, and processing status.',
    id: 'enrollments',
    label: 'Enrollments',
    permissions: ['admin.enrollments.view']
  },
  {
    description: 'Announcements and admin communication notices.',
    id: 'announcements',
    label: 'Announcements',
    permissions: ['admin.announcements.view', 'admin.announcements.manage']
  },
  {
    description: 'Community groups, posts, and moderation.',
    id: 'community',
    label: 'Community',
    permissions: ['admin.community.view', 'admin.community.manage']
  },
  {
    description: 'Support tickets, replies, FAQs, categories, and settings.',
    id: 'support',
    label: 'Support',
    permissions: ['admin.support.view', 'admin.support.manage']
  },
  {
    description: 'Email centre templates, queue, and delivery health.',
    id: 'email',
    label: 'Email Centre',
    permissions: ['admin.email.view', 'admin.email.manage']
  },
  {
    description: 'Audit, logs, health, and lightweight monitoring signals.',
    id: 'observability',
    label: 'Audit & Health',
    permissions: ['admin.observability.view']
  },
  {
    description: 'Payment orders and payment issue review.',
    id: 'payments',
    label: 'Payments',
    permissions: ['admin.payments.view']
  },
  {
    description: 'Paid access review and overrides.',
    id: 'paid-access',
    label: 'Paid Access',
    permissions: ['admin.paid_access.view']
  }
];

export const SUPER_ADMIN_ONLY_PERMISSIONS: AdminPermission[] = ['admin.admin_users.view', 'admin.admin_users.manage', 'admin.feature_control.manage'];

export const ADMIN_PERMISSION_ALLOWLIST: AdminPermission[] = [
  ...ADMIN_PERMISSION_MODULES.flatMap((module) => module.permissions),
  ...SUPER_ADMIN_ONLY_PERMISSIONS
];

export function normalizeAdminRole(value: unknown): AdminRoleKey {
  const role = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (role === 'super_admin' || role === 'owner') return 'super_admin';
  if (role === 'admin' || role === 'operations') return 'admin';
  if (role === 'moderator' || role === 'mentor' || role === 'viewer') return 'moderator';
  return 'admin';
}

export function getAdminPermissions(role: unknown) {
  return ROLE_PERMISSIONS[normalizeAdminRole(role)];
}

export function getEffectiveAdminPermissions(role: unknown, customPermissions?: readonly AdminPermission[] | null) {
  const normalizedRole = normalizeAdminRole(role);
  if (normalizedRole === 'super_admin') return ROLE_PERMISSIONS.super_admin;
  if (Array.isArray(customPermissions)) return customPermissions.filter((permission) => ADMIN_PERMISSION_ALLOWLIST.includes(permission));
  return ROLE_PERMISSIONS[normalizedRole];
}

export function hasAdminPermission(role: unknown, permission?: AdminPermission, customPermissions?: readonly AdminPermission[] | null) {
  if (!permission) return true;
  if (role === undefined || role === null || String(role).trim() === '') return false;
  const normalizedRole = normalizeAdminRole(role);
  if (normalizedRole === 'super_admin') return true;
  return getEffectiveAdminPermissions(normalizedRole, customPermissions).includes(permission);
}

export function getAdminRoleLabel(role: unknown) {
  return ROLE_LABELS[normalizeAdminRole(role)];
}
