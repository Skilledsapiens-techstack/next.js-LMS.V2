import { ExternalLink, FileText, Library, Lock, Search, ShieldCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentResource, StudentResourceAccessType, useStudentResources } from '../features/student/useStudentResources';
import { StudentPaymentOrder, useStudentPaymentOrders } from '../features/student/useStudentPaymentOrders';

type AccessFilter = StudentResourceAccessType | 'all';
type AvailabilityFilter = 'all' | 'available' | 'locked';

const accessFilters: Array<{ label: string; value: AccessFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Paid', value: 'paid' }
];

const availabilityFilters: Array<{ label: string; value: AvailabilityFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Locked', value: 'locked' }
];

const resourceTypeOptions = [
  { label: 'All Types', value: '' },
  { label: 'General', value: 'general' },
  { label: 'Template', value: 'template' },
  { label: 'Case Material', value: 'case_material' },
  { label: 'Project Resource', value: 'project_resource' },
  { label: 'Live Session Material', value: 'live_session_material' },
  { label: 'Placement Resource', value: 'placement_resource' },
  { label: 'Assignment Reference', value: 'assignment_reference' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function asAccessType(value: string | null): AccessFilter {
  return value === 'free' || value === 'paid' ? value : 'all';
}

function asAvailability(value: string | null): AvailabilityFilter {
  return value === 'available' || value === 'locked' ? value : 'all';
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPrice(resource: StudentResource) {
  if (resource.price === undefined) {
    return resource.accessType === 'paid' ? 'Paid' : 'Free';
  }

  return `${resource.currency ?? 'INR'} ${resource.price}`;
}

function formatFilterLabel(value: string) {
  return value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1);
}

function buildPageLink(page: number, accessType: AccessFilter, availability: AvailabilityFilter, search: string, resourceType: string, programKey: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (accessType !== 'all') params.set('accessType', accessType);
  if (availability !== 'all') params.set('availability', availability);
  if (search) params.set('search', search);
  if (resourceType) params.set('resourceType', resourceType);
  if (programKey) params.set('programKey', programKey);
  return `?${params.toString()}`;
}

function matchingPaymentOrder(resource: StudentResource, orders: StudentPaymentOrder[]) {
  return orders.find((order) => order.itemType === 'resource' && [resource.resourceId, resource.id].includes(order.itemId));
}

function ResourceCard({ paymentOrder, resource }: { paymentOrder?: StudentPaymentOrder; resource: StudentResource }) {
  const canOpen = !resource.locked && resource.hasAccess && Boolean(resource.url);
  const isPaymentPending = resource.locked && paymentOrder?.status === 'created';
  const canPay = resource.locked && resource.accessType === 'paid' && Boolean(resource.paymentLink) && !isPaymentPending;

  return (
    <article className="resource-card">
      <div className="resource-card__icon" aria-hidden="true">
        <FileText size={28} />
      </div>

      <div className="resource-card__body">
        <div className="resource-card__header">
          <StatusBadge tone={resource.locked ? 'warning' : 'safe'}>{resource.locked ? 'Locked' : 'Available'}</StatusBadge>
          <StatusBadge>{formatPrice(resource)}</StatusBadge>
          {isPaymentPending ? <StatusBadge tone="warning">Payment pending</StatusBadge> : null}
        </div>

        <div>
          <h2>{resource.title}</h2>
          <p>{resource.description ?? resource.resourceId ?? 'Learning material for your enrolled program.'}</p>
        </div>

        <div className="resource-card__meta">
          <StatusBadge>{resource.resourceType}</StatusBadge>
          {resource.resourceMode ? <StatusBadge>{resource.resourceMode}</StatusBadge> : null}
          {resource.phase ? <StatusBadge>{resource.phase}</StatusBadge> : null}
          {resource.updatedAt ? <StatusBadge>{formatDate(resource.updatedAt)}</StatusBadge> : null}
        </div>

        {resource.programKeys.length > 0 ? <p className="resource-card__audience">{resource.programKeys.join(', ')}</p> : null}

        {resource.locked && resource.accessType === 'paid' ? (
          <p className="resource-card__payment-copy">
            {isPaymentPending ? 'Payment is pending. Access unlocks after payment confirmation.' : `Unlock this resource for ${formatPrice(resource)}.`}
          </p>
        ) : null}

        {canOpen ? (
          <a className="student-action student-action--primary resource-card__action" href={resource.url} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Open resource
          </a>
        ) : canPay ? (
          <a className="student-action student-action--primary resource-card__action" href={resource.paymentLink} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Pay to unlock
          </a>
        ) : isPaymentPending ? (
          <div className="recording-card__locked">
            <Lock size={16} />
            <span>Payment pending. Resource link will unlock after confirmation.</span>
          </div>
        ) : (
          <div className="recording-card__locked">
            <Lock size={16} />
            <span>{resource.lockReason ?? 'Resource access is locked for this account.'}</span>
          </div>
        )}
      </div>
    </article>
  );
}

export function StudentResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accessType = asAccessType(searchParams.get('accessType'));
  const availability = asAvailability(searchParams.get('availability'));
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const programKey = searchParams.get('programKey')?.trim() ?? '';
  const resourceType = searchParams.get('resourceType')?.trim() ?? '';
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [resourceTypeInput, setResourceTypeInput] = useState(resourceType);
  const [programKeyInput, setProgramKeyInput] = useState(programKey);
  const locked = availability === 'locked' ? true : availability === 'available' ? false : 'all';
  const resourcesQuery = useStudentResources({ accessType, locked, page, programKey, resourceType, search });
  const paymentOrdersQuery = useStudentPaymentOrders({ itemType: 'resource', limit: 100, page: 1, status: 'all' });
  const data = resourcesQuery.data;
  const paymentOrders = paymentOrdersQuery.data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const lockedCount = useMemo(() => data?.items.filter((item) => item.locked).length ?? 0, [data?.items]);
  const availableCount = useMemo(() => data?.items.filter((item) => !item.locked && item.hasAccess).length ?? 0, [data?.items]);
  const programOptions = useMemo(() => {
    const keys = new Set<string>();
    data?.items.forEach((item) => item.programKeys.forEach((key) => keys.add(key)));
    if (programKey) keys.add(programKey);
    return Array.from(keys).sort();
  }, [data?.items, programKey]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (searchInput.trim()) {
      next.set('search', searchInput.trim());
    } else {
      next.delete('search');
    }
    if (resourceTypeInput.trim()) {
      next.set('resourceType', resourceTypeInput.trim());
    } else {
      next.delete('resourceType');
    }
    if (programKeyInput.trim()) {
      next.set('programKey', programKeyInput.trim());
    } else {
      next.delete('programKey');
    }
    setSearchParams(next);
  }

  function handleAccessType(nextAccessType: AccessFilter) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (nextAccessType === 'all') {
      next.delete('accessType');
    } else {
      next.set('accessType', nextAccessType);
    }
    setSearchParams(next);
  }

  function handleAvailability(nextAvailability: AvailabilityFilter) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (nextAvailability === 'all') {
      next.delete('availability');
    } else {
      next.set('availability', nextAvailability);
    }
    setSearchParams(next);
  }

  if (resourcesQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading resources visible to your student profile." eyebrow="Student resources" title="Resources" />
        <LoadingState />
      </div>
    );
  }

  if (resourcesQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Resources could not be loaded right now." eyebrow="Student resources" title="Resources unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Browse learning resources available to your account, including templates, compendiums, and helpful links."
        eyebrow="Student resources"
        title="Resources"
      />

      <div className="metric-grid">
        <article className="metric-tile">
          <Library size={22} />
          <span>Total visible</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Available on page</span>
          <strong>{availableCount}</strong>
        </article>
        <article className="metric-tile">
          <Lock size={22} />
          <span>Locked on page</span>
          <strong>{lockedCount}</strong>
        </article>
        <article className="metric-tile">
          <Search size={22} />
          <span>Access filter</span>
          <strong>{formatFilterLabel(accessType)}</strong>
        </article>
      </div>

      <section className="filter-bar" aria-label="Resource filters">
        <form className="filter-search filter-search--wide" onSubmit={handleSearch}>
          <Search size={16} />
          <label className="sr-only" htmlFor="resource-search">
            Search resources
          </label>
          <input id="resource-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search resources" type="search" />
          <label className="sr-only" htmlFor="resource-type">
            Resource type
          </label>
          <select id="resource-type" value={resourceTypeInput} onChange={(event) => setResourceTypeInput(event.target.value)}>
            {resourceTypeOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="resource-program">
            Program
          </label>
          <select id="resource-program" value={programKeyInput} onChange={(event) => setProgramKeyInput(event.target.value)}>
            <option value="">All Programs</option>
            {programOptions.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
          <button className="segmented-button" type="submit">
            Apply
          </button>
        </form>
        <div className="filter-bar__controls">
          {accessFilters.map((filter) => (
            <button className={`segmented-button ${accessType === filter.value ? 'segmented-button--active' : ''}`} key={filter.value} onClick={() => handleAccessType(filter.value)} type="button">
              {filter.label}
            </button>
          ))}
        </div>
        <div className="filter-bar__controls">
          {availabilityFilters.map((filter) => (
            <button className={`segmented-button ${availability === filter.value ? 'segmented-button--active' : ''}`} key={filter.value} onClick={() => handleAvailability(filter.value)} type="button">
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {data && data.items.length > 0 ? (
        <section className="resource-card-grid" aria-label="Visible resources">
          {data.items.map((resource) => (
            <ResourceCard key={resource.id} paymentOrder={matchingPaymentOrder(resource, paymentOrders)} resource={resource} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Resource pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, accessType, availability, search, resourceType, programKey)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, accessType, availability, search, resourceType, programKey)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {lockedCount > 0 ? <LockedState /> : null}

      <StateBlock title="Resource access">
        Only resources available to your account are shown here. If a resource is missing, contact Support with the resource name and program details.
      </StateBlock>
    </div>
  );
}
