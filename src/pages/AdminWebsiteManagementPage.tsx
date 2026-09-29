import { Eye, EyeOff, Inbox, Search, Settings2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import {
  WebsiteCampusInquiry,
  WebsiteInquiryStatus,
  WebsiteNavModule,
  WebsiteNavModuleStatus,
  useUpdateWebsiteInquiryStatus,
  useUpdateWebsiteNavModuleStatus,
  useWebsiteCampusInquiries,
  useWebsiteNavModules
} from '../features/admin/useWebsiteManagement';

const inquiryStatuses: Array<{ label: string; value: WebsiteInquiryStatus }> = [
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Archived', value: 'archived' }
];

function formatDateTime(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function InquiryCard({ inquiry, onStatusChange, pending }: { inquiry: WebsiteCampusInquiry; onStatusChange: (status: WebsiteInquiryStatus) => void; pending: boolean }) {
  const businessTrackTitle = typeof inquiry.metadata?.businessTrackTitle === 'string' ? inquiry.metadata.businessTrackTitle : null;
  const sourceLabel = inquiry.sourcePage === 'business-connect' ? 'Business Connect' : 'Campus Connect';

  return (
    <article className="website-management-inquiry-card">
      <div className="website-management-inquiry-card__header">
        <div>
          <span className={`website-management-status website-management-status--${inquiry.status}`}>{statusLabel(inquiry.status)}</span>
          <span className="website-management-source">{sourceLabel}{businessTrackTitle ? ` · ${businessTrackTitle}` : ''}</span>
          <h3>{inquiry.name}</h3>
          <p>{inquiry.designation} at {inquiry.institutionName}</p>
        </div>
        <select disabled={pending} onChange={(event) => onStatusChange(event.target.value as WebsiteInquiryStatus)} value={inquiry.status}>
          {inquiryStatuses.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </div>

      <dl className="website-management-inquiry-grid">
        <div>
          <dt>Email</dt>
          <dd><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a></dd>
        </div>
        <div>
          <dt>Phone / WhatsApp</dt>
          <dd><a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a></dd>
        </div>
        <div>
          <dt>Partner type</dt>
          <dd>{inquiry.partnerType}</dd>
        </div>
        <div>
          <dt>Interested in</dt>
          <dd>{inquiry.interestedIn}</dd>
        </div>
      </dl>

      {inquiry.message ? <p className="website-management-inquiry-message">{inquiry.message}</p> : null}
      <footer>Submitted {formatDateTime(inquiry.createdAt)}</footer>
    </article>
  );
}

function ModuleControl({ module, onChange, pending }: { module: WebsiteNavModule; onChange: (status: WebsiteNavModuleStatus) => void; pending: boolean }) {
  const isVisible = module.status === 'visible';
  return (
    <article className="website-management-module-card">
      <div className="website-management-module-card__main">
        <span className={isVisible ? 'website-management-module-icon website-management-module-icon--visible' : 'website-management-module-icon'}>
          {isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
        </span>
        <div>
          <h3>{module.label}</h3>
          <p>{module.navGroup === 'placement' ? 'Placement dropdown item' : 'Top navigation item'} · /{module.slug}</p>
        </div>
      </div>
      <button
        className={isVisible ? 'website-management-toggle website-management-toggle--visible' : 'website-management-toggle'}
        disabled={pending || module.isCore}
        onClick={() => onChange(isVisible ? 'hidden' : 'visible')}
        title={module.isCore ? 'Core module cannot be hidden' : isVisible ? 'Hide from Explore navbar' : 'Show in Explore navbar'}
        type="button"
      >
        {module.isCore ? 'Core' : isVisible ? 'Visible' : 'Hidden'}
      </button>
    </article>
  );
}

export function AdminWebsiteManagementPage() {
  const [activeTab, setActiveTab] = useState<'entries' | 'navigation'>('entries');
  const [search, setSearch] = useState('');
  const [sourcePage, setSourcePage] = useState<'all' | 'business-connect' | 'campus-connect'>('all');
  const [status, setStatus] = useState<WebsiteInquiryStatus | 'all'>('all');
  const inquiriesQuery = useWebsiteCampusInquiries({ limit: 100, search, sourcePage, status });
  const modulesQuery = useWebsiteNavModules();
  const updateInquiryStatus = useUpdateWebsiteInquiryStatus();
  const updateModuleStatus = useUpdateWebsiteNavModuleStatus();

  const inquiries = inquiriesQuery.data?.items ?? [];
  const modules = modulesQuery.data?.items ?? [];
  const summary = useMemo(
    () => ({
      archived: inquiries.filter((item) => item.status === 'archived').length,
      contacted: inquiries.filter((item) => item.status === 'contacted').length,
      hiddenModules: modules.filter((item) => item.status === 'hidden').length,
      newItems: inquiries.filter((item) => item.status === 'new').length,
      visibleModules: modules.filter((item) => item.status === 'visible').length
    }),
    [inquiries, modules]
  );

  const isLoading = inquiriesQuery.isLoading || modulesQuery.isLoading;
  const isError = inquiriesQuery.isError || modulesQuery.isError;

  if (isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading website inquiries and Explore navigation controls." eyebrow="Admin" title="Website Management" />
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Website management data could not be loaded right now." eyebrow="Admin" title="Website Management unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack website-management-page">
      <PageHeader
        description="Manage Explore Skilled Sapiens navigation, Campus Connect form entries, and the foundation for future authorable website pages."
        eyebrow="Website operations"
        title="Website Management"
      />

      <section className="website-management-summary" aria-label="Website management summary">
        <article><Inbox size={18} /><strong>{summary.newItems}</strong><span>New inquiries</span></article>
        <article><Sparkles size={18} /><strong>{summary.contacted}</strong><span>Contacted</span></article>
        <article><Settings2 size={18} /><strong>{summary.visibleModules}</strong><span>Visible nav items</span></article>
        <article><EyeOff size={18} /><strong>{summary.hiddenModules}</strong><span>Hidden nav items</span></article>
      </section>

      <div className="website-management-tabs" role="tablist" aria-label="Website management sections">
        <button className={activeTab === 'entries' ? 'is-active' : ''} onClick={() => setActiveTab('entries')} type="button">Form Entries</button>
        <button className={activeTab === 'navigation' ? 'is-active' : ''} onClick={() => setActiveTab('navigation')} type="button">Explore Navigation</button>
      </div>

      {activeTab === 'entries' ? (
        <section className="website-management-panel">
          <div className="website-management-toolbar">
            <label>
              <Search size={16} />
              <input onChange={(event) => setSearch(event.target.value)} placeholder="Search name, college, email..." value={search} />
            </label>
            <select onChange={(event) => setStatus(event.target.value as WebsiteInquiryStatus | 'all')} value={status}>
              <option value="all">All statuses</option>
              {inquiryStatuses.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select onChange={(event) => setSourcePage(event.target.value as typeof sourcePage)} value={sourcePage}>
              <option value="all">All sources</option>
              <option value="campus-connect">Campus Connect</option>
              <option value="business-connect">Business Connect</option>
            </select>
          </div>

          {inquiries.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="website-management-inquiry-list">
              {inquiries.map((inquiry) => (
                <InquiryCard
                  inquiry={inquiry}
                  key={inquiry.id}
                  onStatusChange={(nextStatus) => updateInquiryStatus.mutate({ id: inquiry.id, status: nextStatus })}
                  pending={updateInquiryStatus.isPending}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="website-management-panel">
          <div className="website-management-authoring-note">
            <strong>Authorable content foundation</strong>
            <span>Today this controls Explore navbar visibility. Page copy, hero media, CTAs, and section-level authoring can be added here next without changing the user-facing route structure.</span>
          </div>
          <div className="website-management-module-list">
            {modules.map((module) => (
              <ModuleControl
                key={module.id}
                module={module}
                onChange={(nextStatus) => updateModuleStatus.mutate({ id: module.id, status: nextStatus })}
                pending={updateModuleStatus.isPending}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
