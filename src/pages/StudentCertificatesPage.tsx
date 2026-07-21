import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentCertificate, useGenerateStudentCertificatePdf, useStudentCertificates } from '../features/student/useStudentCertificates';

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
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
  return certificate.status === 'issued' && certificate.generationStatus === 'ready'
    ? 'safe'
    : certificate.generationStatus === 'failed' || certificate.generationStatus === 'expired'
      ? 'warning'
      : 'neutral';
}

function downloadButtonLabel(certificate: StudentCertificate, isPreparing: boolean) {
  if (isPreparing) return 'Preparing PDF...';
  return 'Download PDF';
}

function certificateReadinessMessage(certificate: StudentCertificate) {
  if (certificate.generationStatus === 'ready') return '';
  if (certificate.generationStatus === 'pending' || certificate.generationStatus === 'generating') {
    return 'Certificate PDF is being prepared. Click Download PDF to prepare a fresh copy if needed.';
  }
  return '';
}

const certificateDownloadFallbackMessage = 'We could not prepare your PDF right now. Please contact your program coordinator at programcoordinator@skilledsapiens.com.';
const certificateDownloadCooldownPrefix = 'A fresh certificate PDF was already generated in the last 24 hours.';

function studentFacingDownloadError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return message.startsWith(certificateDownloadCooldownPrefix) ? message : certificateDownloadFallbackMessage;
}

function filenameSafe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'certificate';
}

async function downloadPdfFromSignedUrl(signedUrl: string, certificateId: string) {
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error('Certificate PDF could not be downloaded right now.');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${filenameSafe(certificateId)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function CertificateCard({
  certificate,
  downloadMessage,
  isDownloadDisabled,
  isPreparing,
  onDownload
}: {
  certificate: StudentCertificate;
  downloadMessage?: { text: string; tone: 'error' | 'info' | 'success' };
  isDownloadDisabled: boolean;
  isPreparing: boolean;
  onDownload: (certificate: StudentCertificate) => void;
}) {
  const title = certificate.certificateType === 'live_project' ? certificate.projectTitle : (certificate.programName ?? certificate.programKey);
  const shouldShowProjectTitle = certificate.certificateType === 'live_project' && Boolean(certificate.projectTitle);
  const programLabel = certificate.programName ?? certificate.programKey;
  const readinessMessage = certificateReadinessMessage(certificate);

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
        <button className={`segmented-button ${isPreparing ? 'segmented-button--loading' : ''}`} disabled={isDownloadDisabled} onClick={() => onDownload(certificate)} type="button">
          {downloadButtonLabel(certificate, isPreparing)}
        </button>
        {readinessMessage ? <p className="certificate-card__message certificate-card__message--info">{readinessMessage}</p> : null}
        {downloadMessage ? <p className={`certificate-card__message certificate-card__message--${downloadMessage.tone}`}>{downloadMessage.text}</p> : null}
      </div>
    </article>
  );
}

export function StudentCertificatesPage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const certificatesQuery = useStudentCertificates({ page });
  const generateCertificatePdfMutation = useGenerateStudentCertificatePdf();
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [downloadMessages, setDownloadMessages] = useState<Record<string, { text: string; tone: 'error' | 'info' | 'success' }>>({});
  const data = certificatesQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const hasPagination = useMemo(() => Boolean(data && (data.hasPreviousPage || data.hasNextPage || totalPages > 1)), [data, totalPages]);

  async function handleDownloadCertificate(certificate: StudentCertificate) {
    setActiveDownloadId(certificate.id);
    setDownloadMessages((current) => {
      const next = { ...current };
      delete next[certificate.id];
      return next;
    });

    try {
      const result = await generateCertificatePdfMutation.mutateAsync({
        certificateId: certificate.id,
        force: false
      });
      const firstResult = result.results[0];

      if (firstResult?.status === 'failed') {
        throw new Error(firstResult.error ?? certificateDownloadFallbackMessage);
      }

      if (!firstResult?.signedUrl) {
        throw new Error(certificateDownloadFallbackMessage);
      }

      await downloadPdfFromSignedUrl(firstResult.signedUrl, firstResult.certificateId ?? certificate.certificateId);
      setDownloadMessages((current) => ({
        ...current,
        [certificate.id]: { text: 'Download started.', tone: 'success' }
      }));
    } catch (error) {
      setDownloadMessages((current) => ({
        ...current,
        [certificate.id]: {
          text: studentFacingDownloadError(error),
          tone: 'error'
        }
      }));
    } finally {
      setActiveDownloadId(null);
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
      <PageHeader description="Verify your issued certificates and track certificate readiness." eyebrow="Verified achievements" title="My Certificates" />

      {data && data.items.length > 0 ? (
        <section className="certificate-card-grid" aria-label="Certificate records">
          {data.items.map((certificate) => (
            <CertificateCard
              certificate={certificate}
              downloadMessage={downloadMessages[certificate.id]}
              isDownloadDisabled={Boolean(activeDownloadId)}
              isPreparing={activeDownloadId === certificate.id}
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
