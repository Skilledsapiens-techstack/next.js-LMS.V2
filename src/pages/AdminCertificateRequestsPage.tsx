import { ClipboardCheck, FileCheck2, Search, ShieldCheck, Timer } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminCertificateRequest,
  AdminCertificateRequestAdminStatus,
  AdminCertificateReviewStatus,
  useAdminCertificateRequests
} from '../features/admin/useAdminCertificates';

const reviewStatusOptions: Array<AdminCertificateReviewStatus | 'all'> = ['all', 'pending', 'approved', 'rejected'];
const adminStatusOptions: Array<AdminCertificateRequestAdminStatus | 'all'> = ['all', 'pending', 'approved', 'rejected', 'issued'];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function parseReviewStatus(value: string | null): AdminCertificateReviewStatus | 'all' {
  return reviewStatusOptions.includes(value as AdminCertificateReviewStatus | 'all') ? (value as AdminCertificateReviewStatus | 'all') : 'all';
}

function parseAdminStatus(value: string | null): AdminCertificateRequestAdminStatus | 'all' {
  return adminStatusOptions.includes(value as AdminCertificateRequestAdminStatus | 'all') ? (value as AdminCertificateRequestAdminStatus | 'all') : 'all';
}

function buildPageLink(page: number, search: string, moderatorStatus: AdminCertificateReviewStatus | 'all', adminStatus: AdminCertificateRequestAdminStatus | 'all') {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (moderatorStatus !== 'all') params.set('moderatorStatus', moderatorStatus);
  if (adminStatus !== 'all') params.set('adminStatus', adminStatus);
  return `?${params.toString()}`;
}

function statusTone(status: AdminCertificateReviewStatus | AdminCertificateRequestAdminStatus) {
  if (status === 'approved' || status === 'issued') return 'safe';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

const columns: DataColumn<AdminCertificateRequest>[] = [
  {
    header: 'Request',
    key: 'request',
    render: (item) => (
      <div className="announcement-title-cell">
        <strong>{item.requestId}</strong>
        <p>{item.projectTitle ?? item.projectId}</p>
        <div className="chip-row">
          <StatusBadge>{item.requestType}</StatusBadge>
          <StatusBadge>{item.projectRole}</StatusBadge>
          {item.programKey ? <StatusBadge>{item.programKey}</StatusBadge> : null}
        </div>
      </div>
    )
  },
  {
    header: 'Student',
    key: 'student',
    render: (item) => (
      <div className="stacked-cell">
        <strong>{item.studentName}</strong>
        <span>{item.studentEmail}</span>
      </div>
    )
  },
  {
    header: 'Moderator',
    key: 'moderator',
    render: (item) => (
      <div className="stacked-cell">
        <StatusBadge tone={statusTone(item.moderatorStatus)}>{item.moderatorStatus}</StatusBadge>
        <span>{item.moderatorEmail ?? 'Not reviewed'}</span>
        <span>{formatDateTime(item.moderatorReviewedAt)}</span>
      </div>
    )
  },
  {
    header: 'Admin',
    key: 'admin',
    render: (item) => (
      <div className="stacked-cell">
        <StatusBadge tone={statusTone(item.adminStatus)}>{item.adminStatus}</StatusBadge>
        <span>{item.adminEmail ?? 'Not reviewed'}</span>
        <span>{formatDateTime(item.adminReviewedAt)}</span>
      </div>
    )
  },
  {
    header: 'Cohort',
    key: 'cohort',
    render: (item) => item.cohortName ?? 'Not mapped'
  },
  {
    header: 'Submitted',
    key: 'submitted',
    render: (item) => formatDateTime(item.submittedAt)
  }
];

export function AdminCertificateRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const moderatorStatus = parseReviewStatus(searchParams.get('moderatorStatus'));
  const adminStatus = parseAdminStatus(searchParams.get('adminStatus'));
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const requestsQuery = useAdminCertificateRequests({ adminStatus, moderatorStatus, page, search });
  const data = requestsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const pendingModeratorCount = useMemo(() => data?.items.filter((item) => item.moderatorStatus === 'pending').length ?? 0, [data?.items]);
  const pendingAdminCount = useMemo(() => data?.items.filter((item) => item.adminStatus === 'pending').length ?? 0, [data?.items]);
  const issuedCount = useMemo(() => data?.items.filter((item) => item.adminStatus === 'issued').length ?? 0, [data?.items]);

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

  function setFilter(key: 'adminStatus' | 'moderatorStatus', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  }

  if (requestsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading certificate request queue." eyebrow="Admin certificates" title="Certificate requests" />
        <LoadingState />
      </div>
    );
  }

  if (requestsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Certificate requests could not be loaded from the Supabase." eyebrow="Admin certificates" title="Certificate requests unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader description="Review live-project certificate requests without exposing submission tokens, private notes, approval, rejection, or issuance controls." eyebrow="Admin certificates" title="Certificate requests" />

      <div className="metric-grid">
        <article className="metric-tile">
          <ClipboardCheck size={22} />
          <span>Total requests</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <Timer size={22} />
          <span>Moderator pending</span>
          <strong>{pendingModeratorCount}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Admin pending</span>
          <strong>{pendingAdminCount}</strong>
        </article>
        <article className="metric-tile">
          <FileCheck2 size={22} />
          <span>Issued on page</span>
          <strong>{issuedCount}</strong>
        </article>
      </div>

      <section className="filter-bar" aria-label="Admin certificate request filters">
        <div className="segmented-control" role="group" aria-label="Moderator status">
          {reviewStatusOptions.map((option) => (
            <button className={option === moderatorStatus ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => setFilter('moderatorStatus', option)} type="button">
              {formatOption(option)}
            </button>
          ))}
        </div>
        <div className="segmented-control" role="group" aria-label="Admin status">
          {adminStatusOptions.map((option) => (
            <button className={option === adminStatus ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => setFilter('adminStatus', option)} type="button">
              {formatOption(option)}
            </button>
          ))}
        </div>
        <form className="filter-search" onSubmit={handleSearch}>
          <Search size={16} />
          <label className="sr-only" htmlFor="admin-certificate-request-search">
            Search certificate requests
          </label>
          <input id="admin-certificate-request-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search requests" type="search" />
          <button className="segmented-button" type="submit">
            Apply
          </button>
        </form>
      </section>

      {data && data.items.length > 0 ? (
        <DataPanel
          columns={columns}
          description="Certificate requests are read-only. Approval, rejection, issuance, private review notes, token access, and generation-job creation are not exposed."
          items={data.items}
          title="Certificate request queue"
        />
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin certificate request pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, moderatorStatus, adminStatus)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, moderatorStatus, adminStatus)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      <StateBlock title="Read-only certificate requests">
        Approval, rejection, issuance, certificate generation, private review notes, token access, and PDF workflows remain disabled until the certificate module receives controlled write approval.
      </StateBlock>
    </div>
  );
}
