import { Archive, CheckCircle2, Clock3, Loader2, Plus, RotateCcw, Save, Search, X } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useAdminCohorts } from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';
import {
  AdminResource,
  AdminResourceStatus,
  AdminResourceWritePayload,
  useAdminResourceAuditLogs,
  useAdminResources,
  useArchiveAdminResource,
  useRestoreAdminResource,
  useSaveAdminResource,
  useUpdateAdminResource
} from '../features/admin/useAdminResources';

type ResourceFormState = {
  accessType: 'free' | 'paid';
  cohortNames: string[];
  currency: string;
  description: string;
  domainKey: string;
  paymentLink: string;
  price: string;
  programKeys: string[];
  resourceId: string;
  resourceMode: string;
  resourceType: string;
  status: AdminResourceStatus;
  title: string;
  url: string;
};

type ResourceStatusFilter = AdminResourceStatus | 'all';
type CohortTargetFilter = 'all' | 'active' | 'upcoming';

const resourcePageSize = 25;

const statusOptions: Array<{ label: string; value: ResourceStatusFilter }> = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
];

const resourceTypeOptions = [
  { label: 'General', value: 'general' },
  { label: 'Template', value: 'template' },
  { label: 'Case Material', value: 'case_material' },
  { label: 'Project Resource', value: 'project_resource' },
  { label: 'Live Session Material', value: 'live_session_material' },
  { label: 'Placement Resource', value: 'placement_resource' },
  { label: 'Assignment Reference', value: 'assignment_reference' }
];

const resourceModeOptions = [
  { label: 'Link', value: 'link' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Video', value: 'video' },
  { label: 'Drive', value: 'drive' },
  { label: 'PPTX', value: 'pptx' },
  { label: 'XLSX', value: 'xlsx' },
  { label: 'DOC', value: 'doc' }
];

const emptyResourceForm: ResourceFormState = {
  accessType: 'free',
  cohortNames: [],
  currency: 'INR',
  description: '',
  domainKey: '',
  paymentLink: '',
  price: '',
  programKeys: [],
  resourceId: `RES-${Date.now()}`,
  resourceMode: 'link',
  resourceType: 'general',
  status: 'active',
  title: '',
  url: ''
};

function formatDateTime(value: string | undefined) {
  if (!value) return 'Auto';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeOptionValue(value: string | undefined, fallback: string) {
  return (value ?? fallback).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function mapResourceToForm(resource: AdminResource): ResourceFormState {
  return {
    accessType: resource.accessType,
    cohortNames: resource.cohortNames,
    currency: resource.currency || 'INR',
    description: resource.description ?? '',
    domainKey: resource.domainKey ?? '',
    paymentLink: resource.paymentLink ?? '',
    price: resource.price === undefined ? '' : String(resource.price),
    programKeys: resource.programKeys,
    resourceId: resource.resourceId ?? resource.id,
    resourceMode: normalizeOptionValue(resource.resourceMode, 'link'),
    resourceType: normalizeOptionValue(resource.resourceType, 'general'),
    status: resource.status,
    title: resource.title,
    url: resource.url ?? ''
  };
}

function dedupeById<T extends { id: string }>(pages: Array<T[] | undefined>) {
  const rows = new Map<string, T>();
  pages.forEach((page) => {
    page?.forEach((item) => rows.set(item.id, item));
  });
  return Array.from(rows.values());
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AdminResourcesPage() {
  const editorFormRef = useRef<HTMLFormElement | null>(null);
  const [formState, setFormState] = useState<ResourceFormState>(emptyResourceForm);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [resourcePage, setResourcePage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ResourceStatusFilter>('all');
  const [programFilter, setProgramFilter] = useState('');
  const [cohortFilter, setCohortFilter] = useState('');
  const [programTargetSearch, setProgramTargetSearch] = useState('');
  const [cohortTargetSearch, setCohortTargetSearch] = useState('');
  const [cohortTargetFilter, setCohortTargetFilter] = useState<CohortTargetFilter>('all');
  const [cohortProgramTargetFilter, setCohortProgramTargetFilter] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelectingCohorts, setIsSelectingCohorts] = useState(false);
  const [isClearingCohorts, setIsClearingCohorts] = useState(false);
  const [isClearingPrograms, setIsClearingPrograms] = useState(false);
  const [isClearingForm, setIsClearingForm] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [pendingArchiveResource, setPendingArchiveResource] = useState<AdminResource | null>(null);
  const [archiveActionResourceId, setArchiveActionResourceId] = useState<string | null>(null);
  const [restoreActionResourceId, setRestoreActionResourceId] = useState<string | null>(null);
  const resourcesQuery = useAdminResources({ cohortName: cohortFilter, limit: resourcePageSize, page: resourcePage, programKey: programFilter, search, status: statusFilter });
  const programsQuery = useAdminPrograms({ limit: 100, page: 1, status: 'all' });
  const cohortsPageOneQuery = useAdminCohorts({ limit: 100, page: 1, sort: 'name', status: 'all' });
  const cohortsPageTwoQuery = useAdminCohorts({ enabled: (cohortsPageOneQuery.data?.totalPages ?? 1) >= 2, limit: 100, page: 2, sort: 'name', status: 'all' });
  const cohortsPageThreeQuery = useAdminCohorts({ enabled: (cohortsPageOneQuery.data?.totalPages ?? 1) >= 3, limit: 100, page: 3, sort: 'name', status: 'all' });
  const saveResourceMutation = useSaveAdminResource();
  const updateResourceMutation = useUpdateAdminResource();
  const archiveResourceMutation = useArchiveAdminResource();
  const restoreResourceMutation = useRestoreAdminResource();
  const auditLogsQuery = useAdminResourceAuditLogs(selectedResourceId);

  const resources = resourcesQuery.data?.items ?? [];
  const totalResources = resourcesQuery.data?.total ?? 0;
  const totalResourcePages = resourcesQuery.data?.totalPages ?? 1;
  const hasPreviousResourcePage = resourcePage > 1;
  const hasNextResourcePage = resourcePage < totalResourcePages;
  const programs = programsQuery.data?.items ?? [];
  const cohorts = useMemo(
    () => dedupeById([cohortsPageOneQuery.data?.items, cohortsPageTwoQuery.data?.items, cohortsPageThreeQuery.data?.items]).sort((a, b) => a.name.localeCompare(b.name)),
    [cohortsPageOneQuery.data?.items, cohortsPageTwoQuery.data?.items, cohortsPageThreeQuery.data?.items]
  );
  const selectableCohorts = useMemo(() => cohorts.filter((cohort) => cohort.status === 'active' || cohort.status === 'upcoming'), [cohorts]);
  const lastRefresh = formatDateTime(resources[0]?.updatedAt);
  const selectedResource = resources.find((resource) => resource.id === selectedResourceId);

  const filteredResources = resources;

  const selectedCohortSet = useMemo(() => new Set(formState.cohortNames), [formState.cohortNames]);
  const selectedProgramSet = useMemo(() => new Set(formState.programKeys), [formState.programKeys]);
  const derivedProgramKeys = useMemo(() => {
    const keys = selectableCohorts.filter((cohort) => selectedCohortSet.has(cohort.name)).map((cohort) => cohort.programKey).filter(Boolean);
    return uniqueStrings(keys);
  }, [selectableCohorts, selectedCohortSet]);
  const derivedDomainKeys = useMemo(() => {
    const keys = selectableCohorts.filter((cohort) => selectedCohortSet.has(cohort.name)).map((cohort) => cohort.domainKey).filter(Boolean);
    return uniqueStrings(keys);
  }, [selectableCohorts, selectedCohortSet]);
  const effectiveProgramKeys = useMemo(() => uniqueStrings([...formState.programKeys, ...derivedProgramKeys]), [derivedProgramKeys, formState.programKeys]);
  const effectiveDomainKey = derivedDomainKeys.join(',') || formState.domainKey;
  const isResourceSaving = saveResourceMutation.isPending || updateResourceMutation.isPending;
  const isResourceMutating = isResourceSaving || archiveResourceMutation.isPending || restoreResourceMutation.isPending;
  const filteredProgramsForTargeting = useMemo(() => {
    const query = programTargetSearch.trim().toLowerCase();
    if (!query) return programs;
    return programs.filter((program) => [program.name, program.programKey, program.shortName].some((value) => value?.toLowerCase().includes(query)));
  }, [programTargetSearch, programs]);
  const filteredCohortsForTargeting = useMemo(() => {
    const query = cohortTargetSearch.trim().toLowerCase();
    return selectableCohorts.filter((cohort) => {
      const matchesStatus = cohortTargetFilter === 'all' || cohort.status === cohortTargetFilter;
      const matchesProgram = !cohortProgramTargetFilter || cohort.programKey === cohortProgramTargetFilter;
      const matchesSearch = !query || [cohort.name, cohort.programKey, cohort.domainKey].some((value) => value?.toLowerCase().includes(query));
      return matchesStatus && matchesProgram && matchesSearch;
    });
  }, [cohortProgramTargetFilter, cohortTargetFilter, cohortTargetSearch, selectableCohorts]);
  const duplicateResource = useMemo(() => {
    const title = formState.title.trim().toLowerCase();
    const url = formState.url.trim().toLowerCase();
    if (!title || !url) return undefined;
    return resources.find((resource) => resource.id !== selectedResourceId && resource.title.trim().toLowerCase() === title && (resource.url ?? '').trim().toLowerCase() === url);
  }, [formState.title, formState.url, resources, selectedResourceId]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    setResourcePage(1);
    setSearch(searchInput.trim());
    window.setTimeout(() => setIsSearching(false), 450);
  }

  function updateStatusFilter(nextStatus: ResourceStatusFilter) {
    setResourcePage(1);
    setStatusFilter(nextStatus);
  }

  function updateProgramFilter(nextProgram: string) {
    setResourcePage(1);
    setProgramFilter(nextProgram);
  }

  function updateCohortFilter(nextCohort: string) {
    setResourcePage(1);
    setCohortFilter(nextCohort);
  }

  function handleNewResource() {
    setIsCreatingNew(true);
    setSelectedResourceId(null);
    setFormState({ ...emptyResourceForm, resourceId: `RES-${Date.now()}` });
    setFormError(null);
    setActionMessage(null);
    window.requestAnimationFrame(() => {
      editorFormRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      editorFormRef.current?.closest('.admin-resource-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.setTimeout(() => setIsCreatingNew(false), 650);
  }

  function handleEdit(resource: AdminResource) {
    setEditingResourceId(resource.id);
    setSelectedResourceId(resource.id);
    setFormState(mapResourceToForm(resource));
    setFormError(null);
    setActionMessage(null);
    window.requestAnimationFrame(() => {
      editorFormRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      editorFormRef.current?.closest('.admin-resource-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    window.setTimeout(() => setEditingResourceId((current) => (current === resource.id ? null : current)), 650);
  }

  function updateForm<K extends keyof ResourceFormState>(key: K, value: ResourceFormState[K]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function updateAccessType(accessType: ResourceFormState['accessType']) {
    setFormState((current) => ({
      ...current,
      accessType,
      paymentLink: accessType === 'free' ? '' : current.paymentLink,
      price: accessType === 'free' ? '' : current.price
    }));
  }

  function toggleCohort(name: string) {
    setFormState((current) => {
      const next = new Set(current.cohortNames);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...current, cohortNames: Array.from(next) };
    });
  }

  function toggleProgram(programKey: string) {
    setFormState((current) => {
      const next = new Set(current.programKeys);
      if (next.has(programKey)) next.delete(programKey);
      else next.add(programKey);
      return { ...current, programKeys: Array.from(next) };
    });
  }

  function selectAllCohorts() {
    setIsSelectingCohorts(true);
    setFormState((current) => ({ ...current, cohortNames: uniqueStrings([...current.cohortNames, ...filteredCohortsForTargeting.map((cohort) => cohort.name)]) }));
    window.setTimeout(() => setIsSelectingCohorts(false), 650);
  }

  function clearCohorts() {
    setIsClearingCohorts(true);
    setFormState((current) => ({ ...current, cohortNames: [] }));
    window.setTimeout(() => setIsClearingCohorts(false), 650);
  }

  function clearPrograms() {
    setIsClearingPrograms(true);
    setFormState((current) => ({ ...current, programKeys: [] }));
    window.setTimeout(() => setIsClearingPrograms(false), 650);
  }

  async function refreshResources() {
    setIsRefreshing(true);
    try {
      await resourcesQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  }

  function clearForm() {
    setIsClearingForm(true);
    handleNewResource();
    window.setTimeout(() => setIsClearingForm(false), 650);
  }

  function buildResourcePayload(): AdminResourceWritePayload | null {
    const title = formState.title.trim();
    const resourceId = formState.resourceId.trim();
    const url = formState.url.trim();
    const paymentLink = formState.paymentLink.trim();
    const price = formState.price.trim();

    if (!resourceId) {
      setFormError('Resource ID is required.');
      return null;
    }
    if (!title) {
      setFormError('Title is required.');
      return null;
    }
    if (!url) {
      setFormError('Resource URL is required.');
      return null;
    }
    if (!isHttpUrl(url)) {
      setFormError('Resource URL must start with http:// or https://.');
      return null;
    }
    if (effectiveProgramKeys.length === 0 && formState.cohortNames.length === 0) {
      setFormError('Select at least one cohort or one program.');
      return null;
    }
    if (formState.accessType === 'paid') {
      if (!price || Number(price) <= 0) {
        setFormError('Paid resources require a positive price.');
        return null;
      }
      if (!paymentLink) {
        setFormError('Paid resources require a payment link.');
        return null;
      }
      if (!isHttpUrl(paymentLink)) {
        setFormError('Payment link must start with http:// or https://.');
        return null;
      }
    }

    return {
      accessType: formState.accessType,
      cohortNames: formState.cohortNames,
      currency: formState.currency.trim() || 'INR',
      description: formState.description.trim() || null,
      domainKey: effectiveDomainKey || null,
      paymentLink: formState.accessType === 'paid' ? paymentLink : null,
      price: formState.accessType === 'paid' ? Number(price) : null,
      programKeys: effectiveProgramKeys,
      resourceId,
      resourceMode: formState.resourceMode,
      resourceType: formState.resourceType,
      status: formState.status,
      title,
      url
    };
  }

  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setActionMessage(null);

    const payload = buildResourcePayload();
    if (!payload) return;

    try {
      const savedResource = selectedResourceId
        ? await updateResourceMutation.mutateAsync({ body: payload, resourceId: selectedResourceId })
        : await saveResourceMutation.mutateAsync(payload);
      setSelectedResourceId(savedResource.id);
      setFormState(mapResourceToForm(savedResource));
      setActionMessage(selectedResourceId ? 'Resource updated.' : 'Resource created.');
      await auditLogsQuery.refetch();
    } catch (error) {
      setFormError(readableError(error, 'Resource could not be saved.'));
    }
  }

  async function archiveResource(resource: AdminResource) {
    setArchiveActionResourceId(resource.id);
    setActionMessage(null);
    setFormError(null);
    try {
      const archived = await archiveResourceMutation.mutateAsync(resource.id);
      if (selectedResourceId === resource.id) setFormState(mapResourceToForm(archived));
      setActionMessage('Resource archived and hidden from students.');
      setPendingArchiveResource(null);
      await auditLogsQuery.refetch();
    } catch (error) {
      setFormError(readableError(error, 'Resource could not be archived.'));
    } finally {
      setArchiveActionResourceId(null);
    }
  }

  async function restoreResource(resource: AdminResource) {
    setRestoreActionResourceId(resource.id);
    setActionMessage(null);
    setFormError(null);
    try {
      const restored = await restoreResourceMutation.mutateAsync(resource.id);
      if (selectedResourceId === resource.id) setFormState(mapResourceToForm(restored));
      setActionMessage('Resource restored.');
      await auditLogsQuery.refetch();
    } catch (error) {
      setFormError(readableError(error, 'Resource could not be restored.'));
    } finally {
      setRestoreActionResourceId(null);
    }
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
        <button className="announcement-refresh-button admin-resource-action" disabled={isRefreshing || resourcesQuery.isFetching} onClick={() => void refreshResources()} type="button">
          {isRefreshing || resourcesQuery.isFetching ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
          {isRefreshing || resourcesQuery.isFetching ? 'Refreshing...' : 'Refresh Resources'}
        </button>
      </section>

      <div className="admin-resource-grid">
        <section className="admin-project-section admin-resource-library">
          <header className="admin-project-section__header">
            <div>
              <span>Resources</span>
              <h2>Resource Library</h2>
            </div>
            <button className="segmented-button segmented-button--gold admin-resource-action" disabled={isCreatingNew || isResourceSaving} onClick={handleNewResource} type="button">
              {isCreatingNew ? <Loader2 className="workshop-action-spinner" size={14} /> : <Plus size={15} />}
              {isCreatingNew ? 'Opening...' : 'New Resource'}
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
              <button className="segmented-button admin-resource-action admin-resource-search-button" disabled={isSearching || resourcesQuery.isFetching} type="submit">
                {isSearching || resourcesQuery.isFetching ? <Loader2 className="workshop-action-spinner" size={14} /> : <Search size={14} />}
                {isSearching || resourcesQuery.isFetching ? 'Searching...' : 'Search'}
              </button>
              <label className="sr-only" htmlFor="admin-resource-status-filter">
                Status
              </label>
              <select id="admin-resource-status-filter" value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value as ResourceStatusFilter)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="admin-resource-program-filter">
                Program
              </label>
              <select id="admin-resource-program-filter" value={programFilter} onChange={(event) => updateProgramFilter(event.target.value)}>
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
              <select id="admin-resource-cohort-filter" value={cohortFilter} onChange={(event) => updateCohortFilter(event.target.value)}>
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
                      <button className="segmented-button admin-resource-action" disabled={editingResourceId === resource.id} onClick={() => handleEdit(resource)} type="button">
                        {editingResourceId === resource.id ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                        {editingResourceId === resource.id ? 'Editing...' : 'Edit'}
                      </button>
                      {resource.status === 'inactive' ? (
                        <button className="segmented-button admin-resource-action" disabled={isResourceMutating} onClick={() => void restoreResource(resource)} type="button">
                          {restoreActionResourceId === resource.id ? <Loader2 className="workshop-action-spinner" size={14} /> : <RotateCcw size={14} />}
                          {restoreActionResourceId === resource.id ? 'Restoring...' : 'Restore'}
                        </button>
                      ) : (
                        <button className="segmented-button segmented-button--danger admin-resource-action" disabled={isResourceMutating} onClick={() => setPendingArchiveResource(resource)} type="button">
                          {archiveActionResourceId === resource.id ? <Loader2 className="workshop-action-spinner" size={14} /> : <Archive size={14} />}
                          {archiveActionResourceId === resource.id ? 'Archiving...' : 'Archive'}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState />
              )}
            </div>
            <nav className="pagination-bar admin-resource-pagination" aria-label="Resource pagination">
              <button className="pagination-link" disabled={!hasPreviousResourcePage || resourcesQuery.isFetching} onClick={() => setResourcePage((current) => Math.max(1, current - 1))} type="button">
                Previous page
              </button>
              <span>
                Page {resourcePage} of {totalResourcePages} · {totalResources} matching
              </span>
              <button className="pagination-link" disabled={!hasNextResourcePage || resourcesQuery.isFetching} onClick={() => setResourcePage((current) => Math.min(totalResourcePages, current + 1))} type="button">
                Next page
              </button>
            </nav>
          </div>
        </section>

        <section className="admin-project-section admin-resource-editor">
          <header className="admin-project-section__header">
            <div>
              <span>Editor</span>
              <h2>{selectedResourceId ? 'Edit Resource' : 'Add Resource'}</h2>
            </div>
          </header>

          <form className={isResourceSaving ? 'admin-project-form admin-resource-form admin-resource-form--saving' : 'admin-project-form admin-resource-form'} onSubmit={saveResource} ref={editorFormRef} aria-busy={isResourceSaving}>
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
                {resourceTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Resource Mode</span>
              <select value={formState.resourceMode} onChange={(event) => updateForm('resourceMode', event.target.value)}>
                {resourceModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="admin-project-program-picker admin-resource-program-picker">
              <legend>Share with (programs)</legend>
              <div className="admin-resource-target-toolbar">
                <div className="filter-search admin-resource-target-search">
                  <Search size={14} />
                  <input value={programTargetSearch} onChange={(event) => setProgramTargetSearch(event.target.value)} placeholder="Search programs..." type="search" />
                </div>
                <span>{formState.programKeys.length} selected</span>
                <button className="segmented-button admin-resource-action" disabled={isClearingPrograms || isResourceSaving} onClick={clearPrograms} type="button">
                  {isClearingPrograms ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                  {isClearingPrograms ? 'Clearing...' : 'Clear Programs'}
                </button>
              </div>
              <div className="admin-project-program-list admin-resource-program-list">
                {programsQuery.isLoading ? (
                  <p>Loading programs.</p>
                ) : filteredProgramsForTargeting.length > 0 ? (
                  filteredProgramsForTargeting.map((program) => (
                    <label key={program.id}>
                      <input checked={selectedProgramSet.has(program.programKey)} onChange={() => toggleProgram(program.programKey)} type="checkbox" />
                      <span>{program.name}</span>
                      <strong>{program.programKey}</strong>
                    </label>
                  ))
                ) : (
                  <p>No programs available.</p>
                )}
              </div>
              <p className="admin-resource-validation-note">
                Effective programs: {effectiveProgramKeys.length > 0 ? effectiveProgramKeys.join(', ') : 'Select programs or cohorts.'}
              </p>
            </fieldset>
            <label>
              <span>Domain Key</span>
              <input readOnly value={effectiveDomainKey} placeholder="Auto from selected cohorts" />
            </label>

            <fieldset className="admin-project-program-picker admin-resource-cohort-picker">
              <legend>Share with (cohorts)</legend>
              <div className="admin-resource-target-toolbar">
                <div className="filter-search admin-resource-target-search">
                  <Search size={14} />
                  <input value={cohortTargetSearch} onChange={(event) => setCohortTargetSearch(event.target.value)} placeholder="Search cohorts..." type="search" />
                </div>
                <select value={cohortTargetFilter} onChange={(event) => setCohortTargetFilter(event.target.value as CohortTargetFilter)}>
                  <option value="all">Active + Upcoming</option>
                  <option value="active">Active only</option>
                  <option value="upcoming">Upcoming only</option>
                </select>
                <select value={cohortProgramTargetFilter} onChange={(event) => setCohortProgramTargetFilter(event.target.value)}>
                  <option value="">All programs</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.programKey}>
                      {program.name}
                    </option>
                  ))}
                </select>
                <span>{formState.cohortNames.length} selected</span>
              </div>
              <div className="admin-project-program-picker__actions">
                <button className="segmented-button admin-resource-action" disabled={isSelectingCohorts} onClick={selectAllCohorts} type="button">
                  {isSelectingCohorts ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                  {isSelectingCohorts ? 'Selecting...' : 'Select Visible Cohorts'}
                </button>
                <button className="segmented-button admin-resource-action" disabled={isClearingCohorts} onClick={clearCohorts} type="button">
                  {isClearingCohorts ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                  {isClearingCohorts ? 'Clearing...' : 'Clear Cohorts'}
                </button>
              </div>
              <div className="admin-project-program-list admin-resource-cohort-list">
                {cohortsPageOneQuery.isLoading || cohortsPageTwoQuery.isLoading || cohortsPageThreeQuery.isLoading ? (
                  <p>Loading cohorts.</p>
                ) : filteredCohortsForTargeting.length > 0 ? (
                  filteredCohortsForTargeting.map((cohort) => (
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
              <p className="admin-resource-validation-note">Select active/upcoming cohorts, programs, or both. Empty selection does not mean all cohorts.</p>
            </fieldset>

            <label>
              <span>Access Type</span>
              <select value={formState.accessType} onChange={(event) => updateAccessType(event.target.value as 'free' | 'paid')}>
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
              <input
                disabled={formState.accessType === 'free'}
                value={formState.price}
                onChange={(event) => updateForm('price', event.target.value)}
                placeholder={formState.accessType === 'free' ? 'Only for paid resources' : 'Required for paid resources'}
              />
            </label>
            <label>
              <span>Payment Link</span>
              <input
                disabled={formState.accessType === 'free'}
                value={formState.paymentLink}
                onChange={(event) => updateForm('paymentLink', event.target.value)}
                placeholder={formState.accessType === 'free' ? 'Only for paid resources' : 'Required for paid resources'}
              />
            </label>
            <label className="admin-project-form__wide">
              <span>Resource URL *</span>
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
              <button className="segmented-button admin-resource-action" disabled={isClearingForm || isResourceSaving} onClick={clearForm} type="button">
                {isClearingForm ? <Loader2 className="workshop-action-spinner" size={14} /> : null}
                {isClearingForm ? 'Clearing...' : 'Clear'}
              </button>
              <button className="segmented-button segmented-button--gold admin-resource-action" disabled={isResourceSaving} type="submit">
                {isResourceSaving ? <Loader2 className="workshop-action-spinner" size={14} /> : <Save size={14} />}
                {updateResourceMutation.isPending ? 'Updating...' : saveResourceMutation.isPending ? 'Saving...' : selectedResourceId ? 'Update Resource' : 'Save Resource'}
              </button>
            </div>
            {formError ? <p className="admin-resource-error-note admin-project-form__wide">{formError}</p> : null}
            {duplicateResource ? (
              <p className="admin-resource-warning-note admin-project-form__wide">
                Possible duplicate: `{duplicateResource.title}` already uses this URL.
              </p>
            ) : null}
            {actionMessage ? (
              <p className="admin-resource-success-note admin-project-form__wide">
                <CheckCircle2 size={15} />
                {actionMessage}
              </p>
            ) : null}
            {selectedResource ? (
              <section className="admin-resource-history admin-project-form__wide" aria-label="Resource history">
                <header>
                  <span>History</span>
                  <strong>{selectedResource.updatedAt ? `Updated ${formatDateTime(selectedResource.updatedAt)}` : 'Recent actions'}</strong>
                </header>
                {auditLogsQuery.isLoading ? (
                  <p>Loading history.</p>
                ) : auditLogsQuery.data?.items.length ? (
                  auditLogsQuery.data.items.map((entry) => (
                    <article key={entry.id}>
                      <Clock3 size={14} />
                      <div>
                        <strong>{entry.action.replace(/^admin_resource_/, '').replace(/_/g, ' ')}</strong>
                        <span>
                          {[entry.actorEmail, formatDateTime(entry.createdAt)].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p>No audit history yet.</p>
                )}
              </section>
            ) : null}
          </form>
        </section>
      </div>
      {pendingArchiveResource ? (
        <div className="student-modal-backdrop" role="presentation">
          <section className="student-modal workshop-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="archive-resource-title">
            <header className="student-modal__header">
              <div>
                <span>Archive resource</span>
                <h2 id="archive-resource-title">Hide this resource?</h2>
              </div>
              <button aria-label="Close archive confirmation" className="student-modal__icon-button" disabled={archiveResourceMutation.isPending} onClick={() => setPendingArchiveResource(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="student-modal__body workshop-confirm-modal__body">
              <strong>{pendingArchiveResource.title}</strong>
              <p>This sets the resource to inactive and hides it from students. You can restore it later from the inactive list.</p>
            </div>
            <footer className="student-modal__footer">
              <button className="segmented-button" disabled={archiveResourceMutation.isPending} onClick={() => setPendingArchiveResource(null)} type="button">
                Keep active
              </button>
              <button className="segmented-button segmented-button--danger admin-resource-action" disabled={archiveResourceMutation.isPending} onClick={() => void archiveResource(pendingArchiveResource)} type="button">
                {archiveResourceMutation.isPending ? <Loader2 className="workshop-action-spinner" size={14} /> : <Archive size={14} />}
                {archiveResourceMutation.isPending ? 'Archiving...' : 'Archive Resource'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
