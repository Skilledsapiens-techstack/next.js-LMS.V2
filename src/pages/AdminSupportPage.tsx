import { ChevronDown, Edit3, Info, Loader2, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminSupportCategory,
  AdminSupportFaq,
  AdminSupportTicket,
  AdminSupportTicketPriority,
  AdminSupportTicketStatus,
  useCloseAdminSupportTicket,
  useCreateAdminSupportCategory,
  useCreateAdminSupportFaq,
  useCreateAdminSupportTicketReply,
  useDeleteAdminSupportFaq,
  useAdminSupportCategories,
  useAdminSupportFaqs,
  useAdminSupportTicketDetail,
  useAdminSupportTickets,
  useReopenAdminSupportTicket,
  useUpdateAdminSupportCategory,
  useUpdateAdminSupportFaq,
  useUpdateAdminSupportTicket
} from '../features/admin/useAdminSupportTickets';

const statusOptions: Array<AdminSupportTicketStatus | 'all'> = ['all', 'open', 'in_review', 'waiting_for_student', 'resolved', 'closed'];
const priorityOptions: Array<AdminSupportTicketPriority | 'all'> = ['all', 'low', 'normal', 'high', 'urgent'];
const faqStatusOptions: Array<AdminSupportFaq['status'] | 'all'> = ['all', 'draft', 'published', 'archived'];

type FaqFormState = {
  answer: string;
  categoryName: string;
  cohortNames: string;
  featured: boolean;
  programKeys: string;
  question: string;
  sortOrder: number;
  status: AdminSupportFaq['status'];
};

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
  const [activeTab, setActiveTab] = useState<'queue' | 'faqs'>('queue');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const categoriesQuery = useAdminSupportCategories();
  const faqsQuery = useAdminSupportFaqs();
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
        <button className="announcement-refresh-button" disabled={ticketsQuery.isFetching} onClick={() => void ticketsQuery.refetch()} type="button">
          Refresh Support
        </button>
      </header>

      <nav className="support-tabs admin-support-tabs" aria-label="Support admin tabs">
        <button className={activeTab === 'queue' ? 'support-tab support-tab--active' : 'support-tab'} onClick={() => setActiveTab('queue')} type="button">
          Support Queue / Student Tickets
        </button>
        <button className={activeTab === 'faqs' ? 'support-tab support-tab--active' : 'support-tab'} onClick={() => setActiveTab('faqs')} type="button">
          FAQ Manager
        </button>
      </nav>

      {activeTab === 'queue' ? (
        <div className="admin-support-grid">
          <div className="admin-support-stack">
            <section className="admin-support-panel">
              <header className="admin-panel-header admin-panel-header--with-action">
                <div>
                  <span className="section-eyebrow">Support Queue</span>
                  <h2>Student Tickets</h2>
                </div>
                <button className="announcement-secondary-button" disabled={ticketsQuery.isFetching} onClick={() => void ticketsQuery.refetch()} type="button">
                  <RefreshCw size={14} />
                  {ticketsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
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
                  <select value={priority} onChange={(event) => setFilter('priority', event.target.value)}>
                    {priorityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === 'all' ? 'All Priorities' : formatOption(option)}
                      </option>
                    ))}
                  </select>
                  <select value={category || 'all'} onChange={(event) => setFilter('category', event.target.value)}>
                    <option value="all">All Categories</option>
                    {(categoriesQuery.data?.items ?? []).map((option) => (
                      <option key={option.id} value={option.categoryName}>
                        {option.categoryName}
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
          </div>

          <div className="admin-support-stack">
            <TicketConversation ticket={selectedTicket} ticketDetailQuery={ticketDetailQuery} />
            <SupportEmailSettings />
          </div>
        </div>
      ) : (
        <div className="admin-support-grid admin-support-grid--faq">
          <SupportCategoryManager categories={categoriesQuery.data?.items ?? []} isLoading={categoriesQuery.isLoading} />
          <FaqManager categories={categoriesQuery.data?.items ?? []} faqs={faqsQuery.data?.items ?? []} isLoading={faqsQuery.isLoading} />
        </div>
      )}

      {activeTab === 'queue' ? <nav className="pagination-bar" aria-label="Admin support pagination">
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
      </nav> : null}
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
  const updateTicketMutation = useUpdateAdminSupportTicket();
  const replyMutation = useCreateAdminSupportTicketReply();
  const closeTicketMutation = useCloseAdminSupportTicket();
  const reopenTicketMutation = useReopenAdminSupportTicket();
  const [assignedAdminEmail, setAssignedAdminEmail] = useState('');
  const [formMessage, setFormMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [priority, setPriority] = useState<AdminSupportTicketPriority>('normal');
  const [publicReply, setPublicReply] = useState('');
  const [sendStudentEmail, setSendStudentEmail] = useState(true);
  const [status, setStatus] = useState<AdminSupportTicketStatus>('open');
  const [internalNote, setInternalNote] = useState('');
  const isSaving =
    updateTicketMutation.isPending ||
    replyMutation.isPending ||
    closeTicketMutation.isPending ||
    reopenTicketMutation.isPending;

  useEffect(() => {
    if (!activeTicket) return;
    setAssignedAdminEmail(activeTicket.assignedAdminEmail ?? '');
    setPriority(activeTicket.priority);
    setStatus(activeTicket.status);
    setFormMessage(null);
    setInternalNote('');
    setPublicReply('');
  }, [activeTicket?.id, activeTicket?.assignedAdminEmail, activeTicket?.priority, activeTicket?.status]);

  async function handleSaveTicket() {
    if (!activeTicket) return;
    setFormMessage(null);

    try {
      await updateTicketMutation.mutateAsync({
        assignedAdminEmail,
        priority,
        status,
        ticketId: activeTicket.id
      });
      setFormMessage({ tone: 'success', text: 'Ticket updated successfully.' });
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Ticket could not be updated.' });
    }
  }

  async function handleReply(visibility: 'public' | 'internal') {
    if (!activeTicket) return;
    const body = visibility === 'public' ? publicReply : internalNote;
    setFormMessage(null);

    try {
      await replyMutation.mutateAsync({ body, sendEmail: visibility === 'public' ? sendStudentEmail : false, ticketId: activeTicket.id, visibility });
      if (visibility === 'public') setPublicReply('');
      else setInternalNote('');
      setFormMessage({ tone: 'success', text: visibility === 'public' ? 'Public reply sent.' : 'Internal note saved.' });
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Message could not be saved.' });
    }
  }

  async function handleCloseReopen(nextAction: 'close' | 'reopen') {
    if (!activeTicket) return;
    setFormMessage(null);

    try {
      if (nextAction === 'close') await closeTicketMutation.mutateAsync(activeTicket.id);
      else await reopenTicketMutation.mutateAsync(activeTicket.id);
      setFormMessage({ tone: 'success', text: nextAction === 'close' ? 'Ticket closed.' : 'Ticket reopened.' });
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Ticket action could not be completed.' });
    }
  }

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
                <select disabled={isSaving} value={status} onChange={(event) => setStatus(event.target.value as AdminSupportTicketStatus)}>
                  {statusOptions.filter((option) => option !== 'all').map((option) => (
                    <option key={option} value={option}>
                      {formatOption(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select disabled={isSaving} value={priority} onChange={(event) => setPriority(event.target.value as AdminSupportTicketPriority)}>
                  {priorityOptions.filter((option) => option !== 'all').map((option) => (
                    <option key={option} value={option}>
                      {formatOption(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-support-form-grid__wide">
                <span>Assigned Admin</span>
                <input disabled={isSaving} onChange={(event) => setAssignedAdminEmail(event.target.value)} placeholder="Optional admin email" value={assignedAdminEmail} />
              </label>
            </div>

            {formMessage ? <div className={formMessage.tone === 'success' ? 'auth-alert auth-alert--success' : 'auth-alert auth-alert--error'}>{formMessage.text}</div> : null}

            <div className="admin-support-action-row">
              <button className="announcement-primary-button" disabled={isSaving} onClick={() => void handleSaveTicket()} type="button">
                {updateTicketMutation.isPending ? 'Saving...' : 'Save Ticket'}
              </button>
              {activeTicket.status === 'closed' || activeTicket.status === 'resolved' ? (
                <button className="announcement-secondary-button" disabled={isSaving} onClick={() => void handleCloseReopen('reopen')} type="button">
                  {reopenTicketMutation.isPending ? 'Reopening...' : 'Reopen'}
                </button>
              ) : (
                <button className="announcement-row-button announcement-row-button--danger" disabled={isSaving} onClick={() => void handleCloseReopen('close')} type="button">
                  {closeTicketMutation.isPending ? 'Closing...' : 'Close Ticket'}
                </button>
              )}
            </div>

            <div className="admin-support-form-grid">
              <label className="admin-support-form-grid__wide">
                <span>Public Reply</span>
                <textarea
                  disabled={isSaving || activeTicket.status === 'closed'}
                  maxLength={2000}
                  onChange={(event) => setPublicReply(event.target.value)}
                  placeholder="Reply visible to the student."
                  rows={4}
                  value={publicReply}
                />
              </label>
              <label className="admin-support-checkbox admin-support-form-grid__wide">
                <input checked={sendStudentEmail} disabled={isSaving || activeTicket.status === 'closed'} onChange={(event) => setSendStudentEmail(event.target.checked)} type="checkbox" />
                <span>Email this reply to the student</span>
              </label>
              <button className="announcement-primary-button" disabled={isSaving || activeTicket.status === 'closed'} onClick={() => void handleReply('public')} type="button">
                {replyMutation.isPending ? 'Sending...' : sendStudentEmail ? 'Send Reply + Email' : 'Send Public Reply'}
              </button>
              <label className="admin-support-form-grid__wide">
                <span>Internal Note</span>
                <textarea
                  disabled={isSaving}
                  maxLength={2000}
                  onChange={(event) => setInternalNote(event.target.value)}
                  placeholder="Private admin-only note."
                  rows={3}
                  value={internalNote}
                />
              </label>
              <button className="announcement-secondary-button" disabled={isSaving} onClick={() => void handleReply('internal')} type="button">
                {replyMutation.isPending ? 'Saving...' : 'Save Internal Note'}
              </button>
            </div>

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

function SupportCategoryManager({ categories, isLoading }: { categories: AdminSupportCategory[]; isLoading: boolean }) {
  const createMutation = useCreateAdminSupportCategory();
  const updateMutation = useUpdateAdminSupportCategory();
  const [draft, setDraft] = useState({
    categoryName: '',
    conversationMode: 'two_way' as const,
    defaultPriority: 'normal' as AdminSupportTicketPriority,
    sortOrder: 100,
    status: 'active' as const
  });
  const [message, setMessage] = useState('');

  async function handleAddCategory() {
    setMessage('');
    try {
      await createMutation.mutateAsync(draft);
      setDraft({ categoryName: '', conversationMode: 'two_way', defaultPriority: 'normal', sortOrder: 100, status: 'active' });
      setMessage('Category created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Category could not be created.');
    }
  }

  async function handleUpdateCategory(category: AdminSupportCategory, patch: Partial<AdminSupportCategory>) {
    setMessage('');
    try {
      await updateMutation.mutateAsync({ ...category, ...patch, id: category.id });
      setMessage('Category updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Category could not be updated.');
    }
  }

  return (
    <section className="admin-support-panel">
      <header className="admin-panel-header">
        <span className="section-eyebrow">Categories</span>
        <h2>Support Category Manager</h2>
      </header>
      <div className="admin-support-panel__body">
        {message ? <div className={message.includes('could not') ? 'auth-alert auth-alert--error' : 'auth-alert auth-alert--success'}>{message}</div> : null}
        {isLoading ? <LoadingState /> : null}
        {categories.map((category) => (
          <article className="admin-support-config-card" key={category.id}>
            <label>
              <span>Category</span>
              <input defaultValue={category.categoryName} onBlur={(event) => event.target.value !== category.categoryName && void handleUpdateCategory(category, { categoryName: event.target.value })} />
            </label>
            <label>
              <span>Status</span>
              <select defaultValue={category.status} onChange={(event) => void handleUpdateCategory(category, { status: event.target.value as 'active' | 'inactive' })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              <span>Priority</span>
              <select defaultValue={category.defaultPriority} onChange={(event) => void handleUpdateCategory(category, { defaultPriority: event.target.value as AdminSupportTicketPriority })}>
                {priorityOptions.filter((option) => option !== 'all').map((option) => (
                  <option key={option} value={option}>
                    {formatOption(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Mode</span>
              <select defaultValue={category.conversationMode} onChange={(event) => void handleUpdateCategory(category, { conversationMode: event.target.value as AdminSupportCategory['conversationMode'] })}>
                <option value="two_way">Two-way</option>
                <option value="admin_only">Admin only</option>
              </select>
            </label>
            <div className="admin-support-config-actions">
              <label className="admin-support-checkbox">
                <input
                  defaultChecked={category.allowAttachments}
                  onChange={(event) => void handleUpdateCategory(category, { allowAttachments: event.target.checked })}
                  type="checkbox"
                />
                <span>Files</span>
              </label>
              <span className="muted-text">Sort {category.sortOrder}</span>
            </div>
          </article>
        ))}
        <article className="admin-support-config-card">
          <label>
            <span>New Category</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, categoryName: event.target.value }))} placeholder="e.g. Placement Help" value={draft.categoryName} />
          </label>
          <label>
            <span>Default Priority</span>
            <select onChange={(event) => setDraft((current) => ({ ...current, defaultPriority: event.target.value as AdminSupportTicketPriority }))} value={draft.defaultPriority}>
              {priorityOptions.filter((option) => option !== 'all').map((option) => (
                <option key={option} value={option}>
                  {formatOption(option)}
                </option>
              ))}
            </select>
          </label>
          <button className="announcement-primary-button" disabled={createMutation.isPending || !draft.categoryName.trim()} onClick={() => void handleAddCategory()} type="button">
            {createMutation.isPending ? 'Adding...' : '+ Add Category'}
          </button>
        </article>
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

function FaqManager({ categories, faqs, isLoading }: { categories: AdminSupportCategory[]; faqs: AdminSupportFaq[]; isLoading: boolean }) {
  const createMutation = useCreateAdminSupportFaq();
  const updateMutation = useUpdateAdminSupportFaq();
  const deleteMutation = useDeleteAdminSupportFaq();
  const [draft, setDraft] = useState<FaqFormState>({
    answer: '',
    categoryName: categories[0]?.categoryName ?? '',
    cohortNames: '',
    featured: false,
    programKeys: '',
    question: '',
    sortOrder: 100,
    status: 'published' as const
  });
  const [editingFaqId, setEditingFaqId] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState('');
  const [editDraft, setEditDraft] = useState<FaqFormState | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<AdminSupportFaq['status'] | 'all'>('all');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!draft.categoryName && categories[0]?.categoryName) setDraft((current) => ({ ...current, categoryName: categories[0].categoryName }));
  }, [categories, draft.categoryName]);

  useEffect(() => {
    if (!expandedFaqId && faqs[0]?.id) setExpandedFaqId(faqs[0].id);
  }, [expandedFaqId, faqs]);

  function parseCsv(value: string) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  function formatCsv(values: string[] | undefined) {
    return (values ?? []).join(', ');
  }

  function faqToFormState(faq: AdminSupportFaq): FaqFormState {
    return {
      answer: faq.answer,
      categoryName: faq.categoryName ?? categories[0]?.categoryName ?? '',
      cohortNames: formatCsv(faq.cohortNames),
      featured: faq.featured,
      programKeys: formatCsv(faq.programKeys),
      question: faq.question,
      sortOrder: faq.sortOrder,
      status: faq.status
    };
  }

  function buildFaqPayload(state: FaqFormState) {
    return {
      answer: state.answer,
      categoryName: state.categoryName,
      cohortNames: parseCsv(state.cohortNames),
      featured: state.featured,
      programKeys: parseCsv(state.programKeys),
      question: state.question,
      sortOrder: state.sortOrder,
      status: state.status
    };
  }

  function startEditingFaq(faq: AdminSupportFaq) {
    setEditingFaqId(faq.id);
    setExpandedFaqId(faq.id);
    setDeleteConfirmId('');
    setEditDraft(faqToFormState(faq));
    setMessage('');
  }

  function cancelEditingFaq() {
    setEditingFaqId('');
    setEditDraft(null);
    setDeleteConfirmId('');
  }

  async function handleAddFaq() {
    setMessage('');
    try {
      await createMutation.mutateAsync(buildFaqPayload(draft));
      setDraft((current) => ({ ...current, answer: '', cohortNames: '', featured: false, programKeys: '', question: '' }));
      setMessage('FAQ created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'FAQ could not be created.');
    }
  }

  async function handleUpdateFaq(faq: AdminSupportFaq) {
    if (!editDraft) return;
    setMessage('');
    try {
      await updateMutation.mutateAsync({ ...faq, ...buildFaqPayload(editDraft), id: faq.id });
      setEditingFaqId('');
      setEditDraft(null);
      setMessage('FAQ updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'FAQ could not be updated.');
    }
  }

  async function handleDeleteFaq(faq: AdminSupportFaq) {
    setMessage('');
    try {
      await deleteMutation.mutateAsync(faq.id);
      if (expandedFaqId === faq.id) setExpandedFaqId('');
      if (editingFaqId === faq.id) cancelEditingFaq();
      setDeleteConfirmId('');
      setMessage('FAQ deleted permanently.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'FAQ could not be deleted.');
    }
  }

  const filteredFaqs = faqs.filter((faq) => {
    const categoryMatches = filterCategory === 'all' || (faq.categoryName ?? '') === filterCategory;
    const statusMatches = filterStatus === 'all' || faq.status === filterStatus;
    return categoryMatches && statusMatches;
  });
  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <section className="admin-support-panel">
      <header className="admin-panel-header">
        <div>
          <span className="section-eyebrow">FAQs</span>
          <h2>FAQ Manager</h2>
        </div>
      </header>
      <div className="admin-support-panel__body">
        {message ? <div className={message.includes('could not') ? 'auth-alert auth-alert--error' : 'auth-alert auth-alert--success'}>{message}</div> : null}
        {isLoading ? <LoadingState /> : null}
        <article className="admin-support-faq-card admin-support-faq-card--composer">
          <label className="admin-support-form-grid__wide">
            <span>New Question</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} placeholder="Question students will see" value={draft.question} />
          </label>
          <label className="admin-support-form-grid__wide">
            <span>Answer</span>
            <textarea
              className="admin-support-faq-answer-editor"
              onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))}
              placeholder="Use short paragraphs or bullets. Line breaks are preserved in the FAQ preview."
              rows={7}
              value={draft.answer}
            />
          </label>
          <label>
            <span>Category</span>
            <select onChange={(event) => setDraft((current) => ({ ...current, categoryName: event.target.value }))} value={draft.categoryName}>
              {categories.map((category) => (
                <option key={category.id} value={category.categoryName}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Program Keys</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, programKeys: event.target.value }))} placeholder="Blank = all, or MCLP,SMLP" value={draft.programKeys} />
          </label>
          <label>
            <span>Cohorts</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, cohortNames: event.target.value }))} placeholder="Blank = all, comma separated" value={draft.cohortNames} />
          </label>
          <label>
            <span>Status</span>
            <select onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AdminSupportFaq['status'] }))} value={draft.status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} type="number" value={draft.sortOrder} />
          </label>
          <label className="admin-support-checkbox">
            <input checked={draft.featured} onChange={(event) => setDraft((current) => ({ ...current, featured: event.target.checked }))} type="checkbox" />
            <span>Featured</span>
          </label>
          <button className="announcement-primary-button admin-support-faq-action" disabled={createMutation.isPending || !draft.question.trim() || !draft.answer.trim()} onClick={() => void handleAddFaq()} type="button">
            {createMutation.isPending ? <Loader2 className="admin-spin" size={14} /> : <Save size={14} />}
            {createMutation.isPending ? 'Adding...' : 'Add FAQ'}
          </button>
        </article>

        <div className="admin-support-faq-toolbar">
          <label>
            <span>Category</span>
            <select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.categoryName}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as AdminSupportFaq['status'] | 'all')}>
              {faqStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All Statuses' : formatOption(option)}
                </option>
              ))}
            </select>
          </label>
          <span className="admin-support-faq-count">
            {filteredFaqs.length} of {faqs.length} FAQs
          </span>
        </div>

        <div className="admin-support-faq-list" aria-label="FAQ list">
          {filteredFaqs.length === 0 ? <EmptyState /> : null}
          {filteredFaqs.map((faq) => {
            const isExpanded = expandedFaqId === faq.id;
            const isEditing = editingFaqId === faq.id && editDraft;
            const isConfirmingDelete = deleteConfirmId === faq.id;
            return (
              <article className={isExpanded ? 'admin-support-faq-accordion admin-support-faq-accordion--open' : 'admin-support-faq-accordion'} key={faq.id}>
                <button className="admin-support-faq-summary" onClick={() => setExpandedFaqId(isExpanded ? '' : faq.id)} type="button">
                  <span className="admin-support-faq-summary__main">
                    <strong>{faq.question}</strong>
                    <span>
                      {faq.categoryName || 'No category'} · Sort {faq.sortOrder}
                    </span>
                  </span>
                  <span className="admin-support-faq-summary__badges">
                    {faq.featured ? <StatusBadge tone="warning">Featured</StatusBadge> : null}
                    <StatusBadge tone={faq.status === 'published' ? 'safe' : faq.status === 'draft' ? 'neutral' : 'warning'}>{formatOption(faq.status)}</StatusBadge>
                    <ChevronDown size={16} />
                  </span>
                </button>

                {isExpanded ? (
                  <div className="admin-support-faq-detail">
                    {isEditing ? (
                      <div className="admin-support-faq-edit-form">
                        <label className="admin-support-form-grid__wide">
                          <span>Question</span>
                          <input value={editDraft.question} onChange={(event) => setEditDraft((current) => (current ? { ...current, question: event.target.value } : current))} />
                        </label>
                        <label className="admin-support-form-grid__wide">
                          <span>Answer</span>
                          <textarea
                            className="admin-support-faq-answer-editor"
                            onChange={(event) => setEditDraft((current) => (current ? { ...current, answer: event.target.value } : current))}
                            rows={8}
                            value={editDraft.answer}
                          />
                        </label>
                        <label>
                          <span>Category</span>
                          <select value={editDraft.categoryName} onChange={(event) => setEditDraft((current) => (current ? { ...current, categoryName: event.target.value } : current))}>
                            {categories.map((category) => (
                              <option key={category.id} value={category.categoryName}>
                                {category.categoryName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Status</span>
                          <select value={editDraft.status} onChange={(event) => setEditDraft((current) => (current ? { ...current, status: event.target.value as AdminSupportFaq['status'] } : current))}>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                          </select>
                        </label>
                        <label>
                          <span>Program Keys</span>
                          <input value={editDraft.programKeys} onChange={(event) => setEditDraft((current) => (current ? { ...current, programKeys: event.target.value } : current))} placeholder="Blank = all programs" />
                        </label>
                        <label>
                          <span>Cohorts</span>
                          <input value={editDraft.cohortNames} onChange={(event) => setEditDraft((current) => (current ? { ...current, cohortNames: event.target.value } : current))} placeholder="Blank = all cohorts" />
                        </label>
                        <label>
                          <span>Sort</span>
                          <input value={editDraft.sortOrder} onChange={(event) => setEditDraft((current) => (current ? { ...current, sortOrder: Number(event.target.value) } : current))} type="number" />
                        </label>
                        <label className="admin-support-checkbox">
                          <input checked={editDraft.featured} onChange={(event) => setEditDraft((current) => (current ? { ...current, featured: event.target.checked } : current))} type="checkbox" />
                          <span>Featured</span>
                        </label>
                        <div className="admin-support-faq-actions">
                          <button className="announcement-primary-button admin-support-faq-action" disabled={isSaving || !editDraft.question.trim() || !editDraft.answer.trim()} onClick={() => void handleUpdateFaq(faq)} type="button">
                            {updateMutation.isPending ? <Loader2 className="admin-spin" size={14} /> : <Save size={14} />}
                            {updateMutation.isPending ? 'Saving...' : 'Save FAQ'}
                          </button>
                          <button className="announcement-secondary-button admin-support-faq-action" disabled={isSaving} onClick={cancelEditingFaq} type="button">
                            <X size={14} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="admin-support-faq-answer">{faq.answer}</p>
                        <div className="admin-support-faq-meta">
                          <span>Programs: {(faq.programKeys ?? []).length > 0 ? (faq.programKeys ?? []).join(', ') : 'All programs'}</span>
                          <span>Cohorts: {(faq.cohortNames ?? []).length > 0 ? (faq.cohortNames ?? []).join(', ') : 'All cohorts'}</span>
                        </div>
                        {isConfirmingDelete ? (
                          <div className="admin-support-faq-delete-confirm">
                            <span>This will permanently delete the FAQ.</span>
                            <button className="announcement-row-button announcement-row-button--danger admin-support-faq-action" disabled={deleteMutation.isPending} onClick={() => void handleDeleteFaq(faq)} type="button">
                              {deleteMutation.isPending ? <Loader2 className="admin-spin" size={14} /> : <Trash2 size={14} />}
                              Delete permanently
                            </button>
                            <button className="announcement-secondary-button admin-support-faq-action" disabled={deleteMutation.isPending} onClick={() => setDeleteConfirmId('')} type="button">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="admin-support-faq-actions">
                            <button className="announcement-secondary-button admin-support-faq-action" disabled={isSaving} onClick={() => startEditingFaq(faq)} type="button">
                              <Edit3 size={14} />
                              Edit
                            </button>
                            <button className="announcement-row-button announcement-row-button--danger admin-support-faq-action" disabled={isSaving} onClick={() => setDeleteConfirmId(faq.id)} type="button">
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
