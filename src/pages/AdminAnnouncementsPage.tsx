import { Bell, Briefcase, CalendarDays, Folder, List, Pin, TriangleAlert } from 'lucide-react';
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { AnnouncementRichText } from '../components/AnnouncementRichText';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import {
  AdminAnnouncement,
  AdminAnnouncementPriority,
  AdminAnnouncementStatus,
  AdminAnnouncementWritePayload,
  useAdminAnnouncementRecipientCount,
  useAdminAnnouncements,
  useArchiveAdminAnnouncement,
  useBulkArchiveAdminAnnouncements,
  useCreateAdminAnnouncement,
  useUpdateAdminAnnouncement,
  useUpdateAdminAnnouncementStatus
} from '../features/admin/useAdminAnnouncements';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';

type NotificationType = 'general' | 'alert' | 'session' | 'resource' | 'project' | 'custom';
type AudienceMode = 'all' | 'cohort' | 'program';
type HistoryFilter = 'all' | AdminAnnouncementStatus | NotificationType;
type AnnouncementAdminTab = 'create' | 'history';

type AnnouncementFormState = {
  audienceMode: AudienceMode;
  customEmoji: string;
  endDate: string;
  linkLabel: string;
  linkUrl: string;
  message: string;
  pinned: boolean;
  priority: AdminAnnouncementPriority;
  selectedAudience: string;
  selectedCohortIds: string[];
  selectedProgramKeys: string[];
  startDate: string;
  status: AdminAnnouncementStatus;
  title: string;
  type: NotificationType;
};

const notificationTypes: Array<{
  description: string;
  icon: typeof Bell;
  label: string;
  type: NotificationType;
}> = [
  { description: 'All students', icon: Bell, label: 'General', type: 'general' },
  { description: 'Urgent update', icon: TriangleAlert, label: 'Alert', type: 'alert' },
  { description: 'Class reminder', icon: CalendarDays, label: 'Session', type: 'session' },
  { description: 'New material', icon: Folder, label: 'Resource', type: 'resource' },
  { description: 'Project update', icon: Briefcase, label: 'Project', type: 'project' },
  { description: 'Your own emoji', icon: List, label: 'Custom', type: 'custom' }
];

const initialFormState: AnnouncementFormState = {
  audienceMode: 'all',
  customEmoji: '',
  endDate: '',
  linkLabel: '',
  linkUrl: '',
  message: '',
  pinned: true,
  priority: 'normal',
  selectedAudience: '',
  selectedCohortIds: [],
  selectedProgramKeys: [],
  startDate: '',
  status: 'active',
  title: '',
  type: 'general'
};

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return 'Not refreshed yet';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        year: 'numeric'
      });
}

function toDateInputValue(value: string | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function formatLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getAnnouncementType(item: AdminAnnouncement): NotificationType {
  const type = item.type?.toLowerCase();
  if (type === 'alert' || type === 'session' || type === 'resource' || type === 'project' || type === 'custom') {
    return type;
  }
  return 'general';
}

function getAudienceMode(item: AdminAnnouncement): AudienceMode {
  if (item.audience === 'cohort') {
    return 'cohort';
  }
  if (item.audience === 'program') {
    return 'program';
  }
  return 'all';
}

function getAudienceLabel(mode: AudienceMode, selectedAudience: string, selectedCohortCount = 0, selectedProgramCount = 0) {
  if (mode === 'cohort') {
    return selectedCohortCount > 0 ? `${selectedCohortCount} cohort${selectedCohortCount === 1 ? '' : 's'} selected` : 'No cohorts selected';
  }
  if (mode === 'program') {
    return selectedProgramCount > 0 ? `${selectedProgramCount} program${selectedProgramCount === 1 ? '' : 's'} selected` : selectedAudience || 'No programs selected';
  }
  return 'All Students';
}

function getAnnouncementAudienceLabel(item: AdminAnnouncement) {
  const targets = [...item.cohortNames, ...item.programKeys];
  return targets.length > 0 ? targets.join(', ') : 'all students';
}

function getTypeTone(type: NotificationType) {
  return `notification-type-token notification-type-token--${type}`;
}

function getTypeIconBackground(type: NotificationType) {
  return `notification-preview-icon notification-preview-icon--${type}`;
}

function getTypeIcon(type: NotificationType) {
  return notificationTypes.find((item) => item.type === type)?.icon ?? Bell;
}

function getStatusToken(item: AdminAnnouncement) {
  const now = Date.now();
  const end = item.endDate ? new Date(item.endDate).getTime() : undefined;
  const visibility = item.status === 'active' && (!end || Number.isNaN(end) || end >= now) ? 'Visible' : item.endDate && end && end < now ? 'Expired' : 'Inactive';
  return `${visibility} · ${item.status}`;
}

function uniqueCohorts(cohorts: AdminCohort[]) {
  const seen = new Set<string>();
  return cohorts.filter((cohort) => {
    const key = cohort.id || cohort.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function AdminAnnouncementsPage() {
  const [page] = useState(1);
  const [activeTab, setActiveTab] = useState<AnnouncementAdminTab>('create');
  const [formState, setFormState] = useState<AnnouncementFormState>(initialFormState);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [formMessage, setFormMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [previewNotice, setPreviewNotice] = useState('');
  const [selectedAnnouncementIds, setSelectedAnnouncementIds] = useState<string[]>([]);
  const [statusActionId, setStatusActionId] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const announcementsQuery = useAdminAnnouncements({ limit: 50, page });
  const cohortsPageOneQuery = useAdminCohorts({ limit: 100, page: 1, sort: 'name', status: 'all' });
  const cohortsPageTwoQuery = useAdminCohorts({ enabled: cohortsPageOneQuery.data?.hasNextPage === true, limit: 100, page: 2, sort: 'name', status: 'all' });
  const cohortsPageThreeQuery = useAdminCohorts({ enabled: cohortsPageTwoQuery.data?.hasNextPage === true, limit: 100, page: 3, sort: 'name', status: 'all' });
  const programsQuery = useAdminPrograms({ limit: 500, page: 1, status: 'active' });
  const createAnnouncement = useCreateAdminAnnouncement();
  const updateAnnouncement = useUpdateAdminAnnouncement();
  const updateAnnouncementStatus = useUpdateAdminAnnouncementStatus();
  const archiveAnnouncement = useArchiveAdminAnnouncement();
  const bulkArchiveAnnouncements = useBulkArchiveAdminAnnouncements();
  const data = announcementsQuery.data;
  const items = data?.items ?? [];
  const cohorts = useMemo(
    () =>
      uniqueCohorts([
        ...(cohortsPageOneQuery.data?.items ?? []),
        ...(cohortsPageTwoQuery.data?.items ?? []),
        ...(cohortsPageThreeQuery.data?.items ?? [])
      ]).filter((cohort) => cohort.status !== 'inactive'),
    [cohortsPageOneQuery.data?.items, cohortsPageThreeQuery.data?.items, cohortsPageTwoQuery.data?.items]
  );
  const programs = programsQuery.data?.items ?? [];
  const lastRefresh = formatDateTime(data?.items[0]?.updatedAt);
  const isSaving = createAnnouncement.isPending || updateAnnouncement.isPending;

  const previewType = notificationTypes.find((item) => item.type === formState.type) ?? notificationTypes[0];
  const PreviewIcon = getTypeIcon(formState.type);
  const previewTitle = formState.title.trim() || 'Your notification title';
  const previewMessage = formState.message.trim() || 'Your notification message will appear here.';
  const selectedCohortNames = useMemo(() => {
    if (formState.audienceMode !== 'cohort') {
      return [];
    }

    const selected = new Set(formState.selectedCohortIds);
    return cohorts.filter((cohort) => selected.has(cohort.id)).map((cohort) => cohort.name);
  }, [cohorts, formState.audienceMode, formState.selectedCohortIds]);
  const selectedProgramNames = useMemo(() => {
    if (formState.audienceMode !== 'program') {
      return [];
    }

    const selected = new Set(formState.selectedProgramKeys);
    return programs.filter((program) => selected.has(program.programKey)).map((program) => program.name);
  }, [formState.audienceMode, formState.selectedProgramKeys, programs]);
  const previewAudience = getAudienceLabel(formState.audienceMode, formState.selectedAudience, selectedCohortNames.length, selectedProgramNames.length);
  const recipientCountQuery = useAdminAnnouncementRecipientCount({
    audience: formState.audienceMode,
    cohortNames: selectedCohortNames,
    programKeys: formState.selectedProgramKeys
  });
  const exactRecipientCount = recipientCountQuery.data?.total ?? 0;
  const recipientCountLabel = recipientCountQuery.isLoading ? 'Counting recipients...' : `${exactRecipientCount} active recipient${exactRecipientCount === 1 ? '' : 's'}`;

  const filteredItems = useMemo(() => {
    if (historyFilter === 'all') {
      return items;
    }

    if (historyFilter === 'active' || historyFilter === 'inactive') {
      return items.filter((item) => item.status === historyFilter);
    }

    return items.filter((item) => getAnnouncementType(item) === historyFilter);
  }, [historyFilter, items]);

  function updateForm<K extends keyof AnnouncementFormState>(key: K, value: AnnouncementFormState[K]) {
    setFormMessage(null);
    setPreviewNotice('');
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function handleTypeSelect(type: NotificationType) {
    setFormState((current) => ({ ...current, type, customEmoji: type === 'custom' ? current.customEmoji : '' }));
  }

  function handleAudienceChange(event: ChangeEvent<HTMLSelectElement>) {
    const audienceMode = event.target.value as AudienceMode;
    setFormState((current) => ({ ...current, audienceMode, selectedAudience: '', selectedCohortIds: [], selectedProgramKeys: [] }));
  }

  function toggleCohort(cohortId: string) {
    setFormState((current) => {
      const selected = new Set(current.selectedCohortIds);
      if (selected.has(cohortId)) {
        selected.delete(cohortId);
      } else {
        selected.add(cohortId);
      }
      return { ...current, selectedCohortIds: Array.from(selected) };
    });
  }

  function selectAllCohorts() {
    setFormState((current) => ({ ...current, selectedCohortIds: cohorts.map((cohort) => cohort.id) }));
  }

  function removeAllCohorts() {
    setFormState((current) => ({ ...current, selectedCohortIds: [] }));
  }

  function toggleProgram(programKey: string) {
    setFormState((current) => {
      const selected = new Set(current.selectedProgramKeys);
      if (selected.has(programKey)) {
        selected.delete(programKey);
      } else {
        selected.add(programKey);
      }
      return { ...current, selectedProgramKeys: Array.from(selected), selectedAudience: Array.from(selected).join(', ') };
    });
  }

  function selectAllPrograms() {
    const selectedProgramKeys = programs.map((program) => program.programKey);
    setFormState((current) => ({ ...current, selectedProgramKeys, selectedAudience: selectedProgramKeys.join(', ') }));
  }

  function removeAllPrograms() {
    setFormState((current) => ({ ...current, selectedProgramKeys: [], selectedAudience: '' }));
  }

  function handleEdit(item: AdminAnnouncement) {
    const audienceMode = getAudienceMode(item);
    const selectedAudience = audienceMode === 'cohort' ? item.cohortNames.join(', ') : audienceMode === 'program' ? item.programKeys.join(', ') : '';
    const cohortNameSet = new Set(item.cohortNames.map((name) => name.toLowerCase()));
    const programKeySet = new Set(item.programKeys);
    setEditingAnnouncementId(item.id);
    setActiveTab('create');
    setFormMessage(null);
    setPreviewNotice('Editing existing announcement.');
    setFormState({
      audienceMode,
      customEmoji: getAnnouncementType(item) === 'custom' ? item.customEmoji ?? '' : '',
      endDate: toDateInputValue(item.endDate),
      linkLabel: item.linkLabel ?? '',
      linkUrl: item.linkUrl ?? '',
      message: item.message,
      pinned: item.pinned,
      priority: item.priority,
      selectedAudience,
      selectedCohortIds: audienceMode === 'cohort' ? cohorts.filter((cohort) => cohortNameSet.has(cohort.name.toLowerCase())).map((cohort) => cohort.id) : [],
      selectedProgramKeys: audienceMode === 'program' ? Array.from(programKeySet) : [],
      startDate: toDateInputValue(item.startDate),
      status: item.status,
      title: item.title,
      type: getAnnouncementType(item)
    });
  }

  function handleDuplicate(item: AdminAnnouncement) {
    handleEdit(item);
    setEditingAnnouncementId(null);
    setActiveTab('create');
    setFormState((current) => ({ ...current, status: 'inactive', title: `${item.title} copy` }));
    setPreviewNotice('Duplicated as a new inactive draft. Review and send when ready.');
  }

  function insertMessageSnippet(type: 'bold' | 'bullet' | 'divider') {
    const textarea = messageRef.current;
    const current = formState.message;
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const selected = current.slice(start, end);
    const snippet =
      type === 'bold'
        ? `**${selected || 'important text'}**`
        : type === 'bullet'
          ? `${selected ? '' : '- '} ${selected || 'Key update'}`.replace('-  ', '- ')
          : `${selected ? `${selected}\n` : ''}\n---\n`;
    const nextMessage = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
    updateForm('message', nextMessage);
    requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + snippet.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  }

  function toggleSelectedAnnouncement(announcementId: string) {
    setSelectedAnnouncementIds((current) => (current.includes(announcementId) ? current.filter((id) => id !== announcementId) : [...current, announcementId]));
  }

  function toggleAllFilteredAnnouncements() {
    const visibleIds = filteredItems.map((item) => item.id);
    setSelectedAnnouncementIds((current) => {
      const selectedVisibleCount = visibleIds.filter((id) => current.includes(id)).length;
      if (selectedVisibleCount === visibleIds.length) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  async function handleBulkArchive() {
    if (selectedAnnouncementIds.length === 0) return;
    setFormMessage(null);
    try {
      const result = await bulkArchiveAnnouncements.mutateAsync(selectedAnnouncementIds);
      setSelectedAnnouncementIds([]);
      setFormMessage({ tone: 'success', text: `${result.archived} announcement${result.archived === 1 ? '' : 's'} archived.` });
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Selected announcements could not be archived.' });
    }
  }

  function validateForm() {
    if (!formState.title.trim()) return 'Announcement title is required.';
    if (!formState.message.trim()) return 'Announcement message is required.';
    if (formState.title.trim().length > 160) return 'Keep the title within 160 characters.';
    if (formState.message.trim().length > 2500) return 'Keep the message within 2500 characters.';
    if (formState.audienceMode === 'cohort' && selectedCohortNames.length === 0) return 'Select at least one cohort.';
    if (formState.audienceMode === 'program' && formState.selectedProgramKeys.length === 0) return 'Select at least one program.';
    if (formState.linkUrl.trim() && !isHttpUrl(formState.linkUrl.trim())) return 'Link URL must start with http:// or https://.';
    if (formState.startDate && formState.endDate && formState.startDate > formState.endDate) return 'End date cannot be before start date.';
    return '';
  }

  function buildPayload(): AdminAnnouncementWritePayload {
    return {
      audience: formState.audienceMode,
      cohortNames: formState.audienceMode === 'cohort' ? selectedCohortNames : [],
      customEmoji: formState.type === 'custom' ? formState.customEmoji.trim() || null : null,
      endDate: formState.endDate || null,
      linkLabel: formState.linkLabel.trim() || null,
      linkUrl: formState.linkUrl.trim() || null,
      message: formState.message.trim(),
      pinned: formState.pinned,
      priority: formState.priority,
      programKeys: formState.audienceMode === 'program' ? formState.selectedProgramKeys : [],
      startDate: formState.startDate || null,
      status: formState.status,
      title: formState.title.trim(),
      type: formState.type
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormMessage({ tone: 'error', text: validationError });
      return;
    }

    try {
      const payload = buildPayload();
      if (editingAnnouncementId) {
        await updateAnnouncement.mutateAsync({ announcementId: editingAnnouncementId, body: payload });
        setFormMessage({ tone: 'success', text: 'Announcement updated successfully.' });
      } else {
        await createAnnouncement.mutateAsync(payload);
        setFormMessage({ tone: 'success', text: 'Announcement sent successfully.' });
      }
      setEditingAnnouncementId(null);
      setPreviewNotice('');
      setFormState(initialFormState);
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Announcement could not be saved.' });
    }
  }

  async function handleStatusChange(item: AdminAnnouncement, status: AdminAnnouncementStatus) {
    setStatusActionId(item.id);
    setFormMessage(null);
    try {
      await updateAnnouncementStatus.mutateAsync({ announcementId: item.id, status });
      setFormMessage({ tone: 'success', text: `Announcement marked ${status}.` });
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Announcement status could not be updated.' });
    } finally {
      setStatusActionId(null);
    }
  }

  async function handleArchive(item: AdminAnnouncement) {
    setStatusActionId(item.id);
    setFormMessage(null);
    try {
      await archiveAnnouncement.mutateAsync(item.id);
      setFormMessage({ tone: 'success', text: 'Announcement archived.' });
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Announcement could not be archived.' });
    } finally {
      setStatusActionId(null);
    }
  }

  function resetForm() {
    setEditingAnnouncementId(null);
    setFormMessage(null);
    setPreviewNotice('');
    setFormState(initialFormState);
  }

  if (announcementsQuery.isLoading) {
    return (
      <div className="page-stack">
        <section className="announcement-admin-heading">
          <span className="eyebrow">Module Refresh</span>
          <h1>Announcements</h1>
          <p>Loading announcements.</p>
        </section>
        <LoadingState />
      </div>
    );
  }

  if (announcementsQuery.isError) {
    return (
      <div className="page-stack">
        <section className="announcement-admin-heading">
          <span className="eyebrow">Module Refresh</span>
          <h1>Announcements</h1>
          <p>Announcements could not be loaded.</p>
        </section>
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="announcement-admin-page">
      <section className="announcement-admin-heading">
        <div>
          <span className="eyebrow">Module Refresh</span>
          <div className="announcement-admin-title-row">
            <h1>Announcements</h1>
            <span>Last Refresh: {lastRefresh}</span>
          </div>
          <p>Refresh only announcements data from the database.</p>
        </div>
        <button className="announcement-refresh-button" onClick={() => announcementsQuery.refetch()} type="button">
          Refresh Announcements
        </button>
      </section>

      <nav className="support-tabs announcement-admin-tabs" aria-label="Announcement workspace tabs">
        <button className={activeTab === 'create' ? 'support-tab support-tab--active' : 'support-tab'} onClick={() => setActiveTab('create')} type="button">
          Create Announcement
        </button>
        <button className={activeTab === 'history' ? 'support-tab support-tab--active' : 'support-tab'} onClick={() => setActiveTab('history')} type="button">
          History
        </button>
      </nav>

      {formMessage ? (
        <div className={formMessage.tone === 'success' ? 'announcement-form-message announcement-form-message--success' : 'announcement-form-message announcement-form-message--error'}>
          {formMessage.text}
        </div>
      ) : null}

      {activeTab === 'create' ? (
        <div className="announcement-centre-grid">
          <section className="announcement-panel announcement-compose-panel">
            <header className="announcement-panel__header">
              <span className="eyebrow">Notification Centre</span>
              <h2>{editingAnnouncementId ? 'Update Notification' : 'Send Notification'}</h2>
            </header>

            <form className="announcement-form" onSubmit={handleSubmit}>
            <div className="announcement-field announcement-field--wide">
              <span>Notification Type</span>
              <div className="notification-type-grid">
                {notificationTypes.map((item) => {
                  const Icon = item.icon;
                  const selected = item.type === formState.type;
                  return (
                    <button
                      className={selected ? 'notification-type-card notification-type-card--selected' : 'notification-type-card'}
                      key={item.type}
                      onClick={() => handleTypeSelect(item.type)}
                      type="button"
                    >
                      <Icon size={24} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {formState.type === 'custom' ? (
              <label className="announcement-field announcement-field--wide">
                <span>Custom Icon</span>
                <input placeholder="Paste emoji e.g. 🎯" value={formState.customEmoji} onChange={(event) => updateForm('customEmoji', event.target.value)} />
              </label>
            ) : null}

            <label className="announcement-field announcement-field--wide">
              <span>Send To</span>
              <select value={formState.audienceMode} onChange={handleAudienceChange}>
                <option value="all">All Students</option>
                <option value="cohort">Specific Cohort(s)</option>
                <option value="program">Specific Program</option>
              </select>
            </label>

            {formState.audienceMode === 'cohort' ? (
              <fieldset className="announcement-cohort-picker announcement-field--wide">
                <legend>Cohort(s)</legend>
                <div className="announcement-cohort-picker__actions">
                  <button className="segmented-button" onClick={selectAllCohorts} type="button">
                    Select All
                  </button>
                  <button className="segmented-button" onClick={removeAllCohorts} type="button">
                    Remove All
                  </button>
                </div>
                <div className="announcement-cohort-list">
                  {cohortsPageOneQuery.isLoading ? (
                    <p>Loading cohorts.</p>
                  ) : cohortsPageOneQuery.isError || cohortsPageTwoQuery.isError || cohortsPageThreeQuery.isError ? (
                    <p>Cohorts could not be loaded.</p>
                  ) : cohorts.length > 0 ? (
                    cohorts.map((cohort) => (
                      <label key={cohort.id}>
                        <input checked={formState.selectedCohortIds.includes(cohort.id)} onChange={() => toggleCohort(cohort.id)} type="checkbox" />
                        <span>{cohort.name}</span>
                        <strong>{cohort.studentCount} students</strong>
                      </label>
                    ))
                  ) : (
                    <p>No cohorts available.</p>
                  )}
                </div>
              </fieldset>
            ) : null}

            {formState.audienceMode === 'program' ? (
              <fieldset className="announcement-cohort-picker announcement-field--wide">
                <legend>Program(s)</legend>
                <div className="announcement-cohort-picker__actions">
                  <button className="segmented-button" onClick={selectAllPrograms} type="button">
                    Select All
                  </button>
                  <button className="segmented-button" onClick={removeAllPrograms} type="button">
                    Remove All
                  </button>
                </div>
                <div className="announcement-cohort-list">
                  {programsQuery.isLoading ? (
                    <p>Loading programs.</p>
                  ) : programsQuery.isError ? (
                    <p>Programs could not be loaded.</p>
                  ) : programs.length > 0 ? (
                    programs.map((program) => (
                    <label key={program.programKey}>
                      <input checked={formState.selectedProgramKeys.includes(program.programKey)} onChange={() => toggleProgram(program.programKey)} type="checkbox" />
                      <span>{program.name}</span>
                      <strong>{program.shortName ?? program.programKey.toUpperCase()}</strong>
                    </label>
                    ))
                  ) : (
                    <p>No active programs available.</p>
                  )}
                </div>
              </fieldset>
            ) : null}

            <div className="announcement-target-preview">
              <strong>{recipientCountLabel}</strong>
              <span>
              {formState.audienceMode === 'cohort' && selectedCohortNames.length > 0
                ? `${selectedCohortNames.length} cohort${selectedCohortNames.length === 1 ? '' : 's'} · ${selectedCohortNames.join(', ')}`
                : formState.audienceMode === 'program' && selectedProgramNames.length > 0
                  ? `${selectedProgramNames.length} program${selectedProgramNames.length === 1 ? '' : 's'} · ${selectedProgramNames.join(', ')}`
                  : previewAudience}
              </span>
            </div>

            <label className="announcement-field">
              <span>Priority</span>
              <select value={formState.priority} onChange={(event) => updateForm('priority', event.target.value as AdminAnnouncementPriority)}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>

            <label className="announcement-field">
              <span>Status</span>
              <select value={formState.status} onChange={(event) => updateForm('status', event.target.value as AdminAnnouncementStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="announcement-field">
              <span>Start Date</span>
              <input value={formState.startDate} onChange={(event) => updateForm('startDate', event.target.value)} type="date" />
            </label>

            <label className="announcement-field">
              <span>End Date</span>
              <input value={formState.endDate} onChange={(event) => updateForm('endDate', event.target.value)} type="date" />
            </label>

            <label className="announcement-field announcement-field--wide">
              <span>
                Title <b>*</b>
              </span>
              <input placeholder="Short headline e.g. Session Reminder - MCLP Batch 4" value={formState.title} onChange={(event) => updateForm('title', event.target.value)} />
            </label>

            <label className="announcement-field announcement-field--wide">
              <span>
                Message <b>*</b>
              </span>
              <div className="announcement-editor-toolbar" aria-label="Message formatting">
                <button onClick={() => insertMessageSnippet('bold')} type="button">
                  Bold
                </button>
                <button onClick={() => insertMessageSnippet('bullet')} type="button">
                  Bullet
                </button>
                <button onClick={() => insertMessageSnippet('divider')} type="button">
                  Divider
                </button>
              </div>
              <textarea ref={messageRef} placeholder="Full notification message..." value={formState.message} onChange={(event) => updateForm('message', event.target.value)} />
            </label>

            <label className="announcement-field">
              <span>CTA Label</span>
              <input placeholder="Optional e.g. Open resource" value={formState.linkLabel} onChange={(event) => updateForm('linkLabel', event.target.value)} />
            </label>

            <label className="announcement-field">
              <span>CTA Link</span>
              <input placeholder="https://..." value={formState.linkUrl} onChange={(event) => updateForm('linkUrl', event.target.value)} />
            </label>

            <label className="announcement-pin-control announcement-field--wide">
              <input checked={formState.pinned} onChange={(event) => updateForm('pinned', event.target.checked)} type="checkbox" />
              <span>
                <Pin size={17} /> Pin this notification (shows at top)
              </span>
            </label>

            <div className="announcement-form-actions announcement-field--wide">
              <button className="announcement-secondary-button" onClick={resetForm} type="button">
                {editingAnnouncementId ? 'Cancel Edit' : 'Reset'}
              </button>
              <button className="announcement-send-button" disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : editingAnnouncementId ? 'Update Notification' : 'Send Notification'}
              </button>
            </div>
            {previewNotice ? <div className="announcement-form-message announcement-field--wide">{previewNotice}</div> : null}
            </form>
          </section>

          <section className="announcement-panel">
            <header className="announcement-panel__header">
              <span className="eyebrow">Preview</span>
              <h2>How it looks</h2>
            </header>
            <div className="announcement-preview-wrap">
              <article className="announcement-preview-card">
                <div className={getTypeIconBackground(formState.type)}>
                  {formState.type === 'custom' && formState.customEmoji.trim() ? <span>{formState.customEmoji.trim().slice(0, 2)}</span> : <PreviewIcon size={28} />}
                </div>
                <div className="announcement-preview-card__body">
                  <h3>
                    <span aria-hidden="true">📌</span>
                    {previewTitle}
                  </h3>
                  <AnnouncementRichText text={previewMessage} />
                  <div className="announcement-token-row">
                    <span className={getTypeTone(formState.type)}>{previewType.label}</span>
                    <span className="announcement-audience-token">{previewAudience}</span>
                    <span className="announcement-time-token">Just now</span>
                  </div>
                  {formState.linkUrl.trim() ? (
                    <a className="announcement-card__link" href={formState.linkUrl.trim()} rel="noreferrer" target="_blank">
                      {formState.linkLabel.trim() || 'Open link'}
                    </a>
                  ) : null}
                </div>
              </article>
            </div>
          </section>
        </div>
      ) : (
        <section className="announcement-panel announcement-history-panel">
          <header className="announcement-panel__header announcement-panel__header--row">
            <div>
              <span className="eyebrow">History</span>
              <h2>Sent Announcements</h2>
            </div>
            <div className="announcement-history-tools">
              <button className="announcement-row-button" disabled={filteredItems.length === 0} onClick={toggleAllFilteredAnnouncements} type="button">
                {filteredItems.length > 0 && filteredItems.every((item) => selectedAnnouncementIds.includes(item.id)) ? 'Clear' : 'Select'}
              </button>
              <button className="announcement-row-button announcement-row-button--danger" disabled={selectedAnnouncementIds.length === 0 || bulkArchiveAnnouncements.isPending} onClick={handleBulkArchive} type="button">
                {bulkArchiveAnnouncements.isPending ? 'Archiving...' : `Archive ${selectedAnnouncementIds.length || ''}`}
              </button>
              <label className="sr-only" htmlFor="announcement-history-filter">
                Filter announcements
              </label>
              <select id="announcement-history-filter" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as HistoryFilter)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                {notificationTypes.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <div className="announcement-history-list">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const itemType = getAnnouncementType(item);
                const HistoryIcon = getTypeIcon(itemType);
                const rowBusy = statusActionId === item.id;
                return (
                  <article className="announcement-history-row" key={item.id}>
                    <div className="announcement-history-row__select">
                      <input checked={selectedAnnouncementIds.includes(item.id)} onChange={() => toggleSelectedAnnouncement(item.id)} type="checkbox" aria-label={`Select ${item.title}`} />
                      <div className={getTypeIconBackground(itemType)}>
                        {itemType === 'custom' && item.customEmoji ? <span>{item.customEmoji}</span> : <HistoryIcon size={24} />}
                      </div>
                    </div>
                    <div className="announcement-history-row__content">
                      <h3>
                        {item.pinned ? <span aria-hidden="true">📌</span> : null}
                        {item.title}
                      </h3>
                      <div className="announcement-token-row">
                        <span className={getTypeTone(itemType)}>{formatLabel(itemType)}</span>
                        <span className={item.status === 'active' ? 'announcement-state-token announcement-state-token--active' : 'announcement-state-token'}>
                          {getStatusToken(item)}
                        </span>
                      </div>
                      <div className="announcement-history-row__meta">
                        <span>→ {getAnnouncementAudienceLabel(item)}</span>
                        <time>{formatDate(item.startDate ?? item.updatedAt)}</time>
                      </div>
                      {item.linkUrl ? (
                        <a className="announcement-card__link" href={item.linkUrl} rel="noreferrer" target="_blank">
                          {item.linkLabel || 'Open link'}
                        </a>
                      ) : null}
                      <p>Edited by {item.updatedBy || item.createdBy || 'admin'}</p>
                    </div>
                    <div className="announcement-history-row__actions">
                      <button className="announcement-row-button" onClick={() => handleEdit(item)} type="button">
                        Edit
                      </button>
                      <button className="announcement-row-button" onClick={() => handleDuplicate(item)} type="button">
                        Duplicate
                      </button>
                      <select
                        disabled={rowBusy}
                        value={item.status}
                        onChange={(event) => handleStatusChange(item, event.target.value as AdminAnnouncementStatus)}
                        aria-label={`Status for ${item.title}`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <button
                        className={item.status === 'inactive' ? 'announcement-row-button' : 'announcement-row-button announcement-row-button--danger'}
                        disabled={rowBusy}
                        onClick={() => (item.status === 'inactive' ? handleStatusChange(item, 'active') : handleArchive(item))}
                        type="button"
                      >
                        {rowBusy ? 'Saving...' : item.status === 'inactive' ? 'Reactivate' : 'Archive'}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
