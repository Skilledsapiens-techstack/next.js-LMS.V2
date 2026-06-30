import { BookOpenCheck, FileText, HelpCircle, LifeBuoy, MessageSquareText, Paperclip, Send, ShieldCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StudentSupportTicket, StudentSupportTicketStatus, useStudentSupportTickets } from '../features/student/useStudentSupportTickets';

type SupportTab = 'guide' | 'faqs' | 'query' | 'project';

const tabs: Array<{ id: SupportTab; label: string }> = [
  { id: 'guide', label: 'How to use this Portal' },
  { id: 'faqs', label: 'Program FAQs' },
  { id: 'query', label: 'Raise Query' },
  { id: 'project', label: 'Live Project Support Data' }
];

const categoryOptions = ['Login / Access', 'Resources', 'Recordings', 'Schedule / Workshop', 'Live Project', 'Certificate', 'Payments', 'Other'];
const priorityOptions = ['Normal', 'Urgent'];

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
    return 'Not available';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function statusTone(status: StudentSupportTicketStatus) {
  if (status === 'resolved' || status === 'closed') return 'safe';
  if (status === 'waiting_for_student') return 'warning';
  return 'neutral';
}

function TicketCard({ ticket }: { ticket: StudentSupportTicket }) {
  return (
    <article className="support-ticket-card">
      <div className="support-ticket-card__body">
        <div className="support-ticket-card__header">
          <span className="eyebrow">{ticket.categoryName}</span>
          <StatusBadge tone={statusTone(ticket.status)}>{formatOption(ticket.status)}</StatusBadge>
        </div>
        <h2>{ticket.subject}</h2>
        <p>{ticket.ticketId ?? ticket.id}</p>
        <div className="support-ticket-card__meta">
          <span>{formatOption(ticket.priority)} priority</span>
          <span>Last update {formatDate(ticket.lastMessageAt ?? ticket.updatedAt ?? ticket.createdAt)}</span>
        </div>
      </div>
      <Link className="student-action student-action--secondary" to={`/student/support/${ticket.id}`}>
        <MessageSquareText size={16} />
        View conversation
      </Link>
    </article>
  );
}

function SupportGuide() {
  const guideItems = [
    {
      title: 'Use the right category',
      description: 'Choose the area closest to your issue so the support team can route it faster.'
    },
    {
      title: 'Share exact context',
      description: 'Mention the program, cohort, recording, resource, project, or certificate name where relevant.'
    },
    {
      title: 'Avoid private credentials',
      description: 'Do not share passwords, OTPs, payment card details, or private account access information.'
    }
  ];

  return (
    <section className="support-info-grid" aria-label="Portal support guide">
      {guideItems.map((item) => (
        <article className="support-info-card" key={item.title}>
          <HelpCircle size={22} />
          <div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function SupportFaqs() {
  const faqs = [
    {
      title: 'Program access',
      description: 'If a program or cohort is missing, raise a query with your registered email and cohort name.'
    },
    {
      title: 'Recordings and resources',
      description: 'Access is based on your active program and cohort entitlement.'
    },
    {
      title: 'Certificates',
      description: 'Certificate actions will appear only when the certificate workflow is ready for your account.'
    }
  ];

  return (
    <section className="support-info-grid" aria-label="Program FAQs">
      {faqs.map((item) => (
        <article className="support-info-card" key={item.title}>
          <BookOpenCheck size={22} />
          <div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function LiveProjectSupportData() {
  return (
    <section className="support-info-grid" aria-label="Live project support data">
      <article className="support-info-card support-info-card--wide">
        <FileText size={22} />
        <div>
          <h2>Live project help</h2>
          <p>For project support, include the project title, role, expected deliverable, and the exact submission concern.</p>
        </div>
      </article>
      <article className="support-info-card support-info-card--wide">
        <ShieldCheck size={22} />
        <div>
          <h2>Submission checks</h2>
          <p>Keep final files clean, named clearly, and aligned to the project instructions before submitting.</p>
        </div>
      </article>
    </section>
  );
}

function RaiseQueryForm() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className="support-query-form" onSubmit={handleSubmit}>
      <div className="support-note">
        <Paperclip size={18} />
        <p>Attachment limit: one file only, maximum 1 MB. Supported: PNG, JPG, WebP, PDF, or TXT.</p>
      </div>

      <div className="support-form-grid">
        <label>
          <span>Category *</span>
          <select defaultValue={categoryOptions[0]}>
            {categoryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Priority *</span>
          <select defaultValue={priorityOptions[0]}>
            {priorityOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>Subject *</span>
        <input maxLength={120} placeholder="Short summary of the issue" type="text" />
      </label>

      <label>
        <span>Description *</span>
        <textarea maxLength={2000} placeholder="Explain what happened, where it happened, and what help you need." rows={7} />
      </label>

      <label>
        <span>Related module / item link</span>
        <input placeholder="Optional URL from LMS, Zoom, resource, or certificate page" type="url" />
      </label>

      <label>
        <span>Attachment</span>
        <input accept=".png,.jpg,.jpeg,.webp,.pdf,.txt" type="file" />
      </label>

      <button className="student-action student-action--primary support-submit" disabled type="submit">
        <Send size={17} />
        Create Support Ticket
      </button>
      <p className="support-form-note">Ticket submission will be enabled after support workflow controls are completed.</p>
    </form>
  );
}

export function StudentSupportPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<SupportTab>('query');
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const ticketsQuery = useStudentSupportTickets({ limit: 8, page, status: 'all' });
  const data = ticketsQuery.data;
  const totalPages = data?.totalPages ?? 1;
  const visibleTickets = data?.items ?? [];
  const openCount = useMemo(() => visibleTickets.filter((item) => item.status === 'open' || item.status === 'in_review' || item.status === 'waiting_for_student').length, [visibleTickets]);

  if (ticketsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading your support area." eyebrow="Student help desk" title="Support" />
        <LoadingState />
      </div>
    );
  }

  if (ticketsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Your support area could not be loaded right now." eyebrow="Student help desk" title="Support unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack support-page">
      <PageHeader
        description="Portal guidance, program FAQs, query submission, and live project support data in one place."
        eyebrow="Student help desk"
        title="Support & Guidelines"
      />

      <section className="support-tabs" aria-label="Support sections">
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? 'support-tab support-tab--active' : 'support-tab'} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === 'guide' ? <SupportGuide /> : null}
      {activeTab === 'faqs' ? <SupportFaqs /> : null}
      {activeTab === 'project' ? <LiveProjectSupportData /> : null}

      {activeTab === 'query' ? (
        <section className="support-desk-grid" aria-label="Support desk">
          <article className="support-panel">
            <div className="support-panel__header">
              <LifeBuoy size={22} />
              <div>
                <h2>Raise a Student Query</h2>
                <p>Create a support ticket for access issues, resources, recordings, schedules, projects, certificates, payments, or other LMS help.</p>
              </div>
            </div>
            <RaiseQueryForm />
          </article>

          <aside className="support-panel support-ticket-panel">
            <div className="support-panel__header">
              <MessageSquareText size={22} />
              <div>
                <h2>My Support Tickets</h2>
                <p>
                  {visibleTickets.length > 0
                    ? `${visibleTickets.length} ticket${visibleTickets.length === 1 ? '' : 's'} shown, ${openCount} active on this page.`
                    : 'Track ticket status and continue conversations when replies are available.'}
                </p>
              </div>
            </div>

            {visibleTickets.length > 0 ? (
              <div className="support-ticket-list">
                {visibleTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            ) : (
              <div className="support-empty-state">
                <MessageSquareText size={24} />
                <div>
                  <h2>No support tickets yet</h2>
                  <p>Your support ticket history will appear here.</p>
                </div>
              </div>
            )}

            {data && totalPages > 1 ? (
              <nav className="pagination-bar" aria-label="Support pagination">
                {data.hasPreviousPage ? (
                  <Link className="pagination-link" to={buildPageLink(page - 1)}>
                    Previous page
                  </Link>
                ) : (
                  <span className="pagination-link pagination-link--disabled">Previous page</span>
                )}
                <span>
                  Page {page} of {totalPages}
                </span>
                {data.hasNextPage ? (
                  <Link className="pagination-link" to={buildPageLink(page + 1)}>
                    Next page
                  </Link>
                ) : (
                  <span className="pagination-link pagination-link--disabled">Next page</span>
                )}
              </nav>
            ) : null}
          </aside>
        </section>
      ) : null}

      <section className="support-conversation-panel">
        <MessageSquareText size={22} />
        <div>
          <h2>Ticket Conversation</h2>
          <p>Select a support ticket to view messages.</p>
        </div>
      </section>
    </div>
  );
}
