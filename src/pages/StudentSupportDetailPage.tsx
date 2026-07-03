import { ArrowLeft, Clock3, MessageSquareText, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { StudentSupportTicket, useCreateStudentSupportTicketReply, useStudentSupportTicketDetail } from '../features/student/useStudentSupportTickets';

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
  const replyMutation = useCreateStudentSupportTicketReply();
  const data = ticketQuery.data;
  const [replyBody, setReplyBody] = useState('');
  const [replyMessage, setReplyMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const canReply =
    Boolean(data?.ticket.canReply ?? data?.ticket.conversationMode === 'two_way') && data?.ticket.status !== 'closed' && data?.ticket.status !== 'resolved';

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticketId) return;
    setReplyMessage(null);

    try {
      await replyMutation.mutateAsync({ body: replyBody, ticketId });
      setReplyBody('');
      setReplyMessage({ tone: 'success', text: 'Reply sent successfully.' });
    } catch (error) {
      setReplyMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Reply could not be sent.' });
    }
  }

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

      <section className="data-panel">
        <div className="data-panel__header">
          <div>
            <h2>Reply to support</h2>
            <p>{canReply ? 'Add extra context when the support team asks for details.' : 'This ticket is closed or read-only.'}</p>
          </div>
        </div>
        <form className="support-query-form" onSubmit={handleReplySubmit}>
          <label>
            <span>Message *</span>
            <textarea
              disabled={!canReply || replyMutation.isPending}
              maxLength={2000}
              onChange={(event) => setReplyBody(event.target.value)}
              placeholder="Type your reply for the support team."
              rows={5}
              value={replyBody}
            />
          </label>
          {replyMessage ? <div className={replyMessage.tone === 'success' ? 'auth-alert auth-alert--success' : 'auth-alert auth-alert--error'}>{replyMessage.text}</div> : null}
          <button className="student-action student-action--primary support-submit" disabled={!canReply || replyMutation.isPending} type="submit">
            {replyMutation.isPending ? <RefreshCw size={17} /> : <Send size={17} />}
            {replyMutation.isPending ? 'Sending reply...' : 'Send reply'}
          </button>
        </form>
      </section>
    </div>
  );
}
