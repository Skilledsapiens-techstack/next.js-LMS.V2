import { CalendarDays, CheckCircle2, Clapperboard, Clock3, Copy, Edit3, Link as LinkIcon, Plus, Radio, Search, Video } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import { AdminWorkshop, AdminWorkshopStatus, useAdminWorkshops, useMarkAdminWorkshopCompleted } from '../features/admin/useAdminWorkshops';

type WorkshopTab = 'upcoming' | 'past' | 'completed';

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

type RecordingForm = {
  alternateUrl: string;
  selectedWorkshopId: string;
  youtubeUrl: string;
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

function activeCohorts(cohorts: AdminCohort[]) {
  return cohorts.filter((cohort) => cohort.status === 'active' || cohort.status === 'upcoming');
}

export function AdminWorkshopsPage() {
  const workshopsQuery = useAdminWorkshops({ limit: 100, page: 1, status: 'all' });
  const cohortsQuery = useAdminCohorts({ limit: 100, page: 1, sort: 'name', status: 'all' });
  const markCompletedMutation = useMarkAdminWorkshopCompleted();
  const [form, setForm] = useState<WorkshopForm>(emptyWorkshopForm);
  const [recordingForm, setRecordingForm] = useState<RecordingForm>({ alternateUrl: '', selectedWorkshopId: '', youtubeUrl: '' });
  const [cohortSearch, setCohortSearch] = useState('');
  const [activeTab, setActiveTab] = useState<WorkshopTab>('upcoming');
  const [postponedWorkshopIds, setPostponedWorkshopIds] = useState<string[]>([]);
  const [savedWorkshopTopics, setSavedWorkshopTopics] = useState<string[]>(loadSavedWorkshopTopics);
  const [topicDrafts, setTopicDrafts] = useState<WorkshopTopicDraft[]>(() => loadSavedWorkshopTopics().map((title) => createTopicDraft(title, false)));

  const workshops = workshopsQuery.data?.items ?? [];
  const cohorts = useMemo(() => activeCohorts(cohortsQuery.data?.items ?? []), [cohortsQuery.data?.items]);
  const filteredCohorts = useMemo(() => {
    const query = cohortSearch.trim().toLowerCase();
    if (!query) return cohorts;
    return cohorts.filter((cohort) => [cohort.name, cohort.cohortId, cohort.programKey, cohort.domainKey].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [cohortSearch, cohorts]);

  const now = Date.now();
  const completedWorkshops = useMemo(() => workshops.filter(isCompleted), [workshops]);
  const upcomingWorkshops = useMemo(() => workshops.filter((item) => isFutureScheduled(item, now)), [now, workshops]);
  const pastWorkshops = useMemo(() => workshops.filter((item) => isPastPendingCompletion(item, now)), [now, workshops]);
  const visibleWorkshops = activeTab === 'completed' ? completedWorkshops : activeTab === 'past' ? pastWorkshops : upcomingWorkshops;
  const total = workshopsQuery.data?.total ?? workshops.length;
  const pendingWithLink = useMemo(() => pastWorkshops.filter((item) => Boolean(item.joinUrl)).length, [pastWorkshops]);
  const upcomingCount = upcomingWorkshops.length;
  const pastCount = pastWorkshops.length;
  const completedCount = completedWorkshops.length;
  const pendingMarkCompleted = pastCount;
  const existingWorkshopTopics = useMemo(() => uniqueTitles(workshops.map((item) => item.title)), [workshops]);
  const workshopTopicOptions = useMemo(() => uniqueTitles([...savedWorkshopTopics, ...existingWorkshopTopics, form.title]), [existingWorkshopTopics, form.title, savedWorkshopTopics]);

  const selectedRecording = completedWorkshops.find((item) => item.id === recordingForm.selectedWorkshopId) ?? completedWorkshops[0];

  useEffect(() => {
    if (existingWorkshopTopics.length === 0) return;
    setTopicDrafts((drafts) => {
      const current = new Set(drafts.map((draft) => draft.title.trim().toLowerCase()).filter(Boolean));
      const missingTopics = existingWorkshopTopics.filter((topic) => !current.has(topic.toLowerCase()));
      return missingTopics.length > 0 ? [...drafts, ...missingTopics.map((topic) => createTopicDraft(topic, false))] : drafts;
    });
  }, [existingWorkshopTopics]);

  function updateForm<K extends keyof WorkshopForm>(key: K, value: WorkshopForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
    setForm((current) => ({
      ...current,
      cohortNames: Array.from(new Set([...current.cohortNames, ...filteredCohorts.map((cohort) => cohort.name)]))
    }));
  }

  function copyJoinUrl(item: AdminWorkshop) {
    if (item.joinUrl) {
      void navigator.clipboard?.writeText(item.joinUrl);
    }
  }

  function markWorkshopPostponed(item: AdminWorkshop) {
    setPostponedWorkshopIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
  }

  async function markWorkshopCompleted(item: AdminWorkshop) {
    await markCompletedMutation.mutateAsync(item.id);
    setRecordingForm({
      alternateUrl: item.zoomRecordingUrl ?? '',
      selectedWorkshopId: item.id,
      youtubeUrl: item.youtubeVideoUrl ?? ''
    });
    setActiveTab('completed');
  }

  function editWorkshop(item: AdminWorkshop) {
    setForm(workshopToForm(item));
    setRecordingForm({
      alternateUrl: item.zoomRecordingUrl ?? '',
      selectedWorkshopId: item.id,
      youtubeUrl: item.youtubeVideoUrl ?? ''
    });
  }

  function updateTopicDraft(id: string, title: string) {
    setTopicDrafts((drafts) => drafts.map((draft) => (draft.id === id ? { ...draft, title } : draft)));
  }

  function toggleTopicDraftEditing(id: string) {
    setTopicDrafts((drafts) => drafts.map((draft) => (draft.id === id ? { ...draft, isEditing: !draft.isEditing } : draft)));
  }

  function saveTopicDrafts() {
    const nextTopics = uniqueTitles(topicDrafts.map((topic) => topic.title));
    setSavedWorkshopTopics(nextTopics);
    setTopicDrafts(nextTopics.length > 0 ? nextTopics.map((title) => createTopicDraft(title, false)) : [createTopicDraft()]);
    saveWorkshopTopics(nextTopics);
  }

  function handleRecordingWorkshopChange(event: ChangeEvent<HTMLSelectElement>) {
    const selected = completedWorkshops.find((item) => item.id === event.target.value);
    setRecordingForm({
      alternateUrl: selected?.zoomRecordingUrl ?? '',
      selectedWorkshopId: event.target.value,
      youtubeUrl: selected?.youtubeVideoUrl ?? ''
    });
  }

  if (workshopsQuery.isLoading || cohortsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading meeting schedule." eyebrow="Admin workshops" title="Schedule Meeting" />
        <LoadingState />
      </div>
    );
  }

  if (workshopsQuery.isError || cohortsQuery.isError) {
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
            <span>Last Refresh: 28 Jun 2026, 02:57 pm</span>
          </div>
          <p>Refresh only meetings data from the database.</p>
        </div>
        <button className="announcement-refresh-button" onClick={() => void workshopsQuery.refetch()} type="button">
          Refresh Meetings
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
          <span>Pending with Link</span>
          <strong>{pendingWithLink}</strong>
        </article>
        <article className="metric-tile">
          <Radio size={18} />
          <span>Upcoming</span>
          <strong>{upcomingCount}</strong>
        </article>
        <article className="metric-tile">
          <Clock3 size={18} />
          <span>Past</span>
          <strong>{pastCount}</strong>
        </article>
        <article className="metric-tile">
          <CheckCircle2 size={18} />
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </article>
        <article className="metric-tile">
          <Video size={18} />
          <span>Pending Mark Completed</span>
          <strong>{pendingMarkCompleted}</strong>
        </article>
      </div>

      <div className="workshop-grid">
        <section className="announcement-panel workshop-panel">
          <div className="announcement-panel__header">
            <span className="section-eyebrow">ZOOM INTEGRATION</span>
            <h2>{form.selectedWorkshopId ? 'Edit Scheduled Meeting' : 'Schedule a New Meeting'}</h2>
          </div>

          <form className="announcement-form workshop-form">
            <label className="announcement-field announcement-field--wide">
              <span>
                Session Title <b>*</b>
              </span>
              <input
                list="workshop-topic-options"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder="Select or type a custom title..."
              />
              <datalist id="workshop-topic-options">
                {workshopTopicOptions.map((title) => (
                  <option key={title} value={title} />
                ))}
              </datalist>
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
                <button className="announcement-secondary-button" onClick={selectAllVisibleCohorts} type="button">
                  Select all
                </button>
                <button className="announcement-secondary-button" onClick={() => updateForm('cohortNames', [])} type="button">
                  Clear all
                </button>
              </div>
              <div className="workshop-cohort-list">
                {filteredCohorts.length > 0 ? (
                  filteredCohorts.map((cohort) => (
                    <label className="workshop-cohort-row" key={cohort.id}>
                      <input checked={form.cohortNames.includes(cohort.name)} onChange={() => toggleCohort(cohort.name)} type="checkbox" />
                      <strong>{cohort.name}</strong>
                      <span>{cohort.status.toUpperCase()}</span>
                    </label>
                  ))
                ) : (
                  <p>No active or upcoming cohorts available.</p>
                )}
              </div>
              <small>Select one or more cohorts. This session will appear in each cohort's schedule.</small>
            </div>

            <label className="announcement-field announcement-field--wide">
              <span>Agenda / Notes</span>
              <textarea value={form.agenda} onChange={(event) => updateForm('agenda', event.target.value)} placeholder="Optional - visible to host on Zoom" />
            </label>

            <div className="announcement-actions announcement-field--wide">
              <button className="announcement-secondary-button" onClick={() => setForm(emptyWorkshopForm)} type="button">
                Clear
              </button>
              <button className="announcement-primary-button" disabled type="button">
                {form.selectedWorkshopId ? 'Update Meeting ->' : 'Schedule on Zoom ->'}
              </button>
            </div>
          </form>
        </section>

        <section className="announcement-side-stack">
          <div className="announcement-panel workshop-panel">
            <div className="announcement-panel__header">
              <span className="section-eyebrow">WORKSHOP PIPELINE</span>
              <h2>All Sessions</h2>
            </div>

            <div className="workshop-recording-box">
              <span className="section-eyebrow">ATTACH RECORDING</span>
              <select disabled={completedWorkshops.length === 0} value={selectedRecording?.id ?? ''} onChange={handleRecordingWorkshopChange}>
                {completedWorkshops.length > 0 ? (
                  completedWorkshops.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} - {formatDate(item.date)}
                    </option>
                  ))
                ) : (
                  <option value="">No admin-completed workshops available</option>
                )}
              </select>
              <input value={recordingForm.youtubeUrl} onChange={(event) => setRecordingForm((current) => ({ ...current, youtubeUrl: event.target.value }))} placeholder="YouTube URL (optional)" />
              <input value={recordingForm.alternateUrl} onChange={(event) => setRecordingForm((current) => ({ ...current, alternateUrl: event.target.value }))} placeholder="Drive, Zoom, or alternate recording URL (optional)" />
              <button className="announcement-primary-button" disabled type="button">
                {recordingForm.youtubeUrl || recordingForm.alternateUrl ? 'Update Recording Links' : 'Save Recording Links'}
              </button>
              <p>Only workshops marked completed by Admin appear here. Add or edit at least one recording link.</p>
              {markCompletedMutation.isError ? <p className="workshop-error-note">Mark Completed could not be saved. Confirm workshop status writes are enabled and try again.</p> : null}
            </div>

            <div className="workshop-list-header">
              <span className="section-eyebrow">MEETING LIST</span>
              <div className="workshop-tabs">
                <button className={activeTab === 'upcoming' ? 'workshop-tab workshop-tab--active' : 'workshop-tab'} onClick={() => setActiveTab('upcoming')} type="button">
                  <CalendarDays size={14} />
                  Upcoming
                </button>
                <button className={activeTab === 'past' ? 'workshop-tab workshop-tab--active' : 'workshop-tab'} onClick={() => setActiveTab('past')} type="button">
                  <Clock3 size={14} />
                  Past
                </button>
                <button className={activeTab === 'completed' ? 'workshop-tab workshop-tab--active' : 'workshop-tab'} onClick={() => setActiveTab('completed')} type="button">
                  <Clapperboard size={14} />
                  Completed
                </button>
              </div>
            </div>

            <div className="workshop-meeting-list">
              {visibleWorkshops.length > 0 ? (
                visibleWorkshops.map((item) => {
                  const isAdminCompleted = isCompleted(item);
                  const isPast = activeTab === 'past';
                  const recordingUrl = item.youtubeVideoUrl ?? item.zoomRecordingUrl;
                  const isMarkingThisWorkshop = markCompletedMutation.isPending && markCompletedMutation.variables === item.id;
                  const isPostponed = postponedWorkshopIds.includes(item.id);

                  return (
                    <article className={isAdminCompleted ? 'workshop-meeting-row workshop-meeting-row--completed' : 'workshop-meeting-row'} key={item.id}>
                      <div className="workshop-meeting-main">
                        {isAdminCompleted ? <Clapperboard size={18} /> : <Video size={18} />}
                        <div>
                          <h3>{item.title}</h3>
                          <p>
                            <StatusBadge tone={isAdminCompleted ? 'safe' : statusTone(item.status)}>{isAdminCompleted ? 'Completed' : item.status}</StatusBadge>
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
                          {isAdminCompleted ? (
                            <>
                              <div className="workshop-recording-candidate">
                                <strong>Admin-only Zoom recording candidates</strong>
                                <button disabled type="button">
                                  Fetch Zoom Recordings
                                </button>
                                <span>No Zoom recording candidates fetched yet.</span>
                              </div>
                              <button className="workshop-soft-action workshop-soft-action--recording" onClick={() => editWorkshop(item)} type="button">
                                Edit Recording
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {!isAdminCompleted ? (
                        <div className="workshop-meeting-actions">
                          <button className="announcement-row-button" onClick={() => editWorkshop(item)} type="button">
                            <Edit3 size={14} />
                            Edit
                          </button>
                          {isPast ? (
                            <>
                              <button className="workshop-soft-action" disabled={markCompletedMutation.isPending} onClick={() => void markWorkshopCompleted(item)} type="button">
                                {isMarkingThisWorkshop ? 'Marking...' : 'Mark Completed'}
                              </button>
                              <button className="workshop-neutral-action" onClick={() => markWorkshopPostponed(item)} type="button">
                                {isPostponed ? 'Postponed' : 'Postpone'}
                              </button>
                            </>
                          ) : null}
                          <button className="announcement-row-button" disabled={!item.joinUrl} onClick={() => copyJoinUrl(item)} type="button">
                            <Copy size={14} />
                            Copy Link
                          </button>
                        </div>
                      ) : null}
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
          <button className="workshop-soft-action" onClick={saveTopicDrafts} type="button">
            Save Topics
          </button>
        </div>
        <div className="workshop-topic-manager">
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
                <button className="workshop-soft-action" onClick={() => toggleTopicDraftEditing(topic.id)} type="button">
                  <Edit3 size={14} />
                  {topic.isEditing ? 'Done' : 'Edit'}
                </button>
                <button
                  className="workshop-neutral-action"
                  onClick={() => setTopicDrafts((drafts) => (drafts.length > 1 ? drafts.filter((draft) => draft.id !== topic.id) : [createTopicDraft()]))}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button className="cohort-add-row-button" onClick={() => setTopicDrafts((drafts) => [...drafts, createTopicDraft()])} type="button">
            <Plus size={15} />
            Add Topic
          </button>
        </div>
      </section>
    </div>
  );
}
