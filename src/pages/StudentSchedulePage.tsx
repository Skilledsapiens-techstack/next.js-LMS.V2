import { CalendarDays, ExternalLink, HelpCircle, Lock, Radio, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentScheduleAccessType, StudentScheduleItem, StudentScheduleStatus, useStudentSchedule } from '../features/student/useStudentSchedule';

type AccessFilter = StudentScheduleAccessType | 'all';

const pageSize = 25;

const accessFilters: Array<{ label: string; value: AccessFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Paid', value: 'paid' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function asAccessType(value: string | null): AccessFilter {
  return value === 'free' || value === 'paid' ? value : 'all';
}

function formatDate(value: string | undefined) {
  if (!value) return 'Not set';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatShortDate(value: string | undefined) {
  if (!value) return 'Date not set';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function formatDuration(value: number | undefined | null) {
  return value == null ? 'Duration not set' : `${value} min`;
}

function formatPrice(item: StudentScheduleItem) {
  if (item.price == null) {
    return item.accessType === 'paid' ? 'Paid' : 'Free';
  }

  return `${item.currency ?? 'INR'} ${item.price}`;
}

function statusTone(status: StudentScheduleStatus) {
  return status === 'Live' ? 'warning' : status === 'Upcoming' || status === 'Scheduled' ? 'safe' : 'neutral';
}

function hasScheduleAccess(item: StudentScheduleItem) {
  return !item.locked && item.hasAccess !== false;
}

function getProgramLabel(item: StudentScheduleItem) {
  return item.programKey || item.domainKey;
}

function getScheduledAt(item: StudentScheduleItem) {
  const dateMatch = item.date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = item.time?.match(/^(\d{1,2}):(\d{2})/);

  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;
    const scheduledAt = new Date(Number(year), Number(month) - 1, Number(day), hour, minute);
    return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
  }

  const scheduledAt = new Date(item.date);
  return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
}

function sortScheduleItems(items: StudentScheduleItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = getScheduledAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = getScheduledAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
}

function paginateItems<TItem>(items: TItem[], page: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function totalPagesFor(count: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

function buildPageLink(page: number, accessType: AccessFilter) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (accessType !== 'all') params.set('accessType', accessType);
  return `?${params.toString()}`;
}

function ScheduleRow({ item }: { item: StudentScheduleItem }) {
  const canJoin = hasScheduleAccess(item) && Boolean(item.joinUrl);
  const programLabel = getProgramLabel(item);
  const supportLink = `/student/support?subject=${encodeURIComponent(`Schedule issue: ${item.title}`)}`;

  return (
    <article className="student-schedule-row">
      <div className={item.status === 'Live' ? 'student-schedule-row__date student-schedule-row__date--live' : 'student-schedule-row__date'}>
        <CalendarDays size={17} />
        <strong>{formatShortDate(item.date)}</strong>
        <span>{item.time ? `${item.time} IST` : 'Time not set'}</span>
      </div>

      <div className="student-schedule-row__main">
        <div className="student-schedule-row__title">
          <strong>{item.title}</strong>
          <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
          <StatusBadge tone={item.locked ? 'warning' : 'safe'}>{item.locked ? 'Locked' : 'Available'}</StatusBadge>
        </div>
        <p>
          {formatDate(item.date)} · {item.time ? `${item.time} IST` : 'Time not set'} · {formatDuration(item.durationMinutes)}
        </p>
        <div className="student-schedule-row__meta">
          {programLabel ? <span>{programLabel}</span> : null}
          <span>{formatPrice(item)}</span>
        </div>
        {item.locked ? (
          <div className="student-schedule-row__notice">
            <Lock size={15} />
            <span>{item.lockReason ?? 'This session is locked for your account.'}</span>
          </div>
        ) : null}
      </div>

      <div className="student-schedule-row__actions">
        {canJoin ? (
          <a className="student-action student-action--primary" href={item.joinUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Join session
          </a>
        ) : item.paymentLink ? (
          <a className="student-action student-action--primary" href={item.paymentLink} rel="noreferrer" target="_blank">
            <Lock size={16} />
            Pay to unlock
          </a>
        ) : null}
        <Link className="student-action" to={supportLink}>
          <HelpCircle size={16} />
          Report issue
        </Link>
      </div>
    </article>
  );
}

export function StudentSchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessType = asAccessType(searchParams.get('accessType'));
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const scheduleQuery = useStudentSchedule({ accessType, limit: 500, page: 1 });
  const scheduleItems = useMemo(() => sortScheduleItems(scheduleQuery.data?.items ?? []), [scheduleQuery.data?.items]);
  const total = scheduleItems.length;
  const totalPages = totalPagesFor(total);
  const safePage = Math.min(page, totalPages);
  const visibleItems = paginateItems(scheduleItems, safePage);
  const lockedCount = useMemo(() => scheduleItems.filter((item) => item.locked).length, [scheduleItems]);
  const liveCount = useMemo(() => scheduleItems.filter((item) => item.status === 'Live').length, [scheduleItems]);
  const joinableCount = useMemo(() => scheduleItems.filter((item) => hasScheduleAccess(item) && item.joinUrl).length, [scheduleItems]);
  const nextSession = scheduleItems.find((item) => item.status === 'Live') ?? scheduleItems[0];

  function updateAccessType(nextAccessType: AccessFilter) {
    const next = new URLSearchParams();
    next.set('page', '1');
    if (nextAccessType !== 'all') {
      next.set('accessType', nextAccessType);
    }
    setSearchParams(next);
  }

  if (scheduleQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading workshops visible to your student profile." eyebrow="Student schedule" title="Schedule" />
        <LoadingState />
      </div>
    );
  }

  if (scheduleQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Schedule could not be loaded right now." eyebrow="Student schedule" title="Schedule unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack student-schedule-page">
      <PageHeader
        description="Track live and scheduled workshops available to your account."
        eyebrow="Student schedule"
        title="Schedule"
      />

      <section className="student-schedule-hero" aria-label="Next session">
        <div>
          <span>Next session</span>
          <strong>{nextSession?.title ?? 'No scheduled sessions'}</strong>
          <p>{nextSession ? `${formatDate(nextSession.date)} · ${nextSession.time ? `${nextSession.time} IST` : 'Time not set'} · ${formatDuration(nextSession.durationMinutes)}` : 'New sessions will appear here once scheduled.'}</p>
        </div>
        {nextSession && hasScheduleAccess(nextSession) && nextSession.joinUrl ? (
          <a className="student-action student-action--primary" href={nextSession.joinUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Join session
          </a>
        ) : null}
      </section>

      <div className="student-schedule-summary">
        <article>
          <CalendarDays size={20} />
          <span>Visible sessions</span>
          <strong>{total}</strong>
        </article>
        <article>
          <Radio size={20} />
          <span>Live now</span>
          <strong>{liveCount}</strong>
        </article>
        <article>
          <ShieldCheck size={20} />
          <span>Joinable</span>
          <strong>{joinableCount}</strong>
        </article>
        <article>
          <Lock size={20} />
          <span>Locked</span>
          <strong>{lockedCount}</strong>
        </article>
      </div>

      <section className="student-schedule-chips" aria-label="Schedule filters">
        {accessFilters.map((filter) => (
          <button className={`segmented-button ${accessType === filter.value ? 'segmented-button--active' : ''}`} key={filter.value} onClick={() => updateAccessType(filter.value)} type="button">
            {filter.label}
          </button>
        ))}
      </section>

      {visibleItems.length > 0 ? (
        <section className="student-schedule-list" aria-label="Visible workshops">
          {visibleItems.map((item) => (
            <ScheduleRow item={item} key={item.id} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Schedule pagination">
        {safePage > 1 ? (
          <Link className="pagination-link" to={buildPageLink(safePage - 1, accessType)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {safePage} of {totalPages} · {total} matching
        </span>
        {safePage < totalPages ? (
          <Link className="pagination-link" to={buildPageLink(safePage + 1, accessType)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {lockedCount > 0 ? <LockedState /> : null}

      <StateBlock title="Schedule access">
        Only sessions mapped to your account are shown here. If a session is missing or a join link does not work, use Report issue with the session name and program details.
      </StateBlock>
    </div>
  );
}
