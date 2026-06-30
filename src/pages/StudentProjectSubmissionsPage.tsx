import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentProjectSubmission, StudentProjectSubmissionStatus, useStudentProjectSubmissions } from '../features/student/useStudentProjectSubmissions';

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function buildPageLink(page: number) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  return `?${params.toString()}`;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not submitted';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatStatus(status: StudentProjectSubmissionStatus) {
  return status.replace(/_/g, ' ');
}

function statusTone(status: StudentProjectSubmissionStatus) {
  if (status === 'approved') return 'safe';
  if (status === 'rejected') return 'warning';
  return 'neutral';
}

function SubmissionCard({ submission }: { submission: StudentProjectSubmission }) {
  const title = submission.projectTitle ?? submission.requestNumber ?? 'Project submission';
  const cohort = submission.cohortName ?? submission.cohortKey;
  const context = [submission.roleName, submission.programKey, cohort].filter(Boolean).join(' · ');

  return (
    <article className="submission-card">
      <div className="submission-card__main">
        <span className="eyebrow">Project submission</span>
        <h2>{title}</h2>
        {context ? <p>{context}</p> : null}
        <div className="submission-card__chips">
          <StatusBadge tone={statusTone(submission.status)}>{formatStatus(submission.status)}</StatusBadge>
          <span>Attempt {submission.attemptNumber}</span>
          {submission.isRepeatSubmission ? <span>Repeat submission</span> : null}
        </div>
      </div>

      <div className="submission-card__meta">
        <div>
          <span>Submitted</span>
          <strong>{formatDate(submission.submittedAt)}</strong>
        </div>
        {submission.requestNumber ? (
          <div>
            <span>Reference</span>
            <strong>{submission.requestNumber}</strong>
          </div>
        ) : null}
      </div>

      {submission.remarks ? <p className="submission-card__remarks">{submission.remarks}</p> : null}

      {submission.submissionLink ? (
        <a className="action-button submission-card__link" href={submission.submissionLink} rel="noreferrer" target="_blank">
          <ExternalLink size={16} />
          Open submission
        </a>
      ) : null}
    </article>
  );
}

export function StudentProjectSubmissionsPage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const submissionsQuery = useStudentProjectSubmissions({ page });
  const data = submissionsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const hasPagination = useMemo(() => Boolean(data && (data.hasPreviousPage || data.hasNextPage || totalPages > 1)), [data, totalPages]);

  if (submissionsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your submitted project work." eyebrow="Project submissions" title="Submission History" />
        <LoadingState />
      </div>
    );
  }

  if (submissionsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Your submission history could not be loaded right now." eyebrow="Project submissions" title="Submission History" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Track your submitted project work, review status, attempts, and submission references."
        eyebrow="Project submissions"
        title="Submission History"
      />

      {data && data.items.length > 0 ? (
        <section className="submission-card-list" aria-label="Project submission history">
          {data.items.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      {hasPagination ? (
        <nav className="pagination-bar" aria-label="Project submission pagination">
          {data?.hasPreviousPage ? (
            <Link className="pagination-link" to={buildPageLink(page - 1)}>
              Previous page
            </Link>
          ) : (
            <span className="pagination-link pagination-link--disabled">Previous page</span>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {data?.hasNextPage ? (
            <Link className="pagination-link" to={buildPageLink(page + 1)}>
              Next page
            </Link>
          ) : (
            <span className="pagination-link pagination-link--disabled">Next page</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
