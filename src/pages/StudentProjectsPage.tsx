import { Download, ExternalLink, FileCheck2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentProject, StudentProjectDeliverable, StudentProjectDocument, StudentProjectTask, useStudentProjects } from '../features/student/useStudentProjects';
import { useStudentProjectSubmissions } from '../features/student/useStudentProjectSubmissions';

type ProjectRoleOption = {
  label: string;
  value: string;
};

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function projectRoleValue(project: StudentProject) {
  return project.projectRole ?? project.roleId ?? 'Project';
}

function buildRoleOptions(projects: StudentProject[]): ProjectRoleOption[] {
  return Array.from(new Set(projects.map(projectRoleValue)))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((role) => ({ label: role, value: role }));
}

function ProjectTaskList({ tasks }: { tasks: StudentProjectTask[] }) {
  if (tasks.length === 0) {
    return <p className="live-project-empty">No key tasks listed yet.</p>;
  }

  return (
    <div className="live-project-item-list">
      {tasks.map((task, index) => (
        <article className="live-project-task" key={`${task.title}-${index}`}>
          <span>{index + 1}</span>
          <div>
            <strong>{task.title}</strong>
            {task.description ? <p>{task.description}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ProjectDocumentList({ documents }: { documents: StudentProjectDocument[] }) {
  if (documents.length === 0) {
    return <p className="live-project-empty">No support documents listed yet.</p>;
  }

  return (
    <div className="live-project-item-list">
      {documents.map((document) => (
        <article className="live-project-document" key={`${document.title}-${document.link ?? document.type ?? ''}`}>
          <div className="live-project-document__type">{document.type ?? 'DOC'}</div>
          <div>
            <strong>{document.title}</strong>
            <p>{document.description ?? 'Use this file for your project work.'}</p>
            {document.type ? <StatusBadge>{document.type}</StatusBadge> : null}
          </div>
          {document.link ? (
            <a className="icon-button" href={document.link} rel="noreferrer" target="_blank" aria-label={`Open ${document.title}`}>
              <Download size={18} />
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ProjectDeliverableList({ deliverables }: { deliverables: StudentProjectDeliverable[] }) {
  if (deliverables.length === 0) {
    return <p className="live-project-empty">No deliverables listed yet.</p>;
  }

  return (
    <div className="live-project-item-list">
      {deliverables.map((deliverable) => (
        <article className="live-project-deliverable" key={`${deliverable.title}-${deliverable.format ?? deliverable.note ?? ''}`}>
          <FileCheck2 size={18} />
          <div>
            <strong>{deliverable.title}</strong>
            <p>{deliverable.note ?? 'Submit the completed work in the required format.'}</p>
          </div>
          {deliverable.format ? <StatusBadge>{deliverable.format}</StatusBadge> : null}
        </article>
      ))}
    </div>
  );
}

function LiveProjectDetail({ project }: { project: StudentProject }) {
  const submissionsQuery = useStudentProjectSubmissions({ limit: 5, page: 1, search: project.title, status: 'all' });
  const submissions = submissionsQuery.data?.items ?? [];

  return (
    <section className="live-project-detail">
      <div className="live-project-hero">
        <span className="eyebrow">Live project</span>
        <h2>{project.title}</h2>
        <div className="live-project-hero__badges">
          <StatusBadge>{projectRoleValue(project)}</StatusBadge>
          {project.companyName ? <StatusBadge>{project.companyName}</StatusBadge> : null}
          <StatusBadge>{formatDate(project.deadline)}</StatusBadge>
        </div>
        {project.brief || project.objectives ? <p>{project.brief ?? project.objectives}</p> : null}
      </div>

      <div className="live-project-section-grid">
        <article className="live-project-panel">
          <div className="live-project-panel__header">
            <span className="eyebrow">What to do</span>
            <h3>Key Tasks</h3>
          </div>
          <ProjectTaskList tasks={project.tasks} />
        </article>

        <article className="live-project-panel">
          <div className="live-project-panel__header">
            <span className="eyebrow">Support documents</span>
            <h3>Download Files</h3>
          </div>
          <ProjectDocumentList documents={project.documents} />
        </article>
      </div>

      <article className="live-project-panel live-project-panel--wide">
        <div className="live-project-panel__header">
          <span className="eyebrow">What to submit</span>
          <h3>Deliverables</h3>
        </div>
        <ProjectDeliverableList deliverables={project.deliverables} />
      </article>

      <article className="live-project-submission">
        <div>
          <h3>Submission history</h3>
          {submissionsQuery.isLoading ? (
            <p>Loading submission history.</p>
          ) : submissions.length > 0 ? (
            <>
              <p>{submissionsQuery.data?.total ?? submissions.length} submission attempt(s) recorded for this project.</p>
              <div className="live-project-submission__chips">
                {submissions.map((submission) => (
                  <StatusBadge key={submission.id}>{`${submission.requestNumber ?? submission.id} · Attempt ${submission.attemptNumber} · ${submission.status.replace(/_/g, ' ')}`}</StatusBadge>
                ))}
              </div>
            </>
          ) : (
            <p>No submission attempt recorded yet.</p>
          )}
        </div>

        {project.submissionLink ? (
          <a className="student-action student-action--primary live-project-submit" href={project.submissionLink} rel="noreferrer" target="_blank">
            <ExternalLink size={18} />
            Submit Project Report
          </a>
        ) : (
          <span className="live-project-submit live-project-submit--disabled">Submission link not available</span>
        )}
      </article>
    </section>
  );
}

export function StudentProjectsPage() {
  const projectsQuery = useStudentProjects({ limit: 100, page: 1 });
  const projects = useMemo(() => projectsQuery.data?.items ?? [], [projectsQuery.data?.items]);
  const roleOptions = useMemo(() => buildRoleOptions(projects), [projects]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const filteredProjects = useMemo(() => projects.filter((project) => !selectedRole || projectRoleValue(project) === selectedRole), [projects, selectedRole]);
  const selectedProject = filteredProjects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0];

  useEffect(() => {
    if (!selectedRole && roleOptions[0]) {
      setSelectedRole(roleOptions[0].value);
    }
  }, [roleOptions, selectedRole]);

  useEffect(() => {
    if (selectedProject && selectedProject.id !== selectedProjectId) {
      setSelectedProjectId(selectedProject.id);
    }
  }, [selectedProject, selectedProjectId]);

  function handleRoleChange(nextRole: string) {
    const nextProjects = projects.filter((project) => projectRoleValue(project) === nextRole);
    setSelectedRole(nextRole);
    setSelectedProjectId(nextProjects[0]?.id ?? '');
  }

  if (projectsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading projects visible to your student profile." eyebrow="Live project hub" title="Your Active Projects" />
        <LoadingState />
      </div>
    );
  }

  if (projectsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Projects could not be loaded right now." eyebrow="Live project hub" title="Projects unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Project briefs, key tasks, support documents, deliverables, and submission links in one place."
        eyebrow="Live project hub"
        title="Your Active Projects"
      />

      {projects.length > 0 ? (
        <>
          <section className="live-project-picker" aria-label="Live project selector">
            <label>
              <span>Project role</span>
              <select value={selectedRole} onChange={(event) => handleRoleChange(event.target.value)}>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Project</span>
              <select value={selectedProject?.id ?? ''} onChange={(event) => setSelectedProjectId(event.target.value)}>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {projectsQuery.data && projectsQuery.data.total > projects.length ? (
            <StateBlock title="More projects available">
              Showing the first {projects.length} eligible projects. We should add a dedicated project picker endpoint if one student can have more than 100 active projects.
            </StateBlock>
          ) : null}

          {selectedProject ? <LiveProjectDetail project={selectedProject} /> : <EmptyState />}
        </>
      ) : (
        <EmptyState />
      )}

      <StateBlock title="Project access">
        Only projects available to your account are shown here. If a project is missing, contact Support with the project name and program details.
      </StateBlock>
    </div>
  );
}
