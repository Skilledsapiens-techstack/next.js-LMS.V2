import { Award, BookOpen, CalendarDays, FileCheck2, Library, MessageCircle, PlayCircle, ShieldCheck, Video, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { JsonRecord, StudentDashboard, StudentProfile, useStudentDashboard, useStudentProfile } from '../features/student/useStudentDashboard';
import { useStudentRecordings } from '../features/student/useStudentRecordings';
import { useStudentResources } from '../features/student/useStudentResources';
import { useStudentSchedule } from '../features/student/useStudentSchedule';

type SummaryCard = {
  caption: string;
  icon: LucideIcon;
  label: string;
  path: string;
  value: string;
};

type DashboardRow = {
  area: string;
  count: number;
  path: string;
  notes: string;
};

type ScopedCounts = {
  recordings: number;
  resources: number;
  schedule: number;
};

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function pickArray(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function countFromBundle(bundle: JsonRecord, keys: string[]) {
  return pickArray(bundle, keys).length;
}

function formatName(profile?: StudentProfile) {
  return profile?.fullName || 'Student';
}

function buildSummaryCards(data: StudentDashboard | undefined, counts: ScopedCounts): SummaryCard[] {
  return [
    {
      caption: 'Completed sessions ready to watch',
      icon: Video,
      label: 'Recordings',
      path: '/student/recordings',
      value: String(counts.recordings)
    },
    {
      caption: 'Upcoming live classes and workshops',
      icon: CalendarDays,
      label: 'Schedule',
      path: '/student/schedule',
      value: String(counts.schedule)
    },
    {
      caption: 'Templates, compendiums, and links',
      icon: Library,
      label: 'Resources',
      path: '/student/resources',
      value: String(counts.resources)
    },
    {
      caption: 'Guided live project work',
      icon: FileCheck2,
      label: 'Projects',
      path: '/student/projects',
      value: String(data ? countFromBundle(data.projects, ['projects', 'items']) : 0)
    },
    {
      caption: 'Achievements and status',
      icon: Award,
      label: 'Certificates',
      path: '/student/certificates',
      value: String(data ? countFromBundle(data.certificates, ['certificates', 'items']) : 0)
    }
  ];
}

function buildRows(data: StudentDashboard | undefined, counts: ScopedCounts): DashboardRow[] {
  if (!data) {
    return [];
  }

  return [
    {
      area: 'Announcements',
      count: countFromBundle(data.dashboard, ['announcements']),
      notes: 'Priority updates and cohort notices published for your learner access.',
      path: '/student/announcements'
    },
    {
      area: 'Recordings',
      count: counts.recordings,
      notes: 'Completed sessions available for your enrolled programs and cohorts.',
      path: '/student/recordings'
    },
    {
      area: 'Schedule',
      count: counts.schedule,
      notes: 'Upcoming live sessions currently visible for your profile.',
      path: '/student/schedule'
    },
    {
      area: 'Resources',
      count: counts.resources,
      notes: 'Curated learning material unlocked for your program and cohort access.',
      path: '/student/resources'
    },
    {
      area: 'Projects',
      count: countFromBundle(data.projects, ['projects', 'items']),
      notes: 'Live project catalog and guided submission areas.',
      path: '/student/projects'
    },
    {
      area: 'Certificates',
      count: countFromBundle(data.certificates, ['certificates', 'items']),
      notes: 'Certificate status and eligible achievement records.',
      path: '/student/certificates'
    }
  ];
}

export function StudentDashboardPage() {
  const profileQuery = useStudentProfile();
  const dashboardQuery = useStudentDashboard();
  const recordingsQuery = useStudentRecordings({ accessType: 'all', limit: 1, page: 1, source: 'all' });
  const scheduleQuery = useStudentSchedule({ accessType: 'all', limit: 1, page: 1, status: 'all' });
  const resourcesQuery = useStudentResources({ accessType: 'all', limit: 1, page: 1 });
  const profile = dashboardQuery.data?.student ?? profileQuery.data;
  const isLoading = profileQuery.isLoading || dashboardQuery.isLoading || recordingsQuery.isLoading || scheduleQuery.isLoading || resourcesQuery.isLoading;
  const isError = profileQuery.isError || dashboardQuery.isError || recordingsQuery.isError || scheduleQuery.isError || resourcesQuery.isError;
  const scopedCounts = {
    recordings: recordingsQuery.data?.total ?? 0,
    resources: resourcesQuery.data?.total ?? 0,
    schedule: scheduleQuery.data?.total ?? 0
  };
  const summaryCards = buildSummaryCards(dashboardQuery.data, scopedCounts);
  const rows = buildRows(dashboardQuery.data, scopedCounts);
  const hasAnyRecords = rows.some((row) => row.count > 0);
  const trackRoles = asArray(profile?.trackRoleIds).filter((role): role is string => typeof role === 'string');
  const verifiedCohortName = profile?.cohortName?.trim();

  if (isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your learning workspace." eyebrow="Student dashboard" title="Welcome back" />
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-stack">
        <PageHeader description="The dashboard could not be loaded right now." eyebrow="Student dashboard" title="Dashboard unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack student-dashboard">
      <PageHeader
        description="Your learning hub for live classes, recordings, resources, projects, and certificates."
        eyebrow="Student dashboard"
        title={`Welcome, ${formatName(profile)}`}
      />

      <section className="student-hero">
        <div className="student-hero__identity">
          <span className="eyebrow">Learner profile</span>
          <h2>{profile?.programName ?? 'Program not assigned'}</h2>
          {verifiedCohortName ? (
            <div className="student-cohort-list" aria-label="Assigned cohorts">
              <StatusBadge>{verifiedCohortName}</StatusBadge>
            </div>
          ) : (
            <p>Cohort assignment will appear here once available.</p>
          )}
          <div className="student-hero__actions">
            <Link className="student-action student-action--primary" to="/student/recordings">
              <PlayCircle size={18} />
              Watch recordings
            </Link>
            <Link className="student-action" to="/student/resources">
              <Library size={18} />
              Open resources
            </Link>
          </div>
        </div>
        <div className="student-hero__meta">
          <article>
            <span>Email</span>
            <strong>{profile?.email ?? 'Not available'}</strong>
          </article>
          <article>
            <span>College</span>
            <strong>{profile?.collegeName ?? 'Not available'}</strong>
          </article>
          <article>
            <span>Student ID</span>
            <strong>{profile?.studentId ?? 'Not available'}</strong>
          </article>
          <article>
            <span>Access</span>
            <strong>{profile?.active ? 'Active' : 'Inactive'}</strong>
          </article>
        </div>
      </section>

      <div className="student-summary-grid">
        {summaryCards.map(({ caption, icon: Icon, label, path, value }) => (
          <Link className="student-summary-card" key={label} to={path}>
            <Icon size={22} />
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <p>{caption}</p>
            </div>
          </Link>
        ))}
      </div>

      <section className="student-focus-grid">
        <article className="student-focus-card">
          <div className="module-card__icon">
            <ShieldCheck size={20} />
          </div>
          <h2>Secure learning access</h2>
          <p>Your dashboard is personalized through your current portal session and protected account access.</p>
        </article>
        <article className="student-focus-card">
          <div className="module-card__icon">
            <MessageCircle size={20} />
          </div>
          <h2>Community</h2>
          <p>Connect with cohort updates and community activity as this area expands.</p>
        </article>
        <article className="student-focus-card">
          <div className="module-card__icon">
            <BookOpen size={20} />
          </div>
          <h2>Live project hub</h2>
          <p>Track project visibility and submission areas from one dedicated learning space.</p>
        </article>
      </section>

      {trackRoles.length > 0 ? (
        <div className="chip-row" aria-label="Track roles">
          {trackRoles.map((role) => (
            <StatusBadge key={role}>{role}</StatusBadge>
          ))}
        </div>
      ) : null}

      <section className="student-overview-panel">
        <div className="data-panel__header">
          <div>
            <h2>Learning overview</h2>
            <p>A quick view of your learning activity across the portal.</p>
          </div>
        </div>
        <div className="student-overview-list">
          {rows.map((row) => (
            <Link className="student-overview-item" key={row.area} to={row.path}>
              <div>
                <strong>{row.area}</strong>
                <p>{row.notes}</p>
              </div>
              <div className="student-overview-item__meta">
                <strong>{row.count}</strong>
                <span>Open</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {!hasAnyRecords ? <EmptyState /> : null}

      <StateBlock title="Need help?">
        Use Support for account, access, resource, project, or certificate questions. We keep private links and restricted content protected for eligible learners.
      </StateBlock>
    </div>
  );
}
