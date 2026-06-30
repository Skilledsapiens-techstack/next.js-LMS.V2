import { BadgeIndianRupee, ExternalLink, Search, ShieldCheck, Ticket } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { AdminEnrollmentPaymentStatus, AdminEnrollmentRequest, AdminEnrollmentRequestType, useAdminEnrollmentRequests } from '../features/admin/useAdminEnrollments';

const paymentStatusOptions: Array<AdminEnrollmentPaymentStatus | 'all'> = [
  'all',
  'pending_payment',
  'paid',
  'payment_received',
  'pending_review',
  'approved',
  'cohort_assigned',
  'activated',
  'completed',
  'rejected',
  'duplicate',
  'on_hold',
  'refunded',
  'exception'
];
const requestTypeOptions: Array<AdminEnrollmentRequestType | 'all'> = ['all', 'razorpay', 'manual'];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDateTime(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(item: AdminEnrollmentRequest) {
  if (item.amountPaid === undefined) return 'Not paid';
  return `${item.currency ?? 'INR'} ${item.amountPaid}`;
}

function parsePaymentStatus(value: string | null): AdminEnrollmentPaymentStatus | 'all' {
  return paymentStatusOptions.includes(value as AdminEnrollmentPaymentStatus | 'all') ? (value as AdminEnrollmentPaymentStatus | 'all') : 'all';
}

function parseRequestType(value: string | null): AdminEnrollmentRequestType | 'all' {
  return requestTypeOptions.includes(value as AdminEnrollmentRequestType | 'all') ? (value as AdminEnrollmentRequestType | 'all') : 'all';
}

function buildPageLink(page: number, search: string, paymentStatus: AdminEnrollmentPaymentStatus | 'all', requestType: AdminEnrollmentRequestType | 'all', careerLevel: string, personalMentor: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
  if (requestType !== 'all') params.set('requestType', requestType);
  if (careerLevel) params.set('careerLevel', careerLevel);
  if (personalMentor) params.set('personalMentor', personalMentor);
  return `?${params.toString()}`;
}

function statusTone(status: AdminEnrollmentPaymentStatus) {
  if (status === 'activated' || status === 'completed' || status === 'approved') return 'safe';
  if (status === 'exception' || status === 'on_hold' || status === 'pending_review') return 'warning';
  return 'neutral';
}

const columns: DataColumn<AdminEnrollmentRequest>[] = [
  {
    header: 'Request',
    key: 'request',
    render: (item) => (
      <div className="announcement-title-cell">
        <strong>{item.requestId}</strong>
        <p>{item.studentName ?? item.email ?? 'Student not mapped'}</p>
        <div className="chip-row">
          <StatusBadge tone={statusTone(item.paymentStatus)}>{formatOption(item.paymentStatus)}</StatusBadge>
          <StatusBadge>{item.requestType}</StatusBadge>
          {item.exceptionCount > 0 ? <StatusBadge tone="warning">{`${item.exceptionCount} exception`}</StatusBadge> : null}
        </div>
      </div>
    )
  },
  {
    header: 'Student',
    key: 'student',
    render: (item) => (
      <div className="stacked-cell">
        <span>{item.email ?? 'No email'}</span>
        <span>{item.phone ?? 'No phone'}</span>
      </div>
    )
  },
  {
    header: 'Payment',
    key: 'payment',
    render: (item) => (
      <div className="stacked-cell">
        <strong>{formatAmount(item)}</strong>
        <span>{item.paymentId ?? item.orderId ?? 'No payment ref'}</span>
      </div>
    )
  },
  {
    header: 'Profile',
    key: 'profile',
    render: (item) => (
      <div className="stacked-cell">
        <span>{item.careerLevel ?? 'No career level'}</span>
        <span>{item.personalMentor ?? 'No mentor'}</span>
      </div>
    )
  },
  {
    header: 'Activated',
    key: 'activated',
    render: (item) => formatDateTime(item.activatedAt)
  },
  {
    header: 'Detail',
    key: 'detail',
    render: (item) => (
      <Link className="inline-link" to={`/admin/enrollments/${encodeURIComponent(item.requestId)}`}>
        <ExternalLink size={14} />
        View detail
      </Link>
    )
  }
];

export function AdminEnrollmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const paymentStatus = parsePaymentStatus(searchParams.get('paymentStatus'));
  const requestType = parseRequestType(searchParams.get('requestType'));
  const search = searchParams.get('search')?.trim() ?? '';
  const careerLevel = searchParams.get('careerLevel')?.trim() ?? '';
  const personalMentor = searchParams.get('personalMentor')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [careerLevelInput, setCareerLevelInput] = useState(careerLevel);
  const [personalMentorInput, setPersonalMentorInput] = useState(personalMentor);
  const enrollmentsQuery = useAdminEnrollmentRequests({ careerLevel, page, paymentStatus, personalMentor, requestType, search });
  const data = enrollmentsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const activeCount = useMemo(() => data?.items.filter((item) => item.paymentStatus === 'activated' || item.paymentStatus === 'completed').length ?? 0, [data?.items]);
  const exceptionCount = useMemo(() => data?.items.reduce((sum, item) => sum + item.exceptionCount, 0) ?? 0, [data?.items]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    updateParam(next, 'search', searchInput);
    updateParam(next, 'careerLevel', careerLevelInput);
    updateParam(next, 'personalMentor', personalMentorInput);
    setSearchParams(next);
  }

  function setFilter(key: 'paymentStatus' | 'requestType', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  }

  if (enrollmentsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading enrollment request queue." eyebrow="Admin enrollments" title="Enrollments" />
        <LoadingState />
      </div>
    );
  }

  if (enrollmentsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Enrollment requests could not be loaded from the Supabase." eyebrow="Admin enrollments" title="Enrollments unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader description="Review enrollment requests, payment state, exceptions, and activation metadata without activation or cohort-write controls." eyebrow="Admin enrollments" title="Enrollments" />

      <div className="metric-grid">
        <article className="metric-tile">
          <Ticket size={22} />
          <span>Total requests</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Activated on page</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="metric-tile">
          <BadgeIndianRupee size={22} />
          <span>Status</span>
          <strong>{formatOption(paymentStatus)}</strong>
        </article>
        <article className="metric-tile">
          <Ticket size={22} />
          <span>Exceptions on page</span>
          <strong>{exceptionCount}</strong>
        </article>
      </div>

      <section className="filter-bar" aria-label="Admin enrollment filters">
        <div className="segmented-control" role="group" aria-label="Payment status">
          {paymentStatusOptions.map((option) => (
            <button className={option === paymentStatus ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => setFilter('paymentStatus', option)} type="button">
              {formatOption(option)}
            </button>
          ))}
        </div>
        <div className="segmented-control" role="group" aria-label="Request type">
          {requestTypeOptions.map((option) => (
            <button className={option === requestType ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => setFilter('requestType', option)} type="button">
              {formatOption(option)}
            </button>
          ))}
        </div>
        <form className="filter-search filter-search--wide" onSubmit={handleSearch}>
          <Search size={16} />
          <label className="sr-only" htmlFor="admin-enrollment-search">Search enrollments</label>
          <input id="admin-enrollment-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search requests" type="search" />
          <label className="sr-only" htmlFor="admin-enrollment-career">Career level</label>
          <input id="admin-enrollment-career" value={careerLevelInput} onChange={(event) => setCareerLevelInput(event.target.value)} placeholder="Career level" type="search" />
          <label className="sr-only" htmlFor="admin-enrollment-mentor">Personal mentor</label>
          <input id="admin-enrollment-mentor" value={personalMentorInput} onChange={(event) => setPersonalMentorInput(event.target.value)} placeholder="Personal mentor" type="search" />
          <button className="segmented-button" type="submit">Apply</button>
        </form>
      </section>

      {data && data.items.length > 0 ? (
        <DataPanel columns={columns} description="Enrollment requests are read-only. Activation, rejection, cohort assignment, payment reconciliation, and exception resolution controls are not exposed." items={data.items} title="Enrollment requests" />
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin enrollment pagination">
        {data?.hasPreviousPage ? <Link className="pagination-link" to={buildPageLink(page - 1, search, paymentStatus, requestType, careerLevel, personalMentor)}>Previous page</Link> : <span className="pagination-link pagination-link--disabled">Previous page</span>}
        <span>Page {page} of {totalPages}</span>
        {data?.hasNextPage ? <Link className="pagination-link" to={buildPageLink(page + 1, search, paymentStatus, requestType, careerLevel, personalMentor)}>Next page</Link> : <span className="pagination-link pagination-link--disabled">Next page</span>}
      </nav>

      <StateBlock title="Read-only enrollment operations">
        Enrollment activation, cohort assignment, payment reconciliation, rejection, duplicate handling, and exception resolution remain disabled until controlled write enablement.
      </StateBlock>
    </div>
  );
}

function updateParam(params: URLSearchParams, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) params.set(key, trimmed);
  else params.delete(key);
}
