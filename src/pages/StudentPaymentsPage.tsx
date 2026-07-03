import { CheckCircle2, CreditCard, IndianRupee, LockKeyhole, ReceiptText, Search, ShieldCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentPaidAccess, StudentPaidAccessItemType, useStudentPaidAccess } from '../features/student/useStudentPaidAccess';
import { StudentPaymentItemType, StudentPaymentOrder, StudentPaymentOrderStatus, useStudentPaymentOrders } from '../features/student/useStudentPaymentOrders';

type FinanceFilter = 'all' | 'pending' | 'paid' | 'unlocked' | 'failed';
type FinanceItemType = StudentPaymentItemType | StudentPaidAccessItemType;
type CombinedFinanceItem =
  | {
      amount: number;
      createdAt?: string;
      currency: string;
      id: string;
      itemId: string;
      itemTitle?: string;
      itemType: FinanceItemType;
      orderId?: string;
      paymentId?: string;
      receipt?: string;
      recordType: 'payment';
      status: StudentPaymentOrderStatus;
      updatedAt?: string;
    }
  | {
      accessId?: string;
      activeNow: boolean;
      amount?: number;
      currency?: string;
      expiresAt?: string;
      grantedAt?: string;
      id: string;
      itemId: string;
      itemType: FinanceItemType;
      paymentId?: string;
      recordType: 'access';
      source?: string;
      status: 'active' | 'inactive';
    };

const filterOptions: Array<{ label: string; value: FinanceFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Unlocked', value: 'unlocked' },
  { label: 'Failed', value: 'failed' }
];

const itemTypeOptions: Array<{ label: string; value: FinanceItemType | 'all' }> = [
  { label: 'All item types', value: 'all' },
  { label: 'Groups', value: 'group' },
  { label: 'Workshops', value: 'workshop' },
  { label: 'Resources', value: 'resource' }
];

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not recorded';
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

function itemTimestamp(item: CombinedFinanceItem) {
  return item.recordType === 'payment' ? item.updatedAt ?? item.createdAt : item.grantedAt ?? item.expiresAt;
}

function getItemTitle(item: CombinedFinanceItem) {
  if (item.recordType === 'payment') return item.itemTitle ?? item.orderId ?? item.itemId;
  return item.accessId ?? item.itemId;
}

function getItemAmount(item: CombinedFinanceItem) {
  return item.recordType === 'payment' ? formatMoney(item.amount, item.currency) : formatMoney(item.amount, item.currency);
}

function getItemTone(item: CombinedFinanceItem) {
  if (item.recordType === 'access') return item.activeNow ? 'safe' : 'warning';
  if (item.status === 'paid') return 'safe';
  if (item.status === 'failed' || item.status === 'cancelled') return 'warning';
  return 'neutral';
}

function getItemStatusLabel(item: CombinedFinanceItem) {
  if (item.recordType === 'access') return item.activeNow ? 'unlocked' : formatOption(item.status);
  return formatOption(item.status);
}

function getItemIcon(item: CombinedFinanceItem) {
  if (item.recordType === 'access') return item.activeNow ? <CheckCircle2 size={20} /> : <LockKeyhole size={20} />;
  if (item.status === 'paid') return <IndianRupee size={20} />;
  if (item.status === 'created') return <CreditCard size={20} />;
  return <ReceiptText size={20} />;
}

function matchesFilter(item: CombinedFinanceItem, filter: FinanceFilter) {
  if (filter === 'all') return true;
  if (filter === 'pending') return item.recordType === 'payment' && item.status === 'created';
  if (filter === 'paid') return item.recordType === 'payment' && item.status === 'paid';
  if (filter === 'unlocked') return item.recordType === 'access' && item.activeNow;
  if (filter === 'failed') return item.recordType === 'payment' && (item.status === 'failed' || item.status === 'cancelled');
  return true;
}

function matchesSearch(item: CombinedFinanceItem, search: string) {
  if (!search) return true;
  const normalizedSearch = search.toLowerCase();
  const values = [
    item.id,
    item.itemId,
    item.itemType,
    getItemTitle(item),
    item.recordType === 'payment' ? item.orderId : item.accessId,
    item.paymentId
  ];
  return values.some((value) => value?.toLowerCase().includes(normalizedSearch));
}

function renderReference(label: string, value: string | undefined) {
  if (!value) return null;

  return (
    <span className="finance-reference">
      <strong>{label}</strong>
      <span>{value}</span>
    </span>
  );
}

function toPaymentItem(item: StudentPaymentOrder): CombinedFinanceItem {
  return {
    amount: item.amount,
    createdAt: item.createdAt,
    currency: item.currency,
    id: item.id,
    itemId: item.itemId,
    itemTitle: item.itemTitle,
    itemType: item.itemType,
    orderId: item.orderId ?? item.razorpayOrderId,
    paymentId: item.razorpayPaymentId,
    receipt: item.receipt,
    recordType: 'payment',
    status: item.status,
    updatedAt: item.updatedAt
  };
}

function toAccessItem(item: StudentPaidAccess): CombinedFinanceItem {
  return {
    accessId: item.accessId,
    activeNow: item.activeNow,
    amount: item.amount,
    currency: item.currency,
    expiresAt: item.expiresAt,
    grantedAt: item.grantedAt,
    id: item.id,
    itemId: item.itemId,
    itemType: item.itemType,
    paymentId: item.paymentId,
    recordType: 'access',
    source: item.source,
    status: item.status
  };
}

export function StudentPaymentsPage() {
  const [activeFilter, setActiveFilter] = useState<FinanceFilter>('all');
  const [itemType, setItemType] = useState<FinanceItemType | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const paymentsQuery = useStudentPaymentOrders({ limit: 100, page: 1, status: 'all' });
  const accessQuery = useStudentPaidAccess({ limit: 100, page: 1, status: 'all' });
  const isLoading = paymentsQuery.isLoading || accessQuery.isLoading;
  const isError = paymentsQuery.isError || accessQuery.isError;

  const allItems = useMemo(() => {
    const paymentItems = paymentsQuery.data?.items.map(toPaymentItem) ?? [];
    const accessItems = accessQuery.data?.items.map(toAccessItem) ?? [];
    return [...paymentItems, ...accessItems].sort((left, right) => {
      const leftTime = new Date(itemTimestamp(left) ?? 0).getTime();
      const rightTime = new Date(itemTimestamp(right) ?? 0).getTime();
      return rightTime - leftTime;
    });
  }, [accessQuery.data?.items, paymentsQuery.data?.items]);

  const filteredItems = useMemo(
    () => allItems.filter((item) => matchesFilter(item, activeFilter) && (itemType === 'all' || item.itemType === itemType) && matchesSearch(item, search)),
    [activeFilter, allItems, itemType, search]
  );

  const summary = useMemo(() => {
    const paymentItems = allItems.filter((item) => item.recordType === 'payment');
    return {
      failed: paymentItems.filter((item) => item.recordType === 'payment' && (item.status === 'failed' || item.status === 'cancelled')).length,
      paid: paymentItems.filter((item) => item.recordType === 'payment' && item.status === 'paid').length,
      pending: paymentItems.filter((item) => item.recordType === 'payment' && item.status === 'created').length,
      unlocked: allItems.filter((item) => item.recordType === 'access' && item.activeNow).length
    };
  }, [allItems]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  if (isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your payments and access records." eyebrow="Student account" title="Payments & Access" />
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-stack">
        <PageHeader description="We could not load your payments and access records right now." eyebrow="Student account" title="Payments & Access unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Track paid items, payment status, and unlocked access in one simple view."
        eyebrow="Student account"
        title="Payments & Access"
      />

      <section className="finance-summary-grid" aria-label="Payments and access summary">
        <article>
          <span>Unlocked</span>
          <strong>{summary.unlocked}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{summary.pending}</strong>
        </article>
        <article>
          <span>Paid</span>
          <strong>{summary.paid}</strong>
        </article>
        <article>
          <span>Failed</span>
          <strong>{summary.failed}</strong>
        </article>
      </section>

      <section className="filter-bar finance-filter-bar finance-filter-bar--merged" aria-label="Payments and access filters">
        <div className="finance-filter-pills" aria-label="Status filters">
          {filterOptions.map((option) => (
            <button className={activeFilter === option.value ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option.value} onClick={() => setActiveFilter(option.value)} type="button">
              {option.label}
            </button>
          ))}
        </div>
        <label className="announcement-filter-select">
          Item type
          <select value={itemType} onChange={(event) => setItemType(event.target.value as FinanceItemType | 'all')}>
            {itemTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <form className="finance-search-form" onSubmit={handleSearch}>
          <div className="filter-search finance-search-input">
            <Search size={16} />
            <label className="sr-only" htmlFor="payment-access-search">
              Search payments and access
            </label>
            <input id="payment-access-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search item, order, or access" type="search" />
          </div>
          <button className="segmented-button" type="submit">
            Search
          </button>
        </form>
      </section>

      {filteredItems.length > 0 ? (
        <section className="finance-list-panel" aria-label="Payments and access list">
          <header className="finance-list-panel__header">
            <div>
              <span className="eyebrow">Account activity</span>
              <h2>Payments & access list</h2>
            </div>
            <span>{filteredItems.length} shown</span>
          </header>

          <div className="finance-list">
            {filteredItems.map((item) => (
              <article className={item.recordType === 'access' ? 'finance-row finance-row--access' : 'finance-row'} key={`${item.recordType}-${item.id}`}>
                <div className="finance-row__icon">{getItemIcon(item)}</div>
                <div className="finance-row__main">
                  <div className="finance-row__title-line">
                    <h2>{getItemTitle(item)}</h2>
                    <strong>{getItemAmount(item)}</strong>
                  </div>
                  <div className="finance-row__chips">
                    <StatusBadge tone={getItemTone(item)}>{getItemStatusLabel(item)}</StatusBadge>
                    <span>{item.recordType === 'payment' ? 'Payment' : 'Access'}</span>
                    <span>{formatOption(item.itemType)}</span>
                    <time>{formatDate(itemTimestamp(item))}</time>
                  </div>
                  <div className="finance-row__meta">
                    {item.recordType === 'payment' ? (
                      <>
                        {renderReference('Order', item.orderId)}
                        {renderReference('Payment', item.paymentId)}
                        {renderReference('Receipt', item.receipt)}
                        {renderReference('Item', item.itemId)}
                      </>
                    ) : (
                      <>
                        {renderReference('Access', item.accessId)}
                        {renderReference('Granted', formatDate(item.grantedAt))}
                        {renderReference('Expires', formatDate(item.expiresAt))}
                        {renderReference('Payment', item.paymentId)}
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      <section className="finance-note">
        <ShieldCheck size={16} />
        <span>Access updates are handled by payment confirmation and the support/admin team.</span>
      </section>
    </div>
  );
}
