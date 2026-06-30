import { ExternalLink, FileCheck2, Search, ShieldCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import {
  AdminCertificate,
  AdminCertificateGenerationStatus,
  AdminCertificateRequest,
  AdminCertificateRequestAdminStatus,
  AdminCertificateStatus,
  AdminCertificateType,
  useAdminCertificateRequests,
  useAdminCertificates
} from '../features/admin/useAdminCertificates';
import { AdminProgram, useAdminPrograms } from '../features/admin/useAdminPrograms';
import { useAdminStudents } from '../features/admin/useAdminStudents';

const certificateStatusOptions: Array<AdminCertificateStatus | 'all'> = ['all', 'draft', 'issued', 'revoked'];
const generationStatusOptions: Array<AdminCertificateGenerationStatus | 'all'> = ['all', 'pending', 'generating', 'ready', 'expired', 'failed'];
const certificateTypeOptions: Array<AdminCertificateType | 'all'> = ['all', 'leadership', 'live_project'];

const leadershipModuleDefaults: Record<string, string> = {
  flp_er: ['Equity Research', 'Financial Modeling', 'Valuation', 'Investment Memo'].join('\n'),
  flp_qf: ['Portfolio Management', 'Risk Analytics', 'Quantitative Finance', 'Financial Modeling'].join('\n'),
  hrlp: ['Talent Acquisition', 'Compensation & Benefits', 'Performance Management', 'HR Analytics', 'Employee Engagement'].join('\n'),
  mclp: [
    'MECE Framework',
    'Market Entry Strategy',
    'Cost Analysis',
    'GTM Strategy',
    'Industry Analysis',
    'Merger & Acquisition Analysis',
    'Live Business Case Simulation and Guesstimates'
  ].join('\n'),
  pmlp: ['Product Discovery', 'PRD Writing', 'Roadmapping', 'User Research', 'Product Metrics'].join('\n'),
  smlp: ['Brand Positioning', 'Go-to-market Strategy', 'Digital Marketing Planning', 'Sales Funnel Design', 'Customer Segmentation'].join('\n')
};

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function normalizeKey(value: string | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/-/g, '_');
}

function parseCertificateStatus(value: string | null): AdminCertificateStatus | 'all' {
  return certificateStatusOptions.includes(value as AdminCertificateStatus | 'all') ? (value as AdminCertificateStatus | 'all') : 'all';
}

function parseGenerationStatus(value: string | null): AdminCertificateGenerationStatus | 'all' {
  return generationStatusOptions.includes(value as AdminCertificateGenerationStatus | 'all') ? (value as AdminCertificateGenerationStatus | 'all') : 'all';
}

function parseCertificateType(value: string | null): AdminCertificateType | 'all' {
  return certificateTypeOptions.includes(value as AdminCertificateType | 'all') ? (value as AdminCertificateType | 'all') : 'all';
}

function buildPageLink(
  page: number,
  search: string,
  status: AdminCertificateStatus | 'all',
  generationStatus: AdminCertificateGenerationStatus | 'all',
  certificateType: AdminCertificateType | 'all'
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (generationStatus !== 'all') params.set('generationStatus', generationStatus);
  if (certificateType !== 'all') params.set('certificateType', certificateType);
  return `?${params.toString()}`;
}

function statusTone(status: AdminCertificateStatus | AdminCertificateRequestAdminStatus) {
  if (status === 'issued' || status === 'approved') return 'safe';
  if (status === 'draft' || status === 'pending') return 'warning';
  return 'neutral';
}

function generationTone(status: AdminCertificateGenerationStatus) {
  if (status === 'ready') return 'safe';
  if (status === 'pending' || status === 'generating') return 'warning';
  return 'neutral';
}

function programLabel(program: AdminProgram | undefined, fallback: string | undefined) {
  return program?.name ?? fallback ?? 'Select program';
}

function programShortKey(program: AdminProgram | undefined) {
  return normalizeKey(program?.shortName ?? program?.programKey);
}

function dedupeCohorts(pages: Array<AdminCohort[] | undefined>) {
  const map = new Map<string, AdminCohort>();
  for (const page of pages) {
    for (const cohort of page ?? []) {
      map.set(cohort.id, cohort);
    }
  }
  return [...map.values()];
}

function isCohortForProgram(cohort: AdminCohort, program: AdminProgram | undefined) {
  if (!program) return true;
  const programKey = normalizeKey(program.programKey);
  const shortKey = programShortKey(program);
  const cohortProgram = normalizeKey(cohort.programKey);
  const cohortDomain = normalizeKey(cohort.domainKey);
  const cohortName = normalizeKey(cohort.name);
  const cohortId = normalizeKey(cohort.cohortId);

  return (
    cohortProgram === programKey ||
    cohortProgram === shortKey ||
    cohortDomain === programKey ||
    cohortDomain === shortKey ||
    (shortKey ? cohortName.startsWith(shortKey) || cohortId.startsWith(shortKey) : false)
  );
}

function lockedButtonLabel(label: string) {
  return `${label} (locked)`;
}

function FinalIssuanceModal({ request, onClose }: { request: AdminCertificateRequest; onClose: () => void }) {
  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="live-project-issuance-title" aria-modal="true" className="student-modal certificate-final-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <span className="certificate-section-eyebrow">Final Issuance</span>
            <h2 id="live-project-issuance-title">Live Project Certificate</h2>
          </div>
          <button aria-label="Close final issuance" className="student-modal__icon-button" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="student-modal__body">
          <div className="certificate-review-summary">
            <div>
              <span>Student name</span>
              <strong>{request.studentName}</strong>
            </div>
            <div>
              <span>Email ID</span>
              <strong>{request.studentEmail}</strong>
            </div>
            <div>
              <span>Project</span>
              <strong>{request.projectTitle ?? request.projectId}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{request.projectRole}</strong>
            </div>
            <div>
              <span>Program</span>
              <strong>{request.programKey ?? 'Not mapped'}</strong>
            </div>
            <div>
              <span>Submission</span>
              <strong>{request.requestId}</strong>
            </div>
          </div>

          <div className="certificate-modal-form">
            <label className="certificate-field">
              <span>Student</span>
              <input readOnly value={`${request.studentName} · ${request.studentEmail}`} />
            </label>
            <label className="certificate-field">
              <span>Project role *</span>
              <input readOnly value={request.projectRole} />
            </label>
            <label className="certificate-field">
              <span>Cohort *</span>
              <input readOnly value={request.cohortName ?? 'Not mapped'} />
            </label>
            <label className="certificate-field">
              <span>Duration</span>
              <input readOnly value="4 weeks" />
            </label>
            <label className="certificate-field">
              <span>Start date *</span>
              <input readOnly value={formatDate(request.submittedAt)} />
            </label>
            <label className="certificate-field">
              <span>End date *</span>
              <input readOnly value={formatDate(request.adminReviewedAt ?? request.moderatorReviewedAt ?? request.updatedAt)} />
            </label>
            <label className="certificate-field">
              <span>Issue date *</span>
              <input readOnly value={formatDate(todayInputValue())} />
            </label>
            <label className="certificate-checkbox">
              <input checked readOnly type="checkbox" />
              <span>Send certificate email after PDF generation</span>
            </label>
          </div>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" disabled type="button">
            {lockedButtonLabel('Issue Certificate')} →
          </button>
        </footer>
      </section>
    </div>
  );
}

function RequestQueue({
  isLoading,
  items,
  onReview
}: {
  isLoading: boolean;
  items: AdminCertificateRequest[];
  onReview: (request: AdminCertificateRequest) => void;
}) {
  return (
    <section className="certificate-section">
      <header className="certificate-section__header">
        <div>
          <span className="certificate-section-eyebrow">Review Queue</span>
          <h2>Live Project Certificate Requests</h2>
        </div>
      </header>
      <div className="certificate-section__body">
        {isLoading ? <p className="certificate-muted">Loading live project certificate requests.</p> : null}
        {!isLoading && items.length === 0 ? (
          <div className="certificate-empty-inline">
            <FileCheck2 size={20} />
            <div>
              <strong>No pending live project certificates</strong>
              <span>Approved submissions will appear here for final certificate review.</span>
            </div>
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="certificate-request-list">
            {items.map((request) => (
              <article className="certificate-request-card" key={request.id}>
                <div>
                  <h3>
                    {request.requestId} · {request.studentName}
                  </h3>
                  <p>
                    {request.studentEmail} · {request.projectTitle ?? request.projectId} · {request.projectRole}
                  </p>
                  <p>
                    {request.programKey ?? 'No program'} · {request.cohortName ?? 'No cohort'} · {formatDate(request.submittedAt)}
                  </p>
                  <div className="chip-row">
                    <StatusBadge tone={statusTone(request.moderatorStatus)}>{formatOption(request.moderatorStatus)}</StatusBadge>
                    <StatusBadge tone={statusTone(request.adminStatus)}>{formatOption(request.adminStatus)}</StatusBadge>
                  </div>
                </div>
                <div className="certificate-request-card__actions">
                  <button className="segmented-button" disabled type="button">
                    <ExternalLink size={14} />
                    {lockedButtonLabel('Open Report')}
                  </button>
                  <button className="segmented-button" onClick={() => onReview(request)} type="button">
                    Review & Issue
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function AdminCertificatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseCertificateStatus(searchParams.get('status'));
  const generationStatus = parseGenerationStatus(searchParams.get('generationStatus'));
  const certificateType = parseCertificateType(searchParams.get('certificateType'));
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [selectedProgramKey, setSelectedProgramKey] = useState('');
  const [selectedCohortName, setSelectedCohortName] = useState('');
  const [modulesCovered, setModulesCovered] = useState('');
  const [issueDate, setIssueDate] = useState(todayInputValue());
  const [sendEmail, setSendEmail] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [moduleProgramKey, setModuleProgramKey] = useState('');
  const [moduleStatus, setModuleStatus] = useState<'active' | 'inactive'>('active');
  const [moduleText, setModuleText] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AdminCertificateRequest | null>(null);

  const certificatesQuery = useAdminCertificates({ certificateType, generationStatus, page, search, status });
  const requestsQuery = useAdminCertificateRequests({ adminStatus: 'pending', limit: 10, moderatorStatus: 'approved', page: 1 });
  const programsQuery = useAdminPrograms({ limit: 100, page: 1, status: 'active' });
  const cohortsPageOneQuery = useAdminCohorts({ limit: 100, page: 1, status: 'all' });
  const cohortsPageTwoQuery = useAdminCohorts({ limit: 100, page: 2, status: 'all' });
  const cohortsPageThreeQuery = useAdminCohorts({ limit: 100, page: 3, status: 'all' });
  const studentsQuery = useAdminStudents({ cohortName: selectedCohortName || undefined, limit: 100, page: 1, status: 'active' });

  const programs = programsQuery.data?.items ?? [];
  const allCohorts = useMemo(
    () => dedupeCohorts([cohortsPageOneQuery.data?.items, cohortsPageTwoQuery.data?.items, cohortsPageThreeQuery.data?.items]),
    [cohortsPageOneQuery.data?.items, cohortsPageTwoQuery.data?.items, cohortsPageThreeQuery.data?.items]
  );
  const selectedProgram = useMemo(() => programs.find((program) => program.programKey === selectedProgramKey), [programs, selectedProgramKey]);
  const moduleProgram = useMemo(() => programs.find((program) => program.programKey === moduleProgramKey), [programs, moduleProgramKey]);
  const filteredCohorts = useMemo(
    () => allCohorts.filter((cohort) => isCohortForProgram(cohort, selectedProgram)).sort((a, b) => a.name.localeCompare(b.name)),
    [allCohorts, selectedProgram]
  );
  const eligibleStudents = studentsQuery.data?.items ?? [];
  const certificates = certificatesQuery.data;
  const totalPages = certificates?.totalPages ?? 1;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (searchInput.trim()) {
      next.set('search', searchInput.trim());
    } else {
      next.delete('search');
    }
    setSearchParams(next);
  }

  function setFilter(key: 'certificateType' | 'generationStatus' | 'status', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  }

  function handleProgramChange(programKey: string) {
    const program = programs.find((item) => item.programKey === programKey);
    setSelectedProgramKey(programKey);
    setSelectedCohortName('');
    setSelectedStudentIds(new Set());
    setModulesCovered(leadershipModuleDefaults[programShortKey(program)] ?? '');
  }

  function handleModuleProgramChange(programKey: string) {
    const program = programs.find((item) => item.programKey === programKey);
    setModuleProgramKey(programKey);
    setModuleText(leadershipModuleDefaults[programShortKey(program)] ?? '');
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  const pageIsLoading = certificatesQuery.isLoading || requestsQuery.isLoading || programsQuery.isLoading || cohortsPageOneQuery.isLoading;
  const pageHasError = certificatesQuery.isError || requestsQuery.isError || programsQuery.isError || cohortsPageOneQuery.isError;

  if (pageIsLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading certificate issuance workspace." eyebrow="Module refresh" title="Certificates" />
        <LoadingState />
      </div>
    );
  }

  if (pageHasError) {
    return (
      <div className="page-stack">
        <PageHeader description="Certificate workflows could not be loaded." eyebrow="Module refresh" title="Certificates unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-certificates-page">
      <PageHeader
        description="Issue leadership certificates, review live project certificate requests, and monitor issued certificate records."
        eyebrow="Module refresh"
        title="Certificates"
      />

      <section className="admin-certificate-workspace-grid">
        <article className="certificate-section">
          <header className="certificate-section__header">
            <div>
              <span className="certificate-section-eyebrow">Issuance</span>
              <h2>Leadership Certificates</h2>
            </div>
          </header>
          <div className="certificate-section__body certificate-form">
            <label className="certificate-field">
              <span>Program *</span>
              <select value={selectedProgramKey} onChange={(event) => handleProgramChange(event.target.value)}>
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.programKey}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="certificate-field">
              <span>Cohort *</span>
              <select
                disabled={!selectedProgramKey}
                value={selectedCohortName}
                onChange={(event) => {
                  setSelectedCohortName(event.target.value);
                  setSelectedStudentIds(new Set());
                }}
              >
                <option value="">Select cohort</option>
                {filteredCohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.name}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="certificate-field">
              <span>Modules covered</span>
              <textarea onChange={(event) => setModulesCovered(event.target.value)} placeholder="One module per line" value={modulesCovered} />
            </label>
            <label className="certificate-field">
              <span>Issue date *</span>
              <input onChange={(event) => setIssueDate(event.target.value)} type="date" value={issueDate} />
            </label>
            <label className="certificate-checkbox">
              <input checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} type="checkbox" />
              <span>Send certificate email after PDF generation</span>
            </label>
            <div className="eligible-student-panel">
              <h3>Eligible Students</h3>
              {!selectedCohortName ? <p>Select a program and cohort to load eligible students.</p> : null}
              {selectedCohortName && studentsQuery.isLoading ? <p>Loading eligible students.</p> : null}
              {selectedCohortName && !studentsQuery.isLoading && eligibleStudents.length === 0 ? <p>No active students found for this cohort.</p> : null}
              {eligibleStudents.length > 0 ? (
                <div className="eligible-student-list">
                  {eligibleStudents.map((student) => (
                    <label className="eligible-student-item" key={student.id}>
                      <input checked={selectedStudentIds.has(student.id)} onChange={() => toggleStudent(student.id)} type="checkbox" />
                      <span>
                        <strong>{student.fullName}</strong>
                        <small>{student.email}</small>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <button className="button-primary certificate-form__submit" disabled type="button">
              {lockedButtonLabel('Issue Selected Certificates')} →
            </button>
          </div>
        </article>

        <article className="certificate-section">
          <header className="certificate-section__header">
            <div>
              <span className="certificate-section-eyebrow">Configuration</span>
              <h2>Leadership Modules</h2>
            </div>
          </header>
          <div className="certificate-section__body certificate-form">
            <label className="certificate-field">
              <span>Program *</span>
              <select value={moduleProgramKey} onChange={(event) => handleModuleProgramChange(event.target.value)}>
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.programKey}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="certificate-field">
              <span>Status</span>
              <select value={moduleStatus} onChange={(event) => setModuleStatus(event.target.value as 'active' | 'inactive')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="certificate-field">
              <span>Predefined modules</span>
              <textarea onChange={(event) => setModuleText(event.target.value)} placeholder="One module per line" value={moduleText} />
            </label>
            <div className="certificate-muted-card">
              <ShieldCheck size={17} />
              <span>{moduleProgram ? `Module template selected for ${programLabel(moduleProgram, moduleProgramKey)}.` : 'Select a program to review or configure its certificate modules.'}</span>
            </div>
            <button className="button-primary certificate-form__submit" disabled type="button">
              {lockedButtonLabel('Save Program Modules')} →
            </button>
          </div>
        </article>
      </section>

      <RequestQueue isLoading={requestsQuery.isLoading} items={requestsQuery.data?.items ?? []} onReview={setSelectedRequest} />

      <section className="certificate-section">
        <header className="certificate-section__header">
          <div>
            <span className="certificate-section-eyebrow">Registry</span>
            <h2>Issued Certificates</h2>
          </div>
        </header>
        <div className="certificate-section__body">
          <div className="certificate-registry-toolbar">
            <form className="filter-search admin-certificate-search" onSubmit={handleSearch}>
              <Search size={16} />
              <label className="sr-only" htmlFor="admin-certificate-search">
                Search certificates
              </label>
              <input id="admin-certificate-search" onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, email, certificate ID..." type="search" value={searchInput} />
            </form>
            <label className="certificate-compact-select">
              <span>Type</span>
              <select value={certificateType} onChange={(event) => setFilter('certificateType', event.target.value)}>
                {certificateTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All certificate types' : formatOption(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="certificate-compact-select">
              <span>Certificate status</span>
              <select value={status} onChange={(event) => setFilter('status', event.target.value)}>
                {certificateStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All certificate statuses' : formatOption(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="certificate-compact-select">
              <span>PDF status</span>
              <select value={generationStatus} onChange={(event) => setFilter('generationStatus', event.target.value)}>
                {generationStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All PDF statuses' : formatOption(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {certificates && certificates.items.length > 0 ? (
            <div className="certificate-registry-list">
              {certificates.items.map((certificate: AdminCertificate) => (
                <article className="certificate-registry-row" key={certificate.id}>
                  <div>
                    <h3>
                      {certificate.studentName} · {certificate.projectTitle ?? certificate.programName ?? certificate.programKey ?? certificate.certificateId}
                    </h3>
                    <p>
                      {certificate.certificateId} · {formatDate(certificate.issueDate)}
                    </p>
                    <div className="chip-row">
                      <span>Certificate</span>
                      <StatusBadge tone={statusTone(certificate.status)}>{formatOption(certificate.status)}</StatusBadge>
                      <span>PDF</span>
                      <StatusBadge tone={generationTone(certificate.generationStatus)}>{formatOption(certificate.generationStatus)}</StatusBadge>
                    </div>
                  </div>
                  <div className="certificate-registry-row__actions">
                    <button className="segmented-button" disabled type="button">
                      {lockedButtonLabel('Verify')}
                    </button>
                    <button className="segmented-button" disabled type="button">
                      {certificate.generationStatus === 'ready' ? lockedButtonLabel('Regenerate PDF') : lockedButtonLabel('Generate PDF Now')}
                    </button>
                    <button className="segmented-button segmented-button--danger" disabled type="button">
                      {lockedButtonLabel('Revoke')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}

          <nav className="pagination-bar" aria-label="Admin certificate pagination">
            {certificates?.hasPreviousPage ? (
              <Link className="pagination-link" to={buildPageLink(page - 1, search, status, generationStatus, certificateType)}>
                Previous page
              </Link>
            ) : (
              <span className="pagination-link pagination-link--disabled">Previous page</span>
            )}
            <span>
              Page {page} of {totalPages}
            </span>
            {certificates?.hasNextPage ? (
              <Link className="pagination-link" to={buildPageLink(page + 1, search, status, generationStatus, certificateType)}>
                Next page
              </Link>
            ) : (
              <span className="pagination-link pagination-link--disabled">Next page</span>
            )}
          </nav>
        </div>
      </section>

      {selectedRequest ? <FinalIssuanceModal request={selectedRequest} onClose={() => setSelectedRequest(null)} /> : null}
    </div>
  );
}
