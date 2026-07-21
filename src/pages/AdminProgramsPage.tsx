import { Ban, BookOpen, Bold, Eye, Italic, Layers3, Link as LinkIcon, List, Pencil, Plus, RefreshCw, Save, Search, ShieldCheck, Underline, X } from 'lucide-react';
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { ProjectRichText } from '../components/ProjectRichText';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminProgram,
  AdminProgramImpact,
  AdminProgramStatus,
  AdminProgramWritePayload,
  AdminStudentGuidanceContent,
  AdminStudentGuidanceContentStatus,
  useAdminProgramImpact,
  useAdminPrograms,
  useAdminStudentGuidanceContent,
  useCreateAdminProgram,
  useUpdateAdminStudentGuidanceContent,
  useUpdateAdminProgram,
  useUpdateAdminProgramStatus
} from '../features/admin/useAdminPrograms';

const statusOptions: Array<AdminProgramStatus | 'all'> = ['all', 'active', 'inactive'];

type ProgramTemplate = {
  domainLabel: string;
  name: string;
  programKey: string;
  shortName: string;
};

type ProgramFormState = {
  domainLabel: string;
  name: string;
  programKey: string;
  shortName: string;
  status: AdminProgramStatus;
};

type PendingStatusChange = {
  nextStatus: AdminProgramStatus;
  program: AdminProgram;
};

const programTemplates: ProgramTemplate[] = [
  { domainLabel: 'Consulting', name: 'Management Consulting Leadership Program', programKey: 'mclp', shortName: 'MCLP' },
  { domainLabel: 'Sales & Marketing', name: 'Sales & Marketing Leadership Program', programKey: 'smlp', shortName: 'SMLP' },
  { domainLabel: 'HR', name: 'HR Leadership Program', programKey: 'hrlp', shortName: 'HRLP' },
  { domainLabel: 'Finance ER', name: 'Finance Leadership Program - ER', programKey: 'flp_er', shortName: 'FLP ER' },
  { domainLabel: 'Finance QF', name: 'Finance Leadership Program - QF', programKey: 'flp_qf', shortName: 'FLP QF' },
  { domainLabel: 'Product', name: 'Product Management Leadership Program', programKey: 'pmlp', shortName: 'PMLP' },
  { domainLabel: 'GD-PI', name: 'GD-PI Mentorship Program', programKey: 'gd_pi', shortName: 'GD-PI' },
  { domainLabel: 'Mgmt Projects', name: 'Live Projects - Management Tracks', programKey: 'live_mgmt', shortName: 'Mgmt Projects' },
  { domainLabel: 'HR Projects', name: 'Live Projects - HR Track', programKey: 'live_hr', shortName: 'HR Projects' },
  { domainLabel: 'ER Projects', name: 'Live Projects - ER Track', programKey: 'live_er', shortName: 'ER Projects' },
  { domainLabel: 'QF Projects', name: 'Live Projects - QF Track', programKey: 'live_qf', shortName: 'QF Projects' },
  { domainLabel: 'PEVC Projects', name: 'Live Projects - PEVC Track', programKey: 'live_pevc', shortName: 'PEVC Projects' },
  { domainLabel: 'Placement', name: 'Placement Mentorship Program', programKey: 'placement', shortName: 'Placement' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseStatus(value: string | null): AdminProgramStatus | 'all' {
  return statusOptions.includes(value as AdminProgramStatus | 'all') ? (value as AdminProgramStatus | 'all') : 'all';
}

function formatDate(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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

function formatAuditAction(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeProgramKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function buildPageLink(page: number, search: string, status: AdminProgramStatus | 'all', domain: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (domain) params.set('domain', domain);
  return `?${params.toString()}`;
}

function formFromProgram(program: AdminProgram | null): ProgramFormState {
  const template = programTemplates[0];
  return {
    domainLabel: program?.domainLabel ?? template.domainLabel,
    name: program?.name ?? template.name,
    programKey: program?.programKey ?? template.programKey,
    shortName: program?.shortName ?? template.shortName,
    status: program?.status ?? 'active'
  };
}

function ProgramModal({
  existingPrograms,
  mode,
  onClose,
  onSaved,
  program
}: {
  existingPrograms: AdminProgram[];
  mode: 'add' | 'edit';
  onClose: () => void;
  onSaved: (message: string) => void;
  program?: AdminProgram;
}) {
  const [form, setForm] = useState<ProgramFormState>(() => formFromProgram(program ?? null));
  const [submitError, setSubmitError] = useState('');
  const createProgram = useCreateAdminProgram();
  const updateProgram = useUpdateAdminProgram();
  const isSaving = createProgram.isPending || updateProgram.isPending;
  const normalizedKey = normalizeProgramKey(form.programKey);
  const duplicateProgram = existingPrograms.find((item) => item.id !== program?.id && item.programKey.trim().toLowerCase() === normalizedKey);

  function updateForm(field: keyof ProgramFormState, value: string) {
    setSubmitError('');
    setForm((current) => ({
      ...current,
      [field]: field === 'programKey' ? normalizeProgramKey(value) : value
    }));
  }

  function applyTemplate(programKey: string) {
    const template = programTemplates.find((item) => item.programKey === programKey);
    if (!template) return;
    setSubmitError('');
    setForm((current) => ({
      ...current,
      domainLabel: template.domainLabel,
      name: template.name,
      programKey: template.programKey,
      shortName: template.shortName
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: AdminProgramWritePayload = {
      domainLabel: form.domainLabel.trim(),
      name: form.name.trim(),
      programKey: normalizedKey,
      shortName: form.shortName.trim(),
      status: form.status
    };

    if (!payload.name) {
      setSubmitError('Program name is required.');
      return;
    }
    if (mode === 'add' && !payload.programKey) {
      setSubmitError('Program key is required.');
      return;
    }
    if (duplicateProgram) {
      setSubmitError(`Program key "${payload.programKey}" is already used by ${duplicateProgram.name}.`);
      return;
    }

    try {
      if (mode === 'edit' && program) {
        await updateProgram.mutateAsync({
          body: {
            domainLabel: payload.domainLabel,
            name: payload.name,
            shortName: payload.shortName,
            status: payload.status
          },
          programId: program.id
        });
      } else {
        await createProgram.mutateAsync(payload);
      }
      onSaved(mode === 'add' ? 'Program created successfully.' : 'Program updated successfully.');
      onClose();
    } catch (error) {
      setSubmitError(readableError(error, 'Program could not be saved.'));
    }
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="program-modal-title" aria-modal="true" className="student-modal program-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <p className="program-modal-eyebrow">Program master</p>
            <h2 id="program-modal-title">{mode === 'add' ? 'Add Program' : 'Edit Program'}</h2>
          </div>
          <button aria-label="Close program form" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={22} />
          </button>
        </header>
        <div className="student-modal__body">
          {submitError ? <div className="auth-alert auth-alert--error">{submitError}</div> : null}
          <form className="program-form-shell" id="program-save-form" onSubmit={(event) => void handleSubmit(event)}>
            {mode === 'add' ? (
              <label className="program-form-shell__wide">
                <span>Start from template</span>
                <select value={programTemplates.some((template) => template.programKey === form.programKey) ? form.programKey : ''} onChange={(event) => applyTemplate(event.target.value)}>
                  {programTemplates.map((template) => (
                    <option key={template.programKey} value={template.programKey}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>Program name</span>
              <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="e.g. Management Consulting Leadership Program" />
            </label>
            <label>
              <span>Short name</span>
              <input value={form.shortName} onChange={(event) => updateForm('shortName', event.target.value)} placeholder="e.g. MCLP" />
            </label>
            <label>
              <span>Program key</span>
              <input readOnly={mode === 'edit'} value={form.programKey} onChange={(event) => updateForm('programKey', event.target.value)} placeholder="e.g. mclp" />
              {mode === 'edit' ? <small>Locked after creation to protect student and content mappings.</small> : null}
              {duplicateProgram ? <small className="program-field-warning">Already used by {duplicateProgram.name}.</small> : null}
            </label>
            <label>
              <span>Domain</span>
              <input value={form.domainLabel} onChange={(event) => updateForm('domainLabel', event.target.value)} placeholder="e.g. Consulting" />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value as AdminProgramStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </form>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="segmented-button segmented-button--active" disabled={isSaving || Boolean(duplicateProgram)} form="program-save-form" type="submit">
            {isSaving ? 'Saving...' : mode === 'add' ? 'Save Program' : 'Update Program'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ProgramDetailsModal({
  impact,
  isImpactLoading,
  onClose,
  onEdit,
  program
}: {
  impact?: AdminProgramImpact;
  isImpactLoading: boolean;
  onClose: () => void;
  onEdit: () => void;
  program: AdminProgram;
}) {
  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="program-details-title" aria-modal="true" className="student-modal program-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <p className="program-modal-eyebrow">Program details</p>
            <h2 id="program-details-title">{program.name}</h2>
          </div>
          <button aria-label="Close program details" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={22} />
          </button>
        </header>
        <div className="student-modal__body program-details-body">
          <div className="program-detail-summary">
            <div>
              <span>Status</span>
              <strong>{program.status}</strong>
            </div>
            <div>
              <span>Program key</span>
              <strong>{program.programKey}</strong>
            </div>
            <div>
              <span>Short name</span>
              <strong>{program.shortName ?? '-'}</strong>
            </div>
            <div>
              <span>Domain</span>
              <strong>{program.domainLabel ?? '-'}</strong>
            </div>
          </div>
          <section className="program-impact-section">
            <h3>Linked LMS data</h3>
            <div className="program-impact-grid" aria-busy={isImpactLoading}>
              <div>
                <span>Cohorts</span>
                <strong>{isImpactLoading ? '...' : impact?.cohorts ?? 0}</strong>
              </div>
              <div>
                <span>Students</span>
                <strong>{isImpactLoading ? '...' : impact?.students ?? 0}</strong>
              </div>
              <div>
                <span>Resources</span>
                <strong>{isImpactLoading ? '...' : impact?.resources ?? 0}</strong>
              </div>
              <div>
                <span>Workshops</span>
                <strong>{isImpactLoading ? '...' : impact?.workshops ?? 0}</strong>
              </div>
            </div>
          </section>
          <section className="program-impact-section">
            <h3>Recent activity</h3>
            {isImpactLoading ? (
              <p className="program-muted">Loading recent program activity...</p>
            ) : impact?.auditLogs.length ? (
              <div className="program-audit-list">
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
              <p className="program-muted">No recent program actions found.</p>
            )}
          </section>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Close
          </button>
          <button className="segmented-button segmented-button--active" onClick={onEdit} type="button">
            <Pencil size={14} />
            Edit Program
          </button>
        </footer>
      </section>
    </div>
  );
}

function ProgramStatusModal({
  impact,
  isImpactLoading,
  isSaving,
  onClose,
  onConfirm,
  pending
}: {
  impact?: AdminProgramImpact;
  isImpactLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: PendingStatusChange;
}) {
  const isDeactivating = pending.nextStatus === 'inactive';
  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="program-status-title" aria-modal="true" className="student-modal program-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <p className="program-modal-eyebrow">Confirm status</p>
            <h2 id="program-status-title">{isDeactivating ? 'Deactivate Program' : 'Reactivate Program'}</h2>
          </div>
          <button aria-label="Close status confirmation" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={22} />
          </button>
        </header>
        <div className="student-modal__body program-details-body">
          <div className={isDeactivating ? 'program-status-warning' : 'program-status-warning program-status-warning--safe'}>
            <strong>{pending.program.name}</strong>
            <p>
              {isDeactivating
                ? 'This keeps existing data intact but removes the program from active admin selection flows.'
                : 'This makes the program available again in active admin selection flows.'}
            </p>
          </div>
          <div className="program-impact-grid" aria-busy={isImpactLoading}>
            <div>
              <span>Cohorts</span>
              <strong>{isImpactLoading ? '...' : impact?.cohorts ?? 0}</strong>
            </div>
            <div>
              <span>Students</span>
              <strong>{isImpactLoading ? '...' : impact?.students ?? 0}</strong>
            </div>
            <div>
              <span>Resources</span>
              <strong>{isImpactLoading ? '...' : impact?.resources ?? 0}</strong>
            </div>
            <div>
              <span>Workshops</span>
              <strong>{isImpactLoading ? '...' : impact?.workshops ?? 0}</strong>
            </div>
          </div>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" disabled={isSaving} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={isDeactivating ? 'segmented-button segmented-button--danger' : 'segmented-button segmented-button--active'} disabled={isSaving} onClick={onConfirm} type="button">
            {isSaving ? 'Saving...' : isDeactivating ? 'Deactivate' : 'Reactivate'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function cleanGuidanceHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\s(on\w+)=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href)=("|')\s*javascript:[^"']*\2/gi, ' href="#"')
    .trim();
}

function GuidanceRichTextEditor({
  html,
  onChange
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== html) {
      editor.innerHTML = html;
    }
  }, [html]);

  function syncContent() {
    onChange(cleanGuidanceHtml(editorRef.current?.innerHTML ?? ''));
  }

  function runCommand(event: ReactMouseEvent<HTMLButtonElement>, command: string, value?: string) {
    event.preventDefault();
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncContent();
  }

  function addLink(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const url = window.prompt('Paste a full https:// link');
    if (!url) return;
    if (!/^https?:\/\//i.test(url.trim())) {
      window.alert('Use a full http:// or https:// link.');
      return;
    }
    runCommand(event, 'createLink', url.trim());
  }

  return (
    <div className="guidance-rich-text">
      <div className="guidance-rich-text__toolbar" aria-label="Guidance formatting tools" role="toolbar">
        <button aria-label="Bold" onMouseDown={(event) => runCommand(event, 'bold')} type="button">
          <Bold size={16} />
        </button>
        <button aria-label="Italic" onMouseDown={(event) => runCommand(event, 'italic')} type="button">
          <Italic size={16} />
        </button>
        <button aria-label="Underline" onMouseDown={(event) => runCommand(event, 'underline')} type="button">
          <Underline size={16} />
        </button>
        <button aria-label="Bullet list" onMouseDown={(event) => runCommand(event, 'insertUnorderedList')} type="button">
          <List size={16} />
        </button>
        <button aria-label="Add link" onMouseDown={addLink} type="button">
          <LinkIcon size={16} />
        </button>
      </div>
      <div
        aria-label="Guidance reader content"
        className="guidance-rich-text__editor"
        contentEditable
        onBlur={syncContent}
        onInput={syncContent}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}

function GuidanceContentCard({
  item,
  onSaved
}: {
  item: AdminStudentGuidanceContent;
  onSaved: (message: string) => void;
}) {
  const updateGuidance = useUpdateAdminStudentGuidanceContent();
  const [title, setTitle] = useState(item.title);
  const [summary, setSummary] = useState(item.summary ?? '');
  const [content, setContent] = useState(item.content ?? '');
  const [status, setStatus] = useState<AdminStudentGuidanceContentStatus>(item.status);
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(item.title);
    setSummary(item.summary ?? '');
    setContent(item.content ?? '');
    setStatus(item.status);
    setError('');
  }, [item]);

  const isDirty = title !== item.title || summary !== (item.summary ?? '') || content !== (item.content ?? '') || status !== item.status;
  const label = item.contentKey === 'program_structure' ? 'Program structure reader' : 'Certificate reader';

  function resetForm() {
    setTitle(item.title);
    setSummary(item.summary ?? '');
    setContent(item.content ?? '');
    setStatus(item.status);
    setError('');
  }

  async function saveGuidance() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError('Title is required.');
      return;
    }

    try {
      setError('');
      await updateGuidance.mutateAsync({
        body: {
          audience: 'leadership',
          content: cleanGuidanceHtml(content),
          sortOrder: item.sortOrder,
          status,
          summary: summary.trim() || null,
          title: nextTitle
        },
        contentId: item.id
      });
      onSaved(`${label} updated successfully.`);
    } catch (saveError) {
      setError(readableError(saveError, `${label} could not be saved.`));
    }
  }

  return (
    <article className="program-guidance-card">
      <header className="program-guidance-card__header">
        <div>
          <span className="program-modal-eyebrow">{label}</span>
          <h3>{item.title}</h3>
        </div>
        <StatusBadge tone={status === 'active' ? 'safe' : 'warning'}>{status}</StatusBadge>
      </header>
      {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
      <div className="program-guidance-form">
        <label>
          <span>CTA title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>Short description</span>
          <input value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as AdminStudentGuidanceContentStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="program-guidance-form__wide">
          <span>Full-screen reader content</span>
          <GuidanceRichTextEditor html={content} onChange={setContent} />
        </div>
      </div>
      <div className="program-guidance-preview">
        <span>Student preview</span>
        <ProjectRichText className="program-guidance-preview__copy" html={content} />
      </div>
      <footer className="program-guidance-card__footer">
        <button className="segmented-button" disabled={!isDirty || updateGuidance.isPending} onClick={resetForm} type="button">
          Reset
        </button>
        <button className="segmented-button segmented-button--danger" disabled={!isDirty || updateGuidance.isPending} onClick={() => void saveGuidance()} type="button">
          <Save size={15} />
          {updateGuidance.isPending ? 'Saving...' : 'Save guidance'}
        </button>
      </footer>
    </article>
  );
}

function ProgramGuidanceSection({ onNotice }: { onNotice: (message: string) => void }) {
  const guidanceQuery = useAdminStudentGuidanceContent();
  const items = guidanceQuery.data?.items ?? [];

  return (
    <section className="program-guidance-panel">
      <header className="program-guidance-panel__header">
        <div>
          <span className="program-modal-eyebrow">Student clarity</span>
          <h2>Leadership program guidance</h2>
          <p>Controls the two full-screen explainers shown to leadership program students on the dashboard.</p>
        </div>
        <button className="segmented-button" disabled={guidanceQuery.isFetching} onClick={() => void guidanceQuery.refetch()} type="button">
          <RefreshCw size={15} />
          {guidanceQuery.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>
      {guidanceQuery.isError ? (
        <div className="auth-alert auth-alert--error">Guidance content could not be loaded. Program records are unchanged.</div>
      ) : guidanceQuery.isLoading ? (
        <LoadingState />
      ) : items.length > 0 ? (
        <div className="program-guidance-grid">
          {items.map((item) => (
            <GuidanceContentCard item={item} key={item.id} onSaved={onNotice} />
          ))}
        </div>
      ) : (
        <div className="auth-alert auth-alert--warning">Guidance content has not been seeded yet.</div>
      )}
    </section>
  );
}

export function AdminProgramsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search')?.trim() ?? '';
  const domain = searchParams.get('domain')?.trim() ?? '';
  const [programModal, setProgramModal] = useState<{ mode: 'add' | 'edit'; program?: AdminProgram } | null>(null);
  const [detailsProgram, setDetailsProgram] = useState<AdminProgram | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);
  const [searchDraft, setSearchDraft] = useState(search);
  const [notice, setNotice] = useState('');
  const programsQuery = useAdminPrograms({ domain, page, search, status });
  const catalogQuery = useAdminPrograms({ limit: 500, page: 1, status: 'all' });
  const impactTarget = pendingStatusChange?.program ?? detailsProgram;
  const impactQuery = useAdminProgramImpact(impactTarget);
  const updateStatus = useUpdateAdminProgramStatus();
  const data = programsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const catalogItems = catalogQuery.data?.items ?? [];
  const activeCount = useMemo(() => catalogItems.filter((item) => item.status === 'active').length, [catalogItems]);
  const domainOptions = useMemo(() => Array.from(new Set(catalogItems.map((item) => item.domainLabel).filter((value): value is string => Boolean(value)))).sort(), [catalogItems]);
  const domainCount = domainOptions.length;

  const updateParams = useCallback((nextValues: { domain?: string; page?: number; search?: string; status?: AdminProgramStatus | 'all' }) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextValues.page ?? 1));
    const nextSearch = nextValues.search ?? search;
    const nextStatus = nextValues.status ?? status;
    const nextDomain = nextValues.domain ?? domain;
    nextSearch ? next.set('search', nextSearch) : next.delete('search');
    nextStatus !== 'all' ? next.set('status', nextStatus) : next.delete('status');
    nextDomain ? next.set('domain', nextDomain) : next.delete('domain');
    setSearchParams(next);
  }, [domain, search, searchParams, setSearchParams, status]);

  useEffect(() => {
    const nextSearch = searchDraft.trim();
    if (nextSearch === search) return;
    const timer = window.setTimeout(() => {
      updateParams({ page: 1, search: nextSearch });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft, search, updateParams]);

  async function confirmStatusChange() {
    if (!pendingStatusChange) return;
    try {
      await updateStatus.mutateAsync({ programId: pendingStatusChange.program.id, status: pendingStatusChange.nextStatus });
      setNotice(`Program ${pendingStatusChange.nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully.`);
      setPendingStatusChange(null);
    } catch (error) {
      setNotice(readableError(error, 'Program status could not be updated.'));
    }
  }

  const columns: DataColumn<AdminProgram>[] = [
    {
      header: 'Program',
      key: 'program',
      render: (item) => (
        <div className="announcement-title-cell">
          <strong>{item.name}</strong>
          <p>{item.shortName ?? item.programKey}</p>
          <div className="chip-row">
            <StatusBadge tone={item.status === 'active' ? 'safe' : 'warning'}>{item.status}</StatusBadge>
            <StatusBadge>{item.programKey}</StatusBadge>
            {item.domainLabel ? <StatusBadge>{item.domainLabel}</StatusBadge> : null}
          </div>
        </div>
      )
    },
    {
      header: 'Key',
      key: 'key',
      render: (item) => item.programKey
    },
    {
      header: 'Domain',
      key: 'domain',
      render: (item) => item.domainLabel ?? 'Not mapped'
    },
    {
      header: 'Updated',
      key: 'updated',
      render: (item) => formatDate(item.updatedAt)
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item) => (
        <div className="admin-program-actions">
          <button className="segmented-button" onClick={() => setDetailsProgram(item)} type="button">
            <Eye size={14} />
            Details
          </button>
          <button className="segmented-button" onClick={() => setProgramModal({ mode: 'edit', program: item })} type="button">
            <Pencil size={14} />
            Edit
          </button>
          <button
            className={item.status === 'inactive' ? 'segmented-button' : 'segmented-button segmented-button--danger'}
            disabled={updateStatus.isPending}
            onClick={() => setPendingStatusChange({ nextStatus: item.status === 'inactive' ? 'active' : 'inactive', program: item })}
            type="button"
          >
            <Ban size={14} />
            {item.status === 'inactive' ? 'Reactivate' : 'Deactivate'}
          </button>
        </div>
      )
    }
  ];

  if (programsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading program catalog." eyebrow="Admin programs" title="Programs" />
        <LoadingState />
      </div>
    );
  }

  if (programsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Programs could not be loaded right now." eyebrow="Admin programs" title="Programs unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-programs-page">
      <PageHeader description="Maintain the source of truth for LMS program names, keys, domains, and active status." eyebrow="Admin programs" title="Programs" />

      {notice ? <div className={/could not|failed|error/i.test(notice) ? 'auth-alert auth-alert--error' : 'auth-alert auth-alert--success'}>{notice}</div> : null}

      <div className="metric-grid">
        <article className="metric-tile">
          <BookOpen size={22} />
          <span>Total programs</span>
          <strong>{catalogQuery.data?.total ?? total}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Active programs</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="metric-tile">
          <Layers3 size={22} />
          <span>Domains</span>
          <strong>{domainCount}</strong>
        </article>
      </div>

      <ProgramGuidanceSection onNotice={setNotice} />

      <section className="filter-bar admin-program-filter-bar" aria-label="Program admin filters">
        <form className="filter-search filter-search--form admin-program-search" onSubmit={(event) => event.preventDefault()}>
          <Search size={18} />
          <label className="sr-only" htmlFor="admin-program-search">
            Search programs
          </label>
          <input id="admin-program-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search programs..." type="search" />
        </form>
        <select aria-label="Filter by domain" className="admin-program-domain-select" value={domain || 'all'} onChange={(event) => updateParams({ domain: event.target.value === 'all' ? '' : event.target.value, page: 1 })}>
          <option value="all">All Domains</option>
          {domainOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="segmented-control admin-program-status-control" role="group" aria-label="Program status">
          {statusOptions.map((option) => (
            <button className={option === status ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => updateParams({ page: 1, status: option })} type="button">
              {option}
            </button>
          ))}
        </div>
        <button className="segmented-button segmented-button--gold" onClick={() => setProgramModal({ mode: 'add' })} type="button">
          <Plus size={16} />
          Program
        </button>
        <button className="segmented-button" disabled={programsQuery.isFetching} onClick={() => void programsQuery.refetch()} type="button">
          <RefreshCw size={16} />
          {programsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      {data && data.items.length > 0 ? (
        <div className="admin-program-table-panel">
          <DataPanel columns={columns} description="Program master records and operational status." items={data.items} title="Program records" />
        </div>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin program pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, status, domain)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages} · {total} matching
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, status, domain)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {programModal ? <ProgramModal existingPrograms={catalogItems} mode={programModal.mode} onClose={() => setProgramModal(null)} onSaved={setNotice} program={programModal.program} /> : null}
      {detailsProgram ? (
        <ProgramDetailsModal
          impact={impactQuery.data}
          isImpactLoading={impactQuery.isFetching}
          onClose={() => setDetailsProgram(null)}
          onEdit={() => {
            setProgramModal({ mode: 'edit', program: detailsProgram });
            setDetailsProgram(null);
          }}
          program={detailsProgram}
        />
      ) : null}
      {pendingStatusChange ? (
        <ProgramStatusModal
          impact={impactQuery.data}
          isImpactLoading={impactQuery.isFetching}
          isSaving={updateStatus.isPending}
          onClose={() => setPendingStatusChange(null)}
          onConfirm={() => void confirmStatusChange()}
          pending={pendingStatusChange}
        />
      ) : null}
    </div>
  );
}
