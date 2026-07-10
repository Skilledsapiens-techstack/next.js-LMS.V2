import { AlertTriangle, BookOpen, CalendarDays, ExternalLink, FolderKanban, Layers3, Link as LinkIcon, Send, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ProjectRichText, sanitizeProjectHtml } from '../components/ProjectRichText';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentCohort, useStudentCohorts } from '../features/student/useStudentCohorts';
import { StudentProject, StudentProjectTask, useStudentProjects } from '../features/student/useStudentProjects';
import {
  StudentProjectSubmission,
  useStudentProjectSubmissions,
  useSubmitStudentProjectSubmission
} from '../features/student/useStudentProjectSubmissions';

type ProjectRoleOption = {
  label: string;
  value: string;
};

const PROJECT_SUBMISSION_DECLARATIONS = [
  {
    key: 'original_work',
    label: 'I confirm that this live project submission is my original work and reflects my own analysis.'
  },
  {
    key: 'official_submission',
    label: 'I understand that this report will be treated as my official project submission for the selected cohort.'
  },
  {
    key: 'drive_access',
    label: 'I confirm that my Drive/file/folder link has view access for reviewers and can be opened without permission issues.'
  },
  {
    key: 'certificate_correction',
    label: 'I understand that after certificates are released, only name correction requests may be considered.'
  },
  {
    key: 'cohort_selection',
    label: 'I confirm that I am submitting this project for the correct cohort selected in this form.'
  },
  {
    key: 'review_timeline',
    label: 'I understand that approval depends on review quality, completeness, and the Skilled Sapiens review process.'
  }
] as const;

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

function projectStableId(project: StudentProject) {
  return project.projectId ?? project.id;
}

function buildRoleOptions(projects: StudentProject[]): ProjectRoleOption[] {
  return Array.from(new Set(projects.map(projectRoleValue)))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((role) => ({ label: role, value: role }));
}

function upcomingDeadline(projects: StudentProject[]) {
  const now = Date.now();
  const deadlines = projects
    .map((project) => ({ project, time: project.deadline ? new Date(project.deadline).getTime() : Number.NaN }))
    .filter((item) => !Number.isNaN(item.time) && item.time >= now)
    .sort((left, right) => left.time - right.time);

  return deadlines[0]?.project;
}

function isPastDeadline(value: string | undefined) {
  if (!value) return false;
  const deadline = new Date(`${value.slice(0, 10)}T23:59:59.999`);
  return !Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime();
}

function cohortKey(value: string | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function projectProgramKeys(project: StudentProject) {
  return Array.from(new Set([...(project.programKeys ?? []), project.programKey].filter(Boolean).map((key) => String(key).toLowerCase())));
}

function projectProgramLabels(project: StudentProject) {
  if (project.programName) return project.programName.split(',').map((item) => item.trim()).filter(Boolean);
  return projectProgramKeys(project).map((key) => key.toUpperCase());
}

function statusText(value: string) {
  return value.replace(/_/g, ' ');
}

function sortSubmissionsByAttempt(items: StudentProjectSubmission[]) {
  return [...items].sort((left, right) => {
    if (right.attemptNumber !== left.attemptNumber) return right.attemptNumber - left.attemptNumber;
    return new Date(right.submittedAt ?? 0).getTime() - new Date(left.submittedAt ?? 0).getTime();
  });
}

function latestSubmissionForProjectCohort(submissions: StudentProjectSubmission[], project: StudentProject, cohort: StudentCohort) {
  const key = cohortKey(cohort.name);
  const stableProjectId = projectStableId(project);
  return sortSubmissionsByAttempt(
    submissions.filter(
      (submission) =>
        submission.projectId === stableProjectId &&
        (cohortKey(submission.cohortName) === key || submission.cohortKey === key)
    )
  )[0];
}

function eligibleCohorts(project: StudentProject, cohorts: StudentCohort[], submissions: StudentProjectSubmission[]) {
  const programKeys = projectProgramKeys(project);

  return cohorts.filter((cohort) => {
    if (cohort.status !== 'active') return false;
    if (!cohort.programKey || !programKeys.includes(cohort.programKey.toLowerCase())) return false;
    const latest = latestSubmissionForProjectCohort(submissions, project, cohort);
    if (!latest) return true;
    return latest.status === 'changes_requested' || latest.status === 'rejected';
  });
}

function introductionTask(tasks: StudentProjectTask[]) {
  return tasks.find((task) => task.sectionType === 'introduction' || task.title.trim().toLowerCase() === 'introduction');
}

function customReadingTasks(tasks: StudentProjectTask[]) {
  const introduction = introductionTask(tasks);
  return tasks.filter((task) => task !== introduction);
}

function deliverablesReadingHtml(project: StudentProject) {
  if (project.deliverables.length === 0) return '';
  if (project.deliverables.length === 1) {
    const deliverable = project.deliverables[0];
    return sanitizeProjectHtml(deliverable.note ?? deliverable.description ?? deliverable.title);
  }

  const items = project.deliverables
    .map((deliverable) => {
      const detail = [deliverable.format, deliverable.note].filter(Boolean).join(' - ');
      return `<li><strong>${deliverable.title}</strong>${detail ? `: ${detail}` : ''}</li>`;
    })
    .join('');
  return sanitizeProjectHtml(`<ul>${items}</ul>`);
}

function importantProjectLinks(project: StudentProject) {
  return project.documents.filter((document) => document.link);
}

function SubmissionTimeline({ submissions }: { submissions: StudentProjectSubmission[] }) {
  if (submissions.length === 0) {
    return <p>No submission attempt recorded yet.</p>;
  }

  return (
    <div className="live-project-timeline">
      {sortSubmissionsByAttempt(submissions).map((submission) => (
        <article className="live-project-timeline__item" key={submission.id}>
          <span>{submission.attemptNumber}</span>
          <div>
            <strong>{submission.requestNumber ?? submission.id}</strong>
            <p>
              Attempt {submission.attemptNumber} · {statusText(submission.status)}
              {submission.isLate ? ' · late submission' : ''}
            </p>
            {submission.cohortName ? <p>{submission.cohortName}</p> : null}
            {submission.remarks ? <p>{submission.remarks}</p> : null}
            {submission.studentFeedback ? <p>{submission.studentFeedback}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ProjectSubmissionModal({
  cohorts,
  error,
  isLate,
  isSubmitting,
  message,
  onClose,
  onSubmit,
  project
}: {
  cohorts: StudentCohort[];
  error?: string;
  isLate: boolean;
  isSubmitting: boolean;
  message: string;
  onClose: () => void;
  onSubmit: (input: { cohortId: string; declarationAccepted: boolean; declarationConfirmations: string[]; remarks?: string; studentFeedback: string; submissionLink: string }) => Promise<void>;
  project: StudentProject;
}) {
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? '');
  const [submissionLink, setSubmissionLink] = useState('');
  const [studentFeedback, setStudentFeedback] = useState('');
  const [checkedDeclarations, setCheckedDeclarations] = useState<string[]>([]);
  const [localError, setLocalError] = useState('');
  const programLabels = projectProgramLabels(project);
  const allDeclarationsChecked = checkedDeclarations.length === PROJECT_SUBMISSION_DECLARATIONS.length;

  useEffect(() => {
    setCohortId(cohorts[0]?.id ?? '');
  }, [cohorts]);

  function toggleDeclaration(key: string) {
    setCheckedDeclarations((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    if (studentFeedback.trim().length < 30) {
      setLocalError('Add detailed feedback with at least 30 characters before submitting.');
      return;
    }
    if (!allDeclarationsChecked) {
      setLocalError('Confirm all project submission declarations before submitting.');
      return;
    }
    await onSubmit({
      cohortId,
      declarationAccepted: allDeclarationsChecked,
      declarationConfirmations: checkedDeclarations,
      remarks: undefined,
      studentFeedback,
      submissionLink
    });
  }

  return (
    <section aria-labelledby="project-submit-title" aria-modal="true" className="student-modal live-project-modal" role="dialog">
      <div className="student-modal__panel live-project-modal__panel">
        <header className="student-modal__header">
          <div className="live-project-modal__brand">
            <div className="auth-lockup">
              <div className="brand-mark">SS</div>
              <div>
                <strong>Skilled Sapiens</strong>
                <span>Learning Portal</span>
              </div>
            </div>
            <div>
              <span className="section-eyebrow">Project submission</span>
              <h2 id="project-submit-title">Submit report</h2>
              <p>Review your project, eligible cohort, report link access, and declarations before final submission.</p>
            </div>
          </div>
          <button aria-label="Close submission popup" className="student-modal__close" disabled={isSubmitting} onClick={onClose} type="button">
            <X size={22} />
          </button>
        </header>

        <form className="live-project-submit-form" onSubmit={handleSubmit}>
          <div className="live-project-submit-summary">
            <div>
              <span>Project title</span>
              <strong>{project.title}</strong>
            </div>
            <div>
              <span>Tagged programs</span>
              <div className="chip-row">
                {programLabels.length > 0 ? programLabels.map((program) => <StatusBadge key={program}>{program}</StatusBadge>) : <StatusBadge>Program mapped</StatusBadge>}
              </div>
            </div>
          </div>

          {isLate ? (
            <div className="live-project-warning">
              <AlertTriangle size={18} />
              <span>This project deadline has passed. Your report will be submitted with a late submission tag.</span>
            </div>
          ) : null}

          <div className="live-project-warning live-project-warning--info">
            <ExternalLink size={18} />
            <span>Before submitting, make sure your file or folder link is shared so reviewers can open it.</span>
          </div>

          <label>
            <span>Eligible cohort</span>
            <select disabled={cohorts.length <= 1 || isSubmitting} value={cohortId} onChange={(event) => setCohortId(event.target.value)}>
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}{cohort.programKey ? ` · ${cohort.programKey.toUpperCase()}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Report link</span>
            <input disabled={isSubmitting} onChange={(event) => setSubmissionLink(event.target.value)} placeholder="https://..." required type="url" value={submissionLink} />
          </label>

          <label>
            <span>Share your detailed project feedbacks *</span>
            <small>Share what you learned, what the project was about, and your experience while completing this live project.</small>
            <textarea
              disabled={isSubmitting}
              minLength={30}
              onChange={(event) => setStudentFeedback(event.target.value)}
              placeholder="What did you learn, what was this project about, and how was your experience?"
              required
              rows={5}
              value={studentFeedback}
            />
          </label>

          <fieldset className="live-project-declaration-group">
            <legend>Submission declarations *</legend>
            {PROJECT_SUBMISSION_DECLARATIONS.map((declaration) => (
              <label className="live-project-declaration" key={declaration.key}>
                <input
                  checked={checkedDeclarations.includes(declaration.key)}
                  disabled={isSubmitting}
                  onChange={() => toggleDeclaration(declaration.key)}
                  type="checkbox"
                />
                <span>{declaration.label}</span>
              </label>
            ))}
          </fieldset>

          {message ? <p className="live-project-form-message">{message}</p> : null}
          {localError ? <p className="live-project-form-message live-project-form-message--error">{localError}</p> : null}
          {error ? <p className="live-project-form-message live-project-form-message--error">{error}</p> : null}

          <div className="student-modal__actions">
            <button className="segmented-button" disabled={isSubmitting} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="student-action student-action--primary" disabled={isSubmitting} type="submit">
              <Send size={17} />
              {isSubmitting ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function LiveProjectDetail({ allSubmissions, cohorts, project }: { allSubmissions: StudentProjectSubmission[]; cohorts: StudentCohort[]; project: StudentProject }) {
  const submissionsQuery = useStudentProjectSubmissions({ limit: 5, page: 1, projectId: projectStableId(project), status: 'all' });
  const submissions = submissionsQuery.data?.items ?? [];
  const submitMutation = useSubmitStudentProjectSubmission();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const availableCohorts = useMemo(() => eligibleCohorts(project, cohorts, allSubmissions), [allSubmissions, cohorts, project]);
  const deadlinePassed = isPastDeadline(project.deadline);
  const intro = introductionTask(project.tasks);
  const customSections = customReadingTasks(project.tasks);
  const importantLinks = importantProjectLinks(project);
  const readingSections = [
    { body: intro?.description ?? '', label: 'Introduction' },
    { body: project.objectives ?? '', label: 'Project Objective' },
    { body: deliverablesReadingHtml(project), label: 'Project Deliverables' },
    { body: project.brief ?? '', label: 'Project Brief' },
    ...customSections.map((section) => ({ body: section.description ?? '', label: section.title }))
  ].filter((section) => section.label.trim() && sanitizeProjectHtml(section.body));

  async function handleSubmit(input: { cohortId: string; declarationAccepted: boolean; declarationConfirmations: string[]; remarks?: string; studentFeedback: string; submissionLink: string }) {
    setSubmitMessage('');
    const result = await submitMutation.mutateAsync({
      ...input,
      projectId: projectStableId(project)
    });
    setSubmitMessage(result.message);
    if (!result.isLate) setModalOpen(false);
  }

  return (
    <section className="live-project-detail">
      <div className="live-project-hero">
        <span className="eyebrow">Live project</span>
        <h2>{project.title}</h2>
        <div className="live-project-hero__badges">
          <StatusBadge>{projectRoleValue(project)}</StatusBadge>
          {project.companyName ? <StatusBadge>{project.companyName}</StatusBadge> : null}
          {project.deadline ? <StatusBadge tone={deadlinePassed ? 'warning' : 'neutral'}>{deadlinePassed ? `Late after ${formatDate(project.deadline)}` : formatDate(project.deadline)}</StatusBadge> : null}
        </div>
        <p>A complete project brief with objectives, deliverables, supporting sections, and submission status.</p>
      </div>

      <div className={importantLinks.length > 0 ? 'live-project-reader' : 'live-project-reader live-project-reader--full'}>
        <div className="live-project-reader__content">
          {readingSections.length > 0 ? (
            readingSections.map((section) => (
              <article className="live-project-reading-section" key={section.label}>
                <div className="live-project-reading-section__icon">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3>{section.label}</h3>
                  <ProjectRichText className="project-rich-text live-project-reading-copy" html={section.body} />
                </div>
              </article>
            ))
          ) : (
            <article className="live-project-reading-section">
              <div className="live-project-reading-section__icon">
                <BookOpen size={18} />
              </div>
              <div>
                <h3>Project Brief</h3>
                <p className="live-project-empty">Project details will appear here once the admin team updates the brief.</p>
              </div>
            </article>
          )}
        </div>

        {importantLinks.length > 0 ? (
          <aside className="live-project-important-links" aria-label="Important project links">
            <div>
              <span className="eyebrow">References</span>
              <h3>Important Links</h3>
            </div>
            <div>
              {importantLinks.map((document) => (
                <a className="live-project-important-link" href={document.link} key={`${document.title}-${document.link}`} rel="noreferrer" target="_blank">
                  <LinkIcon size={16} />
                  <span>{document.label ?? document.title}</span>
                  <ExternalLink size={15} />
                </a>
              ))}
            </div>
          </aside>
        ) : null}
      </div>

      <article className="live-project-submission">
        <div>
          <h3>Submission history</h3>
          {submissionsQuery.isLoading ? (
            <p>Loading submission history.</p>
          ) : submissions.length > 0 ? (
            <>
              <p>{submissionsQuery.data?.total ?? submissions.length} submission attempt(s) recorded for this project.</p>
              <SubmissionTimeline submissions={submissions} />
            </>
          ) : (
            <p>No submission attempt recorded yet.</p>
          )}
        </div>

        {availableCohorts.length > 0 ? (
          <button className="student-action student-action--primary live-project-submit" onClick={() => setModalOpen(true)} type="button">
            <Send size={18} />
            Submit Report
          </button>
        ) : (
          <span className="live-project-submit live-project-submit--disabled">No eligible cohort available for submission</span>
        )}

        {submitMessage && !modalOpen ? <p className="live-project-submit-note">{submitMessage}</p> : null}
        {modalOpen ? (
          <ProjectSubmissionModal
            cohorts={availableCohorts}
            error={submitMutation.isError ? submitMutation.error.message : undefined}
            isLate={deadlinePassed}
            isSubmitting={submitMutation.isPending}
            message={submitMessage}
            onClose={() => setModalOpen(false)}
            onSubmit={handleSubmit}
            project={project}
          />
        ) : null}
      </article>
    </section>
  );
}

export function StudentProjectsPage() {
  const projectsQuery = useStudentProjects({ limit: 100, page: 1 });
  const cohortsQuery = useStudentCohorts({ limit: 100, page: 1, status: 'active' });
  const allSubmissionsQuery = useStudentProjectSubmissions({ limit: 500, page: 1, status: 'all' });
  const projects = useMemo(() => projectsQuery.data?.items ?? [], [projectsQuery.data?.items]);
  const cohorts = useMemo(() => cohortsQuery.data?.items ?? [], [cohortsQuery.data?.items]);
  const allSubmissions = useMemo(() => allSubmissionsQuery.data?.items ?? [], [allSubmissionsQuery.data?.items]);
  const roleOptions = useMemo(() => buildRoleOptions(projects), [projects]);
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const filteredProjects = useMemo(
    () => projects.filter((project) => selectedRole === 'all' || projectRoleValue(project) === selectedRole),
    [projects, selectedRole]
  );
  const selectedProject = filteredProjects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0];
  const nextDeadlineProject = useMemo(() => upcomingDeadline(projects), [projects]);

  useEffect(() => {
    if (selectedRole !== 'all' && !roleOptions.some((role) => role.value === selectedRole)) {
      setSelectedRole('all');
    }
  }, [roleOptions, selectedRole]);

  useEffect(() => {
    if (selectedProject && selectedProject.id !== selectedProjectId) {
      setSelectedProjectId(selectedProject.id);
    } else if (!selectedProject && selectedProjectId) {
      setSelectedProjectId('');
    }
  }, [selectedProject, selectedProjectId]);

  function handleRoleChange(nextRole: string) {
    const nextProjects = projects.filter((project) => nextRole === 'all' || projectRoleValue(project) === nextRole);
    setSelectedRole(nextRole);
    setSelectedProjectId(nextProjects[0]?.id ?? '');
  }

  if (projectsQuery.isLoading || cohortsQuery.isLoading || allSubmissionsQuery.isLoading) {
    return (
      <div className="page-stack student-project-hub-page">
        <PageHeader description="Loading projects visible to your student profile." eyebrow="Live project hub" title="Your Active Projects" />
        <LoadingState />
      </div>
    );
  }

  if (projectsQuery.isError || cohortsQuery.isError || allSubmissionsQuery.isError) {
    return (
      <div className="page-stack student-project-hub-page">
        <PageHeader description="Projects could not be loaded right now." eyebrow="Live project hub" title="Projects unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack student-project-hub-page">
      <PageHeader
        description="Project briefs, key tasks, support documents, deliverables, and submission status in one place."
        eyebrow="Live project hub"
        title="Your Active Projects"
      />

      {projects.length > 0 ? (
        <>
          <section className="live-project-summary" aria-label="Project summary">
            <article className="live-project-summary-card">
              <FolderKanban size={20} />
              <span>Visible projects</span>
              <strong>{projects.length}</strong>
            </article>
            <article className="live-project-summary-card">
              <Layers3 size={20} />
              <span>Project roles</span>
              <strong>{roleOptions.length}</strong>
            </article>
            <article className="live-project-summary-card">
              <CalendarDays size={20} />
              <span>Next deadline</span>
              <strong>{nextDeadlineProject ? formatDate(nextDeadlineProject.deadline) : 'Not set'}</strong>
            </article>
          </section>

          <section className="live-project-picker" aria-label="Live project selector">
            <label>
              <span>Project role</span>
              <select value={selectedRole} onChange={(event) => handleRoleChange(event.target.value)}>
                <option value="all">All roles</option>
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

          {filteredProjects.length === 0 ? (
            <StateBlock title="No projects for this role">
              Choose All roles to see every project currently mapped to your account.
            </StateBlock>
          ) : null}

          {projectsQuery.data && projectsQuery.data.total > projects.length ? (
            <StateBlock title="More projects available">
              Showing the first {projects.length} eligible projects. We should add a dedicated project picker endpoint if one student can have more than 100 active projects.
            </StateBlock>
          ) : null}

          {selectedProject ? <LiveProjectDetail allSubmissions={allSubmissions} cohorts={cohorts} project={selectedProject} /> : <EmptyState />}
        </>
      ) : (
        <EmptyState />
      )}

      <StateBlock title="Project access">
        Only projects mapped to your account are shown here. If a project is missing, share the project name and program details with your program coordinator.
      </StateBlock>
    </div>
  );
}
