import { CalendarDays, ExternalLink, Lock, Radio, Search, ShieldCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentScheduleAccessType, StudentScheduleItem, StudentScheduleStatus, useStudentSchedule } from '../features/student/useStudentSchedule';

type AccessFilter = StudentScheduleAccessType | 'all';
type StatusFilter = StudentScheduleStatus | 'all';

const accessFilters: Array<{ label: string; value: AccessFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Paid', value: 'paid' }
];

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All status', value: 'all' },
  { label: 'Upcoming', value: 'Upcoming' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'Live', value: 'Live' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function asAccessType(value: string | null): AccessFilter {
  return value === 'free' || value === 'paid' ? value : 'all';
}

function asStatus(value: string | null): StatusFilter {
  return value === 'Upcoming' || value === 'Scheduled' || value === 'Live' ? value : 'all';
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuration(value: number | undefined) {
  return value === undefined ? 'Not set' : `${value} min`;
}

function formatPrice(item: StudentScheduleItem) {
  if (item.price === undefined) {
    return item.accessType === 'paid' ? 'Paid' : 'Free';
  }

  return `${item.currency ?? 'INR'} ${item.price}`;
}

function statusTone(status: StudentScheduleStatus) {
  return status === 'Live' ? 'warning' : status === 'Upcoming' || status === 'Scheduled' ? 'safe' : 'neutral';
}

function buildPageLink(page: number, accessType: AccessFilter, status: StatusFilter, search: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (accessType !== 'all') params.set('accessType', accessType);
  if (status !== 'all') params.set('status', status);
  if (search) params.set('search', search);
  return `?${params.toString()}`;
}

function ScheduleCard({ item }: { item: StudentScheduleItem }) {
  const canJoin = !item.locked && item.hasAccess && Boolean(item.joinUrl);

  return (
    <article className="schedule-card">
      <div className="schedule-card__date">
        <CalendarDays size={24} />
        <strong>{formatDate(item.date)}</strong>
        <span>{item.time ?? 'Time not set'}</span>
      </div>

      <div className="schedule-card__body">
        <div className="schedule-card__header">
          <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
          <StatusBadge tone={item.locked ? 'warning' : 'safe'}>{item.locked ? 'Locked' : 'Available'}</StatusBadge>
        </div>

        <div>
          <h2>{item.title}</h2>
          <p>
            {formatDuration(item.durationMinutes)} · {formatPrice(item)}
          </p>
        </div>

        <div className="schedule-card__meta">
          {item.programKey ? <StatusBadge>{item.programKey}</StatusBadge> : null}
          {item.domainKey ? <StatusBadge>{item.domainKey}</StatusBadge> : null}
          {item.workshopId ? <StatusBadge>{item.workshopId}</StatusBadge> : null}
        </div>

        {item.cohortNames.length > 0 ? <p className="schedule-card__audience">{item.cohortNames.join(', ')}</p> : null}

        {canJoin ? (
          <a className="student-action student-action--primary schedule-card__action" href={item.joinUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Join session
          </a>
        ) : (
          <div className="recording-card__locked">
            <Lock size={16} />
            <span>{item.lockReason ?? 'Join link is not available for this account.'}</span>
          </div>
        )}
      </div>
    </article>
  );
}

export function StudentSchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessType = asAccessType(searchParams.get('accessType'));
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const search = searchParams.get('search')?.trim() ?? '';
  const status = asStatus(searchParams.get('status'));
  const [searchInput, setSearchInput] = useState(search);
  const scheduleQuery = useStudentSchedule({ accessType, page, search, status });
  const data = scheduleQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const lockedCount = useMemo(() => data?.items.filter((item) => item.locked).length ?? 0, [data?.items]);
  const liveCount = useMemo(() => data?.items.filter((item) => item.status === 'Live').length ?? 0, [data?.items]);
  const joinableCount = useMemo(() => data?.items.filter((item) => !item.locked && item.hasAccess && item.joinUrl).length ?? 0, [data?.items]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (searchInput.trim()) {
      next.set('search', searchInput.trim());
    } else {
      next.delete('search');
    }
    setSearchParams(next);
  }

  function handleAccessType(nextAccessType: AccessFilter) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (nextAccessType === 'all') {
      next.delete('accessType');
    } else {
      next.set('accessType', nextAccessType);
    }
    setSearchParams(next);
  }

  function handleStatus(nextStatus: StatusFilter) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (nextStatus === 'all') {
      next.delete('status');
    } else {
      next.set('status', nextStatus);
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
    <div className="page-stack">
      <PageHeader
        description="Track upcoming and live workshops available to your account."
        eyebrow="Student schedule"
        title="Schedule"
      />

      <div className="metric-grid">
        <article className="metric-tile">
          <CalendarDays size={22} />
          <span>Total visible</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <Radio size={22} />
          <span>Live on page</span>
          <strong>{liveCount}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Joinable on page</span>
          <strong>{joinableCount}</strong>
        </article>
        <article className="metric-tile">
          <Lock size={22} />
          <span>Locked on page</span>
          <strong>{lockedCount}</strong>
        </article>
      </div>

      <section className="filter-bar" aria-label="Schedule filters">
        <form className="filter-search filter-search--form" onSubmit={handleSearch}>
          <Search size={16} />
          <label className="sr-only" htmlFor="schedule-search">
            Search schedule
          </label>
          <input id="schedule-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search schedule" type="search" />
        </form>
        <div className="filter-bar__controls">
          {accessFilters.map((filter) => (
            <button className={`segmented-button ${accessType === filter.value ? 'segmented-button--active' : ''}`} key={filter.value} onClick={() => handleAccessType(filter.value)} type="button">
              {filter.label}
            </button>
          ))}
          {statusFilters.map((filter) => (
            <button className={`segmented-button ${status === filter.value ? 'segmented-button--active' : ''}`} key={filter.value} onClick={() => handleStatus(filter.value)} type="button">
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {data && data.items.length > 0 ? (
        <section className="schedule-card-grid" aria-label="Visible workshops">
          {data.items.map((item) => (
            <ScheduleCard item={item} key={item.id} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Schedule pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, accessType, status, search)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, accessType, status, search)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {lockedCount > 0 ? <LockedState /> : null}

      <StateBlock title="Schedule access">
        Only sessions available to your account are shown here. If a session is missing, contact Support with the session name and program details.
      </StateBlock>
    </div>
  );
}
