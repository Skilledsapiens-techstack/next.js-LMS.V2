import { CalendarClock, CheckCircle2, Lock, Search, Ticket } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminPaidAccessItemType, AdminPaidAccessStatus, useAdminPaidAccess } from '../features/admin/useAdminPayments';

const statusOptions: Array<AdminPaidAccessStatus | 'all'> = ['all', 'active', 'inactive'];
const itemTypeOptions: Array<AdminPaidAccessItemType | 'all'> = ['all', 'group', 'workshop', 'resource'];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatDateTime(value: string | undefined) {
  if (!value) return 'Open ended';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function formatAmount(amount: number | undefined, currency: string | undefined) {
  if (amount === undefined) return 'Not recorded';
  const resolvedCurrency = currency ?? 'INR';
  try {
    return new Intl.NumberFormat(undefined, { currency: resolvedCurrency, style: 'currency' }).format(amount);
  } catch {
    return `${resolvedCurrency} ${amount.toLocaleString()}`;
  }
}

function parseStatus(value: string | null): AdminPaidAccessStatus | 'all' {
  return statusOptions.includes(value as AdminPaidAccessStatus | 'all') ? (value as AdminPaidAccessStatus | 'all') : 'all';
}

function parseItemType(value: string | null): AdminPaidAccessItemType | 'all' {
  return itemTypeOptions.includes(value as AdminPaidAccessItemType | 'all') ? (value as AdminPaidAccessItemType | 'all') : 'all';
}

function buildPageLink(page: number, search: string, status: AdminPaidAccessStatus | 'all', itemType: AdminPaidAccessItemType | 'all') {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (itemType !== 'all') params.set('itemType', itemType);
  return `?${params.toString()}`;
}

export function AdminPaidAccessPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const itemType = parseItemType(searchParams.get('itemType'));
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const accessQuery = useAdminPaidAccess({ itemType, page, search, status });
  const data = accessQuery.data;
  const totalPages = data?.totalPages ?? 1;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (searchInput.trim()) next.set('search', searchInput.trim());
    else next.delete('search');
    setSearchParams(next);
  }

  function setFilter(key: 'itemType' | 'status', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  }

  if (accessQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading paid access grants." eyebrow="Admin access" title="Paid access" />
        <LoadingState />
      </div>
    );
  }

  if (accessQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Paid access grants could not be loaded from the Supabase." eyebrow="Admin access" title="Paid access unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader description="Review paid access grants, active state, source, payment references, and expiry." eyebrow="Admin access" title="Paid access" />

      <section className="filter-bar finance-filter-bar" aria-label="Admin paid access filters">
        <label className="announcement-filter-select">
          Status
          <select value={status} onChange={(event) => setFilter('status', event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {formatOption(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="announcement-filter-select">
          Type
          <select value={itemType} onChange={(event) => setFilter('itemType', event.target.value)}>
            {itemTypeOptions.map((option) => (
              <option key={option} value={option}>
                {formatOption(option)}
              </option>
            ))}
          </select>
        </label>
        <form className="finance-search-form" onSubmit={handleSearch}>
          <div className="filter-search finance-search-input">
            <Search size={16} />
            <label className="sr-only" htmlFor="admin-paid-access-search">Search paid access</label>
            <input id="admin-paid-access-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search access" type="search" />
          </div>
          <button className="segmented-button" type="submit">Apply</button>
        </form>
      </section>

      {data && data.items.length > 0 ? (
        <section className="finance-list-panel" aria-label="Paid access grants">
          <header className="finance-list-panel__header">
            <div>
              <span className="eyebrow">Access grants</span>
              <h2>Paid access</h2>
            </div>
            <span>{data.total} total</span>
          </header>
          <div className="finance-list">
            {data.items.map((item) => (
              <article className="finance-row" key={item.id}>
                <div className="finance-row__icon">
                  {item.activeNow ? <CheckCircle2 size={20} /> : item.expiresAt ? <CalendarClock size={20} /> : <Ticket size={20} />}
                </div>
                <div className="finance-row__main">
                  <div className="finance-row__title-line">
                    <h2>{item.accessId ?? item.itemId}</h2>
                    <strong>{formatAmount(item.amount, item.currency)}</strong>
                  </div>
                  <div className="finance-row__chips">
                    <StatusBadge tone={item.activeNow ? 'safe' : 'warning'}>{item.activeNow ? 'active now' : formatOption(item.status)}</StatusBadge>
                    <span>{formatOption(item.itemType)}</span>
                    <span>{item.source ?? 'source not recorded'}</span>
                  </div>
                  <div className="finance-row__meta">
                    <span className="finance-reference"><strong>Student</strong><span>{item.studentEmail}</span></span>
                    <span className="finance-reference"><strong>Item</strong><span>{item.itemId}</span></span>
                    <span className="finance-reference"><strong>Granted</strong><span>{formatDateTime(item.grantedAt)}</span></span>
                    <span className="finance-reference"><strong>Expires</strong><span>{formatDateTime(item.expiresAt)}</span></span>
                    {item.paymentId ? <span className="finance-reference"><strong>Payment</strong><span>{item.paymentId}</span></span> : null}
                    {item.notes ? <span className="finance-reference"><strong>Notes</strong><span>{item.notes}</span></span> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Admin paid access pagination">
        {data?.hasPreviousPage ? <Link className="pagination-link" to={buildPageLink(page - 1, search, status, itemType)}>Previous page</Link> : <span className="pagination-link pagination-link--disabled">Previous page</span>}
        <span>Page {page} of {totalPages}</span>
        {data?.hasNextPage ? <Link className="pagination-link" to={buildPageLink(page + 1, search, status, itemType)}>Next page</Link> : <span className="pagination-link pagination-link--disabled">Next page</span>}
      </nav>
      <section className="finance-note">
        <Lock size={16} />
        <span>Grant, revoke, and reconciliation controls are intentionally not exposed here.</span>
      </section>
    </div>
  );
}
