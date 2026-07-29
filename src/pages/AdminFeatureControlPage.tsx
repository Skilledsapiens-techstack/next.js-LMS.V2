import { Clock3, Eye, EyeOff, LockKeyhole, Mail, RefreshCw, Save, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import {
  FeatureControl,
  FeatureControlStatus,
  RecordingPlaybackMode,
  getFeatureMessage,
  getRecordingPlaybackMode,
  useAdminFeatureControls,
  useUpdateAdminFeatureControl
} from '../features/useFeatureControls';

type DraftFeature = {
  recordingPlaybackMode: RecordingPlaybackMode;
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

function isRecordingsFeature(item: FeatureControl) {
  return item.moduleId === 'recordings';
}

function isEmailServiceFeature(item: FeatureControl) {
  return item.moduleId === 'email-service';
}

function getStatusDescription(item: FeatureControl, status: FeatureControlStatus) {
  if (isEmailServiceFeature(item)) {
    if (status === 'show') return 'Email delivery is enabled for Email Centre, password links, and onboarding emails.';
    return 'Email delivery is paused. Recipient previews, templates, history, and student data remain available.';
  }
  return statusOptions.find((option) => option.value === status)?.description;
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
        recordingPlaybackMode: getRecordingPlaybackMode(item),
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
  const playbackModeChanged = isRecordingsFeature(item) && getRecordingPlaybackMode(item) !== draft.recordingPlaybackMode;
  return item.status !== draft.status || (item.upcomingMessage ?? '') !== draft.upcomingMessage.trim() || numberChanged || playbackModeChanged;
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
          : isRecordingsFeature(item)
            ? {
                settings: {
                  ...(item.settings ?? {}),
                  recording_playback_mode: draft.recordingPlaybackMode
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
        description="Control student-side modules and global operational switches across the LMS."
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
          <strong>Global portal controls</strong>
          <p>Student visibility controls manage navigation and direct URLs. System switches such as Email Delivery can pause operational actions without changing templates, history, or data access.</p>
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
              <span className="eyebrow">Portal controls</span>
              <h2>Feature controls</h2>
            </div>
            <span>{items.length} controls</span>
          </header>
          <div className="feature-control-list">
            {items.map((item) => {
              const isWidget = isWhatsAppWidget(item);
              const isRecordings = isRecordingsFeature(item);
              const isEmailService = isEmailServiceFeature(item);
              const draft = drafts[item.id] ?? {
                recordingPlaybackMode: getRecordingPlaybackMode(item),
                status: item.status,
                upcomingMessage: item.upcomingMessage ?? '',
                whatsappNumber: getWhatsAppNumber(item)
              };
              const dirty = isDirty(item, draft);
              const isSaving = updateFeature.isPending;

              return (
                <article
                  className={`feature-control-row ${isWidget ? 'feature-control-row--widget' : ''} ${isRecordings ? 'feature-control-row--recordings' : ''} ${isEmailService ? 'feature-control-row--email' : ''}`}
                  key={item.id}
                >
                  <div className="feature-control-row__module">
                    <div className="feature-control-row__icon">{isEmailService ? <Mail size={17} /> : item.isCore ? <LockKeyhole size={17} /> : statusIcon(item.status)}</div>
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
                    <span>{getStatusDescription(item, draft.status)}</span>
                  </label>

                  <label className="feature-control-field feature-control-field--message">
                    {isWidget ? 'Widget help text' : isEmailService ? 'Paused message' : 'Upcoming message'}
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

                  {isRecordings ? (
                    <label className="feature-control-field feature-control-field--playback">
                      Recording playback mode
                      <select disabled={isSaving} value={draft.recordingPlaybackMode} onChange={(event) => updateDraft(item.id, { recordingPlaybackMode: event.target.value as RecordingPlaybackMode })}>
                        <option value="external">Open YouTube / external link</option>
                        <option value="popup">In-portal popup player</option>
                      </select>
                      <span>Global setting for all student recording links. Non-YouTube URLs will still open externally.</span>
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
        <span>Feature Control changes affect global portal behavior. Email Delivery pauses real outbound sends only; recipient previews, templates, history, permissions, and student data remain unchanged.</span>
      </section>
    </div>
  );
}
