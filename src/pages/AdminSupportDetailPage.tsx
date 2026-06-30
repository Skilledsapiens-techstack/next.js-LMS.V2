import { ArrowLeft, Clock3, MessageSquareText, ShieldCheck, UserCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { AdminSupportTicket, useAdminSupportTicketDetail } from '../features/admin/useAdminSupportTickets';

function formatDateTime(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function statusTone(status: AdminSupportTicket['status']) {
  if (status === 'resolved' || status === 'closed') return 'safe';
  if (status === 'waiting_for_student') return 'warning';
  return 'neutral';
}

function priorityTone(priority: AdminSupportTicket['priority']) {
  if (priority === 'urgent' || priority === 'high') return 'warning';
  return 'neutral';
}

function renderTicketMeta(ticket: AdminSupportTicket) {
  return (
    <div className="metric-grid">
      <article className="metric-tile">
        <MessageSquareText size={22} />
        <span>Status</span>
        <strong>{formatOption(ticket.status)}</strong>
      </article>
      <article className="metric-tile">
        <ShieldCheck size={22} />
        <span>Priority</span>
        <strong>{formatOption(ticket.priority)}</strong>
      </article>
      <article className="metric-tile">
        <Clock3 size={22} />
        <span>Last message</span>
        <strong>{formatDateTime(ticket.lastMessageAt ?? ticket.updatedAt)}</strong>
      </article>
      <article className="metric-tile">
        <UserCheck size={22} />
        <span>Owner</span>
        <strong>{ticket.assignedAdminEmail ?? 'Unassigned'}</strong>
      </article>
    </div>
  );
}

export function AdminSupportDetailPage() {
  const { ticketId } = useParams();
  const ticketQuery = useAdminSupportTicketDetail(ticketId);
  const data = ticketQuery.data;

  if (ticketQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading support ticket thread." eyebrow="Admin support" title="Support ticket" />
        <LoadingState />
      </div>
    );
  }

  if (ticketQuery.isError || !data) {
    return (
      <div className="page-stack">
        <PageHeader
          actions={
            <Link className="pagination-link" to="/admin/support">
              <ArrowLeft size={14} />
              Back to support
            </Link>
          }
          description="This support ticket could not be loaded from the Supabase."
          eyebrow="Admin support"
          title="Support ticket unavailable"
        />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        actions={
          <Link className="pagination-link" to="/admin/support">
            <ArrowLeft size={14} />
            Back to support
          </Link>
        }
        description={`${data.ticket.studentEmail} - ${data.ticket.ticketId ?? data.ticket.id}`}
        eyebrow="Admin support"
        title={data.ticket.subject}
      />

      {renderTicketMeta(data.ticket)}

      <section className="detail-panel">
        <div className="detail-grid">
          <span>Student</span>
          <strong>{data.ticket.studentName ?? data.ticket.studentEmail}</strong>
          <span>Email</span>
          <strong>{data.ticket.studentEmail}</strong>
          <span>Category</span>
          <strong>{data.ticket.categoryName}</strong>
          <span>SLA due</span>
          <strong>{formatDateTime(data.ticket.slaDueAt)}</strong>
          <span>Student reply</span>
          <strong>{formatDateTime(data.ticket.lastStudentReplyAt)}</strong>
          <span>Admin reply</span>
          <strong>{formatDateTime(data.ticket.lastAdminReplyAt)}</strong>
        </div>
        <div className="chip-row">
          <StatusBadge tone={statusTone(data.ticket.status)}>{formatOption(data.ticket.status)}</StatusBadge>
          <StatusBadge tone={priorityTone(data.ticket.priority)}>{formatOption(data.ticket.priority)}</StatusBadge>
          <StatusBadge>{formatOption(data.ticket.conversationMode)}</StatusBadge>
        </div>
      </section>

      <section className="data-panel">
        <div className="data-panel__header">
          <div>
            <h2>Ticket thread</h2>
            <p>Messages are bounded by Supabase and marked with public/internal visibility for admin review.</p>
          </div>
          <div className="chip-row">
            <StatusBadge>{`${data.messages.length} shown`}</StatusBadge>
            <StatusBadge>{`limit ${data.messageLimit}`}</StatusBadge>
          </div>
        </div>
        <div className="timeline-list">
          {data.messages.map((message) => (
            <article className="timeline-item" key={message.id}>
              <div className="timeline-item__header">
                <strong>{message.authorName ?? message.authorEmail}</strong>
                <span>{formatDateTime(message.createdAt)}</span>
              </div>
              <p>{message.body}</p>
              <div className="chip-row">
                <StatusBadge>{formatOption(message.authorRole)}</StatusBadge>
                <StatusBadge>{formatOption(message.visibility)}</StatusBadge>
              </div>
            </article>
          ))}
          {data.messages.length === 0 ? <p className="muted-text">No messages are available for this ticket.</p> : null}
        </div>
      </section>

      {data.hasMoreMessages ? <StateBlock title="Thread capped">Only the bounded message window returned by Supabase is shown in this read-only view.</StateBlock> : null}

      <StateBlock title="Read-only support detail">
        Reply, assignment, escalation, internal note, attachment, status transition, close, and reopen workflows stay disabled until controlled write enablement.
      </StateBlock>
    </div>
  );
}
