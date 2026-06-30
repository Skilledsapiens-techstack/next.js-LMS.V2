import { ExternalLink, FileText, Library, Lock, Search, ShieldCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, LockedState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentResource, StudentResourceAccessType, useStudentResources } from '../features/student/useStudentResources';

type AccessFilter = StudentResourceAccessType | 'all';

const accessFilters: Array<{ label: string; value: AccessFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Paid', value: 'paid' }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function asAccessType(value: string | null): AccessFilter {
  return value === 'free' || value === 'paid' ? value : 'all';
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

function buildPageLink(page: number, accessType: AccessFilter, search: string, resourceType: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (accessType !== 'all') params.set('accessType', accessType);
  if (search) params.set('search', search);
  if (resourceType) params.set('resourceType', resourceType);
  return `?${params.toString()}`;
}

function ResourceCard({ resource }: { resource: StudentResource }) {
  const canOpen = !resource.locked && resource.hasAccess && Boolean(resource.url);

  return (
    <article className="resource-card">
      <div className="resource-card__icon" aria-hidden="true">
        <FileText size={28} />
      </div>

      <div className="resource-card__body">
        <div className="resource-card__header">
          <StatusBadge tone={resource.locked ? 'warning' : 'safe'}>{resource.locked ? 'Locked' : 'Available'}</StatusBadge>
          <StatusBadge>{formatPrice(resource)}</StatusBadge>
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

        {canOpen ? (
          <a className="student-action student-action--primary resource-card__action" href={resource.url} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            Open resource
          </a>
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
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const resourceType = searchParams.get('resourceType')?.trim() ?? '';
  const search = searchParams.get('search')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [resourceTypeInput, setResourceTypeInput] = useState(resourceType);
  const resourcesQuery = useStudentResources({ accessType, page, resourceType, search });
  const data = resourcesQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const lockedCount = useMemo(() => data?.items.filter((item) => item.locked).length ?? 0, [data?.items]);
  const availableCount = useMemo(() => data?.items.filter((item) => !item.locked && item.hasAccess).length ?? 0, [data?.items]);

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
          <input id="resource-type" value={resourceTypeInput} onChange={(event) => setResourceTypeInput(event.target.value)} placeholder="Type, e.g. pdf" type="search" />
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
      </section>

      {data && data.items.length > 0 ? (
        <section className="resource-card-grid" aria-label="Visible resources">
          {data.items.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      <nav className="pagination-bar" aria-label="Resource pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, accessType, search, resourceType)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, accessType, search, resourceType)}>
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
