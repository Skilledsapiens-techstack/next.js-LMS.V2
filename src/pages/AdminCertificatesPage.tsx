import { ExternalLink, FileCheck2, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { hasAdminPermission } from '../auth/adminPermissions';
import { useAdminProfile } from '../features/admin/useAdminDashboard';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import {
  AdminCertificate,
  AdminCertificateGenerationStatus,
  AdminCertificateRequest,
  AdminCertificateRequestAdminStatus,
  AdminCertificateStatus,
  AdminCertificateType,
  AdminCertificateProgramSetting,
  IssueLeadershipCertificatesInput,
  IssueLiveProjectCertificateInput,
  IssueManualCertificateInput,
  useAdminCertificateRequests,
  useAdminCertificates,
  useAdminCertificateProgramSettings,
  useGenerateAdminCertificatePdf,
  useIssueLeadershipCertificates,
  useIssueLiveProjectCertificate,
  useIssueManualCertificate,
  useRevokeAdminCertificate,
  useSaveCertificateProgramSetting
} from '../features/admin/useAdminCertificates';
import { AdminProgram, useAdminPrograms } from '../features/admin/useAdminPrograms';
import { AdminProjectRole, useAdminProjectRoles } from '../features/admin/useAdminProjects';
import { AdminStudent, useAdminStudents } from '../features/admin/useAdminStudents';

const certificateStatusOptions: Array<AdminCertificateStatus | 'all'> = ['all', 'draft', 'issued', 'revoked'];
const generationStatusOptions: Array<AdminCertificateGenerationStatus | 'all'> = ['all', 'pending', 'generating', 'ready', 'expired', 'failed'];
const certificateTypeOptions: Array<AdminCertificateType | 'all'> = ['all', 'leadership', 'live_project'];

const leadershipModuleDefaults: Record<string, string> = {
  flp_er: ['Equity Research', 'Financial Modeling', 'Valuation', 'Investment Memo'].join('\n'),
  flp_qf: ['Portfolio Management', 'Risk Analytics', 'Quantitative Finance', 'Financial Modeling'].join('\n'),
  hrlp: ['Talent Acquisition', 'Compensation & Benefits', 'Performance Management', 'HR Analytics', 'Employee Engagement'].join('\n'),
  mclp: ['MECE Framework', 'Market Entry Strategy', 'Cost Analysis', 'GTM Strategy', 'Industry Analysis', 'Merger & Acquisition Analysis', 'Live Business Case Simulation and Guesstimates'].join('\n'),
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

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function addDaysInput(value: string, days: number) {
  if (!isValidDateInput(value)) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
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

const durationOptions = [2, 4, 6, 8];
const leadershipCertificateBatchLimit = 250;

type CertificateWorkspaceTab = 'leadership' | 'live-projects' | 'manual' | 'issued';

const certificateTabs: Array<{
  description: string;
  id: CertificateWorkspaceTab;
  label: string;
}> = [
  {
    description: 'Bulk issue program completion certificates and manage module templates.',
    id: 'leadership',
    label: 'Leadership Programs'
  },
  {
    description: 'Review approved live project submissions and issue project certificates.',
    id: 'live-projects',
    label: 'Live Projects'
  },
  {
    description: 'Issue an approved manual certificate without changing existing flows.',
    id: 'manual',
    label: 'Manual Issue'
  },
  {
    description: 'Search, verify, revoke, and monitor generated certificate records.',
    id: 'issued',
    label: 'Issued Certificates'
  }
];

function modulesFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function moduleTextFromSetting(setting: AdminCertificateProgramSetting | undefined, fallback: string) {
  return setting?.modulesCovered?.length ? setting.modulesCovered.join('\n') : fallback;
}

function FinalIssuanceModal({
  error,
  isIssuing,
  onClose,
  onIssue,
  request
}: {
  error?: string;
  isIssuing: boolean;
  onClose: () => void;
  onIssue: (input: IssueLiveProjectCertificateInput) => Promise<void>;
  request: AdminCertificateRequest;
}) {
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [issueDate, setIssueDate] = useState(todayInputValue());
  const [sendEmail, setSendEmail] = useState(true);
  const [startDate, setStartDate] = useState(request.cohortStartDate?.slice(0, 10) ?? '');
  const endDate = useMemo(() => addDaysInput(startDate, durationWeeks * 7 - 1), [durationWeeks, startDate]);
  const missingCohortStartDate = !request.cohortStartDate;

  useEffect(() => {
    setDurationWeeks(4);
    setIssueDate(todayInputValue());
    setSendEmail(true);
    setStartDate(request.cohortStartDate?.slice(0, 10) ?? '');
  }, [request]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onIssue({
      durationWeeks,
      issueDate,
      requestId: request.id,
      sendEmail,
      startDate
    });
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <form aria-labelledby="live-project-issuance-title" aria-modal="true" className="student-modal certificate-final-modal" onSubmit={handleSubmit} role="dialog">
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
              <strong>{request.requestNumber ?? request.requestId}</strong>
            </div>
            <div>
              <span>Attempt</span>
              <strong>{request.attemptNumber ?? 1}</strong>
            </div>
            <div>
              <span>Submitted on</span>
              <strong>{formatDate(request.submittedAt)}</strong>
            </div>
          </div>

          {missingCohortStartDate ? (
            <div className="certificate-muted-card certificate-muted-card--warning">
              <ShieldCheck size={17} />
              <span>Cohort start date is missing. Please select the project start date manually before issuing.</span>
            </div>
          ) : null}

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
              <select value={durationWeeks} onChange={(event) => setDurationWeeks(Number(event.target.value))}>
                {durationOptions.map((weeks) => (
                  <option key={weeks} value={weeks}>
                    {weeks} weeks
                  </option>
                ))}
              </select>
            </label>
            <label className="certificate-field">
              <span>Start date *</span>
              <input onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
            </label>
            <label className="certificate-field">
              <span>End date *</span>
              <input readOnly required type="date" value={endDate} />
            </label>
            <label className="certificate-field">
              <span>Issue date *</span>
              <input onChange={(event) => setIssueDate(event.target.value)} required type="date" value={issueDate} />
            </label>
            <label className="certificate-checkbox">
              <input checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} type="checkbox" />
              <span>Send certificate email after PDF generation</span>
            </label>
          </div>
          {error ? <p className="admin-submission-message admin-submission-message--error">{error}</p> : null}
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" disabled={isIssuing} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button-primary" disabled={isIssuing || !startDate || !endDate || !issueDate} type="submit">
            {isIssuing ? 'Issuing...' : 'Issue Certificate →'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function RequestQueue({ isLoading, items, onReview }: { isLoading: boolean; items: AdminCertificateRequest[]; onReview: (request: AdminCertificateRequest) => void }) {
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
                  {request.submissionUrl ? (
                    <a className="segmented-button" href={request.submissionUrl} rel="noreferrer" target="_blank">
                      <ExternalLink size={14} />
                      Open Report
                    </a>
                  ) : (
                    <button className="segmented-button" disabled type="button">
                      <ExternalLink size={14} />
                      {lockedButtonLabel('Open Report')}
                    </button>
                  )}
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

function RevokeCertificateModal({
  certificate,
  error,
  isRevoking,
  onClose,
  onRevoke
}: {
  certificate: AdminCertificate;
  error?: string;
  isRevoking: boolean;
  onClose: () => void;
  onRevoke: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onRevoke(reason);
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <form aria-labelledby="certificate-revoke-title" aria-modal="true" className="student-modal certificate-revoke-modal" onSubmit={handleSubmit} role="dialog">
        <header className="student-modal__header">
          <div>
            <span className="certificate-section-eyebrow">Revoke Certificate</span>
            <h2 id="certificate-revoke-title">{certificate.certificateId}</h2>
          </div>
          <button aria-label="Close revoke certificate" className="student-modal__icon-button" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="student-modal__body">
          <div className="certificate-muted-card">
            <ShieldCheck size={17} />
            <span>This will mark the certificate as revoked and expire its PDF status. Students will still see the certificate record as revoked.</span>
          </div>
          <label className="certificate-field">
            <span>Reason *</span>
            <textarea
              onChange={(event) => setReason(event.target.value)}
              placeholder="Example: Incorrect student details, duplicate certificate, or issued against wrong cohort."
              required
              value={reason}
            />
          </label>
          {error ? <p className="admin-submission-message admin-submission-message--error">{error}</p> : null}
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" disabled={isRevoking} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="segmented-button segmented-button--danger" disabled={isRevoking || reason.trim().length < 8} type="submit">
            {isRevoking ? 'Revoking...' : 'Revoke Certificate'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ManualCertificateIssueForm({
  duplicateOverride,
  error,
  isIssuing,
  manualStudentEmail,
  manualStudentName,
  onDuplicateOverrideChange,
  onManualStudentEmailChange,
  onManualStudentNameChange,
  onProgramChange,
  onProgramNameChange,
  onStudentSearchChange,
  onStudentSourceChange,
  onSubmit,
  programKey,
  programName,
  programs,
  projectRoles,
  selectedStudentId,
  setCertificateType,
  setDurationWeeks,
  setIssueDate,
  setProjectRole,
  setProjectStartDate,
  setProjectTitle,
  setSelectedStudentId,
  setSendEmail,
  studentSearch,
  studentSource,
  students,
  type,
  values
}: {
  duplicateOverride: boolean;
  error?: string;
  isIssuing: boolean;
  manualStudentEmail: string;
  manualStudentName: string;
  onDuplicateOverrideChange: (checked: boolean) => void;
  onManualStudentEmailChange: (value: string) => void;
  onManualStudentNameChange: (value: string) => void;
  onProgramChange: (programKey: string) => void;
  onProgramNameChange: (value: string) => void;
  onStudentSearchChange: (value: string) => void;
  onStudentSourceChange: (source: 'manual' | 'roster') => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  programKey: string;
  programName: string;
  programs: AdminProgram[];
  projectRoles: AdminProjectRole[];
  selectedStudentId: string;
  setCertificateType: (value: AdminCertificateType) => void;
  setDurationWeeks: (value: number) => void;
  setIssueDate: (value: string) => void;
  setProjectRole: (value: string) => void;
  setProjectStartDate: (value: string) => void;
  setProjectTitle: (value: string) => void;
  setSelectedStudentId: (value: string) => void;
  setSendEmail: (checked: boolean) => void;
  studentSearch: string;
  studentSource: 'manual' | 'roster';
  students: AdminStudent[];
  type: AdminCertificateType;
  values: {
    durationWeeks: number;
    issueDate: string;
    projectRole: string;
    projectStartDate: string;
    projectTitle: string;
    sendEmail: boolean;
  };
}) {
  const selectedProgram = programs.find((program) => program.programKey === programKey);
  const resolvedProgramName = selectedProgram?.name ?? programName;
  const sortedProjectRoles = useMemo(() => [...projectRoles].sort((a, b) => a.name.localeCompare(b.name)), [projectRoles]);
  const hasStudent = studentSource === 'manual' ? manualStudentName.trim() && manualStudentEmail.trim() : selectedStudentId;
  const canSubmit =
    Boolean(hasStudent) &&
    Boolean(resolvedProgramName.trim()) &&
    isValidDateInput(values.issueDate) &&
    (type === 'leadership' || (values.projectTitle.trim() && values.projectRole.trim() && isValidDateInput(values.projectStartDate)));

  return (
    <section className="certificate-section">
      <header className="certificate-section__header">
        <div>
          <span className="certificate-section-eyebrow">Direct Issue</span>
          <h2>Manual Certificate</h2>
        </div>
      </header>
      <form className="certificate-section__body certificate-form" onSubmit={onSubmit}>
        <div className="certificate-muted-card">
          <ShieldCheck size={17} />
          <span>This creates a certificate record directly. Existing Leadership and Live Project request flows are unchanged.</span>
        </div>

        <label className="certificate-field">
          <span>Certificate type *</span>
          <select value={type} onChange={(event) => setCertificateType(event.target.value as AdminCertificateType)}>
            <option value="leadership">Leadership Program</option>
            <option value="live_project">Live Project</option>
          </select>
        </label>

        <label className="certificate-field">
          <span>Student source *</span>
          <select value={studentSource} onChange={(event) => onStudentSourceChange(event.target.value as 'manual' | 'roster')}>
            <option value="roster">Search student roster</option>
            <option value="manual">Manual external student</option>
          </select>
        </label>

        {studentSource === 'roster' ? (
          <>
            <label className="certificate-field">
              <span>Search student</span>
              <input onChange={(event) => onStudentSearchChange(event.target.value)} placeholder="Name, email, or student ID" type="search" value={studentSearch} />
            </label>
            <label className="certificate-field">
              <span>Student *</span>
              <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName} · {student.email}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="certificate-field">
              <span>Student name *</span>
              <input onChange={(event) => onManualStudentNameChange(event.target.value)} placeholder="Student full name" value={manualStudentName} />
            </label>
            <label className="certificate-field">
              <span>Student email *</span>
              <input onChange={(event) => onManualStudentEmailChange(event.target.value)} placeholder="student@example.com" type="email" value={manualStudentEmail} />
            </label>
          </>
        )}

        <label className="certificate-field">
          <span>Program</span>
          <select value={programKey} onChange={(event) => onProgramChange(event.target.value)}>
            <option value="">Manual program name</option>
            {programs.map((program) => (
              <option key={program.id} value={program.programKey}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <label className="certificate-field">
          <span>Program name *</span>
          <input
            disabled={Boolean(selectedProgram)}
            onChange={(event) => onProgramNameChange(event.target.value)}
            placeholder="Certificate program name"
            readOnly={Boolean(selectedProgram)}
            value={resolvedProgramName}
          />
        </label>

        {type === 'live_project' ? (
          <>
            <label className="certificate-field">
              <span>Project title *</span>
              <input onChange={(event) => setProjectTitle(event.target.value)} placeholder="Live project title" value={values.projectTitle} />
            </label>
            <label className="certificate-field">
              <span>Project role *</span>
              <select value={values.projectRole} onChange={(event) => setProjectRole(event.target.value)}>
                <option value="">Select active project role</option>
                {sortedProjectRoles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {[role.name, role.category].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="certificate-field">
              <span>Start date *</span>
              <input onChange={(event) => setProjectStartDate(event.target.value)} type="date" value={values.projectStartDate} />
            </label>
            <label className="certificate-field">
              <span>Duration</span>
              <select value={values.durationWeeks} onChange={(event) => setDurationWeeks(Number(event.target.value))}>
                {durationOptions.map((weeks) => (
                  <option key={weeks} value={weeks}>
                    {weeks} weeks
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <label className="certificate-field">
          <span>Issue date *</span>
          <input onChange={(event) => setIssueDate(event.target.value)} type="date" value={values.issueDate} />
        </label>
        <label className="certificate-checkbox">
          <input checked={values.sendEmail} onChange={(event) => setSendEmail(event.target.checked)} type="checkbox" />
          <span>Send certificate email after PDF generation</span>
        </label>
        <label className="certificate-checkbox">
          <input checked={duplicateOverride} onChange={(event) => onDuplicateOverrideChange(event.target.checked)} type="checkbox" />
          <span>I understand this may issue a duplicate certificate if one already exists.</span>
        </label>
        {error ? <p className="admin-submission-message admin-submission-message--error">{error}</p> : null}
        <button className="student-action student-action--primary certificate-form__submit certificate-form__submit--issue" disabled={isIssuing || !canSubmit} type="submit">
          <UserPlus size={18} />
          {isIssuing ? 'Issuing...' : 'Issue Manual Certificate'}
        </button>
      </form>
    </section>
  );
}

export function AdminCertificatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as CertificateWorkspaceTab | null) ?? 'leadership';
  const [activeTab, setActiveTab] = useState<CertificateWorkspaceTab>(certificateTabs.some((tab) => tab.id === initialTab) ? initialTab : 'leadership');
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
  const [studentPickerSearch, setStudentPickerSearch] = useState('');
  const [moduleProgramKey, setModuleProgramKey] = useState('');
  const [moduleStatus, setModuleStatus] = useState<'active' | 'inactive'>('active');
  const [moduleText, setModuleText] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AdminCertificateRequest | null>(null);
  const [certificateToRevoke, setCertificateToRevoke] = useState<AdminCertificate | null>(null);
  const [certificateMessage, setCertificateMessage] = useState('');
  const [manualCertificateType, setManualCertificateType] = useState<AdminCertificateType>('leadership');
  const [manualStudentSource, setManualStudentSource] = useState<'manual' | 'roster'>('roster');
  const [manualStudentSearch, setManualStudentSearch] = useState('');
  const [manualSelectedStudentId, setManualSelectedStudentId] = useState('');
  const [manualStudentName, setManualStudentName] = useState('');
  const [manualStudentEmail, setManualStudentEmail] = useState('');
  const [manualProgramKey, setManualProgramKey] = useState('');
  const [manualProgramName, setManualProgramName] = useState('');
  const [manualIssueDate, setManualIssueDate] = useState(todayInputValue());
  const [manualSendEmail, setManualSendEmail] = useState(true);
  const [manualProjectTitle, setManualProjectTitle] = useState('');
  const [manualProjectRole, setManualProjectRole] = useState('');
  const [manualProjectStartDate, setManualProjectStartDate] = useState(todayInputValue());
  const [manualDurationWeeks, setManualDurationWeeks] = useState(4);
  const [manualDuplicateOverride, setManualDuplicateOverride] = useState(false);

  const adminProfileQuery = useAdminProfile();
  const adminRole = adminProfileQuery.data?.role;
  const canIssueCertificates = Boolean(adminRole) && hasAdminPermission(adminRole, 'admin.certificates.issue', adminProfileQuery.data?.permissions);
  const certificatesQuery = useAdminCertificates({
    certificateType,
    generationStatus,
    page,
    search,
    status
  });
  const requestsQuery = useAdminCertificateRequests({
    adminStatus: 'pending',
    limit: 10,
    moderatorStatus: 'approved',
    page: 1
  });
  const certificateSettingsQuery = useAdminCertificateProgramSettings();
  const issueCertificateMutation = useIssueLiveProjectCertificate();
  const issueLeadershipMutation = useIssueLeadershipCertificates();
  const issueManualMutation = useIssueManualCertificate();
  const generateCertificatePdfMutation = useGenerateAdminCertificatePdf();
  const revokeCertificateMutation = useRevokeAdminCertificate();
  const saveSettingMutation = useSaveCertificateProgramSetting();
  const programsQuery = useAdminPrograms({
    limit: 100,
    page: 1,
    status: 'active'
  });
  const projectRolesQuery = useAdminProjectRoles({
    enabled: canIssueCertificates && activeTab === 'manual' && manualCertificateType === 'live_project',
    limit: 500,
    page: 1,
    status: 'active'
  });
  const cohortsPageOneQuery = useAdminCohorts({
    limit: 100,
    page: 1,
    status: 'all'
  });
  const cohortsPageTwoQuery = useAdminCohorts({
    enabled: cohortsPageOneQuery.data?.hasNextPage === true,
    limit: 100,
    page: 2,
    status: 'all'
  });
  const cohortsPageThreeQuery = useAdminCohorts({
    enabled: cohortsPageTwoQuery.data?.hasNextPage === true,
    limit: 100,
    page: 3,
    status: 'all'
  });
  const studentsQuery = useAdminStudents({
    cohortName: selectedCohortName || undefined,
    limit: 500,
    page: 1,
    status: 'active'
  });
  const manualStudentsQuery = useAdminStudents({
    enabled: canIssueCertificates && activeTab === 'manual' && manualStudentSource === 'roster',
    limit: 10,
    page: 1,
    search: manualStudentSearch || undefined,
    status: 'active'
  });

  const programs = programsQuery.data?.items ?? [];
  const projectRoles = projectRolesQuery.data?.items ?? [];
  const allCohorts = useMemo(
    () => dedupeCohorts([cohortsPageOneQuery.data?.items, cohortsPageTwoQuery.data?.items, cohortsPageThreeQuery.data?.items]),
    [cohortsPageOneQuery.data?.items, cohortsPageTwoQuery.data?.items, cohortsPageThreeQuery.data?.items]
  );
  const selectedProgram = useMemo(() => programs.find((program) => program.programKey === selectedProgramKey), [programs, selectedProgramKey]);
  const moduleProgram = useMemo(() => programs.find((program) => program.programKey === moduleProgramKey), [programs, moduleProgramKey]);
  const certificateSettings = certificateSettingsQuery.data?.items ?? [];
  const settingsByProgramKey = useMemo(() => new Map(certificateSettings.map((setting) => [setting.programKey, setting])), [certificateSettings]);
  const filteredCohorts = useMemo(() => allCohorts.filter((cohort) => isCohortForProgram(cohort, selectedProgram)).sort((a, b) => a.name.localeCompare(b.name)), [allCohorts, selectedProgram]);
  const eligibleStudents = studentsQuery.data?.items ?? [];
  const filteredEligibleStudents = useMemo(() => {
    const term = studentPickerSearch.trim().toLowerCase();
    if (!term) return eligibleStudents;
    return eligibleStudents.filter((student) => `${student.fullName} ${student.email} ${student.studentId ?? ''}`.toLowerCase().includes(term));
  }, [eligibleStudents, studentPickerSearch]);
  const allFilteredStudentsSelected = filteredEligibleStudents.length > 0 && filteredEligibleStudents.every((student) => selectedStudentIds.has(student.id));
  const selectedStudentCountExceedsBatchLimit = selectedStudentIds.size > leadershipCertificateBatchLimit;
  const manualStudentOptions = manualStudentsQuery.data?.items ?? [];
  const certificates = certificatesQuery.data;
  const totalPages = certificates?.totalPages ?? 1;
  const visibleCertificateTabs = useMemo(() => (canIssueCertificates ? certificateTabs : certificateTabs.filter((tab) => tab.id === 'issued')), [canIssueCertificates]);

  useEffect(() => {
    if (!canIssueCertificates && activeTab !== 'issued') setActiveTab('issued');
  }, [activeTab, canIssueCertificates]);

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
    const setting = settingsByProgramKey.get(programKey);
    setSelectedProgramKey(programKey);
    setSelectedCohortName('');
    setSelectedStudentIds(new Set());
    setStudentPickerSearch('');
    setModulesCovered(moduleTextFromSetting(setting, leadershipModuleDefaults[programShortKey(program)] ?? ''));
  }

  function handleModuleProgramChange(programKey: string) {
    const program = programs.find((item) => item.programKey === programKey);
    const setting = settingsByProgramKey.get(programKey);
    setModuleProgramKey(programKey);
    setModuleStatus(setting?.status ?? 'active');
    setModuleText(moduleTextFromSetting(setting, leadershipModuleDefaults[programShortKey(program)] ?? ''));
  }

  function handleManualProgramChange(programKey: string) {
    const program = programs.find((item) => item.programKey === programKey);
    setManualProgramKey(programKey);
    setManualProgramName(program?.name ?? '');
  }

  function handleManualStudentSourceChange(source: 'manual' | 'roster') {
    setManualStudentSource(source);
    setManualSelectedStudentId('');
    setManualStudentSearch('');
    if (source === 'roster') {
      setManualStudentName('');
      setManualStudentEmail('');
    }
  }

  function handleManualStudentSearchChange(value: string) {
    setManualStudentSearch(value);
    setManualSelectedStudentId('');
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

  function selectFilteredStudents() {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      for (const student of filteredEligibleStudents) next.add(student.id);
      return next;
    });
  }

  function clearSelectedStudents() {
    setSelectedStudentIds(new Set());
  }

  async function handleIssueLiveProjectCertificate(input: IssueLiveProjectCertificateInput) {
    const result = await issueCertificateMutation.mutateAsync(input);
    setCertificateMessage(result.message);
    setSelectedRequest(null);
  }

  async function handleIssueLeadershipCertificates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: IssueLeadershipCertificatesInput = {
      cohortName: selectedCohortName,
      issueDate,
      modulesCovered: modulesFromText(modulesCovered),
      programKey: selectedProgramKey,
      programName: selectedProgram?.name,
      sendEmail,
      studentIds: [...selectedStudentIds]
    };
    const result = await issueLeadershipMutation.mutateAsync(body);
    setCertificateMessage(result.message);
    setSelectedStudentIds(new Set());
  }

  async function handleIssueManualCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedManualProgram = programs.find((program) => program.programKey === manualProgramKey);
    const setting = settingsByProgramKey.get(manualProgramKey);
    const modulesCovered = modulesFromText(moduleTextFromSetting(setting, leadershipModuleDefaults[programShortKey(selectedManualProgram)] ?? manualProgramName ?? manualProgramKey));
    const body: IssueManualCertificateInput = {
      acknowledgeDuplicate: manualDuplicateOverride,
      certificateType: manualCertificateType,
      durationWeeks: manualCertificateType === 'live_project' ? manualDurationWeeks : undefined,
      issueDate: manualIssueDate,
      manualStudentEmail: manualStudentSource === 'manual' ? manualStudentEmail : undefined,
      manualStudentName: manualStudentSource === 'manual' ? manualStudentName : undefined,
      modulesCovered: manualCertificateType === 'leadership' ? modulesCovered : undefined,
      programKey: manualProgramKey || undefined,
      programName: (selectedManualProgram?.name ?? manualProgramName).trim(),
      projectRole: manualCertificateType === 'live_project' ? manualProjectRole : undefined,
      projectStartDate: manualCertificateType === 'live_project' ? manualProjectStartDate : undefined,
      projectTitle: manualCertificateType === 'live_project' ? manualProjectTitle : undefined,
      sendEmail: manualSendEmail,
      studentId: manualStudentSource === 'roster' ? manualSelectedStudentId : undefined
    };
    const result = await issueManualMutation.mutateAsync(body);
    setCertificateMessage(result.message);
    setManualDuplicateOverride(false);
  }

  async function handleSaveProgramModules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await saveSettingMutation.mutateAsync({
      modulesCovered: modulesFromText(moduleText),
      programKey: moduleProgramKey,
      status: moduleStatus
    });
    setCertificateMessage(`Module template saved for ${programLabel(moduleProgram, result.programKey)}.`);
  }

  async function handleRevokeCertificate(reason: string) {
    if (!certificateToRevoke) return;
    const result = await revokeCertificateMutation.mutateAsync({
      certificateId: certificateToRevoke.id,
      reason
    });
    setCertificateMessage(`${result.certificateId} revoked.`);
    setCertificateToRevoke(null);
  }

  async function handleGenerateCertificatePdf(certificate: AdminCertificate) {
    const result = await generateCertificatePdfMutation.mutateAsync({
      certificateId: certificate.id,
      force: certificate.generationStatus !== 'ready'
    });
    const firstResult = result.results[0];
    if (firstResult?.status === 'failed') {
      setCertificateMessage(firstResult.error ?? 'PDF generation failed.');
      return;
    }
    if (firstResult?.signedUrl) {
      window.open(firstResult.signedUrl, '_blank', 'noopener,noreferrer');
    }
    setCertificateMessage(result.message);
  }

  async function handleEmailCertificatePdf(certificate: AdminCertificate) {
    const result = await generateCertificatePdfMutation.mutateAsync({
      certificateId: certificate.id,
      force: certificate.generationStatus !== 'ready',
      sendEmail: true
    });
    const firstResult = result.results[0];
    if (firstResult?.status === 'failed') {
      setCertificateMessage(firstResult.error ?? 'Certificate email failed.');
      return;
    }
    setCertificateMessage(`Certificate PDF email sent to ${certificate.studentEmail}.`);
  }

  function changeTab(tab: CertificateWorkspaceTab) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'issued') next.set('page', '1');
    setSearchParams(next);
  }

  const pageIsLoading = certificatesQuery.isLoading || requestsQuery.isLoading || certificateSettingsQuery.isLoading || programsQuery.isLoading || cohortsPageOneQuery.isLoading;
  const pageHasError = certificatesQuery.isError || requestsQuery.isError || certificateSettingsQuery.isError || programsQuery.isError || cohortsPageOneQuery.isError;

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
      <PageHeader description="Issue leadership certificates, review live project certificate requests, and monitor issued certificate records." eyebrow="Module refresh" title="Certificates" />

      <nav className="certificate-workspace-tabs" aria-label="Certificate workspace tabs">
        {visibleCertificateTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'certificate-workspace-tab certificate-workspace-tab--active' : 'certificate-workspace-tab'}
            key={tab.id}
            onClick={() => changeTab(tab.id)}
            type="button"
          >
            <strong>{tab.label}</strong>
            <span>{tab.description}</span>
          </button>
        ))}
      </nav>

      {certificateMessage ? <p className="admin-submission-message">{certificateMessage}</p> : null}

      {activeTab === 'leadership' && canIssueCertificates ? (
        <section className="admin-certificate-workspace-grid">
          <form className="certificate-section" onSubmit={handleIssueLeadershipCertificates}>
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
                    setStudentPickerSearch('');
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
                <div className="eligible-student-panel__header">
                  <div>
                    <h3>Eligible Students</h3>
                    {selectedCohortName && eligibleStudents.length > 0 ? (
                      <p>
                        {selectedStudentIds.size} selected · {filteredEligibleStudents.length} shown · {eligibleStudents.length} loaded
                      </p>
                    ) : null}
                  </div>
                  {eligibleStudents.length > 0 ? (
                    <div className="eligible-student-panel__actions">
                      <button className="student-action student-action--secondary" disabled={filteredEligibleStudents.length === 0 || allFilteredStudentsSelected} onClick={selectFilteredStudents} type="button">
                        Select filtered
                      </button>
                      <button className="student-action student-action--secondary" disabled={selectedStudentIds.size === 0} onClick={clearSelectedStudents} type="button">
                        Clear selected
                      </button>
                    </div>
                  ) : null}
                </div>
                {!selectedCohortName ? <p>Select a program and cohort to load eligible students.</p> : null}
                {selectedCohortName && studentsQuery.isLoading ? <p>Loading eligible students.</p> : null}
                {selectedCohortName && !studentsQuery.isLoading && eligibleStudents.length === 0 ? <p>No active students found for this cohort.</p> : null}
                {eligibleStudents.length > 0 ? (
                  <label className="eligible-student-search">
                    <Search size={18} />
                    <input onChange={(event) => setStudentPickerSearch(event.target.value)} placeholder="Search by student name, email, or ID" value={studentPickerSearch} />
                  </label>
                ) : null}
                {eligibleStudents.length > 0 ? (
                  <div className="eligible-student-list">
                    {filteredEligibleStudents.map((student) => (
                      <label className="eligible-student-item" key={student.id}>
                        <input checked={selectedStudentIds.has(student.id)} onChange={() => toggleStudent(student.id)} type="checkbox" />
                        <span>
                          <strong>{student.fullName}</strong>
                          <small>{student.email}</small>
                        </span>
                      </label>
                    ))}
                    {filteredEligibleStudents.length === 0 ? <p>No students match this search.</p> : null}
                  </div>
                ) : null}
                {selectedStudentCountExceedsBatchLimit ? <p className="eligible-student-panel__warning">Leadership certificate issuance is limited to {leadershipCertificateBatchLimit} students at a time. Please narrow the search or clear a few selections.</p> : null}
              </div>
              {issueLeadershipMutation.isError ? <p className="admin-submission-message admin-submission-message--error">{issueLeadershipMutation.error.message}</p> : null}
              <button
                className="student-action student-action--primary certificate-form__submit certificate-form__submit--issue"
                disabled={issueLeadershipMutation.isPending || !selectedProgramKey || !selectedCohortName || selectedStudentIds.size === 0 || selectedStudentCountExceedsBatchLimit || modulesFromText(modulesCovered).length === 0}
                type="submit"
              >
                <FileCheck2 size={18} />
                {issueLeadershipMutation.isPending ? 'Issuing...' : 'Issue selected certificates'}
              </button>
            </div>
          </form>

          <form className="certificate-section" onSubmit={handleSaveProgramModules}>
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
              {saveSettingMutation.isError ? <p className="admin-submission-message admin-submission-message--error">{saveSettingMutation.error.message}</p> : null}
              <button className="button-primary certificate-form__submit" disabled={saveSettingMutation.isPending || !moduleProgramKey || modulesFromText(moduleText).length === 0} type="submit">
                {saveSettingMutation.isPending ? 'Saving...' : 'Save Program Modules →'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === 'live-projects' && canIssueCertificates ? <RequestQueue isLoading={requestsQuery.isLoading} items={requestsQuery.data?.items ?? []} onReview={setSelectedRequest} /> : null}

      {activeTab === 'manual' && canIssueCertificates ? (
        <ManualCertificateIssueForm
          duplicateOverride={manualDuplicateOverride}
          error={issueManualMutation.isError ? issueManualMutation.error.message : undefined}
          isIssuing={issueManualMutation.isPending}
          manualStudentEmail={manualStudentEmail}
          manualStudentName={manualStudentName}
          onDuplicateOverrideChange={setManualDuplicateOverride}
          onManualStudentEmailChange={setManualStudentEmail}
          onManualStudentNameChange={setManualStudentName}
          onProgramChange={handleManualProgramChange}
          onProgramNameChange={setManualProgramName}
          onStudentSearchChange={handleManualStudentSearchChange}
          onStudentSourceChange={handleManualStudentSourceChange}
          onSubmit={handleIssueManualCertificate}
          programKey={manualProgramKey}
          programName={manualProgramName}
          programs={programs}
          projectRoles={projectRoles}
          selectedStudentId={manualSelectedStudentId}
          setCertificateType={setManualCertificateType}
          setDurationWeeks={setManualDurationWeeks}
          setIssueDate={setManualIssueDate}
          setProjectRole={setManualProjectRole}
          setProjectStartDate={setManualProjectStartDate}
          setProjectTitle={setManualProjectTitle}
          setSelectedStudentId={setManualSelectedStudentId}
          setSendEmail={setManualSendEmail}
          studentSearch={manualStudentSearch}
          studentSource={manualStudentSource}
          students={manualStudentOptions}
          type={manualCertificateType}
          values={{
            durationWeeks: manualDurationWeeks,
            issueDate: manualIssueDate,
            projectRole: manualProjectRole,
            projectStartDate: manualProjectStartDate,
            projectTitle: manualProjectTitle,
            sendEmail: manualSendEmail
          }}
        />
      ) : null}

      {activeTab === 'issued' ? (
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
                      {certificate.verificationUrl ? (
                        <a className="segmented-button" href={certificate.verificationUrl} rel="noreferrer" target="_blank">
                          Verify
                        </a>
                      ) : (
                        <button className="segmented-button" disabled type="button">
                          {lockedButtonLabel('Verify')}
                        </button>
                      )}
                      {canIssueCertificates ? (
                        <>
                          <button
                            className="segmented-button"
                            disabled={certificate.status === 'revoked' || generateCertificatePdfMutation.isPending}
                            onClick={() => void handleGenerateCertificatePdf(certificate)}
                            type="button"
                          >
                            {generateCertificatePdfMutation.isPending
                              ? 'Preparing...'
                              : certificate.status === 'revoked'
                                ? lockedButtonLabel('PDF')
                                : certificate.generationStatus === 'ready'
                                  ? 'Download PDF'
                                  : 'Retry PDF'}
                          </button>
                          <button
                            className="segmented-button"
                            disabled={certificate.status === 'revoked' || generateCertificatePdfMutation.isPending}
                            onClick={() => void handleEmailCertificatePdf(certificate)}
                            type="button"
                          >
                            {generateCertificatePdfMutation.isPending ? 'Sending...' : certificate.status === 'revoked' ? lockedButtonLabel('Email') : 'Email PDF'}
                          </button>
                          <button className="segmented-button segmented-button--danger" disabled={certificate.status === 'revoked'} onClick={() => setCertificateToRevoke(certificate)} type="button">
                            {certificate.status === 'revoked' ? 'Revoked' : 'Revoke'}
                          </button>
                        </>
                      ) : null}
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
      ) : null}

      {selectedRequest && canIssueCertificates ? (
        <FinalIssuanceModal
          error={issueCertificateMutation.isError ? issueCertificateMutation.error.message : undefined}
          isIssuing={issueCertificateMutation.isPending}
          onClose={() => setSelectedRequest(null)}
          onIssue={handleIssueLiveProjectCertificate}
          request={selectedRequest}
        />
      ) : null}
      {certificateToRevoke && canIssueCertificates ? (
        <RevokeCertificateModal
          certificate={certificateToRevoke}
          error={revokeCertificateMutation.isError ? revokeCertificateMutation.error.message : undefined}
          isRevoking={revokeCertificateMutation.isPending}
          onClose={() => setCertificateToRevoke(null)}
          onRevoke={handleRevokeCertificate}
        />
      ) : null}
    </div>
  );
}
