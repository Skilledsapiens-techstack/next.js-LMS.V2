import { Download, Loader2, Mail, MessageCircle, Phone, RefreshCw, Save, Search, ShieldOff, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminGuestAudienceType,
  AdminGuestLead,
  AdminGuestLeadStatus,
  useAdminGuestLeadDetail,
  useAdminGuestLeads,
  useCreateAdminGuestLeadNote,
  useToggleAdminGuestLeadAccess,
  useUpdateAdminGuestLeadStatus
} from '../features/admin/useAdminGuestLeads';

const leadStatusOptions: Array<{ label: string; value: AdminGuestLeadStatus | 'all' }> = [
  { label: 'All Statuses', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Interested', value: 'interested' },
  { label: 'Converted', value: 'converted' },
  { label: 'Not Interested', value: 'not_interested' }
];

const audienceOptions: Array<{ label: string; value: AdminGuestAudienceType | 'all' }> = [
  { label: 'All Audiences', value: 'all' },
  { label: 'Students', value: 'student' },
  { label: 'Working Professionals', value: 'working_professional' },
  { label: 'Other', value: 'other' }
];

const mentorOptions = [
  { label: 'All Mentor Needs', value: '' },
  { label: 'Yes, urgently', value: 'yes_urgently' },
  { label: 'Maybe later', value: 'maybe_later' },
  { label: 'No', value: 'no' }
];

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function formatLabel(value?: string | null) {
  return String(value || 'Not set')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not seen yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusTone(status: AdminGuestLeadStatus) {
  if (status === 'converted') return 'safe';
  if (status === 'interested') return 'warning';
  if (status === 'not_interested') return 'danger';
  return 'neutral';
}

function whatsappUrl(lead: AdminGuestLead) {
  const number = `${lead.whatsappCountryCode || '+91'}${lead.whatsappNumber}`.replace(/\D/g, '');
  return `https://wa.me/${number}`;
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportGuestLeads(items: AdminGuestLead[]) {
  const headers = ['Name', 'Personal Email', 'WhatsApp', 'Status', 'Audience', 'City', 'Interested Roles', 'Interested Program', 'Mentor Need', 'Last Active', 'Created'];
  const rows = items.map((lead) => [
    lead.fullName,
    lead.personalEmail,
    `${lead.whatsappCountryCode} ${lead.whatsappNumber}`,
    lead.leadStatus,
    lead.audienceType,
    lead.currentCity,
    lead.interestedRoles.join(', '),
    lead.interestedProgram,
    lead.mentorAllocationInterest,
    lead.lastActiveAt,
    lead.createdAt
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `guest-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildSearchParams(searchParams: URLSearchParams, updates: Record<string, string>, resetPage = true) {
  const next = new URLSearchParams(searchParams);
  Object.entries(updates).forEach(([key, value]) => {
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
  });
  if (resetPage) next.set('page', '1');
  return next;
}

export function AdminGuestLeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() ?? '';
  const leadStatus = (searchParams.get('leadStatus') as AdminGuestLeadStatus | 'all' | null) ?? 'all';
  const audienceType = (searchParams.get('audienceType') as AdminGuestAudienceType | 'all' | null) ?? 'all';
  const interestedRole = searchParams.get('interestedRole')?.trim() ?? '';
  const city = searchParams.get('city')?.trim() ?? '';
  const mentor = searchParams.get('mentor')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const leadsQuery = useAdminGuestLeads({ audienceType, city, interestedRole, leadStatus, limit: 20, mentor, page, search, sort: 'newest' });
  const leads = leadsQuery.data?.items ?? [];
  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedLeadId) ?? leads[0], [leads, selectedLeadId]);
  const detailQuery = useAdminGuestLeadDetail(selectedLead?.id);
  const detail = detailQuery.data ?? selectedLead;
  const updateStatusMutation = useUpdateAdminGuestLeadStatus();
  const toggleAccessMutation = useToggleAdminGuestLeadAccess();
  const createNoteMutation = useCreateAdminGuestLeadNote();

  useEffect(() => {
    if (!selectedLeadId && leads[0]) setSelectedLeadId(leads[0].id);
  }, [leads, selectedLeadId]);

  function setFilter(key: 'audienceType' | 'city' | 'interestedRole' | 'leadStatus' | 'mentor', value: string) {
    setSearchParams(buildSearchParams(searchParams, { [key]: value }));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchParams(buildSearchParams(searchParams, { search: searchInput.trim() }));
  }

  async function updateLeadStatus(value: AdminGuestLeadStatus) {
    if (!detail) return;
    setMessage(null);
    await updateStatusMutation.mutateAsync({ guestLeadId: detail.id, leadStatus: value });
    setMessage('Guest lead status updated.');
  }

  async function toggleGuestAccess(active: boolean) {
    if (!detail) return;
    setMessage(null);
    await toggleAccessMutation.mutateAsync({ active, guestLeadId: detail.id });
    setMessage(active ? 'Guest access reactivated.' : 'Guest access deactivated.');
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !noteText.trim()) return;
    setMessage(null);
    await createNoteMutation.mutateAsync({ guestLeadId: detail.id, note: noteText.trim() });
    setNoteText('');
    setMessage('Internal note added.');
  }

  if (leadsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading guest leads." eyebrow="Lead management" title="Guest Leads" />
        <LoadingState />
      </div>
    );
  }

  if (leadsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Guest leads could not be loaded." eyebrow="Lead management" title="Guest Leads unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="admin-resource-page admin-guest-leads-page">
      <PageHeader
        description="Manage free-access users separately from paid students. Update lead status, review profile details, and add internal follow-up notes."
        eyebrow="Lead management"
        title="Guest Leads"
      />

      <section className="admin-project-section">
        <header className="admin-project-section__header">
          <div>
            <span>Guest queue</span>
            <h2>Free Access Leads</h2>
          </div>
          <div className="admin-project-form__actions">
            <button className="segmented-button" disabled={leadsQuery.isFetching} onClick={() => void leadsQuery.refetch()} type="button">
              {leadsQuery.isFetching ? <Loader2 className="workshop-action-spinner" size={14} /> : <RefreshCw size={14} />}
              Refresh
            </button>
            <button className="segmented-button" disabled={leads.length === 0} onClick={() => exportGuestLeads(leads)} type="button">
              <Download size={14} />
              Export Page
            </button>
          </div>
        </header>

        <form className="admin-resource-filter-grid" onSubmit={handleSearch}>
          <div className="filter-search admin-resource-search">
            <Search size={16} />
            <input aria-label="Search guest leads" placeholder="Search name, email, city, phone..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          </div>
          <button className="segmented-button admin-resource-action admin-resource-search-button" type="submit">
            Search
          </button>
          <select value={leadStatus} onChange={(event) => setFilter('leadStatus', event.target.value)}>
            {leadStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={audienceType} onChange={(event) => setFilter('audienceType', event.target.value)}>
            {audienceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={mentor} onChange={(event) => setFilter('mentor', event.target.value)}>
            {mentorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </form>
      </section>

      <div className="admin-resource-grid admin-guest-leads-grid">
        <section className="admin-project-section admin-resource-library">
          <div className="admin-resource-list">
            {leads.length > 0 ? (
              leads.map((lead) => (
                <article className={selectedLead?.id === lead.id ? 'admin-resource-card admin-resource-card--selected' : 'admin-resource-card'} key={lead.id}>
                  <button className="admin-guest-lead-card-button" onClick={() => setSelectedLeadId(lead.id)} type="button">
                    <div className="admin-resource-card__main">
                      <h3>{lead.fullName}</h3>
                      <p>{[lead.personalEmail, lead.currentCity, formatLabel(lead.audienceType)].filter(Boolean).join(' · ')}</p>
                      <div className="chip-row">
                        <StatusBadge tone={statusTone(lead.leadStatus)}>{formatLabel(lead.leadStatus)}</StatusBadge>
                        {lead.deactivatedAt ? <StatusBadge tone="danger">Deactivated</StatusBadge> : <StatusBadge tone="safe">Active Guest</StatusBadge>}
                        {lead.interestedRoles.slice(0, 2).map((role) => (
                          <span key={role}>{role}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                </article>
              ))
            ) : (
              <EmptyState />
            )}
          </div>
          <nav className="pagination-bar admin-resource-pagination" aria-label="Guest leads pagination">
            <button className="pagination-link" disabled={!leadsQuery.data?.hasPreviousPage || leadsQuery.isFetching} onClick={() => setSearchParams(buildSearchParams(searchParams, { page: String(page - 1) }, false))} type="button">
              Previous page
            </button>
            <span>
              Page {leadsQuery.data?.page ?? page} of {leadsQuery.data?.totalPages ?? 1} · {leadsQuery.data?.total ?? 0} matching
            </span>
            <button className="pagination-link" disabled={!leadsQuery.data?.hasNextPage || leadsQuery.isFetching} onClick={() => setSearchParams(buildSearchParams(searchParams, { page: String(page + 1) }, false))} type="button">
              Next page
            </button>
          </nav>
        </section>

        <section className="admin-project-section admin-resource-editor">
          {detail ? (
            <>
              <header className="admin-project-section__header">
                <div>
                  <span>Guest profile</span>
                  <h2>{detail.fullName}</h2>
                </div>
                <StatusBadge tone={statusTone(detail.leadStatus)}>{formatLabel(detail.leadStatus)}</StatusBadge>
              </header>

              <div className="admin-guest-lead-detail">
                <div className="student-detail-grid">
                  <div className="student-detail-field">
                    <span>Personal Email</span>
                    <strong>{detail.personalEmail}</strong>
                  </div>
                  <div className="student-detail-field">
                    <span>WhatsApp</span>
                    <strong>{detail.whatsappCountryCode} {detail.whatsappNumber}</strong>
                  </div>
                  <div className="student-detail-field">
                    <span>Current Status</span>
                    <strong>{formatLabel(detail.currentStatus)}</strong>
                  </div>
                  <div className="student-detail-field">
                    <span>City</span>
                    <strong>{detail.currentCity || 'Not set'}</strong>
                  </div>
                  <div className="student-detail-field">
                    <span>College / Company</span>
                    <strong>{detail.collegeName || detail.companyName || 'Not set'}</strong>
                  </div>
                  <div className="student-detail-field">
                    <span>Education / Role</span>
                    <strong>{detail.educationYear || detail.currentJobRole || 'Not set'}</strong>
                  </div>
                  <div className="student-detail-field">
                    <span>Email Verified</span>
                    <strong>{formatDateTime(detail.emailVerifiedAt)}</strong>
                  </div>
                  <div className="student-detail-field">
                    <span>Last Active</span>
                    <strong>{formatDateTime(detail.lastActiveAt)}</strong>
                  </div>
                </div>

                <div className="chip-row">
                  {detail.interestedRoles.length > 0 ? detail.interestedRoles.map((role) => <span key={role}>{role}</span>) : <span>No role selected</span>}
                  <span>{formatLabel(detail.mentorAllocationInterest)}</span>
                  {detail.interestedProgram ? <span>{detail.interestedProgram}</span> : null}
                </div>

                <div className="admin-project-form__actions">
                  <a className="segmented-button" href={`mailto:${detail.personalEmail}`}>
                    <Mail size={14} />
                    Email
                  </a>
                  <a className="segmented-button" href={whatsappUrl(detail)} rel="noreferrer" target="_blank">
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>
                  <a className="segmented-button" href={`tel:${detail.whatsappCountryCode}${detail.whatsappNumber}`}>
                    <Phone size={14} />
                    Call
                  </a>
                </div>

                <label>
                  <span>Lead Status</span>
                  <select value={detail.leadStatus} onChange={(event) => void updateLeadStatus(event.target.value as AdminGuestLeadStatus)} disabled={updateStatusMutation.isPending}>
                    {leadStatusOptions.filter((option) => option.value !== 'all').map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button className={detail.deactivatedAt ? 'segmented-button' : 'segmented-button segmented-button--danger'} disabled={toggleAccessMutation.isPending} onClick={() => void toggleGuestAccess(Boolean(detail.deactivatedAt))} type="button">
                  {detail.deactivatedAt ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                  {detail.deactivatedAt ? 'Reactivate Guest Access' : 'Deactivate Guest Access'}
                </button>

                <form className="admin-project-form admin-guest-note-form" onSubmit={saveNote}>
                  <label className="admin-project-form__wide">
                    <span>Internal Note</span>
                    <textarea rows={4} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add call notes, follow-up context, payment discussion, or counselling remarks." />
                  </label>
                  <button className="segmented-button segmented-button--gold" disabled={!noteText.trim() || createNoteMutation.isPending} type="submit">
                    {createNoteMutation.isPending ? <Loader2 className="workshop-action-spinner" size={14} /> : <Save size={14} />}
                    Add Note
                  </button>
                </form>

                {message ? <p className="admin-resource-success-note">{message}</p> : null}

                <section className="admin-resource-history">
                  <header>
                    <span>Internal notes</span>
                    <strong>{detailQuery.isFetching ? 'Refreshing...' : `${detail.notes?.length ?? 0} note(s)`}</strong>
                  </header>
                  {detail.notes?.length ? (
                    detail.notes.map((note) => (
                      <article key={note.id}>
                        <MessageCircle size={14} />
                        <div>
                          <strong>{note.note}</strong>
                          <span>{[note.createdBy, formatDateTime(note.createdAt)].filter(Boolean).join(' · ')}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>No internal notes yet.</p>
                  )}
                </section>
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </section>
      </div>
    </div>
  );
}
