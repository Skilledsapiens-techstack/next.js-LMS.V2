import { Bookmark, ExternalLink, FileText, Library, Loader2, Lock, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentResource, useStudentResources } from '../features/student/useStudentResources';
import { StudentPaymentOrder, useStudentPaymentOrders } from '../features/student/useStudentPaymentOrders';

const resourceTypeOptions = [
  { label: 'All resource types', value: '' },
  { label: 'General', value: 'general' },
  { label: 'Template', value: 'template' },
  { label: 'Case Material', value: 'case_material' },
  { label: 'Project Resource', value: 'project_resource' },
  { label: 'Live Session Material', value: 'live_session_material' },
  { label: 'Placement Resource', value: 'placement_resource' },
  { label: 'Assignment Reference', value: 'assignment_reference' }
];

const bookmarkStorageKey = 'skilled-sapiens-student-resource-bookmarks';

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPrice(resource: StudentResource) {
  if (resource.price == null) {
    return resource.accessType === 'paid' ? 'Paid' : 'Free';
  }

  return `${resource.currency ?? 'INR'} ${resource.price}`;
}

function hasResourceAccess(resource: StudentResource) {
  return !resource.locked && resource.hasAccess !== false;
}

function formatReadableLabel(value: string | undefined) {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildPageLink(page: number, search: string, resourceType: string, programKey: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (resourceType) params.set('resourceType', resourceType);
  if (programKey) params.set('programKey', programKey);
  return `?${params.toString()}`;
}

function matchingPaymentOrder(resource: StudentResource, orders: StudentPaymentOrder[]) {
  return orders.find((order) => order.itemType === 'resource' && [resource.resourceId, resource.id].includes(order.itemId));
}

function ResourceEmptyState({ description, title }: { description: string; title: string }) {
  return (
    <section className="screen-state student-resource-empty">
      <Search size={22} />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}

function resourceBookmarkId(resource: StudentResource) {
  return resource.resourceId || resource.id;
}

function isRecentlyAdded(resource: StudentResource) {
  if (!resource.updatedAt) return false;
  const updatedAt = new Date(resource.updatedAt).getTime();
  return !Number.isNaN(updatedAt) && updatedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function groupResourcesByType(resources: StudentResource[]) {
  return resources.reduce<Array<{ label: string; resources: StudentResource[]; type: string }>>((groups, resource) => {
    const type = resource.resourceType || 'general';
    const existing = groups.find((group) => group.type === type);
    if (existing) {
      existing.resources.push(resource);
      return groups;
    }
    return [...groups, { label: formatReadableLabel(type) || 'General', resources: [resource], type }];
  }, []);
}

function ResourceCard({
  bookmarked,
  isCheckingAccess,
  onToggleBookmark,
  onRefreshAccess,
  paymentOrder,
  resource
}: {
  bookmarked: boolean;
  isCheckingAccess: boolean;
  onToggleBookmark: (resource: StudentResource) => void;
  onRefreshAccess: () => void;
  paymentOrder?: StudentPaymentOrder;
  resource: StudentResource;
}) {
  const [isOpening, setIsOpening] = useState(false);
  const canOpen = hasResourceAccess(resource) && Boolean(resource.url);
  const isPaymentPending = resource.locked && paymentOrder?.status === 'created';
  const canPay = resource.locked && resource.accessType === 'paid' && Boolean(resource.paymentLink) && !isPaymentPending;
  const priceLabel = formatPrice(resource);
  const primaryLabel = canOpen ? 'Open Resource' : canPay ? `Pay ${priceLabel}` : isPaymentPending ? 'Check Payment Status' : 'Locked';
  const commerceTone = canOpen ? 'ready' : canPay ? 'paid' : isPaymentPending ? 'pending' : 'locked';
  const commerceTitle = canOpen ? 'Ready to open' : canPay ? priceLabel : isPaymentPending ? 'Payment pending' : 'Access locked';
  const commerceCopy = canOpen
    ? 'This resource is available for your account.'
    : canPay
      ? 'Complete payment to unlock the resource link.'
      : isPaymentPending
        ? 'Use this after checkout if access has not refreshed yet.'
        : (resource.lockReason ?? 'This resource is not available for your account yet.');

  function markOpening() {
    setIsOpening(true);
    window.setTimeout(() => setIsOpening(false), 1200);
  }

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
          {isRecentlyAdded(resource) ? <StatusBadge tone="safe">Recently added</StatusBadge> : null}
        </div>

        <div>
          <h2>{resource.title}</h2>
          <p>{resource.description ?? resource.resourceId ?? 'Learning material for your enrolled program.'}</p>
        </div>

        <div className="resource-card__meta">
          <StatusBadge>{formatReadableLabel(resource.resourceType)}</StatusBadge>
          {resource.resourceMode ? <StatusBadge>{formatReadableLabel(resource.resourceMode)}</StatusBadge> : null}
          {resource.phase ? <StatusBadge>{formatReadableLabel(resource.phase)}</StatusBadge> : null}
          {resource.updatedAt ? <StatusBadge>{formatDate(resource.updatedAt)}</StatusBadge> : null}
        </div>

        {resource.programKeys.length > 0 ? <p className="resource-card__audience">{resource.programKeys.map((key) => key.toUpperCase()).join(', ')}</p> : null}

        <aside className={`resource-card__commerce resource-card__commerce--${commerceTone}`} aria-label="Resource action">
          <span className="resource-card__commerce-label">{resource.accessType === 'paid' ? 'Paid resource' : 'Resource access'}</span>
          <strong>{commerceTitle}</strong>
          <p>{commerceCopy}</p>

          {canOpen ? (
            <a className="student-action student-action--primary resource-card__action" href={resource.url} onClick={markOpening} rel="noreferrer" target="_blank">
              {isOpening ? <Loader2 className="workshop-action-spinner" size={16} /> : <ExternalLink size={16} />}
              {isOpening ? 'Opening...' : primaryLabel}
            </a>
          ) : canPay ? (
            <a className="student-action student-action--primary resource-card__action" href={resource.paymentLink} onClick={markOpening} rel="noreferrer" target="_blank">
              {isOpening ? <Loader2 className="workshop-action-spinner" size={16} /> : <ExternalLink size={16} />}
              {isOpening ? 'Opening...' : primaryLabel}
            </a>
          ) : isPaymentPending ? (
            <button className="student-action student-action--primary resource-card__action" disabled={isCheckingAccess} onClick={onRefreshAccess} type="button">
              {isCheckingAccess ? <Loader2 className="workshop-action-spinner" size={16} /> : <RefreshCw size={16} />}
              {isCheckingAccess ? 'Checking...' : primaryLabel}
            </button>
          ) : (
            <div className="resource-card__locked-note">
              <Lock size={15} />
              <span>Unavailable</span>
            </div>
          )}

          <button
            aria-pressed={bookmarked}
            className={bookmarked ? 'resource-card__bookmark resource-card__bookmark--active' : 'resource-card__bookmark'}
            onClick={() => onToggleBookmark(resource)}
            type="button"
          >
            <Bookmark size={15} />
            {bookmarked ? 'Saved' : 'Save'}
          </button>
        </aside>
      </div>
    </article>
  );
}

export function StudentResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const programKey = searchParams.get('programKey')?.trim() ?? '';
  const resourceType = searchParams.get('resourceType')?.trim() ?? '';
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [resourceTypeInput, setResourceTypeInput] = useState(resourceType);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [bookmarkedResourceIds, setBookmarkedResourceIds] = useState<string[]>([]);
  const resourcesQuery = useStudentResources({ locked: 'all', page, programKey, resourceType, search });
  const paymentOrdersQuery = useStudentPaymentOrders({ itemType: 'resource', limit: 100, page: 1, status: 'all' });
  const data = resourcesQuery.data;
  const paymentOrders = paymentOrdersQuery.data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const summary = data?.summary;
  const lockedCount = summary?.locked ?? 0;
  const availableCount = summary?.available ?? 0;
  const paidCount = summary?.paid ?? 0;
  const recentlyAddedCount = summary?.recentlyAdded ?? 0;
  const pageResources = data?.items ?? [];
  const sortedResources = useMemo(
    () =>
      [...pageResources].sort((left, right) => {
        const leftBookmarked = bookmarkedResourceIds.includes(resourceBookmarkId(left)) ? 1 : 0;
        const rightBookmarked = bookmarkedResourceIds.includes(resourceBookmarkId(right)) ? 1 : 0;
        if (leftBookmarked !== rightBookmarked) return rightBookmarked - leftBookmarked;
        const leftAvailable = hasResourceAccess(left) ? 1 : 0;
        const rightAvailable = hasResourceAccess(right) ? 1 : 0;
        if (leftAvailable !== rightAvailable) return rightAvailable - leftAvailable;
        return new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime();
      }),
    [bookmarkedResourceIds, pageResources]
  );
  const bookmarkedResources = useMemo(() => sortedResources.filter((resource) => bookmarkedResourceIds.includes(resourceBookmarkId(resource))), [bookmarkedResourceIds, sortedResources]);
  const groupedResources = useMemo(() => groupResourcesByType(sortedResources), [sortedResources]);
  const hasPendingPayment = useMemo(() => pageResources.some((resource) => matchingPaymentOrder(resource, paymentOrders)?.status === 'created'), [pageResources, paymentOrders]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(bookmarkStorageKey);
      if (stored) setBookmarkedResourceIds(JSON.parse(stored));
    } catch {
      setBookmarkedResourceIds([]);
    }
  }, []);

  function updateBookmarks(nextIds: string[]) {
    setBookmarkedResourceIds(nextIds);
    try {
      window.localStorage.setItem(bookmarkStorageKey, JSON.stringify(nextIds));
    } catch {
      // Local bookmarks are a convenience only; ignore storage failures.
    }
  }

  function toggleBookmark(resource: StudentResource) {
    const id = resourceBookmarkId(resource);
    updateBookmarks(bookmarkedResourceIds.includes(id) ? bookmarkedResourceIds.filter((item) => item !== id) : [...bookmarkedResourceIds, id]);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsApplyingFilters(true);
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
    setSearchParams(next);
    window.setTimeout(() => setIsApplyingFilters(false), 500);
  }

  function clearProgramScope() {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    next.delete('programKey');
    setSearchParams(next);
  }

  async function refreshPaymentAccess() {
    setIsCheckingAccess(true);
    try {
      await Promise.all([resourcesQuery.refetch(), paymentOrdersQuery.refetch()]);
    } finally {
      setIsCheckingAccess(false);
    }
  }

  if (resourcesQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading resource library items visible to your student profile." eyebrow="Resource library" title="Resource Library" />
        <LoadingState />
      </div>
    );
  }

  if (resourcesQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Resource Library could not be loaded right now." eyebrow="Resource library" title="Resource Library unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Browse learning resources available to your account, including templates, compendiums, and helpful links."
        eyebrow="Resource library"
        title="Resource Library"
      />

      <div className="metric-grid">
        <article className="metric-tile">
          <Library size={22} />
          <span>Matching resources</span>
          <strong>{total}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Available here</span>
          <strong>{availableCount}</strong>
        </article>
        <article className="metric-tile">
          <Lock size={22} />
          <span>Paid here</span>
          <strong>{paidCount}</strong>
        </article>
        <article className="metric-tile">
          <Bookmark size={22} />
          <span>Saved here</span>
          <strong>{bookmarkedResources.length}</strong>
        </article>
      </div>

      <section className="student-resource-toolbar" aria-label="Resource filters">
        <form className="student-resource-search" onSubmit={handleSearch}>
          <div className="filter-search">
            <Search size={16} />
            <label className="sr-only" htmlFor="resource-search">
              Search resources
            </label>
            <input id="resource-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search resources" type="search" />
          </div>
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
          <button className="segmented-button" disabled={isApplyingFilters || resourcesQuery.isFetching} type="submit">
            {isApplyingFilters || resourcesQuery.isFetching ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
            {isApplyingFilters || resourcesQuery.isFetching ? 'Applying...' : 'Apply'}
          </button>
        </form>
        {programKey ? (
          <div className="student-resource-scope">
            <span>Program: {programKey.toUpperCase()}</span>
            <button className="segmented-button" onClick={clearProgramScope} type="button">
              Show all programs
            </button>
          </div>
        ) : null}
        {hasPendingPayment ? (
          <div className="student-resource-payment-check">
            <span>Payment confirmation can take a moment after checkout.</span>
            <button className="segmented-button" disabled={isCheckingAccess || resourcesQuery.isFetching || paymentOrdersQuery.isFetching} onClick={() => void refreshPaymentAccess()} type="button">
              {isCheckingAccess || resourcesQuery.isFetching || paymentOrdersQuery.isFetching ? <Loader2 className="workshop-action-spinner" size={14} /> : <RefreshCw size={14} />}
              {isCheckingAccess || resourcesQuery.isFetching || paymentOrdersQuery.isFetching ? 'Checking...' : 'Refresh access'}
            </button>
          </div>
        ) : null}
      </section>

      {data && sortedResources.length > 0 ? (
        <section className="student-resource-library" aria-label="Visible resources">
          {bookmarkedResources.length > 0 ? (
            <section className="student-resource-group">
              <header>
                <span>Saved</span>
                <strong>{bookmarkedResources.length}</strong>
              </header>
              <div className="resource-card-grid">
                {bookmarkedResources.map((resource) => (
                  <ResourceCard
                    bookmarked={bookmarkedResourceIds.includes(resourceBookmarkId(resource))}
                    isCheckingAccess={isCheckingAccess || resourcesQuery.isFetching || paymentOrdersQuery.isFetching}
                    key={`saved-${resource.id}`}
                    onToggleBookmark={toggleBookmark}
                    onRefreshAccess={() => void refreshPaymentAccess()}
                    paymentOrder={matchingPaymentOrder(resource, paymentOrders)}
                    resource={resource}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {groupedResources.map((group) => (
            <section className="student-resource-group" key={group.type}>
              <header>
                <span>{group.label}</span>
                <strong>{group.resources.length}</strong>
              </header>
              <div className="resource-card-grid">
                {group.resources.map((resource) => (
                  <ResourceCard
                    bookmarked={bookmarkedResourceIds.includes(resourceBookmarkId(resource))}
                    isCheckingAccess={isCheckingAccess || resourcesQuery.isFetching || paymentOrdersQuery.isFetching}
                    key={resource.id}
                    onToggleBookmark={toggleBookmark}
                    onRefreshAccess={() => void refreshPaymentAccess()}
                    paymentOrder={matchingPaymentOrder(resource, paymentOrders)}
                    resource={resource}
                  />
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : (
        <ResourceEmptyState
          description={
            search
              ? `No resources match "${search}". Try a shorter search or clear filters.`
              : 'Resource library items mapped to your account will appear here.'
          }
          title={search || resourceType || programKey ? 'No matching resource library items' : 'No resource library items yet'}
        />
      )}

      <nav className="pagination-bar" aria-label="Resource pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, resourceType, programKey)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages} · {total} matching · {recentlyAddedCount} recent
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, resourceType, programKey)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>

      {lockedCount > 0 ? <LockedState /> : null}

      <StateBlock title="Resource access">
        Only resources mapped to your account are shown here. Paid resources unlock after payment confirmation.
      </StateBlock>
    </div>
  );
}
