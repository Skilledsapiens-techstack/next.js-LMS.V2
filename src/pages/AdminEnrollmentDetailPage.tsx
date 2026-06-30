import { ClipboardCheck, ShieldCheck, Ticket } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { AdminEnrollmentRequestItem, AdminEnrollmentStatusHistory, useAdminEnrollmentRequestDetail } from '../features/admin/useAdminEnrollments';

function formatDateTime(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

const itemColumns: DataColumn<AdminEnrollmentRequestItem>[] = [
  {
    header: 'Item',
    key: 'item',
    render: (item) => (
      <div className="announcement-title-cell">
        <strong>{item.itemName}</strong>
        <p>{item.itemId}</p>
        <div className="chip-row">
          <StatusBadge>{item.itemType}</StatusBadge>
          <StatusBadge>{formatOption(item.status)}</StatusBadge>
          {item.programKey ? <StatusBadge>{item.programKey}</StatusBadge> : null}
          {item.roleId ? <StatusBadge>{item.roleId}</StatusBadge> : null}
        </div>
      </div>
    )
  },
  {
    header: 'Cohort',
    key: 'cohort',
    render: (item) => item.assignedCohortName ?? item.assignedCohortId ?? 'Not assigned'
  },
  {
    header: 'Mapping',
    key: 'mapping',
    render: (item) => (
      <div className="stacked-cell">
        <span>{item.aliasSource ?? 'No alias source'}</span>
        <span>{item.mappingConfidence === undefined ? 'No confidence' : `${Math.round(item.mappingConfidence * 100)}%`}</span>
      </div>
    )
  },
  {
    header: 'Activated',
    key: 'activated',
    render: (item) => formatDateTime(item.activatedAt)
  }
];

const historyColumns: DataColumn<AdminEnrollmentStatusHistory>[] = [
  {
    header: 'Change',
    key: 'change',
    render: (item) => (
      <div className="announcement-title-cell">
        <strong>{formatOption(item.newStatus)}</strong>
        <p>{item.previousStatus ? `${formatOption(item.previousStatus)} -> ${formatOption(item.newStatus)}` : 'Initial status'}</p>
      </div>
    )
  },
  {
    header: 'Actor',
    key: 'actor',
    render: (item) => item.actorEmail ?? item.changedBy ?? 'System'
  },
  {
    header: 'Reason',
    key: 'reason',
    render: (item) => item.reason ?? item.notes ?? item.fieldName ?? 'No note'
  },
  {
    header: 'Created',
    key: 'created',
    render: (item) => formatDateTime(item.createdAt)
  }
];

export function AdminEnrollmentDetailPage() {
  const { requestId } = useParams();
  const detailQuery = useAdminEnrollmentRequestDetail(requestId);
  const detail = detailQuery.data;

  if (detailQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading enrollment request detail." eyebrow="Admin enrollment" title="Enrollment detail" />
        <LoadingState />
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="page-stack">
        <PageHeader description="Enrollment request detail could not be loaded from the Supabase." eyebrow="Admin enrollment" title="Enrollment unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader description="Review bounded enrollment items and status history without raw payload blobs or activation controls." eyebrow="Admin enrollment" title={detail.request.requestId} />

      <div className="metric-grid">
        <article className="metric-tile">
          <Ticket size={22} />
          <span>Status</span>
          <strong>{formatOption(detail.request.paymentStatus)}</strong>
        </article>
        <article className="metric-tile">
          <ClipboardCheck size={22} />
          <span>Items shown</span>
          <strong>{detail.items.length}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>History shown</span>
          <strong>{detail.history.length}</strong>
        </article>
      </div>

      <section className="detail-panel">
        <Link className="inline-link" to="/admin/enrollments">Back to enrollments</Link>
        <div className="detail-grid">
          <span>Student</span>
          <strong>{detail.request.studentName ?? detail.request.email ?? 'Not mapped'}</strong>
          <span>Email</span>
          <strong>{detail.request.email ?? 'Not set'}</strong>
          <span>Payment</span>
          <strong>{detail.request.paymentId ?? detail.request.orderId ?? 'No payment ref'}</strong>
          <span>Activated</span>
          <strong>{formatDateTime(detail.request.activatedAt)}</strong>
        </div>
      </section>

      <DataPanel columns={itemColumns} description={`Items are bounded to ${detail.itemLimit}. Assignment and activation controls are not exposed.`} items={detail.items} title="Enrollment items" />
      <DataPanel columns={historyColumns} description={`History is bounded to ${detail.historyLimit}. Raw payload and status-write controls are not exposed.`} items={detail.history} title="Status history" />

      <StateBlock title="Read-only enrollment detail">
        Activation, cohort assignment, status changes, exception resolution, raw payload inspection, and payment reconciliation remain disabled in Phase 5.
      </StateBlock>
    </div>
  );
}
