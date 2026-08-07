import { ArrowLeft, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Copy, ExternalLink, Link2, Lock, Menu, MessageCircle, PlayCircle, ShieldCheck, Video, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { RecordingPlaybackMode, getRecordingPlaybackMode, getRecordingViewMode, useStudentFeatureControls } from '../features/useFeatureControls';

const pageSize = 25;

type RecordingProgramFilter = {
  cohortNames: string[];
  count: number;
  label: string;
  learningTrackLabel: string;
  liveProjectRoleLabel: string;
  roleFirst: boolean;
  value: string;
};

type RecordingDisplayGroup = {
  key: string;
  label: string;
  learningTrackLabel?: string;
  liveProjectRoleLabel?: string;
  roleFirst?: boolean;
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

function normalizeDisplayName(value: string | undefined | null) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

function friendlyLearningTrackLabel(programKey: string, programLabel: string) {
  const key = normalizeProgramKey(programKey).replace(/[^a-z0-9]+/g, '_');
  const label = normalizeDisplayName(programLabel);

  if (key.includes('smlp') || label.includes('sales') || label.includes('marketing')) return 'Marketing Track';
  if (key.includes('mclp') || label.includes('management consulting')) return 'Consulting & Business Analyst Track';
  if (key.includes('hrlp') || label.includes('human resources') || label.includes('hr leadership')) return 'HR Track';
  if (key.includes('pevc') || label.includes('private equity') || label.includes('venture capital')) return 'Finance - Private Equity & Venture Capital';
  if (key.includes('qf') || label.includes('quantitative finance') || label.includes('portfolio')) return 'Finance - Quantitative Finance';
  if (key.includes('er') || label.includes('equity research') || label.includes('financial modeling')) return 'Finance - Equity Research & Financial Modeling';
  if (key.includes('pmlp') || label.includes('product management')) return 'Product Management';

  return programLabel
    .replace(/\s*Leadership Program\s*/gi, '')
    .replace(/\s*Program\s*/gi, '')
    .trim() || programLabelFromKey(programKey);
}

function uniqueLabels(values: Array<string | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const key = normalizeDisplayName(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const uuidValuePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function recordingIdentityValues(recording: StudentRecording) {
  const extraIdentityFields = recording as StudentRecording & {
    workshopUuid?: string;
    workshop_id?: string;
    workshop_uuid?: string;
  };
  const seen = new Set<string>();
  return [
    recording.id,
    extraIdentityFields.workshopUuid,
    extraIdentityFields.workshop_uuid,
    recording.workshopId,
    extraIdentityFields.workshop_id
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function recordingCompletionId(recording: StudentRecording) {
  return recordingIdentityValues(recording).find((value) => uuidValuePattern.test(value)) ?? recording.id;
}

function isRecordingCompleted(recording: StudentRecording, completedRecordingIds: Set<string>) {
  return recordingIdentityValues(recording).some((value) => completedRecordingIds.has(value));
}

function recordingProgressQueryIds(recordings: StudentRecording[]) {
  return Array.from(new Set(
    recordings
      .filter(canTrackRecordingCompletion)
      .flatMap(recordingIdentityValues)
      .filter((value) => uuidValuePattern.test(value))
  ));
}

function liveProjectRoleLabelForCohorts(cohorts: StudentCohort[]) {
  return uniqueLabels(cohorts.flatMap((cohort) => cohort.liveProjectRoles ?? [])).join(' + ');
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

function parseRecordingDateValue(value: string | undefined, time?: string | null) {
  if (!value) {
    return null;
  }

  const cleanValue = value.trim();
  const cleanTime = time?.trim() || '00:00';
  const isoDateMatch = cleanValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    const date = new Date(`${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}T${cleanTime}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dayFirstMatch = cleanValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), ...cleanTime.split(':').map(Number).slice(0, 2));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(cleanValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = parseRecordingDateValue(value);
  return date ? date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : value;
}

function normalizeExternalLink(value: string | undefined | null) {
  const link = value?.trim();
  if (!link) return '';
  if (/^https?:\/\//i.test(link)) return link;
  if (/^(chat\.whatsapp\.com|wa\.me)\//i.test(link)) return `https://${link}`;
  return link;
}

function getLatestRecordingDate(recordings: StudentRecording[]) {
  const latest = recordings.reduce<Date | null>((currentLatest, recording) => {
    if (!recording.date) {
      return currentLatest;
    }

    const recordingDate = parseRecordingDateValue(recording.date, recording.time);
    if (!recordingDate) {
      return currentLatest;
    }

    return !currentLatest || recordingDate > currentLatest ? recordingDate : currentLatest;
  }, null);

  return latest ? formatDate(latest.toISOString()) : 'None';
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
  const time = parseRecordingDateValue(recording.date, recording.time)?.getTime() ?? Number.NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function normalizeRecordingTopic(value: string | undefined | null) {
  return (value ?? '')
    .toLowerCase()
    .replace(/modelling/g, 'modeling')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(session|workshop|recording|module)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function recordingAudienceKey(recording: StudentRecording) {
  const programKey = primaryProgramKeyForRecording(recording);
  if (programKey) return `program:${programKey}`;
  const cohortKey = recordingCohortNames(recording).sort().join('|');
  return cohortKey ? `cohorts:${cohortKey}` : 'all';
}

function recordingTopicDedupeKey(recording: StudentRecording) {
  const sequence = recordingSequenceNumber(recording);
  const topic = normalizeRecordingTopic(recording.recordingSequenceTitle || recording.title);
  const topicKey = sequence !== null ? `step:${sequence}:${topic || 'untitled'}` : topic || normalizeRecordingTopic(recording.title) || recording.id;
  return [recordingAudienceKey(recording), recordingSection(recording), topicKey].join('::');
}

function compareRecordingsByLatestDate(left: StudentRecording, right: StudentRecording) {
  const leftTime = recordingScheduledTime(left);
  const rightTime = recordingScheduledTime(right);
  if (leftTime !== rightTime) return rightTime - leftTime;
  if (Boolean(left.recordingUrl) !== Boolean(right.recordingUrl)) return left.recordingUrl ? -1 : 1;
  return left.title.localeCompare(right.title);
}

function keepLatestRecordingPerTopic(recordings: StudentRecording[]) {
  const latestByTopic = new Map<string, StudentRecording>();

  recordings.forEach((recording) => {
    const key = recordingTopicDedupeKey(recording);
    const current = latestByTopic.get(key);
    if (!current || compareRecordingsByLatestDate(recording, current) < 0) {
      latestByTopic.set(key, recording);
    }
  });

  return Array.from(latestByTopic.values());
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

function buildRecordingDisplayGroups(recordings: StudentRecording[], programs: RecordingProgramFilter[], selectedProgram?: RecordingProgramFilter, options: { includeEmptyPrograms?: boolean } = {}) {
  if (selectedProgram) {
    return [buildRecordingDisplayGroup(selectedProgram.value, selectedProgram.label, recordings, selectedProgram)];
  }

  if (programs.length <= 1) {
    const label = programs[0]?.label ?? 'Recordings';
    const key = programs[0]?.value ?? 'all';
    return [buildRecordingDisplayGroup(key, label, recordings, programs[0])];
  }

  const groups = programs
    .map((program) => buildRecordingDisplayGroup(program.value, program.label, recordings.filter((recording) => recordingMatchesProgram(recording, program)), program))
    .filter((group) => options.includeEmptyPrograms || group.sections.some((section) => section.items.length > 0));

  const assignedIds = new Set(groups.flatMap((group) => group.sections.flatMap((section) => section.items.map((recording) => recording.id))));
  const remaining = recordings.filter((recording) => !assignedIds.has(recording.id));
  return remaining.length > 0 ? [...groups, buildRecordingDisplayGroup('additional', 'Additional Recordings', remaining)] : groups;
}

function buildRecordingDisplayGroup(key: string, label: string, recordings: StudentRecording[], program?: RecordingProgramFilter): RecordingDisplayGroup {
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
    learningTrackLabel: program?.learningTrackLabel,
    liveProjectRoleLabel: program?.liveProjectRoleLabel,
    roleFirst: program?.roleFirst,
    sections
  };
}

function totalPagesFor(count: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

function youtubeVideoIdFromUrl(value: string | undefined | null) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    if (hostname === 'youtu.be') {
      return sanitizeYoutubeVideoId(url.pathname.split('/').filter(Boolean)[0]);
    }
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(hostname)) return '';
    const watchId = sanitizeYoutubeVideoId(url.searchParams.get('v'));
    if (watchId) return watchId;
    const pathParts = url.pathname.split('/').filter(Boolean);
    const embedIndex = pathParts.findIndex((part) => ['embed', 'shorts', 'live', 'v'].includes(part));
    return sanitizeYoutubeVideoId(embedIndex >= 0 ? pathParts[embedIndex + 1] : '');
  } catch (_error) {
    return '';
  }
}

function sanitizeYoutubeVideoId(value: string | undefined | null) {
  const cleanValue = value?.trim() ?? '';
  return /^[A-Za-z0-9_-]{6,}$/.test(cleanValue) ? cleanValue : '';
}

function youtubeEmbedUrl(recordingUrl: string | undefined | null) {
  const videoId = youtubeVideoIdFromUrl(recordingUrl);
  if (!videoId) return '';
  const params = new URLSearchParams({
    autoplay: '1',
    cc_load_policy: '0',
    iv_load_policy: '3',
    modestbranding: '1',
    playsinline: '1',
    rel: '0'
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function recordingsInGroup(group: RecordingDisplayGroup) {
  return group.sections.flatMap((section) => section.items);
}

function progressForGroup(group: RecordingDisplayGroup, completedRecordingIds: Set<string>): RecordingGroupProgress {
  const trackable = recordingsInGroup(group).filter(canTrackRecordingCompletion);
  const completed = trackable.filter((recording) => isRecordingCompleted(recording, completedRecordingIds)).length;
  const total = trackable.length;
  return {
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    total
  };
}

function groupWhatsappMeta(group: RecordingDisplayGroup, enrolledCohorts: StudentCohort[]) {
  const groupCohorts = new Set(recordingsInGroup(group).flatMap((recording) => recordingCohortNames(recording)));
  const matchingCohorts = enrolledCohorts.filter((cohort) => {
    const cohortName = normalizeCohortName(cohort.name);
    if (groupCohorts.has(cohortName)) return true;
    return programKeyForCohort(cohort) === group.key;
  });
  const cohortWithLink = matchingCohorts.find((cohort) => normalizeExternalLink(cohort.whatsappLink));
  return {
    label: 'Join WhatsApp Group',
    link: normalizeExternalLink(cohortWithLink?.whatsappLink)
  };
}

function groupCohortLabel(group: RecordingDisplayGroup, enrolledCohorts: StudentCohort[]) {
  const groupCohorts = new Set(recordingsInGroup(group).flatMap((recording) => recordingCohortNames(recording)));
  const matchingCohorts = enrolledCohorts.filter((cohort) => {
    const cohortName = normalizeCohortName(cohort.name);
    if (groupCohorts.has(cohortName)) return true;
    return programKeyForCohort(cohort) === group.key;
  });
  return matchingCohorts[0]?.name?.trim() || '';
}

function nextAvailableRecording(recordings: StudentRecording[], currentRecordingId: string, direction: 1 | -1) {
  const currentIndex = recordings.findIndex((recording) => recording.id === currentRecordingId);
  if (currentIndex < 0) return null;
  return recordings[currentIndex + direction] ?? null;
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
        <p>Complete atleast 75% training modules to get your training completion certificate. (Only for students who applied for Leadership Programs)</p>
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
  onOpenRecording,
  playbackMode,
  recording,
  sectionKey
}: {
  isCompleted: boolean;
  isProgressPending: boolean;
  onMarkComplete: (recordingId: string) => void;
  onOpenRecording: (recording: StudentRecording) => void;
  playbackMode: RecordingPlaybackMode;
  recording: StudentRecording;
  sectionKey: StudentRecordingSection;
}) {
  const canOpen = hasRecordingAccess(recording) && Boolean(recording.recordingUrl);
  const canOpenInPortal = playbackMode === 'popup' && Boolean(youtubeEmbedUrl(recording.recordingUrl));
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
          {formatDate(recording.date)} · {recording.time ?? 'Time not set'}
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
        {canOpen && canOpenInPortal ? (
          <button className="student-action student-action--primary" onClick={() => onOpenRecording(recording)} type="button">
            <Video size={16} />
            Open recording
          </button>
        ) : canOpen ? (
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
            <button className="student-recording-complete" disabled={isProgressPending} onClick={() => onMarkComplete(recordingCompletionId(recording))} type="button">
              <Check size={15} />
              {isProgressPending ? 'Saving...' : 'Complete'}
            </button>
          )
        ) : null}
        {relatedResources.length > 0 ? (
          <button
            aria-label={`${resourcesOpen ? 'Hide' : 'Show'} ${relatedResources.length} related resources for ${recording.title}`}
            className={resourcesOpen ? 'student-recording-resource-toggle student-recording-resource-toggle--open' : 'student-recording-resource-toggle'}
            onClick={() => setResourcesOpen((current) => !current)}
            type="button"
          >
            <Link2 size={15} />
            Resources
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

function RecordingVideoModal({ onClose, recording }: { onClose: () => void; recording: StudentRecording }) {
  const embedUrl = youtubeEmbedUrl(recording.recordingUrl);
  if (!embedUrl) return null;

  return (
    <div className="student-modal-backdrop student-recording-player-backdrop" role="presentation">
      <section aria-label={`Recording player for ${recording.title}`} aria-modal="true" className="student-recording-player-modal" role="dialog">
        <header className="student-recording-player-modal__header">
          <div>
            <span>Watch Recording</span>
            <h2>{recording.title}</h2>
            <p>
              {formatDate(recording.date)} · {recording.time ?? 'Time not set'}
            </p>
          </div>
          <button aria-label="Close recording player" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </header>
        <div className="student-recording-player-modal__frame">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            src={embedUrl}
            title={recording.title}
          />
        </div>
      </section>
    </div>
  );
}

function ModernRecordingResources({ recording }: { recording: StudentRecording }) {
  const initialRelatedResources = recording.relatedResources ?? [];
  const resourcesQuery = useStudentRecordingResources(recording.id, initialRelatedResources.length === 0 && hasRecordingAccess(recording));
  const relatedResources = initialRelatedResources.length > 0 ? initialRelatedResources : resourcesQuery.data?.resources ?? [];

  return (
    <section className="student-recording-modern-resources" aria-label="Related resources">
      <header>
        <span>Related resources</span>
        <strong>{relatedResources.length}</strong>
      </header>
      {relatedResources.length > 0 ? (
        <div className="student-recording-modern-resource-grid">
          {relatedResources.map((resource) => (
            <a className="student-recording-modern-resource" href={resource.url ?? '#'} key={resource.id} rel="noreferrer" target="_blank">
              <span className="student-recording-modern-resource__icon">
                <BookOpen size={22} />
              </span>
              <span className="student-recording-modern-resource__content">
                <i>Available</i>
                <strong>{resource.title}</strong>
                {resource.description ? <small>{resource.description}</small> : null}
              </span>
              <span className="student-recording-modern-resource__access">
                <b>Resource Access</b>
                <em>
                  <ExternalLink size={15} />
                  Open Resource
                </em>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="student-recording-modern-resource-empty">
          <BookOpen size={22} />
          <span>{resourcesQuery.isLoading ? 'Loading resources...' : 'No linked resources for this training module yet.'}</span>
        </div>
      )}
    </section>
  );
}

function StudentRecordingsModernLanding({
  completedRecordingIds,
  enrolledCohorts,
  groups,
  onOpenProgram,
  progressByGroupKey
}: {
  completedRecordingIds: Set<string>;
  enrolledCohorts: StudentCohort[];
  groups: RecordingDisplayGroup[];
  onOpenProgram: (programKey: string) => void;
  progressByGroupKey: Map<string, RecordingGroupProgress>;
}) {
  return (
    <div className="student-recordings-modern student-recordings-modern--landing">
      <PageHeader
        description="Choose a program to watch training sessions, continue progress, and access linked resources."
        title="Complete Your Training Sessions"
      />
      {groups.length > 0 ? (
        <section className="student-recording-modern-cards" aria-label="Recording programs">
          {groups.map((group) => {
            const recordings = recordingsInGroup(group);
            const progress = progressByGroupKey.get(group.key) ?? progressForGroup(group, completedRecordingIds);
            const whatsapp = groupWhatsappMeta(group, enrolledCohorts);
            const cohortLabel = groupCohortLabel(group, enrolledCohorts);
            const firstRecording = recordings.find(hasRecordingAccess) ?? recordings[0];
            return (
              <article className="student-recording-modern-card" key={group.key}>
                <button className="student-recording-modern-card__open" onClick={() => onOpenProgram(group.key)} type="button">
                  <div className="student-recording-modern-card__cover">
                    <span>
                      <img alt="Skilled Sapiens logo" src="/apple-touch-icon.png" />
                    </span>
                    <strong>{group.label}</strong>
                  </div>
                  <div className="student-recording-modern-card__body">
                    <div className="student-recording-modern-card__meta">
                      {group.liveProjectRoleLabel ? <small>Live Project Role(s): {group.liveProjectRoleLabel}</small> : null}
                      {cohortLabel ? <small>Your Cohort Name: {cohortLabel}</small> : null}
                    </div>
                    <div className="student-recording-modern-card__meter" aria-label={`${progress.percent}% completed`}>
                      <i style={{ width: `${progress.percent}%` }} />
                    </div>
                    <p>
                      {progress.completed} of {progress.total} completed · {recordings.length} Module{recordings.length === 1 ? '' : 's'}
                    </p>
                    <em>{firstRecording ? 'Start Now' : 'No recording available yet'}</em>
                  </div>
                </button>
                {whatsapp.link ? (
                  <a className="student-recording-modern-card__whatsapp" href={whatsapp.link} rel="noreferrer" target="_blank">
                    <MessageCircle size={16} />
                    {whatsapp.label}
                  </a>
                ) : (
                  <span className="student-recording-modern-card__whatsapp student-recording-modern-card__whatsapp--disabled">
                    <MessageCircle size={16} />
                    WhatsApp group unavailable
                  </span>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function StudentRecordingsModernPlayer({
  activeRecordingId,
  completedRecordingIds,
  group,
  isImmersive,
  showImmersiveToggle = true,
  isProgressPending,
  isSidebarOpen,
  onBack,
  onCompleteAndContinue,
  onPrevious,
  onSelectRecording,
  onToggleImmersive,
  onToggleSidebar,
  progress
}: {
  activeRecordingId: string;
  completedRecordingIds: Set<string>;
  group: RecordingDisplayGroup;
  isImmersive: boolean;
  showImmersiveToggle?: boolean;
  isProgressPending: boolean;
  isSidebarOpen: boolean;
  onBack: () => void;
  onCompleteAndContinue: () => void;
  onPrevious: () => void;
  onSelectRecording: (recordingId: string) => void;
  onToggleImmersive: () => void;
  onToggleSidebar: () => void;
  progress: RecordingGroupProgress;
}) {
  const recordings = recordingsInGroup(group);
  const activeRecording = recordings.find((recording) => recording.id === activeRecordingId) ?? recordings[0];
  const activeIndex = recordings.findIndex((recording) => recording.id === activeRecording.id);
  const embedUrl = youtubeEmbedUrl(activeRecording.recordingUrl);
  const currentSection = group.sections.find((section) => section.items.some((recording) => recording.id === activeRecording.id));
  const playerClassName = [
    'student-recordings-modern student-recordings-modern-player',
    isImmersive ? 'student-recordings-modern-player--immersive' : '',
    !isSidebarOpen ? 'student-recordings-modern-player--sidebar-closed' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={playerClassName}>
      <aside className={isSidebarOpen ? 'student-recording-modern-sidebar student-recording-modern-sidebar--open' : 'student-recording-modern-sidebar'}>
        <button className="student-recording-modern-back" onClick={onBack} type="button">
          <ArrowLeft size={20} />
          Programs
        </button>
        <div className="student-recording-modern-progress">
          <span>
            {progress.completed} of {progress.total} completed
          </span>
          <strong>{progress.percent}%</strong>
          <i>
            <b style={{ width: `${progress.percent}%` }} />
          </i>
        </div>
        <nav aria-label={`${group.label} recording sections`}>
          {group.sections.map((section) => (
            <section key={section.key}>
              <h3>{section.label}</h3>
              {section.items.map((recording) => {
                const isActive = recording.id === activeRecording.id;
                const isCompleted = isRecordingCompleted(recording, completedRecordingIds);
                return (
                  <button
                    className={[
                      'student-recording-modern-nav-item',
                      isActive ? 'student-recording-modern-nav-item--active' : '',
                      isCompleted ? 'student-recording-modern-nav-item--completed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={recording.id}
                    onClick={() => onSelectRecording(recording.id)}
                    type="button"
                  >
                    {isCompleted ? <CheckCircle2 size={16} /> : <PlayCircle size={16} />}
                    <span>
                      <strong>{recording.title}</strong>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>
      <main className="student-recording-modern-stage">
        <header className={showImmersiveToggle ? 'student-recording-modern-topbar' : 'student-recording-modern-topbar student-recording-modern-topbar--compact'}>
          <button aria-label="Toggle recording sections" onClick={onToggleSidebar} type="button">
            <Menu size={22} />
          </button>
          <div>
            <strong>{group.label}</strong>
            {currentSection ? <span>{currentSection.label}</span> : null}
          </div>
          <button className="student-recording-modern-link" disabled={activeIndex <= 0} onClick={onPrevious} type="button">
            Previous
          </button>
          <button className="student-recording-modern-primary" disabled={!canTrackRecordingCompletion(activeRecording) || isProgressPending} onClick={onCompleteAndContinue} type="button">
            {isProgressPending ? 'Saving...' : 'Complete and Continue'}
            <ChevronRight size={16} />
          </button>
          {showImmersiveToggle ? (
            <button aria-label={isImmersive ? 'Exit full screen view' : 'Open full screen view'} onClick={onToggleImmersive} type="button">
              <ExternalLink size={18} />
            </button>
          ) : null}
        </header>
        <div className="student-recording-modern-scroll">
          <section className="student-recording-modern-watch" aria-label={`Watch ${activeRecording.title}`}>
            <div className="student-recording-modern-video-card">
              {embedUrl ? (
                <div className="student-recording-modern-frame">
                  <iframe
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    src={embedUrl}
                    title={activeRecording.title}
                  />
                </div>
              ) : (
                <div className="student-recording-modern-frame student-recording-modern-frame--empty">
                  <Lock size={26} />
                  <strong>Recording cannot be embedded</strong>
                  {activeRecording.recordingUrl ? (
                    <a className="student-action student-action--primary" href={activeRecording.recordingUrl} rel="noreferrer" target="_blank">
                      <ExternalLink size={16} />
                      Open recording
                    </a>
                  ) : null}
                </div>
              )}
              <div className="student-recording-modern-title-block">
                <span>Training module</span>
                <h1>{activeRecording.title}</h1>
              </div>
            </div>
          </section>
          <ModernRecordingResources recording={activeRecording} />
        </div>
      </main>
    </div>
  );
}

function useStudentRecordingWorkspace(selectedProgramKey: string) {
  const recordingsQuery = useStudentRecordings({ limit: 500, page: 1 });
  const cohortsQuery = useStudentCohorts({ limit: 100, page: 1, status: 'all' });
  const recordings = recordingsQuery.data?.items ?? [];
  const enrolledCohorts = cohortsQuery.data?.items ?? [];
  const enrolledPrograms = useMemo<RecordingProgramFilter[]>(() => {
    const programMap = new Map<string, { cohortNames: Set<string>; cohorts: StudentCohort[]; label: string; value: string }>();
    enrolledCohorts.forEach((cohort) => {
      const key = programKeyForCohort(cohort);
      if (!key) return;
      const existing = programMap.get(key);
      const label = cohort.programName?.trim() || existing?.label || programLabelFromKey(key);
      const cohortNames = existing?.cohortNames ?? new Set<string>();
      const cohortName = normalizeCohortName(cohort.name);
      if (cohortName) cohortNames.add(cohortName);
      programMap.set(key, { cohortNames, cohorts: [...(existing?.cohorts ?? []), cohort], label, value: key });
    });

    return Array.from(programMap.values())
      .map((program) => {
        const filterProgram = { cohortNames: Array.from(program.cohortNames), value: program.value };
        const learningTrackLabel = friendlyLearningTrackLabel(program.value, program.label);
        const liveProjectRoleLabel = liveProjectRoleLabelForCohorts(program.cohorts);
        return {
          ...filterProgram,
          count: keepLatestRecordingPerTopic(recordings.filter((recording) => recordingMatchesProgram(recording, filterProgram))).length,
          label: learningTrackLabel,
          learningTrackLabel,
          liveProjectRoleLabel,
          roleFirst: false
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [enrolledCohorts, recordings]);
  const allRecordings = useMemo(() => keepLatestRecordingPerTopic(recordings).sort(compareRecordingsForStudent), [recordings]);
  const allDisplayGroups = useMemo(() => buildRecordingDisplayGroups(allRecordings, enrolledPrograms, undefined, { includeEmptyPrograms: true }), [allRecordings, enrolledPrograms]);
  const selectedGroup = useMemo(() => allDisplayGroups.find((group) => group.key === selectedProgramKey), [allDisplayGroups, selectedProgramKey]);
  const selectedRecordings = useMemo(() => selectedGroup ? recordingsInGroup(selectedGroup) : [], [selectedGroup]);
  const trackableRecordingIds = useMemo(() => recordingProgressQueryIds(allRecordings), [allRecordings]);
  const progressQuery = useStudentRecordingProgress(trackableRecordingIds);
  const progressActions = useStudentRecordingProgressActions(trackableRecordingIds);
  const completedRecordingIds = useMemo(
    () => new Set((progressQuery.data?.items ?? []).map((item) => item.recordingId)),
    [progressQuery.data?.items]
  );
  const progressByGroupKey = useMemo(() => {
    const progressMap = new Map<string, RecordingGroupProgress>();
    allDisplayGroups.forEach((group) => {
      progressMap.set(group.key, progressForGroup(group, completedRecordingIds));
    });
    return progressMap;
  }, [allDisplayGroups, completedRecordingIds]);

  return {
    allDisplayGroups,
    allRecordings,
    completedRecordingIds,
    enrolledCohorts,
    enrolledPrograms,
    isError: recordingsQuery.isError || cohortsQuery.isError,
    isLoading: recordingsQuery.isLoading || cohortsQuery.isLoading,
    progressActions,
    progressByGroupKey,
    selectedGroup,
    selectedRecordings
  };
}

export function StudentRecordingPlayerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedProgramKey = normalizeProgramKey(searchParams.get('programKey'));
  const [activeRecordingId, setActiveRecordingId] = useState('');
  const [pendingProgressRecordingId, setPendingProgressRecordingId] = useState<string | null>(null);
  const [progressError, setProgressError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const workspace = useStudentRecordingWorkspace(selectedProgramKey);

  useEffect(() => {
    if (workspace.selectedRecordings.some((recording) => recording.id === activeRecordingId)) return;
    const firstRecording = workspace.selectedRecordings.find(canTrackRecordingCompletion) ?? workspace.selectedRecordings[0];
    setActiveRecordingId(firstRecording?.id ?? '');
  }, [activeRecordingId, workspace.selectedRecordings]);

  async function markRecordingComplete(recordingId: string) {
    setProgressError('');
    setPendingProgressRecordingId(recordingId);
    try {
      await workspace.progressActions.markComplete.mutateAsync(recordingId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Recording progress could not be updated right now.';
      setProgressError(message);
    } finally {
      setPendingProgressRecordingId(null);
    }
  }

  async function completeAndContinue() {
    const currentRecordingId = activeRecordingId || workspace.selectedRecordings[0]?.id || '';
    const activeRecording = workspace.selectedRecordings.find((recording) => recording.id === currentRecordingId);
    if (!activeRecording) return;
    const nextRecording = nextAvailableRecording(workspace.selectedRecordings, activeRecording.id, 1);
    if (canTrackRecordingCompletion(activeRecording) && !isRecordingCompleted(activeRecording, workspace.completedRecordingIds)) {
      await markRecordingComplete(recordingCompletionId(activeRecording));
    }
    if (nextRecording) {
      setActiveRecordingId(nextRecording.id);
    }
  }

  function goToPrevious() {
    const currentRecordingId = activeRecordingId || workspace.selectedRecordings[0]?.id || '';
    const previousRecording = nextAvailableRecording(workspace.selectedRecordings, currentRecordingId, -1);
    if (previousRecording) setActiveRecordingId(previousRecording.id);
  }

  if (workspace.isLoading) {
    return (
      <main className="student-recording-player-page">
        <LoadingState />
      </main>
    );
  }

  if (workspace.isError) {
    return (
      <main className="student-recording-player-page">
        <ErrorState />
      </main>
    );
  }

  if (!workspace.selectedGroup || workspace.selectedRecordings.length === 0) {
    return (
      <main className="student-recording-player-page">
        <section className="student-recording-player-empty">
          <span>
            <Video size={30} />
          </span>
          <h1>No recording available yet</h1>
          <p>Recordings for this program will appear here once they are published for your cohort.</p>
          <button className="student-action student-action--primary" onClick={() => navigate('/student/programs')} type="button">
            <ArrowLeft size={16} />
            Back to Programs
          </button>
        </section>
      </main>
    );
  }

  const activePlayerRecordingId = activeRecordingId || workspace.selectedRecordings[0]?.id || '';
  const activePlayerRecording = workspace.selectedRecordings.find((recording) => recording.id === activePlayerRecordingId) ?? workspace.selectedRecordings[0];
  const activePlayerCompletionId = recordingCompletionId(activePlayerRecording);
  return (
    <main className="student-recording-player-page">
      {progressError ? (
        <StateBlock title="Progress update failed" tone="warning">
          {progressError}
        </StateBlock>
      ) : null}
      <StudentRecordingsModernPlayer
        activeRecordingId={activePlayerRecordingId}
        completedRecordingIds={workspace.completedRecordingIds}
        group={workspace.selectedGroup}
        isImmersive={false}
        isProgressPending={pendingProgressRecordingId === activePlayerCompletionId}
        isSidebarOpen={sidebarOpen}
        onBack={() => navigate('/student/programs')}
        onCompleteAndContinue={() => void completeAndContinue()}
        onPrevious={goToPrevious}
        onSelectRecording={setActiveRecordingId}
        onToggleImmersive={() => undefined}
        onToggleSidebar={() => setSidebarOpen((current) => !current)}
        progress={workspace.progressByGroupKey.get(workspace.selectedGroup.key) ?? progressForGroup(workspace.selectedGroup, workspace.completedRecordingIds)}
        showImmersiveToggle={false}
      />
    </main>
  );
}

export function StudentRecordingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingProgressRecordingId, setPendingProgressRecordingId] = useState<string | null>(null);
  const [progressError, setProgressError] = useState('');
  const [activePlayerRecording, setActivePlayerRecording] = useState<StudentRecording | null>(null);
  const [modernActiveRecordingId, setModernActiveRecordingId] = useState('');
  const [modernImmersive, setModernImmersive] = useState(false);
  const [modernSidebarOpen, setModernSidebarOpen] = useState(true);
  const selectedProgramKey = normalizeProgramKey(searchParams.get('programKey'));
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const recordingsQuery = useStudentRecordings({ limit: 500, page: 1 });
  const cohortsQuery = useStudentCohorts({ limit: 100, page: 1, status: 'all' });
  const featureControlsQuery = useStudentFeatureControls();
  const recordings = recordingsQuery.data?.items ?? [];
  const enrolledCohorts = cohortsQuery.data?.items ?? [];
  const recordingsFeature = useMemo(() => featureControlsQuery.data?.items.find((item) => item.moduleId === 'recordings'), [featureControlsQuery.data?.items]);
  const playbackMode = getRecordingPlaybackMode(recordingsFeature);
  const recordingViewMode = getRecordingViewMode(recordingsFeature);
  const enrolledPrograms = useMemo<RecordingProgramFilter[]>(() => {
    const programMap = new Map<string, { cohortNames: Set<string>; cohorts: StudentCohort[]; label: string; value: string }>();
    enrolledCohorts.forEach((cohort) => {
      const key = programKeyForCohort(cohort);
      if (!key) return;
      const existing = programMap.get(key);
      const label = cohort.programName?.trim() || existing?.label || programLabelFromKey(key);
      const cohortNames = existing?.cohortNames ?? new Set<string>();
      const cohortName = normalizeCohortName(cohort.name);
      if (cohortName) cohortNames.add(cohortName);
      programMap.set(key, { cohortNames, cohorts: [...(existing?.cohorts ?? []), cohort], label, value: key });
    });

    return Array.from(programMap.values())
      .map((program) => {
        const filterProgram = { cohortNames: Array.from(program.cohortNames), value: program.value };
        const learningTrackLabel = friendlyLearningTrackLabel(program.value, program.label);
        const liveProjectRoleLabel = liveProjectRoleLabelForCohorts(program.cohorts);
        return {
          ...filterProgram,
          count: keepLatestRecordingPerTopic(recordings.filter((recording) => recordingMatchesProgram(recording, filterProgram))).length,
          label: learningTrackLabel,
          learningTrackLabel,
          liveProjectRoleLabel,
          roleFirst: false
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [enrolledCohorts, recordings]);
  const allRecordings = useMemo(() => keepLatestRecordingPerTopic(recordings).sort(compareRecordingsForStudent), [recordings]);
  const allDisplayGroups = useMemo(() => buildRecordingDisplayGroups(allRecordings, enrolledPrograms, undefined, { includeEmptyPrograms: true }), [allRecordings, enrolledPrograms]);
  const activeProgramKey = recordingViewMode === 'modern' ? selectedProgramKey : selectedProgramKey || enrolledPrograms[0]?.value || '';
  const selectedProgram = useMemo(() => enrolledPrograms.find((program) => program.value === activeProgramKey), [activeProgramKey, enrolledPrograms]);
  const filteredRecordings = useMemo(() => {
    const matched = activeProgramKey
      ? selectedProgram
        ? recordings.filter((recording) => recordingMatchesProgram(recording, selectedProgram))
        : recordings.filter((recording) => primaryProgramKeyForRecording(recording) === activeProgramKey)
      : recordings;
    return keepLatestRecordingPerTopic(matched).sort(compareRecordingsForStudent);
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
  const trackableRecordingIds = useMemo(() => recordingProgressQueryIds(allRecordings), [allRecordings]);
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
  const allProgressByGroupKey = useMemo(() => {
    const progressMap = new Map<string, RecordingGroupProgress>();
    allDisplayGroups.forEach((group) => {
      progressMap.set(group.key, progressForGroup(group, completedRecordingIds));
    });
    return progressMap;
  }, [allDisplayGroups, completedRecordingIds]);
  const modernSelectedGroup = useMemo(() => allDisplayGroups.find((group) => group.key === selectedProgramKey), [allDisplayGroups, selectedProgramKey]);
  const modernSelectedRecordings = useMemo(() => modernSelectedGroup ? recordingsInGroup(modernSelectedGroup) : [], [modernSelectedGroup]);

  useEffect(() => {
    if (recordingViewMode !== 'modern' || !modernSelectedGroup) return;
    if (modernSelectedRecordings.some((recording) => recording.id === modernActiveRecordingId)) return;
    const firstRecording = modernSelectedRecordings.find(canTrackRecordingCompletion) ?? modernSelectedRecordings[0];
    setModernActiveRecordingId(firstRecording?.id ?? '');
  }, [modernActiveRecordingId, modernSelectedGroup, modernSelectedRecordings, recordingViewMode]);

  function updateProgramFilter(nextProgramKey: string) {
    const next = new URLSearchParams();
    next.set('page', '1');
    if (nextProgramKey) {
      next.set('programKey', nextProgramKey);
    }
    setSearchParams(next);
  }

  function openModernPlayer(nextProgramKey: string) {
    const next = new URLSearchParams();
    next.set('programKey', nextProgramKey);
    navigate(`/student/programs/player?${next.toString()}`);
  }

  function clearProgramFilter() {
    setSearchParams(new URLSearchParams());
    setModernImmersive(false);
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

  async function completeModernRecordingAndContinue() {
    const currentRecordingId = modernActiveRecordingId || modernSelectedRecordings[0]?.id || '';
    const activeRecording = modernSelectedRecordings.find((recording) => recording.id === currentRecordingId);
    if (!activeRecording) return;
    const nextRecording = nextAvailableRecording(modernSelectedRecordings, activeRecording.id, 1);
    if (canTrackRecordingCompletion(activeRecording) && !isRecordingCompleted(activeRecording, completedRecordingIds)) {
      await markRecordingComplete(recordingCompletionId(activeRecording));
    }
    if (nextRecording) {
      setModernActiveRecordingId(nextRecording.id);
    }
  }

  function goToPreviousModernRecording() {
    const currentRecordingId = modernActiveRecordingId || modernSelectedRecordings[0]?.id || '';
    const previousRecording = nextAvailableRecording(modernSelectedRecordings, currentRecordingId, -1);
    if (previousRecording) setModernActiveRecordingId(previousRecording.id);
  }

  if (recordingsQuery.isLoading || cohortsQuery.isLoading || featureControlsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading programs visible to your student profile." eyebrow="My learning" title="My Programs" />
        <LoadingState />
      </div>
    );
  }

  if (recordingsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Your programs could not be loaded right now." eyebrow="My learning" title="My Programs unavailable" />
        <ErrorState />
      </div>
    );
  }

  if (recordingViewMode === 'modern') {
    const activeModernRecordingId = modernActiveRecordingId || modernSelectedRecordings[0]?.id || '';
    if (modernSelectedGroup && modernSelectedRecordings.length > 0 && activeModernRecordingId) {
      const activeModernRecording = modernSelectedRecordings.find((recording) => recording.id === activeModernRecordingId) ?? modernSelectedRecordings[0];
      const activeModernCompletionId = recordingCompletionId(activeModernRecording);
      return (
        <StudentRecordingsModernPlayer
          activeRecordingId={activeModernRecordingId}
          completedRecordingIds={completedRecordingIds}
          group={modernSelectedGroup}
          isImmersive={modernImmersive}
          isProgressPending={pendingProgressRecordingId === activeModernCompletionId}
          isSidebarOpen={modernSidebarOpen}
          onBack={clearProgramFilter}
          onCompleteAndContinue={() => void completeModernRecordingAndContinue()}
          onPrevious={goToPreviousModernRecording}
          onSelectRecording={setModernActiveRecordingId}
          onToggleImmersive={() => setModernImmersive((current) => !current)}
          onToggleSidebar={() => setModernSidebarOpen((current) => !current)}
          progress={allProgressByGroupKey.get(modernSelectedGroup.key) ?? progressForGroup(modernSelectedGroup, completedRecordingIds)}
        />
      );
    }

    return (
      <StudentRecordingsModernLanding
        completedRecordingIds={completedRecordingIds}
        enrolledCohorts={enrolledCohorts}
        groups={allDisplayGroups}
        onOpenProgram={openModernPlayer}
        progressByGroupKey={allProgressByGroupKey}
      />
    );
  }

  return (
    <div className="page-stack student-recordings-page">
      <PageHeader
        description="Open your programs, continue training modules, and access recordings available to your profile."
        title="My Programs"
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
        {lockedCount > 0 ? (
          <article>
            <Lock size={20} />
            <span>Locked</span>
            <strong>{lockedCount}</strong>
          </article>
        ) : null}
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
              <span className="student-recording-chip__text">
                <span>{program.label}</span>
                {program.roleFirst ? <small>Learning Track: {program.learningTrackLabel}</small> : null}
              </span>
              <strong>{program.count}</strong>
            </button>
          ))}
        </section>
      ) : null}

      {visibleRecordings.length > 0 ? (
        <section className="student-recording-list" aria-label="Visible recordings">
          {visibleGroups.map((group) => (
            <div className="student-recording-group" key={group.key}>
              <header className="student-recording-group__header">
                <span>{group.roleFirst ? `Recordings for ${group.label}` : `${group.label} Recordings`}</span>
                {group.roleFirst && group.learningTrackLabel ? <small>Learning Track: {group.learningTrackLabel}</small> : null}
              </header>
              <RecordingProgressCard progress={progressByGroupKey.get(group.key) ?? progressForGroup(group, completedRecordingIds)} />
              {group.sections.map((section) => (
                <div className="student-recording-section" key={`${group.key}-${section.key}`}>
                  <div className="student-recording-section-heading">
                    <span>{section.label}</span>
                    <strong>{section.items.length}</strong>
                  </div>
                  {section.items.map((recording) => (
                    <RecordingRow
                      isCompleted={isRecordingCompleted(recording, completedRecordingIds)}
                      isProgressPending={pendingProgressRecordingId === recordingCompletionId(recording)}
                      key={recording.id}
                      onMarkComplete={(recordingId) => void markRecordingComplete(recordingId)}
                      onOpenRecording={setActivePlayerRecording}
                      playbackMode={playbackMode}
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

      {activePlayerRecording ? <RecordingVideoModal onClose={() => setActivePlayerRecording(null)} recording={activePlayerRecording} /> : null}
    </div>
  );
}
