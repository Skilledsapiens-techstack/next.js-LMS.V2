import { CalendarClock, CheckCircle2, LockKeyhole, Search, TicketCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentPaidAccessItemType, StudentPaidAccessStatus, useStudentPaidAccess } from '../features/student/useStudentPaidAccess';

const statusOptions: Array<StudentPaidAccessStatus | 'all'> = ['all', 'active', 'inactive'];
const itemTypeOptions: Array<StudentPaidAccessItemType | 'all'> = ['all', 'group', 'workshop', 'resource'];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Open ended';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(amount: number | undefined, currency: string | undefined) {
  if (amount === undefined || !currency) {
    return 'Not recorded';
  }

  try {
    return new Intl.NumberFormat(undefined, { currency, style: 'currency' }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function getStatusTone(status: StudentPaidAccessStatus, activeNow: boolean) {
  if (status === 'active' && activeNow) return 'safe';
  if (status === 'active') return 'neutral';
  return 'warning';
}

function parseStatus(value: string | null): StudentPaidAccessStatus | 'all' {
  return statusOptions.includes(value as StudentPaidAccessStatus | 'all') ? (value as StudentPaidAccessStatus | 'all') : 'all';
}

function parseItemType(value: string | null): StudentPaidAccessItemType | 'all' {
  return itemTypeOptions.includes(value as StudentPaidAccessItemType | 'all') ? (value as StudentPaidAccessItemType | 'all') : 'all';
}

function buildPageLink(page: number, search: string, status: StudentPaidAccessStatus | 'all', itemType: StudentPaidAccessItemType | 'all') {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (itemType !== 'all') params.set('itemType', itemType);
  return `?${params.toString()}`;
}

export function StudentPaidAccessPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const itemType = parseItemType(searchParams.get('itemType'));
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const accessQuery = useStudentPaidAccess({ itemType, page, search, status });
  const data = accessQuery.data;
  const totalPages = data?.totalPages ?? 1;

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

  function setFilter(key: 'itemType' | 'status', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  }

  if (accessQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your current access records." eyebrow="Student access" title="Paid access" />
        <LoadingState />
      </div>
    );
  }

  if (accessQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="We could not load your access records right now." eyebrow="Student access" title="Paid access unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="See which paid groups, workshops, and resources are currently linked to your account."
        eyebrow="Student access"
        title="Paid access"
      />

      <section className="filter-bar finance-filter-bar" aria-label="Paid access filters">
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
            <label className="sr-only" htmlFor="paid-access-search">
              Search paid access
            </label>
            <input id="paid-access-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search access" type="search" />
          </div>
          <button className="segmented-button" type="submit">
            Apply
          </button>
        </form>
      </section>

      {data && data.items.length > 0 ? (
        <section className="finance-list-panel" aria-label="Access grants">
          <header className="finance-list-panel__header">
            <div>
              <span className="eyebrow">Access records</span>
              <h2>Paid access</h2>
            </div>
            <span>{data.total} total</span>
          </header>

          <div className="finance-list">
            {data.items.map((item) => (
              <article className="finance-row" key={item.id}>
                <div className="finance-row__icon">
                  {item.activeNow ? <CheckCircle2 size={20} /> : item.expiresAt ? <CalendarClock size={20} /> : <TicketCheck size={20} />}
                </div>
                <div className="finance-row__main">
                  <div className="finance-row__title-line">
                    <h2>{item.accessId ?? item.itemId}</h2>
                    <strong>{formatMoney(item.amount, item.currency)}</strong>
                  </div>
                  <div className="finance-row__chips">
                    <StatusBadge tone={getStatusTone(item.status, item.activeNow)}>{item.activeNow ? 'active now' : formatOption(item.status)}</StatusBadge>
                    <span>{formatOption(item.itemType)}</span>
                    <span>{item.source ?? 'source not recorded'}</span>
                  </div>
                  <div className="finance-row__meta">
                    <span className="finance-reference">
                      <strong>Item</strong>
                      <span>{item.itemId}</span>
                    </span>
                    <span className="finance-reference">
                      <strong>Granted</strong>
                      <span>{formatDate(item.grantedAt)}</span>
                    </span>
                    <span className="finance-reference">
                      <strong>Expires</strong>
                      <span>{formatDate(item.expiresAt)}</span>
                    </span>
                    {item.paymentId ? (
                      <span className="finance-reference">
                        <strong>Payment</strong>
                        <span>{item.paymentId}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Paid access pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, status, itemType)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, status, itemType)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>
      <section className="finance-note">
        <LockKeyhole size={16} />
        <span>Access changes are handled by the support/admin team.</span>
      </section>
    </div>
  );
}
