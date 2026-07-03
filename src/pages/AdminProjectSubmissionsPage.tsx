import { Check, ExternalLink, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminCohorts } from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';
import { useAdminProjectRoles } from '../features/admin/useAdminProjects';
import {
  AdminProjectSubmission,
  AdminProjectSubmissionStatusFilter,
  useAdminProjectSubmissions,
  useReviewAdminProjectSubmission
} from '../features/admin/useAdminProjectSubmissions';

const statusOptions: AdminProjectSubmissionStatusFilter[] = ['pending', 'duplicates', 'approved', 'changes_requested', 'rejected', 'submitted', 'under_review', 'all'];

const statusLabels: Record<AdminProjectSubmissionStatusFilter, string> = {
  all: 'All statuses',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
  duplicates: 'Repeat Submissions',
  pending: 'Pending Approval',
  rejected: 'Rejected',
  submitted: 'Submitted',
  under_review: 'Under Review'
};

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseStatus(value: string | null): AdminProjectSubmissionStatusFilter {
  return statusOptions.includes(value as AdminProjectSubmissionStatusFilter) ? (value as AdminProjectSubmissionStatusFilter) : 'pending';
}

function buildPageLink(
  page: number,
  search: string,
  status: AdminProjectSubmissionStatusFilter,
  programKey: string,
  roleId: string,
  cohortName: string,
  submittedDate: string
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'pending') params.set('status', status);
  if (programKey) params.set('programKey', programKey);
  if (roleId) params.set('roleId', roleId);
  if (cohortName) params.set('cohortName', cohortName);
  if (submittedDate) params.set('submittedDate', submittedDate);
  return `?${params.toString()}`;
}

function formatDate(value: string | undefined) {
  if (!value) return 'Not submitted';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ');
}

function reviewable(item: AdminProjectSubmission) {
  return item.status === 'submitted' || item.status === 'under_review';
}

export function AdminProjectSubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search')?.trim() ?? '';
  const programKey = searchParams.get('programKey')?.trim() ?? '';
  const roleId = searchParams.get('roleId')?.trim() ?? '';
  const cohortName = searchParams.get('cohortName')?.trim() ?? '';
  const submittedDate = searchParams.get('submittedDate')?.trim().slice(0, 10) ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [message, setMessage] = useState('');
  const submissionsQuery = useAdminProjectSubmissions({ cohortName, page, programKey, roleId, search, status, submittedDate });
  const programsQuery = useAdminPrograms({ limit: 200, status: 'all' });
  const rolesQuery = useAdminProjectRoles({ limit: 200, status: 'all' });
  const cohortsQuery = useAdminCohorts({ limit: 300, status: 'all' });
  const reviewMutation = useReviewAdminProjectSubmission();
  const data = submissionsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const repeatCount = useMemo(() => data?.items.filter((item) => item.isRepeatSubmission).length ?? 0, [data?.items]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    const trimmed = value.trim();
    if (trimmed) next.set(key, trimmed);
    else next.delete(key);
    if (key === 'status' && trimmed === 'pending') next.delete('status');
    setSearchParams(next);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParam('search', searchInput);
  }

  async function handleApprove(item: AdminProjectSubmission) {
    setMessage('');
    await reviewMutation.mutateAsync({ action: 'approve', requestId: item.id });
    setMessage(`${item.requestNumber ?? item.id} approved.`);
  }

  async function handleReject(item: AdminProjectSubmission) {
    const reviewNote = window.prompt('Add rejection reason for this submission')?.trim();
    if (!reviewNote) {
      setMessage('Reject needs a review note.');
      return;
    }
    await reviewMutation.mutateAsync({ action: 'reject', requestId: item.id, reviewNote });
    setMessage(`${item.requestNumber ?? item.id} rejected.`);
  }

  async function handleChangesRequested(item: AdminProjectSubmission) {
    const reviewNote = window.prompt('Add changes requested note for this submission')?.trim();
    if (!reviewNote) {
      setMessage('Changes requested needs a review note.');
      return;
    }
    await reviewMutation.mutateAsync({ action: 'changes-requested', requestId: item.id, reviewNote });
    setMessage(`${item.requestNumber ?? item.id} marked as changes requested.`);
  }

  if (submissionsQuery.isLoading) {
    return (
      <div className="admin-submission-page">
        <LoadingState />
      </div>
    );
  }

  if (submissionsQuery.isError) {
    return (
      <div className="admin-submission-page">
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="admin-submission-page">
      <section className="admin-submission-shell">
        <header className="admin-panel-header">
          <span className="section-eyebrow">Submission Management</span>
          <h1>Project Submission Requests</h1>
        </header>

        <div className="admin-submission-body">
          <form className="admin-submission-filters" onSubmit={handleSearch}>
            <label className="admin-submission-search">
              <Search size={15} />
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search student, email, request or project..." type="search" />
            </label>
            <select value={status} onChange={(event) => setParam('status', event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option]}
                </option>
              ))}
            </select>
            <select value={roleId} onChange={(event) => setParam('roleId', event.target.value)}>
              <option value="">All roles</option>
              {rolesQuery.data?.items.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <select value={programKey} onChange={(event) => setParam('programKey', event.target.value)}>
              <option value="">All programs</option>
              {programsQuery.data?.items.map((program) => (
                <option key={program.programKey} value={program.programKey}>
                  {program.name}
                </option>
              ))}
            </select>
            <select value={cohortName} onChange={(event) => setParam('cohortName', event.target.value)}>
              <option value="">All cohorts</option>
              {cohortsQuery.data?.items.map((cohort) => (
                <option key={cohort.id} value={cohort.name}>
                  {cohort.name}
                </option>
              ))}
            </select>
            <input aria-label="Submitted date" value={submittedDate} onChange={(event) => setParam('submittedDate', event.target.value)} type="date" />
          </form>

          <div className="admin-submission-repeat-note">
            <ShieldCheck size={17} />
            <div>
              <strong>{repeatCount} active repeat submission(s)</strong>
              <span>found across the current project queue.</span>
            </div>
          </div>

          {message || reviewMutation.isError ? (
            <p className={reviewMutation.isError ? 'admin-submission-message admin-submission-message--error' : 'admin-submission-message'}>
              {reviewMutation.isError ? reviewMutation.error.message : message}
            </p>
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="admin-submission-list">
              {data.items.map((item) => (
                <SubmissionRow disabled={reviewMutation.isPending} item={item} key={item.id} onApprove={handleApprove} onChangesRequested={handleChangesRequested} onReject={handleReject} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </section>

      <nav className="pagination-bar" aria-label="Admin project submission pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, status, programKey, roleId, cohortName, submittedDate)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, status, programKey, roleId, cohortName, submittedDate)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>
    </div>
  );
}

function SubmissionRow({
  disabled,
  item,
  onApprove,
  onChangesRequested,
  onReject
}: {
  disabled: boolean;
  item: AdminProjectSubmission;
  onApprove: (item: AdminProjectSubmission) => Promise<void>;
  onChangesRequested: (item: AdminProjectSubmission) => Promise<void>;
  onReject: (item: AdminProjectSubmission) => Promise<void>;
}) {
  return (
    <article className="admin-submission-row">
      <div className="admin-submission-row__main">
        <div className="admin-submission-row__title">
          <h2>{item.projectTitle ?? item.requestNumber ?? item.id}</h2>
          <div className="chip-row">
            <StatusBadge tone={item.status === 'approved' ? 'safe' : item.status === 'rejected' ? 'danger' : 'warning'}>{formatStatus(item.status)}</StatusBadge>
            {item.isRepeatSubmission ? <StatusBadge tone="warning">{`repeat #${item.attemptNumber}`}</StatusBadge> : null}
            {item.programKey ? <StatusBadge>{item.programKey}</StatusBadge> : null}
            {item.cohortName ? <StatusBadge>{item.cohortName}</StatusBadge> : null}
          </div>
        </div>
        <p>{item.roleName ?? item.roleId ?? 'Project role not mapped'}</p>
        <p>
          {item.studentName ?? item.studentEmail} · {item.studentEmail}
        </p>
        <p>
          {item.requestNumber ?? item.id} · {formatDate(item.submittedAt)}
        </p>
        {item.remarks ? <p>{item.remarks}</p> : null}
      </div>

      <div className="admin-submission-row__actions">
        {item.submissionLink ? (
          <a className="segmented-button" href={item.submissionLink} rel="noreferrer" target="_blank">
            <ExternalLink size={14} />
            Review Report
          </a>
        ) : (
          <button className="segmented-button" disabled type="button">
            No Report
          </button>
        )}
        {reviewable(item) ? (
          <>
            <button className="segmented-button segmented-button--success" disabled={disabled} onClick={() => onApprove(item)} type="button">
              <Check size={14} />
              Approve
            </button>
            <button className="segmented-button" disabled={disabled} onClick={() => onChangesRequested(item)} type="button">
              <RotateCcw size={14} />
              Request Changes
            </button>
            <button className="segmented-button segmented-button--danger" disabled={disabled} onClick={() => onReject(item)} type="button">
              <X size={14} />
              Reject
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
