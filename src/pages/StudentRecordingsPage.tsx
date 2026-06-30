import { ExternalLink, Lock, Search, ShieldCheck, Video } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentRecording, StudentRecordingAccessType, StudentRecordingSource, useStudentRecordings } from '../features/student/useStudentRecordings';

type AccessFilter = StudentRecordingAccessType | 'all';
type SourceFilter = StudentRecordingSource | 'all';

const accessFilters: Array<{ label: string; value: AccessFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Paid', value: 'paid' }
];

const sourceFilters: Array<{ label: string; value: SourceFilter }> = [
  { label: 'All sources', value: 'all' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Zoom', value: 'zoom' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function asAccessType(value: string | null): AccessFilter {
  return value === 'free' || value === 'paid' ? value : 'all';
}

function asSource(value: string | null): SourceFilter {
  return value === 'youtube' || value === 'zoom' ? value : 'all';
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

function formatPrice(recording: StudentRecording) {
  if (recording.price === undefined) {
    return recording.accessType === 'paid' ? 'Paid' : 'Free';
  }

  return `${recording.currency ?? 'INR'} ${recording.price}`;
}

function formatFilterLabel(value: string) {
  return value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1);
}

function buildPageLink(page: number, accessType: AccessFilter, source: SourceFilter, search: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (accessType !== 'all') params.set('accessType', accessType);
  if (source !== 'all') params.set('source', source);
  if (search) params.set('search', search);
  return `?${params.toString()}`;
}

function RecordingCard({ recording }: { recording: StudentRecording }) {
  const canOpen = !recording.locked && recording.hasAccess && Boolean(recording.recordingUrl);

  return (
    <article className="recording-card">
      <div className="recording-card__preview" aria-hidden="true">
        <span className="recording-card__play">
          <Video size={24} />
        </span>
        <div className="recording-card__badges">
          {recording.source ? <StatusBadge>{formatFilterLabel(recording.source)}</StatusBadge> : null}
          <StatusBadge tone={recording.locked ? 'warning' : 'safe'}>{recording.locked ? 'Locked' : 'Available'}</StatusBadge>
        </div>
      </div>

      <div className="recording-card__body">
        <div>
          <h2>{recording.title}</h2>
          <p>
            {formatDate(recording.date)} · {recording.time ?? 'Time not set'} · {formatDuration(recording.durationMinutes)}
          </p>
        </div>

        <div className="recording-card__meta">
          {recording.programKey ? <StatusBadge>{recording.programKey}</StatusBadge> : null}
          {recording.domainKey ? <StatusBadge>{recording.domainKey}</StatusBadge> : null}
          <StatusBadge>{formatPrice(recording)}</StatusBadge>
        </div>

        {canOpen ? (
          <a className="student-action student-action--primary recording-card__action" href={recording.recordingUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Open recording
          </a>
        ) : (
          <div className="recording-card__locked">
            <Lock size={16} />
            <span>{recording.lockReason ?? 'Recording access is locked for this account.'}</span>
          </div>
        )}
      </div>
    </article>
  );
}

export function StudentRecordingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessType = asAccessType(searchParams.get('accessType'));
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const search = searchParams.get('search')?.trim() ?? '';
  const source = asSource(searchParams.get('source'));
  const [searchInput, setSearchInput] = useState(search);
  const recordingsQuery = useStudentRecordings({ accessType, page, search, source });
  const data = recordingsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const lockedCount = useMemo(() => data?.items.filter((item) => item.locked).length ?? 0, [data?.items]);
  const availableCount = useMemo(() => data?.items.filter((item) => !item.locked && item.hasAccess).length ?? 0, [data?.items]);

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

  function handleSource(nextSource: SourceFilter) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (nextSource === 'all') {
      next.delete('source');
    } else {
      next.set('source', nextSource);
    }
    setSearchParams(next);
  }

  if (recordingsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading recordings visible to your student profile." eyebrow="Student recordings" title="Recordings" />
        <LoadingState />
      </div>
    );
  }

  if (recordingsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Recordings could not be loaded right now." eyebrow="Student recordings" title="Recordings unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Watch completed workshop recordings that are visible to your profile while locked recordings stay protected."
        eyebrow="Student recordings"
        title="Recordings"
      />

      <div className="metric-grid">
        <article className="metric-tile">
          <Video size={22} />
          <span>Total visible</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Available on page</span>
          <strong>{availableCount}</strong>
        </article>
        <article className="metric-tile">
          <Lock size={22} />
          <span>Locked on page</span>
          <strong>{lockedCount}</strong>
        </article>
        <article className="metric-tile">
          <Search size={22} />
          <span>Source filter</span>
          <strong>{formatFilterLabel(source)}</strong>
        </article>
      </div>

      <section className="filter-bar" aria-label="Recording filters">
        <form className="filter-search filter-search--form" onSubmit={handleSearch}>
          <Search size={16} />
          <label className="sr-only" htmlFor="recording-search">
            Search recordings
          </label>
          <input id="recording-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search recordings" type="search" />
        </form>
        <div className="filter-bar__controls">
          {accessFilters.map((filter) => (
            <button className={`segmented-button ${accessType === filter.value ? 'segmented-button--active' : ''}`} key={filter.value} onClick={() => handleAccessType(filter.value)} type="button">
              {filter.label}
            </button>
          ))}
          {sourceFilters.map((filter) => (
            <button className={`segmented-button ${source === filter.value ? 'segmented-button--active' : ''}`} key={filter.value} onClick={() => handleSource(filter.value)} type="button">
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {data && data.items.length > 0 ? (
        <section className="recording-card-grid" aria-label="Visible recordings">
          {data.items.map((recording) => (
            <RecordingCard key={recording.id} recording={recording} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Recording pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, accessType, source, search)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, accessType, source, search)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {lockedCount > 0 ? <LockedState /> : null}

      <StateBlock title="Recording access">
        Only recordings available to your account are shown here. If a session is missing, contact Support with the session name and program details.
      </StateBlock>
    </div>
  );
}
