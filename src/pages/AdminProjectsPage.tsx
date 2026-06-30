import { Edit3, Plus, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { AdminProject, AdminProjectRole, useAdminProjectRoles, useAdminProjects } from '../features/admin/useAdminProjects';

type ProgramTemplate = {
  domainLabel: string;
  name: string;
  programKey: string;
  shortName: string;
};

const programTemplates: ProgramTemplate[] = [
  { domainLabel: 'Consulting', name: 'Management Consulting Leadership Program', programKey: 'mclp', shortName: 'MCLP' },
  { domainLabel: 'Sales & Marketing', name: 'Sales & Marketing Leadership Program', programKey: 'smlp', shortName: 'SMLP' },
  { domainLabel: 'HR', name: 'HR Leadership Program', programKey: 'hrlp', shortName: 'HRLP' },
  { domainLabel: 'Finance ER', name: 'Finance Leadership Program - ER', programKey: 'flp_er', shortName: 'FLP ER' },
  { domainLabel: 'Finance QF', name: 'Finance Leadership Program - QF', programKey: 'flp_qf', shortName: 'FLP QF' },
  { domainLabel: 'Product', name: 'Product Management Leadership Program', programKey: 'pmlp', shortName: 'PMLP' },
  { domainLabel: 'GD-PI', name: 'GD-PI Mentorship Program', programKey: 'gd_pi', shortName: 'GD-PI' },
  { domainLabel: 'Mgmt Projects', name: 'Live Projects - Management Tracks', programKey: 'live_mgmt', shortName: 'Mgmt Projects' },
  { domainLabel: 'HR Projects', name: 'Live Projects - HR Track', programKey: 'live_hr', shortName: 'HR Projects' },
  { domainLabel: 'ER Projects', name: 'Live Projects - ER Track', programKey: 'live_er', shortName: 'ER Projects' },
  { domainLabel: 'QF Projects', name: 'Live Projects - QF Track', programKey: 'live_qf', shortName: 'QF Projects' },
  { domainLabel: 'PEVC Projects', name: 'Live Projects - PEVC Track', programKey: 'live_pevc', shortName: 'PEVC Projects' },
  { domainLabel: 'Placement', name: 'Placement Mentorship Program', programKey: 'placement', shortName: 'Placement' }
];

const emptyProject: AdminProject = {
  deliverables: [],
  documents: [],
  id: `PRJ-${Date.now()}`,
  programKeys: [],
  status: 'active',
  tasks: [],
  title: ''
};

function formatDate(value: string | undefined) {
  if (!value) return 'Auto';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function projectPrograms(project: AdminProject) {
  const keys = project.programKeys.length > 0 ? project.programKeys : [project.programKey].filter((value): value is string => Boolean(value));
  return keys.map((key) => programTemplates.find((program) => program.programKey === key)?.domainLabel ?? project.programName ?? key);
}

function asTextareaRows(items: Array<{ description?: string; format?: string; link?: string; note?: string; title: string; type?: string }>) {
  return items
    .map((item) => [item.title, item.link ?? item.format ?? item.description ?? item.note ?? item.type].filter(Boolean).join('|'))
    .join('\n');
}

function ProjectSearch({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(value.trim());
  }

  return (
    <form className="filter-search admin-project-search" onSubmit={handleSubmit}>
      <Search size={16} />
      <label className="sr-only" htmlFor="admin-project-library-search">
        Search projects
      </label>
      <input id="admin-project-library-search" onChange={(event) => setValue(event.target.value)} placeholder="Search projects..." type="search" value={value} />
    </form>
  );
}

function RoleEditor({ role }: { role?: AdminProjectRole }) {
  return (
    <form className="admin-project-form">
      <label>
        <span>Role ID *</span>
        <input defaultValue={role?.id ?? ''} placeholder="growth_strategy_consultant" />
      </label>
      <label>
        <span>Status</span>
        <select defaultValue={role?.status ?? 'active'}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>
        <span>Role name *</span>
        <input defaultValue={role?.name ?? ''} placeholder="Growth & Strategy Consultant" />
      </label>
      <label>
        <span>Role category</span>
        <input defaultValue={role?.category ?? ''} placeholder="Management" />
      </label>
      <label className="admin-project-form__wide">
        <span>Live project program entitlement *</span>
        <select defaultValue={role?.programKey ?? ''}>
          <option value="">Select live-project program</option>
          {programTemplates
            .filter((program) => program.programKey.startsWith('live_'))
            .map((program) => (
              <option key={program.programKey} value={program.programKey}>
                {program.name}
              </option>
            ))}
        </select>
      </label>
      <div className="admin-project-form__actions">
        <button className="segmented-button" type="reset">
          Clear
        </button>
        <button className="segmented-button segmented-button--gold" disabled type="button">
          Save Role
        </button>
      </div>
    </form>
  );
}

function ProjectEditor({ project, roles }: { project: AdminProject; roles: AdminProjectRole[] }) {
  const selectedProgramKeys = project.programKeys.length > 0 ? project.programKeys : [project.programKey].filter((value): value is string => Boolean(value));

  return (
    <form className="admin-project-form admin-project-form--editor">
      <label>
        <span>Project ID *</span>
        <input readOnly value={project.id} />
      </label>
      <label>
        <span>Status</span>
        <select defaultValue={project.status}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="admin-project-form__wide">
        <span>Project title *</span>
        <input defaultValue={project.title} placeholder="Project title" />
      </label>
      <label>
        <span>Live company name</span>
        <input defaultValue={project.companyName ?? ''} placeholder="e.g. Samann.com" />
      </label>
      <label>
        <span>Project role *</span>
        <select defaultValue={project.roleId ?? ''}>
          <option value="">Select project role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="admin-project-program-picker">
        <legend>Programs *</legend>
        <div className="admin-project-program-picker__actions">
          <button className="segmented-button" type="button">
            Select All Programs
          </button>
          <button className="segmented-button" type="button">
            Clear Programs
          </button>
        </div>
        <div className="admin-project-program-list">
          {programTemplates.map((program) => (
            <label key={program.programKey}>
              <input defaultChecked={selectedProgramKeys.includes(program.programKey)} type="checkbox" />
              <span>{program.name}</span>
              <strong>{program.shortName}</strong>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span>Program name</span>
        <input readOnly value={project.programName ?? programTemplates.find((program) => selectedProgramKeys.includes(program.programKey))?.name ?? ''} />
      </label>
      <label className="admin-project-form__wide">
        <span>Brief</span>
        <textarea defaultValue={project.brief ?? ''} placeholder="Project brief or problem statement" rows={4} />
      </label>
      <label className="admin-project-form__wide">
        <span>Objectives</span>
        <textarea defaultValue={project.objectives ?? ''} placeholder="Project objectives and expected learning outcomes" rows={4} />
      </label>
      <label className="admin-project-form__wide">
        <span>Action items</span>
        <textarea defaultValue={asTextareaRows(project.tasks)} placeholder="One task per line, or Title: Description" rows={4} />
      </label>
      <label className="admin-project-form__wide">
        <span>Deliverables</span>
        <textarea defaultValue={asTextareaRows(project.deliverables)} placeholder="Example: Slide deck|PPTX|Final presentation" rows={4} />
      </label>
      <label className="admin-project-form__wide">
        <span>Resources</span>
        <textarea defaultValue={asTextareaRows(project.documents)} placeholder="Example: Brief|https://...|doc|Read before starting" rows={4} />
      </label>
      <label>
        <span>Deadline</span>
        <input defaultValue={project.deadline ?? ''} type="date" />
      </label>
      <label>
        <span>Updated at</span>
        <input readOnly value={formatDate(project.updatedAt)} />
      </label>
      <div className="admin-project-form__actions">
        <button className="segmented-button" type="reset">
          Clear
        </button>
        <button className="segmented-button segmented-button--gold" disabled type="button">
          Save Project
        </button>
      </div>
    </form>
  );
}

function RoleCard({ onEdit, role }: { onEdit: (role: AdminProjectRole) => void; role: AdminProjectRole }) {
  return (
    <article className="admin-project-list-card">
      <div>
        <h3>{role.name}</h3>
        <p>
          {[role.category, role.id, role.programKey ?? 'No program mapping', role.status].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="admin-project-list-card__actions">
        <button className="segmented-button" onClick={() => onEdit(role)} type="button">
          Edit
        </button>
        <button className="segmented-button segmented-button--danger" disabled type="button">
          Deactivate
        </button>
      </div>
    </article>
  );
}

function ProjectCard({ isSelected, onEdit, project }: { isSelected: boolean; onEdit: (project: AdminProject) => void; project: AdminProject }) {
  const programs = projectPrograms(project);

  return (
    <article className={isSelected ? 'admin-project-list-card admin-project-list-card--selected' : 'admin-project-list-card'}>
      <div>
        <h3>{project.title || project.id}</h3>
        <p>
          {[project.id, project.projectRole, project.companyName ?? 'Company not set'].filter(Boolean).join(' · ')}
          {programs.length > 0 ? ` · ${programs.join(', ')}` : ''}
        </p>
        <div className="chip-row">
          {programs.slice(0, 10).map((program) => (
            <StatusBadge key={program}>{program}</StatusBadge>
          ))}
          <StatusBadge tone={project.status === 'active' ? 'safe' : 'warning'}>{project.status}</StatusBadge>
        </div>
      </div>
      <div className="admin-project-list-card__actions">
        <button className="segmented-button" onClick={() => onEdit(project)} type="button">
          Edit
        </button>
        <button className="segmented-button segmented-button--danger" disabled type="button">
          Deactivate
        </button>
      </div>
    </article>
  );
}

export function AdminProjectsPage() {
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<AdminProject>(emptyProject);
  const [selectedRole, setSelectedRole] = useState<AdminProjectRole | undefined>();
  const projectsQuery = useAdminProjects({ limit: 100, search: projectSearch, status: 'all' });
  const rolesQuery = useAdminProjectRoles({ limit: 100, status: 'all' });
  const projects = projectsQuery.data?.items ?? [];
  const roles = rolesQuery.data?.items ?? [];
  const hasError = projectsQuery.isError || rolesQuery.isError;
  const isLoading = projectsQuery.isLoading || rolesQuery.isLoading;
  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'active').length, [projects]);

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
      <PageHeader description="Refresh only projects data from the database." eyebrow="Module refresh" title="Projects" />
      <div className="admin-projects-page__top-actions">
        <span>
          {projects.length} projects · {activeProjects} active · {roles.length} roles
        </span>
        <button
          className="segmented-button"
          onClick={() => {
            void projectsQuery.refetch();
            void rolesQuery.refetch();
          }}
          type="button"
        >
          Refresh Projects
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
            {roles.length > 0 ? roles.map((role) => <RoleCard key={role.id} onEdit={setSelectedRole} role={role} />) : <EmptyState />}
          </div>
          <div className="admin-project-editor-panel">
            <h3>{selectedRole ? 'Edit Role' : 'Add Role'}</h3>
            <RoleEditor role={selectedRole} />
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
            <button className="segmented-button segmented-button--gold" onClick={() => setSelectedProject({ ...emptyProject, id: `PRJ-${Date.now()}` })} type="button">
              <Plus size={15} />
              New Project
            </button>
          </header>
          <div className="admin-project-library">
            <ProjectSearch onSearch={setProjectSearch} />
            <div className="admin-project-scroll-list admin-project-scroll-list--library" aria-label="Live project list">
              {projects.length > 0 ? (
                projects.map((project) => <ProjectCard isSelected={selectedProject.id === project.id} key={project.id} onEdit={setSelectedProject} project={project} />)
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
              <h2>{selectedProject.title ? 'Edit Project' : 'Add Project'}</h2>
            </div>
            <Edit3 size={18} />
          </header>
          <ProjectEditor project={selectedProject} roles={roles} />
        </div>
      </section>
    </div>
  );
}
