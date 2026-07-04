import { CalendarDays, Check, CheckCircle2, Clapperboard, Clock3, Copy, Edit3, Link as LinkIcon, Loader2, Plus, Radio, Save, Search, Trash2, Video, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import {
  AdminWorkshop,
  AdminWorkshopStatus,
  useCancelAdminWorkshop,
  useFetchAdminWorkshopRecordings,
  useAdminWorkshops,
  useMarkAdminWorkshopCompleted,
  useRescheduleAdminWorkshop,
  useSaveAdminWorkshop,
  useUpdateAdminWorkshop
} from '../features/admin/useAdminWorkshops';

type WorkshopTab = 'upcoming' | 'needs-completion' | 'completed' | 'cancelled';

type WorkshopForm = {
  agenda: string;
  cohortNames: string[];
  date: string;
  durationMinutes: string;
  selectedWorkshopId?: string;
  time: string;
  title: string;
  zoomAccount: string;
};

type WorkshopTopicDraft = {
  id: string;
  isEditing: boolean;
  title: string;
};

const emptyWorkshopForm: WorkshopForm = {
  agenda: '',
  cohortNames: [],
  date: '',
  durationMinutes: '90',
  time: '',
  title: '',
  zoomAccount: 'Zoom Account 1'
};

const workshopTopicStorageKey = 'admin-workshop-topic-options';

const defaultWorkshopTopics = [
  'Market Research Foundation - MR',
  'Case Based Frameworks & Sample Mocks - Part 01',
  'Case Based Frameworks & Sample Mocks - Part 02',
  'Product & Brand Management - Detailed Overview',
  'Induction Session - Skilled Sapiens',
  'Forecasting of financial statements - Part 1',
  'How to think like a Consultant & Marketer',
  'Introduction to Equity Research, Financial Modeling & Excel'
];

const customWorkshopTopicValue = '__custom_workshop_topic__';

function uniqueTitles(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function createTopicDraft(title = '', isEditing = title.trim().length === 0): WorkshopTopicDraft {
  return { id: `topic-${Date.now()}-${Math.random()}`, isEditing, title };
}

function loadSavedWorkshopTopics() {
  if (typeof window === 'undefined') return defaultWorkshopTopics;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(workshopTopicStorageKey) ?? 'null');
    return Array.isArray(parsed) ? uniqueTitles(parsed.filter((item): item is string => typeof item === 'string')) : defaultWorkshopTopics;
  } catch {
    return defaultWorkshopTopics;
  }
}

function saveWorkshopTopics(topics: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(workshopTopicStorageKey, JSON.stringify(topics));
}

function toDateInput(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.length >= 10 ? value.slice(0, 10) : '';
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | undefined) {
  if (!value) return 'Date not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function formatDateTime(item: AdminWorkshop) {
  return [item.cohortNames[0] ?? item.programKey ?? 'No cohort', formatDate(item.date), item.time, item.durationMinutes].filter(Boolean).join(' · ');
}

function statusTone(status: AdminWorkshopStatus) {
  if (status === 'Completed') return 'safe';
  if (status === 'Upcoming' || status === 'Scheduled' || status === 'Live') return 'warning';
  return 'neutral';
}

function isCompleted(item: AdminWorkshop) {
  return item.status === 'Completed';
}

function isArchived(item: AdminWorkshop) {
  return item.status === 'Cancelled' || item.status === 'Inactive';
}

function getScheduledAt(item: AdminWorkshop) {
  const dateMatch = item.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = item.time?.match(/^(\d{1,2}):(\d{2})/);

  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;
    const scheduledAt = new Date(Number(year), Number(month) - 1, Number(day), hour, minute);
    return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
  }

  const scheduledAt = new Date(item.date);
  return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
}

function isFutureScheduled(item: AdminWorkshop, now: number) {
  if (isCompleted(item) || isArchived(item)) return false;
  const scheduledAt = getScheduledAt(item);
  return Boolean(scheduledAt && scheduledAt.getTime() > now);
}

function isPastPendingCompletion(item: AdminWorkshop, now: number) {
  if (isCompleted(item) || isArchived(item)) return false;
  const scheduledAt = getScheduledAt(item);
  return Boolean(scheduledAt && scheduledAt.getTime() <= now);
}

function workshopToForm(item: AdminWorkshop): WorkshopForm {
  return {
    agenda: '',
    cohortNames: item.cohortNames,
    date: toDateInput(item.date),
    durationMinutes: item.durationMinutes ? String(item.durationMinutes) : '90',
    selectedWorkshopId: item.id,
    time: item.time ?? '',
    title: item.title,
    zoomAccount: item.zoomAccount ?? 'Zoom Account 1'
  };
}

function dedupeCohorts(pages: Array<AdminCohort[] | undefined>) {
  const cohorts = new Map<string, AdminCohort>();
  pages.forEach((page) => {
    page?.forEach((cohort) => cohorts.set(cohort.id, cohort));
  });
  return Array.from(cohorts.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AdminWorkshopsPage() {
  const workshopsQuery = useAdminWorkshops({ limit: 100, page: 1, status: 'all' });
  const cohortsPageOneQuery = useAdminCohorts({ limit: 100, page: 1, sort: 'name', status: 'all' });
  const cohortsPageTwoQuery = useAdminCohorts({ enabled: (cohortsPageOneQuery.data?.totalPages ?? 1) >= 2, limit: 100, page: 2, sort: 'name', status: 'all' });
  const cohortsPageThreeQuery = useAdminCohorts({ enabled: (cohortsPageOneQuery.data?.totalPages ?? 1) >= 3, limit: 100, page: 3, sort: 'name', status: 'all' });
  const saveWorkshopMutation = useSaveAdminWorkshop();
  const updateWorkshopMutation = useUpdateAdminWorkshop();
  const rescheduleWorkshopMutation = useRescheduleAdminWorkshop();
  const fetchRecordingsMutation = useFetchAdminWorkshopRecordings();
  const markCompletedMutation = useMarkAdminWorkshopCompleted();
  const cancelWorkshopMutation = useCancelAdminWorkshop();
  const [form, setForm] = useState<WorkshopForm>(emptyWorkshopForm);
  const [cohortSearch, setCohortSearch] = useState('');
  const [activeTab, setActiveTab] = useState<WorkshopTab>('upcoming');
  const [savedWorkshopTopics, setSavedWorkshopTopics] = useState<string[]>(loadSavedWorkshopTopics);
  const [topicDrafts, setTopicDrafts] = useState<WorkshopTopicDraft[]>(() => loadSavedWorkshopTopics().map((title) => createTopicDraft(title, false)));
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingCancelWorkshop, setPendingCancelWorkshop] = useState<AdminWorkshop | null>(null);
  const [customTitleMode, setCustomTitleMode] = useState(false);
  const [isSavingTopics, setIsSavingTopics] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [isClearingCohorts, setIsClearingCohorts] = useState(false);
  const [isClearingForm, setIsClearingForm] = useState(false);
  const [isRefreshingMeetings, setIsRefreshingMeetings] = useState(false);
  const [isSelectingCohorts, setIsSelectingCohorts] = useState(false);
  const [isTopicManagerOpen, setIsTopicManagerOpen] = useState(false);
  const [copiedWorkshopId, setCopiedWorkshopId] = useState<string | null>(null);
  const [editingWorkshopId, setEditingWorkshopId] = useState<string | null>(null);

  const workshops = workshopsQuery.data?.items ?? [];
  const cohorts = useMemo(
    () => dedupeCohorts([cohortsPageOneQuery.data?.items, cohortsPageTwoQuery.data?.items, cohortsPageThreeQuery.data?.items]).filter((cohort) => cohort.status === 'active' || cohort.status === 'upcoming'),
    [cohortsPageOneQuery.data?.items, cohortsPageTwoQuery.data?.items, cohortsPageThreeQuery.data?.items]
  );
  const filteredCohorts = useMemo(() => {
    const query = cohortSearch.trim().toLowerCase();
    const matches = query ? cohorts.filter((cohort) => [cohort.name, cohort.cohortId, cohort.programKey, cohort.domainKey].filter(Boolean).join(' ').toLowerCase().includes(query)) : cohorts;
    return [...matches].sort((left, right) => {
      const leftSelected = form.cohortNames.includes(left.name);
      const rightSelected = form.cohortNames.includes(right.name);
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
  }, [cohortSearch, cohorts, form.cohortNames]);

  const now = Date.now();
  const completedWorkshops = useMemo(() => workshops.filter(isCompleted), [workshops]);
  const cancelledWorkshops = useMemo(() => workshops.filter(isArchived), [workshops]);
  const upcomingWorkshops = useMemo(() => workshops.filter((item) => isFutureScheduled(item, now)), [now, workshops]);
  const pastWorkshops = useMemo(() => workshops.filter((item) => isPastPendingCompletion(item, now)), [now, workshops]);
  const visibleWorkshops =
    activeTab === 'completed' ? completedWorkshops : activeTab === 'needs-completion' ? pastWorkshops : activeTab === 'cancelled' ? cancelledWorkshops : upcomingWorkshops;
  const total = workshopsQuery.data?.total ?? workshops.length;
  const pendingWithLink = useMemo(() => pastWorkshops.filter((item) => Boolean(item.joinUrl)).length, [pastWorkshops]);
  const upcomingCount = upcomingWorkshops.length;
  const pastCount = pastWorkshops.length;
  const completedCount = completedWorkshops.length;
  const cancelledCount = cancelledWorkshops.length;
  const workshopTopicOptions = useMemo(() => uniqueTitles(savedWorkshopTopics), [savedWorkshopTopics]);
  const selectedTopicValue = customTitleMode || (form.title && !workshopTopicOptions.includes(form.title)) ? customWorkshopTopicValue : form.title;

  function updateForm<K extends keyof WorkshopForm>(key: K, value: WorkshopForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function pulse(setter: (value: boolean) => void, duration = 650) {
    setter(true);
    window.setTimeout(() => setter(false), duration);
  }

  function toggleCohort(name: string) {
    setForm((current) => {
      const exists = current.cohortNames.includes(name);
      return {
        ...current,
        cohortNames: exists ? current.cohortNames.filter((cohortName) => cohortName !== name) : [...current.cohortNames, name]
      };
    });
  }

  function selectAllVisibleCohorts() {
    pulse(setIsSelectingCohorts);
    setForm((current) => ({
      ...current,
      cohortNames: Array.from(new Set([...current.cohortNames, ...filteredCohorts.map((cohort) => cohort.name)]))
    }));
  }

  function clearSelectedCohorts() {
    pulse(setIsClearingCohorts);
    updateForm('cohortNames', []);
  }

  function clearWorkshopForm() {
    pulse(setIsClearingForm);
    setForm(emptyWorkshopForm);
    setCustomTitleMode(false);
  }

  function copyJoinUrl(item: AdminWorkshop) {
    if (item.joinUrl) {
      void navigator.clipboard?.writeText(item.joinUrl);
      setCopiedWorkshopId(item.id);
      window.setTimeout(() => setCopiedWorkshopId((current) => (current === item.id ? null : current)), 900);
    }
  }

  function handleTopicSelect(value: string) {
    if (value === customWorkshopTopicValue) {
      setCustomTitleMode(true);
      updateForm('title', '');
      return;
    }
    setCustomTitleMode(false);
    updateForm('title', value);
  }

  async function confirmCancelWorkshop() {
    if (!pendingCancelWorkshop) return;
    setActionMessage(null);
    try {
      const result = await cancelWorkshopMutation.mutateAsync(pendingCancelWorkshop.id);
      const warning =
        result.workshop && 'zoom_cancellation_warning' in result.workshop
          ? String(result.workshop.zoom_cancellation_warning ?? '').trim()
          : '';
      setPendingCancelWorkshop(null);
      setActionMessage(warning ? `Meeting cancelled in LMS. Zoom warning: ${warning}` : 'Meeting cancelled in Zoom and archived in LMS.');
    } catch (error) {
      setActionMessage(readableError(error, 'Meeting could not be cancelled.'));
    }
  }

  async function refreshMeetings() {
    setIsRefreshingMeetings(true);
    try {
      await workshopsQuery.refetch();
    } finally {
      setIsRefreshingMeetings(false);
    }
  }

  async function saveWorkshop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setActionMessage(null);

    const title = form.title.trim();
    const durationMinutes = Number(form.durationMinutes);

    if (!title) {
      setFormError('Session title is required.');
      return;
    }
    if (!form.date) {
      setFormError('Meeting date is required.');
      return;
    }
    if (form.durationMinutes && (!Number.isInteger(durationMinutes) || durationMinutes <= 0)) {
      setFormError('Duration must be a positive whole number.');
      return;
    }
    if (form.cohortNames.length === 0) {
      setFormError('Select at least one cohort.');
      return;
    }

    const payload = {
      cohortNames: form.cohortNames,
      date: form.date,
      durationMinutes: durationMinutes || undefined,
      time: form.time || undefined,
      title,
      workshopStatus: 'Scheduled' as AdminWorkshopStatus,
      zoomAccount: form.zoomAccount || undefined
    };

    try {
      if (form.selectedWorkshopId) {
        const original = workshops.find((item) => item.id === form.selectedWorkshopId);
        const isReschedule = Boolean(original && (toDateInput(original.date) !== form.date || (original.time ?? '') !== (form.time || '')));
        const mutation = isReschedule ? rescheduleWorkshopMutation : updateWorkshopMutation;
        await mutation.mutateAsync({ body: payload, workshopId: form.selectedWorkshopId });
        setActionMessage('Meeting updated.');
      } else {
        await saveWorkshopMutation.mutateAsync(payload);
        setActionMessage('Meeting scheduled.');
      }
      setForm(emptyWorkshopForm);
      setCustomTitleMode(false);
    } catch (error) {
      setFormError(readableError(error, 'Meeting could not be saved.'));
    }
  }

  async function markWorkshopCompleted(item: AdminWorkshop) {
    setActionMessage(null);
    try {
      await markCompletedMutation.mutateAsync(item.id);
      setActiveTab('completed');
      setActionMessage('Workshop marked completed.');
    } catch (error) {
      setActionMessage(readableError(error, 'Workshop could not be marked completed.'));
    }
  }

  function editWorkshop(item: AdminWorkshop) {
    setEditingWorkshopId(item.id);
    setCustomTitleMode(!workshopTopicOptions.includes(item.title));
    setForm(workshopToForm(item));
    window.setTimeout(() => setEditingWorkshopId((current) => (current === item.id ? null : current)), 650);
  }

  function updateTopicDraft(id: string, title: string) {
    setTopicDrafts((drafts) => drafts.map((draft) => (draft.id === id ? { ...draft, title } : draft)));
  }

  function toggleTopicDraftEditing(id: string) {
    setTopicDrafts((drafts) => drafts.map((draft) => (draft.id === id ? { ...draft, isEditing: !draft.isEditing } : draft)));
  }

  function removeTopicDraft(id: string) {
    setTopicDrafts((drafts) => (drafts.length > 1 ? drafts.filter((draft) => draft.id !== id) : [createTopicDraft()]));
  }

  function saveTopicDrafts() {
    const nextTopics = uniqueTitles(topicDrafts.map((topic) => topic.title));
    setIsSavingTopics(true);
    setSavedWorkshopTopics(nextTopics);
    setTopicDrafts(nextTopics.length > 0 ? nextTopics.map((title) => createTopicDraft(title, false)) : [createTopicDraft()]);
    saveWorkshopTopics(nextTopics);
    if (form.title && !nextTopics.includes(form.title)) {
      setCustomTitleMode(false);
      setForm((current) => ({ ...current, title: '' }));
    }
    setActionMessage('Workshop topic dropdown updated.');
    window.setTimeout(() => setIsSavingTopics(false), 700);
  }

  function addTopicDraft() {
    setIsAddingTopic(true);
    setTopicDrafts((drafts) => [createTopicDraft(), ...drafts]);
    window.setTimeout(() => setIsAddingTopic(false), 650);
  }

  async function fetchZoomRecordings(workshop: AdminWorkshop) {
    if (!workshop) {
      setActionMessage('Select a completed workshop before fetching recordings.');
      return;
    }
    setActionMessage(null);
    try {
      const result = await fetchRecordingsMutation.mutateAsync(workshop.id);
      const duplicateText = result.duplicateCount ? ` ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? '' : 's'} skipped.` : '';
      setActionMessage(`Fetched ${result.count ?? 0} Zoom recording candidate${result.count === 1 ? '' : 's'} for ${workshop.title}.${duplicateText}`);
    } catch (error) {
      setActionMessage(readableError(error, 'Zoom recordings could not be fetched.'));
    }
  }

  if (workshopsQuery.isLoading || cohortsPageOneQuery.isLoading || cohortsPageTwoQuery.isLoading || cohortsPageThreeQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading meeting schedule." eyebrow="Admin workshops" title="Schedule Meeting" />
        <LoadingState />
      </div>
    );
  }

  if (workshopsQuery.isError || cohortsPageOneQuery.isError || cohortsPageTwoQuery.isError || cohortsPageThreeQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Meetings could not be loaded from the Supabase." eyebrow="Admin workshops" title="Schedule Meeting unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="workshop-admin-page">
      <header className="announcement-admin-heading">
        <div>
          <span className="section-eyebrow">MODULE REFRESH</span>
          <div className="announcement-admin-title-row">
            <h1>Schedule Meeting</h1>
            <span>{workshopsQuery.isFetching ? 'Refreshing meeting data...' : `${total} meetings loaded`}</span>
          </div>
          <p>Create Zoom meetings, manage cohort visibility, and move completed sessions into the recording review workflow.</p>
        </div>
        <button className="announcement-refresh-button workshop-action-button" disabled={isRefreshingMeetings || workshopsQuery.isFetching} onClick={() => void refreshMeetings()} type="button">
          {isRefreshingMeetings || workshopsQuery.isFetching ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
          {isRefreshingMeetings || workshopsQuery.isFetching ? 'Refreshing...' : 'Refresh Meetings'}
        </button>
      </header>

      <div className="metric-grid workshop-kpi-grid">
        <article className="metric-tile">
          <CalendarDays size={18} />
          <span>Total Workshops</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <LinkIcon size={18} />
          <span>Needs Completion With Link</span>
          <strong>{pendingWithLink}</strong>
        </article>
        <article className="metric-tile">
          <Radio size={18} />
          <span>Upcoming</span>
          <strong>{upcomingCount}</strong>
        </article>
        <article className="metric-tile">
          <Clock3 size={18} />
          <span>Needs Completion</span>
          <strong>{pastCount}</strong>
        </article>
        <article className="metric-tile">
          <CheckCircle2 size={18} />
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </article>
        <article className="metric-tile">
          <X size={18} />
          <span>Cancelled / Archived</span>
          <strong>{cancelledCount}</strong>
        </article>
      </div>

      <div className="workshop-grid">
        <section className="announcement-panel workshop-panel">
          <div className="announcement-panel__header">
            <span className="section-eyebrow">ZOOM INTEGRATION</span>
            <h2>{form.selectedWorkshopId ? 'Edit Scheduled Meeting' : 'Schedule a New Meeting'}</h2>
          </div>

          <form className="announcement-form workshop-form" onSubmit={saveWorkshop}>
            <label className="announcement-field announcement-field--wide">
              <span>
                Session Title <b>*</b>
              </span>
              <select value={selectedTopicValue} onChange={(event) => handleTopicSelect(event.target.value)}>
                <option value="">Select workshop topic</option>
                {workshopTopicOptions.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
                <option value={customWorkshopTopicValue}>Custom topic</option>
              </select>
              {selectedTopicValue === customWorkshopTopicValue ? (
                <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Type custom workshop title..." />
              ) : null}
            </label>

            <label className="announcement-field">
              <span>
                Date <b>*</b>
              </span>
              <input value={form.date} onChange={(event) => updateForm('date', event.target.value)} type="date" />
            </label>
            <label className="announcement-field">
              <span>
                Time (IST) <b>*</b>
              </span>
              <input value={form.time} onChange={(event) => updateForm('time', event.target.value)} type="time" />
            </label>

            <label className="announcement-field">
              <span>Duration (minutes)</span>
              <input value={form.durationMinutes} onChange={(event) => updateForm('durationMinutes', event.target.value)} inputMode="numeric" />
            </label>
            <label className="announcement-field">
              <span>
                Zoom Account <b>*</b>
              </span>
              <select value={form.zoomAccount} onChange={(event) => updateForm('zoomAccount', event.target.value)}>
                <option>Zoom Account 1</option>
                <option>Zoom Account 2</option>
              </select>
            </label>

            <div className="announcement-field announcement-field--wide">
              <span>
                Tag to Cohorts <b>*</b>
              </span>
              <div className="workshop-cohort-toolbar">
                <div className="workshop-search-box">
                  <Search size={16} />
                  <input value={cohortSearch} onChange={(event) => setCohortSearch(event.target.value)} placeholder="Search cohorts..." type="search" />
                </div>
                <button className="announcement-secondary-button workshop-action-button" disabled={isSelectingCohorts} onClick={selectAllVisibleCohorts} type="button">
                  {isSelectingCohorts ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                  {isSelectingCohorts ? 'Selecting...' : 'Select all'}
                </button>
                <button className="announcement-secondary-button workshop-action-button" disabled={isClearingCohorts} onClick={clearSelectedCohorts} type="button">
                  {isClearingCohorts ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                  {isClearingCohorts ? 'Clearing...' : 'Clear all'}
                </button>
              </div>
              <div className="workshop-cohort-list">
                {filteredCohorts.length > 0 ? (
                  filteredCohorts.map((cohort) => (
                    <label className="workshop-cohort-row" key={cohort.id}>
                      <input checked={form.cohortNames.includes(cohort.name)} onChange={() => toggleCohort(cohort.name)} type="checkbox" />
                      <strong>{cohort.name}</strong>
                      <span className={`workshop-cohort-status workshop-cohort-status--${cohort.status}`}>{cohort.status.toUpperCase()}</span>
                    </label>
                  ))
                ) : (
                  <p>No active or upcoming cohorts available.</p>
                )}
              </div>
              <small>
                {form.cohortNames.length > 0 ? `${form.cohortNames.length} cohort${form.cohortNames.length === 1 ? '' : 's'} selected.` : 'Select one or more active/upcoming LMS cohorts.'}
              </small>
            </div>

            <label className="announcement-field announcement-field--wide">
              <span>Agenda / Notes</span>
              <textarea value={form.agenda} onChange={(event) => updateForm('agenda', event.target.value)} placeholder="Optional - visible to host on Zoom" />
            </label>

            <div className="announcement-actions announcement-field--wide">
              <button
                className="announcement-secondary-button workshop-action-button"
                disabled={isClearingForm}
                onClick={clearWorkshopForm}
                type="button"
              >
                {isClearingForm ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                {isClearingForm ? 'Clearing...' : 'Clear'}
              </button>
              <button className="announcement-primary-button workshop-action-button" disabled={saveWorkshopMutation.isPending || updateWorkshopMutation.isPending || rescheduleWorkshopMutation.isPending} type="submit">
                {saveWorkshopMutation.isPending || updateWorkshopMutation.isPending || rescheduleWorkshopMutation.isPending ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                {rescheduleWorkshopMutation.isPending ? 'Rescheduling...' : updateWorkshopMutation.isPending ? 'Updating...' : saveWorkshopMutation.isPending ? 'Saving...' : form.selectedWorkshopId ? 'Update Meeting ->' : 'Save Meeting ->'}
              </button>
            </div>
            {formError ? <p className="workshop-error-note announcement-field--wide">{formError}</p> : null}
            {actionMessage ? <p className="announcement-field--wide">{actionMessage}</p> : null}
          </form>
        </section>

        <section className="announcement-side-stack">
          <div className="announcement-panel workshop-panel">
            <div className="announcement-panel__header">
              <span className="section-eyebrow">WORKSHOP PIPELINE</span>
              <h2>All Sessions</h2>
              <p className="workshop-panel-note">Recording review and publishing now happens in the dedicated Recordings workspace.</p>
              <Link className="workshop-soft-action workshop-recordings-link" to="/admin/recording-candidates">
                <Clapperboard size={14} />
                Open Recordings
              </Link>
            </div>
            {markCompletedMutation.isError ? <p className="workshop-error-note workshop-inline-error">Mark Completed could not be saved. Confirm workshop status writes are enabled and try again.</p> : null}

            <div className="workshop-list-header">
              <span className="section-eyebrow">MEETING LIST</span>
              <div className="workshop-tabs">
                <button className={activeTab === 'upcoming' ? 'workshop-tab workshop-tab--active' : 'workshop-tab'} onClick={() => setActiveTab('upcoming')} type="button">
                  <CalendarDays size={14} />
                  Upcoming
                </button>
                <button className={activeTab === 'needs-completion' ? 'workshop-tab workshop-tab--active' : 'workshop-tab'} onClick={() => setActiveTab('needs-completion')} type="button">
                  <Clock3 size={14} />
                  Needs Completion
                </button>
                <button className={activeTab === 'completed' ? 'workshop-tab workshop-tab--active' : 'workshop-tab'} onClick={() => setActiveTab('completed')} type="button">
                  <Clapperboard size={14} />
                  Completed
                </button>
                <button className={activeTab === 'cancelled' ? 'workshop-tab workshop-tab--active' : 'workshop-tab'} onClick={() => setActiveTab('cancelled')} type="button">
                  <X size={14} />
                  Cancelled
                </button>
              </div>
            </div>

            <div className="workshop-meeting-list">
              {visibleWorkshops.length > 0 ? (
                visibleWorkshops.map((item) => {
                  const isAdminCompleted = isCompleted(item);
                  const isPast = activeTab === 'needs-completion';
                  const isCancelled = activeTab === 'cancelled';
                  const recordingUrl = item.youtubeVideoUrl ?? item.zoomRecordingUrl;
                  const isMarkingThisWorkshop = markCompletedMutation.isPending && markCompletedMutation.variables === item.id;
                  const isFetchingThisWorkshop = fetchRecordingsMutation.isPending && fetchRecordingsMutation.variables === item.id;

                  return (
                    <article className={isAdminCompleted ? 'workshop-meeting-row workshop-meeting-row--completed' : isCancelled ? 'workshop-meeting-row workshop-meeting-row--archived' : 'workshop-meeting-row'} key={item.id}>
                      <div className="workshop-meeting-main">
                        {isAdminCompleted ? <Clapperboard size={18} /> : <Video size={18} />}
                        <div>
                          <h3>{item.title}</h3>
                          <p>
                            <StatusBadge tone={isAdminCompleted ? 'safe' : statusTone(item.status)}>{isAdminCompleted ? 'Completed' : isCancelled ? 'Archived' : item.status}</StatusBadge>
                            <span>{formatDateTime(item)}</span>
                          </p>
                          <p>
                            {item.joinUrl ? (
                              <a className="inline-link" href={item.joinUrl} rel="noreferrer" target="_blank">
                                <LinkIcon size={13} />
                                Join URL
                              </a>
                            ) : (
                              <span>No join link</span>
                            )}
                            <span>Zoom ID: {item.zoomId ?? 'Not set'}</span>
                          </p>
                          {isAdminCompleted && recordingUrl ? (
                            <p>
                              <a className="workshop-watch-link" href={recordingUrl} rel="noreferrer" target="_blank">
                                <Video size={13} />
                                {item.youtubeVideoUrl ? 'Watch on YouTube' : 'Watch Recording'}
                              </a>
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="workshop-meeting-actions">
                        {!isAdminCompleted && !isCancelled ? (
                          <>
                            <button className="announcement-row-button workshop-action-button" disabled={editingWorkshopId === item.id} onClick={() => editWorkshop(item)} type="button">
                              {editingWorkshopId === item.id ? <Loader2 className="workshop-action-spinner" size={14} /> : <Edit3 size={14} />}
                              {editingWorkshopId === item.id ? 'Editing...' : 'Edit'}
                            </button>
                            {isPast ? (
                              <button className="workshop-soft-action workshop-action-button" disabled={markCompletedMutation.isPending} onClick={() => void markWorkshopCompleted(item)} type="button">
                                {isMarkingThisWorkshop ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                                {isMarkingThisWorkshop ? 'Marking...' : 'Mark Completed'}
                              </button>
                            ) : null}
                            <button className="announcement-row-button workshop-action-button" disabled={!item.joinUrl || copiedWorkshopId === item.id} onClick={() => copyJoinUrl(item)} type="button">
                              {copiedWorkshopId === item.id ? <Check size={14} /> : <Copy size={14} />}
                              {copiedWorkshopId === item.id ? 'Copied' : 'Copy Link'}
                            </button>
                            <button className="workshop-danger-action workshop-action-button" disabled={cancelWorkshopMutation.isPending} onClick={() => setPendingCancelWorkshop(item)} type="button">
                              <X size={14} />
                              Cancel
                            </button>
                          </>
                        ) : null}
                        {isAdminCompleted ? (
                          <>
                            <button className="workshop-soft-action workshop-action-button" disabled={fetchRecordingsMutation.isPending} onClick={() => void fetchZoomRecordings(item)} type="button">
                              {isFetchingThisWorkshop ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                              {isFetchingThisWorkshop ? 'Fetching...' : 'Fetch Recordings'}
                            </button>
                            <Link className="workshop-neutral-action" to="/admin/recording-candidates">
                              <Clapperboard size={14} />
                              Open Recordings
                            </Link>
                          </>
                        ) : null}
                        {isCancelled ? <span className="workshop-archived-note">No active actions for archived meetings.</span> : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="workshop-empty-list">
                  <Plus size={18} />
                  No meetings found for this view.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="announcement-panel workshop-topic-panel" aria-labelledby="workshop-topic-manager-title">
        <div className="announcement-panel__header announcement-panel__header--row">
          <div>
            <span className="section-eyebrow">DROPDOWN CONTROLLER</span>
            <h2 id="workshop-topic-manager-title">Workshop Topics</h2>
          </div>
          <div className="workshop-topic-header-actions">
            {isTopicManagerOpen ? (
              <button className="workshop-topic-action workshop-topic-action--save" disabled={isSavingTopics} onClick={saveTopicDrafts} type="button">
                {isSavingTopics ? <Loader2 className="workshop-action-spinner" size={14} /> : <Save size={14} />}
                {isSavingTopics ? 'Saving...' : 'Save Topics'}
              </button>
            ) : null}
            <button className="workshop-topic-action workshop-topic-action--edit" onClick={() => setIsTopicManagerOpen((current) => !current)} type="button">
              {isTopicManagerOpen ? <X size={14} /> : <Edit3 size={14} />}
              {isTopicManagerOpen ? 'Hide Topics' : 'Manage Topics'}
            </button>
          </div>
        </div>
        {isTopicManagerOpen ? <div className="workshop-topic-manager">
          <div className="workshop-topic-manager__rows">
            {topicDrafts.map((topic) => (
              <div className="workshop-topic-row" key={topic.id}>
                <input
                  aria-label="Workshop topic"
                  readOnly={!topic.isEditing}
                  value={topic.title}
                  onChange={(event) => updateTopicDraft(topic.id, event.target.value)}
                  placeholder="Workshop topic title"
                  type="text"
                />
                <button className={topic.isEditing ? 'workshop-topic-action workshop-topic-action--done' : 'workshop-topic-action workshop-topic-action--edit'} onClick={() => toggleTopicDraftEditing(topic.id)} type="button">
                  {topic.isEditing ? <Check size={14} /> : <Edit3 size={14} />}
                  {topic.isEditing ? 'Done' : 'Edit'}
                </button>
                <button
                  className="workshop-topic-action workshop-topic-action--remove"
                  onClick={() => removeTopicDraft(topic.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button className="workshop-topic-action workshop-topic-action--add workshop-topic-add-button" disabled={isAddingTopic} onClick={addTopicDraft} type="button">
            {isAddingTopic ? <Loader2 className="workshop-action-spinner" size={14} /> : <Plus size={15} />}
            {isAddingTopic ? 'Adding...' : 'Add Topic'}
          </button>
        </div> : null}
      </section>

      {pendingCancelWorkshop ? (
        <div className="student-modal-backdrop" role="presentation">
          <section aria-labelledby="cancel-workshop-title" aria-modal="true" className="student-modal workshop-confirm-modal" role="dialog">
            <header className="student-modal__header">
              <h2 id="cancel-workshop-title">Cancel Meeting</h2>
              <button aria-label="Close cancel confirmation" className="student-modal__icon-button" onClick={() => setPendingCancelWorkshop(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="student-modal__body workshop-confirm-modal__body">
              <strong>{pendingCancelWorkshop.title}</strong>
              <span>{formatDateTime(pendingCancelWorkshop)}</span>
              <p>This will cancel the Zoom meeting, remove the student join link, and move the workshop out of active schedule views.</p>
            </div>
            <footer className="student-modal__footer">
              <button className="segmented-button" disabled={cancelWorkshopMutation.isPending} onClick={() => setPendingCancelWorkshop(null)} type="button">
                Keep Meeting
              </button>
              <button className="segmented-button segmented-button--danger" disabled={cancelWorkshopMutation.isPending} onClick={() => void confirmCancelWorkshop()} type="button">
                {cancelWorkshopMutation.isPending ? 'Cancelling...' : 'Cancel Meeting'}
              </button>
            </footer>
            {actionMessage && !actionMessage.includes('cancelled') ? <div className="workshop-error-note workshop-error-note--modal">{actionMessage}</div> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
