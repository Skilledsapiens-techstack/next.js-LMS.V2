import { FileText, MonitorPlay, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminCohort, AdminCohortStatus, useAdminCohorts, useCreateAdminCohort, useUpdateAdminCohort, useUpdateAdminCohortStatus } from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';
import type { AdminProgram } from '../features/admin/useAdminPrograms';

type ProgramFilter = 'all' | string;
type SortMode = 'name' | 'students_desc' | 'students_asc' | 'start_newest' | 'start_oldest' | 'program';
type CohortProgramOption = Pick<AdminProgram, 'domainLabel' | 'name' | 'programKey' | 'shortName'>;
type SelfPacedSessionDraft = { duration: string; id: string; title: string; url: string };
type SelfPacedResourceDraft = { id: string; name: string; type: string; url: string };
type CohortFormState = {
  cohortId: string;
  endDate: string;
  googleGroup: string;
  name: string;
  startDate: string;
  status: AdminCohortStatus;
  studentCount: string;
  waGroupName: string;
  waLink: string;
};

const statusOptions: Array<AdminCohortStatus | 'all'> = ['all', 'upcoming', 'active', 'completed', 'inactive'];

const sortOptions: Array<{ label: string; value: SortMode }> = [
  { label: 'Sort: Cohort Name', value: 'name' },
  { label: 'Sort: Students (High to Low)', value: 'students_desc' },
  { label: 'Sort: Students (Low to High)', value: 'students_asc' },
  { label: 'Sort: Start Date (Newest)', value: 'start_newest' },
  { label: 'Sort: Start Date (Oldest)', value: 'start_oldest' },
  { label: 'Sort: Program / Domain', value: 'program' }
];

const programLabels: Record<string, string> = {
  consulting: 'Consulting',
  finance_er: 'Finance ER',
  finance_qf: 'Finance QF',
  flp_er: 'Finance ER',
  flp_qf: 'Finance QF',
  gd_pi: 'GD-PI',
  hr: 'HR',
  hrlp: 'HR',
  hr_projects: 'HR Projects',
  live_er: 'ER Projects',
  live_hr: 'HR Projects',
  live_mgmt: 'Mgmt Projects',
  live_pevc: 'PEVC Projects',
  live_qf: 'QF Projects',
  management_projects: 'Mgmt Projects',
  mclp: 'Consulting',
  placement: 'Placement',
  pmlp: 'Product',
  product: 'Product',
  sales_marketing: 'Sales & Marketing',
  smlp: 'Sales & Marketing'
};

const programOptions: Array<[string, string]> = [
  ['consulting', 'Consulting'],
  ['sales_marketing', 'Sales & Marketing'],
  ['hr', 'HR'],
  ['finance_er', 'Finance ER'],
  ['finance_qf', 'Finance QF'],
  ['gd_pi', 'GD-PI'],
  ['product', 'Product'],
  ['placement', 'Placement'],
  ['management_projects', 'Mgmt Projects'],
  ['hr_projects', 'HR Projects']
];

const cohortProgramTemplates: CohortProgramOption[] = [
  { domainLabel: 'Consulting', name: 'Management Consulting Leadership Program', programKey: 'mclp', shortName: 'MCLP' },
  { domainLabel: 'Sales & Marketing', name: 'Sales & Marketing Leadership Program', programKey: 'smlp', shortName: 'SMLP' },
  { domainLabel: 'HR', name: 'HR Leadership Program', programKey: 'hrlp', shortName: 'HRLP' },
  { domainLabel: 'Finance ER', name: 'Finance Leadership Program - ER', programKey: 'flp_er', shortName: 'FLP ER' },
  { domainLabel: 'Finance QF', name: 'Finance Leadership Program - QF', programKey: 'flp_qf', shortName: 'FLP QF' },
  { domainLabel: 'Product', name: 'Product Management Leadership Program', programKey: 'pmlp', shortName: 'PMLP' },
  { domainLabel: 'Mgmt Projects', name: 'Live Projects - Management Tracks', programKey: 'live_mgmt', shortName: 'Mgmt Projects' },
  { domainLabel: 'HR Projects', name: 'Live Projects - HR Track', programKey: 'live_hr', shortName: 'HR Projects' },
  { domainLabel: 'ER Projects', name: 'Live Projects - ER Track', programKey: 'live_er', shortName: 'ER Projects' },
  { domainLabel: 'QF Projects', name: 'Live Projects - QF Track', programKey: 'live_qf', shortName: 'QF Projects' },
  { domainLabel: 'PEVC Projects', name: 'Live Projects - PEVC Track', programKey: 'live_pevc', shortName: 'PEVC Projects' },
  { domainLabel: 'Placement', name: 'Placement Mentorship Program', programKey: 'placement', shortName: 'Placement' },
  { domainLabel: 'GD-PI', name: 'GD-PI Mentorship Program', programKey: 'gd_pi', shortName: 'GD-PI' }
];

function mergeCohortProgramOptions(programs: AdminProgram[] | undefined): CohortProgramOption[] {
  const templateKeys = new Set(cohortProgramTemplates.map((program) => program.programKey));
  const merged = new Map<string, CohortProgramOption>();

  cohortProgramTemplates.forEach((program) => merged.set(program.programKey, program));
  programs?.forEach((program) => {
    if (!program.programKey) return;
    const fallback = merged.get(program.programKey);
    merged.set(program.programKey, {
      domainLabel: program.domainLabel ?? fallback?.domainLabel,
      name: program.name || fallback?.name || program.programKey,
      programKey: program.programKey,
      shortName: program.shortName ?? fallback?.shortName
    });
  });

  return [
    ...cohortProgramTemplates.map((program) => merged.get(program.programKey)).filter((program): program is CohortProgramOption => Boolean(program)),
    ...Array.from(merged.values()).filter((program) => !templateKeys.has(program.programKey))
  ];
}

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseStatus(value: string | null): AdminCohortStatus | 'all' {
  return statusOptions.includes(value as AdminCohortStatus | 'all') ? (value as AdminCohortStatus | 'all') : 'all';
}

function parseSort(value: string | null): SortMode {
  return sortOptions.some((option) => option.value === value) ? (value as SortMode) : 'name';
}

function formatDate(value: string | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function formatWindow(item: AdminCohort) {
  const start = formatDate(item.startDate);
  const end = formatDate(item.endDate);
  return end === '-' ? start : `${start} -> ${end}`;
}

function normalizeKey(value: string | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

function programLabel(item: AdminCohort) {
  const key = normalizeKey(item.domainKey || item.programKey);
  if (!key) return 'General';
  return programLabels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function buildPageLink(page: number, search: string, status: AdminCohortStatus | 'all', program: ProgramFilter, sort: SortMode) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (program !== 'all') params.set('program', program);
  if (sort !== 'name') params.set('sort', sort);
  return `?${params.toString()}`;
}

function createSelfPacedSessionDraft(): SelfPacedSessionDraft {
  return { duration: '', id: `session-${Date.now()}-${Math.random()}`, title: '', url: '' };
}

function createSelfPacedResourceDraft(): SelfPacedResourceDraft {
  return { id: `resource-${Date.now()}-${Math.random()}`, name: '', type: 'PDF', url: '' };
}

function textFromRecord(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const field = record[key];
  return typeof field === 'string' || typeof field === 'number' ? String(field) : '';
}

function sessionDraftsFromCohort(cohort: AdminCohort | null): SelfPacedSessionDraft[] {
  const sessions =
    cohort?.selfPacedSessions.map((session, index) => ({
      duration: textFromRecord(session, 'durationMinutes') || textFromRecord(session, 'duration'),
      id: `session-${cohort.id}-${index}`,
      title: textFromRecord(session, 'title'),
      url: textFromRecord(session, 'url')
    })) ?? [];

  return sessions.length > 0 ? sessions : [createSelfPacedSessionDraft()];
}

function resourceDraftsFromCohort(cohort: AdminCohort | null): SelfPacedResourceDraft[] {
  const resources =
    cohort?.selfPacedResources.map((resource, index) => ({
      id: `resource-${cohort.id}-${index}`,
      name: textFromRecord(resource, 'name') || textFromRecord(resource, 'title'),
      type: textFromRecord(resource, 'type') || 'PDF',
      url: textFromRecord(resource, 'url')
    })) ?? [];

  return resources.length > 0 ? resources : [createSelfPacedResourceDraft()];
}

function formFromCohort(cohort: AdminCohort | null): CohortFormState {
  return {
    cohortId: cohort?.cohortId ?? '',
    endDate: cohort?.endDate ?? '',
    googleGroup: cohort?.googleGroup ?? '',
    name: cohort?.name ?? '',
    startDate: cohort?.startDate ?? '',
    status: cohort?.status ?? 'active',
    studentCount: String(cohort?.studentCount ?? 0),
    waGroupName: cohort?.waGroupName ?? '',
    waLink: cohort?.waLink ?? ''
  };
}

function CohortModal({
  cohort,
  onClose,
  onSaved,
  programOptions
}: {
  cohort: AdminCohort | null;
  onClose: () => void;
  onSaved: () => void;
  programOptions: CohortProgramOption[];
}) {
  const fallbackProgram = cohortProgramTemplates[0];
  const isEditing = Boolean(cohort);
  const [selectedProgramKey, setSelectedProgramKey] = useState(cohort?.programKey ?? programOptions[0]?.programKey ?? fallbackProgram.programKey);
  const [form, setForm] = useState<CohortFormState>(() => formFromCohort(cohort));
  const [selfPacedEnabled, setSelfPacedEnabled] = useState(cohort?.selfPaced ?? false);
  const [selfPacedSessions, setSelfPacedSessions] = useState<SelfPacedSessionDraft[]>(() => sessionDraftsFromCohort(cohort));
  const [selfPacedResources, setSelfPacedResources] = useState<SelfPacedResourceDraft[]>(() => resourceDraftsFromCohort(cohort));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createCohort = useCreateAdminCohort();
  const updateCohort = useUpdateAdminCohort();
  const selectedProgram = programOptions.find((program) => program.programKey === selectedProgramKey) ?? programOptions[0] ?? fallbackProgram;
  const isSaving = createCohort.isPending || updateCohort.isPending;

  function updateForm(field: keyof CohortFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSession(id: string, updates: Partial<SelfPacedSessionDraft>) {
    setSelfPacedSessions((sessions) => sessions.map((session) => (session.id === id ? { ...session, ...updates } : session)));
  }

  function updateResource(id: string, updates: Partial<SelfPacedResourceDraft>) {
    setSelfPacedResources((resources) => resources.map((resource) => (resource.id === id ? { ...resource, ...updates } : resource)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const name = form.name.trim();
    if (!name) {
      setSubmitError('Cohort name is required.');
      return;
    }

    const studentCount = Number.parseInt(form.studentCount, 10);
    const selfPacedSessionsPayload = selfPacedEnabled
      ? selfPacedSessions
          .map((session) => ({
            durationMinutes: Number.parseInt(session.duration, 10) || undefined,
            title: session.title.trim(),
            url: session.url.trim()
          }))
          .filter((session) => session.title && session.url)
      : [];
    const selfPacedResourcesPayload = selfPacedEnabled
      ? selfPacedResources
          .map((resource) => ({
            name: resource.name.trim(),
            type: resource.type,
            url: resource.url.trim()
          }))
          .filter((resource) => resource.name && resource.url)
      : [];

    try {
      const payload = {
        cohortId: form.cohortId.trim() || undefined,
        domainKey: selectedProgram.programKey,
        endDate: form.endDate || undefined,
        googleGroup: form.googleGroup.trim() || undefined,
        name,
        programKey: selectedProgram.programKey,
        selfPaced: selfPacedEnabled,
        selfPacedResources: selfPacedResourcesPayload,
        selfPacedSessions: selfPacedSessionsPayload,
        startDate: form.startDate || undefined,
        status: form.status,
        studentCount: Number.isFinite(studentCount) && studentCount > 0 ? studentCount : 0,
        waGroupName: form.waGroupName.trim() || undefined,
        waLink: form.waLink.trim() || undefined
      };

      if (cohort) {
        await updateCohort.mutateAsync({ body: payload, cohortId: cohort.id });
      } else {
        await createCohort.mutateAsync(payload);
      }
      onSaved();
      onClose();
    } catch {
      setSubmitError('Cohort could not be saved. Confirm cohort writes are enabled and try again.');
    }
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="cohort-modal-title" aria-modal="true" className="student-modal cohort-modal" role="dialog">
        <header className="student-modal__header">
          <h2 id="cohort-modal-title">{isEditing ? 'Edit Cohort' : 'Add New Cohort'}</h2>
          <button aria-label="Close cohort form" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </header>
        <div className="student-modal__body">
          <form className="cohort-form-shell" id="cohort-save-form" onSubmit={handleSubmit}>
            <label>
              <span>Cohort ID</span>
              <input value={form.cohortId} onChange={(event) => updateForm('cohortId', event.target.value)} placeholder="Auto if blank" type="text" />
            </label>
            <label>
              <span>Cohort Name</span>
              <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="e.g. MCLP-2026-JUL-1" type="text" />
            </label>
            <label>
              <span>Program Type</span>
              <select value={selectedProgram.programKey} onChange={(event) => setSelectedProgramKey(event.target.value)}>
                {programOptions.map((program) => (
                  <option key={program.programKey} value={program.programKey}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value as AdminCohortStatus)}>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              <span>Start Date</span>
              <input value={form.startDate} onChange={(event) => updateForm('startDate', event.target.value)} type="date" />
            </label>
            <label>
              <span>End Date</span>
              <input value={form.endDate} onChange={(event) => updateForm('endDate', event.target.value)} type="date" />
            </label>
            <label>
              <span>Students</span>
              <input value={form.studentCount} min="0" onChange={(event) => updateForm('studentCount', event.target.value)} type="number" />
            </label>
            <label>
              <span>WA Link</span>
              <input value={form.waLink} onChange={(event) => updateForm('waLink', event.target.value)} placeholder="https://..." type="url" />
            </label>
            <label>
              <span>WA Group Name</span>
              <input value={form.waGroupName} onChange={(event) => updateForm('waGroupName', event.target.value)} placeholder="e.g. WA_1" type="text" />
            </label>
            <label>
              <span>Google Groups</span>
              <input value={form.googleGroup} onChange={(event) => updateForm('googleGroup', event.target.value)} placeholder="group@googlegroups.com" type="email" />
            </label>
            <label>
              <span>Program Key</span>
              <input readOnly type="text" value={selectedProgram.programKey} />
            </label>
            <div className={selfPacedEnabled ? 'cohort-delivery-mode cohort-delivery-mode--enabled' : 'cohort-delivery-mode'}>
              <div>
                <span className="cohort-form-label">Cohort Delivery Mode</span>
                <strong>Self-paced mode (recordings + PDF resources only)</strong>
                <p>Enable for cohorts with no live sessions. Students get recording links and PDF downloads.</p>
              </div>
              <label className="cohort-switch">
                <span className="sr-only">Enable self-paced mode</span>
                <input checked={selfPacedEnabled} onChange={(event) => setSelfPacedEnabled(event.target.checked)} type="checkbox" />
                <span aria-hidden="true" className="cohort-toggle" />
              </label>
            </div>
            {selfPacedEnabled ? (
              <div className="cohort-self-paced-fields">
                <section className="cohort-self-paced-panel" aria-labelledby="cohort-recording-sessions-title">
                  <h3 id="cohort-recording-sessions-title">
                    <MonitorPlay size={15} />
                    Recording Sessions
                  </h3>
                  <p>Add each pre-recorded session. Students will see these in their dashboard with a direct link to watch.</p>
                  <div className="cohort-self-paced-list">
                    {selfPacedSessions.map((session) => (
                      <div className="cohort-self-paced-row cohort-self-paced-row--session" key={session.id}>
                        <input aria-label="Session title" value={session.title} onChange={(event) => updateSession(session.id, { title: event.target.value })} placeholder="Session title e.g. Intro to DCF" type="text" />
                        <input aria-label="Recording URL" value={session.url} onChange={(event) => updateSession(session.id, { url: event.target.value })} placeholder="Recording URL" type="url" />
                        <input aria-label="Duration in minutes" value={session.duration} onChange={(event) => updateSession(session.id, { duration: event.target.value })} placeholder="Duration" type="number" />
                        <button
                          aria-label="Remove recording session"
                          className="cohort-row-remove"
                          onClick={() => setSelfPacedSessions((sessions) => (sessions.length > 1 ? sessions.filter((item) => item.id !== session.id) : [createSelfPacedSessionDraft()]))}
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="cohort-add-row-button" onClick={() => setSelfPacedSessions((sessions) => [...sessions, createSelfPacedSessionDraft()])} type="button">
                    <Plus size={15} />
                    Add Session
                  </button>
                </section>
                <section className="cohort-self-paced-panel" aria-labelledby="cohort-pdf-resources-title">
                  <h3 id="cohort-pdf-resources-title">
                    <FileText size={15} />
                    PDF Resources
                  </h3>
                  <p>Add PDF/document resources for this cohort. Students can download them from their dashboard.</p>
                  <div className="cohort-self-paced-list">
                    {selfPacedResources.map((resource) => (
                      <div className="cohort-self-paced-row cohort-self-paced-row--resource" key={resource.id}>
                        <input aria-label="Resource name" value={resource.name} onChange={(event) => updateResource(resource.id, { name: event.target.value })} placeholder="Resource name" type="text" />
                        <input aria-label="Resource URL" value={resource.url} onChange={(event) => updateResource(resource.id, { url: event.target.value })} placeholder="Google Drive / URL link" type="url" />
                        <select aria-label="Resource type" value={resource.type} onChange={(event) => updateResource(resource.id, { type: event.target.value })}>
                          <option value="PDF">PDF</option>
                          <option value="XLSX">XLSX</option>
                          <option value="PPTX">PPTX</option>
                          <option value="DOC">DOC</option>
                          <option value="LINK">LINK</option>
                        </select>
                        <button
                          aria-label="Remove resource"
                          className="cohort-row-remove"
                          onClick={() => setSelfPacedResources((resources) => (resources.length > 1 ? resources.filter((item) => item.id !== resource.id) : [createSelfPacedResourceDraft()]))}
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="cohort-add-row-button" onClick={() => setSelfPacedResources((resources) => [...resources, createSelfPacedResourceDraft()])} type="button">
                    <Plus size={15} />
                    Add Resource
                  </button>
                </section>
              </div>
            ) : null}
          </form>
        </div>
        <footer className="student-modal__footer">
          {submitError ? <p className="cohort-submit-error">{submitError}</p> : null}
          <button className="segmented-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="segmented-button segmented-button--active" disabled={isSaving} form="cohort-save-form" type="submit">
            {isSaving ? 'Saving...' : 'Save Cohort'}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function AdminCohortsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const sort = parseSort(searchParams.get('sort'));
  const program = searchParams.get('program')?.trim() || 'all';
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCohort, setEditingCohort] = useState<AdminCohort | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const cohortsQuery = useAdminCohorts({ limit: 30, page, program: program === 'all' ? undefined : program, search, sort, status });
  const programsQuery = useAdminPrograms({ limit: 100, status: 'active' });
  const updateCohortStatus = useUpdateAdminCohortStatus();
  const cohortProgramOptions = useMemo(() => mergeCohortProgramOptions(programsQuery.data?.items), [programsQuery.data?.items]);
  const data = cohortsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const visibleCohorts = data?.items ?? [];

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParams({ search: searchInput.trim() || undefined });
  }

  async function handleStatusChange(cohort: AdminCohort, nextStatus: AdminCohortStatus) {
    const verb = nextStatus === 'inactive' ? 'deactivate' : 'reactivate';
    const confirmed = window.confirm(`Are you sure you want to ${verb} ${cohort.name}?`);
    if (!confirmed) return;

    setActionError(null);
    try {
      await updateCohortStatus.mutateAsync({ cohortId: cohort.id, status: nextStatus });
      await cohortsQuery.refetch();
    } catch {
      setActionError('Cohort status could not be updated. Confirm cohort writes are enabled and try again.');
    }
  }

  if (cohortsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading cohort operations list." eyebrow="Module refresh" title="Cohorts" />
        <LoadingState />
      </div>
    );
  }

  if (cohortsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Cohorts could not be loaded right now." eyebrow="Module refresh" title="Cohorts unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        actions={
          <button className="segmented-button" disabled={cohortsQuery.isFetching} onClick={() => void cohortsQuery.refetch()} type="button">
            <RefreshCw size={16} />
            Refresh Cohorts
          </button>
        }
        description="Refresh only cohorts data from the database."
        eyebrow="Module refresh"
        title="Cohorts"
      />

      <section className="cohort-toolbar" aria-label="Cohort admin tools">
        <form className="filter-search filter-search--form cohort-search" onSubmit={handleSearch}>
          <Search size={18} />
          <label className="sr-only" htmlFor="admin-cohort-search">
            Search cohorts
          </label>
          <input id="admin-cohort-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search cohorts..." type="search" />
        </form>
        <select aria-label="Filter by program" className="admin-student-select" value={program} onChange={(event) => updateParams({ program: event.target.value === 'all' ? undefined : event.target.value })}>
          <option value="all">All Programs</option>
          {programOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Sort cohorts" className="admin-student-select" value={sort} onChange={(event) => updateParams({ sort: event.target.value === 'name' ? undefined : event.target.value })}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="segmented-button segmented-button--gold" onClick={() => setShowAddModal(true)} type="button">
          <Plus size={16} />
          New Cohort
        </button>
      </section>

      {actionError ? <p className="cohort-submit-error">{actionError}</p> : null}

      {visibleCohorts.length > 0 ? (
        <section className="cohort-card-grid" aria-label="Cohort records">
          {visibleCohorts.map((cohort) => (
            <article className="cohort-card" key={cohort.id}>
              <div className="cohort-card__top" />
              <div className="cohort-card__head">
                <div>
                  <h2>{cohort.name}</h2>
                  <p>{formatWindow(cohort)}</p>
                </div>
                <div className="cohort-card__badges">
                  {cohort.selfPaced ? <StatusBadge>self-paced</StatusBadge> : null}
                  <StatusBadge tone={cohort.status === 'active' ? 'safe' : 'warning'}>{formatOption(cohort.status)}</StatusBadge>
                </div>
              </div>
              <div className="cohort-card__stats">
                <div>
                  <strong>{cohort.studentCount}</strong>
                  <span>Students</span>
                </div>
                <div>
                  <strong>{cohort.programKey ? 1 : 0}</strong>
                  <span>Programs</span>
                </div>
                <div>
                  <strong>{cohort.selfPacedSessions.length}</strong>
                  <span>Sessions</span>
                </div>
              </div>
              <div className="cohort-card__meta">
                <StatusBadge tone="warning">{programLabel(cohort)}</StatusBadge>
                <span>
                  <MonitorPlay size={14} />
                  {cohort.selfPacedSessions.length} sessions
                </span>
                <span>
                  <FileText size={14} />
                  {cohort.selfPacedResources.length} resources
                </span>
              </div>
              <div className="cohort-card__actions">
                <button className="segmented-button" onClick={() => setEditingCohort(cohort)} type="button">
                  Edit
                </button>
                <Link className="segmented-button" to={`/admin/students?cohortName=${encodeURIComponent(cohort.name)}`}>
                  <Users size={14} />
                  Students
                </Link>
                {cohort.selfPaced ? (
                  <button className="segmented-button" disabled type="button">
                    Preview
                  </button>
                ) : null}
                <button
                  className={cohort.status === 'inactive' ? 'segmented-button' : 'segmented-button segmented-button--danger'}
                  disabled={updateCohortStatus.isPending}
                  onClick={() => void handleStatusChange(cohort, cohort.status === 'inactive' ? 'active' : 'inactive')}
                  type="button"
                >
                  {cohort.status === 'inactive' ? 'Reactivate' : 'Deactivate'}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin cohort pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, status, program, sort)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, status, program, sort)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {showAddModal ? <CohortModal cohort={null} onClose={() => setShowAddModal(false)} onSaved={() => void cohortsQuery.refetch()} programOptions={cohortProgramOptions} /> : null}
      {editingCohort ? <CohortModal cohort={editingCohort} onClose={() => setEditingCohort(null)} onSaved={() => void cohortsQuery.refetch()} programOptions={cohortProgramOptions} /> : null}
    </div>
  );
}
