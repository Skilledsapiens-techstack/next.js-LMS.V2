import { Info, RefreshCw } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminSupportTicket,
  AdminSupportTicketPriority,
  AdminSupportTicketStatus,
  useAdminSupportTicketDetail,
  useAdminSupportTickets
} from '../features/admin/useAdminSupportTickets';

const statusOptions: Array<AdminSupportTicketStatus | 'all'> = ['all', 'open', 'in_review', 'waiting_for_student', 'resolved', 'closed'];
const priorityOptions: Array<AdminSupportTicketPriority | 'all'> = ['all', 'low', 'normal', 'high', 'urgent'];
const fallbackCategories = ['Login / Access', 'Resources', 'Recordings', 'Projects', 'Certificates'];
const faqCategories = [
  { category: 'Portal Access', sort: 10, status: 'Active' },
  { category: 'Recordings', sort: 20, status: 'Active' },
  { category: 'Resources', sort: 30, status: 'Active' }
];
const faqs = [
  {
    answer: 'TestTestTestTestTestTestTestTestTestTestTestTestTestTestTestTestTest',
    category: 'Portal Access',
    cohorts: '',
    featured: false,
    programKeys: '',
    question: 'Test',
    sort: 10,
    status: 'Published'
  },
  {
    answer: 'Test 2Test 2Test 2Test 2Test 2Test 2',
    category: 'Recordings',
    cohorts: '',
    featured: true,
    programKeys: '',
    question: 'Test 2',
    sort: 20,
    status: 'Published'
  }
];

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function formatOption(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDate(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function formatDateTime(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });
}

function statusTone(status: AdminSupportTicketStatus) {
  if (status === 'resolved' || status === 'closed') return 'safe';
  if (status === 'waiting_for_student') return 'warning';
  return 'neutral';
}

function priorityTone(priority: AdminSupportTicketPriority) {
  if (priority === 'urgent' || priority === 'high') return 'danger';
  return 'neutral';
}

function parseStatus(value: string | null): AdminSupportTicketStatus | 'all' {
  return statusOptions.includes(value as AdminSupportTicketStatus | 'all') ? (value as AdminSupportTicketStatus | 'all') : 'all';
}

function parsePriority(value: string | null): AdminSupportTicketPriority | 'all' {
  return priorityOptions.includes(value as AdminSupportTicketPriority | 'all') ? (value as AdminSupportTicketPriority | 'all') : 'all';
}

function buildPageLink(page: number, search: string, status: AdminSupportTicketStatus | 'all', priority: AdminSupportTicketPriority | 'all', category: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (priority !== 'all') params.set('priority', priority);
  if (category) params.set('category', category);
  return `?${params.toString()}`;
}

export function AdminSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const priority = parsePriority(searchParams.get('priority'));
  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search')?.trim() ?? '';
  const category = searchParams.get('category')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const ticketsQuery = useAdminSupportTickets({ category, page, priority, search, status });
  const data = ticketsQuery.data;
  const selectedTicket = useMemo(() => data?.items.find((ticket) => ticket.id === selectedTicketId) ?? data?.items[0], [data?.items, selectedTicketId]);
  const ticketDetailQuery = useAdminSupportTicketDetail(selectedTicket?.id);

  useEffect(() => {
    if (!selectedTicketId && data?.items[0]) {
      setSelectedTicketId(data.items[0].id);
    }
  }, [data?.items, selectedTicketId]);

  function setFilter(key: 'category' | 'priority' | 'status', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    if (searchInput.trim()) next.set('search', searchInput.trim());
    else next.delete('search');
    setSearchParams(next);
  }

  if (ticketsQuery.isLoading) {
    return (
      <div className="admin-support-page">
        <LoadingState />
      </div>
    );
  }

  if (ticketsQuery.isError) {
    return (
      <div className="admin-support-page">
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="admin-support-page">
      <header className="admin-support-heading">
        <div>
          <span className="section-eyebrow">Module Refresh</span>
          <div className="admin-support-title-row">
            <h1>Support</h1>
            <span>Last Refresh: 28 Jun 2026, 02:58 pm</span>
          </div>
          <p>Refresh only support data from the database.</p>
        </div>
        <button className="announcement-refresh-button" disabled type="button">
          Refresh Support
        </button>
      </header>

      <div className="admin-support-grid">
        <div className="admin-support-stack">
          <section className="admin-support-panel">
            <header className="admin-panel-header admin-panel-header--with-action">
              <div>
                <span className="section-eyebrow">Support Queue</span>
                <h2>Student Tickets</h2>
              </div>
              <button className="announcement-secondary-button" disabled type="button">
                <RefreshCw size={14} />
                Refresh
              </button>
            </header>
            <div className="admin-support-panel__body">
              <form className="admin-support-filters" onSubmit={handleSearch}>
                <label className="admin-support-search">
                  <Info size={15} />
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search ticket, student, subject..." type="search" />
                </label>
                <select value={status} onChange={(event) => setFilter('status', event.target.value)}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All Statuses' : formatOption(option)}
                    </option>
                  ))}
                </select>
              </form>

              {data && data.items.length > 0 ? (
                <div className="admin-support-ticket-list">
                  {data.items.map((ticket) => (
                    <button className={ticket.id === selectedTicket?.id ? 'admin-support-ticket admin-support-ticket--selected' : 'admin-support-ticket'} key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} type="button">
                      <span className="admin-support-ticket__top">
                        <strong>
                          {ticket.ticketId ?? ticket.id} · {ticket.subject}
                        </strong>
                        <span>{formatDate(ticket.updatedAt ?? ticket.createdAt)}</span>
                      </span>
                      <span>{[ticket.studentName, ticket.studentEmail].filter(Boolean).join(' · ')}</span>
                      <span className="chip-row">
                        <StatusBadge tone={statusTone(ticket.status)}>{formatOption(ticket.status)}</StatusBadge>
                        <StatusBadge tone={priorityTone(ticket.priority)}>{formatOption(ticket.priority)}</StatusBadge>
                        <span>{ticket.categoryName}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </div>
          </section>

          <SupportCategoryManager />
        </div>

        <div className="admin-support-stack">
          <TicketConversation ticket={selectedTicket} ticketDetailQuery={ticketDetailQuery} />
          <SupportEmailSettings />
          <FaqCategoryManager />
          <FaqManager />
        </div>
      </div>

      <nav className="pagination-bar" aria-label="Admin support pagination">
        {data?.hasPreviousPage ? (
          <Link className="pagination-link" to={buildPageLink(page - 1, search, status, priority, category)}>
            Previous page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Previous page</span>
        )}
        <span>
          Page {page} of {data?.totalPages ?? 1}
        </span>
        {data?.hasNextPage ? (
          <Link className="pagination-link" to={buildPageLink(page + 1, search, status, priority, category)}>
            Next page
          </Link>
        ) : (
          <span className="pagination-link pagination-link--disabled">Next page</span>
        )}
      </nav>
    </div>
  );
}

function TicketConversation({
  ticket,
  ticketDetailQuery
}: {
  ticket?: AdminSupportTicket;
  ticketDetailQuery: ReturnType<typeof useAdminSupportTicketDetail>;
}) {
  const detail = ticketDetailQuery.data;
  const activeTicket = detail?.ticket ?? ticket;

  return (
    <section className="admin-support-panel">
      <header className="admin-panel-header">
        <span className="section-eyebrow">Conversation</span>
        <h2>Ticket Detail</h2>
      </header>
      <div className="admin-support-panel__body">
        {!activeTicket ? (
          <EmptyState />
        ) : (
          <>
            <div className="admin-support-ticket-detail">
              <div>
                <h3>
                  {activeTicket.ticketId ?? activeTicket.id} · {activeTicket.subject}
                </h3>
                <p>{[activeTicket.studentName, activeTicket.studentEmail].filter(Boolean).join(' · ')}</p>
                <div className="chip-row">
                  <StatusBadge tone={statusTone(activeTicket.status)}>{formatOption(activeTicket.status)}</StatusBadge>
                  <StatusBadge tone={priorityTone(activeTicket.priority)}>{formatOption(activeTicket.priority)}</StatusBadge>
                  <span>{activeTicket.categoryName}</span>
                </div>
              </div>
              <button className="announcement-secondary-button" disabled type="button">
                Open Attachment
              </button>
            </div>

            <div className="admin-support-form-grid">
              <label>
                <span>Status</span>
                <select disabled value={activeTicket.status}>
                  {statusOptions.filter((option) => option !== 'all').map((option) => (
                    <option key={option} value={option}>
                      {formatOption(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select disabled value={activeTicket.priority}>
                  {priorityOptions.filter((option) => option !== 'all').map((option) => (
                    <option key={option} value={option}>
                      {formatOption(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-support-form-grid__wide">
                <span>Assigned Admin</span>
                <input disabled placeholder="Optional admin email" value={activeTicket.assignedAdminEmail ?? ''} />
              </label>
            </div>

            <button className="announcement-primary-button" disabled type="button">
              Save Ticket
            </button>

            {ticketDetailQuery.isLoading ? <LoadingState /> : null}
            <div className="admin-support-message-list">
              {detail?.messages.map((message) => (
                <article className="admin-support-message" key={message.id}>
                  <div>
                    <strong>
                      {formatOption(message.authorRole)} · {message.authorName ?? message.authorEmail}
                    </strong>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{message.body}</p>
                </article>
              ))}
              {detail && detail.messages.length === 0 ? <p className="muted-text">No messages are available for this ticket.</p> : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SupportCategoryManager() {
  return (
    <section className="admin-support-panel">
      <header className="admin-panel-header">
        <span className="section-eyebrow">Categories</span>
        <h2>Support Category Manager</h2>
      </header>
      <div className="admin-support-panel__body">
        {fallbackCategories.slice(0, 2).map((category) => (
          <article className="admin-support-config-card" key={category}>
            <label>
              <span>Category</span>
              <input disabled value={category} />
            </label>
            <label>
              <span>Status</span>
              <input disabled value="Active" />
            </label>
            <label>
              <span>Priority</span>
              <input disabled value="normal" />
            </label>
            <label>
              <span>Mode</span>
              <input disabled value="Two-way" />
            </label>
            <div className="admin-support-config-actions">
              <label className="admin-support-checkbox">
                <input checked disabled type="checkbox" />
                <span>Files</span>
              </label>
              <button className="announcement-secondary-button" disabled type="button">
                Save
              </button>
            </div>
          </article>
        ))}
        <button className="announcement-primary-button" disabled type="button">
          + Add Category
        </button>
      </div>
    </section>
  );
}

function SupportEmailSettings() {
  return (
    <section className="admin-support-panel">
      <header className="admin-panel-header">
        <span className="section-eyebrow">Notifications</span>
        <h2>Support Email Settings</h2>
      </header>
      <div className="admin-support-panel__body">
        <label className="admin-support-field">
          <span>Admin Notification Emails</span>
          <textarea disabled value="skilledsapiens@gmail.com" />
        </label>
        <p className="admin-support-help">Every new ticket and student reply is sent here. Leave blank to notify active LMS admins.</p>
        <button className="announcement-primary-button announcement-primary-button--wide" disabled type="button">
          Save Support Settings
        </button>
      </div>
    </section>
  );
}

function FaqCategoryManager() {
  return (
    <section className="admin-support-panel">
      <header className="admin-panel-header admin-panel-header--with-action">
        <div>
          <span className="section-eyebrow">FAQs</span>
          <h2>FAQ Categories</h2>
        </div>
        <button className="announcement-secondary-button" disabled type="button">
          + Category
        </button>
      </header>
      <div className="admin-support-panel__body">
        {faqCategories.map((category) => (
          <article className="admin-support-faq-category" key={category.category}>
            <label>
              <span>Category</span>
              <input disabled value={category.category} />
            </label>
            <label>
              <span>Status</span>
              <input disabled value={category.status} />
            </label>
            <label>
              <span>Sort</span>
              <input disabled value={category.sort} />
            </label>
            <button className="announcement-secondary-button" disabled type="button">
              Save
            </button>
            <button className="announcement-row-button announcement-row-button--danger" disabled type="button">
              Remove
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function FaqManager() {
  return (
    <section className="admin-support-panel">
      <header className="admin-panel-header admin-panel-header--with-action">
        <div>
          <span className="section-eyebrow">FAQs</span>
          <h2>FAQ Manager</h2>
        </div>
        <button className="announcement-primary-button" disabled type="button">
          + Add FAQ
        </button>
      </header>
      <div className="admin-support-panel__body">
        <div className="admin-support-filters admin-support-faq-filters">
          <label className="admin-support-search">
            <Info size={15} />
            <input disabled placeholder="Search FAQs..." />
          </label>
          <select disabled value="all">
            <option value="all">All Statuses</option>
          </select>
        </div>
        {faqs.map((faq) => (
          <article className="admin-support-faq-card" key={faq.question}>
            <label className="admin-support-form-grid__wide">
              <span>Question</span>
              <input disabled value={faq.question} />
            </label>
            <label className="admin-support-form-grid__wide">
              <span>Answer</span>
              <textarea disabled value={faq.answer} />
            </label>
            <label>
              <span>Category</span>
              <input disabled value={faq.category} />
            </label>
            <label>
              <span>Status</span>
              <input disabled value={faq.status} />
            </label>
            <label>
              <span>Program Keys</span>
              <input disabled placeholder="Blank = all programs" value={faq.programKeys} />
            </label>
            <label>
              <span>Cohorts</span>
              <input disabled placeholder="Blank = all cohorts" value={faq.cohorts} />
            </label>
            <label>
              <span>Sort</span>
              <input disabled value={faq.sort} />
            </label>
            <label className="admin-support-checkbox">
              <input checked={faq.featured} disabled type="checkbox" />
              <span>Featured</span>
            </label>
            <button className="announcement-secondary-button" disabled type="button">
              Save
            </button>
            <button className="announcement-row-button announcement-row-button--danger" disabled type="button">
              Archive
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
