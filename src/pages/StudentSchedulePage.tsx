import { CalendarDays, ExternalLink, Lock, Radio, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentScheduleItem, StudentScheduleStatus, useStudentSchedule } from '../features/student/useStudentSchedule';

const pageSize = 25;

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
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

function buildPageLink(page: number) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  return `?${params.toString()}`;
}

function ScheduleRow({ item }: { item: StudentScheduleItem }) {
  const canJoin = hasScheduleAccess(item) && Boolean(item.joinUrl);
  const programLabel = getProgramLabel(item);

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
      </div>
    </article>
  );
}

export function StudentSchedulePage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const scheduleQuery = useStudentSchedule({ limit: 500, page: 1 });
  const scheduleItems = useMemo(() => sortScheduleItems(scheduleQuery.data?.items ?? []), [scheduleQuery.data?.items]);
  const total = scheduleItems.length;
  const totalPages = totalPagesFor(total);
  const safePage = Math.min(page, totalPages);
  const visibleItems = paginateItems(scheduleItems, safePage);
  const lockedCount = useMemo(() => scheduleItems.filter((item) => item.locked).length, [scheduleItems]);
  const liveCount = useMemo(() => scheduleItems.filter((item) => item.status === 'Live').length, [scheduleItems]);
  const joinableCount = useMemo(() => scheduleItems.filter((item) => hasScheduleAccess(item) && item.joinUrl).length, [scheduleItems]);
  const nextSession = scheduleItems.find((item) => item.status === 'Live') ?? scheduleItems[0];

  if (scheduleQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading workshops visible to your student profile." eyebrow="Upcoming workshops" title="Upcoming Workshops" />
        <LoadingState />
      </div>
    );
  }

  if (scheduleQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Upcoming workshops could not be loaded right now." eyebrow="Upcoming workshops" title="Upcoming Workshops unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack student-schedule-page">
      <PageHeader
        description="Track live and scheduled workshops available to your account."
        eyebrow="Upcoming workshops"
        title="Upcoming Workshops"
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

      {visibleItems.length > 0 ? (
        <section className="student-schedule-list" aria-label="Visible workshops">
          {visibleItems.map((item) => (
            <ScheduleRow item={item} key={item.id} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Upcoming workshops pagination">
        {safePage > 1 ? (
          <Link className="pagination-link" to={buildPageLink(safePage - 1)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {safePage} of {totalPages} · {total} matching
        </span>
        {safePage < totalPages ? (
          <Link className="pagination-link" to={buildPageLink(safePage + 1)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {lockedCount > 0 ? <LockedState /> : null}

      <StateBlock title="Upcoming Workshops access">
        Only sessions mapped to your account are shown here. Join links and paid access stay protected for eligible learners.
      </StateBlock>
    </div>
  );
}
