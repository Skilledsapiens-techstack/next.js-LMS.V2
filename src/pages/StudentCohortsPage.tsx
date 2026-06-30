import { CalendarDays, ExternalLink, GraduationCap } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentCohort, useStudentCohorts } from '../features/student/useStudentCohorts';

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

const programDisplayMap: Record<string, string> = {
  flp: 'Finance',
  hrlp: 'HR',
  mclp: 'Management Consulting',
  pmlp: 'Product Management',
  smlp: 'Sales & Marketing'
};

function buildPageLink(page: number) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  return `?${params.toString()}`;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusTone(status: string) {
  return status === 'active' ? 'safe' : status === 'upcoming' ? 'warning' : 'neutral';
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function displayProgramName(cohort: StudentCohort) {
  const key = (cohort.domainKey ?? cohort.programKey ?? '').trim().toLowerCase();
  if (key && programDisplayMap[key]) return programDisplayMap[key];
  if (cohort.programKey) return cohort.programKey.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (cohort.domainKey) return cohort.domainKey.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return 'Enrolled Program';
}

function ProgramCard({ cohort }: { cohort: StudentCohort }) {
  const programTitle = displayProgramName(cohort);

  return (
    <article className="program-card">
      <div className="program-card__head">
        <div className="program-card__icon" aria-hidden="true">
          <GraduationCap size={24} />
        </div>
        <div>
          <span className="eyebrow">Enrolled program</span>
          <h2>{programTitle}</h2>
        </div>
        <StatusBadge tone={statusTone(cohort.status)}>{formatStatus(cohort.status)}</StatusBadge>
      </div>

      <div className="program-card__body">
        <h3>{cohort.name}</h3>
        {cohort.selfPaced ? (
          <div className="program-card__chips">
            <span>Self paced</span>
          </div>
        ) : null}
      </div>

      <div className="program-card__meta">
        {cohort.startDate ? (
          <div>
            <CalendarDays size={18} />
            <span>Starts {formatDate(cohort.startDate)}</span>
          </div>
        ) : null}
      </div>

      {cohort.whatsappLink ? (
        <a className="action-button program-card__link" href={cohort.whatsappLink} rel="noreferrer" target="_blank">
          <ExternalLink size={16} />
          Join WhatsApp group
        </a>
      ) : cohort.whatsappGroupName ? (
        <span className="program-card__note">WhatsApp group: {cohort.whatsappGroupName}</span>
      ) : null}
    </article>
  );
}

export function StudentCohortsPage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const cohortsQuery = useStudentCohorts({ page });
  const data = cohortsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const hasPagination = useMemo(() => Boolean(data && (data.hasPreviousPage || data.hasNextPage || totalPages > 1)), [data, totalPages]);

  if (cohortsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your enrolled programs." eyebrow="My learning" title="My Programs" />
        <LoadingState />
      </div>
    );
  }

  if (cohortsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Your enrolled programs could not be loaded right now." eyebrow="My learning" title="My Programs" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Programs and cohorts you are currently entitled to access."
        eyebrow="My learning"
        title="My Programs"
      />

      {data && data.items.length > 0 ? (
        <section className="program-card-grid" aria-label="Enrolled programs and cohorts">
          {data.items.map((cohort) => (
            <ProgramCard cohort={cohort} key={cohort.id} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      {hasPagination ? (
        <nav className="pagination-bar" aria-label="Program pagination">
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
