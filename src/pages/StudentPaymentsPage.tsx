import { CreditCard, IndianRupee, ReceiptText, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentPaymentItemType, StudentPaymentOrderStatus, useStudentPaymentOrders } from '../features/student/useStudentPaymentOrders';

const statusOptions: Array<StudentPaymentOrderStatus | 'all'> = ['all', 'created', 'paid', 'failed', 'cancelled'];
const itemTypeOptions: Array<StudentPaymentItemType | 'all'> = ['all', 'group', 'workshop', 'resource'];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { currency, style: 'currency' }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function getStatusTone(status: StudentPaymentOrderStatus) {
  if (status === 'paid') return 'safe';
  if (status === 'failed' || status === 'cancelled') return 'warning';
  return 'neutral';
}

function parseStatus(value: string | null): StudentPaymentOrderStatus | 'all' {
  return statusOptions.includes(value as StudentPaymentOrderStatus | 'all') ? (value as StudentPaymentOrderStatus | 'all') : 'all';
}

function parseItemType(value: string | null): StudentPaymentItemType | 'all' {
  return itemTypeOptions.includes(value as StudentPaymentItemType | 'all') ? (value as StudentPaymentItemType | 'all') : 'all';
}

function buildPageLink(page: number, search: string, status: StudentPaymentOrderStatus | 'all', itemType: StudentPaymentItemType | 'all') {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (itemType !== 'all') params.set('itemType', itemType);
  return `?${params.toString()}`;
}

function renderReference(label: string, value: string | undefined) {
  if (!value) {
    return null;
  }

  return (
    <span className="finance-reference">
      <strong>{label}</strong>
      <span>{value}</span>
    </span>
  );
}

export function StudentPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const itemType = parseItemType(searchParams.get('itemType'));
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const paymentsQuery = useStudentPaymentOrders({ itemType, page, search, status });
  const data = paymentsQuery.data;
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

  if (paymentsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your payment history." eyebrow="Student payments" title="Payments" />
        <LoadingState />
      </div>
    );
  }

  if (paymentsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="We could not load your payment history right now." eyebrow="Student payments" title="Payments unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Review your payment orders, status, amount, and reference details."
        eyebrow="Student payments"
        title="Payments"
      />

      <section className="filter-bar finance-filter-bar" aria-label="Payment filters">
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
            <label className="sr-only" htmlFor="payment-search">
              Search payments
            </label>
            <input id="payment-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search payments" type="search" />
          </div>
          <button className="segmented-button" type="submit">
            Apply
          </button>
        </form>
      </section>

      {data && data.items.length > 0 ? (
        <section className="finance-list-panel" aria-label="Payment orders">
          <header className="finance-list-panel__header">
            <div>
              <span className="eyebrow">Payment history</span>
              <h2>Payment orders</h2>
            </div>
            <span>{data.total} total</span>
          </header>

          <div className="finance-list">
            {data.items.map((item) => (
              <article className="finance-row" key={item.id}>
                <div className="finance-row__icon">
                  {item.status === 'paid' ? <IndianRupee size={20} /> : item.status === 'created' ? <CreditCard size={20} /> : <ReceiptText size={20} />}
                </div>
                <div className="finance-row__main">
                  <div className="finance-row__title-line">
                    <h2>{item.itemTitle ?? item.orderId ?? item.id}</h2>
                    <strong>{formatMoney(item.amount, item.currency)}</strong>
                  </div>
                  <div className="finance-row__chips">
                    <StatusBadge tone={getStatusTone(item.status)}>{formatOption(item.status)}</StatusBadge>
                    <span>{formatOption(item.itemType)}</span>
                    <time>{formatDate(item.updatedAt ?? item.createdAt)}</time>
                  </div>
                  <div className="finance-row__meta">
                    {renderReference('Order', item.orderId ?? item.razorpayOrderId)}
                    {renderReference('Payment', item.razorpayPaymentId)}
                    {renderReference('Receipt', item.receipt)}
                    {renderReference('Item', item.itemId)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Payment pagination">
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
    </div>
  );
}
