import { Download, FileText, Link2, Mail, MonitorPlay, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminCohort,
  AdminCohortImpact,
  AdminCohortStatus,
  useAdminCohortImpact,
  useAdminCohorts,
  useCreateAdminCohort,
  useExportAdminCohorts,
  useUpdateAdminCohort,
  useUpdateAdminCohortStatus
} from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';
import { AdminStudent, useAdminStudents, useUpdateAdminStudent } from '../features/admin/useAdminStudents';
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
type PendingStatusChange = {
  cohort: AdminCohort;
  nextStatus: AdminCohortStatus;
};
type PendingBulkStatusChange = {
  count: number;
  nextStatus: AdminCohortStatus;
};
type CohortPreviewTab = 'overview' | 'students' | 'studentView' | 'links' | 'selfPaced' | 'audit';

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

function formatDateTime(value: string | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  }).format(date);
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

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function csvEscape(value: unknown) {
  const raw = value === undefined || value === null ? '' : String(value);
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function isFailureMessage(message: string) {
  return /could not|failed|error|unable/i.test(message);
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

function countFilledRecords(items: unknown[], keys: string[]) {
  return items.filter((item) => keys.some((key) => textFromRecord(item, key))).length;
}

function itemUrl(item: unknown) {
  return textFromRecord(item, 'url') || textFromRecord(item, 'link');
}

function itemTitle(item: unknown, fallback: string) {
  return textFromRecord(item, 'title') || textFromRecord(item, 'name') || fallback;
}

function formatAuditAction(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function studentCohortNames(student: AdminStudent) {
  return Array.from(
    new Set([
      ...(student.cohortNames ?? []),
      ...(student.cohorts ?? []).map((cohort) => cohort.cohortName),
      student.cohortName
    ].map((name) => String(name ?? '').trim()).filter(Boolean))
  );
}

function studentProgramKeys(student: AdminStudent) {
  return Array.from(new Set([...(student.programKeys ?? []), ...(student.trackRoleIds ?? [])].map((key) => String(key ?? '').trim()).filter(Boolean)));
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
  onSaved: (message: string) => void;
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
  const normalizedName = form.name.trim().toLowerCase();
  const normalizedCohortId = form.cohortId.trim().toLowerCase();
  const nameDuplicateQuery = useAdminCohorts({ enabled: Boolean(normalizedName), limit: 10, page: 1, search: form.name.trim(), status: 'all' });
  const idDuplicateQuery = useAdminCohorts({ enabled: Boolean(normalizedCohortId), limit: 10, page: 1, search: form.cohortId.trim(), status: 'all' });
  const duplicateName = (nameDuplicateQuery.data?.items ?? []).find((item) => item.id !== cohort?.id && item.name.trim().toLowerCase() === normalizedName);
  const duplicateCohortId = (idDuplicateQuery.data?.items ?? []).find((item) => item.id !== cohort?.id && String(item.cohortId ?? '').trim().toLowerCase() === normalizedCohortId);
  const duplicateMessage = duplicateName
    ? `A cohort named "${duplicateName.name}" already exists.`
    : duplicateCohortId
      ? `Cohort ID "${duplicateCohortId.cohortId}" is already used by ${duplicateCohortId.name}.`
      : null;

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

    if (duplicateMessage) {
      setSubmitError(duplicateMessage);
      return;
    }

    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setSubmitError('End date cannot be before the start date.');
      return;
    }

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
        studentCount: cohort?.studentCount ?? 0,
        waGroupName: form.waGroupName.trim() || undefined,
        waLink: form.waLink.trim() || undefined
      };

      if (cohort) {
        await updateCohort.mutateAsync({ body: payload, cohortId: cohort.id });
      } else {
        await createCohort.mutateAsync(payload);
      }
      onSaved(cohort ? 'Cohort updated successfully.' : 'Cohort created successfully.');
      onClose();
    } catch (error) {
      setSubmitError(readableError(error, 'Cohort could not be saved. Confirm cohort writes are enabled and try again.'));
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
              {duplicateCohortId ? <small className="cohort-field-warning">{`Already used by ${duplicateCohortId.name}.`}</small> : null}
            </label>
            <label>
              <span>Cohort Name</span>
              <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="e.g. MCLP-2026-JUL-1" type="text" />
              {duplicateName ? <small className="cohort-field-warning">A cohort with this name already exists.</small> : null}
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
              <input aria-describedby="cohort-student-count-help" readOnly type="text" value={form.studentCount} />
              <small id="cohort-student-count-help" className="cohort-field-help">
                Calculated from student assignments. Manage membership from the Students module.
              </small>
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
          <button className="segmented-button segmented-button--active" disabled={isSaving || Boolean(duplicateMessage)} form="cohort-save-form" type="submit">
            {isSaving ? 'Saving...' : duplicateMessage ? 'Fix Duplicate' : 'Save Cohort'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function CohortPreviewModal({
  cohort,
  impact,
  isImpactLoading,
  onClose,
  onMembershipChanged
}: {
  cohort: AdminCohort;
  impact?: AdminCohortImpact;
  isImpactLoading: boolean;
  onClose: () => void;
  onMembershipChanged: (message: string) => void;
}) {
  const sessionCount = countFilledRecords(cohort.selfPacedSessions, ['title', 'url']);
  const resourceCount = countFilledRecords(cohort.selfPacedResources, ['name', 'title', 'url']);
  const studentLink = `/admin/students?cohortName=${encodeURIComponent(cohort.name)}`;
  const [activeTab, setActiveTab] = useState<CohortPreviewTab>('overview');
  const [assignedPage, setAssignedPage] = useState(1);
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('');
  const [pendingRemovalStudent, setPendingRemovalStudent] = useState<AdminStudent | null>(null);
  const trimmedStudentSearch = debouncedStudentSearch.trim();
  const shouldSearchStudents = activeTab === 'students' && trimmedStudentSearch.length >= 2;
  const assignedStudentsQuery = useAdminStudents({ cohortName: cohort.name, enabled: activeTab === 'students', limit: 12, page: assignedPage, status: 'all' });
  const searchStudentsQuery = useAdminStudents({ enabled: shouldSearchStudents, limit: 8, page: 1, search: trimmedStudentSearch, status: 'all' });
  const updateStudent = useUpdateAdminStudent();
  const assignedStudents = assignedStudentsQuery.data?.items ?? [];
  const searchableStudents = (searchStudentsQuery.data?.items ?? []).filter((student) => !studentCohortNames(student).includes(cohort.name));
  const isMembershipSaving = updateStudent.isPending;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedStudentSearch(studentSearch.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [studentSearch]);

  useEffect(() => {
    setAssignedPage(1);
    setPendingRemovalStudent(null);
  }, [cohort.id]);

  async function addStudentToCohort(student: AdminStudent) {
    try {
      await updateStudent.mutateAsync({
        body: {
          assignmentMode: 'add',
          cohortIds: [cohort.id],
          cohortNames: [cohort.name],
          email: student.email,
          fullName: student.fullName,
          programKeys: cohort.programKey ? [cohort.programKey] : undefined
        },
        studentId: student.id
      });
      await assignedStudentsQuery.refetch();
      if (shouldSearchStudents) await searchStudentsQuery.refetch();
      onMembershipChanged(`${student.fullName} added to ${cohort.name}.`);
    } catch (error) {
      onMembershipChanged(readableError(error, 'Student could not be added to this cohort.'));
    }
  }

  async function removeStudentFromCohort(student: AdminStudent) {
    const nextCohortNames = studentCohortNames(student).filter((name) => name !== cohort.name);
    try {
      await updateStudent.mutateAsync({
        body: {
          assignmentMode: 'replace',
          cohortNames: nextCohortNames,
          email: student.email,
          fullName: student.fullName,
          programKeys: studentProgramKeys(student)
        },
        studentId: student.id
      });
      await assignedStudentsQuery.refetch();
      if (shouldSearchStudents) await searchStudentsQuery.refetch();
      setPendingRemovalStudent(null);
      onMembershipChanged(`${student.fullName} removed from ${cohort.name}.`);
    } catch (error) {
      onMembershipChanged(readableError(error, 'Student could not be removed from this cohort.'));
    }
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="cohort-preview-title" aria-modal="true" className="student-modal cohort-preview-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <p className="cohort-preview-eyebrow">Cohort Details</p>
            <h2 id="cohort-preview-title">{cohort.name}</h2>
          </div>
          <button aria-label="Close cohort preview" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </header>
        <div className="student-modal__body cohort-preview-body">
          <div className="cohort-preview-summary">
            <div>
              <span>Status</span>
              <strong>{formatOption(cohort.status)}</strong>
            </div>
            <div>
              <span>Students</span>
              <strong>{cohort.studentCount}</strong>
            </div>
            <div>
              <span>Program</span>
              <strong>{programLabel(cohort)}</strong>
            </div>
            <div>
              <span>Window</span>
              <strong>{formatWindow(cohort)}</strong>
            </div>
          </div>

          <div className="cohort-preview-tabs" role="tablist" aria-label="Cohort detail sections">
            {[
              ['overview', 'Overview'],
              ['students', 'Students'],
              ['studentView', 'Student View'],
              ['links', 'Linked LMS Data'],
              ['selfPaced', 'Self-paced'],
              ['audit', 'Audit']
            ].map(([tab, label]) => (
              <button aria-selected={activeTab === tab} className={activeTab === tab ? 'cohort-preview-tab cohort-preview-tab--active' : 'cohort-preview-tab'} key={tab} onClick={() => setActiveTab(tab as CohortPreviewTab)} role="tab" type="button">
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' ? (
            <section className="cohort-preview-section">
              <h3>Operational Details</h3>
              <dl className="cohort-preview-details">
                <div>
                  <dt>Cohort ID</dt>
                  <dd>{cohort.cohortId || cohort.id}</dd>
                </div>
                <div>
                  <dt>Program key</dt>
                  <dd>{cohort.programKey || '-'}</dd>
                </div>
                <div>
                  <dt>WhatsApp group</dt>
                  <dd>{cohort.waGroupName || '-'}</dd>
                </div>
                <div>
                  <dt>Google group</dt>
                  <dd>{cohort.googleGroup || '-'}</dd>
                </div>
              </dl>
              <div className="cohort-preview-links">
                {cohort.waLink ? (
                  <a className="segmented-button" href={cohort.waLink} rel="noreferrer" target="_blank">
                    <Link2 size={14} />
                    Open WA Link
                  </a>
                ) : null}
                {cohort.googleGroup ? (
                  <a className="segmented-button" href={`mailto:${cohort.googleGroup}`}>
                    <Mail size={14} />
                    Mail Group
                  </a>
                ) : null}
                <Link className="segmented-button segmented-button--gold" to={studentLink}>
                  <Users size={14} />
                  Full Students View
                </Link>
              </div>
            </section>
          ) : null}

          {activeTab === 'links' ? (
          <section className="cohort-preview-section">
            <h3>Linked LMS data</h3>
            <div className="cohort-impact-grid" aria-busy={isImpactLoading}>
              <div>
                <span>Students</span>
                <strong>{isImpactLoading ? '...' : impact?.students ?? cohort.studentCount}</strong>
              </div>
              <div>
                <span>Workshops</span>
                <strong>{isImpactLoading ? '...' : impact?.workshops ?? 0}</strong>
              </div>
              <div>
                <span>Resources</span>
                <strong>{isImpactLoading ? '...' : impact?.resources ?? 0}</strong>
              </div>
              <div>
                <span>Announcements</span>
                <strong>{isImpactLoading ? '...' : impact?.announcements ?? 0}</strong>
              </div>
            </div>
          </section>
          ) : null}

          {activeTab === 'students' ? (
          <section className="cohort-preview-section">
            <div className="cohort-membership-header">
              <div>
                <h3>Student membership</h3>
                <p>Manage students for this cohort only. Student profiles and other cohort assignments are preserved.</p>
              </div>
              <Link className="segmented-button" to={studentLink}>
                <Users size={14} />
                Full Students View
              </Link>
            </div>
            <div className="cohort-membership-grid">
              <div className="cohort-membership-panel">
                <strong>Assigned students</strong>
                {pendingRemovalStudent ? (
                  <div className="cohort-removal-confirm" role="alert">
                    <div>
                      <strong>Remove from this cohort?</strong>
                      <span>
                        {pendingRemovalStudent.fullName} will be removed from {cohort.name}. Their profile and other cohort/program access will stay unchanged.
                      </span>
                    </div>
                    <div>
                      <button className="segmented-button" disabled={isMembershipSaving} onClick={() => setPendingRemovalStudent(null)} type="button">
                        Cancel
                      </button>
                      <button className="segmented-button segmented-button--danger" disabled={isMembershipSaving} onClick={() => void removeStudentFromCohort(pendingRemovalStudent)} type="button">
                        {isMembershipSaving ? 'Removing...' : 'Confirm Remove'}
                      </button>
                    </div>
                  </div>
                ) : null}
                {assignedStudentsQuery.isFetching ? <p className="cohort-preview-muted">Loading assigned students...</p> : null}
                {assignedStudents.length ? (
                  <div className="cohort-student-list">
                    {assignedStudents.map((student) => (
                      <div className="cohort-student-row" key={student.id}>
                        <div>
                          <strong>{student.fullName}</strong>
                          <span>{student.email}</span>
                        </div>
                        <button className="segmented-button segmented-button--danger" disabled={isMembershipSaving} onClick={() => setPendingRemovalStudent(student)} type="button">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : assignedStudentsQuery.isFetching ? null : (
                  <p className="cohort-preview-muted">No students assigned to this cohort yet.</p>
                )}
                <div className="cohort-member-pagination">
                  <button className="segmented-button" disabled={!assignedStudentsQuery.data?.hasPreviousPage || assignedStudentsQuery.isFetching} onClick={() => setAssignedPage((current) => Math.max(1, current - 1))} type="button">
                    Previous
                  </button>
                  <span>
                    Page {assignedPage}
                    {assignedStudentsQuery.data?.total ? ` · ${assignedStudentsQuery.data.total} total` : ''}
                  </span>
                  <button className="segmented-button" disabled={!assignedStudentsQuery.data?.hasNextPage || assignedStudentsQuery.isFetching} onClick={() => setAssignedPage((current) => current + 1)} type="button">
                    Next
                  </button>
                </div>
              </div>
              <div className="cohort-membership-panel">
                <label className="cohort-member-search">
                  <span>Add existing student</span>
                  <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search by name, email, or student ID" type="search" />
                </label>
                {studentSearch.trim().length > 0 && studentSearch.trim().length < 2 ? <p className="cohort-preview-muted">Type at least 2 characters to search.</p> : null}
                {shouldSearchStudents && searchStudentsQuery.isFetching ? <p className="cohort-preview-muted">Searching students...</p> : null}
                {shouldSearchStudents && searchableStudents.length ? (
                  <div className="cohort-student-list">
                    {searchableStudents.map((student) => (
                      <div className="cohort-student-row" key={student.id}>
                        <div>
                          <strong>{student.fullName}</strong>
                          <span>{student.email}</span>
                        </div>
                        <button className="segmented-button segmented-button--success" disabled={isMembershipSaving} onClick={() => void addStudentToCohort(student)} type="button">
                          {isMembershipSaving ? 'Saving...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : searchStudentsQuery.isFetching ? null : (
                  <p className="cohort-preview-muted">{shouldSearchStudents ? 'No available matching students found.' : 'Search is idle until 2 characters.'}</p>
                )}
              </div>
            </div>
          </section>
          ) : null}

          {activeTab === 'studentView' ? (
          <section className="cohort-preview-section">
            <h3>Student-facing view</h3>
            <div className="cohort-student-facing">
              <div className="cohort-student-facing__hero">
                <div>
                  <span>Student portal card</span>
                  <strong>{cohort.name}</strong>
                  <p>
                    {cohort.status === 'inactive'
                      ? 'Inactive cohorts are hidden from normal student learning views.'
                      : `${programLabel(cohort)} students see this cohort with the mapped sessions, recordings, resources, and projects available to their account.`}
                  </p>
                </div>
                <StatusBadge tone={cohort.status === 'active' ? 'safe' : 'warning'}>{formatOption(cohort.status)}</StatusBadge>
              </div>
              <div className="cohort-student-facing__grid">
                <div>
                  <span>Program</span>
                  <strong>{programLabel(cohort)}</strong>
                </div>
                <div>
                  <span>Learning mode</span>
                  <strong>{cohort.selfPaced ? 'Self-paced' : 'Live cohort'}</strong>
                </div>
                <div>
                  <span>Window</span>
                  <strong>{formatWindow(cohort)}</strong>
                </div>
                <div>
                  <span>Students</span>
                  <strong>{cohort.studentCount}</strong>
                </div>
              </div>
              <div className="cohort-student-facing__content">
                <div>
                  <strong>Self-paced sessions</strong>
                  {cohort.selfPacedSessions.length ? (
                    <ul>
                      {cohort.selfPacedSessions.slice(0, 4).map((session, index) => (
                        <li key={`${itemTitle(session, `Session ${index + 1}`)}-${index}`}>{itemTitle(session, `Session ${index + 1}`)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No self-paced sessions attached.</p>
                  )}
                </div>
                <div>
                  <strong>Self-paced resources</strong>
                  {cohort.selfPacedResources.length ? (
                    <ul>
                      {cohort.selfPacedResources.slice(0, 4).map((resource, index) => (
                        <li key={`${itemTitle(resource, `Resource ${index + 1}`)}-${index}`}>{itemTitle(resource, `Resource ${index + 1}`)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No self-paced resources attached.</p>
                  )}
                </div>
              </div>
              <div className="cohort-student-facing__links">
                <div>
                  <span>WhatsApp group</span>
                  <strong>{cohort.waGroupName || 'Not configured'}</strong>
                </div>
                <div>
                  <span>Google group</span>
                  <strong>{cohort.googleGroup || 'Not configured'}</strong>
                </div>
              </div>
            </div>
          </section>
          ) : null}

          {activeTab === 'selfPaced' ? (
          <section className="cohort-preview-section">
            <h3>Self-paced content</h3>
            <div className="cohort-preview-content-grid">
              <div>
                <strong>{sessionCount} sessions</strong>
                <ul>
                  {cohort.selfPacedSessions.slice(0, 5).map((session, index) => {
                    const url = itemUrl(session);
                    const title = itemTitle(session, `Session ${index + 1}`);
                    return (
                      <li key={`${title}-${index}`}>
                        {url ? (
                          <a href={url} rel="noreferrer" target="_blank">
                            {title}
                          </a>
                        ) : (
                          <span>{title}</span>
                        )}
                      </li>
                    );
                  })}
                  {cohort.selfPacedSessions.length === 0 ? <li>No sessions added.</li> : null}
                </ul>
              </div>
              <div>
                <strong>{resourceCount} resources</strong>
                <ul>
                  {cohort.selfPacedResources.slice(0, 5).map((resource, index) => {
                    const url = itemUrl(resource);
                    const title = itemTitle(resource, `Resource ${index + 1}`);
                    return (
                      <li key={`${title}-${index}`}>
                        {url ? (
                          <a href={url} rel="noreferrer" target="_blank">
                            {title}
                          </a>
                        ) : (
                          <span>{title}</span>
                        )}
                      </li>
                    );
                  })}
                  {cohort.selfPacedResources.length === 0 ? <li>No resources added.</li> : null}
                </ul>
              </div>
            </div>
          </section>
          ) : null}

          {activeTab === 'audit' ? (
          <section className="cohort-preview-section">
            <h3>Recent activity</h3>
            {isImpactLoading ? (
              <p className="cohort-preview-muted">Loading recent cohort activity...</p>
            ) : impact?.auditLogs.length ? (
              <div className="cohort-audit-list">
                {impact.auditLogs.map((entry) => (
                  <div key={entry.id}>
                    <strong>{formatAuditAction(entry.action)}</strong>
                    <span>
                      {entry.actorEmail || 'System'} · {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="cohort-preview-muted">No recent cohort actions found.</p>
            )}
          </section>
          ) : null}
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button segmented-button--active" onClick={onClose} type="button">
            Done
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
  const [previewCohort, setPreviewCohort] = useState<AdminCohort | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);
  const [pendingBulkStatusChange, setPendingBulkStatusChange] = useState<PendingBulkStatusChange | null>(null);
  const [selectedCohortIds, setSelectedCohortIds] = useState<Set<string>>(() => new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const selectedImpactCohort = previewCohort ?? pendingStatusChange?.cohort ?? null;
  const cohortImpactQuery = useAdminCohortImpact(selectedImpactCohort);
  const cohortsQuery = useAdminCohorts({ limit: 30, page, program: program === 'all' ? undefined : program, search, sort, status });
  const programsQuery = useAdminPrograms({ limit: 100, status: 'active' });
  const updateCohortStatus = useUpdateAdminCohortStatus();
  const exportCohorts = useExportAdminCohorts();
  const cohortProgramOptions = useMemo(() => mergeCohortProgramOptions(programsQuery.data?.items), [programsQuery.data?.items]);
  const data = cohortsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const visibleCohorts = data?.items ?? [];
  const selectedCohorts = useMemo(() => visibleCohorts.filter((cohort) => selectedCohortIds.has(cohort.id)), [selectedCohortIds, visibleCohorts]);
  const allVisibleSelected = visibleCohorts.length > 0 && visibleCohorts.every((cohort) => selectedCohortIds.has(cohort.id));
  const isBulkBusy = updateCohortStatus.isPending;
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setSelectedCohortIds(new Set());
  }, [page, program, search, sort, status]);

  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return undefined;

    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParamsKey);
      next.set('page', '1');
      if (nextSearch) next.set('search', nextSearch);
      else next.delete('search');
      setSearchParams(next, { replace: true });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search, searchInput, searchParamsKey, setSearchParams]);

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  }

  function toggleCohortSelection(cohortId: string, selected: boolean) {
    setSelectedCohortIds((current) => {
      const next = new Set(current);
      if (selected) next.add(cohortId);
      else next.delete(cohortId);
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedCohortIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleCohorts.forEach((cohort) => next.delete(cohort.id));
      } else {
        visibleCohorts.forEach((cohort) => next.add(cohort.id));
      }
      return next;
    });
  }

  function downloadCohortsCsv(cohorts: AdminCohort[], fileName: string) {
    if (!cohorts.length) return;
    const headers = ['cohortId', 'name', 'status', 'programKey', 'domainKey', 'startDate', 'endDate', 'studentCount', 'selfPaced', 'sessions', 'resources', 'waGroupName', 'waLink', 'googleGroup', 'updatedAt'];
    const lines = [
      headers.join(','),
      ...cohorts.map((cohort) =>
        [
          cohort.cohortId || cohort.id,
          cohort.name,
          cohort.status,
          cohort.programKey,
          cohort.domainKey,
          cohort.startDate,
          cohort.endDate,
          cohort.studentCount,
          cohort.selfPaced,
          cohort.selfPacedSessions.length,
          cohort.selfPacedResources.length,
          cohort.waGroupName,
          cohort.waLink,
          cohort.googleGroup,
          cohort.updatedAt
        ]
          .map(csvEscape)
          .join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 0);
  }

  async function handleExportFiltered() {
    try {
      const result = await exportCohorts.mutateAsync({ program: program === 'all' ? undefined : program, search, sort, status });
      downloadCohortsCsv(result.items, `cohorts-filtered-${new Date().toISOString().slice(0, 10)}.csv`);
      setActionMessage(`Exported ${result.items.length} filtered cohorts.`);
    } catch (error) {
      setActionMessage(readableError(error, 'Filtered cohort export failed.'));
    }
  }

  function handleExportSelected() {
    if (!selectedCohorts.length) return;
    downloadCohortsCsv(selectedCohorts, `cohorts-selected-${new Date().toISOString().slice(0, 10)}.csv`);
    setActionMessage(`Exported ${selectedCohorts.length} selected cohorts.`);
  }

  async function confirmBulkStatusChange() {
    if (!pendingBulkStatusChange || !selectedCohorts.length) return;
    setActionMessage(null);
    try {
      await Promise.all(selectedCohorts.map((cohort) => updateCohortStatus.mutateAsync({ cohortId: cohort.id, status: pendingBulkStatusChange.nextStatus })));
      setActionMessage(`Updated ${selectedCohorts.length} cohorts to ${formatOption(pendingBulkStatusChange.nextStatus)}.`);
      setPendingBulkStatusChange(null);
      setSelectedCohortIds(new Set());
      await cohortsQuery.refetch();
    } catch (error) {
      setActionMessage(readableError(error, 'Bulk cohort status update failed.'));
    }
  }

  async function confirmStatusChange() {
    if (!pendingStatusChange) return;
    setActionMessage(null);
    try {
      await updateCohortStatus.mutateAsync({ cohortId: pendingStatusChange.cohort.id, status: pendingStatusChange.nextStatus });
      setActionMessage(pendingStatusChange.nextStatus === 'inactive' ? 'Cohort deactivated successfully.' : 'Cohort reactivated successfully.');
      setPendingStatusChange(null);
      await cohortsQuery.refetch();
    } catch (error) {
      setActionMessage(readableError(error, 'Cohort status could not be updated. Confirm cohort writes are enabled and try again.'));
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
    <div className="page-stack admin-cohorts-page">
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
        <form className="filter-search filter-search--form cohort-search" onSubmit={(event) => event.preventDefault()}>
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

      <section className="cohort-bulkbar" aria-label="Cohort bulk actions">
        <div>
          <label className="cohort-selection-control">
            <input checked={allVisibleSelected} disabled={!visibleCohorts.length} onChange={toggleVisibleSelection} type="checkbox" />
            <span>{allVisibleSelected ? 'Unselect page' : 'Select page'}</span>
          </label>
          <strong>{selectedCohorts.length} selected</strong>
        </div>
        <div>
          <button className="segmented-button" disabled={exportCohorts.isPending} onClick={() => void handleExportFiltered()} type="button">
            <Download size={15} />
            {exportCohorts.isPending ? 'Exporting...' : 'Export Filtered'}
          </button>
          <button className="segmented-button" disabled={!selectedCohorts.length} onClick={handleExportSelected} type="button">
            <Download size={15} />
            Export Selected
          </button>
          <button className="segmented-button segmented-button--success" disabled={!selectedCohorts.length || isBulkBusy} onClick={() => setPendingBulkStatusChange({ count: selectedCohorts.length, nextStatus: 'active' })} type="button">
            Mark Active
          </button>
          <button className="segmented-button" disabled={!selectedCohorts.length || isBulkBusy} onClick={() => setPendingBulkStatusChange({ count: selectedCohorts.length, nextStatus: 'completed' })} type="button">
            Mark Completed
          </button>
          <button className="segmented-button segmented-button--danger" disabled={!selectedCohorts.length || isBulkBusy} onClick={() => setPendingBulkStatusChange({ count: selectedCohorts.length, nextStatus: 'inactive' })} type="button">
            Deactivate Selected
          </button>
        </div>
      </section>

      {actionMessage ? (
        <div className={isFailureMessage(actionMessage) ? 'admin-student-toast admin-student-toast--error' : 'admin-student-toast'} role="status">
          <strong>{isFailureMessage(actionMessage) ? 'Action failed' : 'Saved'}</strong>
          <span>{actionMessage}</span>
          <button aria-label="Dismiss message" onClick={() => setActionMessage(null)} type="button">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {visibleCohorts.length > 0 ? (
        <section className="cohort-card-grid" aria-label="Cohort records">
          {visibleCohorts.map((cohort) => (
            <article className="cohort-card" key={cohort.id}>
              <label className="cohort-card__select">
                <input checked={selectedCohortIds.has(cohort.id)} onChange={(event) => toggleCohortSelection(cohort.id, event.target.checked)} type="checkbox" />
                <span>Select cohort</span>
              </label>
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
                <button className="segmented-button" onClick={() => setPreviewCohort(cohort)} type="button">
                  Details
                </button>
                <button
                  className={cohort.status === 'inactive' ? 'segmented-button' : 'segmented-button segmented-button--danger'}
                  disabled={updateCohortStatus.isPending}
                  onClick={() => setPendingStatusChange({ cohort, nextStatus: cohort.status === 'inactive' ? 'active' : 'inactive' })}
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

      {showAddModal ? (
        <CohortModal
          cohort={null}
          onClose={() => setShowAddModal(false)}
          onSaved={(message) => {
            setActionMessage(message);
            void cohortsQuery.refetch();
          }}
          programOptions={cohortProgramOptions}
        />
      ) : null}
      {editingCohort ? (
        <CohortModal
          cohort={editingCohort}
          onClose={() => setEditingCohort(null)}
          onSaved={(message) => {
            setActionMessage(message);
            void cohortsQuery.refetch();
          }}
          programOptions={cohortProgramOptions}
        />
      ) : null}
      {previewCohort ? (
        <CohortPreviewModal
          cohort={previewCohort}
          impact={cohortImpactQuery.data}
          isImpactLoading={cohortImpactQuery.isFetching}
          onClose={() => setPreviewCohort(null)}
          onMembershipChanged={(message) => {
            setActionMessage(message);
            void cohortImpactQuery.refetch();
            void cohortsQuery.refetch();
          }}
        />
      ) : null}
      {pendingStatusChange ? (
        <div className="student-modal-backdrop" role="presentation">
          <section aria-labelledby="cohort-status-title" aria-modal="true" className="student-modal" role="dialog">
            <header className="student-modal__header">
              <h2 id="cohort-status-title">{pendingStatusChange.nextStatus === 'inactive' ? 'Deactivate Cohort' : 'Reactivate Cohort'}</h2>
              <button aria-label="Close status confirmation" className="student-modal__icon-button" onClick={() => setPendingStatusChange(null)} type="button">
                <X size={24} />
              </button>
            </header>
            <div className="student-modal__body">
              <p>
                Confirm status change for <strong>{pendingStatusChange.cohort.name}</strong>.
              </p>
              {pendingStatusChange.nextStatus === 'inactive' ? (
                <div className="cohort-dependency-warning" role="note">
                  <strong>Before deactivation</strong>
                  <ul>
                    <li>{cohortImpactQuery.isFetching ? 'Checking' : cohortImpactQuery.data?.students ?? pendingStatusChange.cohort.studentCount} students are currently linked to this cohort.</li>
                    <li>{cohortImpactQuery.isFetching ? 'Checking' : cohortImpactQuery.data?.workshops ?? 0} workshops are tagged to this cohort.</li>
                    <li>{cohortImpactQuery.isFetching ? 'Checking' : cohortImpactQuery.data?.resources ?? 0} resources are tagged to this cohort.</li>
                    <li>{cohortImpactQuery.isFetching ? 'Checking' : cohortImpactQuery.data?.announcements ?? 0} cohort announcements are tagged here.</li>
                    <li>{pendingStatusChange.cohort.selfPacedSessions.length} self-paced sessions and {pendingStatusChange.cohort.selfPacedResources.length} self-paced resources are attached directly.</li>
                    <li>Inactive cohorts are hidden from new assignment lists and student-facing eligible content checks.</li>
                  </ul>
                </div>
              ) : null}
            </div>
            <footer className="student-modal__footer">
              <button className="segmented-button" onClick={() => setPendingStatusChange(null)} type="button">
                Cancel
              </button>
              <button className="segmented-button segmented-button--active" disabled={updateCohortStatus.isPending} onClick={() => void confirmStatusChange()} type="button">
                {updateCohortStatus.isPending ? 'Saving...' : 'Confirm'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {pendingBulkStatusChange ? (
        <div className="student-modal-backdrop" role="presentation">
          <section aria-labelledby="cohort-bulk-status-title" aria-modal="true" className="student-modal" role="dialog">
            <header className="student-modal__header">
              <h2 id="cohort-bulk-status-title">Update Selected Cohorts</h2>
              <button aria-label="Close bulk status confirmation" className="student-modal__icon-button" onClick={() => setPendingBulkStatusChange(null)} type="button">
                <X size={24} />
              </button>
            </header>
            <div className="student-modal__body">
              <p>
                Confirm changing <strong>{pendingBulkStatusChange.count}</strong> selected cohorts to <strong>{formatOption(pendingBulkStatusChange.nextStatus)}</strong>.
              </p>
              {pendingBulkStatusChange.nextStatus === 'inactive' ? (
                <div className="cohort-dependency-warning" role="note">
                  <strong>Bulk deactivation warning</strong>
                  <ul>
                    <li>Student-facing eligible content checks may hide content tied only to inactive cohorts.</li>
                    <li>Use Details on a cohort first if you need detailed dependency counts before changing status.</li>
                    <li>This action updates selected cohorts only on the current page.</li>
                  </ul>
                </div>
              ) : null}
            </div>
            <footer className="student-modal__footer">
              <button className="segmented-button" onClick={() => setPendingBulkStatusChange(null)} type="button">
                Cancel
              </button>
              <button className="segmented-button segmented-button--active" disabled={isBulkBusy} onClick={() => void confirmBulkStatusChange()} type="button">
                {isBulkBusy ? 'Saving...' : 'Confirm'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
