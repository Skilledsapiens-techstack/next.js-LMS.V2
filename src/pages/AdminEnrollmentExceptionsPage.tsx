import { AlertTriangle, Search, ShieldCheck, Ticket } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { AdminEnrollmentException, AdminEnrollmentExceptionStatus, useAdminEnrollmentExceptions } from '../features/admin/useAdminEnrollments';

const statusOptions: Array<AdminEnrollmentExceptionStatus | 'all'> = ['all', 'open', 'resolved', 'approved', 'rejected'];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatDateTime(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function parseStatus(value: string | null): AdminEnrollmentExceptionStatus | 'all' {
  return statusOptions.includes(value as AdminEnrollmentExceptionStatus | 'all') ? (value as AdminEnrollmentExceptionStatus | 'all') : 'all';
}

function statusTone(status: AdminEnrollmentExceptionStatus) {
  if (status === 'resolved' || status === 'approved') return 'safe';
  if (status === 'open') return 'warning';
  return 'neutral';
}

function buildPageLink(page: number, search: string, status: AdminEnrollmentExceptionStatus | 'all', exceptionType: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (exceptionType) params.set('exceptionType', exceptionType);
  return `?${params.toString()}`;
}

const columns: DataColumn<AdminEnrollmentException>[] = [
  {
    header: 'Exception',
    key: 'exception',
    render: (item) => (
      <div className="announcement-title-cell">
        <strong>{item.exceptionId}</strong>
        <p>{item.errorMessage}</p>
        <div className="chip-row">
          <StatusBadge tone={statusTone(item.status)}>{formatOption(item.status)}</StatusBadge>
          <StatusBadge>{item.exceptionType}</StatusBadge>
          {item.suggestedProgramKey ? <StatusBadge>{item.suggestedProgramKey}</StatusBadge> : null}
        </div>
      </div>
    )
  },
  {
    header: 'Request',
    key: 'request',
    render: (item) => (
      <div className="stacked-cell">
        <span>{item.requestId ?? 'No request'}</span>
        <span>{item.itemId ?? item.paymentId ?? 'No item/payment'}</span>
      </div>
    )
  },
  {
    header: 'Student',
    key: 'student',
    render: (item) => (
      <div className="stacked-cell">
        <span>{item.studentName ?? 'No name'}</span>
        <span>{item.studentEmail ?? 'No email'}</span>
      </div>
    )
  },
  {
    header: 'Raw value',
    key: 'rawValue',
    render: (item) => item.rawValue ?? 'Not exposed'
  },
  {
    header: 'Resolution',
    key: 'resolution',
    render: (item) => (
      <div className="stacked-cell">
        <span>{item.resolvedBy ?? 'Not resolved'}</span>
        <span>{formatDateTime(item.resolvedAt)}</span>
      </div>
    )
  }
];

export function AdminEnrollmentExceptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search')?.trim() ?? '';
  const exceptionType = searchParams.get('exceptionType')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [exceptionTypeInput, setExceptionTypeInput] = useState(exceptionType);
  const exceptionsQuery = useAdminEnrollmentExceptions({ exceptionType, page, search, status });
  const data = exceptionsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const openCount = useMemo(() => data?.items.filter((item) => item.status === 'open').length ?? 0, [data?.items]);
  const resolvedCount = useMemo(() => data?.items.filter((item) => item.status === 'resolved' || item.status === 'approved').length ?? 0, [data?.items]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    updateParam(next, 'search', searchInput);
    updateParam(next, 'exceptionType', exceptionTypeInput);
    setSearchParams(next);
  }

  function handleStatus(nextStatus: AdminEnrollmentExceptionStatus | 'all') {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (nextStatus === 'all') next.delete('status');
    else next.set('status', nextStatus);
    setSearchParams(next);
  }

  if (exceptionsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading enrollment exception queue." eyebrow="Admin enrollments" title="Enrollment exceptions" />
        <LoadingState />
      </div>
    );
  }

  if (exceptionsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Enrollment exceptions could not be loaded from the Supabase." eyebrow="Admin enrollments" title="Exceptions unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader description="Review enrollment exceptions without raw payload blobs, suggested mapping blobs, or resolution controls." eyebrow="Admin enrollments" title="Enrollment exceptions" />

      <div className="metric-grid">
        <article className="metric-tile">
          <AlertTriangle size={22} />
          <span>Total exceptions</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <Ticket size={22} />
          <span>Open on page</span>
          <strong>{openCount}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Resolved on page</span>
          <strong>{resolvedCount}</strong>
        </article>
      </div>

      <section className="filter-bar" aria-label="Admin enrollment exception filters">
        <div className="segmented-control" role="group" aria-label="Exception status">
          {statusOptions.map((option) => (
            <button className={option === status ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => handleStatus(option)} type="button">
              {formatOption(option)}
            </button>
          ))}
        </div>
        <form className="filter-search filter-search--wide" onSubmit={handleSearch}>
          <Search size={16} />
          <label className="sr-only" htmlFor="admin-exception-search">Search exceptions</label>
          <input id="admin-exception-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search exceptions" type="search" />
          <label className="sr-only" htmlFor="admin-exception-type">Exception type</label>
          <input id="admin-exception-type" value={exceptionTypeInput} onChange={(event) => setExceptionTypeInput(event.target.value)} placeholder="Exception type" type="search" />
          <button className="segmented-button" type="submit">Apply</button>
        </form>
      </section>

      {data && data.items.length > 0 ? (
        <DataPanel columns={columns} description="Exceptions are read-only. Resolution, approval, rejection, remapping, raw payload inspection, and student activation controls are not exposed." items={data.items} title="Enrollment exception queue" />
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin enrollment exception pagination">
        {data?.hasPreviousPage ? <Link className="pagination-link" to={buildPageLink(page - 1, search, status, exceptionType)}>Previous page</Link> : <span className="pagination-link pagination-link--disabled">Previous page</span>}
        <span>Page {page} of {totalPages}</span>
        {data?.hasNextPage ? <Link className="pagination-link" to={buildPageLink(page + 1, search, status, exceptionType)}>Next page</Link> : <span className="pagination-link pagination-link--disabled">Next page</span>}
      </nav>

      <StateBlock title="Read-only exception handling">
        Exception resolution, mapping edits, approval/rejection, raw payload access, and activation workflows remain disabled until controlled write enablement.
      </StateBlock>
    </div>
  );
}

function updateParam(params: URLSearchParams, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) params.set(key, trimmed);
  else params.delete(key);
}
