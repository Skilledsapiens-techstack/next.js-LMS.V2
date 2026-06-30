import { Ban, BookOpen, Layers3, Pencil, Plus, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminProgram, AdminProgramStatus, useAdminPrograms } from '../features/admin/useAdminPrograms';

const statusOptions: Array<AdminProgramStatus | 'all'> = ['all', 'active', 'inactive'];

type ProgramTemplate = {
  description: string;
  domainLabel: string;
  name: string;
  programKey: string;
  shortName: string;
};

const programTemplates: ProgramTemplate[] = [
  {
    description: 'Leadership learning track for consulting roles, business problem solving, and live project readiness.',
    domainLabel: 'Consulting',
    name: 'Management Consulting Leadership Program',
    programKey: 'mclp',
    shortName: 'MCLP'
  },
  {
    description: 'Leadership learning track for sales, brand, digital marketing, and growth roles.',
    domainLabel: 'Sales & Marketing',
    name: 'Sales & Marketing Leadership Program',
    programKey: 'smlp',
    shortName: 'SMLP'
  },
  {
    description: 'Leadership learning track for HR, talent acquisition, compensation, and people operations roles.',
    domainLabel: 'HR',
    name: 'HR Leadership Program',
    programKey: 'hrlp',
    shortName: 'HRLP'
  },
  {
    description: 'Finance learning track for equity research, financial modelling, and investment analysis roles.',
    domainLabel: 'Finance ER',
    name: 'Finance Leadership Program - ER',
    programKey: 'flp_er',
    shortName: 'FLP ER'
  },
  {
    description: 'Finance learning track for quantitative finance, portfolio management, and analytical finance roles.',
    domainLabel: 'Finance QF',
    name: 'Finance Leadership Program - QF',
    programKey: 'flp_qf',
    shortName: 'FLP QF'
  },
  {
    description: 'Product learning track for product management, product strategy, and brand-led product roles.',
    domainLabel: 'Product',
    name: 'Product Management Leadership Program',
    programKey: 'pmlp',
    shortName: 'PMLP'
  },
  {
    description: 'Mentorship track for group discussion, personal interview, and placement readiness.',
    domainLabel: 'GD-PI',
    name: 'GD-PI Mentorship Program',
    programKey: 'gd_pi',
    shortName: 'GD-PI'
  }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseStatus(value: string | null): AdminProgramStatus | 'all' {
  return statusOptions.includes(value as AdminProgramStatus | 'all') ? (value as AdminProgramStatus | 'all') : 'all';
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildPageLink(page: number, status: AdminProgramStatus | 'all') {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (status !== 'all') params.set('status', status);
  return `?${params.toString()}`;
}

function ProgramModal({ mode, onClose, program }: { mode: 'add' | 'edit'; onClose: () => void; program?: AdminProgram }) {
  const initialTemplate =
    programTemplates.find((template) => template.programKey === program?.programKey) ??
    programTemplates.find((template) => template.name === program?.name) ??
    programTemplates[0];
  const [selectedProgramKey, setSelectedProgramKey] = useState(initialTemplate.programKey);
  const selectedTemplate = programTemplates.find((template) => template.programKey === selectedProgramKey) ?? initialTemplate;

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="program-modal-title" aria-modal="true" className="student-modal program-modal" role="dialog">
        <header className="student-modal__header">
          <h2 id="program-modal-title">{mode === 'add' ? 'Add Program' : 'Edit Program'}</h2>
          <button aria-label="Close program form" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={22} />
          </button>
        </header>
        <div className="student-modal__body">
          <form className="program-form-shell">
            <label>
              <span>Program name</span>
              <select value={selectedProgramKey} onChange={(event) => setSelectedProgramKey(event.target.value)}>
                {programTemplates.map((template) => (
                  <option key={template.programKey} value={template.programKey}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Short name</span>
              <input readOnly value={selectedTemplate.shortName} />
            </label>
            <label>
              <span>Program key</span>
              <input readOnly value={selectedTemplate.programKey} />
            </label>
            <label>
              <span>Domain</span>
              <input readOnly value={selectedTemplate.domainLabel} />
            </label>
            <label>
              <span>Status</span>
              <select defaultValue={program?.status ?? 'active'}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              <span>Display order</span>
              <input placeholder="Optional" type="number" />
            </label>
            <label className="program-form-shell__wide">
              <span>Description</span>
              <textarea readOnly rows={4} value={selectedTemplate.description} />
            </label>
          </form>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="segmented-button segmented-button--active" disabled type="button">
            {mode === 'add' ? 'Save Program' : 'Update Program'}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function AdminProgramsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const [programModal, setProgramModal] = useState<{ mode: 'add' | 'edit'; program?: AdminProgram } | null>(null);
  const programsQuery = useAdminPrograms({ page, status });
  const data = programsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const activeCount = useMemo(() => data?.items.filter((item) => item.status === 'active').length ?? 0, [data?.items]);
  const domainCount = useMemo(() => new Set(data?.items.map((item) => item.domainLabel).filter(Boolean)).size, [data?.items]);

  function handleStatusChange(nextStatus: AdminProgramStatus | 'all') {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    next.delete('search');
    if (nextStatus === 'all') {
      next.delete('status');
    } else {
      next.set('status', nextStatus);
    }
    setSearchParams(next);
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
          <button className="segmented-button" onClick={() => setProgramModal({ mode: 'edit', program: item })} type="button">
            <Pencil size={14} />
            Edit
          </button>
          <button className="segmented-button segmented-button--danger" disabled type="button">
            <Ban size={14} />
            Deactivate
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
    <div className="page-stack">
      <PageHeader description="Review the LMS program catalog and operational status." eyebrow="Admin programs" title="Programs" />

      <div className="metric-grid">
        <article className="metric-tile">
          <BookOpen size={22} />
          <span>Total programs</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Active on page</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="metric-tile">
          <Layers3 size={22} />
          <span>Domains on page</span>
          <strong>{domainCount}</strong>
        </article>
      </div>

      <section className="filter-bar admin-program-filter-bar" aria-label="Program admin filters">
        <div className="segmented-control admin-program-status-control" role="group" aria-label="Program status">
          {statusOptions.map((option) => (
            <button className={option === status ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => handleStatusChange(option)} type="button">
              {option}
            </button>
          ))}
        </div>
        <button className="segmented-button segmented-button--gold" onClick={() => setProgramModal({ mode: 'add' })} type="button">
          <Plus size={16} />
          Program
        </button>
      </section>

      {data && data.items.length > 0 ? (
        <DataPanel columns={columns} description="Program catalog records and operational status." items={data.items} title="Program records" />
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin program pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, status)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, status)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>
      {programModal ? <ProgramModal mode={programModal.mode} onClose={() => setProgramModal(null)} program={programModal.program} /> : null}
    </div>
  );
}
