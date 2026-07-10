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
import { type StudentAnnouncement } from '../features/student/useStudentAnnouncements';
import { JsonRecord, StudentProfile, useStudentDashboard } from '../features/student/useStudentDashboard';
import { type StudentRecording } from '../features/student/useStudentRecordings';
import { type StudentResource } from '../features/student/useStudentResources';
import { type StudentScheduleItem, type StudentScheduleStatus } from '../features/student/useStudentSchedule';

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

type UnknownRecord = Record<string, unknown>;

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pickArray(record: unknown, keys: string[]) {
  if (Array.isArray(record)) {
    return record;
  }

  if (!isRecord(record)) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (isRecord(value) && Array.isArray(value.items)) {
      return value.items;
    }
  }

  return [];
}

function countFromBundle(bundle: JsonRecord | undefined, keys: string[]) {
  return pickArray(bundle, keys).length;
}

function firstValue(record: unknown, keys: string[]) {
  if (!isRecord(record)) return undefined;
  return keys.map((key) => record[key]).find((value) => value !== undefined && value !== null);
}

function textValue(record: unknown, keys: string[]) {
  const value = firstValue(record, keys);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function booleanValue(record: unknown, keys: string[], fallback = false) {
  const value = firstValue(record, keys);
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(record: unknown, keys: string[]) {
  const value = firstValue(record, keys);
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function stringArrayValue(record: unknown, keys: string[]) {
  const value = firstValue(record, keys);
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function dateTimeValue(record: unknown, keys: string[]) {
  const value = textValue(record, keys);
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatName(profile?: StudentProfile) {
  return profile?.fullName || 'Student';
}

function uniqueNames(names: Array<string | undefined>) {
  const seen = new Set<string>();
  return names
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name))
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

function isVisibleAnnouncementNow(item: unknown) {
  if (!isRecord(item)) return false;

  const status = String(firstValue(item, ['status', 'announcement_status', 'announcementStatus']) ?? 'active').toLowerCase();
  if (status && status !== 'active') return false;

  const now = Date.now();
  const startDate = textValue(item, ['start_date', 'startDate']);
  const endDate = textValue(item, ['end_date', 'endDate']);
  const startsAt = startDate ? new Date(startDate).getTime() : Number.NaN;
  const endsAt = endDate ? new Date(endDate).getTime() : Number.NaN;

  if (!Number.isNaN(startsAt) && startsAt > now) return false;
  if (!Number.isNaN(endsAt) && endsAt < now) return false;

  return true;
}

function mapAnnouncement(item: unknown): StudentAnnouncement | null {
  const title = textValue(item, ['title']);
  if (!title) return null;

  return {
    announcementId: textValue(item, ['announcement_id', 'announcementId']),
    audience: textValue(item, ['audience']),
    cohortNames: stringArrayValue(item, ['cohort_names', 'cohortNames']),
    endDate: textValue(item, ['end_date', 'endDate']),
    id: textValue(item, ['id', 'announcement_id', 'announcementId']) ?? title,
    linkLabel: textValue(item, ['link_label', 'linkLabel']),
    linkUrl: textValue(item, ['link_url', 'linkUrl']),
    message: textValue(item, ['message']) ?? '',
    pinned: booleanValue(item, ['pinned']),
    priority: textValue(item, ['priority']) === 'urgent' ? 'urgent' : 'normal',
    programKeys: stringArrayValue(item, ['program_keys', 'programKeys']),
    startDate: textValue(item, ['start_date', 'startDate']),
    title,
    type: textValue(item, ['type']),
    updatedAt: textValue(item, ['updated_at', 'updatedAt'])
  };
}

function mapResource(item: unknown): StudentResource | null {
  const title = textValue(item, ['title']);
  if (!title) return null;

  const accessType = textValue(item, ['access_type', 'accessType']) === 'paid' ? 'paid' : 'free';
  return {
    accessType,
    cohortNames: stringArrayValue(item, ['cohort_names', 'cohortNames']),
    currency: textValue(item, ['currency']),
    description: textValue(item, ['description']),
    hasAccess: booleanValue(item, ['has_access', 'hasAccess'], true),
    id: textValue(item, ['id', 'resource_id', 'resourceId']) ?? title,
    locked: booleanValue(item, ['locked']),
    lockReason: textValue(item, ['lock_reason', 'lockReason']),
    paymentLink: textValue(item, ['payment_link', 'paymentLink']),
    phase: textValue(item, ['phase']),
    price: numberValue(item, ['price']),
    programKeys: stringArrayValue(item, ['program_keys', 'programKeys']),
    resourceId: textValue(item, ['resource_id', 'resourceId']),
    resourceMode: textValue(item, ['resource_mode', 'resourceMode']),
    resourceType: textValue(item, ['resource_type', 'resourceType']) ?? 'Learning resource',
    title,
    updatedAt: textValue(item, ['updated_at', 'updatedAt']),
    url: textValue(item, ['url'])
  };
}

function mapRecording(item: unknown): StudentRecording | null {
  const status = textValue(item, ['status', 'workshop_status', 'workshopStatus']);
  const youtubeUrl = textValue(item, ['youtube_video_url', 'youtubeVideoUrl']);
  const zoomUrl = textValue(item, ['zoom_recording_url', 'zoomRecordingUrl']);
  const recordingUrl = textValue(item, ['recording_url', 'recordingUrl']) ?? youtubeUrl ?? zoomUrl;
  const title = textValue(item, ['title']);
  if (status !== 'Completed' || !recordingUrl || !title) return null;

  return {
    accessType: textValue(item, ['access_type', 'accessType']) === 'paid' ? 'paid' : 'free',
    cohortNames: stringArrayValue(item, ['cohort_names', 'cohortNames']),
    currency: textValue(item, ['currency']),
    date: textValue(item, ['date']) ?? '',
    domainKey: textValue(item, ['domain_key', 'domainKey']),
    durationMinutes: numberValue(item, ['duration_minutes', 'durationMinutes']),
    hasAccess: booleanValue(item, ['has_access', 'hasAccess'], true),
    id: textValue(item, ['id', 'workshop_id', 'workshopId']) ?? `${title}-${recordingUrl}`,
    locked: booleanValue(item, ['locked']),
    lockReason: textValue(item, ['lock_reason', 'lockReason']),
    paymentLink: textValue(item, ['payment_link', 'paymentLink']),
    price: numberValue(item, ['price']),
    programKey: textValue(item, ['program_key', 'programKey']),
    recordingPassword: textValue(item, ['recording_password', 'recordingPassword', 'zoom_recording_password', 'zoomRecordingPassword']),
    recordingUrl,
    source: youtubeUrl ? 'youtube' : 'zoom',
    time: textValue(item, ['time']),
    title,
    workshopId: textValue(item, ['workshop_id', 'workshopId'])
  };
}

function mapScheduleItem(item: unknown): StudentScheduleItem | null {
  const status = textValue(item, ['status', 'workshop_status', 'workshopStatus']);
  const scheduleStatus = ['Upcoming', 'Scheduled', 'Live'].includes(status ?? '') ? (status as StudentScheduleStatus) : undefined;
  const title = textValue(item, ['title']);
  if (!scheduleStatus || !title) return null;

  return {
    accessType: textValue(item, ['access_type', 'accessType']) === 'paid' ? 'paid' : 'free',
    cohortNames: stringArrayValue(item, ['cohort_names', 'cohortNames']),
    currency: textValue(item, ['currency']),
    date: textValue(item, ['date']) ?? '',
    domainKey: textValue(item, ['domain_key', 'domainKey']),
    durationMinutes: numberValue(item, ['duration_minutes', 'durationMinutes']),
    hasAccess: booleanValue(item, ['has_access', 'hasAccess'], true),
    id: textValue(item, ['id', 'workshop_id', 'workshopId']) ?? title,
    joinUrl: textValue(item, ['join_url', 'joinUrl']),
    locked: booleanValue(item, ['locked']),
    lockReason: textValue(item, ['lock_reason', 'lockReason']),
    paymentLink: textValue(item, ['payment_link', 'paymentLink']),
    price: numberValue(item, ['price']),
    programKey: textValue(item, ['program_key', 'programKey']),
    status: scheduleStatus,
    time: textValue(item, ['time']),
    title,
    workshopId: textValue(item, ['workshop_id', 'workshopId'])
  };
}

function takeMapped<TItem>(items: unknown[], mapper: (item: unknown) => TItem | null, limit = 3) {
  return items.map(mapper).filter((item): item is TItem => Boolean(item)).slice(0, limit);
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

  if (!item.locked && item.hasAccess !== false && item.joinUrl) {
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
  const dashboardQuery = useStudentDashboard();
  const profile = dashboardQuery.data?.student;
  const isLoading = dashboardQuery.isLoading;
  const isError = dashboardQuery.isError;
  const dashboardItems = pickArray(dashboardQuery.data?.dashboard, ['workshops']);
  const resourceItemsAll = takeMapped(pickArray(dashboardQuery.data?.resources, ['resources', 'items']), mapResource, 500).sort(
    (left, right) => dateTimeValue(right, ['updatedAt']) - dateTimeValue(left, ['updatedAt'])
  );
  const scheduleItemsAll = takeMapped(dashboardItems, mapScheduleItem, 500).sort((left, right) => {
    const leftValue = `${left.date ?? ''} ${left.time ?? ''}`;
    const rightValue = `${right.date ?? ''} ${right.time ?? ''}`;
    return leftValue.localeCompare(rightValue);
  });
  const recordingItemsAll = takeMapped(dashboardItems, mapRecording, 500);
  const announcementItemsAll = takeMapped(
    pickArray(dashboardQuery.data?.dashboard, ['announcements']).filter(isVisibleAnnouncementNow).sort((left, right) => dateTimeValue(right, ['updated_at', 'updatedAt']) - dateTimeValue(left, ['updated_at', 'updatedAt'])),
    mapAnnouncement,
    500
  );
  const scopedCounts = {
    announcements: announcementItemsAll.length,
    certificates: countFromBundle(dashboardQuery.data?.certificates, ['certificates', 'items']),
    projects: countFromBundle(dashboardQuery.data?.projects, ['projects', 'items']),
    recordings: recordingItemsAll.length,
    resources: resourceItemsAll.length,
    schedule: scheduleItemsAll.length
  };
  const summaryCards = buildSummaryCards(scopedCounts);
  const trackRoles = asArray(profile?.trackRoleIds).filter((role): role is string => typeof role === 'string');
  const liveProjectRoles = uniqueNames(asArray(profile?.liveProjectRoles).filter((role): role is string => typeof role === 'string'));
  const cohortNames = uniqueNames([
    ...pickArray(dashboardQuery.data?.dashboard, ['cohorts', 'studentCohorts']).map((cohort) => textValue(cohort, ['name', 'cohort_name', 'cohortName'])),
    profile?.cohortName
  ]);
  const scheduleItems = scheduleItemsAll.slice(0, 3);
  const recordingItems = recordingItemsAll.slice(0, 3);
  const resourceItems = resourceItemsAll.slice(0, 3);
  const lockedResourceItems = resourceItemsAll.filter((resource) => resource.accessType === 'paid' && resource.locked).slice(0, 3);
  const announcementItems = announcementItemsAll.slice(0, 3);
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
            {cohortNames.length ? cohortNames.map((cohortName) => <StatusBadge key={cohortName}>{cohortName}</StatusBadge>) : <StatusBadge>Cohort pending</StatusBadge>}
            <StatusBadge>{profile?.active ? 'Active access' : 'Inactive access'}</StatusBadge>
            {trackRoles.slice(0, 2).map((role) => (
              <StatusBadge key={role}>{role}</StatusBadge>
            ))}
          </div>
          {liveProjectRoles.length > 0 ? (
            <div className="student-live-project-roles" aria-label="Assigned live project roles">
              <span>Live Project Role</span>
              <div>
                {liveProjectRoles.map((role) => (
                  <StatusBadge key={role}>{role}</StatusBadge>
                ))}
              </div>
            </div>
          ) : null}
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
