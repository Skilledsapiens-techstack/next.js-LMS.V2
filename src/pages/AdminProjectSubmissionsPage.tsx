import { Check, ExternalLink, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
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
import { nextSortState, sortRows, SortState } from '../lib/sortUtils';

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

function formatDateOnly(value: string | undefined) {
  if (!value) return '-';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ');
}

function reviewable(item: AdminProjectSubmission) {
  return item.status === 'submitted' || item.status === 'under_review';
}

function yesNo(value: boolean | null | undefined) {
  if (value === undefined || value === null) return '-';
  return value ? 'Yes' : 'No';
}

function safeUrl(value: string | undefined) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function uniqueLabels(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' })
  );
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const submissionsQuery = useAdminProjectSubmissions({ cohortName, page, programKey, roleId, search, status, submittedDate });
  const detailedSubmissionsQuery = useAdminProjectSubmissions({ cohortName, limit: 500, page: 1, programKey, roleId, search, status, submittedDate });
  const programsQuery = useAdminPrograms({ limit: 200, status: 'all' });
  const rolesQuery = useAdminProjectRoles({ limit: 200, status: 'all' });
  const cohortsQuery = useAdminCohorts({ limit: 300, status: 'all' });
  const reviewMutation = useReviewAdminProjectSubmission();
  const data = submissionsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const repeatCount = useMemo(() => data?.items.filter((item) => item.isRepeatSubmission).length ?? 0, [data?.items]);
  const selectableItems = useMemo(() => data?.items.filter(reviewable) ?? [], [data?.items]);
  const selectableIds = useMemo(() => selectableItems.map((item) => item.id), [selectableItems]);
  const selectedItems = useMemo(() => selectableItems.filter((item) => selectedIds.includes(item.id)), [selectableItems, selectedIds]);
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => selectableIds.includes(id)));
  }, [selectableIds]);

  useEffect(() => {
    if (!detailsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setDetailsOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [detailsOpen]);

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
    setSelectedIds((current) => current.filter((id) => id !== item.id));
  }

  async function handleApproveSelected() {
    if (selectedItems.length === 0) return;
    const confirmed = window.confirm(`Approve ${selectedItems.length} selected project submission${selectedItems.length === 1 ? '' : 's'}?`);
    if (!confirmed) return;

    setMessage('');
    const itemsToApprove = [...selectedItems];
    for (const item of itemsToApprove) {
      await reviewMutation.mutateAsync({ action: 'approve', requestId: item.id });
    }
    setSelectedIds([]);
    setMessage(`${itemsToApprove.length} selected project submission${itemsToApprove.length === 1 ? '' : 's'} approved.`);
  }

  function toggleSelection(item: AdminProjectSubmission, checked: boolean) {
    if (!reviewable(item)) return;
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, item.id])) : current.filter((id) => id !== item.id)));
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) return current.filter((id) => !selectableIds.includes(id));
      return Array.from(new Set([...current, ...selectableIds]));
    });
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
        <header className="admin-panel-header admin-panel-header--with-action">
          <div>
            <span className="section-eyebrow">Submission Management</span>
            <h1>Project Submission Requests</h1>
          </div>
          <button className="segmented-button admin-submission-detail-cta" onClick={() => setDetailsOpen(true)} type="button">
            Check Detailed Response
          </button>
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
            <div className="admin-submission-list-wrap">
              <div className="admin-submission-bulkbar">
                <label className="admin-submission-select-all">
                  <input checked={allVisibleSelected} disabled={selectableIds.length === 0 || reviewMutation.isPending} onChange={(event) => toggleSelectAllVisible(event.target.checked)} type="checkbox" />
                  <span>Select all visible pending rows</span>
                </label>
                <div>
                  <span>{selectedItems.length} selected</span>
                  <button className="segmented-button segmented-button--success" disabled={selectedItems.length === 0 || reviewMutation.isPending} onClick={() => void handleApproveSelected()} type="button">
                    <Check size={14} />
                    {reviewMutation.isPending ? 'Approving...' : 'Approve selected'}
                  </button>
                  <button className="segmented-button" disabled={selectedItems.length === 0 || reviewMutation.isPending} onClick={() => setSelectedIds([])} type="button">
                    Clear
                  </button>
                </div>
              </div>
              <div className="admin-submission-list">
              {data.items.map((item) => (
                <SubmissionRow
                  checked={selectedIds.includes(item.id)}
                  disabled={reviewMutation.isPending}
                  item={item}
                  key={item.id}
                  onApprove={handleApprove}
                  onChangesRequested={handleChangesRequested}
                  onReject={handleReject}
                  onSelect={toggleSelection}
                />
              ))}
              </div>
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

      {detailsOpen ? (
        <DetailedResponsesOverlay
          isLoading={detailedSubmissionsQuery.isLoading}
          items={detailedSubmissionsQuery.data?.items ?? []}
          onClose={() => setDetailsOpen(false)}
          total={detailedSubmissionsQuery.data?.total ?? 0}
        />
      ) : null}
    </div>
  );
}

function DetailedResponsesOverlay({
  isLoading,
  items,
  onClose,
  total
}: {
  isLoading: boolean;
  items: AdminProjectSubmission[];
  onClose: () => void;
  total: number;
}) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [clubMemberFilter, setClubMemberFilter] = useState('all');
  const [collaborationFilter, setCollaborationFilter] = useState('all');
  const originalIndexById = useMemo(() => new Map(items.map((item, index) => [item.id, index + 1])), [items]);
  const detailColumns = useMemo(
    () => [
      { key: 'serialNumber', label: 'S. No', value: (item: AdminProjectSubmission) => originalIndexById.get(item.id) ?? 0 },
      { key: 'studentName', label: 'Student Name', value: (item: AdminProjectSubmission) => item.studentName || item.studentEmail },
      { key: 'collegeName', label: 'College Name', value: (item: AdminProjectSubmission) => item.collegeName },
      { key: 'roleName', label: 'Live Project Role', value: (item: AdminProjectSubmission) => item.roleName || item.roleId },
      { key: 'submissionLink', label: 'Report link', value: (item: AdminProjectSubmission) => item.submissionLink },
      { key: 'linkedinProfileId', label: 'LinkedIn link', value: (item: AdminProjectSubmission) => item.linkedinProfileId },
      { key: 'projectStartDate', label: 'Start date', value: (item: AdminProjectSubmission) => item.projectStartDate },
      { key: 'projectEndDate', label: 'End date', value: (item: AdminProjectSubmission) => item.projectEndDate },
      { key: 'liveProjectTotalDays', label: 'Total Duration(In days)', value: (item: AdminProjectSubmission) => item.liveProjectTotalDays },
      { key: 'studentFeedback', label: 'Student feedback - Wrapped version', value: (item: AdminProjectSubmission) => item.studentFeedback },
      { key: 'collegeClubMember', label: 'Club member', value: (item: AdminProjectSubmission) => yesNo(item.collegeClubMember) },
      { key: 'collegeClubName', label: 'Club name', value: (item: AdminProjectSubmission) => item.collegeClubName },
      { key: 'collegeClubOther', label: 'Other club details', value: (item: AdminProjectSubmission) => item.collegeClubOther },
      { key: 'wantsSkilledSapiensCollaboration', label: 'Wants collaboration', value: (item: AdminProjectSubmission) => yesNo(item.wantsSkilledSapiensCollaboration) },
      { key: 'skilledSapiensSupportDetails', label: 'Support needed', value: (item: AdminProjectSubmission) => item.skilledSapiensSupportDetails }
    ],
    [originalIndexById]
  );
  const collegeOptions = useMemo(() => uniqueLabels(items.map((item) => item.collegeName)), [items]);
  const roleOptions = useMemo(() => uniqueLabels(items.map((item) => item.roleName || item.roleId)), [items]);
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const collegeMatches = collegeFilter === 'all' || (item.collegeName || '') === collegeFilter;
        const roleMatches = roleFilter === 'all' || (item.roleName || item.roleId || '') === roleFilter;
        const clubMatches =
          clubMemberFilter === 'all' ||
          (clubMemberFilter === 'yes' && item.collegeClubMember === true) ||
          (clubMemberFilter === 'no' && item.collegeClubMember === false);
        const collaborationMatches =
          collaborationFilter === 'all' ||
          (collaborationFilter === 'yes' && item.wantsSkilledSapiensCollaboration === true) ||
          (collaborationFilter === 'no' && item.wantsSkilledSapiensCollaboration === false);
        return collegeMatches && roleMatches && clubMatches && collaborationMatches;
      }),
    [clubMemberFilter, collaborationFilter, collegeFilter, items, roleFilter]
  );
  const sortedItems = useMemo(
    () => sortRows(filteredItems, sort, (item, key) => detailColumns.find((column) => column.key === key)?.value(item)),
    [detailColumns, filteredItems, sort]
  );

  return (
    <div aria-modal="true" className="admin-submission-detail-overlay" role="dialog">
      <div className="admin-submission-detail-modal">
        <header className="admin-submission-detail-header">
          <div>
            <span className="section-eyebrow">Detailed Response</span>
            <h2>Live Project Submission Responses</h2>
            <p>
              Showing {sortedItems.length} of {total} matching response{total === 1 ? '' : 's'}.
            </p>
          </div>
          <button aria-label="Close detailed response table" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className="admin-submission-detail-filters" aria-label="Detailed response filters">
          <label>
            <span>College</span>
            <select value={collegeFilter} onChange={(event) => setCollegeFilter(event.target.value)}>
              <option value="all">All colleges</option>
              {collegeOptions.map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Role</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Club member</span>
            <select value={clubMemberFilter} onChange={(event) => setClubMemberFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            <span>Wants Collab</span>
            <select value={collaborationFilter} onChange={(event) => setCollaborationFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>

        <div className="admin-submission-detail-table-wrap">
          {isLoading ? (
            <LoadingState />
          ) : sortedItems.length > 0 ? (
            <table className="admin-submission-detail-table">
              <thead>
                <tr>
                  {detailColumns.map((column) => (
                    <th key={column.key}>
                      <button
                        aria-label={`Sort by ${column.label}`}
                        aria-sort={sort?.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={`data-sort-button ${sort?.key === column.key ? 'data-sort-button--active' : ''}`}
                        onClick={() => setSort((current) => nextSortState(current, column.key))}
                        type="button"
                      >
                        <span>{column.label}</span>
                        <span aria-hidden="true">{sort?.key === column.key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, index) => {
                  const reportUrl = safeUrl(item.submissionLink);
                  const linkedinUrl = safeUrl(item.linkedinProfileId);
                  return (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.studentName || item.studentEmail || '-'}</td>
                      <td>{item.collegeName || '-'}</td>
                      <td>{item.roleName || item.roleId || '-'}</td>
                      <td>
                        {reportUrl ? (
                          <a href={reportUrl} rel="noreferrer" target="_blank">
                            Open report
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {linkedinUrl ? (
                          <a href={linkedinUrl} rel="noreferrer" target="_blank">
                            Open LinkedIn
                          </a>
                        ) : (
                          item.linkedinProfileId || '-'
                        )}
                      </td>
                      <td>{formatDateOnly(item.projectStartDate)}</td>
                      <td>{formatDateOnly(item.projectEndDate)}</td>
                      <td>{item.liveProjectTotalDays ?? '-'}</td>
                      <td className="admin-submission-detail-feedback">{item.studentFeedback || '-'}</td>
                      <td>{yesNo(item.collegeClubMember)}</td>
                      <td>{item.collegeClubName || '-'}</td>
                      <td>{item.collegeClubOther || '-'}</td>
                      <td>{yesNo(item.wantsSkilledSapiensCollaboration)}</td>
                      <td>{item.skilledSapiensSupportDetails || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

function SubmissionRow({
  checked,
  disabled,
  item,
  onApprove,
  onChangesRequested,
  onReject,
  onSelect
}: {
  checked: boolean;
  disabled: boolean;
  item: AdminProjectSubmission;
  onApprove: (item: AdminProjectSubmission) => Promise<void>;
  onChangesRequested: (item: AdminProjectSubmission) => Promise<void>;
  onReject: (item: AdminProjectSubmission) => Promise<void>;
  onSelect: (item: AdminProjectSubmission, checked: boolean) => void;
}) {
  const canSelect = reviewable(item);

  return (
    <article className="admin-submission-row">
      <label className="admin-submission-row__select" title={canSelect ? 'Select submission for bulk approval' : 'Only pending review submissions can be selected'}>
        <input checked={checked} disabled={!canSelect || disabled} onChange={(event) => onSelect(item, event.target.checked)} type="checkbox" />
      </label>
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
