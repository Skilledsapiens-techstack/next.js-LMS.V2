import { CheckCircle2, Edit3, Eye, Plus, RefreshCw, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminProject,
  AdminProjectDocument,
  AdminProjectRole,
  AdminProjectRoleStatus,
  AdminProjectRoleWritePayload,
  AdminProjectStatus,
  AdminProjectWritePayload,
  useAdminProjectRoles,
  useAdminProjects,
  useCreateAdminProject,
  useCreateAdminProjectRole,
  useUpdateAdminProject,
  useUpdateAdminProjectRole,
  useUpdateAdminProjectRoleStatus,
  useUpdateAdminProjectStatus
} from '../features/admin/useAdminProjects';
import { AdminProgram, useAdminPrograms } from '../features/admin/useAdminPrograms';

type RoleFormState = {
  category: string;
  name: string;
  programKey: string;
  roleId: string;
  status: AdminProjectRoleStatus;
};

type ProjectFormState = {
  actionItems: string;
  brief: string;
  companyName: string;
  deadline: string;
  deliverables: string;
  objectives: string;
  programKeys: string[];
  projectId: string;
  resources: string;
  roleId: string;
  status: AdminProjectStatus;
  submissionLink: string;
  title: string;
};

type ProjectFilters = {
  programKey: string;
  roleId: string;
  search: string;
  status: AdminProjectStatus | 'all';
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function asTextareaRows(items: Array<{ description?: string; format?: string; link?: string; note?: string; title: string; type?: string }>) {
  return items
    .map((item) => [item.title, item.link ?? item.format ?? item.description ?? item.note ?? item.type].filter(Boolean).join('|'))
    .join('\n');
}

function asDocumentRows(items: AdminProjectDocument[]) {
  return items
    .map((item) => [item.title, item.type, item.link ?? item.description].filter(Boolean).join('|'))
    .join('\n');
}

function roleKey(role: AdminProjectRole) {
  return role.roleId ?? role.id;
}

function roleFromProject(project: AdminProject, roles: AdminProjectRole[]) {
  return roles.find((role) => roleKey(role) === project.roleId);
}

function formFromRole(role?: AdminProjectRole): RoleFormState {
  return {
    category: role?.category ?? '',
    name: role?.name ?? '',
    programKey: role?.programKey ?? '',
    roleId: normalizeKey(role?.roleId ?? ''),
    status: role?.status ?? 'active'
  };
}

function newProjectId() {
  return `PRJ-${Date.now()}`;
}

function formFromProject(project?: AdminProject | null): ProjectFormState {
  const programKeys = project ? (project.programKeys.length > 0 ? project.programKeys : [project.programKey].filter((value): value is string => Boolean(value))) : [];

  return {
    actionItems: project ? asTextareaRows(project.tasks) : '',
    brief: project?.brief ?? '',
    companyName: project?.companyName ?? '',
    deadline: project?.deadline?.slice(0, 10) ?? '',
    deliverables: project ? asTextareaRows(project.deliverables) : '',
    objectives: project?.objectives ?? '',
    programKeys,
    projectId: project?.projectId ?? newProjectId(),
    resources: project ? asDocumentRows(project.documents) : '',
    roleId: project?.roleId ?? '',
    status: project?.status ?? 'active',
    submissionLink: project?.submissionLink ?? '',
    title: project?.title ?? ''
  };
}

function selectedPrograms(programs: AdminProgram[], keys: string[]) {
  const keySet = new Set(keys);
  return programs.filter((program) => keySet.has(program.programKey));
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function RoleEditor({
  activePrograms,
  onSaved,
  role
}: {
  activePrograms: AdminProgram[];
  onSaved: (message: string) => void;
  role?: AdminProjectRole;
}) {
  const [form, setForm] = useState<RoleFormState>(() => formFromRole(role));
  const [error, setError] = useState('');
  const createRole = useCreateAdminProjectRole();
  const updateRole = useUpdateAdminProjectRole();
  const isSaving = createRole.isPending || updateRole.isPending;
  const isEditing = Boolean(role?.id);

  useEffect(() => {
    setForm(formFromRole(role));
    setError('');
  }, [role]);

  function updateField<KField extends keyof RoleFormState>(field: KField, value: RoleFormState[KField]) {
    setForm((current) => ({
      ...current,
      [field]: field === 'roleId' ? normalizeKey(String(value)) : value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const payload: AdminProjectRoleWritePayload = {
      category: form.category.trim(),
      name: form.name.trim(),
      programKey: form.programKey || undefined,
      roleId: form.roleId,
      status: form.status
    };

    if (!payload.name) {
      setError('Role name is required.');
      return;
    }
    if (!isEditing && !payload.roleId) {
      setError('Role ID is required.');
      return;
    }

    try {
      if (isEditing && role?.id) {
        const updatePayload: Partial<AdminProjectRoleWritePayload> = {
          category: payload.category,
          name: payload.name,
          programKey: payload.programKey,
          status: payload.status
        };
        await updateRole.mutateAsync({ body: updatePayload, roleUuid: role.id });
        onSaved('Project role updated successfully.');
      } else {
        await createRole.mutateAsync(payload);
        onSaved('Project role created successfully.');
        setForm(formFromRole());
      }
    } catch (submitError) {
      setError(readableError(submitError, 'Project role could not be saved.'));
    }
  }

  return (
    <form className="admin-project-form" onSubmit={handleSubmit}>
      <label>
        <span>Role ID *</span>
        <input readOnly={isEditing} value={form.roleId} onChange={(event) => updateField('roleId', event.target.value)} placeholder="growth_strategy_consultant" />
      </label>
      <label>
        <span>Status</span>
        <select value={form.status} onChange={(event) => updateField('status', event.target.value as AdminProjectRoleStatus)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>
        <span>Role name *</span>
        <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Growth & Strategy Consultant" />
      </label>
      <label>
        <span>Role category</span>
        <input value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="Management" />
      </label>
      <label className="admin-project-form__wide">
        <span>Program entitlement</span>
        <select value={form.programKey} onChange={(event) => updateField('programKey', event.target.value)}>
          <option value="">No fixed program mapping</option>
          {activePrograms.map((program) => (
            <option key={program.id} value={program.programKey}>
              {program.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="admin-project-form-note admin-project-form-note--error">{error}</p> : null}
      <div className="admin-project-form__actions">
        <button className="segmented-button" disabled={isSaving} onClick={() => setForm(formFromRole(role))} type="button">
          Reset
        </button>
        <button className="segmented-button segmented-button--gold" disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : isEditing ? 'Update Role' : 'Save Role'}
        </button>
      </div>
    </form>
  );
}

function ProjectEditor({
  activePrograms,
  onSaved,
  project,
  roles
}: {
  activePrograms: AdminProgram[];
  onSaved: (message: string) => void;
  project?: AdminProject | null;
  roles: AdminProjectRole[];
}) {
  const [form, setForm] = useState<ProjectFormState>(() => formFromProject(project));
  const [error, setError] = useState('');
  const createProject = useCreateAdminProject();
  const updateProject = useUpdateAdminProject();
  const isSaving = createProject.isPending || updateProject.isPending;
  const isEditing = Boolean(project?.id);
  const activeRoles = roles.filter((role) => role.status === 'active' || roleKey(role) === form.roleId);
  const mappedPrograms = selectedPrograms(activePrograms, form.programKeys);
  const selectedRole = roles.find((role) => roleKey(role) === form.roleId);

  useEffect(() => {
    setForm(formFromProject(project));
    setError('');
  }, [project]);

  function updateField<KField extends keyof ProjectFormState>(field: KField, value: ProjectFormState[KField]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleProgram(programKey: string) {
    setForm((current) => {
      const currentSet = new Set(current.programKeys);
      currentSet.has(programKey) ? currentSet.delete(programKey) : currentSet.add(programKey);
      return { ...current, programKeys: Array.from(currentSet) };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const payload: AdminProjectWritePayload = {
      actionItems: form.actionItems,
      brief: form.brief,
      companyName: form.companyName,
      deadline: form.deadline || null,
      deliverables: form.deliverables,
      objectives: form.objectives,
      programKey: form.programKeys[0],
      programKeys: form.programKeys,
      programName: mappedPrograms.map((program) => program.name).join(', '),
      projectId: form.projectId.trim(),
      projectRole: selectedRole?.name ?? '',
      resources: form.resources,
      roleId: form.roleId || undefined,
      status: form.status,
      submissionLink: form.submissionLink.trim() || null,
      title: form.title.trim()
    };

    if (!payload.title) {
      setError('Project title is required.');
      return;
    }
    if (!isEditing && !payload.projectId) {
      setError('Project ID is required.');
      return;
    }
    if (payload.programKeys.length === 0) {
      setError('Select at least one active program.');
      return;
    }

    try {
      if (isEditing && project?.id) {
        const updatePayload: Partial<AdminProjectWritePayload> = {
          actionItems: payload.actionItems,
          brief: payload.brief,
          companyName: payload.companyName,
          deadline: payload.deadline,
          deliverables: payload.deliverables,
          objectives: payload.objectives,
          programKey: payload.programKey,
          programKeys: payload.programKeys,
          programName: payload.programName,
          projectRole: payload.projectRole,
          resources: payload.resources,
          roleId: payload.roleId,
          status: payload.status,
          submissionLink: payload.submissionLink,
          title: payload.title
        };
        await updateProject.mutateAsync({ body: updatePayload, projectId: project.id });
        onSaved('Project updated successfully.');
      } else {
        await createProject.mutateAsync(payload);
        onSaved('Project created successfully.');
        setForm(formFromProject(null));
      }
    } catch (submitError) {
      setError(readableError(submitError, 'Project could not be saved.'));
    }
  }

  return (
    <form className={isSaving ? 'admin-project-form admin-project-form--editor admin-project-form--saving' : 'admin-project-form admin-project-form--editor'} onSubmit={handleSubmit} aria-busy={isSaving}>
      <label>
        <span>Project ID *</span>
        <input readOnly={isEditing} value={form.projectId} onChange={(event) => updateField('projectId', event.target.value)} placeholder="PRJ-178..." />
      </label>
      <label>
        <span>Status</span>
        <select value={form.status} onChange={(event) => updateField('status', event.target.value as AdminProjectStatus)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="admin-project-form__wide">
        <span>Project title *</span>
        <input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Project title" />
      </label>
      <label>
        <span>Live company name</span>
        <input value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} placeholder="e.g. Samann.com" />
      </label>
      <label>
        <span>Project role</span>
        <select value={form.roleId} onChange={(event) => updateField('roleId', event.target.value)}>
          <option value="">Select project role</option>
          {activeRoles.map((role) => (
            <option key={role.id} value={roleKey(role)}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="admin-project-program-picker">
        <legend>Programs *</legend>
        <div className="admin-project-program-picker__actions">
          <button className="segmented-button" onClick={() => updateField('programKeys', activePrograms.map((program) => program.programKey))} type="button">
            Select All Programs
          </button>
          <button className="segmented-button" onClick={() => updateField('programKeys', [])} type="button">
            Clear Programs
          </button>
        </div>
        <div className="admin-project-program-list">
          {activePrograms.map((program) => (
            <label key={program.id}>
              <input checked={form.programKeys.includes(program.programKey)} onChange={() => toggleProgram(program.programKey)} type="checkbox" />
              <span>{program.name}</span>
              <strong>{program.shortName ?? program.programKey}</strong>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="admin-project-form__wide">
        <span>Brief</span>
        <textarea value={form.brief} onChange={(event) => updateField('brief', event.target.value)} placeholder="Project brief or problem statement" rows={4} />
      </label>
      <label className="admin-project-form__wide">
        <span>Objectives</span>
        <textarea value={form.objectives} onChange={(event) => updateField('objectives', event.target.value)} placeholder="Project objectives and expected learning outcomes" rows={4} />
      </label>
      <label className="admin-project-form__wide">
        <span>Action items</span>
        <textarea value={form.actionItems} onChange={(event) => updateField('actionItems', event.target.value)} placeholder="One task per line, or Title|Description" rows={4} />
      </label>
      <label className="admin-project-form__wide">
        <span>Deliverables</span>
        <textarea value={form.deliverables} onChange={(event) => updateField('deliverables', event.target.value)} placeholder="Example: Slide deck|PPTX|Final presentation" rows={4} />
      </label>
      <label className="admin-project-form__wide">
        <span>Resources</span>
        <textarea value={form.resources} onChange={(event) => updateField('resources', event.target.value)} placeholder="Example: Brief|DOC|https://..." rows={4} />
      </label>
      <label>
        <span>Submission link</span>
        <input value={form.submissionLink} onChange={(event) => updateField('submissionLink', event.target.value)} placeholder="https://..." />
      </label>
      <label>
        <span>Deadline</span>
        <input value={form.deadline} onChange={(event) => updateField('deadline', event.target.value)} type="date" />
      </label>
      <div className={form.status === 'active' && form.programKeys.length > 0 ? 'admin-project-visibility admin-project-visibility--visible' : 'admin-project-visibility'}>
        <Eye size={16} />
        <span>{form.status === 'active' && form.programKeys.length > 0 ? 'Visible to eligible students' : 'Hidden until active and mapped to a program'}</span>
      </div>
      {error ? <p className="admin-project-form-note admin-project-form-note--error">{error}</p> : null}
      <div className="admin-project-form__actions">
        <button className="segmented-button" disabled={isSaving} onClick={() => setForm(formFromProject(project))} type="button">
          Reset
        </button>
        <button className="segmented-button segmented-button--gold" disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : isEditing ? 'Update Project' : 'Save Project'}
        </button>
      </div>
    </form>
  );
}

function RoleCard({
  disabled,
  onEdit,
  onStatusChange,
  role
}: {
  disabled: boolean;
  onEdit: (role: AdminProjectRole) => void;
  onStatusChange: (role: AdminProjectRole) => void;
  role: AdminProjectRole;
}) {
  return (
    <article className="admin-project-list-card">
      <div>
        <h3>{role.name}</h3>
        <p>
          {[role.category, roleKey(role), role.programKey ?? 'No program mapping'].filter(Boolean).join(' · ')}
        </p>
        <div className="chip-row">
          <StatusBadge tone={role.status === 'active' ? 'safe' : 'warning'}>{role.status}</StatusBadge>
        </div>
      </div>
      <div className="admin-project-list-card__actions">
        <button className="segmented-button" onClick={() => onEdit(role)} type="button">
          Edit
        </button>
        <button className={role.status === 'active' ? 'segmented-button segmented-button--danger' : 'segmented-button'} disabled={disabled} onClick={() => onStatusChange(role)} type="button">
          {role.status === 'active' ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </article>
  );
}

function ProjectCard({
  isSelected,
  onEdit,
  onStatusChange,
  project,
  programs,
  role,
  statusDisabled
}: {
  isSelected: boolean;
  onEdit: (project: AdminProject) => void;
  onStatusChange: (project: AdminProject) => void;
  project: AdminProject;
  programs: AdminProgram[];
  role?: AdminProjectRole;
  statusDisabled: boolean;
}) {
  const projectProgramKeys = project.programKeys.length > 0 ? project.programKeys : [project.programKey].filter((value): value is string => Boolean(value));
  const programNames = selectedPrograms(programs, projectProgramKeys).map((program) => program.shortName ?? program.name);
  const statusAction = project.status === 'active' ? 'Deactivate' : 'Reactivate';
  const cardClassName = [
    'admin-project-list-card',
    'admin-project-list-card--project',
    isSelected ? 'admin-project-list-card--selected' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClassName}>
      <div className="admin-project-list-card__content">
        <h3>{project.title || project.projectId || project.id}</h3>
        <p>
          {[project.projectId ?? project.id, role?.name ?? project.projectRole, project.companyName ?? 'Company not set'].filter(Boolean).join(' · ')}
        </p>
        <div className="chip-row">
          {programNames.slice(0, 6).map((program) => (
            <StatusBadge key={program}>{program}</StatusBadge>
          ))}
          {programNames.length > 6 ? <StatusBadge>{`+${programNames.length - 6} more`}</StatusBadge> : null}
          <StatusBadge tone={project.status === 'active' ? 'safe' : 'warning'}>{project.status}</StatusBadge>
        </div>
      </div>
      <div className="admin-project-list-card__actions">
        <button className="segmented-button" aria-label={`Edit project ${project.title || project.projectId || project.id}`} onClick={() => onEdit(project)} type="button">
          Edit
        </button>
        <button
          aria-label={`${statusAction} project ${project.title || project.projectId || project.id}`}
          className={project.status === 'active' ? 'segmented-button segmented-button--danger' : 'segmented-button'}
          disabled={statusDisabled}
          onClick={() => onStatusChange(project)}
          type="button"
        >
          {statusDisabled ? 'Updating...' : statusAction}
        </button>
      </div>
    </article>
  );
}

export function AdminProjectsPage() {
  const [filters, setFilters] = useState<ProjectFilters>({ programKey: '', roleId: '', search: '', status: 'all' });
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null);
  const [selectedRole, setSelectedRole] = useState<AdminProjectRole | undefined>();
  const [notice, setNotice] = useState('');
  const projectsQuery = useAdminProjects({ limit: 100, programKey: filters.programKey, roleId: filters.roleId, search: filters.search, status: filters.status });
  const rolesQuery = useAdminProjectRoles({ limit: 200, status: 'all' });
  const programsQuery = useAdminPrograms({ limit: 500, status: 'all' });
  const updateProjectStatus = useUpdateAdminProjectStatus();
  const updateRoleStatus = useUpdateAdminProjectRoleStatus();
  const projects = projectsQuery.data?.items ?? [];
  const roles = rolesQuery.data?.items ?? [];
  const programs = programsQuery.data?.items ?? [];
  const activePrograms = programs.filter((program) => program.status === 'active');
  const hasError = projectsQuery.isError || rolesQuery.isError || programsQuery.isError;
  const isLoading = projectsQuery.isLoading || rolesQuery.isLoading || programsQuery.isLoading;
  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'active').length, [projects]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchDraft.trim() }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  function startNewProject() {
    setSelectedProject(null);
    setNotice('');
  }

  async function changeProjectStatus(project: AdminProject) {
    const nextStatus: AdminProjectStatus = project.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`${nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate'} this project?`)) return;
    try {
      await updateProjectStatus.mutateAsync({ projectId: project.id, status: nextStatus });
      setNotice(`Project ${nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully.`);
    } catch (error) {
      setNotice(readableError(error, 'Project status could not be updated.'));
    }
  }

  async function changeRoleStatus(role: AdminProjectRole) {
    const nextStatus: AdminProjectRoleStatus = role.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`${nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate'} this project role?`)) return;
    try {
      await updateRoleStatus.mutateAsync({ roleUuid: role.id, status: nextStatus });
      setNotice(`Project role ${nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully.`);
    } catch (error) {
      setNotice(readableError(error, 'Project role status could not be updated.'));
    }
  }

  if (isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading project workspace." eyebrow="Module refresh" title="Projects" />
        <LoadingState />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="page-stack">
        <PageHeader description="Project data could not be loaded." eyebrow="Module refresh" title="Projects unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-projects-page">
      <PageHeader description="Manage live project roles, project briefs, student visibility, resources, and submission links." eyebrow="Module refresh" title="Projects" />
      {notice ? <div className={/could not|failed|error/i.test(notice) ? 'auth-alert auth-alert--error' : 'auth-alert auth-alert--success'}>{notice}</div> : null}

      <div className="admin-projects-page__top-actions">
        <span>
          {projectsQuery.data?.total ?? projects.length} projects · {activeProjects} active on this view · {roles.length} roles
        </span>
        <button
          className="segmented-button"
          disabled={projectsQuery.isFetching || rolesQuery.isFetching || programsQuery.isFetching}
          onClick={() => {
            void projectsQuery.refetch();
            void rolesQuery.refetch();
            void programsQuery.refetch();
          }}
          type="button"
        >
          <RefreshCw size={16} />
          {projectsQuery.isFetching || rolesQuery.isFetching || programsQuery.isFetching ? 'Refreshing...' : 'Refresh Projects'}
        </button>
      </div>

      <section className="admin-project-section">
        <header className="admin-project-section__header">
          <div>
            <span>Master Data</span>
            <h2>Project Roles</h2>
          </div>
          <button className="segmented-button segmented-button--gold" onClick={() => setSelectedRole(undefined)} type="button">
            <Plus size={15} />
            New Role
          </button>
        </header>
        <div className="admin-project-two-column">
          <div className="admin-project-scroll-list" aria-label="Project role list">
            {roles.length > 0 ? (
              roles.map((role) => <RoleCard disabled={updateRoleStatus.isPending} key={role.id} onEdit={setSelectedRole} onStatusChange={changeRoleStatus} role={role} />)
            ) : (
              <EmptyState />
            )}
          </div>
          <div className="admin-project-editor-panel">
            <h3>{selectedRole ? 'Edit Role' : 'Add Role'}</h3>
            <RoleEditor activePrograms={activePrograms} onSaved={setNotice} role={selectedRole} />
          </div>
        </div>
      </section>

      <section className="admin-project-workspace-grid">
        <div className="admin-project-section">
          <header className="admin-project-section__header">
            <div>
              <span>Projects</span>
              <h2>Live Project Library</h2>
            </div>
            <button className="segmented-button segmented-button--gold" onClick={startNewProject} type="button">
              <Plus size={15} />
              New Project
            </button>
          </header>
          <div className="admin-project-library">
            <div className="admin-project-filter-row">
              <form className="filter-search filter-search--form admin-project-search" onSubmit={(event) => event.preventDefault()}>
                <Search size={16} />
                <label className="sr-only" htmlFor="admin-project-library-search">
                  Search projects
                </label>
                <input id="admin-project-library-search" onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search projects..." type="search" value={searchDraft} />
              </form>
              <select aria-label="Filter project status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ProjectFilters['status'] }))}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select aria-label="Filter project program" value={filters.programKey} onChange={(event) => setFilters((current) => ({ ...current, programKey: event.target.value }))}>
                <option value="">All programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.programKey}>
                    {program.name}
                  </option>
                ))}
              </select>
              <select aria-label="Filter project role" value={filters.roleId} onChange={(event) => setFilters((current) => ({ ...current, roleId: event.target.value }))}>
                <option value="">All roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={roleKey(role)}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-project-scroll-list admin-project-scroll-list--library" aria-label="Live project list">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <ProjectCard
                    isSelected={selectedProject?.id === project.id}
                    key={project.id}
                    onEdit={setSelectedProject}
                    onStatusChange={changeProjectStatus}
                    project={project}
                    programs={programs}
                    role={roleFromProject(project, roles)}
                    statusDisabled={updateProjectStatus.isPending}
                  />
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          </div>
        </div>

        <div className="admin-project-section admin-project-section--sticky">
          <header className="admin-project-section__header">
            <div>
              <span>Editor</span>
              <h2>{selectedProject ? 'Edit Project' : 'Add Project'}</h2>
            </div>
            <Edit3 size={18} />
          </header>
          <ProjectEditor activePrograms={activePrograms} onSaved={setNotice} project={selectedProject} roles={roles} />
          <div className="admin-project-editor-footnote">
            <CheckCircle2 size={15} />
            <span>Student visibility requires active status and at least one active program mapping.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
