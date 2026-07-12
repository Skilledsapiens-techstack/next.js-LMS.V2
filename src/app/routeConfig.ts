import {
  BadgeIndianRupee,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Library,
  Mail,
  Megaphone,
  MessageCircle,
  MonitorCheck,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  UserCog,
  Users,
  Video,
  type LucideIcon
} from 'lucide-react';

export type Portal = 'student' | 'admin';

export type NavItem = {
  label: string;
  path: string;
  moduleId: string;
  icon: LucideIcon;
  mode: 'read-only' | 'disabled-write' | 'write';
};

export const studentNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/student', moduleId: 'dashboard', icon: LayoutDashboard, mode: 'read-only' },
  { label: 'My Programs', path: '/student/cohorts', moduleId: 'cohorts', icon: GraduationCap, mode: 'read-only' },
  { label: 'Watch Recordings', path: '/student/recordings', moduleId: 'recordings', icon: Video, mode: 'read-only' },
  { label: 'Upcoming Workshops', path: '/student/schedule', moduleId: 'schedule', icon: CalendarDays, mode: 'read-only' },
  { label: 'Resource Library', path: '/student/resources', moduleId: 'resources', icon: Library, mode: 'read-only' },
  { label: 'Live Project Hub', path: '/student/projects', moduleId: 'projects', icon: BookOpen, mode: 'read-only' },
  { label: 'My Submissions', path: '/student/project-submissions', moduleId: 'project-submissions', icon: ClipboardCheck, mode: 'read-only' },
  { label: 'Certificates', path: '/student/certificates', moduleId: 'certificates', icon: FileCheck2, mode: 'read-only' },
  { label: 'Community', path: '/student/community', moduleId: 'community', icon: MessageCircle, mode: 'read-only' },
  { label: 'Announcements', path: '/student/announcements', moduleId: 'announcements', icon: Megaphone, mode: 'read-only' },
  { label: 'Support', path: '/student/support', moduleId: 'support', icon: HelpCircle, mode: 'write' },
  { label: 'Payments & Access', path: '/student/payments', moduleId: 'payments', icon: BadgeIndianRupee, mode: 'read-only' }
];

export const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin', moduleId: 'dashboard', icon: LayoutDashboard, mode: 'read-only' },
  { label: 'Recordings', path: '/admin/recording-candidates', moduleId: 'recording-candidates', icon: Video, mode: 'read-only' },
  { label: 'Schedule Meeting', path: '/admin/workshops', moduleId: 'workshops', icon: CalendarDays, mode: 'read-only' },
  { label: 'Resources', path: '/admin/resources', moduleId: 'resources', icon: Library, mode: 'write' },
  { label: 'Students', path: '/admin/students', moduleId: 'students', icon: Users, mode: 'read-only' },
  { label: 'Cohorts', path: '/admin/cohorts', moduleId: 'cohorts', icon: GraduationCap, mode: 'read-only' },
  { label: 'Programs', path: '/admin/programs', moduleId: 'programs', icon: BookOpen, mode: 'read-only' },
  { label: 'Projects', path: '/admin/projects', moduleId: 'projects', icon: Library, mode: 'read-only' },
  { label: 'Submissions', path: '/admin/project-submissions', moduleId: 'project-submissions', icon: ClipboardCheck, mode: 'write' },
  { label: 'Certificates', path: '/admin/certificates', moduleId: 'certificates', icon: FileCheck2, mode: 'read-only' },
  { label: 'Enrollments', path: '/admin/enrollments', moduleId: 'enrollments', icon: Ticket, mode: 'read-only' },
  { label: 'Admin Users', path: '/admin/admin-users', moduleId: 'admin-users', icon: UserCog, mode: 'write' },
  { label: 'Community', path: '/admin/community', moduleId: 'community', icon: MessageCircle, mode: 'read-only' },
  { label: 'Announcements', path: '/admin/announcements', moduleId: 'announcements', icon: Megaphone, mode: 'read-only' },
  { label: 'Support', path: '/admin/support', moduleId: 'support', icon: HelpCircle, mode: 'write' },
  { label: 'Email Centre', path: '/admin/email-center', moduleId: 'email-center', icon: Mail, mode: 'write' },
  { label: 'Audit & Health', path: '/admin/observability', moduleId: 'observability', icon: MonitorCheck, mode: 'read-only' },
  { label: 'Feature Control', path: '/admin/feature-control', moduleId: 'feature-control', icon: SlidersHorizontal, mode: 'write' },
  { label: 'Payments', path: '/admin/payment-orders', moduleId: 'payment-orders', icon: BadgeIndianRupee, mode: 'read-only' },
  { label: 'Paid Access', path: '/admin/paid-access', moduleId: 'paid-access', icon: ShieldCheck, mode: 'read-only' }
];
