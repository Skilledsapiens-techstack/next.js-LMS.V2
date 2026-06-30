import { AlertTriangle, Radio, Search, ShieldCheck, Ticket } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { AdminEnrollmentWebhookEvent, AdminEnrollmentWebhookEventStatus, useAdminEnrollmentWebhookEvents } from '../features/admin/useAdminEnrollments';

const statusOptions: Array<AdminEnrollmentWebhookEventStatus | 'all'> = [
  'all',
  'received',
  'processed',
  'processed_with_exceptions',
  'duplicate',
  'invalid_signature',
  'skipped_failed',
  'skipped_refunded',
  'skipped_pending_payment',
  'failed'
];

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

function parseStatus(value: string | null): AdminEnrollmentWebhookEventStatus | 'all' {
  return statusOptions.includes(value as AdminEnrollmentWebhookEventStatus | 'all') ? (value as AdminEnrollmentWebhookEventStatus | 'all') : 'all';
}

function statusTone(status: AdminEnrollmentWebhookEventStatus) {
  if (status === 'processed') return 'safe';
  if (status === 'received' || status === 'processed_with_exceptions') return 'warning';
  return 'neutral';
}

function buildPageLink(page: number, search: string, status: AdminEnrollmentWebhookEventStatus | 'all') {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  return `?${params.toString()}`;
}

const columns: DataColumn<AdminEnrollmentWebhookEvent>[] = [
  {
    header: 'Event',
    key: 'event',
    render: (item) => (
      <div className="announcement-title-cell">
        <strong>{item.eventId}</strong>
        <p>{item.eventType ?? 'No event type'}</p>
        <div className="chip-row">
          <StatusBadge tone={statusTone(item.status)}>{formatOption(item.status)}</StatusBadge>
          {item.requestId ? <StatusBadge>{item.requestId}</StatusBadge> : null}
        </div>
      </div>
    )
  },
  {
    header: 'Payment',
    key: 'payment',
    render: (item) => (
      <div className="stacked-cell">
        <span>{item.paymentId ?? 'No payment ID'}</span>
        <span>{item.orderId ?? 'No order ID'}</span>
      </div>
    )
  },
  {
    header: 'Processed',
    key: 'processed',
    render: (item) => formatDateTime(item.processedAt)
  },
  {
    header: 'Created',
    key: 'created',
    render: (item) => formatDateTime(item.createdAt)
  },
  {
    header: 'Error',
    key: 'error',
    render: (item) => item.errorMessage ?? 'No error'
  }
];

export function AdminEnrollmentWebhookEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const eventsQuery = useAdminEnrollmentWebhookEvents({ page, search, status });
  const data = eventsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const processedCount = useMemo(() => data?.items.filter((item) => item.status === 'processed').length ?? 0, [data?.items]);
  const warningCount = useMemo(() => data?.items.filter((item) => item.status === 'processed_with_exceptions' || item.status === 'failed' || item.status === 'invalid_signature').length ?? 0, [data?.items]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (searchInput.trim()) next.set('search', searchInput.trim());
    else next.delete('search');
    setSearchParams(next);
  }

  function handleStatus(nextStatus: AdminEnrollmentWebhookEventStatus | 'all') {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (nextStatus === 'all') next.delete('status');
    else next.set('status', nextStatus);
    setSearchParams(next);
  }

  if (eventsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading enrollment webhook event monitor." eyebrow="Admin enrollments" title="Webhook events" />
        <LoadingState />
      </div>
    );
  }

  if (eventsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Webhook events could not be loaded from the Supabase." eyebrow="Admin enrollments" title="Webhook events unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader description="Monitor sanitized enrollment webhook processing metadata without raw payload, signature, replay, or mutation controls." eyebrow="Admin enrollments" title="Webhook events" />

      <div className="metric-grid">
        <article className="metric-tile">
          <Radio size={22} />
          <span>Total events</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Processed on page</span>
          <strong>{processedCount}</strong>
        </article>
        <article className="metric-tile">
          <AlertTriangle size={22} />
          <span>Warnings on page</span>
          <strong>{warningCount}</strong>
        </article>
        <article className="metric-tile">
          <Ticket size={22} />
          <span>Status</span>
          <strong>{formatOption(status)}</strong>
        </article>
      </div>

      <section className="filter-bar" aria-label="Admin enrollment webhook filters">
        <div className="segmented-control" role="group" aria-label="Webhook event status">
          {statusOptions.map((option) => (
            <button className={option === status ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => handleStatus(option)} type="button">
              {formatOption(option)}
            </button>
          ))}
        </div>
        <form className="filter-search" onSubmit={handleSearch}>
          <Search size={16} />
          <label className="sr-only" htmlFor="admin-webhook-search">Search webhook events</label>
          <input id="admin-webhook-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search events" type="search" />
          <button className="segmented-button" type="submit">Apply</button>
        </form>
      </section>

      {data && data.items.length > 0 ? (
        <DataPanel columns={columns} description="Webhook events are read-only. Raw payloads, signatures, replay, retry, manual processing, and status mutation controls are not exposed." items={data.items} title="Enrollment webhook events" />
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin enrollment webhook event pagination">
        {data?.hasPreviousPage ? <Link className="pagination-link" to={buildPageLink(page - 1, search, status)}>Previous page</Link> : <span className="pagination-link pagination-link--disabled">Previous page</span>}
        <span>Page {page} of {totalPages}</span>
        {data?.hasNextPage ? <Link className="pagination-link" to={buildPageLink(page + 1, search, status)}>Next page</Link> : <span className="pagination-link pagination-link--disabled">Next page</span>}
      </nav>

      <StateBlock title="Read-only webhook monitoring">
        Raw webhook payloads, signature material, replay, retry, manual processing, and status mutation workflows remain disabled in Phase 5.
      </StateBlock>
    </div>
  );
}
