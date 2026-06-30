import { Activity, AlertTriangle, BadgeIndianRupee, BookOpen, FileCheck2, GraduationCap, Headphones, Radio, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { AdminDashboard, AdminProfile, useAdminDashboard, useAdminProfile } from '../features/admin/useAdminDashboard';
import { JsonRecord } from '../features/student/useStudentDashboard';

type SummaryCard = {
  caption: string;
  featured?: boolean;
  icon: LucideIcon;
  label: string;
  value: string;
};

type DashboardRow = {
  area: string;
  count: number;
  notes: string;
  status: string;
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

function formatName(profile?: AdminProfile) {
  return profile?.fullName || profile?.email || 'Admin';
}

function formatRole(profile?: AdminProfile) {
  if (!profile?.role) return 'Admin';
  return profile.role
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildSummaryCards(data?: AdminDashboard): SummaryCard[] {
  const summary = data?.summary ?? {};

  return [
    {
      caption: 'Active learners',
      featured: true,
      icon: Users,
      label: 'Total students',
      value: String(countFromSummary(summary, [['students', 'active'], ['students', 'total'], ['active_students'], ['students']]))
    },
    {
      caption: 'Running batches',
      icon: GraduationCap,
      label: 'Cohorts',
      value: String(countFromSummary(summary, [['cohorts', 'active'], ['cohorts', 'total'], ['active_cohorts'], ['cohorts']]))
    },
    {
      caption: 'Learning library',
      icon: Radio,
      label: 'Recordings',
      value: String(countFromSummary(summary, [['publishedRecordings', 'total'], ['recordings', 'published'], ['recordings', 'total']]))
    },
    {
      caption: 'Orders to review',
      icon: BadgeIndianRupee,
      label: 'Payments',
      value: String(countFromSummary(summary, [['payments', 'pending'], ['payment_orders', 'pending'], ['payments', 'total'], ['payment_orders']]))
    },
    {
      caption: 'Project/certificate queues',
      icon: FileCheck2,
      label: 'Reviews',
      value: String(countFromSummary(summary, [['project_submissions', 'pending'], ['certificate_requests', 'pending'], ['reviews', 'pending'], ['reviews']]))
    },
    {
      caption: 'Open learner help',
      icon: Headphones,
      label: 'Support',
      value: String(countFromSummary(summary, [['support', 'open'], ['support_tickets', 'open'], ['support', 'total'], ['support_tickets']]))
    }
  ];
}

function buildRows(data?: AdminDashboard): DashboardRow[] {
  const summary = data?.summary ?? {};

  return [
    {
      area: 'Students',
      count: countFromSummary(summary, [['students', 'active'], ['students', 'total'], ['active_students'], ['students']]),
      notes: 'Active learner records available for operational review.',
      status: 'Live'
    },
    {
      area: 'Payments and access',
      count: countFromSummary(summary, [['payments', 'pending'], ['payment_orders', 'pending'], ['paid_access', 'active'], ['payments']]),
      notes: 'Payment and access records ready for review and reconciliation planning.',
      status: 'Controlled'
    },
    {
      area: 'Projects and certificates',
      count: countFromSummary(summary, [['project_submissions', 'pending'], ['certificate_requests', 'pending'], ['reviews', 'pending'], ['certificates']]),
      notes: 'Project and certificate queues available for admin visibility.',
      status: 'Live'
    },
    {
      area: 'Support',
      count: countFromSummary(summary, [['support', 'open'], ['support_tickets', 'open'], ['support', 'total']]),
      notes: 'Support queue health and open requests are visible here.',
      status: 'Live'
    }
  ];
}

const dashboardColumns: DataColumn<DashboardRow>[] = [
  {
    header: 'Area',
    key: 'area',
    render: (item) => <strong>{item.area}</strong>
  },
  {
    header: 'Visible count',
    key: 'count',
    render: (item) => <strong className="numeric-cell">{item.count}</strong>
  },
  {
    header: 'Mode',
    key: 'status',
    render: (item) => <StatusBadge tone={item.status === 'Controlled' ? 'warning' : 'safe'}>{item.status}</StatusBadge>
  },
  {
    header: 'Notes',
    key: 'notes',
    render: (item) => item.notes
  }
];

export function AdminDashboardPage() {
  const profileQuery = useAdminProfile();
  const dashboardQuery = useAdminDashboard();
  const profile = dashboardQuery.data?.admin ?? profileQuery.data;
  const isLoading = profileQuery.isLoading || dashboardQuery.isLoading;
  const isError = profileQuery.isError || dashboardQuery.isError;
  const summaryCards = buildSummaryCards(dashboardQuery.data);
  const rows = buildRows(dashboardQuery.data);
  const hasAnyRecords = rows.some((row) => row.count > 0);

  if (isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your admin workspace." eyebrow="Admin dashboard" title="Operations overview" />
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
      <PageHeader description="Your command view for students, cohorts, operations, and learner support." eyebrow="Admin dashboard" title={`Welcome, ${formatName(profile)}`} />

      <section className="admin-hero">
        <div className="admin-hero__identity">
          <span className="eyebrow">Administration</span>
          <h2>{formatRole(profile)} workspace</h2>
          <p>{profile?.email ?? 'Admin email not available'}</p>
          <div className="admin-hero__badges" aria-label="Admin session status">
            <StatusBadge tone="safe">{profile?.status ?? 'Active'}</StatusBadge>
            <StatusBadge>Protected session</StatusBadge>
          </div>
        </div>
        <div className="admin-hero__meta">
          <article>
            <span>Status</span>
            <strong>{profile?.status ?? 'Unknown'}</strong>
          </article>
          <article>
            <span>Admin ID</span>
            <strong>{profile?.id ?? 'Not available'}</strong>
          </article>
          <article>
            <span>Workspace</span>
            <strong>Admin</strong>
          </article>
          <article>
            <span>Session</span>
            <strong>Protected</strong>
          </article>
        </div>
      </section>

      <div className="admin-summary-grid">
        {summaryCards.map(({ caption, featured, icon: Icon, label, value }) => (
          <article className={featured ? 'admin-summary-card admin-summary-card--featured' : 'admin-summary-card'} key={label}>
            <Icon size={22} />
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <p>{caption}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="admin-insight-grid">
        <article className="module-card">
          <div className="module-card__icon">
            <ShieldCheck size={20} />
          </div>
          <h2>Protected admin access</h2>
          <p>Admin routes are protected through account role checks and workspace permissions.</p>
        </article>
        <article className="module-card">
          <div className="module-card__icon">
            <AlertTriangle size={20} />
          </div>
          <h2>Controlled operations</h2>
          <p>High-impact workflows are introduced carefully with workflow-specific QA.</p>
        </article>
        <article className="module-card">
          <div className="module-card__icon">
            <Activity size={20} />
          </div>
          <h2>Stable at scale</h2>
          <p>Module screens use focused data loading patterns for busy cohorts and admin teams.</p>
        </article>
        <article className="module-card">
          <div className="module-card__icon">
            <BookOpen size={20} />
          </div>
          <h2>Structured review queues</h2>
          <p>Students, learning content, submissions, and support areas are separated for faster daily operations.</p>
        </article>
      </section>

      <DataPanel columns={dashboardColumns} description="A quick view of key operating areas and current queue volume." items={rows} title="Operations overview" />

      {!hasAnyRecords ? <EmptyState /> : null}

      <StateBlock title="Production control">
        Sensitive admin actions will be enabled only after each workflow is reviewed, tested, and approved for production use.
      </StateBlock>
    </div>
  );
}
