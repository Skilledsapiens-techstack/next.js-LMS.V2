import { BookOpenCheck, HelpCircle, LifeBuoy, Mail, MessageSquareText, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  StudentSupportTicket,
  StudentSupportCategory,
  StudentSupportFaq,
  StudentSupportTicketStatus,
  useCreateStudentSupportTicket,
  useStudentSupportCategories,
  useStudentSupportFaqs,
  useStudentSupportSettings,
  useStudentSupportTickets
} from '../features/student/useStudentSupportTickets';

const priorityOptions = [
  { label: 'Normal', value: 'normal' },
  { label: 'Urgent', value: 'urgent' }
] as const;

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

function supportHint(categoryName: string | undefined) {
  const normalized = categoryName?.toLowerCase() ?? '';
  if (normalized.includes('recording')) return 'Mention recording title, session date, and what is missing or not opening.';
  if (normalized.includes('resource')) return 'Mention resource name, program/cohort, and whether the link is locked or not opening.';
  if (normalized.includes('schedule') || normalized.includes('workshop')) return 'Mention workshop title, date, and the join/link issue.';
  if (normalized.includes('project')) return 'Mention project title, role, cohort, and the exact submission concern.';
  if (normalized.includes('certificate')) return 'Mention certificate type, program/cohort, and correction needed.';
  if (normalized.includes('payment')) return 'Mention payment date, amount, and payment reference if available.';
  return 'Mention the module name, program/cohort, and the exact help you need.';
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

function SupportFaqs({ faqs, isLoading }: { faqs: StudentSupportFaq[]; isLoading: boolean }) {
  if (isLoading) return <LoadingState />;

  return (
    <section className="support-faq-list" aria-label="Program FAQs">
      {faqs.length > 0 ? (
        faqs.map((item) => (
          <details className={item.featured ? 'support-faq-item support-faq-item--featured' : 'support-faq-item'} key={item.id}>
            <summary>
              <BookOpenCheck size={17} />
              <span>{item.question}</span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))
      ) : (
        <article className="support-info-card support-info-card--wide">
          <BookOpenCheck size={22} />
          <div>
            <h2>No FAQs published yet</h2>
            <p>Published FAQs mapped to your programs and cohorts will appear here.</p>
          </div>
        </article>
      )}
    </section>
  );
}

function SupportContactCard() {
  const settingsQuery = useStudentSupportSettings();
  const settings = settingsQuery.data;
  const supportEmail = settings?.supportEmail.trim() ?? '';
  const contactTitle = settings?.supportContactTitle.trim() || 'Need help from the support team?';
  const contactNote = settings?.supportContactNote.trim() || 'Email us with your registered LMS email, module name, and the issue you are facing.';

  if (!supportEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) return null;

  return (
    <section className="support-contact-card" aria-label="Support contact email">
      <div className="support-contact-card__icon">
        <Mail size={20} />
      </div>
      <div className="support-contact-card__copy">
        <span className="eyebrow">Direct support</span>
        <h2>{contactTitle}</h2>
        <p>{contactNote}</p>
        <strong>{supportEmail}</strong>
      </div>
      <a className="student-action student-action--secondary support-contact-card__action" href={`mailto:${supportEmail}`}>
        <Mail size={16} />
        Email support
      </a>
    </section>
  );
}

function RaiseQueryForm({ categories }: { categories: StudentSupportCategory[] }) {
  const createTicketMutation = useCreateStudentSupportTicket();
  const firstCategory = categories[0]?.categoryName ?? '';
  const [categoryName, setCategoryName] = useState(firstCategory);
  const [createdTicket, setCreatedTicket] = useState<StudentSupportTicket | null>(null);
  const [description, setDescription] = useState('');
  const [formMessage, setFormMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [relatedUrl, setRelatedUrl] = useState('');
  const [subject, setSubject] = useState('');
  const selectedCategory = categories.find((item) => item.categoryName === categoryName);

  useEffect(() => {
    if (!categoryName && firstCategory) setCategoryName(firstCategory);
  }, [categoryName, firstCategory]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);

    try {
      const result = await createTicketMutation.mutateAsync({
        categoryName,
        description,
        priority,
        relatedUrl: relatedUrl.trim() || undefined,
        subject
      });
      setCreatedTicket(result.ticket);
      setDescription('');
      setPriority('normal');
      setRelatedUrl('');
      setSubject('');
      setFormMessage({ tone: 'success', text: `Query submitted. Ticket ${result.ticket.ticketId ?? result.ticket.id} is now visible in your recent queries.` });
    } catch (error) {
      setCreatedTicket(null);
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Support ticket could not be created.' });
    }
  }

  return (
    <form className="support-query-form" onSubmit={handleSubmit}>
      <div className="support-note">
        <ShieldCheck size={18} />
        <p>Share only LMS issue details. Do not include passwords, OTPs, card details, or private account access information.</p>
      </div>

      <div className="support-form-grid">
        <label>
          <span>Category *</span>
          <select disabled={categories.length === 0} required value={categoryName} onChange={(event) => setCategoryName(event.target.value)}>
            {categories.map((option) => (
              <option key={option.id} value={option.categoryName}>
                {option.categoryName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as 'normal' | 'urgent')}>
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>Subject *</span>
        <input maxLength={120} onChange={(event) => setSubject(event.target.value)} placeholder="Example: Recording link is not opening" required type="text" value={subject} />
      </label>

      <label>
        <span>Description *</span>
        <textarea
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={supportHint(categoryName)}
          required
          rows={6}
          value={description}
        />
      </label>

      <label>
        <span>Related link, if any</span>
        <input onChange={(event) => setRelatedUrl(event.target.value)} placeholder="Optional LMS, Zoom, resource, or certificate link" type="url" value={relatedUrl} />
      </label>

      {formMessage ? (
        <div className={formMessage.tone === 'success' ? 'auth-alert auth-alert--success support-success-alert' : 'auth-alert auth-alert--error'}>
          <span>{formMessage.text}</span>
          {createdTicket ? (
            <Link to={`/student/support/${createdTicket.id}`}>
              View ticket
            </Link>
          ) : null}
        </div>
      ) : null}

      {selectedCategory?.conversationMode === 'admin_only' ? <p className="support-form-note">This category is handled by the admin team as a managed request.</p> : null}

      <button className="student-action student-action--primary support-submit" disabled={createTicketMutation.isPending || categories.length === 0 || !categoryName} type="submit">
        {createTicketMutation.isPending ? <RefreshCw size={17} /> : <Send size={17} />}
        {createTicketMutation.isPending ? 'Submitting query...' : 'Submit query'}
      </button>
    </form>
  );
}

export function StudentSupportPage() {
  const [searchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const categoriesQuery = useStudentSupportCategories();
  const faqsQuery = useStudentSupportFaqs();
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
        description="Raise a query, track replies, and find quick help for your LMS account."
        eyebrow="Student help desk"
        title="Support"
      />
      <SupportContactCard />

      <section className="support-desk-grid" aria-label="Support desk">
        <article className="support-panel support-panel--primary">
          <div className="support-panel__header">
            <LifeBuoy size={22} />
            <div>
              <h2>Raise a query</h2>
              <p>Tell us what is not working. Keep it short, clear, and include the module or item name where possible.</p>
            </div>
          </div>
          <RaiseQueryForm categories={categoriesQuery.data?.items ?? []} />
        </article>

        <aside className="support-panel support-ticket-panel">
          <div className="support-panel__header">
            <MessageSquareText size={22} />
            <div>
              <h2>Recent queries</h2>
              <p>
                {visibleTickets.length > 0
                  ? `${visibleTickets.length} recent quer${visibleTickets.length === 1 ? 'y' : 'ies'}, ${openCount} active on this page.`
                  : 'Your query history and replies will appear here.'}
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
                <h2>No queries yet</h2>
                <p>Submit a query and it will appear here for tracking.</p>
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

      <section className="support-help-section" aria-label="Support guidance">
        <div>
          <span className="eyebrow">Quick help</span>
          <h2>Before you submit</h2>
        </div>
        <SupportGuide />
      </section>

      <section className="support-help-section" aria-label="Program FAQs">
        <div>
          <span className="eyebrow">Guidance</span>
          <h2>Frequently asked questions</h2>
        </div>
        <SupportFaqs faqs={faqsQuery.data?.items ?? []} isLoading={faqsQuery.isLoading} />
      </section>
    </div>
  );
}
