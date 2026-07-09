import {
  Activity,
  AlertTriangle,
  BadgeIndianRupee,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileWarning,
  GraduationCap,
  Headphones,
  LifeBuoy,
  Link as LinkIcon,
  ListChecks,
  MonitorCheck,
  PlusCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
  Video,
  WalletCards,
  type LucideIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminDashboardDrilldowns, AdminProfile, useAdminDashboard, useAdminDashboardDrilldowns, useAdminProfile } from '../features/admin/useAdminDashboard';
import { getAdminRoleLabel } from '../auth/adminPermissions';
import { JsonRecord } from '../features/student/useStudentDashboard';

type MetricCard = {
  caption: string;
  icon: LucideIcon;
  label: string;
  tone?: 'accent' | 'safe' | 'warning' | 'danger';
  value: string;
};

type QueueItem = {
  count: number;
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: 'safe' | 'warning' | 'danger' | 'neutral';
};

type HealthItem = {
  caption: string;
  icon: LucideIcon;
  label: string;
  tone: 'safe' | 'warning' | 'danger' | 'neutral';
  value: string;
};

type LearningItem = {
  caption: string;
  icon: LucideIcon;
  label: string;
  stats: Array<{ label: string; value: number }>;
};

type PipelineSignal = {
  caption: string;
  icon: LucideIcon;
  label: string;
  tone: 'safe' | 'warning' | 'danger' | 'neutral';
  value: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function valueAtPath(record: JsonRecord, path: string[]): unknown {
  let current: unknown = record;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function countFromSummary(summary: JsonRecord, paths: string[][]) {
  for (const path of paths) {
    const value = valueAtPath(summary, path);
    if (Array.isArray(value)) return value.length;
    const numeric = asNumber(value);
    if (numeric !== undefined) return numeric;
  }

  return 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatName(profile?: AdminProfile) {
  return profile?.fullName || profile?.email || 'Admin';
}

function formatRole(profile?: AdminProfile) {
  if (!profile?.role) return 'Admin';
  return getAdminRoleLabel(profile.role);
}

function formatUpdatedAt(value?: number) {
  if (!value) return 'Not refreshed yet';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  }).format(new Date(value));
}

function textFromItem(item: JsonRecord, paths: string[][], fallback = 'Not available') {
  for (const path of paths) {
    const value = valueAtPath(item, path);
    if (Array.isArray(value)) {
      const entries = value.map((entry) => String(entry).trim()).filter(Boolean);
      if (entries.length) return entries.join(', ');
    }
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return formatNumber(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  }

  return fallback;
}

function formatDateText(value: string) {
  if (!value || value === 'Not available') return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(parsed);
}

function buildLiveMetrics(summary: JsonRecord): MetricCard[] {
  const activeStudents = countFromSummary(summary, [['students', 'active'], ['students', 'total'], ['activeStudents']]);
  const totalStudents = countFromSummary(summary, [['students', 'total']]);
  const activeCohorts = countFromSummary(summary, [['cohorts', 'active']]);
  const upcomingCohorts = countFromSummary(summary, [['cohorts', 'upcoming']]);
  const upcomingWorkshops = countFromSummary(summary, [['workshops', 'upcoming']]);
  const completedWorkshops = countFromSummary(summary, [['workshops', 'completed']]);
  const recordings = countFromSummary(summary, [['publishedRecordings', 'total'], ['recordings', 'published'], ['recordings', 'total'], ['workshops', 'recordings']]);
  const activeResources = countFromSummary(summary, [['resources', 'active']]);

  return [
    {
      caption: `${formatNumber(totalStudents)} total records`,
      icon: Users,
      label: 'Active students',
      tone: 'accent',
      value: formatNumber(activeStudents)
    },
    {
      caption: `${formatNumber(upcomingCohorts)} upcoming`,
      icon: GraduationCap,
      label: 'Active cohorts',
      value: formatNumber(activeCohorts)
    },
    {
      caption: `${formatNumber(completedWorkshops)} completed`,
      icon: CalendarDays,
      label: 'Upcoming workshops',
      value: formatNumber(upcomingWorkshops)
    },
    {
      caption: 'Published learning library',
      icon: Radio,
      label: 'Recordings',
      value: formatNumber(recordings)
    },
    {
      caption: 'Visible active resources',
      icon: BookOpen,
      label: 'Resources',
      value: formatNumber(activeResources)
    },
    {
      caption: 'Students, admins, sessions',
      icon: Activity,
      label: 'Active last hour',
      tone: 'safe',
      value: formatNumber(countFromSummary(summary, [['activeUsers', 'totalLastHour']]))
    }
  ];
}

function buildHealthItems(summary: JsonRecord): HealthItem[] {
  const recentErrors = countFromSummary(summary, [['operations', 'recentErrors']]);
  const recentAdminActions = countFromSummary(summary, [['operations', 'recentAdminActions']]);
  const failedPayments = countFromSummary(summary, [['payments', 'failed']]);
  const activeUsers = countFromSummary(summary, [['activeUsers', 'totalLastHour']]);
  const studentUsers = countFromSummary(summary, [['activeUsers', 'studentsLastHour']]);
  const adminUsers = countFromSummary(summary, [['activeUsers', 'adminsLastHour']]);

  return [
    {
      caption: 'Last 24 hours',
      icon: AlertTriangle,
      label: 'System errors',
      tone: recentErrors > 0 ? 'danger' : 'safe',
      value: formatNumber(recentErrors)
    },
    {
      caption: 'Last 24 hours',
      icon: ClipboardCheck,
      label: 'Admin actions',
      tone: recentAdminActions > 0 ? 'neutral' : 'warning',
      value: formatNumber(recentAdminActions)
    },
    {
      caption: 'Payment order failures',
      icon: BadgeIndianRupee,
      label: 'Failed payments',
      tone: failedPayments > 0 ? 'danger' : 'safe',
      value: formatNumber(failedPayments)
    },
    {
      caption: `${formatNumber(studentUsers)} students, ${formatNumber(adminUsers)} admins`,
      icon: MonitorCheck,
      label: 'Live users',
      tone: activeUsers > 0 ? 'safe' : 'neutral',
      value: formatNumber(activeUsers)
    }
  ];
}

function buildQueueItems(summary: JsonRecord): QueueItem[] {
  const paymentReview = countFromSummary(summary, [['payments', 'created'], ['payments', 'pending']]);
  const failedPayments = countFromSummary(summary, [['payments', 'failed']]);
  const enrollmentPending = countFromSummary(summary, [['enrollments', 'pending']]);
  const projectPending = countFromSummary(summary, [['projectSubmissions', 'pending'], ['project_submissions', 'pending']]);
  const certificatePending = countFromSummary(summary, [['certificateRequests', 'pending'], ['certificate_requests', 'pending']]);
  const supportOpen = countFromSummary(summary, [['support', 'open'], ['supportTickets', 'open'], ['support_tickets', 'open']]);

  return [
    {
      count: paymentReview + failedPayments,
      description: `${formatNumber(paymentReview)} created, ${formatNumber(failedPayments)} failed`,
      href: '/admin/payment-orders',
      icon: WalletCards,
      label: 'Payment review',
      tone: failedPayments > 0 ? 'danger' : paymentReview > 0 ? 'warning' : 'safe'
    },
    {
      count: enrollmentPending,
      description: 'Paid or assigned enrollment requests',
      href: '/admin/enrollments',
      icon: LinkIcon,
      label: 'Enrollment follow-up',
      tone: enrollmentPending > 0 ? 'warning' : 'safe'
    },
    {
      count: projectPending,
      description: 'Submitted or under review',
      href: '/admin/project-submissions',
      icon: FileCheck2,
      label: 'Project reviews',
      tone: projectPending > 0 ? 'warning' : 'safe'
    },
    {
      count: certificatePending,
      description: 'Pending or approved requests',
      href: '/admin/certificate-requests',
      icon: ClipboardCheck,
      label: 'Certificate queue',
      tone: certificatePending > 0 ? 'warning' : 'safe'
    },
    {
      count: supportOpen,
      description: 'Learner help tickets',
      href: '/admin/support',
      icon: Headphones,
      label: 'Support queue',
      tone: supportOpen > 0 ? 'warning' : 'safe'
    }
  ];
}

function buildLearningItems(summary: JsonRecord): LearningItem[] {
  return [
    {
      caption: 'Batch health across the LMS',
      icon: GraduationCap,
      label: 'Cohorts',
      stats: [
        { label: 'Active', value: countFromSummary(summary, [['cohorts', 'active']]) },
        { label: 'Upcoming', value: countFromSummary(summary, [['cohorts', 'upcoming']]) },
        { label: 'Completed', value: countFromSummary(summary, [['cohorts', 'completed']]) },
        { label: 'Inactive', value: countFromSummary(summary, [['cohorts', 'inactive']]) }
      ]
    },
    {
      caption: 'Live schedule and recorded sessions',
      icon: Video,
      label: 'Workshops',
      stats: [
        { label: 'Upcoming', value: countFromSummary(summary, [['workshops', 'upcoming']]) },
        { label: 'Completed', value: countFromSummary(summary, [['workshops', 'completed']]) },
        { label: 'Recordings', value: countFromSummary(summary, [['workshops', 'recordings'], ['recordings', 'published'], ['publishedRecordings', 'total']]) }
      ]
    },
    {
      caption: 'Templates, links, and paid/free assets',
      icon: BookOpen,
      label: 'Resources',
      stats: [
        { label: 'Active', value: countFromSummary(summary, [['resources', 'active']]) },
        { label: 'Inactive', value: countFromSummary(summary, [['resources', 'inactive']]) },
        { label: 'Total', value: countFromSummary(summary, [['resources', 'total']]) }
      ]
    },
    {
      caption: 'Community content activity',
      icon: LifeBuoy,
      label: 'Community',
      stats: [
        { label: 'Groups', value: countFromSummary(summary, [['community', 'groups']]) },
        { label: 'Posts', value: countFromSummary(summary, [['community', 'posts']]) },
        { label: 'Comments', value: countFromSummary(summary, [['community', 'comments']]) }
      ]
    }
  ];
}

function buildPipelineSignals(summary: JsonRecord, drilldowns?: AdminDashboardDrilldowns): PipelineSignal[] {
  const upcoming = countFromSummary(summary, [['workshops', 'upcoming']]);
  const completed = countFromSummary(summary, [['workshops', 'completed']]);
  const published = countFromSummary(summary, [['workshops', 'recordings'], ['recordings', 'published'], ['publishedRecordings', 'total']]);
  const candidates = drilldowns?.recordingCandidates.total ?? countFromSummary(summary, [['recordingCandidates', 'total'], ['recording_candidates', 'total']]);

  return [
    {
      caption: 'Scheduled sessions that should have join links',
      icon: CalendarDays,
      label: 'Upcoming',
      tone: upcoming > 0 ? 'safe' : 'neutral',
      value: formatNumber(upcoming)
    },
    {
      caption: 'Finished sessions ready for recording review',
      icon: CheckCircle2,
      label: 'Completed',
      tone: completed > published ? 'warning' : 'safe',
      value: formatNumber(completed)
    },
    {
      caption: 'Published recordings visible in the LMS',
      icon: Radio,
      label: 'Published',
      tone: published > 0 ? 'safe' : 'neutral',
      value: formatNumber(published)
    },
    {
      caption: 'Fetched Zoom files waiting for admin decision',
      icon: FileWarning,
      label: 'Candidates',
      tone: candidates > 0 ? 'warning' : 'safe',
      value: formatNumber(candidates)
    }
  ];
}

const quickActions = [
  { icon: PlusCircle, label: 'Add student', path: '/admin/students' },
  { icon: GraduationCap, label: 'Create cohort', path: '/admin/cohorts' },
  { icon: CalendarDays, label: 'Schedule meeting', path: '/admin/workshops' },
  { icon: BookOpen, label: 'Add resource', path: '/admin/resources' },
  { icon: WalletCards, label: 'Review payments', path: '/admin/payment-orders' },
  { icon: Radio, label: 'Recordings', path: '/admin/recording-candidates' }
];

function sectionToneClass(tone: string) {
  return `admin-health-card admin-health-card--${tone}`;
}

export function AdminDashboardPage() {
  const profileQuery = useAdminProfile();
  const dashboardQuery = useAdminDashboard();
  const drilldownsQuery = useAdminDashboardDrilldowns();
  const profile = dashboardQuery.data?.admin ?? profileQuery.data;
  const summary = dashboardQuery.data?.summary ?? {};
  const isLoading = profileQuery.isLoading || dashboardQuery.isLoading;
  const isError = profileQuery.isError || dashboardQuery.isError;
  const liveMetrics = buildLiveMetrics(summary);
  const healthItems = buildHealthItems(summary);
  const queueItems = buildQueueItems(summary);
  const learningItems = buildLearningItems(summary);
  const pipelineSignals = buildPipelineSignals(summary, drilldownsQuery.data);
  const hasAttentionItems = queueItems.some((item) => item.count > 0) || healthItems.some((item) => item.tone === 'danger');
  const isRefreshing = dashboardQuery.isFetching || drilldownsQuery.isFetching;

  if (isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading live operating metrics." eyebrow="Admin dashboard" title="Operations command center" />
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-stack">
        <PageHeader description="The admin dashboard could not be loaded right now." eyebrow="Admin dashboard" title="Dashboard unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-dashboard">
      <PageHeader description="Live LMS operating view for students, cohorts, content, payments, support, and system health." eyebrow="Admin dashboard" title="Operations command center" />

      <section className="admin-command-bar">
        <div>
          <span className="eyebrow">Signed in</span>
          <h2>{formatName(profile)}</h2>
          <p>
            {formatRole(profile)} workspace · {profile?.email ?? 'Admin email not available'}
          </p>
        </div>
        <div className="admin-command-bar__meta">
          <StatusBadge tone="safe">{profile?.status ?? 'Active'}</StatusBadge>
          <StatusBadge>Protected session</StatusBadge>
          <span>
            <Clock3 size={15} />
            Refreshed {formatUpdatedAt(Math.max(dashboardQuery.dataUpdatedAt, drilldownsQuery.dataUpdatedAt))}
          </span>
          <button
            className="admin-refresh-button"
            type="button"
            disabled={isRefreshing}
            onClick={() => {
              void dashboardQuery.refetch();
              void drilldownsQuery.refetch();
            }}
          >
            <RefreshCw className={isRefreshing ? 'admin-spin' : undefined} size={16} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section__heading">
          <div>
            <span className="eyebrow">Live data summary</span>
            <h2>Current LMS snapshot</h2>
          </div>
          <p>Counts are pulled from the protected dashboard summary and scoped to operational visibility.</p>
        </div>
        <div className="admin-live-grid">
          {liveMetrics.map(({ caption, icon: Icon, label, tone, value }) => (
            <article className={tone ? `admin-live-card admin-live-card--${tone}` : 'admin-live-card'} key={label}>
              <Icon size={20} />
              <span>{label}</span>
              <strong>{value}</strong>
              <p>{caption}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-dashboard-grid">
        <div className="admin-section">
          <div className="admin-section__heading">
            <div>
              <span className="eyebrow">Operations</span>
              <h2>System health</h2>
            </div>
            <StatusBadge tone={healthItems.some((item) => item.tone === 'danger') ? 'danger' : 'safe'}>{healthItems.some((item) => item.tone === 'danger') ? 'Attention' : 'Healthy'}</StatusBadge>
          </div>
          <div className="admin-health-grid">
            {healthItems.map(({ caption, icon: Icon, label, tone, value }) => (
              <article className={sectionToneClass(tone)} key={label}>
                <Icon size={19} />
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <p>{caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="admin-section">
          <div className="admin-section__heading">
            <div>
              <span className="eyebrow">Today</span>
              <h2>Action queue</h2>
            </div>
            <StatusBadge tone={hasAttentionItems ? 'warning' : 'safe'}>{hasAttentionItems ? 'Review' : 'Clear'}</StatusBadge>
          </div>
          <div className="admin-queue-list">
            {queueItems.map(({ count, description, href, icon: Icon, label, tone }) => (
              <Link className="admin-queue-item" key={label} to={href}>
                <Icon size={19} />
                <div>
                  <strong>{label}</strong>
                  <p>{description}</p>
                </div>
                <StatusBadge tone={tone}>{formatNumber(count)}</StatusBadge>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section__heading">
          <div>
            <span className="eyebrow">Recording pipeline</span>
            <h2>Schedule and recording health</h2>
          </div>
          <p>Tracks scheduled sessions, completed workshops, published recordings, and fetched candidate files waiting for manual review.</p>
        </div>
        <div className="admin-pipeline-grid">
          {pipelineSignals.map(({ caption, icon: Icon, label, tone, value }) => (
            <article className={`admin-pipeline-card admin-pipeline-card--${tone}`} key={label}>
              <Icon size={18} />
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <p>{caption}</p>
              </div>
            </article>
          ))}
        </div>
        {drilldownsQuery.data && (
          <div className="admin-pipeline-lists">
            <article className="admin-pipeline-list">
              <div className="admin-pipeline-list__head">
                <strong>Latest recording candidates</strong>
                <Link to="/admin/recording-candidates">Review</Link>
              </div>
              {drilldownsQuery.data.recordingCandidates.items.length ? (
                drilldownsQuery.data.recordingCandidates.items.map((item, index) => (
                  <Link className="admin-pipeline-row" key={String(item.id ?? item.zoomId ?? index)} to="/admin/recording-candidates">
                    <span>{textFromItem(item, [['workshopTitle'], ['workshopId'], ['zoomId']], 'Recording candidate')}</span>
                    <p>{textFromItem(item, [['zoomAccount'], ['recordingType'], ['fileType']], 'Zoom recording file')}</p>
                  </Link>
                ))
              ) : (
                <p className="admin-drilldown-empty">No recording candidates are waiting for review.</p>
              )}
            </article>

            <article className="admin-pipeline-list">
              <div className="admin-pipeline-list__head">
                <strong>Upcoming scheduled workshops</strong>
                <Link to="/admin/workshops">Open schedule</Link>
              </div>
              {drilldownsQuery.data.upcomingWorkshops.items.length ? (
                drilldownsQuery.data.upcomingWorkshops.items.map((item, index) => (
                  <Link className="admin-pipeline-row" key={String(item.id ?? item.workshopId ?? index)} to="/admin/workshops">
                    <span>{textFromItem(item, [['title'], ['workshopId']], 'Scheduled workshop')}</span>
                    <p>
                      {formatDateText(textFromItem(item, [['date']], 'Date pending'))} · {textFromItem(item, [['time']], 'Time pending')}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="admin-drilldown-empty">No scheduled workshops are in the compact queue.</p>
              )}
            </article>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section__heading">
          <div>
            <span className="eyebrow">Learning operations</span>
            <h2>Content, cohorts, and community</h2>
          </div>
          <p>Use this to spot inactive inventory and keep the learner experience current.</p>
        </div>
        <div className="admin-learning-grid">
          {learningItems.map(({ caption, icon: Icon, label, stats }) => (
            <article className="admin-learning-card" key={label}>
              <div className="admin-learning-card__title">
                <Icon size={20} />
                <div>
                  <strong>{label}</strong>
                  <p>{caption}</p>
                </div>
              </div>
              <div className="admin-learning-card__stats">
                {stats.map((stat) => (
                  <span key={stat.label}>
                    <b>{formatNumber(stat.value)}</b>
                    {stat.label}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section admin-shortcuts">
        <div className="admin-section__heading">
          <div>
            <span className="eyebrow">Shortcuts</span>
            <h2>Common admin actions</h2>
          </div>
          <p>Quick links to the modules admins usually need after reviewing the dashboard.</p>
        </div>
        <div className="admin-shortcut-grid">
          {quickActions.map(({ icon: Icon, label, path }) => (
            <Link className="admin-shortcut" key={label} to={path}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-readiness">
        <ListChecks size={20} />
        <div>
          <strong>Production readiness view</strong>
          <p>Use health, queue, and learning-operation signals together before making production-impacting decisions.</p>
        </div>
        <ShieldCheck size={20} />
      </section>
    </div>
  );
}
