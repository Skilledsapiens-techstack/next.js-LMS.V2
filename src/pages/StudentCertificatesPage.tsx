import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  StudentCertificate,
  useGenerateStudentCertificatePdf,
  useStudentCertificates
} from '../features/student/useStudentCertificates';

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function buildPageLink(page: number) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  return `?${params.toString()}`;
}

function certificateTone(certificate: StudentCertificate) {
  return certificate.status === 'issued' && certificate.generationStatus === 'ready' ? 'safe' : certificate.generationStatus === 'failed' || certificate.generationStatus === 'expired' ? 'warning' : 'neutral';
}

function CertificateCard({
  certificate,
  isPreparing,
  onDownload
}: {
  certificate: StudentCertificate;
  isPreparing: boolean;
  onDownload: (certificate: StudentCertificate) => void;
}) {
  const title = certificate.certificateType === 'live_project' ? certificate.projectTitle : certificate.programName ?? certificate.programKey;
  const shouldShowProjectTitle = certificate.certificateType === 'live_project' && Boolean(certificate.projectTitle);
  const programLabel = certificate.programName ?? certificate.programKey;

  return (
    <article className="certificate-card">
      <div className="certificate-card__body">
        {shouldShowProjectTitle ? <span className="eyebrow">Live Project</span> : null}
        <h2>{title ?? 'Certificate'}</h2>
        <StatusBadge tone={certificateTone(certificate)}>{formatOption(certificate.status)}</StatusBadge>
        {shouldShowProjectTitle && programLabel ? <p>{programLabel}</p> : null}
        <p>
          Certificate ID: <strong>{certificate.certificateId}</strong>
        </p>
        <p>Issued: {formatDate(certificate.issueDate)}</p>
        <button className="segmented-button" disabled={isPreparing} onClick={() => onDownload(certificate)} type="button">
          {isPreparing ? 'Preparing...' : certificate.generationStatus === 'ready' ? 'Download PDF' : 'Generate PDF'}
        </button>
      </div>
    </article>
  );
}

export function StudentCertificatesPage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const certificatesQuery = useStudentCertificates({ page });
  const generateCertificatePdfMutation = useGenerateStudentCertificatePdf();
  const data = certificatesQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const hasPagination = useMemo(() => Boolean(data && (data.hasPreviousPage || data.hasNextPage || totalPages > 1)), [data, totalPages]);

  async function handleDownloadCertificate(certificate: StudentCertificate) {
    const result = await generateCertificatePdfMutation.mutateAsync({
      certificateId: certificate.id,
      force: certificate.generationStatus !== 'ready'
    });
    const firstResult = result.results[0];
    if (firstResult?.signedUrl) {
      window.open(firstResult.signedUrl, '_blank', 'noopener,noreferrer');
    }
  }

  if (certificatesQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading certificates linked to your student profile." eyebrow="Student certificates" title="Certificates" />
        <LoadingState />
      </div>
    );
  }

  if (certificatesQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Certificates could not be loaded right now." eyebrow="Student certificates" title="Certificates unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Verify your issued certificates and track certificate readiness."
        eyebrow="Verified achievements"
        title="My Certificates"
      />

      {data && data.items.length > 0 ? (
        <section className="certificate-card-grid" aria-label="Certificate records">
          {data.items.map((certificate) => (
            <CertificateCard
              certificate={certificate}
              isPreparing={generateCertificatePdfMutation.isPending}
              key={certificate.id}
              onDownload={(item) => void handleDownloadCertificate(item)}
            />
          ))}
        </section>
      ) : (
        <EmptyState />
      )}

      {hasPagination ? (
        <nav className="pagination-bar" aria-label="Certificate pagination">
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
