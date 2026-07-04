import { AlertTriangle, Bold, CheckCircle, CheckSquare, Edit3, Italic, Link, List, ListOrdered, Plus, RefreshCw, RemoveFormatting, Search, Send, Square, Trash2, Underline, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StatusBadge } from '../components/StatusBadge';
import { AdminCohort, useAdminCohorts } from '../features/admin/useAdminCohorts';
import {
  AdminEmailTemplate,
  AdminEmailTemplatePayload,
  useAdminEmailQueue,
  useAdminEmailTemplates,
  useArchiveAdminEmailTemplate,
  useCreateAdminEmailTemplate,
  useResolveAdminEmailRecipients,
  useSendAdminEmail,
  useUpdateAdminEmailTemplate
} from '../features/admin/useAdminEmailCenter';
import { AdminResource, useAdminResources } from '../features/admin/useAdminResources';
import { AdminWorkshop, useAdminWorkshops } from '../features/admin/useAdminWorkshops';

type PhaseOption = {
  key: string;
  label: string;
  variables: string[];
};

const phaseOptions: PhaseOption[] = [
  { key: 'custom', label: 'Custom Mail', variables: ['student_name', 'student_email', 'program', 'cohort', 'portal_url'] },
  { key: 'auth', label: 'Auth / Portal Access', variables: ['student_name', 'student_email', 'action_link', 'portal_url'] },
  { key: 'onboarding', label: 'Onboarding', variables: ['student_name', 'student_email', 'program', 'programs', 'cohort', 'cohorts', 'whatsapp_groups', 'google_groups', 'cohort_group_details', 'portal_url'] },
  { key: 'workshop_link', label: 'Workshop Link', variables: ['student_name', 'workshop_title', 'workshop_time', 'join_url', 'cohort'] },
  { key: 'reminder', label: 'Reminder', variables: ['student_name', 'workshop_title', 'workshop_time', 'join_url', 'cohort'] },
  { key: 'recording_update', label: 'Recording Update', variables: ['student_name', 'workshop_title', 'recording_url', 'cohort'] },
  { key: 'resource_share', label: 'Resource Sharing', variables: ['student_name', 'resource_title', 'resource_link', 'program', 'cohort'] },
  { key: 'certificate', label: 'Certificate', variables: ['student_name', 'student_email', 'certificate_id', 'certificate_download_url', 'verification_url', 'program', 'cohort'] },
  { key: 'support', label: 'Support', variables: ['student_name', 'ticket_id', 'ticket_subject', 'reply_body', 'portal_url'] },
  { key: 'project_submission', label: 'Project Submission', variables: ['student_name', 'project_title', 'project_role', 'submission_status', 'portal_url'] },
  { key: 'payment', label: 'Payment', variables: ['student_name', 'item_title', 'amount', 'payment_status', 'portal_url'] },
  { key: 'enrollment', label: 'Enrollment', variables: ['student_name', 'program', 'cohort', 'enrollment_status', 'portal_url'] },
  { key: 'placement', label: 'Placement', variables: ['student_name', 'program', 'cohort', 'portal_url'] },
  { key: 'general', label: 'General', variables: ['student_name', 'student_email', 'program', 'cohort', 'portal_url'] }
];

const sendModes = [
  { label: 'Direct student email(s)', value: 'direct' },
  { label: 'All students in selected cohort', value: 'cohort_students' },
  { label: 'Cohort Google Group', value: 'cohort_google_group' }
] as const;

type EmailCenterTab = 'compose' | 'templates' | 'activity';
type RelatedPickerKind = 'workshop' | 'recording' | 'resource' | null;

const emailTabs: { key: EmailCenterTab; label: string }[] = [
  { key: 'compose', label: 'Compose Mail' },
  { key: 'templates', label: 'Email Templates' },
  { key: 'activity', label: 'Recent Email Activity' }
];

const sampleVars: Record<string, string> = {
  action_link: 'https://dev.skilledsapiens.com/login',
  amount: 'INR 999',
  certificate_download_url: 'https://dev.skilledsapiens.com/student/certificates',
  certificate_id: 'SS-LP-2026-0001',
  cohort: 'MCLP-Test Cohort',
  cohort_group_details: 'MCLP-Test Cohort | WhatsApp: MCLP Student Group | WhatsApp link: https://chat.whatsapp.com/example\nSMLP-SP-B-2026 | WhatsApp: SMLP Student Group | WhatsApp link: https://chat.whatsapp.com/example2',
  cohorts: 'MCLP-Test Cohort',
  enrollment_status: 'approved',
  item_title: 'Premium resource',
  join_url: 'https://zoom.us/j/example',
  google_groups: 'mclp@googlegroups.com',
  payment_status: 'paid',
  portal_url: 'https://dev.skilledsapiens.com/',
  program: 'Management Consulting Leadership Program',
  programs: 'Management Consulting Leadership Program',
  project_role: 'Business Analyst',
  project_title: 'Live Project',
  recording_url: 'https://zoom.us/rec/example',
  reply_body: 'Your ticket has been updated.',
  resource_link: 'https://drive.google.com/example',
  resource_title: 'Case material',
  student_email: 'student@example.com',
  student_name: 'Saurabh',
  submission_status: 'approved',
  ticket_id: 'SUP-1001',
  ticket_subject: 'Portal query',
  verification_url: 'https://skilledsapiens.com/verify-your-certificate/',
  whatsapp_groups: 'MCLP Student Group - https://chat.whatsapp.com/example\nSMLP Student Group - https://chat.whatsapp.com/example2',
  workshop_time: '17 Jul 2026, 2:45 PM',
  workshop_title: 'Product & Brand Management'
};

function formatDateTime(value?: string) {
  if (!value) return 'Not refreshed yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function renderTemplate(value: string) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => sampleVars[key] ?? '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function sanitizeEmailHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(["']).*?\1/gi, '')
    .replace(/\son\w+=\S+/gi, '')
    .replace(/\s(href|src)=(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

function plainTextToHtml(value: string) {
  const blocks = value.split(/\n{2,}/).map((block) => block.trim());
  return blocks.length
    ? blocks.map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')
    : '';
}

function normalizeBodyForEditor(value: string) {
  if (!value) return '';
  return looksLikeHtml(value) ? sanitizeEmailHtml(value) : plainTextToHtml(value);
}

function renderTemplateHtml(value: string) {
  return sanitizeEmailHtml(renderTemplate(normalizeBodyForEditor(value)));
}

function splitEmails(value: string) {
  return Array.from(new Set(value.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean)));
}

function compactDate(value?: string) {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function workshopDateTime(workshop: AdminWorkshop) {
  const dateLabel = compactDate(workshop.date);
  return workshop.time ? `${dateLabel}, ${workshop.time}` : dateLabel;
}

function workshopTimestamp(workshop: AdminWorkshop) {
  if (!workshop.date) return null;
  const date = new Date(`${workshop.date}T${workshop.time || '00:00'}`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function safeTimestamp(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function isUpcomingScheduledWorkshop(workshop: AdminWorkshop) {
  if (workshop.status !== 'Scheduled') return false;
  const timestamp = workshopTimestamp(workshop);
  return timestamp === null || timestamp >= Date.now() - 86_400_000;
}

function isRecentRecordedWorkshop(workshop: AdminWorkshop) {
  if (!workshop.zoomRecordingUrl && !workshop.youtubeVideoUrl) return false;
  if (workshop.status === 'Cancelled' || workshop.status === 'Inactive') return false;
  const now = Date.now();
  const twoWeeksAgo = now - 14 * 86_400_000;
  const sessionTimestamp = workshopTimestamp(workshop);
  const updatedTimestamp = safeTimestamp(workshop.updatedAt);
  return [sessionTimestamp, updatedTimestamp].some((timestamp) => timestamp !== null && timestamp >= twoWeeksAgo && timestamp <= now + 86_400_000);
}

function relatedKindForPhase(phase: string): RelatedPickerKind {
  if (phase === 'workshop_link' || phase === 'reminder') return 'workshop';
  if (phase === 'recording_update') return 'recording';
  if (phase === 'resource_share') return 'resource';
  return null;
}

function relatedLabel(kind: RelatedPickerKind) {
  if (kind === 'recording') return 'Recording';
  if (kind === 'resource') return 'Resource';
  return 'Workshop';
}

function buildWorkshopCopy(phase: string, workshop: AdminWorkshop) {
  const title = workshop.title;
  const time = workshopDateTime(workshop);
  const cohorts = workshop.cohortNames?.join(', ') || 'Selected cohort';
  const joinUrl = workshop.joinUrl || '{{join_url}}';
  const intro = phase === 'reminder' ? 'This is a reminder for your upcoming live session.' : 'Your live session join link is ready.';

  return {
    params: {
      cohort: cohorts,
      join_url: joinUrl,
      workshop_time: time,
      workshop_title: title
    },
    subject: phase === 'reminder' ? `Reminder: ${title}` : `Join link for ${title}`,
    body: `Hi {{student_name}},

${intro}

Session: ${title}
Date and time: ${time}
Cohort: ${cohorts}

Join link:
${joinUrl}

Regards,
Skilled Sapiens Team`
  };
}

function buildRecordingCopy(workshop: AdminWorkshop) {
  const title = workshop.title;
  const cohorts = workshop.cohortNames?.join(', ') || 'Selected cohort';
  const recordingUrl = workshop.zoomRecordingUrl || workshop.youtubeVideoUrl || '{{recording_url}}';

  return {
    params: {
      cohort: cohorts,
      recording_url: recordingUrl,
      workshop_title: title
    },
    subject: `Recording available: ${title}`,
    body: `Hi {{student_name}},

The recording for your session is now available.

Session: ${title}
Cohort: ${cohorts}

Recording link:
${recordingUrl}

Regards,
Skilled Sapiens Team`
  };
}

function buildResourceCopy(resource: AdminResource) {
  const programs = resource.programKeys?.join(', ') || '{{program}}';
  const cohorts = resource.cohortNames?.join(', ') || '{{cohort}}';
  const resourceUrl = resource.url || '{{resource_link}}';

  return {
    params: {
      cohort: cohorts,
      program: programs,
      resource_link: resourceUrl,
      resource_title: resource.title
    },
    subject: `New resource shared: ${resource.title}`,
    body: `Hi {{student_name}},

A resource has been shared for your LMS account.

Resource: ${resource.title}
Program: ${programs}
Cohort: ${cohorts}

Open resource:
${resourceUrl}

Regards,
Skilled Sapiens Team`
  };
}

function phaseLabel(key: string) {
  const phaseKey = normalizeTemplatePhase(key);
  return phaseOptions.find((phase) => phase.key === phaseKey)?.label ?? key;
}

function slugifyTemplateKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 56) || 'custom_template';
}

function normalizeTemplatePhase(value?: string | null) {
  const normalized = slugifyTemplateKey(value || 'custom');
  const matched = phaseOptions.find((phase) => phase.key === normalized || slugifyTemplateKey(phase.label) === normalized);
  return matched?.key ?? normalized;
}

function templateCategoryForPhase(phase: string, rawCategory?: string | null) {
  const normalizedCategory = slugifyTemplateKey(rawCategory || '');
  if (['auth', 'transactional', 'general'].includes(normalizedCategory)) return normalizedCategory;

  const normalizedPhase = normalizeTemplatePhase(phase || rawCategory || 'custom');
  if (normalizedPhase === 'auth' || normalizedPhase === 'onboarding') return 'auth';
  if (normalizedPhase === 'custom' || normalizedPhase === 'general' || normalizedPhase === 'placement') return 'general';
  return 'transactional';
}

function templateDraftFrom(template?: AdminEmailTemplate | null): AdminEmailTemplatePayload {
  const phase = normalizeTemplatePhase(template?.phase ?? template?.category ?? 'custom');
  return {
    allowedVariables: template?.allowedVariables?.length ? template.allowedVariables : phaseOptions.find((option) => option.key === phase)?.variables ?? phaseOptions[0].variables,
    body: normalizeBodyForEditor(template?.body ?? ''),
    category: templateCategoryForPhase(phase, template?.category),
    defaultTags: template?.defaultTags ?? ['lms'],
    description: template?.description ?? '',
    isSystem: template?.isSystem ?? false,
    phase,
    sampleParams: template?.sampleParams ?? {},
    sortOrder: template?.sortOrder ?? 100,
    status: template?.status ?? 'active',
    subject: template?.subject ?? '',
    templateKey: template?.templateKey,
    templateName: template?.templateName ?? ''
  };
}

function useAvailableVariables(phase: string, template?: AdminEmailTemplate | null) {
  return useMemo(() => {
    const phaseVars = phaseOptions.find((option) => option.key === phase)?.variables ?? [];
    return Array.from(new Set([...(template?.allowedVariables ?? []), ...phaseVars]));
  }, [phase, template?.allowedVariables]);
}

function emailSendMessage(result: { error?: string; failed?: number; message?: string; ok?: boolean; sent?: number }, fallback: string) {
  if (result.message?.trim()) return result.message.trim();
  if (result.error?.trim()) return result.error.trim();
  if (result.ok && typeof result.sent === 'number') return `Email sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'}.`;
  if (typeof result.failed === 'number' && result.failed > 0) return `${result.failed} email${result.failed === 1 ? '' : 's'} failed to send.`;
  return fallback;
}

export function AdminEmailCenterPage() {
  const templatesQuery = useAdminEmailTemplates({ sort: 'order', status: 'all' });
  const queueQuery = useAdminEmailQueue({ limit: 20 });
  const cohortsQuery = useAdminCohorts({ limit: 500, page: 1, status: 'all' });
  const workshopsQuery = useAdminWorkshops({ limit: 300, page: 1, status: 'all' });
  const resourcesQuery = useAdminResources({ limit: 300, page: 1, status: 'active' });
  const createTemplate = useCreateAdminEmailTemplate();
  const updateTemplate = useUpdateAdminEmailTemplate();
  const archiveTemplate = useArchiveAdminEmailTemplate();
  const resolveRecipients = useResolveAdminEmailRecipients();
  const sendEmail = useSendAdminEmail();
  const [activeTab, setActiveTab] = useState<EmailCenterTab>('compose');
  const [phase, setPhase] = useState('custom');
  const [templateKey, setTemplateKey] = useState('custom_blank');
  const [relatedItemId, setRelatedItemId] = useState('');
  const [relatedParams, setRelatedParams] = useState<Record<string, unknown>>({});
  const [sendMode, setSendMode] = useState<(typeof sendModes)[number]['value']>('direct');
  const [directEmails, setDirectEmails] = useState('');
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [cohortSearch, setCohortSearch] = useState('');
  const [googleGroupEmail, setGoogleGroupEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [batchSize, setBatchSize] = useState(50);
  const [resolvedSummary, setResolvedSummary] = useState<Awaited<ReturnType<typeof resolveRecipients.mutateAsync>> | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [modal, setModal] = useState<{ draft: AdminEmailTemplatePayload; template?: AdminEmailTemplate | null } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');

  const templates = templatesQuery.data?.items ?? [];
  const activeTemplates = templates.filter((template) => template.status === 'active');
  const selectedTemplate = activeTemplates.find((template) => template.templateKey === templateKey) ?? null;
  const phaseTemplates = activeTemplates.filter((template) => template.phase === phase || template.category === phase);
  const templateCategoryOptions = useMemo(() => {
    const categories = new Map(phaseOptions.map((option) => [option.key, option.label]));
    templates.forEach((template) => {
      const key = template.phase || template.category || 'general';
      if (!categories.has(key)) categories.set(key, phaseLabel(key));
    });
    return Array.from(categories.entries()).map(([key, label]) => ({ key, label }));
  }, [templates]);
  const filteredTemplates = templateCategoryFilter === 'all'
    ? templates
    : templates.filter((template) => template.phase === templateCategoryFilter || template.category === templateCategoryFilter);
  const relatedKind = relatedKindForPhase(phase);
  const workshops = workshopsQuery.data?.items ?? [];
  const resources = resourcesQuery.data?.items ?? [];
  const relatedItems = useMemo(() => {
    if (relatedKind === 'workshop') {
      return workshops
        .filter(isUpcomingScheduledWorkshop)
        .sort((first, second) => (workshopTimestamp(first) ?? Number.MAX_SAFE_INTEGER) - (workshopTimestamp(second) ?? Number.MAX_SAFE_INTEGER));
    }
    if (relatedKind === 'recording') {
      return workshops
        .filter(isRecentRecordedWorkshop)
        .sort((first, second) => (workshopTimestamp(second) ?? 0) - (workshopTimestamp(first) ?? 0));
    }
    if (relatedKind === 'resource') return resources.filter((resource) => resource.status === 'active');
    return [];
  }, [relatedKind, resources, workshops]);
  const cohorts = cohortsQuery.data?.items ?? [];
  const filteredCohorts = cohorts.filter((cohort) => cohort.name.toLowerCase().includes(cohortSearch.toLowerCase()) || (cohort.cohortId ?? '').toLowerCase().includes(cohortSearch.toLowerCase()));
  const selectedCohortRows = selectedCohorts.map((name) => cohorts.find((cohort) => cohort.name === name)).filter((cohort): cohort is AdminCohort => Boolean(cohort));
  const variables = useAvailableVariables(phase, selectedTemplate);
  const estimatedRecipientCount = sendMode === 'direct' ? splitEmails(directEmails).length : sendMode === 'cohort_google_group' ? selectedCohortRows.filter((cohort) => googleGroupEmail || cohort.googleGroup).length : selectedCohorts.length;
  const recipientCount = resolvedSummary?.recipients ?? estimatedRecipientCount;
  const lastRefresh = [templatesQuery.dataUpdatedAt, queueQuery.dataUpdatedAt, cohortsQuery.dataUpdatedAt].filter(Boolean).sort((a, b) => b - a)[0];

  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject);
    setBody(normalizeBodyForEditor(selectedTemplate.body));
  }, [selectedTemplate?.id]);

  useEffect(() => {
    setResolvedSummary(null);
    setConfirmSend(false);
  }, [batchSize, body, directEmails, googleGroupEmail, relatedParams, selectedCohorts, sendMode, subject, templateKey]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), message.tone === 'success' ? 5000 : 8000);
    return () => window.clearTimeout(timer);
  }, [message]);

  function handlePhaseChange(nextPhase: string) {
    setPhase(nextPhase);
    setTemplateKey('custom_blank');
    setSubject('');
    setBody('');
    setRelatedItemId('');
    setRelatedParams({});
  }

  function applyRelatedItem(itemId: string) {
    setRelatedItemId(itemId);
    if (!itemId || !relatedKind) {
      setRelatedParams({});
      return;
    }

    if (relatedKind === 'resource') {
      const resource = resources.find((item) => item.id === itemId);
      if (!resource) return;
      const copy = buildResourceCopy(resource);
      setSubject(copy.subject);
      setBody(normalizeBodyForEditor(copy.body));
      setRelatedParams(copy.params);
      if (resource.cohortNames?.length && selectedCohorts.length === 0) {
        setSelectedCohorts(resource.cohortNames);
        setSendMode('cohort_students');
      }
      return;
    }

    const workshop = workshops.find((item) => item.id === itemId);
    if (!workshop) return;
    const copy = relatedKind === 'recording' ? buildRecordingCopy(workshop) : buildWorkshopCopy(phase, workshop);
    setSubject(copy.subject);
    setBody(normalizeBodyForEditor(copy.body));
    setRelatedParams(copy.params);
    if (workshop.cohortNames?.length && selectedCohorts.length === 0) {
      setSelectedCohorts(workshop.cohortNames);
      setSendMode('cohort_students');
    }
  }

  function toggleCohort(name: string) {
    setSelectedCohorts((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  function useTemplate(template: AdminEmailTemplate) {
    setActiveTab('compose');
    setPhase(template.phase);
    setTemplateKey(template.templateKey);
    setSubject(template.subject);
    setBody(normalizeBodyForEditor(template.body));
    setMessage({ tone: 'success', text: `${template.templateName} loaded into composer.` });
  }

  function insertVariable(variable: string, target: 'body' | 'subject' = 'body') {
    const token = `{{${variable}}}`;
    if (target === 'subject') setSubject((current) => `${current}${current.endsWith(' ') || !current ? '' : ' '}${token}`);
    else setBody((current) => `${current}<p>${token}</p>`);
  }

  function openTemplateModal(template?: AdminEmailTemplate | null) {
    setMessage(null);
    setModalError(null);
    setModal({ draft: templateDraftFrom(template ?? null), template: template ?? null });
  }

  function closeTemplateModal() {
    setModalError(null);
    setModal(null);
  }

  function emailPayload(confirmed = false) {
    return {
      action: 'sendAdminStudentCommunication' as const,
      batchSize,
      body: sanitizeEmailHtml(normalizeBodyForEditor(body)),
      cohortNames: selectedCohorts,
      confirmed,
      directEmails,
      googleGroupEmail,
      params: relatedParams,
      sendMode,
      subject,
      templateKey
    };
  }

  async function handleSendTestEmail() {
    setMessage(null);
    const email = testEmail.trim();
    if (!email) {
      setMessage({ tone: 'error', text: 'Enter a test email address first.' });
      return;
    }
    try {
      const result = await sendEmail.mutateAsync({
        ...emailPayload(true),
        batchSize: 1,
        directEmails: email,
        sendMode: 'direct',
        subject: `[TEST] ${subject}`,
        testMode: true
      });
      setMessage({ tone: result.ok ? 'success' : 'error', text: emailSendMessage(result, 'Test email request completed, but no delivery message was returned.') });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Test email could not be sent.' });
    }
  }

  async function handlePreview() {
    setMessage(null);
    try {
      const result = await resolveRecipients.mutateAsync(emailPayload(false));
      setResolvedSummary(result);
      setMessage({ tone: 'success', text: 'Recipient summary refreshed.' });
    } catch (error) {
      setResolvedSummary(null);
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Recipient summary could not be resolved.' });
    }
  }

  async function openSendConfirmation() {
    setMessage(null);
    try {
      const result = await resolveRecipients.mutateAsync(emailPayload(false));
      setResolvedSummary(result);
      if (result.willSend <= 0) {
        setMessage({ tone: 'error', text: result.message || 'No recipients are available for this batch.' });
        return;
      }
      setConfirmSend(true);
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Recipient summary could not be resolved.' });
    }
  }

  async function handleConfirmedSend() {
    setMessage(null);
    try {
      const result = await sendEmail.mutateAsync(emailPayload(true));
      setConfirmSend(false);
      setResolvedSummary(null);
      setMessage({ tone: result.ok ? 'success' : 'error', text: emailSendMessage(result, 'Email request completed, but no delivery message was returned.') });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Email could not be sent.' });
    }
  }

  async function saveTemplate() {
    if (!modal) return;
    setMessage(null);
    setModalError(null);
    try {
      const templateName = modal.draft.templateName.trim();
      const subjectText = modal.draft.subject.trim();
      const phaseValue = normalizeTemplatePhase(modal.draft.phase || modal.draft.category || 'custom');
      const categoryValue = templateCategoryForPhase(phaseValue, modal.draft.category);
      const bodyHtml = sanitizeEmailHtml(normalizeBodyForEditor(modal.draft.body));
      const bodyText = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
      if (!templateName) {
        setModalError('Template name is required.');
        return;
      }
      if (!subjectText) {
        setModalError('Subject is required.');
        return;
      }
      if (!bodyText) {
        setModalError('Message body is required.');
        return;
      }
      const templateKey =
        modal.draft.templateKey ||
        modal.template?.templateKey ||
        `${slugifyTemplateKey(phaseValue)}_${slugifyTemplateKey(templateName)}_${Date.now()}`;
      const draft = {
        ...modal.draft,
        body: bodyHtml,
        category: categoryValue,
        phase: phaseValue,
        subject: subjectText,
        templateKey,
        templateName
      };
      if (modal.template?.id) {
        await updateTemplate.mutateAsync({ body: draft, templateId: modal.template.id });
        setMessage({ tone: 'success', text: 'Email template updated.' });
      } else {
        await createTemplate.mutateAsync(draft);
        setMessage({ tone: 'success', text: 'Email template added.' });
      }
      setModal(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Template could not be saved.';
      setModalError(errorMessage);
      setMessage({ tone: 'error', text: errorMessage });
    }
  }

  async function archive(template: AdminEmailTemplate) {
    if (template.isSystem) {
      setMessage({ tone: 'error', text: 'System templates cannot be deleted. Set custom templates inactive instead.' });
      return;
    }
    if (!window.confirm(`Archive "${template.templateName}"? It will stop appearing as an active template.`)) return;
    try {
      await archiveTemplate.mutateAsync(template.id);
      setMessage({ tone: 'success', text: 'Email template archived.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Template could not be archived.' });
    }
  }

  if (templatesQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading email templates and communication tools." eyebrow="Module refresh" title="Email" />
        <LoadingState />
      </div>
    );
  }

  if (templatesQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Email templates could not be loaded from the database." eyebrow="Module refresh" title="Email unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-email-center-page">
      <PageHeader
        actions={
          <button className="segmented-button" onClick={() => void Promise.all([templatesQuery.refetch(), queueQuery.refetch(), cohortsQuery.refetch(), workshopsQuery.refetch(), resourcesQuery.refetch()])} type="button">
            <RefreshCw size={18} />
            Refresh Email
          </button>
        }
        description={`Refresh only email data from the database. Last Refresh: ${formatDateTime(lastRefresh ? new Date(lastRefresh).toISOString() : undefined)}`}
        eyebrow="Module refresh"
        title="Email"
      />

      {message ? (
        <div className={`admin-email-toast admin-email-toast--${message.tone}`} role="status" aria-live="polite">
          {message.tone === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span>{message.text}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage(null)} type="button">
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div className="admin-email-tabs" role="tablist" aria-label="Email centre sections">
        {emailTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'admin-email-tab admin-email-tab--active' : 'admin-email-tab'}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'compose' ? (
      <div className="admin-email-grid">
        <section className="admin-email-card">
          <div className="admin-email-card__header">
            <span className="eyebrow">Email Center</span>
            <h2>Send Student Communication</h2>
          </div>
          <div className="admin-email-form">
            <label>
              <span>Email Phase *</span>
              <select value={phase} onChange={(event) => handlePhaseChange(event.target.value)}>
                {phaseOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Template *</span>
              <select value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>
                <option value="custom_blank">Custom (Blank)</option>
                {phaseTemplates.map((template) => (
                  <option key={template.id} value={template.templateKey}>{template.templateName}</option>
                ))}
              </select>
            </label>

            {relatedKind ? (
              <label className="admin-email-wide">
                <span>Select {relatedLabel(relatedKind)} *</span>
                <select value={relatedItemId} onChange={(event) => applyRelatedItem(event.target.value)}>
                  <option value="">Choose {relatedLabel(relatedKind).toLowerCase()}</option>
                  {relatedItems.map((item) => {
                    if (relatedKind === 'resource') {
                      const resource = item as AdminResource;
                      return (
                        <option key={resource.id} value={resource.id}>
                          {resource.title} · {resource.programKeys?.join(', ') || 'All programs'}
                        </option>
                      );
                    }
                    const workshop = item as AdminWorkshop;
                    return (
                      <option key={workshop.id} value={workshop.id}>
                        {workshop.title} · {workshopDateTime(workshop)} · {workshop.cohortNames?.join(', ') || 'No cohort'}
                      </option>
                    );
                  })}
                </select>
                <small>
                  {relatedKind === 'recording'
                    ? 'Shows only workshops with recording links from the last two weeks. Selection fills the message body and cohort targeting where available.'
                    : relatedKind === 'workshop'
                      ? 'Shows only upcoming workshops with Scheduled status. Selection fills the message body and cohort targeting where available.'
                      : 'Selection fills the message body and cohort targeting where available.'}
                </small>
              </label>
            ) : null}

            <label className="admin-email-wide">
              <span>Send To</span>
              <select value={sendMode} onChange={(event) => setSendMode(event.target.value as typeof sendMode)}>
                {sendModes.map((mode) => (
                  <option key={mode.value} value={mode.value}>{mode.label}</option>
                ))}
              </select>
            </label>

            {sendMode === 'direct' ? (
              <label className="admin-email-wide">
                <span>Student Emails *</span>
                <textarea onChange={(event) => setDirectEmails(event.target.value)} placeholder="student1@email.com, student2@email.com, ..." value={directEmails} />
                <small>Enter one or more emails separated by commas.</small>
              </label>
            ) : (
              <div className="admin-email-wide">
                <span className="admin-email-label">Select Cohort(s) *</span>
                <div className="admin-email-cohort-picker">
                  <div className="admin-email-cohort-search">
                    <Search size={18} />
                    <input onChange={(event) => setCohortSearch(event.target.value)} placeholder="Search cohorts..." value={cohortSearch} />
                    <button type="button" onClick={() => setSelectedCohorts(filteredCohorts.map((cohort) => cohort.name))}>Select all</button>
                    <button type="button" onClick={() => setSelectedCohorts([])}>Remove all</button>
                  </div>
                  <div className="admin-email-cohort-list">
                    {filteredCohorts.slice(0, 80).map((cohort) => {
                      const checked = selectedCohorts.includes(cohort.name);
                      return (
                        <button className={checked ? 'admin-email-cohort-option admin-email-cohort-option--selected' : 'admin-email-cohort-option'} key={cohort.id} onClick={() => toggleCohort(cohort.name)} type="button">
                          {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                          <span>{cohort.name}</span>
                          <small>{cohort.programKey}</small>
                        </button>
                      );
                    })}
                  </div>
                  <strong>{selectedCohorts.length ? `${selectedCohorts.length} cohort${selectedCohorts.length === 1 ? '' : 's'} selected` : 'No cohorts selected'}</strong>
                </div>
              </div>
            )}

            {sendMode === 'cohort_google_group' ? (
              <label className="admin-email-wide">
                <span>Google Group Email</span>
                <input onChange={(event) => setGoogleGroupEmail(event.target.value)} placeholder={selectedCohortRows[0]?.googleGroup || 'cohort-group@googlegroups.com'} value={googleGroupEmail} />
                <small>Auto-fills from selected cohort if configured. You can override before sending.</small>
              </label>
            ) : null}

            <label className="admin-email-wide">
              <span>Subject *</span>
              <input onChange={(event) => setSubject(event.target.value)} placeholder="Subject line" value={subject} />
            </label>
            <div className="admin-email-wide">
              <span className="admin-email-label">Message Body *</span>
              <RichTextEditor
                onChange={setBody}
                placeholder="Write the email body. Use toolbar buttons for formatting and variable chips below for personalization."
                value={body}
              />
              <small>Templates are managed below and saved to the shared database.</small>
            </div>
            <div className="admin-email-variables admin-email-wide">
              <strong>Available variables</strong>
              <span>Click to insert</span>
              <div>
                {variables.map((variable) => (
                  <button key={variable} onClick={() => insertVariable(variable)} type="button">{`{{${variable}}}`}</button>
                ))}
              </div>
            </div>
            <div className="admin-email-actions admin-email-wide">
              <label className="admin-email-batch-size">
                <span>Batch size</span>
                <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <button className="segmented-button" disabled={resolveRecipients.isPending} type="button" onClick={() => void handlePreview()}>
                {resolveRecipients.isPending ? 'Checking...' : 'Preview'}
              </button>
              <button className="student-action student-action--primary" disabled={sendEmail.isPending || resolveRecipients.isPending} onClick={() => void openSendConfirmation()} type="button">
                <Send size={18} />
                {sendEmail.isPending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
            <div className="admin-email-test-send admin-email-wide">
              <label>
                <span>Test Email</span>
                <input onChange={(event) => setTestEmail(event.target.value)} placeholder="Send a test to one email before the real batch" value={testEmail} />
              </label>
              <button className="segmented-button" disabled={sendEmail.isPending} onClick={() => void handleSendTestEmail()} type="button">
                Send Test
              </button>
            </div>
            <div className="admin-email-batch admin-email-wide">
              <span>Daily Brevo package limit is set to 300 LMS emails. Email Centre sends a controlled batch and skips recipients who already received the same template today.</span>
              <button disabled={sendEmail.isPending || resolveRecipients.isPending || phase !== 'onboarding' || selectedCohorts.length === 0} onClick={() => void openSendConfirmation()} type="button">
                Send Pending Onboarding Batch
              </button>
            </div>
          </div>
        </section>

        <aside className="admin-email-side">
          <section className="admin-email-card">
            <div className="admin-email-card__header">
              <span className="eyebrow">Preview</span>
              <h2>Email Summary</h2>
            </div>
            <div className="admin-email-summary">
              <article>
                <span>Recipients</span>
                <strong>{recipientCount}</strong>
                <small>{resolvedSummary ? 'Exact resolved count' : 'Estimated until preview is refreshed'}</small>
              </article>
              <article>
                <span>Mode</span>
                <strong>{sendModes.find((mode) => mode.value === sendMode)?.label}</strong>
              </article>
              <article>
                <span>Daily Limit</span>
                <strong>{resolvedSummary ? `${resolvedSummary.remainingToday} / ${resolvedSummary.dailyLimit} left today` : '300 mails / day'}</strong>
              </article>
              <article>
                <span>This Batch</span>
                <strong>{resolvedSummary ? `${resolvedSummary.willSend} will send` : `${batchSize} max batch`}</strong>
                {resolvedSummary ? <small>{resolvedSummary.alreadySentToday} skipped because this template was already sent today. {resolvedSummary.remainingAfterBatch} remain after this batch.</small> : null}
              </article>
              <article>
                <span>Cohort</span>
                <strong>{selectedCohorts.length ? selectedCohorts.join(', ') : 'Not selected'}</strong>
              </article>
              {recipientCount === 0 ? <div className="auth-alert auth-alert--error">Add at least one email recipient.</div> : null}
              {resolvedSummary?.previewRecipients?.length ? (
                <div className="admin-email-recipient-preview">
                  <span>First recipients</span>
                  {resolvedSummary.previewRecipients.map((recipient) => (
                    <p key={recipient.email}>{recipient.name} · {recipient.email}</p>
                  ))}
                </div>
              ) : null}
              <article>
                <span>Subject</span>
                <strong>{renderTemplate(subject) || 'Subject will appear here'}</strong>
              </article>
              <article>
                <span>Sample Body</span>
                <div
                  className="admin-email-rendered-preview"
                  dangerouslySetInnerHTML={{ __html: renderTemplateHtml(body) || '<p>Message preview will appear here.</p>' }}
                />
              </article>
            </div>
          </section>
        </aside>
      </div>
      ) : null}

      {activeTab === 'templates' ? (
        <section className="admin-email-card">
          <div className="admin-email-card__header admin-email-card__header--row">
            <div>
              <span className="eyebrow">Saved Templates</span>
              <h2>Email Templates</h2>
            </div>
            <div className="admin-email-template-toolbar">
              <label>
                <span>Category</span>
                <select value={templateCategoryFilter} onChange={(event) => setTemplateCategoryFilter(event.target.value)}>
                  <option value="all">All categories</option>
                  {templateCategoryOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button
                className="student-action student-action--primary"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openTemplateModal(null);
                }}
                type="button"
              >
                <Plus size={18} />
                Add Template
              </button>
            </div>
          </div>
          <div className="admin-email-template-list">
            {filteredTemplates.length === 0 ? <EmptyState /> : null}
            {filteredTemplates.map((template) => (
              <article className="admin-email-template-row" key={template.id}>
                <div>
                  <h3>{template.templateName} <StatusBadge tone={template.isSystem ? 'safe' : 'danger'}>{template.isSystem ? 'System' : 'Custom'}</StatusBadge></h3>
                  <p>{phaseLabel(template.phase)} · {template.allowedVariables?.length ?? 0} variables · {template.status}</p>
                  <span>{template.description || template.subject}</span>
                </div>
                <div className="admin-email-template-actions">
                  <button onClick={() => useTemplate(template)} type="button">Use</button>
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openTemplateModal(template);
                    }}
                    type="button"
                  >
                    <Edit3 size={16} /> Edit
                  </button>
                  <button
                    className="danger-button"
                    disabled={template.status === 'inactive' || template.isSystem}
                    onClick={() => void archive(template)}
                    title={template.isSystem ? 'System templates are protected and cannot be deleted.' : template.status === 'inactive' ? 'This template is already archived.' : 'Archive this custom template.'}
                    type="button"
                  >
                    <Trash2 size={16} /> {template.isSystem ? 'Locked' : template.status === 'inactive' ? 'Archived' : 'Del'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'activity' ? (
        <section className="admin-email-card">
          <div className="admin-email-card__header">
            <span className="eyebrow">Delivery history</span>
            <h2>Recent Email Activity</h2>
          </div>
          <div className="admin-email-history">
            {queueQuery.data?.items?.length ? queueQuery.data.items.map((item) => (
              <article key={item.id} className={`admin-email-history-row admin-email-history-row--${item.status || 'queued'}`}>
                <div>
                  <strong>{item.recipientName || item.recipientEmail || 'Recipient not set'}</strong>
                  <span>{item.templateKey || item.category || 'custom'} · {item.status || 'queued'} · {formatDateTime(item.sentAt || item.createdAt)}</span>
                  {item.failureMessage ? <p>{item.failureMessage}</p> : null}
                </div>
                <small>{item.subject || 'No subject'}</small>
              </article>
            )) : <EmptyState />}
          </div>
        </section>
      ) : null}

      {modal ? (
        <EmailTemplateModal
          draft={modal.draft}
          error={modalError}
          isSaving={createTemplate.isPending || updateTemplate.isPending}
          onClose={closeTemplateModal}
          onDraftChange={(draft) => setModal((current) => (current ? { ...current, draft } : current))}
          onSave={() => void saveTemplate()}
          template={modal.template}
        />
      ) : null}

      {confirmSend && resolvedSummary ? (
        <div className="modal-backdrop admin-email-modal-backdrop" role="presentation">
          <section className="admin-email-confirm" role="dialog" aria-modal="true" aria-label="Confirm email send">
            <button className="student-modal__close" onClick={() => setConfirmSend(false)} type="button" aria-label="Close">
              <X size={28} />
            </button>
            <AlertTriangle size={28} />
            <h2>Confirm Email Batch</h2>
            <p>This will send email through Brevo using the active LMS template. Daily limit is capped at 300 mails.</p>
            <div className="admin-email-confirm__grid">
              <article><span>Resolved recipients</span><strong>{resolvedSummary.recipients}</strong></article>
              <article><span>Already sent today</span><strong>{resolvedSummary.alreadySentToday}</strong></article>
              <article><span>This batch</span><strong>{resolvedSummary.willSend}</strong></article>
              <article><span>Remaining today</span><strong>{resolvedSummary.remainingToday}</strong></article>
            </div>
            <div className="admin-email-confirm__actions">
              <button className="segmented-button" disabled={sendEmail.isPending} onClick={() => setConfirmSend(false)} type="button">Cancel</button>
              <button className="student-action student-action--primary" disabled={sendEmail.isPending || resolvedSummary.willSend <= 0} onClick={() => void handleConfirmedSend()} type="button">
                <Send size={18} />
                {sendEmail.isPending ? 'Sending...' : `Send ${resolvedSummary.willSend} Email${resolvedSummary.willSend === 1 ? '' : 's'}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function EmailTemplateModal({
  draft,
  error,
  isSaving,
  onClose,
  onDraftChange,
  onSave,
  template
}: {
  draft: AdminEmailTemplatePayload;
  error?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onDraftChange: (draft: AdminEmailTemplatePayload) => void;
  onSave: () => void;
  template?: AdminEmailTemplate | null;
}) {
  const variables = Array.from(new Set([...(draft.allowedVariables ?? []), ...(phaseOptions.find((phase) => phase.key === draft.phase)?.variables ?? [])]));
  const isSystemTemplate = Boolean(template?.isSystem || draft.isSystem);

  function patch(next: Partial<AdminEmailTemplatePayload>) {
    onDraftChange({ ...draft, ...next });
  }

  function insertVariable(variable: string) {
    patch({ body: `${draft.body}<p>{{${variable}}}</p>` });
  }

  return (
    <div className="modal-backdrop admin-email-modal-backdrop" role="presentation">
      <section className="admin-email-modal" role="dialog" aria-modal="true" aria-label={template ? 'Edit email template' : 'Add email template'}>
        <button className="student-modal__close" onClick={onClose} type="button" aria-label="Close">
          <X size={28} />
        </button>
        <div className="admin-email-modal__header">
          <h2>{template ? 'Edit Email Template' : 'Add Email Template'}</h2>
          <p>Create or customize reusable LMS email templates. System templates keep their safe variable list so admins can edit copy without guessing placeholders.</p>
        </div>
        <div className="admin-email-modal__form">
          <label>
            <span>Template Name *</span>
            <input disabled={isSystemTemplate} value={draft.templateName} onChange={(event) => patch({ templateName: event.target.value })} placeholder="e.g. Custom Welcome Mail" />
          </label>
          <label>
            <span>Phase / Category *</span>
            <select disabled={isSystemTemplate} value={draft.phase} onChange={(event) => patch({ allowedVariables: phaseOptions.find((phase) => phase.key === event.target.value)?.variables ?? [], category: event.target.value, phase: event.target.value })}>
              {phaseOptions.map((phase) => (
                <option key={phase.key} value={phase.key}>{phase.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Status *</span>
            <select disabled={isSystemTemplate} value={draft.status} onChange={(event) => patch({ status: event.target.value as AdminEmailTemplatePayload['status'] })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          {draft.isSystem ? (
            <div className="admin-email-system-note">
              <strong>System template</strong>
              <span>{draft.description || 'Used by automated LMS workflows.'}</span>
            </div>
          ) : null}
          <label>
            <span>Subject *</span>
            <input value={draft.subject} onChange={(event) => patch({ subject: event.target.value })} placeholder="Email subject line" />
          </label>
          <div>
            <span className="admin-email-label">Message Body *</span>
            <RichTextEditor
              key={template?.id ?? 'new-email-template'}
              onChange={(nextBody) => patch({ body: nextBody })}
              placeholder="Email body text. Click variable chips below to insert placeholders."
              value={draft.body}
            />
          </div>
          <div className="admin-email-variables">
            <strong>Available variables</strong>
            <span>Click to insert</span>
            <div>
              {variables.map((variable) => (
                <button key={variable} onClick={() => insertVariable(variable)} type="button">{`{{${variable}}}`}</button>
              ))}
            </div>
          </div>
          <div className="admin-email-modal__preview">
            <div>
              <strong>Sample preview</strong>
              <span>Uses sample registry data</span>
            </div>
            <span>Subject</span>
            <p>{renderTemplate(draft.subject) || 'Subject preview'}</p>
            <span>Body</span>
            <div
              className="admin-email-rendered-preview"
              dangerouslySetInnerHTML={{ __html: renderTemplateHtml(draft.body) || '<p>Body preview</p>' }}
            />
          </div>
          {error ? (
            <div className="admin-email-modal__error" role="alert">
              {error}
            </div>
          ) : null}
          <div className="admin-email-modal__actions">
            <button className="student-action student-action--danger" disabled={isSaving} onClick={onSave} type="button">
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
            <button className="segmented-button" disabled={isSaving} onClick={onClose} type="button">
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function RichTextEditor({
  onChange,
  placeholder,
  value
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const nextValue = normalizeBodyForEditor(value);
    if (editor.innerHTML !== nextValue) editor.innerHTML = nextValue;
  }, [value]);

  function emitChange() {
    onChange(sanitizeEmailHtml(editorRef.current?.innerHTML ?? ''));
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function addLink() {
    const rawUrl = window.prompt('Paste the link URL');
    if (!rawUrl) return;
    const trimmed = rawUrl.trim();
    const url = /^(https?:|mailto:)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!/^(https?:\/\/|mailto:[^\s@]+@[^\s@]+\.[^\s@]+)/i.test(url)) return;
    runCommand('createLink', url);
  }

  return (
    <div className="admin-email-rte">
      <div className="admin-email-rte__toolbar" aria-label="Email body formatting tools">
        <button aria-label="Bold" onClick={() => runCommand('bold')} title="Bold" type="button"><Bold size={16} /></button>
        <button aria-label="Italic" onClick={() => runCommand('italic')} title="Italic" type="button"><Italic size={16} /></button>
        <button aria-label="Underline" onClick={() => runCommand('underline')} title="Underline" type="button"><Underline size={16} /></button>
        <button aria-label="Bulleted list" onClick={() => runCommand('insertUnorderedList')} title="Bulleted list" type="button"><List size={16} /></button>
        <button aria-label="Numbered list" onClick={() => runCommand('insertOrderedList')} title="Numbered list" type="button"><ListOrdered size={16} /></button>
        <button aria-label="Insert link" onClick={addLink} title="Insert link" type="button"><Link size={16} /></button>
        <button aria-label="Clear formatting" onClick={() => runCommand('removeFormat')} title="Clear formatting" type="button"><RemoveFormatting size={16} /></button>
      </div>
      <div
        className="admin-email-rte__editor"
        contentEditable
        data-placeholder={placeholder}
        onBlur={emitChange}
        onInput={emitChange}
        ref={editorRef}
        suppressContentEditableWarning
      />
    </div>
  );
}
