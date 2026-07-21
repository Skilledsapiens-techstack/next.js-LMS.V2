import { CalendarDays, ExternalLink, History, Lock, Radio, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentScheduleItem, StudentScheduleStatus, useStudentSchedule } from '../features/student/useStudentSchedule';

const pageSize = 25;
const scheduleViews = ['upcoming', 'past'] as const;

type ScheduleView = (typeof scheduleViews)[number];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function asScheduleView(value: string | null): ScheduleView {
  return value === 'past' ? 'past' : 'upcoming';
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

function statusTone(status: StudentScheduleStatus) {
  return status === 'Live' ? 'warning' : status === 'Upcoming' || status === 'Scheduled' ? 'safe' : 'neutral';
}

function hasScheduleAccess(item: StudentScheduleItem) {
  return !item.locked && item.hasAccess !== false;
}

function getDedupKey(item: StudentScheduleItem) {
  return item.title.trim().toLowerCase().replace(/\s+/g, ' ');
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

function getDurationMs(item: StudentScheduleItem) {
  const durationMinutes = Number(item.durationMinutes);
  return Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes * 60 * 1000 : 0;
}

function getScheduledEndAt(item: StudentScheduleItem) {
  const scheduledAt = getScheduledAt(item);
  if (!scheduledAt) return null;

  const durationMs = getDurationMs(item);
  return new Date(scheduledAt.getTime() + durationMs);
}

function isLiveByTime(item: StudentScheduleItem, now: number) {
  if (item.status === 'Completed') return false;

  const scheduledAt = getScheduledAt(item);
  const scheduledEndAt = getScheduledEndAt(item);
  if (!scheduledAt || !scheduledEndAt) return false;

  const startTime = scheduledAt.getTime();
  const endTime = scheduledEndAt.getTime();
  return startTime <= now && now < endTime;
}

function sortScheduleItems(items: StudentScheduleItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = getScheduledAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = getScheduledAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
}

function sortPastScheduleItems(items: StudentScheduleItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = getScheduledAt(left)?.getTime() ?? 0;
    const rightTime = getScheduledAt(right)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

function dedupePastScheduleItems(items: StudentScheduleItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getDedupKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPastSession(item: StudentScheduleItem, now: number) {
  if (item.status === 'Completed') return true;
  const scheduledEndAt = getScheduledEndAt(item);
  return Boolean(scheduledEndAt && scheduledEndAt.getTime() <= now);
}

function paginateItems<TItem>(items: TItem[], page: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function totalPagesFor(count: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

function buildPageLink(page: number, view: ScheduleView) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (view === 'past') params.set('view', view);
  return `?${params.toString()}`;
}

function ScheduleRow({ item, now, variant = 'upcoming' }: { item: StudentScheduleItem; now: number; variant?: ScheduleView }) {
  const canJoin = hasScheduleAccess(item) && Boolean(item.joinUrl);
  const isPast = variant === 'past';
  const displayStatus = isLiveByTime(item, now) ? 'Live' : item.status;

  return (
    <article className={isPast ? 'student-schedule-row student-schedule-row--expired' : 'student-schedule-row'}>
      <div className={displayStatus === 'Live' ? 'student-schedule-row__date student-schedule-row__date--live' : 'student-schedule-row__date'}>
        <CalendarDays size={17} />
        <strong>{formatShortDate(item.date)}</strong>
        <span>{item.time ? `${item.time} IST` : 'Time not set'}</span>
      </div>

      <div className="student-schedule-row__main">
        <div className="student-schedule-row__title">
          <strong>{item.title}</strong>
          {isPast ? <StatusBadge tone="neutral">Expired</StatusBadge> : <StatusBadge tone={statusTone(displayStatus)}>{displayStatus}</StatusBadge>}
        </div>
        <p>
          {formatDate(item.date)} · {item.time ? `${item.time} IST` : 'Time not set'} · {formatDuration(item.durationMinutes)}
        </p>
        {item.locked && !isPast ? (
          <div className="student-schedule-row__notice">
            <Lock size={15} />
            <span>{item.lockReason ?? 'This session is locked for your account.'}</span>
          </div>
        ) : null}
      </div>

      {!isPast ? <div className="student-schedule-row__actions">
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
      </div> : null}
    </article>
  );
}

export function StudentSchedulePage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const view = asScheduleView(searchParams.get('view'));
  const [now, setNow] = useState(() => Date.now());
  const scheduleQuery = useStudentSchedule({ includePast: true, limit: 500, page: 1 });

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const allScheduleItems = useMemo(() => scheduleQuery.data?.items ?? [], [scheduleQuery.data?.items]);
  const upcomingItems = useMemo(() => sortScheduleItems(allScheduleItems.filter((item) => !isPastSession(item, now))), [allScheduleItems, now]);
  const pastItems = useMemo(
    () => dedupePastScheduleItems(sortPastScheduleItems(allScheduleItems.filter((item) => isPastSession(item, now)))),
    [allScheduleItems, now]
  );
  const scheduleItems = view === 'past' ? pastItems : upcomingItems;
  const total = scheduleItems.length;
  const totalPages = totalPagesFor(total);
  const safePage = Math.min(page, totalPages);
  const visibleItems = paginateItems(scheduleItems, safePage);
  const lockedCount = useMemo(() => upcomingItems.filter((item) => item.locked).length, [upcomingItems]);
  const liveCount = useMemo(() => upcomingItems.filter((item) => isLiveByTime(item, now)).length, [upcomingItems, now]);
  const joinableCount = useMemo(() => upcomingItems.filter((item) => hasScheduleAccess(item) && item.joinUrl).length, [upcomingItems]);
  const nextSession = upcomingItems.find((item) => isLiveByTime(item, now)) ?? upcomingItems[0];

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
          <span>Upcoming</span>
          <strong>{upcomingItems.length}</strong>
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
        <article>
          <History size={20} />
          <span>Past sessions</span>
          <strong>{pastItems.length}</strong>
        </article>
      </div>

      <nav className="student-schedule-tabs" aria-label="Workshop schedule views">
        <Link className={view === 'upcoming' ? 'student-schedule-tab student-schedule-tab--active' : 'student-schedule-tab'} to="?page=1">
          <span>Upcoming Workshops</span>
          <strong>{upcomingItems.length}</strong>
        </Link>
        <Link className={view === 'past' ? 'student-schedule-tab student-schedule-tab--active' : 'student-schedule-tab'} to="?view=past&page=1">
          <span>Past Sessions</span>
          <strong>{pastItems.length}</strong>
        </Link>
      </nav>

      {visibleItems.length > 0 ? (
        <section className="student-schedule-list" aria-label={view === 'past' ? 'Past sessions' : 'Upcoming workshops'}>
          {view === 'past' ? (
            <header className="student-schedule-list__header">
              <div>
                <span>Expired sessions</span>
                <strong>For your information</strong>
              </div>
              <p>Past sessions are shown only as history. Recordings, when published, remain available from Watch Recordings.</p>
            </header>
          ) : null}
          {visibleItems.map((item) => (
            <ScheduleRow item={item} key={item.id} now={now} variant={view} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Upcoming workshops pagination">
        {safePage > 1 ? (
          <Link className="pagination-link" to={buildPageLink(safePage - 1, view)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {safePage} of {totalPages} · {total} matching
        </span>
        {safePage < totalPages ? (
          <Link className="pagination-link" to={buildPageLink(safePage + 1, view)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {lockedCount > 0 && view === 'upcoming' ? <LockedState /> : null}

      <StateBlock title="Upcoming Workshops access">
        Only sessions mapped to your account are shown here. Past sessions are read-only history, while join links and paid access stay protected for eligible learners.
      </StateBlock>
    </div>
  );
}
