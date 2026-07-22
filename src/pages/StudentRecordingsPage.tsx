import { CalendarDays, Check, ChevronDown, Copy, ExternalLink, Link2, Lock, ShieldCheck, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentCohort, useStudentCohorts } from '../features/student/useStudentCohorts';
import {
  StudentRecording,
  StudentRecordingSection,
  useStudentRecordingProgress,
  useStudentRecordingProgressActions,
  useStudentRecordingResources,
  useStudentRecordings
} from '../features/student/useStudentRecordings';

const pageSize = 25;

type RecordingProgramFilter = {
  cohortNames: string[];
  count: number;
  label: string;
  value: string;
};

type RecordingDisplayGroup = {
  key: string;
  label: string;
  sections: RecordingSectionGroup[];
};

type RecordingSectionGroup = {
  items: StudentRecording[];
  key: StudentRecordingSection;
  label: string;
};

type RecordingGroupProgress = {
  completed: number;
  percent: number;
  total: number;
};

const recordingSectionOptions: Array<{ label: string; value: StudentRecordingSection }> = [
  { label: 'Induction & Live Project Overview', value: 'induction_live_project' },
  { label: 'Core Modules', value: 'core_modules' },
  { label: 'Placement Mentorship', value: 'placement_mentorship' },
  { label: 'Other Workshops', value: 'other_workshops' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function normalizeProgramKey(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeCohortName(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? '';
}

function programKeyForCohort(cohort: StudentCohort) {
  return normalizeProgramKey(cohort.programKey || cohort.domainKey);
}

function programLabelFromKey(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function primaryProgramKeyForRecording(recording: StudentRecording) {
  return normalizeProgramKey(recording.programKey) || normalizeProgramKey(recording.domainKey);
}

function recordingCohortNames(recording: StudentRecording) {
  return (recording.cohortNames ?? []).map(normalizeCohortName).filter(Boolean);
}

function recordingMatchesProgram(recording: StudentRecording, program: Pick<RecordingProgramFilter, 'cohortNames' | 'value'>) {
  const primaryKey = primaryProgramKeyForRecording(recording);
  if (primaryKey && primaryKey === program.value) return true;

  const programCohorts = new Set(program.cohortNames.map(normalizeCohortName).filter(Boolean));
  if (programCohorts.size === 0) return false;
  return recordingCohortNames(recording).some((cohortName) => programCohorts.has(cohortName));
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function getLatestRecordingDate(recordings: StudentRecording[]) {
  const latest = recordings.reduce<Date | null>((currentLatest, recording) => {
    if (!recording.recordingUrl || !recording.date) {
      return currentLatest;
    }

    const recordingDate = new Date(recording.date);
    if (Number.isNaN(recordingDate.getTime())) {
      return currentLatest;
    }

    return !currentLatest || recordingDate > currentLatest ? recordingDate : currentLatest;
  }, null);

  return latest ? formatDate(latest.toISOString()) : 'None';
}

function formatDuration(value: number | undefined | null) {
  return value == null ? 'Not set' : `${value} min`;
}

function hasRecordingAccess(recording: StudentRecording) {
  return !recording.locked && recording.hasAccess !== false;
}

function canTrackRecordingCompletion(recording: StudentRecording) {
  return hasRecordingAccess(recording) && Boolean(recording.recordingUrl);
}

function buildPageLink(page: number, programKey: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (programKey) params.set('programKey', programKey);
  return `?${params.toString()}`;
}

function paginateItems<TItem>(items: TItem[], page: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function recordingSequenceNumber(recording: StudentRecording) {
  return typeof recording.recordingSequenceNumber === 'number' && Number.isFinite(recording.recordingSequenceNumber)
    ? recording.recordingSequenceNumber
    : null;
}

function recordingSection(recording: StudentRecording): StudentRecordingSection {
  return recordingSectionOptions.some((option) => option.value === recording.recordingSection) ? recording.recordingSection ?? 'other_workshops' : 'other_workshops';
}

function recordingSectionOrder(recording: StudentRecording) {
  const index = recordingSectionOptions.findIndex((option) => option.value === recordingSection(recording));
  return index === -1 ? recordingSectionOptions.length : index;
}

function recordingScheduledTime(recording: StudentRecording) {
  const time = recording.date ? new Date(`${recording.date}T${recording.time ?? '00:00'}`).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function compareRecordingsForStudent(left: StudentRecording, right: StudentRecording) {
  const sectionDiff = recordingSectionOrder(left) - recordingSectionOrder(right);
  if (sectionDiff !== 0) return sectionDiff;

  const leftSequence = recordingSequenceNumber(left);
  const rightSequence = recordingSequenceNumber(right);
  if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) return leftSequence - rightSequence;
  if (leftSequence !== null && rightSequence === null) return -1;
  if (leftSequence === null && rightSequence !== null) return 1;

  const dateDiff = recordingScheduledTime(left) - recordingScheduledTime(right);
  if (dateDiff !== 0) return dateDiff;
  return left.title.localeCompare(right.title);
}

function buildRecordingDisplayGroups(recordings: StudentRecording[], programs: RecordingProgramFilter[], selectedProgram?: RecordingProgramFilter) {
  if (selectedProgram) {
    return [buildRecordingDisplayGroup(selectedProgram.value, selectedProgram.label, recordings)];
  }

  if (programs.length <= 1) {
    const label = programs[0]?.label ?? 'Recordings';
    const key = programs[0]?.value ?? 'all';
    return [buildRecordingDisplayGroup(key, label, recordings)];
  }

  const groups = programs
    .map((program) => buildRecordingDisplayGroup(program.value, program.label, recordings.filter((recording) => recordingMatchesProgram(recording, program))))
    .filter((group) => group.sections.some((section) => section.items.length > 0));

  const assignedIds = new Set(groups.flatMap((group) => group.sections.flatMap((section) => section.items.map((recording) => recording.id))));
  const remaining = recordings.filter((recording) => !assignedIds.has(recording.id));
  return remaining.length > 0 ? [...groups, buildRecordingDisplayGroup('additional', 'Additional Recordings', remaining)] : groups;
}

function buildRecordingDisplayGroup(key: string, label: string, recordings: StudentRecording[]): RecordingDisplayGroup {
  const ordered = [...recordings].sort(compareRecordingsForStudent);
  const sections = recordingSectionOptions
    .map((section) => ({
      key: section.value,
      label: section.label,
      items: ordered.filter((recording) => recordingSection(recording) === section.value)
    }))
    .filter((section) => section.items.length > 0);

  return {
    key,
    label,
    sections
  };
}

function totalPagesFor(count: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

function recordingsInGroup(group: RecordingDisplayGroup) {
  return group.sections.flatMap((section) => section.items);
}

function progressForGroup(group: RecordingDisplayGroup, completedRecordingIds: Set<string>): RecordingGroupProgress {
  const trackable = recordingsInGroup(group).filter(canTrackRecordingCompletion);
  const completed = trackable.filter((recording) => completedRecordingIds.has(recording.id)).length;
  const total = trackable.length;
  return {
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    total
  };
}

function RecordingProgressCard({ progress }: { progress: RecordingGroupProgress }) {
  if (progress.total === 0) return null;

  return (
    <div className="student-recording-progress-card">
      <div className="student-recording-progress-card__content">
        <div className="student-recording-progress-card__header">
          <span>Training progress</span>
          <strong>
            {progress.completed} of {progress.total} completed
          </strong>
        </div>
        <p>Complete atleast 75% training modules to get your training completion certificate.</p>
      </div>
      <div className="student-recording-progress-card__meter" aria-label={`Training progress ${progress.percent}%`}>
        <strong>
          <span>
            {progress.completed} / {progress.total}
          </span>
          <span>{progress.percent}%</span>
        </strong>
        <span>
          <i style={{ width: `${progress.percent}%` }} />
        </span>
      </div>
    </div>
  );
}

function RecordingRow({
  isCompleted,
  isProgressPending,
  onMarkComplete,
  recording,
  sectionKey
}: {
  isCompleted: boolean;
  isProgressPending: boolean;
  onMarkComplete: (recordingId: string) => void;
  recording: StudentRecording;
  sectionKey: StudentRecordingSection;
}) {
  const canOpen = hasRecordingAccess(recording) && Boolean(recording.recordingUrl);
  const sequenceNumber = recordingSequenceNumber(recording);
  const showSequenceBadge = sectionKey === 'induction_live_project' && sequenceNumber !== null;
  const [copied, setCopied] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const initialRelatedResources = recording.relatedResources ?? [];
  const resourcesQuery = useStudentRecordingResources(recording.id, initialRelatedResources.length === 0 && hasRecordingAccess(recording));
  const relatedResources = initialRelatedResources.length > 0 ? initialRelatedResources : resourcesQuery.data?.resources ?? [];

  function copyPasscode() {
    const passcode = recording.recordingPassword?.trim();
    if (!passcode) return;
    void navigator.clipboard?.writeText(passcode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className="student-recording-row">
      <div className={recording.locked ? 'student-recording-row__icon student-recording-row__icon--locked' : 'student-recording-row__icon'}>
        {recording.locked ? <Lock size={18} /> : <Video size={18} />}
      </div>
      <div className="student-recording-row__main">
        <div className="student-recording-row__title">
          <strong>{recording.title}</strong>
          {showSequenceBadge ? <StatusBadge tone="safe">{`Step ${sequenceNumber}`}</StatusBadge> : null}
        </div>
        <p>
          {formatDate(recording.date)} · {recording.time ?? 'Time not set'} · {formatDuration(recording.durationMinutes)}
        </p>
        {recording.locked ? (
          <div className="student-recording-row__notice">
            <Lock size={15} />
            <span>{recording.lockReason ?? 'Recording access is locked for this account.'}</span>
          </div>
        ) : null}
        {!recording.locked && recording.source === 'zoom' && recording.recordingPassword ? (
          <div className="student-recording-row__passcode">
            <span>Passcode: {recording.recordingPassword}</span>
            <button onClick={copyPasscode} type="button">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
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
        {canOpen ? (
          isCompleted ? (
            <button
              className="student-recording-complete student-recording-complete--done"
              disabled
              type="button"
            >
              <Check size={15} />
              Completed
            </button>
          ) : (
            <button className="student-recording-complete" disabled={isProgressPending} onClick={() => onMarkComplete(recording.id)} type="button">
              <Check size={15} />
              {isProgressPending ? 'Saving...' : 'Mark complete'}
            </button>
          )
        ) : null}
        {relatedResources.length > 0 ? (
          <button
            className={resourcesOpen ? 'student-recording-resource-toggle student-recording-resource-toggle--open' : 'student-recording-resource-toggle'}
            onClick={() => setResourcesOpen((current) => !current)}
            type="button"
          >
            <Link2 size={15} />
            Related Resources
            <span>{relatedResources.length}</span>
            <ChevronDown size={15} />
          </button>
        ) : null}
      </div>
      {resourcesOpen && relatedResources.length > 0 ? (
        <div className="student-recording-resources">
          <div className="student-recording-resources__header">
            <span>Related resources</span>
            <strong>{relatedResources.length}</strong>
          </div>
          {relatedResources.map((resource) => (
            <a className="student-recording-resource-card" href={resource.url ?? '#'} key={resource.id} rel="noreferrer" target="_blank">
              <span>
                <strong>{resource.title}</strong>
                {resource.description ? <small>{resource.description}</small> : null}
              </span>
              <ExternalLink size={15} />
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function StudentRecordingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingProgressRecordingId, setPendingProgressRecordingId] = useState<string | null>(null);
  const [progressError, setProgressError] = useState('');
  const selectedProgramKey = normalizeProgramKey(searchParams.get('programKey'));
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const recordingsQuery = useStudentRecordings({ limit: 500, page: 1 });
  const cohortsQuery = useStudentCohorts({ limit: 100, page: 1, status: 'all' });
  const recordings = recordingsQuery.data?.items ?? [];
  const enrolledCohorts = cohortsQuery.data?.items ?? [];
  const enrolledPrograms = useMemo<RecordingProgramFilter[]>(() => {
    const programMap = new Map<string, { cohortNames: Set<string>; label: string; value: string }>();
    enrolledCohorts.forEach((cohort) => {
      const key = programKeyForCohort(cohort);
      if (!key) return;
      const existing = programMap.get(key);
      const label = cohort.programName?.trim() || existing?.label || programLabelFromKey(key);
      const cohortNames = existing?.cohortNames ?? new Set<string>();
      const cohortName = normalizeCohortName(cohort.name);
      if (cohortName) cohortNames.add(cohortName);
      programMap.set(key, { cohortNames, label, value: key });
    });

    return Array.from(programMap.values())
      .map((program) => {
        const filterProgram = { cohortNames: Array.from(program.cohortNames), value: program.value };
        return {
          ...filterProgram,
          count: recordings.filter((recording) => recordingMatchesProgram(recording, filterProgram)).length,
          label: program.label
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [enrolledCohorts, recordings]);
  const activeProgramKey = selectedProgramKey || enrolledPrograms[0]?.value || '';
  const selectedProgram = useMemo(() => enrolledPrograms.find((program) => program.value === activeProgramKey), [activeProgramKey, enrolledPrograms]);
  const filteredRecordings = useMemo(() => {
    const matched = activeProgramKey
      ? selectedProgram
        ? recordings.filter((recording) => recordingMatchesProgram(recording, selectedProgram))
        : recordings.filter((recording) => primaryProgramKeyForRecording(recording) === activeProgramKey)
      : recordings;
    return [...matched].sort(compareRecordingsForStudent);
  }, [activeProgramKey, recordings, selectedProgram]);
  const total = filteredRecordings.length;
  const totalPages = totalPagesFor(total);
  const safePage = Math.min(page, totalPages);
  const visibleRecordings = paginateItems(filteredRecordings, safePage);
  const progressGroups = useMemo(() => buildRecordingDisplayGroups(filteredRecordings, enrolledPrograms, selectedProgram), [enrolledPrograms, filteredRecordings, selectedProgram]);
  const visibleGroups = useMemo(() => buildRecordingDisplayGroups(visibleRecordings, enrolledPrograms, selectedProgram), [enrolledPrograms, selectedProgram, visibleRecordings]);
  const lockedCount = useMemo(() => filteredRecordings.filter((item) => item.locked).length, [filteredRecordings]);
  const availableCount = useMemo(() => filteredRecordings.filter(hasRecordingAccess).length, [filteredRecordings]);
  const latestRecordingDate = useMemo(() => getLatestRecordingDate(filteredRecordings), [filteredRecordings]);
  const trackableRecordingIds = useMemo(() => filteredRecordings.filter(canTrackRecordingCompletion).map((recording) => recording.id), [filteredRecordings]);
  const progressQuery = useStudentRecordingProgress(trackableRecordingIds);
  const progressActions = useStudentRecordingProgressActions(trackableRecordingIds);
  const completedRecordingIds = useMemo(
    () => new Set((progressQuery.data?.items ?? []).map((item) => item.recordingId)),
    [progressQuery.data?.items]
  );
  const progressByGroupKey = useMemo(() => {
    const progressMap = new Map<string, RecordingGroupProgress>();
    progressGroups.forEach((group) => {
      progressMap.set(group.key, progressForGroup(group, completedRecordingIds));
    });
    return progressMap;
  }, [completedRecordingIds, progressGroups]);

  function updateProgramFilter(nextProgramKey: string) {
    const next = new URLSearchParams();
    next.set('page', '1');
    if (nextProgramKey) {
      next.set('programKey', nextProgramKey);
    }
    setSearchParams(next);
  }

  async function markRecordingComplete(recordingId: string) {
    setProgressError('');
    setPendingProgressRecordingId(recordingId);
    try {
      await progressActions.markComplete.mutateAsync(recordingId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Recording progress could not be updated right now.';
      setProgressError(message);
    } finally {
      setPendingProgressRecordingId(null);
    }
  }

  if (recordingsQuery.isLoading || cohortsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading watch recordings visible to your student profile." eyebrow="Watch recordings" title="Watch Recordings" />
        <LoadingState />
      </div>
    );
  }

  if (recordingsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Watch recordings could not be loaded right now." eyebrow="Watch recordings" title="Watch Recordings unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack student-recordings-page">
      <PageHeader
        description="Watch completed workshop recordings that are visible to your profile while locked recordings stay protected."
        eyebrow="Watch recordings"
        title="Watch Recordings"
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
          <span>Latest recording</span>
          <strong>{latestRecordingDate}</strong>
        </article>
      </div>

      {enrolledPrograms.length > 0 ? (
        <section className="student-recording-chips" aria-label="Recording program filters">
          {enrolledPrograms.map((program) => (
            <button
              className={`student-recording-chip ${activeProgramKey === program.value ? 'student-recording-chip--active' : ''}`}
              key={program.value}
              onClick={() => updateProgramFilter(program.value)}
              type="button"
            >
              <span>{program.label}</span>
              <strong>{program.count}</strong>
            </button>
          ))}
        </section>
      ) : null}

      {visibleRecordings.length > 0 ? (
        <section className="student-recording-list" aria-label="Visible recordings">
          {visibleGroups.map((group) => (
            <div className="student-recording-group" key={group.key}>
              {visibleGroups.length > 1 ? <h2>{group.label}</h2> : null}
              <RecordingProgressCard progress={progressByGroupKey.get(group.key) ?? progressForGroup(group, completedRecordingIds)} />
              {group.sections.map((section) => (
                <div className="student-recording-section" key={`${group.key}-${section.key}`}>
                  <div className="student-recording-section-heading">
                    <span>{section.label}</span>
                    <strong>{section.items.length}</strong>
                  </div>
                  {section.items.map((recording) => (
                    <RecordingRow
                      isCompleted={completedRecordingIds.has(recording.id)}
                      isProgressPending={pendingProgressRecordingId === recording.id}
                      key={recording.id}
                      onMarkComplete={(recordingId) => void markRecordingComplete(recordingId)}
                      recording={recording}
                      sectionKey={section.key}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Recording pagination">
        {safePage > 1 ? (
          <Link className="pagination-link" to={buildPageLink(safePage - 1, activeProgramKey)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {safePage} of {totalPages} · {total} matching
        </span>
        {safePage < totalPages ? (
          <Link className="pagination-link" to={buildPageLink(safePage + 1, activeProgramKey)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {lockedCount > 0 ? <LockedState /> : null}

      {progressError ? <StateBlock title="Training progress">{progressError}</StateBlock> : null}

      <StateBlock title="Recording access">
        Only recordings mapped to your account are shown here. Recording links and paid access stay protected for eligible learners.
      </StateBlock>
    </div>
  );
}
