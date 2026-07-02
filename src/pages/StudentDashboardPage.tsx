import {
  ArrowRight,
  Award,
  CalendarDays,
  Clock3,
  ExternalLink,
  FileCheck2,
  Library,
  Lock,
  Megaphone,
  PlayCircle,
  Video,
  type LucideIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentAnnouncement, useStudentAnnouncements } from '../features/student/useStudentAnnouncements';
import { JsonRecord, StudentProfile, useStudentDashboard, useStudentProfile } from '../features/student/useStudentDashboard';
import { StudentRecording, useStudentRecordings } from '../features/student/useStudentRecordings';
import { StudentResource, useStudentResources } from '../features/student/useStudentResources';
import { StudentScheduleItem, useStudentSchedule } from '../features/student/useStudentSchedule';

type SummaryCard = {
  caption: string;
  icon: LucideIcon;
  label: string;
  path: string;
  value: string;
};

type ScopedCounts = {
  announcements: number;
  certificates: number;
  projects: number;
  recordings: number;
  resources: number;
  schedule: number;
};

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function pickArray(record: JsonRecord | undefined, keys: string[]) {
  if (!record) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function countFromBundle(bundle: JsonRecord | undefined, keys: string[]) {
  return pickArray(bundle, keys).length;
}

function formatName(profile?: StudentProfile) {
  return profile?.fullName || 'Student';
}

function formatDate(value?: string) {
  if (!value) {
    return 'Date pending';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    weekday: 'short'
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Recently updated';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short'
  }).format(date);
}

function formatScheduleTime(item?: StudentScheduleItem) {
  if (!item) {
    return 'Time pending';
  }

  const parts = [formatDate(item.date), item.time, item.durationMinutes ? `${item.durationMinutes} min` : undefined].filter(Boolean);
  return parts.join(' · ');
}

function getResourceNote(resource: StudentResource) {
  if (resource.locked && resource.price) {
    return `${resource.currency ?? 'INR'} ${resource.price} payment required`;
  }

  if (resource.locked) {
    return resource.lockReason ?? 'Access required';
  }

  return resource.resourceType || 'Learning resource';
}

function buildSummaryCards(counts: ScopedCounts): SummaryCard[] {
  return [
    {
      caption: 'Join-ready live sessions',
      icon: CalendarDays,
      label: 'Schedule',
      path: '/student/schedule',
      value: String(counts.schedule)
    },
    {
      caption: 'Completed sessions to watch',
      icon: Video,
      label: 'Recordings',
      path: '/student/recordings',
      value: String(counts.recordings)
    },
    {
      caption: 'Templates and useful links',
      icon: Library,
      label: 'Resources',
      path: '/student/resources',
      value: String(counts.resources)
    },
    {
      caption: 'Guided work and submissions',
      icon: FileCheck2,
      label: 'Projects',
      path: '/student/projects',
      value: String(counts.projects)
    },
    {
      caption: 'Certificate status',
      icon: Award,
      label: 'Certificates',
      path: '/student/certificates',
      value: String(counts.certificates)
    }
  ];
}

function getSessionAction(item?: StudentScheduleItem) {
  if (!item) {
    return { label: 'View schedule', path: '/student/schedule' };
  }

  if (!item.locked && item.hasAccess && item.joinUrl) {
    return { href: item.joinUrl, label: item.status === 'Live' ? 'Join live class' : 'Open meeting link' };
  }

  return { label: 'View schedule', path: '/student/schedule' };
}

function renderItemList<TItem>({
  emptyText,
  items,
  renderItem
}: {
  emptyText: string;
  items: TItem[];
  renderItem: (item: TItem) => JSX.Element;
}) {
  if (items.length === 0) {
    return <p className="student-muted-state">{emptyText}</p>;
  }

  return <div className="student-learning-list">{items.map(renderItem)}</div>;
}

export function StudentDashboardPage() {
  const profileQuery = useStudentProfile();
  const dashboardQuery = useStudentDashboard();
  const announcementsQuery = useStudentAnnouncements({ limit: 3, page: 1, priority: 'all' });
  const recordingsQuery = useStudentRecordings({ accessType: 'all', limit: 3, page: 1, source: 'all' });
  const scheduleQuery = useStudentSchedule({ accessType: 'all', limit: 3, page: 1, status: 'all' });
  const resourcesQuery = useStudentResources({ accessType: 'all', limit: 3, locked: 'all', page: 1 });
  const lockedResourcesQuery = useStudentResources({ accessType: 'paid', limit: 3, locked: true, page: 1 });
  const profile = dashboardQuery.data?.student ?? profileQuery.data;
  const isLoading = profileQuery.isLoading || dashboardQuery.isLoading;
  const isError = profileQuery.isError || dashboardQuery.isError;
  const scopedCounts = {
    announcements: announcementsQuery.data?.total ?? countFromBundle(dashboardQuery.data?.dashboard, ['announcements']),
    certificates: countFromBundle(dashboardQuery.data?.certificates, ['certificates', 'items']),
    projects: countFromBundle(dashboardQuery.data?.projects, ['projects', 'items']),
    recordings: recordingsQuery.data?.total ?? 0,
    resources: resourcesQuery.data?.total ?? 0,
    schedule: scheduleQuery.data?.total ?? 0
  };
  const summaryCards = buildSummaryCards(scopedCounts);
  const trackRoles = asArray(profile?.trackRoleIds).filter((role): role is string => typeof role === 'string');
  const verifiedCohortName = profile?.cohortName?.trim();
  const scheduleItems = scheduleQuery.data?.items ?? [];
  const recordingItems = recordingsQuery.data?.items ?? [];
  const resourceItems = resourcesQuery.data?.items ?? [];
  const lockedResourceItems = lockedResourcesQuery.data?.items ?? [];
  const announcementItems = announcementsQuery.data?.items ?? [];
  const nextSession = scheduleItems[0];
  const sessionAction = getSessionAction(nextSession);

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
        description="A quick home base for your next class, latest material, resources, projects, and important updates."
        eyebrow="Student dashboard"
        title={`Welcome, ${formatName(profile)}`}
      />

      <section className="student-home-hero">
        <div className="student-home-hero__main">
          <span className="eyebrow">Learner profile</span>
          <h2>{profile?.programName ?? 'Program not assigned'}</h2>
          <div className="student-profile-strip" aria-label="Student profile details">
            <span>{profile?.email ?? 'Email not available'}</span>
            <span>{profile?.studentId ?? 'Student ID pending'}</span>
            <span>{profile?.collegeName ?? 'College not available'}</span>
          </div>
          <div className="student-cohort-list" aria-label="Assigned cohorts">
            {verifiedCohortName ? <StatusBadge>{verifiedCohortName}</StatusBadge> : <StatusBadge>Cohort pending</StatusBadge>}
            <StatusBadge>{profile?.active ? 'Active access' : 'Inactive access'}</StatusBadge>
            {trackRoles.slice(0, 2).map((role) => (
              <StatusBadge key={role}>{role}</StatusBadge>
            ))}
          </div>
        </div>
        <div className="student-home-actions">
          <Link className="student-action student-action--primary" to="/student/schedule">
            <CalendarDays size={18} />
            View schedule
          </Link>
          <Link className="student-action" to="/student/recordings">
            <PlayCircle size={18} />
            Continue learning
          </Link>
        </div>
      </section>

      <div className="student-summary-grid">
        {summaryCards.map(({ caption, icon: Icon, label, path, value }) => (
          <Link className="student-summary-card" key={label} to={path}>
            <Icon size={20} />
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <p>{caption}</p>
            </div>
          </Link>
        ))}
      </div>

      <section className="student-home-grid">
        <article className="student-panel student-next-session">
          <div className="student-panel__header">
            <div>
              <span className="eyebrow">Next up</span>
              <h2>{nextSession?.title ?? 'No live class available'}</h2>
            </div>
            {nextSession ? <StatusBadge>{nextSession.status}</StatusBadge> : null}
          </div>
          <p>{nextSession ? formatScheduleTime(nextSession) : 'When a scheduled or live class is available for your cohort, it will appear here.'}</p>
          {nextSession?.cohortNames.length ? <span className="student-panel__fineprint">{nextSession.cohortNames.join(', ')}</span> : null}
          <div className="student-panel__footer">
            {'href' in sessionAction ? (
              <a className="student-action student-action--primary" href={sessionAction.href} rel="noreferrer" target="_blank">
                <ExternalLink size={18} />
                {sessionAction.label}
              </a>
            ) : (
              <Link className="student-action student-action--primary" to={sessionAction.path}>
                <ArrowRight size={18} />
                {sessionAction.label}
              </Link>
            )}
          </div>
        </article>

        <article className="student-panel">
          <div className="student-panel__header">
            <div>
              <span className="eyebrow">Action required</span>
              <h2>Items to review</h2>
            </div>
            <Lock size={20} />
          </div>
          {renderItemList<StudentResource>({
            emptyText: 'No locked paid resources need your attention right now.',
            items: lockedResourceItems,
            renderItem: (resource) => (
              <Link className="student-learning-row" key={resource.id} to="/student/resources">
                <div>
                  <strong>{resource.title}</strong>
                  <span>{getResourceNote(resource)}</span>
                </div>
                <ArrowRight size={16} />
              </Link>
            )
          })}
        </article>
      </section>

      <section className="student-home-grid student-home-grid--three">
        <article className="student-panel">
          <div className="student-panel__header">
            <div>
              <span className="eyebrow">Continue</span>
              <h2>Recent recordings</h2>
            </div>
            <Link className="student-panel__link" to="/student/recordings">
              View all
            </Link>
          </div>
          {renderItemList<StudentRecording>({
            emptyText: 'Recordings published for your access will appear here.',
            items: recordingItems,
            renderItem: (recording) => (
              <Link className="student-learning-row" key={recording.id} to="/student/recordings">
                <Video size={18} />
                <div>
                  <strong>{recording.title}</strong>
                  <span>{[formatDate(recording.date), recording.source?.toUpperCase()].filter(Boolean).join(' · ')}</span>
                </div>
              </Link>
            )
          })}
        </article>

        <article className="student-panel">
          <div className="student-panel__header">
            <div>
              <span className="eyebrow">Resources</span>
              <h2>Recently available</h2>
            </div>
            <Link className="student-panel__link" to="/student/resources">
              View all
            </Link>
          </div>
          {renderItemList<StudentResource>({
            emptyText: 'Resources mapped to your access will appear here.',
            items: resourceItems,
            renderItem: (resource) => (
              <Link className="student-learning-row" key={resource.id} to="/student/resources">
                {resource.locked ? <Lock size={18} /> : <Library size={18} />}
                <div>
                  <strong>{resource.title}</strong>
                  <span>{getResourceNote(resource)}</span>
                </div>
              </Link>
            )
          })}
        </article>

        <article className="student-panel">
          <div className="student-panel__header">
            <div>
              <span className="eyebrow">Updates</span>
              <h2>Announcements</h2>
            </div>
            <Link className="student-panel__link" to="/student/announcements">
              View all
            </Link>
          </div>
          {renderItemList<StudentAnnouncement>({
            emptyText: 'Important announcements will appear here.',
            items: announcementItems,
            renderItem: (announcement) => (
              <Link className="student-learning-row" key={announcement.id} to="/student/announcements">
                <Megaphone size={18} />
                <div>
                  <strong>{announcement.title}</strong>
                  <span>{announcement.pinned ? 'Pinned' : formatDateTime(announcement.updatedAt)}</span>
                </div>
              </Link>
            )
          })}
        </article>
      </section>

      <section className="student-shortcut-grid" aria-label="Student dashboard shortcuts">
        <Link className="student-shortcut-card" to="/student/schedule">
          <Clock3 size={18} />
          <span>Live classes</span>
        </Link>
        <Link className="student-shortcut-card" to="/student/projects">
          <FileCheck2 size={18} />
          <span>Projects</span>
        </Link>
        <Link className="student-shortcut-card" to="/student/certificates">
          <Award size={18} />
          <span>Certificates</span>
        </Link>
        <Link className="student-shortcut-card" to="/student/support">
          <Megaphone size={18} />
          <span>Support</span>
        </Link>
      </section>

      <StateBlock title="Need help?">
        Use Support for account, access, resource, project, or certificate questions. Private links and restricted content stay protected for eligible learners.
      </StateBlock>
    </div>
  );
}
