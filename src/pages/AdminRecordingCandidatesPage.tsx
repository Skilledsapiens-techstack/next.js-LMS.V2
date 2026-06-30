import { Play, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { AdminProgram, useAdminPrograms } from '../features/admin/useAdminPrograms';
import { AdminWorkshop, useAdminWorkshops } from '../features/admin/useAdminWorkshops';

type ProgramFilter = 'all' | string;

function hasRecordingLink(item: AdminWorkshop) {
  return Boolean(item.youtubeVideoUrl || item.zoomRecordingUrl);
}

function recordingUrlFor(item: AdminWorkshop) {
  return item.youtubeVideoUrl ?? item.zoomRecordingUrl ?? '';
}

function formatDate(value: string | undefined) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function programLabelFor(programs: AdminProgram[], programKey: string | undefined) {
  if (!programKey) return 'General';
  return programs.find((program) => program.programKey === programKey)?.name ?? programKey;
}

function compactProgramLabel(value: string | undefined) {
  return value ?? 'general';
}

function sourceLabel(item: AdminWorkshop) {
  if (item.youtubeVideoUrl) return 'YouTube';
  if (item.zoomRecordingUrl) return 'Recording';
  return 'Recording';
}

function AdminRecordingTile({ item }: { item: AdminWorkshop }) {
  const recordingUrl = recordingUrlFor(item);

  return (
    <article className="admin-recording-tile">
      <div className="admin-recording-tile__preview">
        <span className="admin-recording-pill">Session</span>
        <span className="admin-recording-pill admin-recording-pill--program">{compactProgramLabel(item.programKey)}</span>
        <span className="admin-recording-play" aria-hidden="true">
          <Play size={24} fill="currentColor" />
        </span>
      </div>

      <div className="admin-recording-tile__body">
        <div>
          <h2>{item.title}</h2>
          <p>{formatDate(item.date)}</p>
        </div>
        <div className="admin-recording-tile__footer">
          <span>{sourceLabel(item)}</span>
          <a className="admin-recording-watch" href={recordingUrl} rel="noreferrer" target="_blank">
            <Play size={14} fill="currentColor" />
            Watch
          </a>
        </div>
      </div>
    </article>
  );
}

export function AdminRecordingCandidatesPage() {
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
  const workshopsQuery = useAdminWorkshops({ limit: 100, page: 1, status: 'Completed' });
  const programsQuery = useAdminPrograms({ limit: 100, page: 1, status: 'active' });
  const programs = programsQuery.data?.items ?? [];
  const recordings = useMemo(() => (workshopsQuery.data?.items ?? []).filter(hasRecordingLink), [workshopsQuery.data?.items]);
  const programKeys = useMemo(() => {
    const activeProgramKeys = programs.map((program) => program.programKey);
    const recordingProgramKeys = recordings.map((item) => item.programKey).filter((value): value is string => Boolean(value));
    return Array.from(new Set([...activeProgramKeys, ...recordingProgramKeys]));
  }, [programs, recordings]);
  const visibleRecordings = useMemo(
    () => (programFilter === 'all' ? recordings : recordings.filter((item) => item.programKey === programFilter)),
    [programFilter, recordings]
  );

  if (workshopsQuery.isLoading || programsQuery.isLoading) {
    return (
      <div className="admin-recording-library">
        <LoadingState />
      </div>
    );
  }

  if (workshopsQuery.isError || programsQuery.isError) {
    return (
      <div className="admin-recording-library">
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="admin-recording-library">
      <header className="admin-recording-hero">
        <span className="section-eyebrow">RECORDING LIBRARY</span>
        <h1>Session Recordings</h1>
        <p>All meetings with an approved recording link added from Schedule Meeting.</p>
      </header>

      <nav className="admin-recording-filters" aria-label="Recording program filters">
        <button className={programFilter === 'all' ? 'admin-recording-filter admin-recording-filter--active' : 'admin-recording-filter'} onClick={() => setProgramFilter('all')} type="button">
          All Sessions
        </button>
        {programKeys.map((programKey) => (
          <button
            className={programFilter === programKey ? 'admin-recording-filter admin-recording-filter--active' : 'admin-recording-filter'}
            key={programKey}
            onClick={() => setProgramFilter(programKey)}
            type="button"
          >
            {programLabelFor(programs, programKey)}
          </button>
        ))}
      </nav>

      {visibleRecordings.length > 0 ? (
        <section className="admin-recording-grid" aria-label="Admin session recordings">
          {visibleRecordings.map((item) => (
            <AdminRecordingTile item={item} key={item.id} />
          ))}
        </section>
      ) : recordings.length > 0 ? (
        <div className="admin-recording-empty">
          <Video size={18} />
          No recordings found for this program.
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
