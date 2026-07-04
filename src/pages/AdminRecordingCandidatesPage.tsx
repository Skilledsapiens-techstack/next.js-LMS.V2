import { AlertTriangle, CheckCircle2, Clock3, Edit3, ExternalLink, Loader2, Play, RefreshCw, Save, Search, Video, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import { AdminProgram, useAdminPrograms } from '../features/admin/useAdminPrograms';
import { AdminRecordingCandidate, useAdminRecordingCandidates } from '../features/admin/useAdminRecordingCandidates';
import {
  AdminWorkshop,
  useAdminWorkshops,
  useFetchAdminWorkshopRecordings,
  usePublishAdminWorkshopRecording,
  useRejectAdminWorkshopRecording,
  useUpdateAdminWorkshopRecording
} from '../features/admin/useAdminWorkshops';

type RecordingTab = 'pending' | 'published' | 'missing' | 'rejected';
type ProgramFilter = 'all' | string;
type CohortFilter = 'all' | string;
type RecordingEditForm = {
  alternateUrl: string;
  passcode: string;
  workshopId: string;
  youtubeUrl: string;
};

const pageSize = 25;

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function hasRecordingLink(item: AdminWorkshop) {
  return Boolean(item.youtubeVideoUrl || item.zoomRecordingUrl);
}

function recordingUrlFor(item: AdminWorkshop) {
  return item.youtubeVideoUrl ?? item.zoomRecordingUrl ?? '';
}

function formatDate(value: string | undefined, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, options);
}

function formatDateTime(value: string | undefined) {
  return formatDate(value, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short' });
}

function formatDuration(value: number | undefined) {
  return value ? `${value} min` : 'Duration unknown';
}

function formatSize(value: number | undefined) {
  if (!value) return 'Size unknown';
  const megabytes = value / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function programLabelFor(programs: AdminProgram[], programKey: string | undefined) {
  if (!programKey) return 'General';
  return programs.find((program) => program.programKey === programKey)?.name ?? programKey;
}

function cohortProgramMatches(cohort: AdminCohort, programKey: string) {
  return cohort.programKey === programKey || cohort.domainKey === programKey;
}

function sourceLabel(item: AdminWorkshop) {
  if (item.youtubeVideoUrl) return 'YouTube';
  if (item.zoomRecordingUrl) return 'Zoom/manual';
  return 'Missing';
}

function candidateMatches(candidate: AdminRecordingCandidate, workshop: AdminWorkshop | undefined, search: string) {
  if (!search) return true;
  const haystack = [candidate.workshopId, candidate.zoomId, candidate.zoomAccount, candidate.recordingType, candidate.fileType, workshop?.title, workshop?.programKey, workshop?.cohortNames.join(' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(search);
}

function workshopMatches(workshop: AdminWorkshop, search: string, programFilter: ProgramFilter, cohortFilter: CohortFilter) {
  const searchMatches =
    !search ||
    [workshop.title, workshop.workshopId, workshop.zoomId, workshop.zoomAccount, workshop.programKey, workshop.cohortNames.join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search);
  const programMatches = programFilter === 'all' || workshop.programKey === programFilter;
  const cohortMatches = cohortFilter === 'all' || workshop.cohortNames.includes(cohortFilter);
  return searchMatches && programMatches && cohortMatches;
}

function workshopMeta(workshop: AdminWorkshop | undefined) {
  if (!workshop) return 'Workshop details unavailable';
  return [programLabelFor([], workshop.programKey), formatDate(workshop.date), workshop.time, workshop.cohortNames.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isPreferredCandidate(candidate: AdminRecordingCandidate) {
  return String(candidate.fileType ?? '').toUpperCase() === 'MP4' && String(candidate.recordingType ?? '').toLowerCase() === 'shared_screen_with_speaker_view';
}

function visibilityText(workshop: AdminWorkshop) {
  if (!hasRecordingLink(workshop)) return 'Not visible: no published recording link.';
  if (workshop.status !== 'Completed') return `Not visible: workshop status is ${workshop.status}.`;
  if (!workshop.programKey && workshop.cohortNames.length === 0) return 'Visible if matched by general student access.';
  return 'Visible to eligible students by program, cohort, and paid access rules.';
}

function paginateItems<TItem>(items: TItem[], page: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function totalPagesFor(count: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function AdminRecordingCandidatesPage() {
  const [activeTab, setActiveTab] = useState<RecordingTab>('pending');
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>('all');
  const [search, setSearch] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pageByTab, setPageByTab] = useState<Record<RecordingTab, number>>({ missing: 1, pending: 1, published: 1, rejected: 1 });
  const [recordingEditForm, setRecordingEditForm] = useState<RecordingEditForm | null>(null);
  const workshopsQuery = useAdminWorkshops({ limit: 500, page: 1, status: 'Completed' });
  const candidatesQuery = useAdminRecordingCandidates({ limit: 500, page: 1, status: 'all' });
  const programsQuery = useAdminPrograms({ limit: 500, page: 1, status: 'active' });
  const activeCohortsQuery = useAdminCohorts({ limit: 500, page: 1, status: 'active' });
  const fetchRecordingsMutation = useFetchAdminWorkshopRecordings();
  const publishRecordingMutation = usePublishAdminWorkshopRecording();
  const rejectRecordingMutation = useRejectAdminWorkshopRecording();
  const updateRecordingMutation = useUpdateAdminWorkshopRecording();
  const workshops = workshopsQuery.data?.items ?? [];
  const candidates = (candidatesQuery.data?.items ?? []).filter(isPreferredCandidate);
  const programs = programsQuery.data?.items ?? [];
  const activeCohorts = activeCohortsQuery.data?.items ?? [];
  const normalizedSearch = search.trim().toLowerCase();

  const workshopsByKey = useMemo(() => {
    const map = new Map<string, AdminWorkshop>();
    workshops.forEach((workshop) => {
      if (workshop.workshopId) map.set(workshop.workshopId, workshop);
    });
    return map;
  }, [workshops]);

  const programKeys = useMemo(() => {
    const activeProgramKeys = programs.map((program) => program.programKey);
    const cohortProgramKeys = activeCohorts.flatMap((cohort) => [cohort.programKey, cohort.domainKey]).filter((value): value is string => Boolean(value));
    const workshopProgramKeys = workshops.map((item) => item.programKey).filter((value): value is string => Boolean(value));
    return Array.from(new Set([...activeProgramKeys, ...cohortProgramKeys, ...workshopProgramKeys]));
  }, [activeCohorts, programs, workshops]);

  const cohortOptions = useMemo(() => {
    const eligibleCohorts = programFilter === 'all' ? activeCohorts : activeCohorts.filter((cohort) => cohortProgramMatches(cohort, programFilter));
    return Array.from(new Set(eligibleCohorts.map((cohort) => cohort.name).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [activeCohorts, programFilter]);

  useEffect(() => {
    if (cohortFilter !== 'all' && !cohortOptions.includes(cohortFilter)) {
      setCohortFilter('all');
      setPageByTab({ missing: 1, pending: 1, published: 1, rejected: 1 });
    }
  }, [cohortFilter, cohortOptions]);

  const pendingCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        const workshop = workshopsByKey.get(candidate.workshopId);
        return (
          candidate.status === 'draft' &&
          candidateMatches(candidate, workshop, normalizedSearch) &&
          (programFilter === 'all' || workshop?.programKey === programFilter) &&
          (cohortFilter === 'all' || Boolean(workshop?.cohortNames.includes(cohortFilter)))
        );
      }),
    [candidates, cohortFilter, normalizedSearch, programFilter, workshopsByKey]
  );

  const publishedWorkshops = useMemo(
    () => workshops.filter((workshop) => hasRecordingLink(workshop) && workshopMatches(workshop, normalizedSearch, programFilter, cohortFilter)),
    [cohortFilter, normalizedSearch, programFilter, workshops]
  );

  const missingWorkshops = useMemo(
    () => workshops.filter((workshop) => !hasRecordingLink(workshop) && workshopMatches(workshop, normalizedSearch, programFilter, cohortFilter)),
    [cohortFilter, normalizedSearch, programFilter, workshops]
  );

  const rejectedCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        const workshop = workshopsByKey.get(candidate.workshopId);
        return (
          candidate.status === 'rejected' &&
          candidateMatches(candidate, workshop, normalizedSearch) &&
          (programFilter === 'all' || workshop?.programKey === programFilter) &&
          (cohortFilter === 'all' || Boolean(workshop?.cohortNames.includes(cohortFilter)))
        );
      }),
    [candidates, cohortFilter, normalizedSearch, programFilter, workshopsByKey]
  );

  const reviewedCount = candidates.filter((candidate) => candidate.status === 'reviewed').length;
  const rejectedCount = candidates.filter((candidate) => candidate.status === 'rejected').length;
  const visibleByTab = {
    missing: missingWorkshops,
    pending: pendingCandidates,
    published: publishedWorkshops,
    rejected: rejectedCandidates
  };
  const activeItems = visibleByTab[activeTab];
  const activePage = Math.min(pageByTab[activeTab], totalPagesFor(activeItems.length));
  const activeTotalPages = totalPagesFor(activeItems.length);

  async function refetchRecordingData() {
    await Promise.all([candidatesQuery.refetch(), workshopsQuery.refetch()]);
  }

  function resetPages() {
    setPageByTab({ missing: 1, pending: 1, published: 1, rejected: 1 });
  }

  function changeTab(tab: RecordingTab) {
    setActiveTab(tab);
    setPageByTab((current) => ({ ...current, [tab]: 1 }));
    setRecordingEditForm(null);
  }

  function startEditingRecording(workshop: AdminWorkshop) {
    setRecordingEditForm({
      alternateUrl: workshop.zoomRecordingUrl ?? '',
      passcode: workshop.zoomRecordingPassword ?? '',
      workshopId: workshop.id,
      youtubeUrl: workshop.youtubeVideoUrl ?? ''
    });
  }

  function cancelEditingRecording() {
    setRecordingEditForm(null);
  }

  async function saveRecordingLinks() {
    if (!recordingEditForm) return;
    const youtubeUrl = recordingEditForm.youtubeUrl.trim();
    const alternateUrl = recordingEditForm.alternateUrl.trim();

    setActionMessage(null);
    if (!youtubeUrl && !alternateUrl) {
      setActionMessage('Add at least one recording link before saving.');
      return;
    }
    if (youtubeUrl && !isHttpUrl(youtubeUrl)) {
      setActionMessage('YouTube URL must start with http:// or https://.');
      return;
    }
    if (alternateUrl && !isHttpUrl(alternateUrl)) {
      setActionMessage('Zoom/manual URL must start with http:// or https://.');
      return;
    }

    try {
      await updateRecordingMutation.mutateAsync({
        body: {
          youtubeVideoUrl: youtubeUrl || null,
          zoomRecordingPassword: recordingEditForm.passcode.trim() || null,
          zoomRecordingUrl: alternateUrl || null
        },
        workshopId: recordingEditForm.workshopId
      });
      await refetchRecordingData();
      setRecordingEditForm(null);
      setActionMessage('Recording link updated.');
    } catch (error) {
      setActionMessage(readableError(error, 'Recording link could not be updated.'));
    }
  }

  async function publishCandidate(candidateId: string) {
    setActionMessage(null);
    try {
      await publishRecordingMutation.mutateAsync(candidateId);
      await refetchRecordingData();
      setActionMessage('Recording candidate published to the workshop.');
    } catch (error) {
      setActionMessage(readableError(error, 'Recording candidate could not be published.'));
    }
  }

  async function rejectCandidate(candidateId: string) {
    setActionMessage(null);
    try {
      await rejectRecordingMutation.mutateAsync(candidateId);
      await refetchRecordingData();
      setActionMessage('Recording candidate rejected.');
    } catch (error) {
      setActionMessage(readableError(error, 'Recording candidate could not be rejected.'));
    }
  }

  async function fetchRecordings(workshop: AdminWorkshop) {
    setActionMessage(null);
    try {
      const result = await fetchRecordingsMutation.mutateAsync(workshop.id);
      await refetchRecordingData();
      const duplicateText = result.duplicateCount ? ` ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? '' : 's'} skipped.` : '';
      setActionMessage(`Fetched ${result.count ?? 0} Zoom recording candidate${result.count === 1 ? '' : 's'} for ${workshop.title}.${duplicateText}`);
    } catch (error) {
      setActionMessage(readableError(error, 'Zoom recordings could not be fetched.'));
    }
  }

  function renderRecordingEditForm(workshop: AdminWorkshop) {
    if (recordingEditForm?.workshopId !== workshop.id) return null;

    return (
      <div className="admin-recording-edit-form">
        <label>
          <span>YouTube URL</span>
          <input
            value={recordingEditForm.youtubeUrl}
            onChange={(event) => setRecordingEditForm((current) => (current ? { ...current, youtubeUrl: event.target.value } : current))}
            placeholder="https://youtube.com/..."
          />
        </label>
        <label>
          <span>Zoom/manual URL</span>
          <input
            value={recordingEditForm.alternateUrl}
            onChange={(event) => setRecordingEditForm((current) => (current ? { ...current, alternateUrl: event.target.value } : current))}
            placeholder="https://..."
          />
        </label>
        <label>
          <span>Zoom passcode</span>
          <input
            value={recordingEditForm.passcode}
            onChange={(event) => setRecordingEditForm((current) => (current ? { ...current, passcode: event.target.value } : current))}
            placeholder="Optional passcode"
          />
        </label>
        <div className="admin-recording-edit-form__actions">
          <button className="admin-recording-action admin-recording-action--primary" disabled={updateRecordingMutation.isPending} onClick={() => void saveRecordingLinks()} type="button">
            {updateRecordingMutation.isPending ? <Loader2 className="admin-spin" size={14} /> : <Save size={14} />}
            Save link
          </button>
          <button className="admin-recording-action" disabled={updateRecordingMutation.isPending} onClick={cancelEditingRecording} type="button">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (workshopsQuery.isLoading || candidatesQuery.isLoading || programsQuery.isLoading || activeCohortsQuery.isLoading) {
    return (
      <div className="admin-recording-library">
        <LoadingState />
      </div>
    );
  }

  if (workshopsQuery.isError || candidatesQuery.isError || programsQuery.isError || activeCohortsQuery.isError) {
    return (
      <div className="admin-recording-library">
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="admin-recording-library">
      <header className="admin-recording-hero">
        <div>
          <span className="section-eyebrow">RECORDING OPERATIONS</span>
          <h1>Recordings</h1>
          <p>Review Zoom candidates, publish approved links, and find completed workshops still missing recordings.</p>
        </div>
        <div className="admin-recording-hero__meta">
          <StatusBadge>{`${pendingCandidates.length} pending`}</StatusBadge>
          <StatusBadge>{`${publishedWorkshops.length} published`}</StatusBadge>
          <StatusBadge>{`${missingWorkshops.length} missing`}</StatusBadge>
        </div>
      </header>

      <section className="admin-recording-kpis" aria-label="Recording summary">
        <article>
          <Clock3 size={18} />
          <span>Pending review</span>
          <strong>{pendingCandidates.length}</strong>
        </article>
        <article>
          <CheckCircle2 size={18} />
          <span>Published library</span>
          <strong>{publishedWorkshops.length}</strong>
        </article>
        <article>
          <AlertTriangle size={18} />
          <span>Missing recordings</span>
          <strong>{missingWorkshops.length}</strong>
        </article>
        <article>
          <XCircle size={18} />
          <span>Rejected candidates</span>
          <strong>{rejectedCount}</strong>
        </article>
      </section>

      <section className="admin-recording-toolbar" aria-label="Recording filters">
        <div className="admin-recording-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPages();
            }}
            placeholder="Search title, workshop ID, Zoom ID, cohort..."
          />
        </div>
        <label className="admin-recording-filter-field">
          <span>Program</span>
          <select
            aria-label="Program filter"
            title={programFilter === 'all' ? 'All programs' : programLabelFor(programs, programFilter)}
            value={programFilter}
            onChange={(event) => {
              setProgramFilter(event.target.value);
              resetPages();
            }}
          >
            <option value="all">All programs</option>
            {programKeys.map((programKey) => (
              <option key={programKey} value={programKey}>
                {programLabelFor(programs, programKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-recording-filter-field">
          <span>{programFilter === 'all' ? 'Cohort' : 'Eligible cohort'}</span>
          <select
            aria-label="Cohort filter"
            title={cohortFilter === 'all' ? (programFilter === 'all' ? 'All active cohorts' : 'All eligible active cohorts') : cohortFilter}
            value={cohortFilter}
            onChange={(event) => {
              setCohortFilter(event.target.value);
              resetPages();
            }}
          >
            <option value="all">{programFilter === 'all' ? 'All active cohorts' : 'All eligible active cohorts'}</option>
            {cohortOptions.map((cohortName) => (
              <option key={cohortName} value={cohortName}>
                {cohortName}
              </option>
            ))}
          </select>
        </label>
      </section>

      <nav className="admin-recording-tabs" aria-label="Recording workspace tabs">
        <button className={activeTab === 'pending' ? 'admin-recording-tab admin-recording-tab--active' : 'admin-recording-tab'} onClick={() => changeTab('pending')} type="button">
          Pending Review
        </button>
        <button className={activeTab === 'published' ? 'admin-recording-tab admin-recording-tab--active' : 'admin-recording-tab'} onClick={() => changeTab('published')} type="button">
          Published
        </button>
        <button className={activeTab === 'missing' ? 'admin-recording-tab admin-recording-tab--active' : 'admin-recording-tab'} onClick={() => changeTab('missing')} type="button">
          Missing
        </button>
        <button className={activeTab === 'rejected' ? 'admin-recording-tab admin-recording-tab--active' : 'admin-recording-tab'} onClick={() => changeTab('rejected')} type="button">
          Rejected
        </button>
      </nav>

      {actionMessage ? <div className="workshop-error-note">{actionMessage}</div> : null}

      {activeTab === 'pending' ? (
        <section className="admin-recording-panel">
          <div className="admin-recording-panel__header">
            <div>
              <h2>Zoom candidates awaiting review</h2>
              <p>Each candidate is admin-only until you publish it to the workshop recording URL.</p>
            </div>
          </div>
          {pendingCandidates.length > 0 ? (
            <div className="admin-recording-list">
              {paginateItems(pendingCandidates, activePage).map((candidate) => {
                const workshop = workshopsByKey.get(candidate.workshopId);
                return (
                  <article className="admin-recording-row" key={candidate.id}>
                    <div className="admin-recording-row__icon">
                      <Video size={18} />
                    </div>
                    <div className="admin-recording-row__main">
                      <div className="admin-recording-row__title">
                        <strong>{workshop?.title ?? candidate.workshopId}</strong>
                        <StatusBadge>{candidate.zoomAccount}</StatusBadge>
                      </div>
                      <p>{workshopMeta(workshop)}</p>
                      <div className="admin-recording-row__meta">
                        <span>{candidate.recordingType ?? 'recording'}</span>
                        <span>{candidate.fileType ?? 'file'}</span>
                        <span>{formatDuration(candidate.durationMinutes)}</span>
                        <span>{formatSize(candidate.fileSize)}</span>
                        <span>{formatDateTime(candidate.recordingStart)}</span>
                        {candidate.recordingPassword ? <span>Passcode saved</span> : null}
                      </div>
                    </div>
                    <div className="admin-recording-row__actions">
                      {candidate.playUrl ? (
                        <a className="admin-recording-action" href={candidate.playUrl} rel="noreferrer" target="_blank">
                          <Play size={14} fill="currentColor" />
                          Preview
                        </a>
                      ) : null}
                      <button
                        className="admin-recording-action admin-recording-action--primary"
                        disabled={publishRecordingMutation.isPending || !candidate.playUrl}
                        onClick={() => void publishCandidate(candidate.id)}
                        type="button"
                      >
                        {publishRecordingMutation.isPending ? <Loader2 className="admin-spin" size={14} /> : <CheckCircle2 size={14} />}
                        Publish
                      </button>
                      <button className="admin-recording-action" disabled={rejectRecordingMutation.isPending} onClick={() => void rejectCandidate(candidate.id)} type="button">
                        {rejectRecordingMutation.isPending ? <Loader2 className="admin-spin" size={14} /> : <XCircle size={14} />}
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      ) : null}

      {activeTab === 'published' ? (
        <section className="admin-recording-panel">
          <div className="admin-recording-panel__header">
            <div>
              <h2>Published recording library</h2>
              <p>These completed workshops have a recording URL and are eligible for student recording views based on access rules.</p>
            </div>
          </div>
          {publishedWorkshops.length > 0 ? (
            <div className="admin-recording-list">
              {paginateItems(publishedWorkshops, activePage).map((workshop) => (
                <article className="admin-recording-row" key={workshop.id}>
                  <div className="admin-recording-row__icon admin-recording-row__icon--published">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="admin-recording-row__main">
                    <div className="admin-recording-row__title">
                      <strong>{workshop.title}</strong>
                      <StatusBadge>{sourceLabel(workshop)}</StatusBadge>
                    </div>
                    <p>{[programLabelFor(programs, workshop.programKey), formatDate(workshop.date), workshop.time, workshop.cohortNames.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
                    <div className="admin-recording-row__meta">
                      <span>{workshop.workshopId ?? 'No workshop ID'}</span>
                      <span>{workshop.zoomId ? `Zoom ${workshop.zoomId}` : 'Manual link'}</span>
                      <span>{workshop.updatedAt ? `Updated ${formatDate(workshop.updatedAt)}` : 'Update date unavailable'}</span>
                      {workshop.zoomRecordingPassword ? <span>Passcode saved</span> : null}
                      <span>{visibilityText(workshop)}</span>
                    </div>
                    {renderRecordingEditForm(workshop)}
                  </div>
                  <div className="admin-recording-row__actions">
                    <a className="admin-recording-action admin-recording-action--primary" href={recordingUrlFor(workshop)} rel="noreferrer" target="_blank">
                      <ExternalLink size={14} />
                      Open
                    </a>
                    <button className="admin-recording-action" onClick={() => startEditingRecording(workshop)} type="button">
                      <Edit3 size={14} />
                      Edit link
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      ) : null}

      {activeTab === 'missing' ? (
        <section className="admin-recording-panel">
          <div className="admin-recording-panel__header">
            <div>
              <h2>Completed workshops missing recordings</h2>
              <p>Fetch Zoom recordings when a Zoom ID exists, then review and publish the candidate above.</p>
            </div>
          </div>
          {missingWorkshops.length > 0 ? (
            <div className="admin-recording-list">
              {paginateItems(missingWorkshops, activePage).map((workshop) => {
                const relatedCandidates = candidates.filter((candidate) => candidate.workshopId === workshop.workshopId);
                const hasDraftCandidate = relatedCandidates.some((candidate) => candidate.status === 'draft');
                return (
                  <article className="admin-recording-row" key={workshop.id}>
                    <div className="admin-recording-row__icon admin-recording-row__icon--missing">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="admin-recording-row__main">
                      <div className="admin-recording-row__title">
                        <strong>{workshop.title}</strong>
                        <StatusBadge>{hasDraftCandidate ? 'Candidate pending' : 'No published link'}</StatusBadge>
                      </div>
                      <p>{[programLabelFor(programs, workshop.programKey), formatDate(workshop.date), workshop.time, workshop.cohortNames.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
                      <div className="admin-recording-row__meta">
                        <span>{workshop.workshopId ?? 'No workshop ID'}</span>
                        <span>{workshop.zoomId ? `Zoom ${workshop.zoomId}` : 'No Zoom ID'}</span>
                        <span>{relatedCandidates.length} candidate{relatedCandidates.length === 1 ? '' : 's'} fetched</span>
                        <span>{visibilityText(workshop)}</span>
                      </div>
                      {renderRecordingEditForm(workshop)}
                    </div>
                    <div className="admin-recording-row__actions">
                      <button className="admin-recording-action" disabled={!workshop.zoomId || fetchRecordingsMutation.isPending} onClick={() => void fetchRecordings(workshop)} type="button">
                        {fetchRecordingsMutation.isPending ? <Loader2 className="admin-spin" size={14} /> : <RefreshCw size={14} />}
                        Fetch Zoom
                      </button>
                      {hasDraftCandidate ? (
                        <button className="admin-recording-action admin-recording-action--primary" onClick={() => setActiveTab('pending')} type="button">
                          Review
                        </button>
                      ) : null}
                      <button className="admin-recording-action" onClick={() => startEditingRecording(workshop)} type="button">
                        <Edit3 size={14} />
                        Add link
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      ) : null}

      {activeTab === 'rejected' ? (
        <section className="admin-recording-panel">
          <div className="admin-recording-panel__header">
            <div>
              <h2>Rejected recording candidates</h2>
              <p>Rejected candidates stay here as admin history and do not block future fetches for the same Zoom file.</p>
            </div>
          </div>
          {rejectedCandidates.length > 0 ? (
            <div className="admin-recording-list">
              {paginateItems(rejectedCandidates, activePage).map((candidate) => {
                const workshop = workshopsByKey.get(candidate.workshopId);
                return (
                  <article className="admin-recording-row" key={candidate.id}>
                    <div className="admin-recording-row__icon admin-recording-row__icon--rejected">
                      <XCircle size={18} />
                    </div>
                    <div className="admin-recording-row__main">
                      <div className="admin-recording-row__title">
                        <strong>{workshop?.title ?? candidate.workshopId}</strong>
                        <StatusBadge>{candidate.zoomAccount}</StatusBadge>
                      </div>
                      <p>{workshopMeta(workshop)}</p>
                      <div className="admin-recording-row__meta">
                        <span>{candidate.recordingType ?? 'recording'}</span>
                        <span>{candidate.fileType ?? 'file'}</span>
                        <span>{formatDuration(candidate.durationMinutes)}</span>
                        <span>{candidate.reviewedBy ? `Rejected by ${candidate.reviewedBy}` : 'Rejected'}</span>
                        <span>{candidate.reviewedAt ? formatDateTime(candidate.reviewedAt) : 'Review time unavailable'}</span>
                      </div>
                    </div>
                    <div className="admin-recording-row__actions">
                      {candidate.playUrl ? (
                        <a className="admin-recording-action" href={candidate.playUrl} rel="noreferrer" target="_blank">
                          <Play size={14} fill="currentColor" />
                          Preview
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      ) : null}

      {activeItems.length > pageSize ? (
        <nav className="admin-recording-pagination" aria-label="Recording pagination">
          <button
            className="admin-recording-action"
            disabled={activePage <= 1}
            onClick={() => setPageByTab((current) => ({ ...current, [activeTab]: Math.max(1, activePage - 1) }))}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {activePage} of {activeTotalPages} · {activeItems.length} matching records
          </span>
          <button
            className="admin-recording-action"
            disabled={activePage >= activeTotalPages}
            onClick={() => setPageByTab((current) => ({ ...current, [activeTab]: Math.min(activeTotalPages, activePage + 1) }))}
            type="button"
          >
            Next
          </button>
        </nav>
      ) : null}

      <section className="admin-recording-footnote">
        <strong>{reviewedCount} reviewed candidates</strong>
        <span>Download URLs remain admin-only. Student pages receive only the published play URL saved on the workshop.</span>
      </section>
    </div>
  );
}
