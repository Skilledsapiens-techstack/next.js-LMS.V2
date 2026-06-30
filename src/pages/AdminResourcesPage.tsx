import { Plus, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminCohorts } from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';
import { AdminResource, AdminResourceStatus, useAdminResources } from '../features/admin/useAdminResources';

type ResourceFormState = {
  accessType: 'free' | 'paid';
  cohortNames: string[];
  currency: string;
  description: string;
  domainKey: string;
  paymentLink: string;
  price: string;
  programKey: string;
  resourceId: string;
  resourceMode: string;
  resourceType: string;
  status: AdminResourceStatus;
  title: string;
  url: string;
};

type ResourceStatusFilter = AdminResourceStatus | 'all';

const statusOptions: Array<{ label: string; value: ResourceStatusFilter }> = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
];

const emptyResourceForm: ResourceFormState = {
  accessType: 'free',
  cohortNames: [],
  currency: 'INR',
  description: '',
  domainKey: '',
  paymentLink: '',
  price: '',
  programKey: '',
  resourceId: `RES-${Date.now()}`,
  resourceMode: 'Link',
  resourceType: 'General',
  status: 'active',
  title: '',
  url: ''
};

function formatDateTime(value: string | undefined) {
  if (!value) return 'Auto';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function toTitle(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function mapResourceToForm(resource: AdminResource): ResourceFormState {
  return {
    accessType: resource.accessType,
    cohortNames: resource.cohortNames,
    currency: resource.currency || 'INR',
    description: resource.description ?? '',
    domainKey: resource.domainKey ?? '',
    paymentLink: '',
    price: resource.price === undefined ? '' : String(resource.price),
    programKey: resource.programKeys.join(','),
    resourceId: resource.resourceId ?? resource.id,
    resourceMode: toTitle(resource.resourceMode, 'Link'),
    resourceType: toTitle(resource.resourceType, 'General'),
    status: resource.status,
    title: resource.title,
    url: resource.url ?? ''
  };
}

function resourceMatchesProgram(resource: AdminResource, programKey: string) {
  if (!programKey) return true;
  return resource.programKeys.some((key) => key === programKey);
}

function resourceMatchesCohort(resource: AdminResource, cohortName: string) {
  if (!cohortName) return true;
  return resource.cohortNames.some((name) => name === cohortName);
}

export function AdminResourcesPage() {
  const [formState, setFormState] = useState<ResourceFormState>(emptyResourceForm);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ResourceStatusFilter>('all');
  const [programFilter, setProgramFilter] = useState('');
  const [cohortFilter, setCohortFilter] = useState('');
  const resourcesQuery = useAdminResources({ limit: 100, page: 1, search, status: statusFilter });
  const programsQuery = useAdminPrograms({ limit: 100, page: 1, status: 'all' });
  const cohortsQuery = useAdminCohorts({ limit: 100, page: 1, sort: 'name', status: 'all' });

  const resources = resourcesQuery.data?.items ?? [];
  const programs = programsQuery.data?.items ?? [];
  const cohorts = cohortsQuery.data?.items ?? [];
  const selectableCohorts = cohorts.filter((cohort) => cohort.status === 'active' || cohort.status === 'upcoming');
  const lastRefresh = formatDateTime(resources[0]?.updatedAt);

  const filteredResources = useMemo(
    () => resources.filter((resource) => resourceMatchesProgram(resource, programFilter) && resourceMatchesCohort(resource, cohortFilter)),
    [cohortFilter, programFilter, resources]
  );

  const selectedCohortSet = useMemo(() => new Set(formState.cohortNames), [formState.cohortNames]);
  const derivedProgramKeys = useMemo(() => {
    const keys = selectableCohorts.filter((cohort) => selectedCohortSet.has(cohort.name)).map((cohort) => cohort.programKey).filter(Boolean);
    return Array.from(new Set(keys)).join(',');
  }, [selectableCohorts, selectedCohortSet]);
  const derivedDomainKeys = useMemo(() => {
    const keys = selectableCohorts.filter((cohort) => selectedCohortSet.has(cohort.name)).map((cohort) => cohort.domainKey).filter(Boolean);
    return Array.from(new Set(keys)).join(',');
  }, [selectableCohorts, selectedCohortSet]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function handleNewResource() {
    setSelectedResourceId(null);
    setFormState({ ...emptyResourceForm, resourceId: `RES-${Date.now()}` });
  }

  function handleEdit(resource: AdminResource) {
    setSelectedResourceId(resource.id);
    setFormState(mapResourceToForm(resource));
  }

  function updateForm<K extends keyof ResourceFormState>(key: K, value: ResourceFormState[K]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function toggleCohort(name: string) {
    setFormState((current) => {
      const next = new Set(current.cohortNames);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...current, cohortNames: Array.from(next) };
    });
  }

  function selectAllCohorts() {
    setFormState((current) => ({ ...current, cohortNames: selectableCohorts.map((cohort) => cohort.name) }));
  }

  function clearCohorts() {
    setFormState((current) => ({ ...current, cohortNames: [] }));
  }

  if (resourcesQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading resources." eyebrow="Module refresh" title="Resources" />
        <LoadingState />
      </div>
    );
  }

  if (resourcesQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Resources could not be loaded." eyebrow="Module refresh" title="Resources unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="admin-resource-page">
      <section className="announcement-admin-heading">
        <div>
          <span>Module refresh</span>
          <div className="announcement-admin-title-row">
            <h1>Resources</h1>
            <span>Last Refresh: {lastRefresh}</span>
          </div>
          <p>Refresh only resources data from the database.</p>
        </div>
        <button className="announcement-refresh-button" onClick={() => resourcesQuery.refetch()} type="button">
          Refresh Resources
        </button>
      </section>

      <div className="admin-resource-grid">
        <section className="admin-project-section admin-resource-library">
          <header className="admin-project-section__header">
            <div>
              <span>Resources</span>
              <h2>Resource Library</h2>
            </div>
            <button className="segmented-button segmented-button--gold" onClick={handleNewResource} type="button">
              <Plus size={15} />
              New Resource
            </button>
          </header>

          <div className="admin-resource-library__body">
            <form className="admin-resource-filter-grid" onSubmit={handleSearch}>
              <div className="filter-search admin-resource-search">
                <Search size={16} />
                <label className="sr-only" htmlFor="admin-resource-search">
                  Search resources
                </label>
                <input id="admin-resource-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search resources..." type="search" />
              </div>
              <label className="sr-only" htmlFor="admin-resource-status-filter">
                Status
              </label>
              <select id="admin-resource-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ResourceStatusFilter)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="admin-resource-program-filter">
                Program
              </label>
              <select id="admin-resource-program-filter" value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}>
                <option value="">All Programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.programKey}>
                    {program.name}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="admin-resource-cohort-filter">
                Cohort
              </label>
              <select id="admin-resource-cohort-filter" value={cohortFilter} onChange={(event) => setCohortFilter(event.target.value)}>
                <option value="">All Cohorts</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.name}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </form>

            <div className="admin-resource-list">
              {filteredResources.length > 0 ? (
                filteredResources.map((resource) => (
                  <article className={selectedResourceId === resource.id ? 'admin-resource-card admin-resource-card--selected' : 'admin-resource-card'} key={resource.id}>
                    <div className="admin-resource-card__main">
                      <h3>{resource.title}</h3>
                      <p>{[resource.resourceId ?? resource.id, resource.resourceType, resource.resourceMode].filter(Boolean).join(' · ')}</p>
                      <div className="chip-row">
                        {resource.programKeys.length > 0 ? <span>{resource.programKeys.join(',')}</span> : null}
                        {resource.cohortNames.length > 0 ? <span>{resource.cohortNames.join(',')}</span> : null}
                        <StatusBadge tone={resource.status === 'active' ? 'safe' : 'warning'}>{resource.status}</StatusBadge>
                      </div>
                    </div>
                    <div className="admin-resource-card__actions">
                      <button className="segmented-button" onClick={() => handleEdit(resource)} type="button">
                        Edit
                      </button>
                      <button className="segmented-button segmented-button--danger" disabled type="button">
                        Remove
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          </div>
        </section>

        <section className="admin-project-section admin-resource-editor">
          <header className="admin-project-section__header">
            <div>
              <span>Editor</span>
              <h2>{selectedResourceId ? 'Edit Resource' : 'Add Resource'}</h2>
            </div>
          </header>

          <form className="admin-project-form admin-resource-form">
            <label>
              <span>Resource ID *</span>
              <input value={formState.resourceId} onChange={(event) => updateForm('resourceId', event.target.value)} />
            </label>
            <label>
              <span>Status</span>
              <select value={formState.status} onChange={(event) => updateForm('status', event.target.value as AdminResourceStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="admin-project-form__wide">
              <span>Title *</span>
              <input value={formState.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Resource title" />
            </label>
            <label>
              <span>Resource Type</span>
              <select value={formState.resourceType} onChange={(event) => updateForm('resourceType', event.target.value)}>
                <option value="General">General</option>
                <option value="Session">Session</option>
                <option value="Project">Project</option>
                <option value="Template">Template</option>
              </select>
            </label>
            <label>
              <span>Resource Mode</span>
              <select value={formState.resourceMode} onChange={(event) => updateForm('resourceMode', event.target.value)}>
                <option value="Link">Link</option>
                <option value="PDF">PDF</option>
                <option value="Video">Video</option>
                <option value="Drive">Drive</option>
              </select>
            </label>
            <label>
              <span>Program Key</span>
              <input readOnly value={derivedProgramKeys || formState.programKey} placeholder="Auto from selected cohorts" />
              <small>Auto-populated from selected active/upcoming cohorts.</small>
            </label>
            <label>
              <span>Domain_Key</span>
              <input readOnly value={derivedDomainKeys || formState.domainKey} placeholder="Auto from selected cohorts" />
            </label>

            <fieldset className="admin-project-program-picker admin-resource-cohort-picker">
              <legend>Share with (cohorts)</legend>
              <div className="admin-project-program-picker__actions">
                <button className="segmented-button" onClick={selectAllCohorts} type="button">
                  Select All Cohorts
                </button>
                <button className="segmented-button" onClick={clearCohorts} type="button">
                  Clear Cohorts
                </button>
              </div>
              <div className="admin-project-program-list admin-resource-cohort-list">
                {cohortsQuery.isLoading ? (
                  <p>Loading cohorts.</p>
                ) : selectableCohorts.length > 0 ? (
                  selectableCohorts.map((cohort) => (
                    <label key={cohort.id}>
                      <input checked={selectedCohortSet.has(cohort.name)} onChange={() => toggleCohort(cohort.name)} type="checkbox" />
                      <span>{cohort.name}</span>
                      <strong>
                        {[cohort.programKey, cohort.status].filter(Boolean).join(' · ')}
                      </strong>
                    </label>
                  ))
                ) : (
                  <p>No active/upcoming cohorts available.</p>
                )}
              </div>
              <p className="admin-resource-validation-note">Select at least one active/upcoming cohort. Empty selection does not mean all cohorts.</p>
            </fieldset>

            <label>
              <span>Access Type</span>
              <select value={formState.accessType} onChange={(event) => updateForm('accessType', event.target.value as 'free' | 'paid')}>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label>
              <span>Currency</span>
              <input value={formState.currency} onChange={(event) => updateForm('currency', event.target.value)} placeholder="INR" />
            </label>
            <label>
              <span>Price</span>
              <input value={formState.price} onChange={(event) => updateForm('price', event.target.value)} placeholder="Required for paid resources" />
            </label>
            <label>
              <span>Payment Link</span>
              <input value={formState.paymentLink} onChange={(event) => updateForm('paymentLink', event.target.value)} placeholder="Required for paid resources" />
            </label>
            <label className="admin-project-form__wide">
              <span>GoogleDriveLink *</span>
              <input value={formState.url} onChange={(event) => updateForm('url', event.target.value)} placeholder="https://drive.google.com/..." />
            </label>
            <label className="admin-project-form__wide">
              <span>Description</span>
              <textarea value={formState.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Short description" rows={4} />
            </label>
            <label>
              <span>Created At</span>
              <input readOnly value="Auto" />
            </label>
            <label>
              <span>Updated At</span>
              <input readOnly value="Auto" />
            </label>
            <div className="admin-project-form__actions">
              <button className="segmented-button" onClick={handleNewResource} type="button">
                Clear
              </button>
              <button className="segmented-button segmented-button--gold" disabled type="button">
                Save Resource -&gt;
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
