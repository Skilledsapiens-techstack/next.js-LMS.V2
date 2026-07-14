import { Award, BookOpen, CalendarDays, GraduationCap, Library, MessageCircle, PlayCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { useStudentCertificates } from '../features/student/useStudentCertificates';
import { StudentCohort, useStudentCohorts } from '../features/student/useStudentCohorts';
import { useStudentRecordings } from '../features/student/useStudentRecordings';
import { useStudentResources } from '../features/student/useStudentResources';
import { StudentScheduleItem, useStudentSchedule } from '../features/student/useStudentSchedule';

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
  if (cohort.programName?.trim()) return cohort.programName.trim();
  if (cohort.programKey) return cohort.programKey.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (cohort.domainKey) return cohort.domainKey.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return 'Enrolled Program';
}

function programKeyFor(cohort: StudentCohort) {
  return (cohort.domainKey ?? cohort.programKey ?? '').trim().toLowerCase();
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function itemMatchesProgram(item: { cohortNames?: string[]; domainKey?: string; programKey?: string; programKeys?: string[] }, cohort: StudentCohort) {
  const programKey = programKeyFor(cohort);
  const cohortName = normalize(cohort.name);
  const directKeys = [item.programKey, item.domainKey, ...(item.programKeys ?? [])].map(normalize).filter(Boolean);
  const cohortNames = (item.cohortNames ?? []).map(normalize);
  return (programKey && directKeys.includes(programKey)) || cohortNames.includes(cohortName);
}

function certificateMatchesProgram(certificate: { cohortName?: string; programKey?: string }, cohort: StudentCohort) {
  const programKey = programKeyFor(cohort);
  return (programKey && normalize(certificate.programKey) === programKey) || normalize(certificate.cohortName) === normalize(cohort.name);
}

function getScheduledAt(item: StudentScheduleItem) {
  const dateMatch = item.date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = item.time?.match(/^(\d{1,2}):(\d{2})/);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const scheduledAt = new Date(Number(year), Number(month) - 1, Number(day), hour, minute);
  return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
}

function nextSessionFor(items: StudentScheduleItem[]) {
  return [...items]
    .sort((left, right) => (getScheduledAt(left)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (getScheduledAt(right)?.getTime() ?? Number.MAX_SAFE_INTEGER))
    .find(Boolean);
}

function formatWindow(cohort: StudentCohort) {
  const start = cohort.startDate ? formatDate(cohort.startDate) : 'Start not set';
  const end = cohort.endDate ? formatDate(cohort.endDate) : 'End not set';
  return `${start} to ${end}`;
}

function programLink(path: string, cohort: StudentCohort) {
  const programKey = programKeyFor(cohort);
  return programKey && path === '/student/resources' ? `${path}?programKey=${encodeURIComponent(programKey)}` : path;
}

function normalizeExternalLink(value: string | undefined) {
  const link = value?.trim();
  if (!link) return '';
  if (/^https?:\/\//i.test(link)) return link;
  if (/^(chat\.whatsapp\.com|wa\.me)\//i.test(link)) return `https://${link}`;
  return link;
}

type ProgramStats = {
  certificates: number;
  recordings: number;
  resources: number;
  sessions: number;
  nextSession?: StudentScheduleItem;
};

function ProgramCard({ cohort, stats }: { cohort: StudentCohort; stats: ProgramStats }) {
  const programTitle = displayProgramName(cohort);
  const programKey = programKeyFor(cohort);
  const whatsappLink = normalizeExternalLink(cohort.whatsappLink);
  const whatsappLabel = cohort.whatsappGroupName ? `WhatsApp Group: ${cohort.whatsappGroupName}` : 'WhatsApp Group';

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
        <p>{formatWindow(cohort)}</p>
        {cohort.selfPaced ? (
          <div className="program-card__chips">
            <span>Self paced</span>
          </div>
        ) : null}
      </div>

      <div className="program-card__stats" aria-label={`${programTitle} learning counts`}>
        <span>
          <b>{stats.sessions}</b>
          Sessions
        </span>
        <span>
          <b>{stats.recordings}</b>
          Watch Recordings
        </span>
        <span>
          <b>{stats.resources}</b>
          Resource Library
        </span>
      </div>

      <div className="program-card__meta">
        {programKey ? (
          <div>
            <BookOpen size={18} />
            <span>{programKey.toUpperCase()}</span>
          </div>
        ) : null}
        {cohort.startDate ? (
          <div>
            <CalendarDays size={18} />
            <span>{stats.nextSession ? `Next: ${formatDate(stats.nextSession.date)}${stats.nextSession.time ? ` at ${stats.nextSession.time}` : ''}` : 'No upcoming session'}</span>
          </div>
        ) : null}
      </div>

      <div className="program-card__actions" aria-label={`${programTitle} shortcuts`}>
        <Link className="student-action" to="/student/schedule">
          <CalendarDays size={16} />
          Upcoming Workshops
        </Link>
        <Link className="student-action" to="/student/recordings">
          <PlayCircle size={16} />
          Watch Recordings
        </Link>
        <Link className="student-action" to={programLink('/student/resources', cohort)}>
          <Library size={16} />
          Resource Library
        </Link>
        {whatsappLink ? (
          <a className="student-action" href={whatsappLink} rel="noreferrer" target="_blank" title={whatsappLabel}>
            <MessageCircle size={16} />
            WhatsApp Group
          </a>
        ) : (
          <span className="student-action student-action--disabled" title="WhatsApp group link is not available yet.">
            <MessageCircle size={16} />
            WhatsApp Group
          </span>
        )}
      </div>

      {cohort.whatsappGroupName && !whatsappLink ? (
        <span className="program-card__note">WhatsApp group: {cohort.whatsappGroupName}</span>
      ) : null}

      {stats.certificates > 0 ? (
        <Link className="program-card__certificate" to="/student/certificates">
          <Award size={16} />
          {stats.certificates} certificate{stats.certificates === 1 ? '' : 's'}
        </Link>
      ) : null}
    </article>
  );
}

export function StudentCohortsPage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const cohortsQuery = useStudentCohorts({ limit: 100, page });
  const scheduleQuery = useStudentSchedule({ accessType: 'all', limit: 500, page: 1, status: 'all' });
  const recordingsQuery = useStudentRecordings({ accessType: 'all', limit: 500, page: 1 });
  const resourcesQuery = useStudentResources({ accessType: 'all', locked: 'all', limit: 500, page: 1 });
  const certificatesQuery = useStudentCertificates({ limit: 500, page: 1 });
  const data = cohortsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const hasPagination = useMemo(() => Boolean(data && (data.hasPreviousPage || data.hasNextPage || totalPages > 1)), [data, totalPages]);
  const cohorts = data?.items ?? [];
  const programStats = useMemo(() => {
    const schedule = scheduleQuery.data?.items ?? [];
    const recordings = recordingsQuery.data?.items ?? [];
    const resources = resourcesQuery.data?.items ?? [];
    const certificates = certificatesQuery.data?.items ?? [];

    return new Map(
      cohorts.map((cohort) => {
        const cohortSchedule = schedule.filter((item) => itemMatchesProgram(item, cohort));
        const stats: ProgramStats = {
          certificates: certificates.filter((item) => certificateMatchesProgram(item, cohort)).length,
          recordings: recordings.filter((item) => itemMatchesProgram(item, cohort)).length,
          resources: resources.filter((item) => itemMatchesProgram(item, cohort)).length,
          sessions: cohortSchedule.length,
          nextSession: nextSessionFor(cohortSchedule)
        };
        return [cohort.id, stats];
      })
    );
  }, [certificatesQuery.data?.items, cohorts, recordingsQuery.data?.items, resourcesQuery.data?.items, scheduleQuery.data?.items]);

  const summary = useMemo(
    () => ({
      active: cohorts.filter((cohort) => cohort.status === 'active').length,
      certificates: Array.from(programStats.values()).reduce((total, stats) => total + stats.certificates, 0),
      cohorts: cohorts.length,
      upcoming: cohorts.filter((cohort) => cohort.status === 'upcoming').length
    }),
    [cohorts, programStats]
  );

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
    <div className="page-stack student-programs-page">
      <PageHeader
        description="Your enrolled programs, cohort timelines, and the learning modules connected to each program."
        eyebrow="My learning"
        title="My Programs"
      />

      <section className="program-overview" aria-label="Program access summary">
        <article>
          <GraduationCap size={20} />
          <span>Enrolled cohorts</span>
          <strong>{summary.cohorts}</strong>
        </article>
        <article>
          <BookOpen size={20} />
          <span>Active programs</span>
          <strong>{summary.active}</strong>
        </article>
        <article>
          <CalendarDays size={20} />
          <span>Upcoming cohorts</span>
          <strong>{summary.upcoming}</strong>
        </article>
        <article>
          <Award size={20} />
          <span>Certificates</span>
          <strong>{summary.certificates}</strong>
        </article>
      </section>

      {data && cohorts.length > 0 ? (
        <section className="program-card-grid" aria-label="Enrolled programs and cohorts">
          {cohorts.map((cohort) => (
            <ProgramCard cohort={cohort} key={cohort.id} stats={programStats.get(cohort.id) ?? { certificates: 0, recordings: 0, resources: 0, sessions: 0 }} />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      {scheduleQuery.isError || recordingsQuery.isError || resourcesQuery.isError || certificatesQuery.isError ? (
        <StateBlock title="Partial program data">
          Your enrolled programs loaded, but one or more linked module counts could not refresh. Open the module directly if a count looks lower than expected.
        </StateBlock>
      ) : null}

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
