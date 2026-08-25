import { Bookmark, ExternalLink, FileText, Loader2, Lock, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { useCreateStudentCheckout } from '../features/student/useStudentCheckout';
import { StudentResource, useStudentResourceDomains, useStudentResources } from '../features/student/useStudentResources';
import { StudentPaymentOrder, useStudentPaymentOrders } from '../features/student/useStudentPaymentOrders';

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
  const price = Number(resource.price);
  if (resource.price == null || !Number.isFinite(price) || price <= 0) return resource.accessType === 'paid' ? 'Paid' : '';

  return `${resource.currency ?? 'INR'} ${price}`;
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

function buildPageLink(page: number, programKey: string, resourceDomainKey: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (programKey) params.set('programKey', programKey);
  if (resourceDomainKey) params.set('resourceDomainKey', resourceDomainKey);
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
  isStartingCheckout,
  onToggleBookmark,
  onRefreshAccess,
  onStartCheckout,
  paymentOrder,
  resource
}: {
  bookmarked: boolean;
  isCheckingAccess: boolean;
  isStartingCheckout: boolean;
  onToggleBookmark: (resource: StudentResource) => void;
  onRefreshAccess: () => void;
  onStartCheckout: (resource: StudentResource) => void;
  paymentOrder?: StudentPaymentOrder;
  resource: StudentResource;
}) {
  const [isOpening, setIsOpening] = useState(false);
  const canOpen = hasResourceAccess(resource) && Boolean(resource.url);
  const isPaymentPending = resource.locked && paymentOrder?.status === 'created';
  const canPay = resource.locked && resource.accessType === 'paid' && !isPaymentPending;
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
          {priceLabel ? <StatusBadge>{priceLabel}</StatusBadge> : null}
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
            <button className="student-action student-action--primary resource-card__action" disabled={isStartingCheckout} onClick={() => onStartCheckout(resource)} type="button">
              {isStartingCheckout ? <Loader2 className="workshop-action-spinner" size={16} /> : <ExternalLink size={16} />}
              {isStartingCheckout ? 'Preparing...' : primaryLabel}
            </button>
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
  const resourceDomainKey = searchParams.get('resourceDomainKey')?.trim() ?? '';
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [bookmarkedResourceIds, setBookmarkedResourceIds] = useState<string[]>([]);
  const createCheckout = useCreateStudentCheckout();
  const resourcesQuery = useStudentResources({ locked: 'all', page, programKey, resourceDomainKey });
  const resourceDomainsQuery = useStudentResourceDomains({ programKey });
  const paymentOrdersQuery = useStudentPaymentOrders({ itemType: 'resource', limit: 100, page: 1, status: 'all' });
  const data = resourcesQuery.data;
  const paymentOrders = paymentOrdersQuery.data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const summary = data?.summary;
  const lockedCount = summary?.locked ?? 0;
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
  const resourceDomainOptions = resourceDomainsQuery.data ?? [];
  const hasPendingPayment = useMemo(() => pageResources.some((resource) => matchingPaymentOrder(resource, paymentOrders)?.status === 'created'), [pageResources, paymentOrders]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(bookmarkStorageKey);
      if (stored) setBookmarkedResourceIds(JSON.parse(stored));
    } catch {
      setBookmarkedResourceIds([]);
    }
  }, []);

  useEffect(() => {
    if (resourceDomainsQuery.isLoading || resourceDomainsQuery.isFetching || !resourceDomainKey) return;
    const isVisibleOption = resourceDomainOptions.some((option) => option.domainKey === resourceDomainKey);
    if (isVisibleOption) return;
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    next.delete('resourceDomainKey');
    setSearchParams(next);
  }, [resourceDomainKey, resourceDomainOptions, resourceDomainsQuery.isFetching, resourceDomainsQuery.isLoading, searchParams, setSearchParams]);

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

  function updateResourceDomain(nextDomainKey: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (nextDomainKey) next.set('resourceDomainKey', nextDomainKey);
    else next.delete('resourceDomainKey');
    setSearchParams(next);
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

  async function startResourceCheckout(resource: StudentResource) {
    const itemId = resource.resourceId || resource.id;
    const checkoutWindow = window.open('', '_blank');
    try {
      const checkout = await createCheckout.mutateAsync({ itemId, itemType: 'resource' });
      const checkoutUrl = checkout.checkoutUrl ?? checkout.paymentLink;
      if (checkoutUrl && checkoutWindow) {
        checkoutWindow.opener = null;
        checkoutWindow.location.href = checkoutUrl;
      } else if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        checkoutWindow?.close();
      }
    } catch {
      checkoutWindow?.close();
      await refreshPaymentAccess();
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

      {programKey || hasPendingPayment ? (
      <section className="student-resource-toolbar" aria-label="Resource notices">
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
      ) : null}

      {resourceDomainOptions.length > 0 ? (
        <nav className="student-resource-domain-tabs" aria-label="Resource Domain filters">
          <button className={!resourceDomainKey ? 'student-resource-domain-tab student-resource-domain-tab--active' : 'student-resource-domain-tab'} onClick={() => updateResourceDomain('')} type="button">
            <span>All</span>
            <strong>{resourceDomainOptions.reduce((totalCount, option) => totalCount + option.count, 0)}</strong>
          </button>
          {resourceDomainOptions.map((option) => (
            <button
              className={resourceDomainKey === option.domainKey ? 'student-resource-domain-tab student-resource-domain-tab--active' : 'student-resource-domain-tab'}
              key={option.domainKey}
              onClick={() => updateResourceDomain(option.domainKey)}
              type="button"
            >
              <span>{option.label}</span>
              <strong>{option.count}</strong>
            </button>
          ))}
        </nav>
      ) : null}

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
                    isStartingCheckout={createCheckout.isPending}
                    key={`saved-${resource.id}`}
                    onToggleBookmark={toggleBookmark}
                    onRefreshAccess={() => void refreshPaymentAccess()}
                    onStartCheckout={(item) => void startResourceCheckout(item)}
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
                    isStartingCheckout={createCheckout.isPending}
                    key={resource.id}
                    onToggleBookmark={toggleBookmark}
                    onRefreshAccess={() => void refreshPaymentAccess()}
                    onStartCheckout={(item) => void startResourceCheckout(item)}
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
          description="Resource library items mapped to your account will appear here."
          title={programKey || resourceDomainKey ? 'No matching resource library items' : 'No resource library items yet'}
        />
      )}

      <nav className="pagination-bar" aria-label="Resource pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, programKey, resourceDomainKey)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages} · {total} matching · {recentlyAddedCount} recent
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, programKey, resourceDomainKey)}>
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
