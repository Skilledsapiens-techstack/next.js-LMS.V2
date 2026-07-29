import { CalendarDays, ExternalLink, History, Lock, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentScheduleItem, StudentScheduleStatus, useStudentSchedule } from '../features/student/useStudentSchedule';

const pageSize = 25;
const sessionViews = ['upcoming', 'past'] as const;

type SessionView = (typeof sessionViews)[number];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function asSessionView(value: string | null): SessionView {
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

function statusTone(status: StudentScheduleStatus) {
  return status === 'Live' ? 'warning' : status === 'Upcoming' || status === 'Scheduled' ? 'safe' : 'neutral';
}

function hasSessionAccess(item: StudentScheduleItem) {
  return !item.locked && item.hasAccess !== false;
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

function getScheduledEndAt(item: StudentScheduleItem) {
  const scheduledAt = getScheduledAt(item);
  if (!scheduledAt) return null;

  const durationMinutes = Number(item.durationMinutes);
  const durationMs = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes * 60 * 1000 : 0;
  return new Date(scheduledAt.getTime() + durationMs);
}

function isLiveByTime(item: StudentScheduleItem, now: number) {
  if (item.status === 'Completed') return false;

  const scheduledAt = getScheduledAt(item);
  const scheduledEndAt = getScheduledEndAt(item);
  if (!scheduledAt || !scheduledEndAt) return false;

  return scheduledAt.getTime() <= now && now < scheduledEndAt.getTime();
}

function isPastSession(item: StudentScheduleItem, now: number) {
  if (item.status === 'Completed') return true;
  const scheduledEndAt = getScheduledEndAt(item);
  return Boolean(scheduledEndAt && scheduledEndAt.getTime() <= now);
}

function sortUpcoming(items: StudentScheduleItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = getScheduledAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = getScheduledAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
}

function sortPast(items: StudentScheduleItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = getScheduledAt(left)?.getTime() ?? 0;
    const rightTime = getScheduledAt(right)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

function paginateItems<TItem>(items: TItem[], page: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function totalPagesFor(count: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

function buildPageLink(page: number, view: SessionView) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (view === 'past') params.set('view', view);
  return `?${params.toString()}`;
}

function DoubtSessionRow({ item, now, variant = 'upcoming' }: { item: StudentScheduleItem; now: number; variant?: SessionView }) {
  const canJoin = hasSessionAccess(item) && Boolean(item.joinUrl);
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
          {formatDate(item.date)} · {item.time ? `${item.time} IST` : 'Time not set'}
        </p>
        {item.locked && !isPast ? (
          <div className="student-schedule-row__notice">
            <Lock size={15} />
            <span>{item.lockReason ?? 'This doubt session is locked for your account.'}</span>
          </div>
        ) : null}
      </div>

      {!isPast ? (
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
      ) : null}
    </article>
  );
}

export function StudentDoubtSessionsPage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const view = asSessionView(searchParams.get('view'));
  const [now, setNow] = useState(() => Date.now());
  const sessionsQuery = useStudentSchedule({ includePast: true, limit: 500, page: 1, sessionType: 'doubt_session' });

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const allItems = useMemo(() => sessionsQuery.data?.items ?? [], [sessionsQuery.data?.items]);
  const upcomingItems = useMemo(() => sortUpcoming(allItems.filter((item) => !isPastSession(item, now))), [allItems, now]);
  const pastItems = useMemo(() => sortPast(allItems.filter((item) => isPastSession(item, now))), [allItems, now]);
  const sessionItems = view === 'past' ? pastItems : upcomingItems;
  const total = sessionItems.length;
  const totalPages = totalPagesFor(total);
  const safePage = Math.min(page, totalPages);
  const visibleItems = paginateItems(sessionItems, safePage);
  const nextSession = upcomingItems.find((item) => isLiveByTime(item, now)) ?? upcomingItems[0];

  if (sessionsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading doubt sessions visible to your student profile." eyebrow="Doubt sessions" title="Doubt Sessions" />
        <LoadingState />
      </div>
    );
  }

  if (sessionsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Doubt sessions could not be loaded right now." eyebrow="Doubt sessions" title="Doubt Sessions unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack student-schedule-page">
      <PageHeader
        description="Join live doubt-clearing sessions for your program and cohort."
        title="Doubt Sessions"
      />

      <section className="student-schedule-hero" aria-label="Next doubt session">
        <div>
          <span>Next doubt session</span>
          <strong>{nextSession?.title ?? 'No doubt sessions scheduled'}</strong>
          <p>
            {nextSession
              ? `${formatDate(nextSession.date)} · ${nextSession.time ? `${nextSession.time} IST` : 'Time not set'}`
              : 'New doubt-clearing sessions will appear here when your mentor schedules them.'}
          </p>
        </div>
        {nextSession && hasSessionAccess(nextSession) && nextSession.joinUrl ? (
          <a className="student-action student-action--primary" href={nextSession.joinUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Join session
          </a>
        ) : null}
      </section>

      {pastItems.length > 0 ? (
        <div className="student-schedule-summary">
          <article>
            <History size={20} />
            <span>Past doubt sessions</span>
            <strong>{pastItems.length}</strong>
          </article>
          <article>
            <MessageCircle size={20} />
            <span>Upcoming</span>
            <strong>{upcomingItems.length}</strong>
          </article>
        </div>
      ) : null}

      <nav className="student-schedule-tabs" aria-label="Doubt session views">
        <Link className={view === 'upcoming' ? 'student-schedule-tab student-schedule-tab--active' : 'student-schedule-tab'} to="?page=1">
          <span>Upcoming</span>
          <strong>{upcomingItems.length}</strong>
        </Link>
        <Link className={view === 'past' ? 'student-schedule-tab student-schedule-tab--active' : 'student-schedule-tab'} to="?view=past&page=1">
          <span>Past Sessions</span>
          <strong>{pastItems.length}</strong>
        </Link>
      </nav>

      {visibleItems.length > 0 ? (
        <section className="student-schedule-list" aria-label={view === 'past' ? 'Past doubt sessions' : 'Upcoming doubt sessions'}>
          {view === 'past' ? (
            <header className="student-schedule-list__header">
              <div>
                <span>Expired sessions</span>
                <strong>For your information</strong>
              </div>
              <p>Past doubt sessions are shown as history. Recordings, when published, remain available from Watch Recordings.</p>
            </header>
          ) : null}
          {visibleItems.map((item) => (
            <DoubtSessionRow item={item} key={item.id} now={now} variant={view} />
          ))}
        </section>
      ) : (
        <section className="screen-state">
          <MessageCircle size={22} />
          <div>
            <h2>No doubt sessions scheduled right now.</h2>
            <p>New doubt-clearing sessions will appear here when your mentor schedules them.</p>
          </div>
        </section>
      )}

      <nav className="pagination-bar" aria-label="Doubt sessions pagination">
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
    </div>
  );
}
