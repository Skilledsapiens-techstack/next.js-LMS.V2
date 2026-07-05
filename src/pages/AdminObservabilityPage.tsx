import { Activity, AlertTriangle, Clock3, FileText, MonitorCheck, RefreshCw, Search, ShieldCheck, Users, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminObservability } from '../features/admin/useAdminObservability';
import { ObservabilitySummary } from '../features/admin/useAdminObservability';
import { JsonRecord } from '../features/student/useStudentDashboard';

const emptySummary: ObservabilitySummary = {
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

function asText(value: unknown, fallback = 'Not available') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return formatNumber(value);
  return fallback;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return 'Time not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  }).format(parsed);
}

function humanizeAction(action: unknown, entityType: unknown, details: unknown) {
  const actionText = asText(action, 'admin_action');
  const moduleName = asText(entityType, 'record').replace(/_/g, ' ');
  const detailRecord = typeof details === 'object' && details !== null && !Array.isArray(details) ? (details as JsonRecord) : {};
  const title = asText(detailRecord.title ?? detailRecord.name ?? detailRecord.fullName ?? detailRecord.email ?? detailRecord.templateName ?? detailRecord.ticketId, moduleName);
  const actionMap: Record<string, string> = {
    admin_certificate_leadership_issued: 'issued leadership certificate',
    admin_certificate_live_project_issued: 'issued live project certificate',
    admin_certificate_revoked: 'revoked certificate',
    admin_cohort_created: 'created cohort',
    admin_cohort_status_changed: 'changed cohort status',
    admin_cohort_updated: 'updated cohort',
    admin_email_center_sent: 'sent email',
    admin_feature_control_updated: 'updated feature control',
    admin_program_created: 'created program',
    admin_program_status_changed: 'changed program status',
    admin_program_updated: 'updated program',
    admin_resource_archived: 'archived resource',
    admin_resource_created: 'created resource',
    admin_resource_status_changed: 'changed resource status',
    admin_resource_updated: 'updated resource',
    admin_student_created: 'created student',
    admin_student_invite_queued: 'queued student invite',
    admin_student_onboarding_mail_queued: 'queued onboarding mail',
    admin_student_status_changed: 'changed student status',
    admin_student_updated: 'updated student',
    admin_support_ticket_updated: 'updated support ticket',
    admin_workshop_cancelled: 'cancelled meeting',
    admin_workshop_created: 'created meeting',
    admin_workshop_recording_published: 'published recording',
    admin_workshop_recording_rejected: 'rejected recording',
    admin_workshop_recording_updated: 'added or updated recording',
    admin_workshop_recordings_fetched: 'fetched meeting recordings',
    admin_workshop_rescheduled: 'rescheduled meeting',
    admin_workshop_status_changed: 'changed meeting status',
    admin_workshop_updated: 'edited meeting'
  };

  return `${actionMap[actionText] ?? actionText.replace(/^admin_/, '').replace(/_/g, ' ')} for ${title}`;
}

function actionTone(status: unknown) {
  return String(status ?? 'success').toLowerCase() === 'success' ? 'safe' : 'danger';
}

function eventTone(severity: unknown) {
  const value = String(severity ?? '').toLowerCase();
  if (value === 'critical' || value === 'error') return 'danger';
  if (value === 'warning') return 'warning';
  return 'safe';
}

export function AdminObservabilityPage() {
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('all');
  const [severity, setSeverity] = useState('all');
  const query = useAdminObservability({ limit: 20, module, search, severity });
  const summary = query.data?.summary ?? emptySummary;
  const auditLogs = query.data?.auditLogs.items ?? [];
  const eventLogs = query.data?.eventLogs.items ?? [];
  const alerts = query.data?.alerts.items ?? [];
  const recentStudents = summary.recentStudents;
  const recentlyChangedMeetings = summary.recentlyChangedMeetings;
  const isRefreshing = query.isFetching;

  const kpis = useMemo(
    () => [
      {
        caption: 'Updated at most once per 5 minutes',
        icon: Users,
        label: 'Active students, 1 hour',
        tone: 'safe',
        value: formatNumber(summary?.activeUsers.studentsLastHour ?? 0)
      },
      {
        caption: 'Admin/moderator actions in 24 hours',
        icon: ShieldCheck,
        label: 'Admin actions',
        tone: 'neutral',
        value: formatNumber(summary?.operations.recentAdminActions ?? 0)
      },
      {
        caption: 'Open lightweight alerts',
        icon: AlertTriangle,
        label: 'Open alerts',
        tone: (summary?.operations.openAlerts ?? 0) > 0 ? 'warning' : 'safe',
        value: formatNumber(summary?.operations.openAlerts ?? 0)
      },
      {
        caption: 'Important events only',
        icon: MonitorCheck,
        label: 'Errors, 24 hours',
        tone: (summary?.operations.recentErrors ?? 0) > 0 ? 'danger' : 'safe',
        value: formatNumber(summary?.operations.recentErrors ?? 0)
      }
    ],
    [summary]
  );

  if (query.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading lightweight audit and system health signals." eyebrow="Admin observability" title="Audit & health" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-observability">
      <PageHeader
        eyebrow="Admin observability"
        title="Audit & health"
        description="A lightweight operating view for important admin actions, active students, meetings, alerts, and critical failures."
        actions={
          <button className="admin-refresh-button" disabled={isRefreshing} onClick={() => void query.refetch()} type="button">
            <RefreshCw className={isRefreshing ? 'admin-spin' : undefined} size={16} />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        }
      />

      {query.isError ? (
        <section className="observability-soft-warning" aria-label="Limited observability notice">
          <AlertTriangle size={18} />
          <div>
            <strong>Live signals are limited</strong>
            <p>Some audit and health data is not available in this environment yet. The module is still loaded with lightweight fallback values.</p>
          </div>
        </section>
      ) : null}

      <section className="observability-kpi-grid" aria-label="Lightweight KPI summary">
        {kpis.map(({ caption, icon: Icon, label, tone, value }) => (
          <article className={`observability-kpi observability-kpi--${tone}`} key={label}>
            <Icon size={20} />
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{caption}</p>
          </article>
        ))}
      </section>

      <section className="observability-toolbar" aria-label="Audit filters">
        <label className="observability-search">
          <Search size={16} />
          <span className="sr-only">Search audit logs</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Search admin, module, or action" type="search" value={search} />
        </label>
        <label>
          <span>Module</span>
          <select onChange={(event) => setModule(event.target.value)} value={module}>
            <option value="all">All modules</option>
            <option value="student">Students</option>
            <option value="workshop">Meetings</option>
            <option value="certificate">Certificates</option>
            <option value="resource">Resources</option>
            <option value="cohort">Cohorts</option>
            <option value="support_ticket">Support</option>
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select onChange={(event) => setSeverity(event.target.value)} value={severity}>
            <option value="all">All severities</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        </label>
      </section>

      <section className="observability-grid">
        <div className="observability-panel observability-panel--wide">
          <div className="observability-panel__header">
            <div>
              <span className="eyebrow">Audit trail</span>
              <h2>Recent admin actions</h2>
            </div>
            <StatusBadge>{`${formatNumber(query.data?.auditLogs.total ?? 0)} records`}</StatusBadge>
          </div>
          <div className="observability-list">
            {auditLogs.length > 0 ? (
              auditLogs.map((item) => (
                <article className="observability-row" key={asText(item.id, `${item.action}-${item.createdAt}`)}>
                  <div className="observability-row__icon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <strong>{asText(item.actorName ?? item.actorEmail, 'Admin')} {humanizeAction(item.action, item.entityType, item.details)}</strong>
                    <span>{formatDateTime(item.createdAt)} · {asText(item.entityType, 'module').replace(/_/g, ' ')}</span>
                  </div>
                  <StatusBadge tone={actionTone(item.status)}>{asText(item.status, 'success')}</StatusBadge>
                </article>
              ))
            ) : (
              <p className="observability-empty">No matching audit records found.</p>
            )}
          </div>
        </div>

        <div className="observability-panel">
          <div className="observability-panel__header">
            <div>
              <span className="eyebrow">Student activity</span>
              <h2>Active users</h2>
            </div>
            <Activity size={19} />
          </div>
          <div className="observability-mini-grid">
            <div><span>5 minutes</span><strong>{formatNumber(summary.activeUsers.studentsLastFiveMinutes)}</strong></div>
            <div><span>1 hour</span><strong>{formatNumber(summary.activeUsers.studentsLastHour)}</strong></div>
            <div><span>Today</span><strong>{formatNumber(summary.activeUsers.studentsToday)}</strong></div>
          </div>
          <div className="observability-compact-list">
            {recentStudents.length > 0 ? recentStudents.map((student) => (
              <div key={asText(student.id, `${student.email}`)}>
                <strong>{asText(student.fullName ?? student.email, 'Student')}</strong>
                <span>{formatDateTime(student.lastSeenAt)} · {asText(student.programName ?? student.cohortName, 'Program not mapped')}</span>
              </div>
            )) : <p>No students active in the last hour.</p>}
          </div>
        </div>

        <div className="observability-panel">
          <div className="observability-panel__header">
            <div>
              <span className="eyebrow">Meetings</span>
              <h2>Lightweight meeting KPIs</h2>
            </div>
            <Video size={19} />
          </div>
          <div className="observability-mini-grid">
            <div><span>Created today</span><strong>{formatNumber(summary.meetings.createdToday)}</strong></div>
            <div><span>This week</span><strong>{formatNumber(summary.meetings.scheduledThisWeek)}</strong></div>
            <div><span>Cancelled</span><strong>{formatNumber(summary.meetings.cancelledThisWeek)}</strong></div>
            <div><span>Recordings today</span><strong>{formatNumber(summary.meetings.recordingsAddedToday)}</strong></div>
            <div><span>No recording</span><strong>{formatNumber(summary.meetings.withoutRecordings)}</strong></div>
          </div>
          <div className="observability-compact-list">
            {recentlyChangedMeetings.map((meeting) => (
              <div key={asText(meeting.id, `${meeting.title}`)}>
                <strong>{asText(meeting.title, 'Meeting')}</strong>
                <span>{asText(meeting.status, 'Status')} · {formatDateTime(meeting.updatedAt ?? meeting.date)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="observability-panel">
          <div className="observability-panel__header">
            <div>
              <span className="eyebrow">Alerts</span>
              <h2>Important failures</h2>
            </div>
            <AlertTriangle size={19} />
          </div>
          <div className="observability-compact-list">
            {alerts.length > 0 ? alerts.map((alert) => (
              <div key={asText(alert.id, `${alert.title}`)}>
                <strong>{asText(alert.title, 'Alert')}</strong>
                <span>{asText(alert.message)} · {formatDateTime(alert.createdAt)}</span>
              </div>
            )) : <p>No open alerts right now.</p>}
          </div>
        </div>

        <div className="observability-panel">
          <div className="observability-panel__header">
            <div>
              <span className="eyebrow">System events</span>
              <h2>Error logs</h2>
            </div>
            <Clock3 size={19} />
          </div>
          <div className="observability-compact-list">
            {eventLogs.length > 0 ? eventLogs.map((event) => (
              <div key={asText(event.id, `${event.eventType}`)}>
                <strong>{asText(event.message, 'System event')}</strong>
                <span>
                  <StatusBadge tone={eventTone(event.severity)}>{asText(event.severity, 'info')}</StatusBadge>
                  {asText(event.module, 'module')} · {formatDateTime(event.createdAt)}
                </span>
              </div>
            )) : <p>No important system errors logged.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
