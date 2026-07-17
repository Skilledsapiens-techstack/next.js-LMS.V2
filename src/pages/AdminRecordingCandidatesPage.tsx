import { AlertTriangle, CheckCircle2, Clock3, Edit3, ExternalLink, Link2, ListOrdered, Loader2, Play, RefreshCw, Save, Search, Trash2, Video, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import { AdminProgram, useAdminPrograms } from '../features/admin/useAdminPrograms';
import { customWorkshopTopicValue, loadSavedWorkshopTopics, uniqueTitles } from '../lib/workshopTopics';
import {
  AdminRecordingCandidate,
  AdminRecordingSection,
  AdminRecordingSequenceRule,
  useAdminRecordingCandidates,
  useAdminRecordingResourceLinks,
  useAdminRecordingResourceSummary,
  useAdminRecordingSequenceRules,
  useCreateAdminRecordingSequenceRule,
  useDeleteAdminRecordingSequenceRule,
  useUpdateAdminRecordingResourceLinks,
  useUpdateAdminRecordingSequenceRule
} from '../features/admin/useAdminRecordingCandidates';
import { AdminResource, useAdminResources } from '../features/admin/useAdminResources';
import {
  AdminWorkshop,
  useCreateAdminManualRecordingCandidate,
  useEditAdminPublishedRecording,
  useAdminWorkshops,
  useFetchAdminWorkshopRecordings,
  usePublishAdminWorkshopRecording,
  useRejectAdminWorkshopRecording
} from '../features/admin/useAdminWorkshops';

type RecordingTab = 'add-link' | 'pending' | 'published' | 'rejected';
type ProgramFilter = 'all' | string;
type CohortFilter = 'all' | string;
type RecordingSortOption = 'latest-updated' | 'session-newest' | 'session-oldest' | 'program-az' | 'cohort-az';
type RecordingEditForm = {
  alternateUrl: string;
  cohortNames: string[];
  passcode: string;
  programKey: string;
  title: string;
  workshopId: string;
  youtubeUrl: string;
};
type RecordingSequenceForm = {
  aliases: string;
  programKeys: string[];
  recordingSection: AdminRecordingSection;
  sequenceNumber: string;
  status: 'active' | 'inactive';
  title: string;
};

type ResourceManagerState = {
  recordingId: string;
  title: string;
};

const pageSize = 25;

const recordingSortOptions: Array<{ label: string; value: RecordingSortOption }> = [
  { label: 'Latest Updated', value: 'latest-updated' },
  { label: 'Session Date: Newest', value: 'session-newest' },
  { label: 'Session Date: Oldest', value: 'session-oldest' },
  { label: 'Program A-Z', value: 'program-az' },
  { label: 'Cohort A-Z', value: 'cohort-az' }
];

const emptySequenceForm: RecordingSequenceForm = {
  aliases: '',
  programKeys: [],
  recordingSection: 'other_workshops',
  sequenceNumber: '',
  status: 'active',
  title: ''
};

const recordingSectionOptions: Array<{ label: string; value: AdminRecordingSection }> = [
  { label: 'Induction & Live Project Overview', value: 'induction_live_project' },
  { label: 'Core Modules', value: 'core_modules' },
  { label: 'Placement Mentorship', value: 'placement_mentorship' },
  { label: 'Other Workshops', value: 'other_workshops' }
];

function recordingSectionLabel(value: string | undefined | null) {
  return recordingSectionOptions.find((option) => option.value === value)?.label ?? 'Other Workshops';
}

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
  return item.zoomId ? 'Zoom' : 'Manual';
}

function resourceSummary(resource: AdminResource) {
  return [resource.resourceType, resource.resourceMode, resource.programKeys?.slice(0, 2).join(', '), resource.cohortNames?.slice(0, 2).join(', ')]
    .filter(Boolean)
    .join(' · ');
}

function normalizeSequenceText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSequenceAliases(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function sequenceRuleMatchesWorkshop(workshop: AdminWorkshop, rule: AdminRecordingSequenceRule) {
  const workshopProgramKey = workshop.programKey?.trim().toLowerCase() ?? '';
  if (!workshopProgramKey || workshopProgramKey !== rule.programKey) return false;
  const title = normalizeSequenceText(workshop.title);
  if (!title) return false;
  const candidates = [rule.title, ...(rule.matchAliases ?? [])].map(normalizeSequenceText).filter(Boolean);
  return candidates.some((candidate) => candidate === title || (candidate.length >= 8 && title.includes(candidate)) || (title.length >= 8 && candidate.includes(title)));
}

function sequenceMatchForWorkshop(workshop: AdminWorkshop, rules: AdminRecordingSequenceRule[]) {
  return rules.find((rule) => rule.status === 'active' && sequenceRuleMatchesWorkshop(workshop, rule));
}

function comparePublishedWorkshops(
  left: AdminWorkshop,
  right: AdminWorkshop,
  sortBy: RecordingSortOption,
  programs: AdminProgram[],
  sequenceRules: AdminRecordingSequenceRule[]
) {
  if (sortBy === 'latest-updated') {
    const leftSequence = sequenceMatchForWorkshop(left, sequenceRules)?.sequenceNumber;
    const rightSequence = sequenceMatchForWorkshop(right, sequenceRules)?.sequenceNumber;
    const leftSequenced = typeof leftSequence === 'number';
    const rightSequenced = typeof rightSequence === 'number';
    if (leftSequenced && rightSequenced && leftSequence !== rightSequence) return leftSequence - rightSequence;
    if (leftSequenced !== rightSequenced) return leftSequenced ? -1 : 1;
  }

  return compareWorkshopsBySort(left, right, sortBy, programs);
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

function isReviewableCandidate(candidate: AdminRecordingCandidate) {
  const fileType = String(candidate.fileType ?? '').toUpperCase();
  if (fileType === 'URL') return Boolean(candidate.playUrl);
  return fileType === 'MP4' && String(candidate.recordingType ?? '').toLowerCase() === 'shared_screen_with_speaker_view';
}

function hasOpenRecordingReviewHistory(candidates: AdminRecordingCandidate[], workshop: AdminWorkshop) {
  const workshopKey = workshop.workshopId ?? workshop.id;
  return candidates.some((candidate) => candidate.workshopId === workshopKey && (candidate.status === 'draft' || candidate.status === 'rejected'));
}

function timeValue(value: string | undefined, fallback = 0) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function workshopScheduledTime(workshop: AdminWorkshop, fallback = Number.POSITIVE_INFINITY) {
  const dateMatch = workshop.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = workshop.time?.match(/^(\d{1,2}):(\d{2})/);

  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;
    const scheduledAt = new Date(Number(year), Number(month) - 1, Number(day), hour, minute).getTime();
    return Number.isFinite(scheduledAt) ? scheduledAt : fallback;
  }

  return timeValue(workshop.date, fallback);
}

function workshopUpdatedTime(workshop: AdminWorkshop) {
  return timeValue(workshop.updatedAt);
}

function latestTimestamp(candidate: AdminRecordingCandidate) {
  return timeValue(candidate.reviewedAt ?? candidate.updatedAt ?? candidate.detectedAt);
}

function compareCandidatesByLatestDesc(left: AdminRecordingCandidate, right: AdminRecordingCandidate) {
  const latestDiff = latestTimestamp(right) - latestTimestamp(left);
  if (latestDiff !== 0) return latestDiff;

  return String(left.workshopId ?? left.id).localeCompare(String(right.workshopId ?? right.id));
}

function workshopProgramLabel(workshop: AdminWorkshop | undefined, programs: AdminProgram[]) {
  return programLabelFor(programs, workshop?.programKey).toLowerCase();
}

function workshopCohortLabel(workshop: AdminWorkshop | undefined) {
  return (workshop?.cohortNames[0] ?? '').toLowerCase();
}

function candidateWorkshopScheduledTime(workshop: AdminWorkshop | undefined, fallback = Number.POSITIVE_INFINITY) {
  return workshop ? workshopScheduledTime(workshop, fallback) : fallback;
}

function compareWorkshopsBySort(left: AdminWorkshop, right: AdminWorkshop, sortBy: RecordingSortOption, programs: AdminProgram[]) {
  if (sortBy === 'session-newest') {
    const scheduledDiff = workshopScheduledTime(right, 0) - workshopScheduledTime(left, 0);
    if (scheduledDiff !== 0) return scheduledDiff;
  }

  if (sortBy === 'session-oldest') {
    const scheduledDiff = workshopScheduledTime(left) - workshopScheduledTime(right);
    if (scheduledDiff !== 0) return scheduledDiff;
  }

  if (sortBy === 'program-az') {
    const programDiff = workshopProgramLabel(left, programs).localeCompare(workshopProgramLabel(right, programs));
    if (programDiff !== 0) return programDiff;
  }

  if (sortBy === 'cohort-az') {
    const cohortDiff = workshopCohortLabel(left).localeCompare(workshopCohortLabel(right));
    if (cohortDiff !== 0) return cohortDiff;
  }

  const updatedDiff = workshopUpdatedTime(right) - workshopUpdatedTime(left);
  if (updatedDiff !== 0) return updatedDiff;

  const scheduledDiff = workshopScheduledTime(right, 0) - workshopScheduledTime(left, 0);
  if (scheduledDiff !== 0) return scheduledDiff;

  return left.title.localeCompare(right.title);
}

function compareCandidatesBySort(
  left: AdminRecordingCandidate,
  right: AdminRecordingCandidate,
  sortBy: RecordingSortOption,
  workshopsByKey: Map<string, AdminWorkshop>,
  programs: AdminProgram[]
) {
  const leftWorkshop = workshopsByKey.get(left.workshopId);
  const rightWorkshop = workshopsByKey.get(right.workshopId);

  if (sortBy === 'session-newest') {
    const scheduledDiff = candidateWorkshopScheduledTime(rightWorkshop, 0) - candidateWorkshopScheduledTime(leftWorkshop, 0);
    if (scheduledDiff !== 0) return scheduledDiff;
  }

  if (sortBy === 'session-oldest') {
    const scheduledDiff = candidateWorkshopScheduledTime(leftWorkshop) - candidateWorkshopScheduledTime(rightWorkshop);
    if (scheduledDiff !== 0) return scheduledDiff;
  }

  if (sortBy === 'program-az') {
    const programDiff = workshopProgramLabel(leftWorkshop, programs).localeCompare(workshopProgramLabel(rightWorkshop, programs));
    if (programDiff !== 0) return programDiff;
  }

  if (sortBy === 'cohort-az') {
    const cohortDiff = workshopCohortLabel(leftWorkshop).localeCompare(workshopCohortLabel(rightWorkshop));
    if (cohortDiff !== 0) return cohortDiff;
  }

  const latestDiff = latestTimestamp(right) - latestTimestamp(left);
  if (latestDiff !== 0) return latestDiff;

  return String(left.workshopId ?? left.id).localeCompare(String(right.workshopId ?? right.id));
}

function dedupeRejectedCandidates(candidates: AdminRecordingCandidate[]) {
  const byWorkshopAndUrl = new Map<string, AdminRecordingCandidate>();
  candidates.forEach((candidate) => {
    const key = `${candidate.workshopId}::${candidate.playUrl ?? candidate.zoomRecordingFileId ?? candidate.id}`;
    const current = byWorkshopAndUrl.get(key);
    if (!current || latestTimestamp(candidate) >= latestTimestamp(current)) {
      byWorkshopAndUrl.set(key, candidate);
    }
  });
  return Array.from(byWorkshopAndUrl.values()).sort(compareCandidatesByLatestDesc);
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
  const [activeTab, setActiveTab] = useState<RecordingTab>('add-link');
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all');
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>('all');
  const [sortBy, setSortBy] = useState<RecordingSortOption>('latest-updated');
  const [search, setSearch] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pageByTab, setPageByTab] = useState<Record<RecordingTab, number>>({ 'add-link': 1, pending: 1, published: 1, rejected: 1 });
  const [recordingEditForm, setRecordingEditForm] = useState<RecordingEditForm | null>(null);
  const [showSequenceManager, setShowSequenceManager] = useState(false);
  const [sequenceForm, setSequenceForm] = useState<RecordingSequenceForm>(emptySequenceForm);
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const [sequenceCustomTitleMode, setSequenceCustomTitleMode] = useState(false);
  const [resourceManager, setResourceManager] = useState<ResourceManagerState | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [savedWorkshopTopics] = useState<string[]>(loadSavedWorkshopTopics);
  const workshopsQuery = useAdminWorkshops({ limit: 500, page: 1, status: 'Completed' });
  const candidatesQuery = useAdminRecordingCandidates({ limit: 500, page: 1, status: 'all' });
  const sequenceRulesQuery = useAdminRecordingSequenceRules({ limit: 500, page: 1, status: 'all' });
  const resourcesQuery = useAdminResources({ limit: 500, page: 1, status: 'active' });
  const recordingResourceLinksQuery = useAdminRecordingResourceLinks(resourceManager?.recordingId);
  const programsQuery = useAdminPrograms({ limit: 500, page: 1, status: 'active' });
  const activeCohortsQuery = useAdminCohorts({ limit: 500, page: 1, status: 'active' });
  const fetchRecordingsMutation = useFetchAdminWorkshopRecordings();
  const publishRecordingMutation = usePublishAdminWorkshopRecording();
  const rejectRecordingMutation = useRejectAdminWorkshopRecording();
  const createManualCandidateMutation = useCreateAdminManualRecordingCandidate();
  const editPublishedRecordingMutation = useEditAdminPublishedRecording();
  const createSequenceRuleMutation = useCreateAdminRecordingSequenceRule();
  const updateSequenceRuleMutation = useUpdateAdminRecordingSequenceRule();
  const deleteSequenceRuleMutation = useDeleteAdminRecordingSequenceRule();
  const updateRecordingResourceLinksMutation = useUpdateAdminRecordingResourceLinks();
  const workshops = workshopsQuery.data?.items ?? [];
  const candidates = (candidatesQuery.data?.items ?? []).filter(isReviewableCandidate);
  const sequenceRules = sequenceRulesQuery.data?.items ?? [];
  const resources = resourcesQuery.data?.items ?? [];
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
  const workshopTopicOptions = useMemo(() => uniqueTitles(savedWorkshopTopics), [savedWorkshopTopics]);

  const cohortOptions = useMemo(() => {
    const eligibleCohorts = programFilter === 'all' ? activeCohorts : activeCohorts.filter((cohort) => cohortProgramMatches(cohort, programFilter));
    return Array.from(new Set(eligibleCohorts.map((cohort) => cohort.name).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [activeCohorts, programFilter]);

  useEffect(() => {
    if (cohortFilter !== 'all' && !cohortOptions.includes(cohortFilter)) {
      setCohortFilter('all');
      setPageByTab({ 'add-link': 1, pending: 1, published: 1, rejected: 1 });
    }
  }, [cohortFilter, cohortOptions]);

  useEffect(() => {
    if (resourceManager && recordingResourceLinksQuery.data) {
      setSelectedResourceIds(recordingResourceLinksQuery.data.resourceIds);
    }
  }, [recordingResourceLinksQuery.data, resourceManager]);

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
      }).sort((left, right) => compareCandidatesBySort(left, right, sortBy, workshopsByKey, programs)),
    [candidates, cohortFilter, normalizedSearch, programFilter, programs, sortBy, workshopsByKey]
  );

  const publishedWorkshops = useMemo(
    () =>
      workshops
        .filter((workshop) => hasRecordingLink(workshop) && workshopMatches(workshop, normalizedSearch, programFilter, cohortFilter))
        .sort((left, right) => comparePublishedWorkshops(left, right, sortBy, programs, sequenceRules)),
    [cohortFilter, normalizedSearch, programFilter, programs, sequenceRules, sortBy, workshops]
  );

  const addLinkWorkshops = useMemo(
    () =>
      workshops.filter(
        (workshop) =>
          !hasRecordingLink(workshop) &&
          !hasOpenRecordingReviewHistory(candidates, workshop) &&
          workshopMatches(workshop, normalizedSearch, programFilter, cohortFilter)
      ).sort((left, right) => compareWorkshopsBySort(left, right, sortBy, programs)),
    [candidates, cohortFilter, normalizedSearch, programFilter, programs, sortBy, workshops]
  );

  const rejectedCandidates = useMemo(
    () =>
      dedupeRejectedCandidates(candidates.filter((candidate) => {
        const workshop = workshopsByKey.get(candidate.workshopId);
        return (
          candidate.status === 'rejected' &&
          candidateMatches(candidate, workshop, normalizedSearch) &&
          (programFilter === 'all' || workshop?.programKey === programFilter) &&
          (cohortFilter === 'all' || Boolean(workshop?.cohortNames.includes(cohortFilter)))
        );
      })).sort((left, right) => compareCandidatesBySort(left, right, sortBy, workshopsByKey, programs)),
    [candidates, cohortFilter, normalizedSearch, programFilter, programs, sortBy, workshopsByKey]
  );

  const reviewedCount = candidates.filter((candidate) => candidate.status === 'reviewed').length;
  const rejectedCount = rejectedCandidates.length;
  const visibleByTab = {
    'add-link': addLinkWorkshops,
    pending: pendingCandidates,
    published: publishedWorkshops,
    rejected: rejectedCandidates
  };
  const activeItems = visibleByTab[activeTab];
  const activePage = Math.min(pageByTab[activeTab], totalPagesFor(activeItems.length));
  const activeTotalPages = totalPagesFor(activeItems.length);
  const paginatedPublishedWorkshops = useMemo(() => paginateItems(publishedWorkshops, activePage), [activePage, publishedWorkshops]);
  const recordingResourceSummaryQuery = useAdminRecordingResourceSummary(activeTab === 'published' ? paginatedPublishedWorkshops.map((workshop) => workshop.id) : []);
  const resourceCountByRecordingId = useMemo(() => {
    return new Map((recordingResourceSummaryQuery.data?.items ?? []).map((item) => [item.recordingId, item.resourceCount]));
  }, [recordingResourceSummaryQuery.data?.items]);

  async function refetchRecordingData() {
    await Promise.all([candidatesQuery.refetch(), workshopsQuery.refetch()]);
  }

  function resetPages() {
    setPageByTab({ 'add-link': 1, pending: 1, published: 1, rejected: 1 });
  }

  function changeTab(tab: RecordingTab) {
    setActiveTab(tab);
    setPageByTab((current) => ({ ...current, [tab]: 1 }));
    setRecordingEditForm(null);
  }

  function buildRecordingEditForm(workshop: AdminWorkshop): RecordingEditForm {
    return {
      alternateUrl: workshop.zoomRecordingUrl ?? '',
      cohortNames: workshop.cohortNames,
      passcode: workshop.zoomRecordingPassword ?? '',
      programKey: workshop.programKey ?? '',
      title: workshop.title,
      workshopId: workshop.id,
      youtubeUrl: workshop.youtubeVideoUrl ?? ''
    };
  }

  function startEditingRecording(workshop: AdminWorkshop) {
    setRecordingEditForm(buildRecordingEditForm(workshop));
  }

  function startEditingPublishedRecording(workshop: AdminWorkshop) {
    setRecordingEditForm({
      ...buildRecordingEditForm(workshop),
      alternateUrl: workshop.zoomRecordingUrl ?? (workshop.youtubeVideoUrl ? '' : recordingUrlFor(workshop))
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
      await createManualCandidateMutation.mutateAsync({
        body: {
          youtubeVideoUrl: youtubeUrl || null,
          zoomRecordingPassword: recordingEditForm.passcode.trim() || null,
          zoomRecordingUrl: alternateUrl || null
        },
        workshopId: recordingEditForm.workshopId
      });
      await refetchRecordingData();
      setRecordingEditForm(null);
      setActiveTab('pending');
      setPageByTab((current) => ({ ...current, pending: 1 }));
      setActionMessage('Recording link saved for review.');
    } catch (error) {
      setActionMessage(readableError(error, 'Recording link could not be saved for review.'));
    }
  }

  async function savePublishedRecording(workshop: AdminWorkshop) {
    if (!recordingEditForm) return;
    const title = recordingEditForm.title.trim();
    const youtubeUrl = recordingEditForm.youtubeUrl.trim();
    const alternateUrl = recordingEditForm.alternateUrl.trim();

    setActionMessage(null);
    if (!title) {
      setActionMessage('Published recording title is required.');
      return;
    }
    if (!youtubeUrl && !alternateUrl) {
      setActionMessage('Published recordings must keep at least one recording link.');
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
      await editPublishedRecordingMutation.mutateAsync({
        body: {
          cohortNames: recordingEditForm.cohortNames,
          programKey: recordingEditForm.programKey || null,
          title,
          youtubeVideoUrl: youtubeUrl || null,
          zoomRecordingPassword: recordingEditForm.passcode.trim() || null,
          zoomRecordingUrl: alternateUrl || null
        },
        workshopId: workshop.id
      });
      await refetchRecordingData();
      setRecordingEditForm(null);
      setActionMessage('Published recording updated. Student visibility rules are unchanged.');
    } catch (error) {
      setActionMessage(readableError(error, 'Published recording could not be updated.'));
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

  function toggleEditCohort(cohortName: string) {
    setRecordingEditForm((current) => {
      if (!current) return current;
      const selected = new Set(current.cohortNames);
      if (selected.has(cohortName)) selected.delete(cohortName);
      else selected.add(cohortName);
      return { ...current, cohortNames: Array.from(selected) };
    });
  }

  function resetSequenceForm(nextProgramKeys = sequenceForm.programKeys) {
    setEditingSequenceId(null);
    setSequenceCustomTitleMode(false);
    setSequenceForm({ ...emptySequenceForm, programKeys: nextProgramKeys });
  }

  function handleSequenceTopicSelect(value: string) {
    if (value === customWorkshopTopicValue) {
      setSequenceCustomTitleMode(true);
      setSequenceForm((current) => ({ ...current, title: '' }));
      return;
    }
    setSequenceCustomTitleMode(false);
    setSequenceForm((current) => ({ ...current, title: value }));
  }

  function startEditingSequence(rule: AdminRecordingSequenceRule) {
    setEditingSequenceId(rule.id);
    setSequenceCustomTitleMode(!workshopTopicOptions.includes(rule.title));
    setSequenceForm({
      aliases: (rule.matchAliases ?? []).join('\n'),
      programKeys: [rule.programKey],
      recordingSection: rule.recordingSection ?? 'other_workshops',
      sequenceNumber: String(rule.sequenceNumber),
      status: rule.status,
      title: rule.title
    });
    setShowSequenceManager(true);
  }

  function toggleSequenceProgram(programKey: string) {
    setSequenceForm((current) => {
      const normalizedProgramKey = programKey.trim().toLowerCase();
      const selected = new Set(current.programKeys);
      if (selected.has(normalizedProgramKey)) selected.delete(normalizedProgramKey);
      else selected.add(normalizedProgramKey);
      return { ...current, programKeys: Array.from(selected) };
    });
  }

  function selectAllSequencePrograms() {
    setSequenceForm((current) => ({ ...current, programKeys: programKeys.map((programKey) => programKey.trim().toLowerCase()).filter(Boolean) }));
  }

  function clearSequencePrograms() {
    setSequenceForm((current) => ({ ...current, programKeys: [] }));
  }

  async function saveSequenceRule() {
    const selectedProgramKeys = Array.from(new Set(sequenceForm.programKeys.map((programKey) => programKey.trim().toLowerCase()).filter(Boolean)));
    const title = sequenceForm.title.trim();
    const sequenceNumber = Number(sequenceForm.sequenceNumber);
    setActionMessage(null);

    if (selectedProgramKeys.length === 0) {
      setActionMessage('Select at least one program before saving sequence.');
      return;
    }
    if (editingSequenceId && selectedProgramKeys.length !== 1) {
      setActionMessage('Editing an existing sequence supports one program. Select one program or reset before bulk adding.');
      return;
    }
    if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
      setActionMessage('Sequence number must be 1 or higher.');
      return;
    }
    if (!title) {
      setActionMessage('Workshop title is required for sequence matching.');
      return;
    }

    const baseBody = {
      matchAliases: splitSequenceAliases(sequenceForm.aliases),
      recordingSection: sequenceForm.recordingSection,
      sequenceNumber,
      status: sequenceForm.status,
      title
    };

    try {
      if (editingSequenceId) {
        await updateSequenceRuleMutation.mutateAsync({ body: { ...baseBody, programKey: selectedProgramKeys[0] }, id: editingSequenceId });
        await sequenceRulesQuery.refetch();
        resetSequenceForm(selectedProgramKeys);
        setActionMessage('Recording sequence updated.');
      } else {
        const skippedProgramKeys =
          sequenceForm.status === 'active'
            ? selectedProgramKeys.filter((programKey) =>
                sequenceRules.some(
                  (rule) =>
                    rule.status === 'active' &&
                    rule.programKey === programKey &&
                    rule.recordingSection === sequenceForm.recordingSection &&
                    rule.sequenceNumber === sequenceNumber
                )
              )
            : [];
        const creatableProgramKeys = selectedProgramKeys.filter((programKey) => !skippedProgramKeys.includes(programKey));

        if (creatableProgramKeys.length === 0) {
          setActionMessage(`Sequence ${sequenceNumber} already exists for the selected program${selectedProgramKeys.length === 1 ? '' : 's'}. No changes were saved.`);
          return;
        }

        const createResults = await Promise.allSettled(
          creatableProgramKeys.map((programKey) => createSequenceRuleMutation.mutateAsync({ ...baseBody, programKey }))
        );
        const savedCount = createResults.filter((result) => result.status === 'fulfilled').length;
        const failedResults = createResults.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        await sequenceRulesQuery.refetch();
        resetSequenceForm(selectedProgramKeys);
        const createdText = savedCount
          ? `Recording sequence added for ${savedCount} program${savedCount === 1 ? '' : 's'}.`
          : 'No new recording sequences were added.';
        const skippedText = skippedProgramKeys.length
          ? ` Skipped ${skippedProgramKeys.length} program${skippedProgramKeys.length === 1 ? '' : 's'} with existing Seq ${sequenceNumber} in ${recordingSectionLabel(sequenceForm.recordingSection)}.`
          : '';
        const failedText = failedResults.length
          ? ` ${failedResults.length} program${failedResults.length === 1 ? '' : 's'} could not be saved: ${readableError(failedResults[0].reason, 'Unknown error')}`
          : '';
        setActionMessage(`${createdText}${skippedText}${failedText}`);
      }
    } catch (error) {
      setActionMessage(readableError(error, 'Recording sequence could not be saved.'));
    }
  }

  async function deleteSequenceRule(rule: AdminRecordingSequenceRule) {
    if (!window.confirm(`Delete sequence ${rule.sequenceNumber} for ${programLabelFor(programs, rule.programKey)}?`)) return;
    setActionMessage(null);
    try {
      await deleteSequenceRuleMutation.mutateAsync(rule.id);
      await sequenceRulesQuery.refetch();
      if (editingSequenceId === rule.id) resetSequenceForm([rule.programKey]);
      setActionMessage('Recording sequence deleted.');
    } catch (error) {
      setActionMessage(readableError(error, 'Recording sequence could not be deleted.'));
    }
  }

  function openResourceManager(workshop: AdminWorkshop) {
    setActionMessage(null);
    setSelectedResourceIds([]);
    setResourceManager({ recordingId: workshop.id, title: workshop.title });
  }

  function closeResourceManager() {
    if (updateRecordingResourceLinksMutation.isPending) return;
    setResourceManager(null);
    setSelectedResourceIds([]);
  }

  function toggleRecordingResource(resourceId: string) {
    setSelectedResourceIds((current) => {
      const selected = new Set(current);
      if (selected.has(resourceId)) selected.delete(resourceId);
      else selected.add(resourceId);
      return Array.from(selected);
    });
  }

  async function saveRecordingResources() {
    if (!resourceManager) return;
    setActionMessage(null);
    try {
      await updateRecordingResourceLinksMutation.mutateAsync({
        recordingId: resourceManager.recordingId,
        resourceIds: selectedResourceIds
      });
      setActionMessage('Related resources updated for this recording.');
      setResourceManager(null);
      setSelectedResourceIds([]);
    } catch (error) {
      setActionMessage(readableError(error, 'Related resources could not be updated.'));
    }
  }

  function renderResourceManager() {
    if (!resourceManager) return null;
    const isBusy = updateRecordingResourceLinksMutation.isPending;
    const isLoading = resourcesQuery.isLoading || recordingResourceLinksQuery.isLoading;

    return (
      <div className="admin-recording-resource-modal" role="dialog" aria-modal="true" aria-label="Manage recording resources">
        <div className="admin-recording-resource-modal__panel">
          <div className="admin-recording-resource-modal__header">
            <div>
              <span className="section-eyebrow">RELATED RESOURCES</span>
              <h2>{resourceManager.title}</h2>
              <p>Select Resource Library items students can access directly from this recording.</p>
            </div>
            <button className="admin-recording-action" disabled={isBusy} onClick={closeResourceManager} type="button">
              Close
            </button>
          </div>
          {resourcesQuery.isError || recordingResourceLinksQuery.isError ? (
            <div className="workshop-error-note">Resources could not be loaded right now. Existing recording actions are unchanged.</div>
          ) : null}
          {isLoading ? (
            <LoadingState />
          ) : (
            <div className="admin-recording-resource-picker">
              {resources.length > 0 ? (
                resources.map((resource) => (
                  <label className="admin-recording-resource-option" key={resource.id}>
                    <input checked={selectedResourceIds.includes(resource.id)} disabled={isBusy} onChange={() => toggleRecordingResource(resource.id)} type="checkbox" />
                    <span>
                      <strong>{resource.title}</strong>
                      <small>{resourceSummary(resource) || 'Resource Library item'}</small>
                    </span>
                    {resource.url ? (
                      <a href={resource.url} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank">
                        Preview
                      </a>
                    ) : null}
                  </label>
                ))
              ) : (
                <p className="admin-recording-resource-empty">No active resources are available to link.</p>
              )}
            </div>
          )}
          <div className="admin-recording-resource-modal__actions">
            <span>{selectedResourceIds.length} selected</span>
            <div>
              <button className="admin-recording-action" disabled={isBusy} onClick={closeResourceManager} type="button">
                Cancel
              </button>
              <button className="admin-recording-action admin-recording-action--primary" disabled={isBusy || isLoading} onClick={() => void saveRecordingResources()} type="button">
                {isBusy ? <Loader2 className="admin-spin" size={14} /> : <Save size={14} />}
                Save resources
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSequenceManager() {
    if (!showSequenceManager) return null;
    const selectedProgramKeys = Array.from(new Set(sequenceForm.programKeys.map((programKey) => programKey.trim().toLowerCase()).filter(Boolean)));
    const visibleRules = sequenceRules
      .filter((rule) => selectedProgramKeys.length === 0 || selectedProgramKeys.includes(rule.programKey))
      .sort((left, right) => left.programKey.localeCompare(right.programKey) || left.sequenceNumber - right.sequenceNumber);
    const isBusy = createSequenceRuleMutation.isPending || updateSequenceRuleMutation.isPending || deleteSequenceRuleMutation.isPending;
    const selectedSequenceTitleValue =
      sequenceCustomTitleMode || (sequenceForm.title && !workshopTopicOptions.includes(sequenceForm.title)) ? customWorkshopTopicValue : sequenceForm.title;

    return (
      <section className="admin-recording-sequence-manager" aria-label="Recording sequence manager">
        <div className="admin-recording-panel__header">
          <div>
            <h2>Sequence Manager</h2>
            <p>Define program-level recording order by workshop title and optional aliases. Unmatched recordings stay latest-first.</p>
          </div>
          <button className="admin-recording-action" onClick={() => setShowSequenceManager(false)} type="button">
            Close
          </button>
        </div>
        {sequenceRulesQuery.isError ? <div className="workshop-error-note">Sequence rules could not be loaded. Existing recording operations are still available.</div> : null}
        <form className="admin-recording-sequence-form" onSubmit={(event) => {
          event.preventDefault();
          if (!isBusy) void saveSequenceRule();
        }}>
          <fieldset className="admin-recording-sequence-programs">
            <div className="admin-recording-sequence-programs__head">
              <span>Programs</span>
              <div>
                <button className="admin-recording-mini-action" disabled={isBusy || programKeys.length === 0} onClick={selectAllSequencePrograms} type="button">
                  Select all
                </button>
                <button className="admin-recording-mini-action" disabled={isBusy || selectedProgramKeys.length === 0} onClick={clearSequencePrograms} type="button">
                  Clear
                </button>
              </div>
            </div>
            <div className="admin-recording-sequence-programs__list">
              {programKeys.length > 0 ? (
                programKeys.map((programKey) => {
                  const normalizedProgramKey = programKey.trim().toLowerCase();
                  return (
                    <label key={programKey}>
                      <input
                        checked={selectedProgramKeys.includes(normalizedProgramKey)}
                        disabled={isBusy}
                        onChange={() => toggleSequenceProgram(programKey)}
                        type="checkbox"
                      />
                      <strong>{programLabelFor(programs, programKey)}</strong>
                    </label>
                  );
                })
              ) : (
                <p>No active programs available.</p>
              )}
            </div>
            <small>
              {selectedProgramKeys.length > 0
                ? `${selectedProgramKeys.length} program${selectedProgramKeys.length === 1 ? '' : 's'} selected.`
                : 'Select one or more programs for this sequence.'}
            </small>
          </fieldset>
          <label>
            <span>Seq #</span>
            <input
              min="1"
              onChange={(event) => setSequenceForm((current) => ({ ...current, sequenceNumber: event.target.value }))}
              placeholder="1"
              type="number"
              value={sequenceForm.sequenceNumber}
            />
          </label>
          <label className="admin-recording-sequence-form__wide admin-recording-sequence-form__title">
            <span>Workshop title to match</span>
            <select value={selectedSequenceTitleValue} onChange={(event) => handleSequenceTopicSelect(event.target.value)}>
              <option value="">Select workshop title</option>
              {workshopTopicOptions.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
              <option value={customWorkshopTopicValue}>Custom title</option>
            </select>
            {sequenceCustomTitleMode || selectedSequenceTitleValue === customWorkshopTopicValue ? (
              <input
                onChange={(event) => setSequenceForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Type custom workshop title..."
                value={sequenceForm.title}
              />
            ) : null}
          </label>
          <label>
            <span>Section</span>
            <select
              value={sequenceForm.recordingSection}
              onChange={(event) => setSequenceForm((current) => ({ ...current, recordingSection: event.target.value as AdminRecordingSection }))}
            >
              {recordingSectionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={sequenceForm.status} onChange={(event) => setSequenceForm((current) => ({ ...current, status: event.target.value as 'active' | 'inactive' }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="admin-recording-sequence-form__wide admin-recording-sequence-form__aliases">
            <span>Aliases</span>
            <textarea
              onChange={(event) => setSequenceForm((current) => ({ ...current, aliases: event.target.value }))}
              placeholder="Live Project Briefing Session&#10;Live Project Overview & Doubt Session"
              rows={3}
              value={sequenceForm.aliases}
            />
          </label>
          <div className="admin-recording-edit-form__actions admin-recording-sequence-form__actions">
            <button className="admin-recording-action admin-recording-action--primary" disabled={isBusy} type="submit">
              {isBusy ? <Loader2 className="admin-spin" size={14} /> : <Save size={14} />}
              {editingSequenceId ? 'Update sequence' : 'Add sequence'}
            </button>
            <button className="admin-recording-action" disabled={isBusy} onClick={() => resetSequenceForm()} type="button">
              Reset
            </button>
          </div>
        </form>
        {actionMessage ? <div className="workshop-error-note admin-recording-sequence-message">{actionMessage}</div> : null}
        <div className="admin-recording-sequence-list">
          {visibleRules.length > 0 ? (
            visibleRules.map((rule) => (
              <article className="admin-recording-sequence-row" key={rule.id}>
                <div>
                  <strong>Seq {rule.sequenceNumber}</strong>
                  <span>{programLabelFor(programs, rule.programKey)}</span>
                </div>
                <div>
                  <strong>{rule.title}</strong>
                  <span>{recordingSectionLabel(rule.recordingSection)}</span>
                  <span>{rule.matchAliases?.length ? `Aliases: ${rule.matchAliases.join(', ')}` : 'No aliases'}</span>
                </div>
                <StatusBadge tone={rule.status === 'active' ? 'safe' : 'neutral'}>{rule.status}</StatusBadge>
                <div className="admin-recording-row__actions">
                  <button className="admin-recording-action" disabled={isBusy} onClick={() => startEditingSequence(rule)} type="button">
                    <Edit3 size={14} />
                    Edit
                  </button>
                  <button className="admin-recording-action" disabled={isBusy} onClick={() => void deleteSequenceRule(rule)} type="button">
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="admin-recording-sequence-empty">No sequence rules yet for this view.</p>
          )}
        </div>
      </section>
    );
  }

  function renderRecordingEditForm(workshop: AdminWorkshop, mode: 'draft' | 'published' = 'draft') {
    if (recordingEditForm?.workshopId !== workshop.id) return null;
    const isPublishedEdit = mode === 'published';
    const cohortEditOptions = Array.from(new Set([...workshop.cohortNames, ...activeCohorts.map((cohort) => cohort.name)])).filter(Boolean).sort((left, right) => left.localeCompare(right));
    const isBusy = isPublishedEdit ? editPublishedRecordingMutation.isPending : createManualCandidateMutation.isPending;

    return (
      <div className={isPublishedEdit ? 'admin-recording-edit-form admin-recording-edit-form--published' : 'admin-recording-edit-form'}>
        {isPublishedEdit ? (
          <>
            <label className="admin-recording-edit-form__wide">
              <span>Title</span>
              <input
                value={recordingEditForm.title}
                onChange={(event) => setRecordingEditForm((current) => (current ? { ...current, title: event.target.value } : current))}
                placeholder="Recording title"
              />
            </label>
            <label>
              <span>Program</span>
              <select value={recordingEditForm.programKey} onChange={(event) => setRecordingEditForm((current) => (current ? { ...current, programKey: event.target.value } : current))}>
                <option value="">General / no program tag</option>
                {programKeys.map((programKey) => (
                  <option key={programKey} value={programKey}>
                    {programLabelFor(programs, programKey)}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
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
        {isPublishedEdit ? (
          <fieldset className="admin-recording-edit-form__cohorts">
            <legend>Cohort tags</legend>
            <div>
              {cohortEditOptions.length > 0 ? (
                cohortEditOptions.map((cohortName) => (
                  <label key={cohortName}>
                    <input checked={recordingEditForm.cohortNames.includes(cohortName)} onChange={() => toggleEditCohort(cohortName)} type="checkbox" />
                    <span>{cohortName}</span>
                  </label>
                ))
              ) : (
                <p>No active cohorts available.</p>
              )}
            </div>
          </fieldset>
        ) : null}
        <div className="admin-recording-edit-form__actions">
          <button className="admin-recording-action admin-recording-action--primary" disabled={isBusy} onClick={() => void (isPublishedEdit ? savePublishedRecording(workshop) : saveRecordingLinks())} type="button">
            {isBusy ? <Loader2 className="admin-spin" size={14} /> : <Save size={14} />}
            {isPublishedEdit ? 'Save published changes' : 'Save for review'}
          </button>
          <button className="admin-recording-action" disabled={isBusy} onClick={cancelEditingRecording} type="button">
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
          <p>Add recording links, review completed session videos, and publish only the approved recordings students should see.</p>
        </div>
        <div className="admin-recording-hero__meta">
          <button className="admin-recording-action" onClick={() => setShowSequenceManager((current) => !current)} type="button">
            <ListOrdered size={14} />
            Sequence Manager
          </button>
          <StatusBadge>{`${addLinkWorkshops.length} need links`}</StatusBadge>
          <StatusBadge>{`${pendingCandidates.length} pending`}</StatusBadge>
          <StatusBadge>{`${publishedWorkshops.length} published`}</StatusBadge>
        </div>
      </header>

      <section className="admin-recording-kpis" aria-label="Recording summary">
        <article>
          <AlertTriangle size={18} />
          <span>Add Link</span>
          <strong>{addLinkWorkshops.length}</strong>
        </article>
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
          <XCircle size={18} />
          <span>Rejected</span>
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
        <label className="admin-recording-filter-field">
          <span>Sort by</span>
          <select
            aria-label="Recording sort"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as RecordingSortOption);
              resetPages();
            }}
          >
            {recordingSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {renderSequenceManager()}
      {renderResourceManager()}

      <nav className="admin-recording-tabs" aria-label="Recording workspace tabs">
        <button className={activeTab === 'add-link' ? 'admin-recording-tab admin-recording-tab--active' : 'admin-recording-tab'} onClick={() => changeTab('add-link')} type="button">
          Add Link
        </button>
        <button className={activeTab === 'pending' ? 'admin-recording-tab admin-recording-tab--active' : 'admin-recording-tab'} onClick={() => changeTab('pending')} type="button">
          Pending Review
        </button>
        <button className={activeTab === 'published' ? 'admin-recording-tab admin-recording-tab--active' : 'admin-recording-tab'} onClick={() => changeTab('published')} type="button">
          Published
        </button>
        <button className={activeTab === 'rejected' ? 'admin-recording-tab admin-recording-tab--active' : 'admin-recording-tab'} onClick={() => changeTab('rejected')} type="button">
          Rejected
        </button>
      </nav>

      {actionMessage && !showSequenceManager ? <div className="workshop-error-note">{actionMessage}</div> : null}

      {activeTab === 'pending' ? (
        <section className="admin-recording-panel">
          <div className="admin-recording-panel__header">
            <div>
              <h2>Recording links awaiting review</h2>
              <p>Manual links and fetched Zoom MP4 parts stay admin-only until Publish.</p>
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
              {paginatedPublishedWorkshops.map((workshop) => {
                const sequenceMatch = sequenceMatchForWorkshop(workshop, sequenceRules);
                const linkedResourceCount = resourceCountByRecordingId.get(workshop.id) ?? 0;
                return (
                  <article className="admin-recording-row" key={workshop.id}>
                    <div className="admin-recording-row__icon admin-recording-row__icon--published">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="admin-recording-row__main">
                      <div className="admin-recording-row__title">
                        <strong>{workshop.title}</strong>
                        <StatusBadge>{sourceLabel(workshop)}</StatusBadge>
                        <StatusBadge tone={sequenceMatch ? 'safe' : 'neutral'}>{sequenceMatch ? `Seq ${sequenceMatch.sequenceNumber}` : 'Unsequenced'}</StatusBadge>
                      </div>
                      <p>{[formatDate(workshop.date), workshop.time, workshop.cohortNames.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
                      <div className="admin-recording-row__meta">
                        <span>{workshop.updatedAt ? `Updated ${formatDate(workshop.updatedAt)}` : 'Update date unavailable'}</span>
                      </div>
                      {renderRecordingEditForm(workshop, 'published')}
                    </div>
                    <div className="admin-recording-row__actions">
                      <button
                        className={linkedResourceCount > 0 ? 'admin-recording-action admin-recording-action--resources-enabled' : 'admin-recording-action'}
                        onClick={() => openResourceManager(workshop)}
                        type="button"
                      >
                        <Link2 size={14} />
                        Resources
                        {linkedResourceCount > 0 ? <span>{linkedResourceCount}</span> : null}
                      </button>
                      <button className="admin-recording-action" onClick={() => startEditingPublishedRecording(workshop)} type="button">
                        <Edit3 size={14} />
                        Edit
                      </button>
                      <a className="admin-recording-action admin-recording-action--primary" href={recordingUrlFor(workshop)} rel="noreferrer" target="_blank">
                        <ExternalLink size={14} />
                        Open
                      </a>
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

      {activeTab === 'add-link' ? (
        <section className="admin-recording-panel">
          <div className="admin-recording-panel__header">
            <div>
              <h2>Add recording links</h2>
              <p>Completed workshops land here only when no recording is published and no review history exists.</p>
            </div>
          </div>
          {addLinkWorkshops.length > 0 ? (
            <div className="admin-recording-list">
              {paginateItems(addLinkWorkshops, activePage).map((workshop) => {
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
                        <StatusBadge>{hasDraftCandidate ? 'Pending review' : 'Needs link'}</StatusBadge>
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
              <p>Rejected candidates stay here as admin history and keep the workshop out of Add Link to prevent repeated rejected entries.</p>
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
