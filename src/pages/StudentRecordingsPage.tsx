import { CalendarDays, ExternalLink, Lock, ShieldCheck, Video } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentRecording, StudentRecordingAccessType, useStudentRecordings } from '../features/student/useStudentRecordings';

type AccessFilter = StudentRecordingAccessType | 'all';

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
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuration(value: number | undefined | null) {
  return value == null ? 'Not set' : `${value} min`;
}

function formatPrice(recording: StudentRecording) {
  if (recording.price == null) {
    return recording.accessType === 'paid' ? 'Paid' : 'Free';
  }

  return `${recording.currency ?? 'INR'} ${recording.price}`;
}

function formatFilterLabel(value: string) {
  return value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1);
}

function getProgramLabel(recording: StudentRecording) {
  return recording.programKey || recording.domainKey;
}

function hasRecordingAccess(recording: StudentRecording) {
  return !recording.locked && recording.hasAccess !== false;
}

function buildPageLink(page: number, accessType: AccessFilter) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (accessType !== 'all') params.set('accessType', accessType);
  return `?${params.toString()}`;
}

function paginateItems<TItem>(items: TItem[], page: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function totalPagesFor(count: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

function RecordingRow({ recording }: { recording: StudentRecording }) {
  const canOpen = hasRecordingAccess(recording) && Boolean(recording.recordingUrl);
  const programLabel = getProgramLabel(recording);

  return (
    <article className="student-recording-row">
      <div className={recording.locked ? 'student-recording-row__icon student-recording-row__icon--locked' : 'student-recording-row__icon'}>
        {recording.locked ? <Lock size={18} /> : <Video size={18} />}
      </div>
      <div className="student-recording-row__main">
        <div className="student-recording-row__title">
          <strong>{recording.title}</strong>
          {recording.source ? <StatusBadge>{formatFilterLabel(recording.source)}</StatusBadge> : null}
          <StatusBadge tone={recording.locked ? 'warning' : 'safe'}>{recording.locked ? 'Locked' : 'Available'}</StatusBadge>
        </div>
        <p>
          {formatDate(recording.date)} · {recording.time ?? 'Time not set'} · {formatDuration(recording.durationMinutes)}
        </p>
        <div className="student-recording-row__meta">
          {programLabel ? <span>{programLabel}</span> : null}
          <span>{formatPrice(recording)}</span>
        </div>
        {recording.locked ? (
          <div className="student-recording-row__notice">
            <Lock size={15} />
            <span>{recording.lockReason ?? 'Recording access is locked for this account.'}</span>
          </div>
        ) : null}
      </div>
      <div className="student-recording-row__actions">
        {canOpen ? (
          <a className="student-action student-action--primary" href={recording.recordingUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Open recording
          </a>
        ) : recording.paymentLink ? (
          <a className="student-action student-action--primary" href={recording.paymentLink} rel="noreferrer" target="_blank">
            <Lock size={16} />
            Pay to unlock
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function StudentRecordingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessType = asAccessType(searchParams.get('accessType'));
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const recordingsQuery = useStudentRecordings({ accessType, limit: 500, page: 1 });
  const recordings = recordingsQuery.data?.items ?? [];
  const total = recordings.length;
  const totalPages = totalPagesFor(total);
  const safePage = Math.min(page, totalPages);
  const visibleRecordings = paginateItems(recordings, safePage);
  const lockedCount = useMemo(() => recordings.filter((item) => item.locked).length, [recordings]);
  const availableCount = useMemo(() => recordings.filter(hasRecordingAccess).length, [recordings]);
  const latestDate = recordings[0]?.date ? formatDate(recordings[0].date) : 'None';

  function updateAccessType(nextAccessType: AccessFilter) {
    const next = new URLSearchParams();
    next.set('page', '1');
    if (nextAccessType !== 'all') {
      next.set('accessType', nextAccessType);
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
    <div className="page-stack student-recordings-page">
      <PageHeader
        description="Watch completed workshop recordings that are visible to your profile while locked recordings stay protected."
        eyebrow="Student recordings"
        title="Recordings"
      />

      <div className="student-recording-summary">
        <article>
          <Video size={20} />
          <span>Matching recordings</span>
          <strong>{total}</strong>
        </article>
        <article>
          <ShieldCheck size={20} />
          <span>Available</span>
          <strong>{availableCount}</strong>
        </article>
        <article>
          <Lock size={20} />
          <span>Locked</span>
          <strong>{lockedCount}</strong>
        </article>
        <article>
          <CalendarDays size={20} />
          <span>Latest</span>
          <strong>{latestDate}</strong>
        </article>
      </div>

      <section className="student-recording-chips" aria-label="Recording quick filters">
        {accessFilters.map((filter) => (
          <button className={`segmented-button ${accessType === filter.value ? 'segmented-button--active' : ''}`} key={filter.value} onClick={() => updateAccessType(filter.value)} type="button">
            {filter.label}
          </button>
        ))}
      </section>

      {visibleRecordings.length > 0 ? (
        <section className="student-recording-list" aria-label="Visible recordings">
          {visibleRecordings.map((recording) => (
            <RecordingRow key={recording.id} recording={recording} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Recording pagination">
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

      <StateBlock title="Recording access">
        Only recordings mapped to your account are shown here. Recording links and paid access stay protected for eligible learners.
      </StateBlock>
    </div>
  );
}
