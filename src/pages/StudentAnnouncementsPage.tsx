import { ExternalLink, Pin } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnnouncementRichText } from '../components/AnnouncementRichText';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentAnnouncement, StudentAnnouncementPriority, useStudentAnnouncements } from '../features/student/useStudentAnnouncements';

type DateFilter = 'all' | 'active' | 'expired';
type PinnedFilter = 'all' | 'pinned';

const priorityFilters: Array<StudentAnnouncementPriority | 'all'> = ['all', 'urgent', 'important', 'normal'];
const dateFilters: Array<{ label: string; value: DateFilter }> = [
  { label: 'Any date status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Expired', value: 'expired' }
];
const pinnedFilters: Array<{ label: string; value: PinnedFilter }> = [
  { label: 'All notices', value: 'all' },
  { label: 'Pinned only', value: 'pinned' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function buildPageLink(page: number, filters: FilterState) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (filters.type !== 'all') params.set('type', filters.type);
  if (filters.priority !== 'all') params.set('priority', filters.priority);
  if (filters.audience !== 'all') params.set('audience', filters.audience);
  if (filters.pinned !== 'all') params.set('pinned', filters.pinned);
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
  return priority === 'urgent' || priority === 'important' ? 'warning' : 'neutral';
}

type FilterState = {
  audience: string;
  date: DateFilter;
  pinned: PinnedFilter;
  priority: StudentAnnouncementPriority | 'all';
  type: string;
};

function asPriority(value: string | null): StudentAnnouncementPriority | 'all' {
  return value === 'urgent' || value === 'important' || value === 'normal' ? value : 'all';
}

function asDateFilter(value: string | null): DateFilter {
  return value === 'active' || value === 'expired' ? value : 'all';
}

function asPinnedFilter(value: string | null): PinnedFilter {
  return value === 'pinned' ? value : 'all';
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
  if (filters.type !== 'all' && normalizeFilterValue(announcement.type ?? 'general') !== normalizeFilterValue(filters.type)) return false;
  if (filters.priority !== 'all' && announcement.priority !== filters.priority) return false;
  if (filters.pinned === 'pinned' && !announcement.pinned) return false;
  if (filters.date === 'active' && isExpired(announcement)) return false;
  if (filters.date === 'expired' && !isExpired(announcement)) return false;

  if (filters.audience !== 'all') {
    const audienceValues = [...announcement.programKeys, ...announcement.cohortNames].map(normalizeFilterValue);
    if (!audienceValues.includes(normalizeFilterValue(filters.audience))) return false;
  }

  return true;
}

function filterLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    date: asDateFilter(searchParams.get('date')),
    pinned: asPinnedFilter(searchParams.get('pinned')),
    priority: asPriority(searchParams.get('priority')),
    type: cleanFilterValue(searchParams.get('type'))
  };
  const announcementsQuery = useStudentAnnouncements({ limit: 100, page });
  const data = announcementsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const hasPagination = useMemo(() => Boolean(data && (data.hasPreviousPage || data.hasNextPage || totalPages > 1)), [data, totalPages]);
  const typeOptions = useMemo(() => uniqueSorted(data?.items.map((item) => item.type ?? 'General') ?? []), [data?.items]);
  const audienceOptions = useMemo(() => uniqueSorted(data?.items.flatMap((item) => [...item.programKeys, ...item.cohortNames]) ?? []), [data?.items]);
  const filteredItems = useMemo(() => data?.items.filter((announcement) => matchesFilters(announcement, filters)) ?? [], [data?.items, filters.audience, filters.date, filters.pinned, filters.priority, filters.type]);

  function setFilter(key: keyof FilterState, value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
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
        <div className="filter-bar__controls announcement-filter-row" aria-label="Category filters" role="group">
          <button className={filters.type === 'all' ? 'segmented-button segmented-button--active' : 'segmented-button'} onClick={() => setFilter('type', 'all')} type="button">
            All
          </button>
          {typeOptions.map((type) => (
            <button className={filters.type === type ? 'segmented-button segmented-button--active' : 'segmented-button'} key={type} onClick={() => setFilter('type', type)} type="button">
              {filterLabel(type)}
            </button>
          ))}
        </div>

        <label className="announcement-filter-select">
          Priority
          <select value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)}>
            {priorityFilters.map((priority) => (
              <option key={priority} value={priority}>
                {priority === 'all' ? 'All priorities' : filterLabel(priority)}
              </option>
            ))}
          </select>
        </label>

        <label className="announcement-filter-select">
          Notice type
          <select value={filters.pinned} onChange={(event) => setFilter('pinned', event.target.value)}>
            {pinnedFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

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
          Program / cohort
          <select value={filters.audience} onChange={(event) => setFilter('audience', event.target.value)}>
            <option value="all">All programs and cohorts</option>
            {audienceOptions.map((option) => (
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
