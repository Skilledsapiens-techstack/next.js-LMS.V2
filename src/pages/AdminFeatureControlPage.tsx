import { Clock3, Eye, EyeOff, LockKeyhole, RefreshCw, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FeatureControl, FeatureControlStatus, getFeatureMessage, useAdminFeatureControls, useUpdateAdminFeatureControl } from '../features/useFeatureControls';

type DraftFeature = {
  status: FeatureControlStatus;
  upcomingMessage: string;
  whatsappNumber: string;
};

const statusOptions: Array<{ description: string; label: string; value: FeatureControlStatus }> = [
  { description: 'Visible and fully usable for students.', label: 'Show', value: 'show' },
  { description: 'Visible in navigation, opens a coming-soon page.', label: 'Upcoming', value: 'upcoming' },
  { description: 'Hidden from navigation and blocked on direct URL.', label: 'Hide', value: 'hide' }
];

function formatDate(value: string | undefined) {
  if (!value) return 'Not updated yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function statusTone(status: FeatureControlStatus) {
  if (status === 'show') return 'safe';
  if (status === 'upcoming') return 'warning';
  return 'neutral';
}

function statusIcon(status: FeatureControlStatus) {
  if (status === 'show') return <Eye size={16} />;
  if (status === 'upcoming') return <Clock3 size={16} />;
  return <EyeOff size={16} />;
}

function isWhatsAppWidget(item: FeatureControl) {
  return item.moduleId === 'whatsapp-widget';
}

function getWhatsAppNumber(item: FeatureControl) {
  const value = item.settings?.whatsapp_number ?? item.settings?.whatsappNumber;
  return typeof value === 'string' ? value : '';
}

function normalizeWhatsAppNumber(value: string) {
  return value.replace(/[^\d]/g, '');
}

function buildDrafts(items: FeatureControl[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        status: item.status,
        upcomingMessage: item.upcomingMessage ?? '',
        whatsappNumber: getWhatsAppNumber(item)
      }
    ])
  ) as Record<string, DraftFeature>;
}

function isDirty(item: FeatureControl, draft?: DraftFeature) {
  if (!draft) return false;
  const numberChanged = isWhatsAppWidget(item) && getWhatsAppNumber(item) !== draft.whatsappNumber.trim();
  return item.status !== draft.status || (item.upcomingMessage ?? '') !== draft.upcomingMessage.trim() || numberChanged;
}

export function AdminFeatureControlPage() {
  const controlsQuery = useAdminFeatureControls();
  const updateFeature = useUpdateAdminFeatureControl();
  const [drafts, setDrafts] = useState<Record<string, DraftFeature>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const items = controlsQuery.data?.items ?? [];

  useEffect(() => {
    if (!controlsQuery.data?.items) return;
    setDrafts((current) => {
      if (Object.keys(current).length > 0) return current;
      return buildDrafts(controlsQuery.data.items);
    });
  }, [controlsQuery.data?.items]);

  const summary = useMemo(
    () => ({
      hidden: items.filter((item) => item.status === 'hide').length,
      shown: items.filter((item) => item.status === 'show').length,
      upcoming: items.filter((item) => item.status === 'upcoming').length
    }),
    [items]
  );

  function updateDraft(id: string, patch: Partial<DraftFeature>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? { status: 'show', upcomingMessage: '', whatsappNumber: '' }),
        ...patch
      }
    }));
  }

  async function saveFeature(item: FeatureControl) {
    const draft = drafts[item.id];
    if (!draft || !isDirty(item, draft)) return;
    const isWidget = isWhatsAppWidget(item);
    const whatsappNumber = normalizeWhatsAppNumber(draft.whatsappNumber);
    if (isWidget && draft.status === 'show' && !whatsappNumber) {
      setMessage({ tone: 'error', text: 'Add a WhatsApp number before showing the student widget.' });
      return;
    }
    try {
      const body = {
        status: item.isCore ? 'show' : draft.status,
        upcomingMessage: draft.upcomingMessage.trim() || null,
        ...(isWidget
          ? {
              settings: {
                ...(item.settings ?? {}),
                whatsapp_number: whatsappNumber
              }
            }
          : {})
      };

      await updateFeature.mutateAsync({
        body,
        id: item.id
      });
      setMessage({ tone: 'success', text: `${item.studentLabel} visibility updated.` });
      setDrafts({});
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Feature control could not be updated.' });
    }
  }

  if (controlsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading student module visibility controls." eyebrow="Admin operations" title="Feature Control" />
        <LoadingState />
      </div>
    );
  }

  if (controlsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Student module controls could not be loaded right now." eyebrow="Admin operations" title="Feature Control unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-feature-control-page">
      <PageHeader
        description="Control which student-side modules are visible, upcoming, or hidden across the LMS."
        eyebrow="Admin operations"
        title="Feature Control"
      />

      {message ? <div className={message.tone === 'success' ? 'auth-alert auth-alert--success' : 'auth-alert auth-alert--error'}>{message.text}</div> : null}

      <section className="feature-control-summary" aria-label="Feature control summary">
        <article>
          <Eye size={20} />
          <span>Shown</span>
          <strong>{summary.shown}</strong>
        </article>
        <article>
          <Clock3 size={20} />
          <span>Upcoming</span>
          <strong>{summary.upcoming}</strong>
        </article>
        <article>
          <EyeOff size={20} />
          <span>Hidden</span>
          <strong>{summary.hidden}</strong>
        </article>
      </section>

      <section className="feature-control-guidance">
        <SlidersHorizontal size={20} />
        <div>
          <strong>Global student visibility</strong>
          <p>Dashboard stays visible. Hidden modules are removed from student navigation and direct URLs are blocked. Upcoming modules remain visible with a coming-soon message.</p>
        </div>
        <button className="segmented-button" disabled={controlsQuery.isFetching} onClick={() => void controlsQuery.refetch()} type="button">
          <RefreshCw size={16} />
          {controlsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      {items.length > 0 ? (
        <section className="feature-control-panel" aria-label="Student module feature controls">
          <header>
            <div>
              <span className="eyebrow">Student modules</span>
              <h2>Visibility controls</h2>
            </div>
            <span>{items.length} modules</span>
          </header>
          <div className="feature-control-list">
            {items.map((item) => {
              const isWidget = isWhatsAppWidget(item);
              const draft = drafts[item.id] ?? { status: item.status, upcomingMessage: item.upcomingMessage ?? '', whatsappNumber: getWhatsAppNumber(item) };
              const dirty = isDirty(item, draft);
              const isSaving = updateFeature.isPending;

              return (
                <article className={`feature-control-row ${isWidget ? 'feature-control-row--widget' : ''}`} key={item.id}>
                  <div className="feature-control-row__module">
                    <div className="feature-control-row__icon">{item.isCore ? <LockKeyhole size={17} /> : statusIcon(item.status)}</div>
                    <div>
                      <h2>{item.studentLabel}</h2>
                      <p>{item.studentPath}</p>
                      <div className="chip-row">
                        <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
                        {item.isCore ? <StatusBadge>Core module</StatusBadge> : null}
                      </div>
                    </div>
                  </div>

                  <label className="feature-control-field">
                    Status
                    <select disabled={item.isCore || isSaving} value={draft.status} onChange={(event) => updateDraft(item.id, { status: event.target.value as FeatureControlStatus })}>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span>{statusOptions.find((option) => option.value === draft.status)?.description}</span>
                  </label>

                  <label className="feature-control-field feature-control-field--message">
                    {isWidget ? 'Widget help text' : 'Upcoming message'}
                    <textarea
                      disabled={item.isCore || isSaving}
                      maxLength={500}
                      onChange={(event) => updateDraft(item.id, { upcomingMessage: event.target.value })}
                      placeholder={getFeatureMessage({ moduleId: item.moduleId, studentLabel: item.studentLabel, upcomingMessage: null })}
                      value={draft.upcomingMessage}
                    />
                  </label>

                  {isWidget ? (
                    <label className="feature-control-field feature-control-field--phone">
                      WhatsApp number
                      <input
                        aria-invalid={draft.status === 'show' && !normalizeWhatsAppNumber(draft.whatsappNumber)}
                        disabled={isSaving}
                        inputMode="tel"
                        maxLength={24}
                        onChange={(event) => updateDraft(item.id, { whatsappNumber: event.target.value })}
                        placeholder="+91 98765 43210"
                        value={draft.whatsappNumber}
                      />
                      <span>Required when status is Show. Include country code; students will open this number from the bottom-right portal widget.</span>
                    </label>
                  ) : null}

                  <div className="feature-control-row__meta">
                    <span>Updated</span>
                    <strong>{formatDate(item.updatedAt)}</strong>
                    {item.updatedBy ? <small>{item.updatedBy}</small> : null}
                  </div>

                  <button className="segmented-button segmented-button--gold" disabled={!dirty || item.isCore || isSaving} onClick={() => void saveFeature(item)} type="button">
                    <Save size={15} />
                    {isSaving && dirty ? 'Saving...' : 'Save'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      <section className="feature-control-safety-note">
        <ShieldCheck size={16} />
        <span>Feature Control changes affect student navigation globally. Content permissions and student data access rules remain handled separately by each module.</span>
      </section>
    </div>
  );
}
