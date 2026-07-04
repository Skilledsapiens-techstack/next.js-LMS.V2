import { ExternalLink, Pin } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnnouncementRichText } from '../components/AnnouncementRichText';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentAnnouncement, StudentAnnouncementPriority, useStudentAnnouncements } from '../features/student/useStudentAnnouncements';
import { useStudentCohorts } from '../features/student/useStudentCohorts';

type DateFilter = 'all' | 'active' | 'expired';

const dateFilters: Array<{ label: string; value: DateFilter }> = [
  { label: 'Any date status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Expired', value: 'expired' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function buildPageLink(page: number, filters: FilterState) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (filters.audience !== 'all') params.set('audience', filters.audience);
  if (filters.date !== 'all') params.set('date', filters.date);
  return `?${params.toString()}`;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPriority(priority: StudentAnnouncementPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function priorityTone(priority: StudentAnnouncementPriority) {
  return priority === 'urgent' ? 'warning' : 'neutral';
}

type FilterState = {
  audience: string;
  date: DateFilter;
};

function asDateFilter(value: string | null): DateFilter {
  return value === 'active' || value === 'expired' ? value : 'all';
}

function cleanFilterValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'all';
}

function normalizeFilterValue(value: string) {
  return value.trim().toLowerCase();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function isExpired(announcement: StudentAnnouncement) {
  if (!announcement.endDate) return false;
  const endDate = new Date(announcement.endDate);
  if (Number.isNaN(endDate.getTime())) return false;
  return endDate.getTime() < Date.now();
}

function matchesFilters(announcement: StudentAnnouncement, filters: FilterState) {
  if (filters.date === 'active' && isExpired(announcement)) return false;
  if (filters.date === 'expired' && !isExpired(announcement)) return false;

  if (filters.audience !== 'all') {
    const audienceValues = announcement.cohortNames.map(normalizeFilterValue);
    if (!audienceValues.includes(normalizeFilterValue(filters.audience))) return false;
  }

  return true;
}

function AnnouncementCard({ announcement }: { announcement: StudentAnnouncement }) {
  const cohorts = announcement.cohortNames.length > 0 ? announcement.cohortNames.join(', ') : '';
  const programKeys = announcement.programKeys.length > 0 ? announcement.programKeys.join(', ') : '';
  const audience = [cohorts, programKeys].filter(Boolean).join(' · ');
  const dateWindow =
    announcement.startDate || announcement.endDate ? `${formatDate(announcement.startDate)} - ${formatDate(announcement.endDate)}` : formatDate(announcement.updatedAt);

  return (
    <article className={announcement.pinned ? 'announcement-card announcement-card--pinned' : 'announcement-card'}>
      <div className="announcement-card__icon" aria-hidden="true">
        {announcement.pinned ? <Pin size={18} /> : <span />}
      </div>

      <div className="announcement-card__body">
        <div className="announcement-card__meta">
          {announcement.pinned ? <StatusBadge tone="warning">Pinned</StatusBadge> : null}
          <StatusBadge tone={priorityTone(announcement.priority)}>{formatPriority(announcement.priority)}</StatusBadge>
          {announcement.type ? <span>{announcement.type}</span> : null}
        </div>
        <h2>{announcement.title}</h2>
        <AnnouncementRichText text={announcement.message} />
        <div className="announcement-card__footer">
          <span>{dateWindow}</span>
          {audience ? <span>{audience}</span> : null}
        </div>
      </div>

      {announcement.linkUrl ? (
        <a className="action-button announcement-card__link" href={announcement.linkUrl} rel="noreferrer" target="_blank">
          <ExternalLink size={16} />
          {announcement.linkLabel ?? 'Open link'}
        </a>
      ) : null}
    </article>
  );
}

export function StudentAnnouncementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const filters: FilterState = {
    audience: cleanFilterValue(searchParams.get('audience')),
    date: asDateFilter(searchParams.get('date'))
  };
  const announcementsQuery = useStudentAnnouncements({ limit: 100, page });
  const cohortsQuery = useStudentCohorts({ limit: 200, page: 1, status: 'all' });
  const data = announcementsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const hasPagination = useMemo(() => Boolean(data && (data.hasPreviousPage || data.hasNextPage || totalPages > 1)), [data, totalPages]);
  const cohortOptions = useMemo(() => uniqueSorted(cohortsQuery.data?.items.map((cohort) => cohort.name) ?? []), [cohortsQuery.data?.items]);
  const filteredItems = useMemo(() => data?.items.filter((announcement) => matchesFilters(announcement, filters)) ?? [], [data?.items, filters.audience, filters.date]);

  function setFilter(key: keyof FilterState, value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    next.delete('type');
    next.delete('priority');
    next.delete('pinned');
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  }

  if (announcementsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your latest program updates." eyebrow="Updates & Alerts" title="Announcements" />
        <LoadingState />
      </div>
    );
  }

  if (announcementsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Announcements could not be loaded right now." eyebrow="Updates & Alerts" title="Announcements" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Important updates, cohort notices, and program messages from Skilled Sapiens."
        eyebrow="Updates & Alerts"
        title="Announcements"
      />

      <section className="filter-bar announcement-filters" aria-label="Announcement filters">
        <label className="announcement-filter-select">
          Date status
          <select value={filters.date} onChange={(event) => setFilter('date', event.target.value)}>
            {dateFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <label className="announcement-filter-select">
          Cohort
          <select value={filters.audience} onChange={(event) => setFilter('audience', event.target.value)}>
            <option value="all">All my cohorts</option>
            {cohortOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </section>

      {data && filteredItems.length > 0 ? (
        <section className="announcement-card-list" aria-label="Student announcements">
          {filteredItems.map((announcement) => (
            <AnnouncementCard announcement={announcement} key={announcement.id} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      {hasPagination ? (
        <nav className="pagination-bar" aria-label="Announcement pagination">
          {data?.hasPreviousPage ? (
            <Link className="pagination-link" to={buildPageLink(page - 1, filters)}>
              Previous page
            </Link>
          ) : (
            <span className="pagination-link pagination-link--disabled">Previous page</span>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {data?.hasNextPage ? (
            <Link className="pagination-link" to={buildPageLink(page + 1, filters)}>
              Next page
            </Link>
          ) : (
            <span className="pagination-link pagination-link--disabled">Next page</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
