import { Bell, Briefcase, CalendarDays, Folder, List, Pin, TriangleAlert } from 'lucide-react';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { AdminAnnouncement, AdminAnnouncementPriority, AdminAnnouncementStatus, useAdminAnnouncements } from '../features/admin/useAdminAnnouncements';
import { useAdminCohorts } from '../features/admin/useAdminCohorts';

type NotificationType = 'general' | 'alert' | 'session' | 'resource' | 'project' | 'custom';
type AudienceMode = 'all' | 'cohort' | 'program';
type HistoryFilter = 'all' | AdminAnnouncementStatus | NotificationType;

type AnnouncementFormState = {
  audienceMode: AudienceMode;
  customEmoji: string;
  endDate: string;
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

type ProgramTemplate = {
  name: string;
  programKey: string;
  shortName: string;
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

const programTemplates: ProgramTemplate[] = [
  { name: 'Management Consulting Leadership Program', programKey: 'mclp', shortName: 'MCLP' },
  { name: 'Sales & Marketing Leadership Program', programKey: 'smlp', shortName: 'SMLP' },
  { name: 'HR Leadership Program', programKey: 'hrlp', shortName: 'HRLP' },
  { name: 'Finance Leadership Program - ER', programKey: 'flp_er', shortName: 'FLP ER' },
  { name: 'Finance Leadership Program - QF', programKey: 'flp_qf', shortName: 'FLP QF' },
  { name: 'Product Management Leadership Program', programKey: 'pmlp', shortName: 'PMLP' },
  { name: 'Live Projects - Management Tracks', programKey: 'live_mgmt', shortName: 'Mgmt Projects' },
  { name: 'Live Projects - HR Track', programKey: 'live_hr', shortName: 'HR Projects' },
  { name: 'Live Projects - ER Track', programKey: 'live_er', shortName: 'ER Projects' },
  { name: 'Live Projects - QF Track', programKey: 'live_qf', shortName: 'QF Projects' },
  { name: 'Live Projects - PEVC Track', programKey: 'live_pevc', shortName: 'PEVC Projects' },
  { name: 'Placement Mentorship Program', programKey: 'placement', shortName: 'Placement' },
  { name: 'GD-PI Mentorship Program', programKey: 'gd_pi', shortName: 'GD-PI' }
];

const initialFormState: AnnouncementFormState = {
  audienceMode: 'all',
  customEmoji: '',
  endDate: '',
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

export function AdminAnnouncementsPage() {
  const [page] = useState(1);
  const [formState, setFormState] = useState<AnnouncementFormState>(initialFormState);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const announcementsQuery = useAdminAnnouncements({ limit: 50, page });
  const cohortsQuery = useAdminCohorts({ limit: 100, page: 1, sort: 'name', status: 'all' });
  const data = announcementsQuery.data;
  const items = data?.items ?? [];
  const cohorts = cohortsQuery.data?.items ?? [];
  const lastRefresh = formatDateTime(data?.items[0]?.updatedAt);

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
    return programTemplates.filter((program) => selected.has(program.programKey)).map((program) => program.name);
  }, [formState.audienceMode, formState.selectedProgramKeys]);
  const previewAudience = getAudienceLabel(formState.audienceMode, formState.selectedAudience, selectedCohortNames.length, selectedProgramNames.length);

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
    const selectedProgramKeys = programTemplates.map((program) => program.programKey);
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
    setFormState({
      audienceMode,
      customEmoji: getAnnouncementType(item) === 'custom' ? item.type ?? '' : '',
      endDate: toDateInputValue(item.endDate),
      message: item.message,
      pinned: item.pinned,
      priority: item.priority,
      selectedAudience,
      selectedCohortIds: audienceMode === 'cohort' ? cohorts.filter((cohort) => cohortNameSet.has(cohort.name.toLowerCase())).map((cohort) => cohort.id) : [],
      selectedProgramKeys: audienceMode === 'program' ? programTemplates.filter((program) => programKeySet.has(program.programKey)).map((program) => program.programKey) : [],
      startDate: toDateInputValue(item.startDate),
      status: item.status,
      title: item.title,
      type: getAnnouncementType(item)
    });
  }

  function handleDisabledSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      <div className="announcement-centre-grid">
        <section className="announcement-panel announcement-compose-panel">
          <header className="announcement-panel__header">
            <span className="eyebrow">Notification Centre</span>
            <h2>Send Notification</h2>
          </header>

          <form className="announcement-form" onSubmit={handleDisabledSubmit}>
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
                  {cohortsQuery.isLoading ? (
                    <p>Loading cohorts.</p>
                  ) : cohortsQuery.isError ? (
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
                  {programTemplates.map((program) => (
                    <label key={program.programKey}>
                      <input checked={formState.selectedProgramKeys.includes(program.programKey)} onChange={() => toggleProgram(program.programKey)} type="checkbox" />
                      <span>{program.name}</span>
                      <strong>{program.shortName}</strong>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className="announcement-target-preview">
              Target preview: 129 active students ·{' '}
              {formState.audienceMode === 'cohort' && selectedCohortNames.length > 0
                ? selectedCohortNames.join(', ')
                : formState.audienceMode === 'program' && selectedProgramNames.length > 0
                  ? selectedProgramNames.join(', ')
                  : previewAudience}
            </div>

            <label className="announcement-field">
              <span>Priority</span>
              <select value={formState.priority} onChange={(event) => updateForm('priority', event.target.value as AdminAnnouncementPriority)}>
                <option value="normal">Normal</option>
                <option value="important">Important</option>
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
              <textarea placeholder="Full notification message..." value={formState.message} onChange={(event) => updateForm('message', event.target.value)} />
            </label>

            <label className="announcement-pin-control announcement-field--wide">
              <input checked={formState.pinned} onChange={(event) => updateForm('pinned', event.target.checked)} type="checkbox" />
              <span>
                <Pin size={17} /> Pin this notification (shows at top)
              </span>
            </label>

            <div className="announcement-form-actions announcement-field--wide">
              <button className="announcement-secondary-button" type="button">
                Preview
              </button>
              <button className="announcement-send-button" disabled type="submit">
                {editingAnnouncementId ? 'Update Notification' : 'Send Notification'}
              </button>
            </div>
          </form>
        </section>

        <div className="announcement-side-stack">
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
                  <p>{previewMessage}</p>
                  <div className="announcement-token-row">
                    <span className={getTypeTone(formState.type)}>{previewType.label}</span>
                    <span className="announcement-audience-token">{previewAudience}</span>
                    <span className="announcement-time-token">Just now</span>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="announcement-panel announcement-history-panel">
            <header className="announcement-panel__header announcement-panel__header--row">
              <div>
                <span className="eyebrow">History</span>
                <h2>Sent Announcements</h2>
              </div>
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
            </header>

            <div className="announcement-history-list">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const itemType = getAnnouncementType(item);
                  return (
                    <article className="announcement-history-row" key={item.id}>
                      <div className={getTypeIconBackground(itemType)}>
                        <span>{item.type === 'custom' ? item.type : 'null'}</span>
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
                        <p>Edited by hr1.skilledsapiens@gmail.com</p>
                      </div>
                      <div className="announcement-history-row__actions">
                        <button className="announcement-row-button" onClick={() => handleEdit(item)} type="button">
                          Edit
                        </button>
                        <select disabled value={item.status} aria-label={`Status for ${item.title}`}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                        <button aria-disabled="true" className="announcement-row-button announcement-row-button--danger" type="button">
                          {item.status === 'inactive' ? 'Deleted' : 'Delete'}
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
        </div>
      </div>
    </div>
  );
}
