import { ArrowLeft, Clock3, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentSupportTicket, useStudentSupportTicketDetail } from '../features/student/useStudentSupportTickets';

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function renderTicketMeta(ticket: StudentSupportTicket) {
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
        <strong>{formatDate(ticket.lastMessageAt ?? ticket.updatedAt)}</strong>
      </article>
    </div>
  );
}

export function StudentSupportDetailPage() {
  const { ticketId } = useParams();
  const ticketQuery = useStudentSupportTicketDetail(ticketId);
  const data = ticketQuery.data;

  if (ticketQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading support ticket thread." eyebrow="Student support" title="Support ticket" />
        <LoadingState />
      </div>
    );
  }

  if (ticketQuery.isError || !data) {
    return (
      <div className="page-stack">
        <PageHeader
          actions={
            <Link className="pagination-link" to="/student/support">
              <ArrowLeft size={14} />
              Back to support
            </Link>
          }
          description="This ticket could not be loaded from the Supabase."
          eyebrow="Student support"
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
          <Link className="pagination-link" to="/student/support">
            <ArrowLeft size={14} />
            Back to support
          </Link>
        }
        description={`${data.ticket.categoryName} - ${data.ticket.ticketId ?? data.ticket.id}`}
        eyebrow="Student support"
        title={data.ticket.subject}
      />

      {renderTicketMeta(data.ticket)}

      <section className="data-panel">
        <div className="data-panel__header">
          <div>
            <h2>Public thread</h2>
            <p>Only public student/admin/system messages returned by Supabase are shown.</p>
          </div>
          <div className="chip-row">
            <StatusBadge>{formatOption(data.ticket.conversationMode)}</StatusBadge>
            <StatusBadge>{data.ticket.canReply ? 'replyable later' : 'read-only'}</StatusBadge>
          </div>
        </div>
        <div className="timeline-list">
          {data.messages.map((message) => (
            <article className="timeline-item" key={message.id}>
              <div className="timeline-item__header">
                <strong>{message.authorName ?? formatOption(message.authorRole)}</strong>
                <span>{formatDate(message.createdAt)}</span>
              </div>
              <p>{message.body}</p>
              <StatusBadge>{formatOption(message.authorRole)}</StatusBadge>
            </article>
          ))}
          {data.messages.length === 0 ? <p className="muted-text">No public messages are available for this ticket.</p> : null}
        </div>
      </section>

      {data.hasMoreMessages ? <StateBlock title="Thread capped">Only the latest allowed message window is shown in this read-only view.</StateBlock> : null}

      <StateBlock title="Read-only support detail">
        Reply, attachment, escalation, status update, and internal note workflows stay disabled until controlled write enablement.
      </StateBlock>
    </div>
  );
}
