import { Ban, BookOpen, Bold, ChevronDown, ChevronUp, Eye, Italic, Layers3, Link as LinkIcon, List, Pencil, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, Underline, Video, X } from 'lucide-react';
import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataColumn, DataPanel } from '../components/DataPanel';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { ProjectRichText } from '../components/ProjectRichText';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminRecordingSection,
  AdminRecordingSequenceRule,
  useAdminRecordingResourceLinks,
  useAdminRecordingResourceSummary,
  useAdminRecordingSequenceRules
} from '../features/admin/useAdminRecordingCandidates';
import type { AdminWorkshop } from '../features/admin/useAdminWorkshops';
import { useAdminWorkshops } from '../features/admin/useAdminWorkshops';
import { AdminResource, useAdminResources } from '../features/admin/useAdminResources';
import {
  AdminProgram,
  AdminProgramCtaButton,
  AdminProgramFaq,
  AdminProgramImpact,
  AdminProgramStatus,
  AdminProgramWritePayload,
  AdminStudentGuidanceContent,
  AdminStudentGuidanceContentStatus,
  useAdminProgramImpact,
  useAdminPrograms,
  useAdminStudentGuidanceContent,
  useCreateAdminProgram,
  useUpdateAdminStudentGuidanceContent,
  useUpdateAdminProgram,
  useUpdateAdminProgramStatus
} from '../features/admin/useAdminPrograms';
import { loadSavedWorkshopTopicRecords, uniqueTitles } from '../lib/workshopTopics';
import type { WorkshopTopicRecord } from '../lib/workshopTopics';
import { useAdminProgramTemplates, useSaveAdminProgramTemplate } from '../features/admin/useAdminProgramTemplates';

const statusOptions: Array<AdminProgramStatus | 'all'> = ['all', 'active', 'inactive'];

type ProgramTemplate = {
  domainLabel: string;
  name: string;
  programKey: string;
  shortName: string;
};

type ProgramFormState = {
  bannerUrl: string;
  careerOutcomes: string;
  catalogueBadge: string;
  certificateDetails: string;
  ctaButtons: AdminProgramCtaButton[];
  curriculum: string;
  domainLabel: string;
  duration: string;
  faqs: AdminProgramFaq[];
  guestCatalogueEnabled: boolean;
  highlights: string;
  liveProjectDetails: string;
  mentorSupport: string;
  name: string;
  nextBatchDate: string;
  outcomes: string;
  overview: string;
  pricing: string;
  programKey: string;
  scheduleFormat: string;
  shortDescription: string;
  shortName: string;
  status: AdminProgramStatus;
  thumbnailUrl: string;
  toolsCovered: string;
  whatYouWillLearn: string;
  whoShouldJoin: string;
};

type PendingStatusChange = {
  nextStatus: AdminProgramStatus;
  program: AdminProgram;
};

type ProgramTemplateItem = {
  id: string;
  matchAliases?: string[];
  resourceIds: string[];
  topicTitle: string;
};

type ProgramTemplateResourceManager = {
  recordingIds: string[];
  resourceIds: string[];
  title: string;
};

type ProgramTemplateChapter = {
  id: string;
  items: ProgramTemplateItem[];
  title: string;
};

type ProgramTemplateFlow = {
  chapters: ProgramTemplateChapter[];
  programKey: string;
  updatedAt?: string;
};

type ProgramAccordionKey = 'guidance' | 'records' | 'template';

type ProgramAccordionSectionProps = {
  activeSection: ProgramAccordionKey | null;
  children: ReactNode;
  eyebrow: string;
  sectionKey: ProgramAccordionKey;
  setActiveSection: (section: ProgramAccordionKey | null) => void;
  title: string;
};

const programTemplates: ProgramTemplate[] = [
  { domainLabel: 'Consulting', name: 'Management Consulting Leadership Program', programKey: 'mclp', shortName: 'MCLP' },
  { domainLabel: 'Sales & Marketing', name: 'Sales & Marketing Leadership Program', programKey: 'smlp', shortName: 'SMLP' },
  { domainLabel: 'HR', name: 'HR Leadership Program', programKey: 'hrlp', shortName: 'HRLP' },
  { domainLabel: 'Finance ER', name: 'Finance Leadership Program - ER', programKey: 'flp_er', shortName: 'FLP ER' },
  { domainLabel: 'Finance QF', name: 'Finance Leadership Program - QF', programKey: 'flp_qf', shortName: 'FLP QF' },
  { domainLabel: 'Product', name: 'Product Management Leadership Program', programKey: 'pmlp', shortName: 'PMLP' },
  { domainLabel: 'GD-PI', name: 'GD-PI Mentorship Program', programKey: 'gd_pi', shortName: 'GD-PI' },
  { domainLabel: 'Mgmt Projects', name: 'Live Projects - Management Tracks', programKey: 'live_mgmt', shortName: 'Mgmt Projects' },
  { domainLabel: 'HR Projects', name: 'Live Projects - HR Track', programKey: 'live_hr', shortName: 'HR Projects' },
  { domainLabel: 'ER Projects', name: 'Live Projects - ER Track', programKey: 'live_er', shortName: 'ER Projects' },
  { domainLabel: 'QF Projects', name: 'Live Projects - QF Track', programKey: 'live_qf', shortName: 'QF Projects' },
  { domainLabel: 'PEVC Projects', name: 'Live Projects - PEVC Track', programKey: 'live_pevc', shortName: 'PEVC Projects' },
  { domainLabel: 'Placement', name: 'Placement Mentorship Program', programKey: 'placement', shortName: 'Placement' }
];

function ProgramAccordionSection({ activeSection, children, eyebrow, sectionKey, setActiveSection, title }: ProgramAccordionSectionProps) {
  const isOpen = activeSection === sectionKey;
  return (
    <section className={isOpen ? 'program-accordion program-accordion--open' : 'program-accordion'}>
      <button
        aria-expanded={isOpen}
        className="program-accordion__trigger"
        onClick={() => setActiveSection(isOpen ? null : sectionKey)}
        type="button"
      >
        <span>
          <small>{eyebrow}</small>
          <strong>{title}</strong>
        </span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {isOpen ? <div className="program-accordion__body">{children}</div> : null}
    </section>
  );
}

const programTemplateBuilderStorageKey = 'admin-program-template-builder-v1';
const programTemplateChapterLabels: Record<AdminRecordingSection, string> = {
  core_modules: 'Core Modules',
  induction_live_project: 'Induction & Live Project Overview',
  other_workshops: 'Other Workshops',
  placement_mentorship: 'Placement Mentorship'
};
const programTemplateChapterOrder: AdminRecordingSection[] = ['induction_live_project', 'core_modules', 'placement_mentorship', 'other_workshops'];

function createTemplateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyProgramTemplateFlow(programKey: string): ProgramTemplateFlow {
  return {
    chapters: [
      { id: createTemplateId('chapter'), items: [], title: 'Induction & Live Project Overview' },
      { id: createTemplateId('chapter'), items: [], title: 'Core Modules' },
      { id: createTemplateId('chapter'), items: [], title: 'Placement Mentorship' }
    ],
    programKey
  };
}

function normalizeTemplateFlow(flow: ProgramTemplateFlow): ProgramTemplateFlow {
  return {
    chapters: flow.chapters.map((chapter) => ({
      id: chapter.id || createTemplateId('chapter'),
      items: chapter.items.map((item) => ({
        id: item.id || createTemplateId('module'),
        matchAliases: uniqueTitles(item.matchAliases ?? []).filter((title) => title.trim()),
        resourceIds: uniqueTitles(item.resourceIds ?? []),
        topicTitle: item.topicTitle ?? ''
      })),
      title: chapter.title || 'Untitled chapter'
    })),
    programKey: flow.programKey,
    updatedAt: flow.updatedAt
  };
}

function loadProgramTemplateFlows(): Record<string, ProgramTemplateFlow> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(programTemplateBuilderStorageKey) ?? '{}') as Record<string, ProgramTemplateFlow>;
    return Object.fromEntries(Object.entries(parsed).map(([programKey, flow]) => [programKey, normalizeTemplateFlow({ ...flow, programKey })]));
  } catch {
    return {};
  }
}

function saveProgramTemplateFlows(flows: Record<string, ProgramTemplateFlow>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(programTemplateBuilderStorageKey, JSON.stringify(flows));
}

function normalizeTopicLookupKey(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function topicKeysMatch(left: string, right: string) {
  const leftKey = normalizeTopicLookupKey(left);
  const rightKey = normalizeTopicLookupKey(right);
  if (!leftKey || !rightKey) return false;
  return leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey);
}

function topicResourceIds(topicRecords: WorkshopTopicRecord[], title: string) {
  const key = normalizeTopicLookupKey(title);
  if (!key) return [];
  return uniqueTitles(topicRecords.filter((topic) => topicKeysMatch(topic.title, title)).flatMap((topic) => topic.resourceIds ?? []));
}

function moduleMatchTitles(item: ProgramTemplateItem) {
  return uniqueTitles([item.topicTitle, ...(item.matchAliases ?? [])].map((title) => title.trim()).filter(Boolean));
}

function moduleResourceIds(item: ProgramTemplateItem, topicRecords: WorkshopTopicRecord[]) {
  return uniqueTitles([...(item.resourceIds ?? []), ...moduleMatchTitles(item).flatMap((title) => topicResourceIds(topicRecords, title))]);
}

function resourceCountForTopicTitle(title: string, resourceCountByTopicKey: Map<string, number>) {
  let count = 0;
  resourceCountByTopicKey.forEach((resourceCount, topicKey) => {
    if (topicKeysMatch(title, topicKey)) {
      count = Math.max(count, resourceCount);
    }
  });
  return count;
}

function moduleResourceCount(item: ProgramTemplateItem, topicRecords: WorkshopTopicRecord[], resourceCountByTopicKey: Map<string, number>) {
  return Math.max(moduleResourceIds(item, topicRecords).length, ...moduleMatchTitles(item).map((title) => resourceCountForTopicTitle(title, resourceCountByTopicKey)), 0);
}

function resourceSummary(resource: AdminResource) {
  return [resource.resourceMode, resource.resourceType, resource.programKeys?.slice(0, 2).join(', '), resource.cohortNames?.slice(0, 2).join(', ')]
    .filter(Boolean)
    .join(' · ');
}

function buildFlowFromSequenceRules(programKey: string, rules: AdminRecordingSequenceRule[], topicRecords: WorkshopTopicRecord[]) {
  const normalizedProgramKey = programKey.trim().toLowerCase();
  const relevantRules = rules
    .filter((rule) => rule.status === 'active' && rule.programKey.trim().toLowerCase() === normalizedProgramKey)
    .sort((first, second) => {
      const firstSectionIndex = programTemplateChapterOrder.indexOf(first.recordingSection);
      const secondSectionIndex = programTemplateChapterOrder.indexOf(second.recordingSection);
      if (firstSectionIndex !== secondSectionIndex) return firstSectionIndex - secondSectionIndex;
      if (first.sequenceNumber !== second.sequenceNumber) return first.sequenceNumber - second.sequenceNumber;
      return first.title.localeCompare(second.title);
    });

  const chapters = new Map<AdminRecordingSection, ProgramTemplateItem[]>();
  relevantRules.forEach((rule) => {
    const section = rule.recordingSection ?? 'other_workshops';
    const matchAliases = uniqueTitles(rule.matchAliases ?? []).filter((title) => title.trim() && !topicKeysMatch(title, rule.title));
    chapters.set(section, [
      ...(chapters.get(section) ?? []),
      {
        id: rule.id,
        matchAliases,
        resourceIds: uniqueTitles([rule.title, ...matchAliases].flatMap((title) => topicResourceIds(topicRecords, title))),
        topicTitle: rule.title
      }
    ]);
  });

  return {
    chapters: programTemplateChapterOrder
      .map((section) => ({
        id: `${normalizedProgramKey}-${section}`,
        items: chapters.get(section) ?? [],
        title: programTemplateChapterLabels[section]
      }))
      .filter((chapter) => chapter.items.length > 0 || chapter.title !== 'Other Workshops'),
    programKey,
    updatedAt: new Date().toISOString()
  } satisfies ProgramTemplateFlow;
}

function asPositiveInteger(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseStatus(value: string | null): AdminProgramStatus | 'all' {
  return statusOptions.includes(value as AdminProgramStatus | 'all') ? (value as AdminProgramStatus | 'all') : 'all';
}

function formatDate(value: string | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  }).format(date);
}

function formatAuditAction(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeProgramKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function buildPageLink(page: number, search: string, status: AdminProgramStatus | 'all', domain: string) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (status !== 'all') params.set('status', status);
  if (domain) params.set('domain', domain);
  return `?${params.toString()}`;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function linesToList(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n') : '';
}

function cleanCtaRows(value: AdminProgramCtaButton[]) {
  return value
    .map((item) => ({
      label: item.label.trim(),
      url: item.url.trim(),
      variant: (item.variant === 'secondary' ? 'secondary' : 'primary') as AdminProgramCtaButton['variant']
    }))
    .filter((item) => item.label || item.url);
}

function cleanFaqRows(value: AdminProgramFaq[]) {
  return value
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim()
    }))
    .filter((item) => item.question || item.answer);
}

function hasInvalidUrl(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed && !/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/'));
}

function formFromProgram(program: AdminProgram | null): ProgramFormState {
  const template = programTemplates[0];
  return {
    bannerUrl: program?.bannerUrl ?? '',
    careerOutcomes: program?.careerOutcomes ?? '',
    catalogueBadge: program?.catalogueBadge ?? '',
    certificateDetails: program?.certificateDetails ?? '',
    ctaButtons: program?.ctaButtons?.length ? program.ctaButtons : [{ label: 'Request Access', url: '', variant: 'primary' }],
    curriculum: listToLines(program?.curriculum),
    domainLabel: program?.domainLabel ?? template.domainLabel,
    duration: program?.duration ?? '',
    faqs: program?.faqs?.length ? program.faqs : [{ question: '', answer: '' }],
    guestCatalogueEnabled: program?.guestCatalogueEnabled ?? true,
    highlights: listToLines(program?.highlights),
    liveProjectDetails: program?.liveProjectDetails ?? '',
    mentorSupport: program?.mentorSupport ?? '',
    name: program?.name ?? template.name,
    nextBatchDate: program?.nextBatchDate ?? '',
    outcomes: listToLines(program?.outcomes),
    overview: program?.overview ?? '',
    pricing: program?.pricing ?? '',
    programKey: program?.programKey ?? template.programKey,
    scheduleFormat: program?.scheduleFormat ?? '',
    shortDescription: program?.shortDescription ?? '',
    shortName: program?.shortName ?? template.shortName,
    status: program?.status ?? 'active',
    thumbnailUrl: program?.thumbnailUrl ?? '',
    toolsCovered: program?.toolsCovered ?? '',
    whatYouWillLearn: program?.whatYouWillLearn ?? '',
    whoShouldJoin: program?.whoShouldJoin ?? ''
  };
}

function ProgramModal({
  existingPrograms,
  mode,
  onClose,
  onSaved,
  program
}: {
  existingPrograms: AdminProgram[];
  mode: 'add' | 'edit';
  onClose: () => void;
  onSaved: (message: string) => void;
  program?: AdminProgram;
}) {
  const [form, setForm] = useState<ProgramFormState>(() => formFromProgram(program ?? null));
  const [submitError, setSubmitError] = useState('');
  const createProgram = useCreateAdminProgram();
  const updateProgram = useUpdateAdminProgram();
  const isSaving = createProgram.isPending || updateProgram.isPending;
  const normalizedKey = normalizeProgramKey(form.programKey);
  const duplicateProgram = existingPrograms.find((item) => item.id !== program?.id && item.programKey.trim().toLowerCase() === normalizedKey);

  function updateForm(field: keyof ProgramFormState, value: string | boolean | AdminProgramCtaButton[] | AdminProgramFaq[]) {
    setSubmitError('');
    setForm((current) => ({
      ...current,
      [field]: field === 'programKey' && typeof value === 'string' ? normalizeProgramKey(value) : value
    }));
  }

  function updateCtaButton(index: number, field: keyof AdminProgramCtaButton, value: string) {
    updateForm(
      'ctaButtons',
      form.ctaButtons.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  }

  function addCtaButton() {
    updateForm('ctaButtons', [...form.ctaButtons, { label: '', url: '', variant: 'primary' }]);
  }

  function removeCtaButton(index: number) {
    const nextRows = form.ctaButtons.filter((_, itemIndex) => itemIndex !== index);
    updateForm('ctaButtons', nextRows.length ? nextRows : [{ label: '', url: '', variant: 'primary' }]);
  }

  function updateFaq(index: number, field: keyof AdminProgramFaq, value: string) {
    updateForm(
      'faqs',
      form.faqs.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  }

  function addFaq() {
    updateForm('faqs', [...form.faqs, { question: '', answer: '' }]);
  }

  function removeFaq(index: number) {
    const nextRows = form.faqs.filter((_, itemIndex) => itemIndex !== index);
    updateForm('faqs', nextRows.length ? nextRows : [{ question: '', answer: '' }]);
  }

  function applyTemplate(programKey: string) {
    const template = programTemplates.find((item) => item.programKey === programKey);
    if (!template) return;
    setSubmitError('');
    setForm((current) => ({
      ...current,
      domainLabel: template.domainLabel,
      name: template.name,
      programKey: template.programKey,
      shortName: template.shortName
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: AdminProgramWritePayload = {
      bannerUrl: nullableText(form.bannerUrl),
      careerOutcomes: nullableText(form.careerOutcomes),
      catalogueBadge: nullableText(form.catalogueBadge),
      certificateDetails: nullableText(form.certificateDetails),
      ctaButtons: cleanCtaRows(form.ctaButtons),
      curriculum: linesToList(form.curriculum),
      domainLabel: form.domainLabel.trim(),
      duration: nullableText(form.duration),
      faqs: cleanFaqRows(form.faqs),
      guestCatalogueEnabled: form.guestCatalogueEnabled,
      highlights: linesToList(form.highlights),
      liveProjectDetails: nullableText(form.liveProjectDetails),
      mentorSupport: nullableText(form.mentorSupport),
      name: form.name.trim(),
      nextBatchDate: nullableText(form.nextBatchDate),
      outcomes: linesToList(form.outcomes),
      overview: nullableText(form.overview),
      pricing: nullableText(form.pricing),
      programKey: normalizedKey,
      scheduleFormat: nullableText(form.scheduleFormat),
      shortDescription: nullableText(form.shortDescription),
      shortName: form.shortName.trim(),
      status: form.status,
      thumbnailUrl: nullableText(form.thumbnailUrl),
      toolsCovered: nullableText(form.toolsCovered),
      whatYouWillLearn: nullableText(form.whatYouWillLearn),
      whoShouldJoin: nullableText(form.whoShouldJoin)
    };

    if (!payload.name) {
      setSubmitError('Program name is required.');
      return;
    }
    if (mode === 'add' && !payload.programKey) {
      setSubmitError('Program key is required.');
      return;
    }
    if (duplicateProgram) {
      setSubmitError(`Program key "${payload.programKey}" is already used by ${duplicateProgram.name}.`);
      return;
    }
    const invalidCta = cleanCtaRows(form.ctaButtons).find((item) => !item.label || !item.url || hasInvalidUrl(item.url));
    if (invalidCta) {
      setSubmitError('Every CTA row needs a label and a valid http://, https://, or internal / link.');
      return;
    }
    const invalidFaq = cleanFaqRows(form.faqs).find((item) => !item.question || !item.answer);
    if (invalidFaq) {
      setSubmitError('Every FAQ row needs both a question and an answer.');
      return;
    }
    if ([form.thumbnailUrl, form.bannerUrl].some(hasInvalidUrl)) {
      setSubmitError('Image links must use http://, https://, or an internal / path.');
      return;
    }

    try {
      if (mode === 'edit' && program) {
        await updateProgram.mutateAsync({
          body: {
            bannerUrl: payload.bannerUrl,
            careerOutcomes: payload.careerOutcomes,
            catalogueBadge: payload.catalogueBadge,
            certificateDetails: payload.certificateDetails,
            ctaButtons: payload.ctaButtons,
            curriculum: payload.curriculum,
            domainLabel: payload.domainLabel,
            duration: payload.duration,
            faqs: payload.faqs,
            guestCatalogueEnabled: payload.guestCatalogueEnabled,
            highlights: payload.highlights,
            liveProjectDetails: payload.liveProjectDetails,
            mentorSupport: payload.mentorSupport,
            name: payload.name,
            nextBatchDate: payload.nextBatchDate,
            outcomes: payload.outcomes,
            overview: payload.overview,
            pricing: payload.pricing,
            scheduleFormat: payload.scheduleFormat,
            shortDescription: payload.shortDescription,
            shortName: payload.shortName,
            status: payload.status,
            thumbnailUrl: payload.thumbnailUrl,
            toolsCovered: payload.toolsCovered,
            whatYouWillLearn: payload.whatYouWillLearn,
            whoShouldJoin: payload.whoShouldJoin
          },
          programId: program.id
        });
      } else {
        await createProgram.mutateAsync(payload);
      }
      onSaved(mode === 'add' ? 'Program created successfully.' : 'Program updated successfully.');
      onClose();
    } catch (error) {
      setSubmitError(readableError(error, 'Program could not be saved.'));
    }
  }

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="program-modal-title" aria-modal="true" className="student-modal program-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <p className="program-modal-eyebrow">Program master</p>
            <h2 id="program-modal-title">{mode === 'add' ? 'Add Program' : 'Edit Program'}</h2>
          </div>
          <button aria-label="Close program form" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={22} />
          </button>
        </header>
        <div className="student-modal__body">
          {submitError ? <div className="auth-alert auth-alert--error">{submitError}</div> : null}
          <form className="program-form-shell" id="program-save-form" onSubmit={(event) => void handleSubmit(event)}>
            {mode === 'add' ? (
              <label className="program-form-shell__wide">
                <span>Start from template</span>
                <select value={programTemplates.some((template) => template.programKey === form.programKey) ? form.programKey : ''} onChange={(event) => applyTemplate(event.target.value)}>
                  {programTemplates.map((template) => (
                    <option key={template.programKey} value={template.programKey}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>Program name</span>
              <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="e.g. Management Consulting Leadership Program" />
            </label>
            <label>
              <span>Short name</span>
              <input value={form.shortName} onChange={(event) => updateForm('shortName', event.target.value)} placeholder="e.g. MCLP" />
            </label>
            <label>
              <span>Program key</span>
              <input readOnly={mode === 'edit'} value={form.programKey} onChange={(event) => updateForm('programKey', event.target.value)} placeholder="e.g. mclp" />
              {mode === 'edit' ? <small>Locked after creation to protect student and content mappings.</small> : null}
              {duplicateProgram ? <small className="program-field-warning">Already used by {duplicateProgram.name}.</small> : null}
            </label>
            <label>
              <span>Domain</span>
              <input value={form.domainLabel} onChange={(event) => updateForm('domainLabel', event.target.value)} placeholder="e.g. Consulting" />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value as AdminProgramStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <fieldset className="program-form-section">
              <legend>Guest catalogue</legend>
              <label className="program-form-toggle">
                <input checked={form.guestCatalogueEnabled} onChange={(event) => updateForm('guestCatalogueEnabled', event.target.checked)} type="checkbox" />
                <span>Show this program in Guest Program Catalogue</span>
              </label>
              <label>
                <span>Catalogue badge</span>
                <input value={form.catalogueBadge} onChange={(event) => updateForm('catalogueBadge', event.target.value)} placeholder="e.g. Corporate mentors driven" />
              </label>
              <label>
                <span>Duration</span>
                <input value={form.duration} onChange={(event) => updateForm('duration', event.target.value)} placeholder="e.g. 2-4 weeks" />
              </label>
              <label>
                <span>Pricing</span>
                <input value={form.pricing} onChange={(event) => updateForm('pricing', event.target.value)} placeholder="e.g. Registration starts at ₹6,499" />
              </label>
              <label>
                <span>Next batch date</span>
                <input value={form.nextBatchDate} onChange={(event) => updateForm('nextBatchDate', event.target.value)} type="date" />
              </label>
              <label>
                <span>Thumbnail URL</span>
                <input value={form.thumbnailUrl} onChange={(event) => updateForm('thumbnailUrl', event.target.value)} placeholder="https://..." />
              </label>
              <label>
                <span>Banner URL</span>
                <input value={form.bannerUrl} onChange={(event) => updateForm('bannerUrl', event.target.value)} placeholder="https://..." />
              </label>
            </fieldset>

            <fieldset className="program-form-section">
              <legend>Landing page copy</legend>
              <label className="program-form-shell__wide">
                <span>Short description</span>
                <textarea rows={3} value={form.shortDescription} onChange={(event) => updateForm('shortDescription', event.target.value)} placeholder="One short paragraph used on programme cards and hero." />
              </label>
              <label className="program-form-shell__wide">
                <span>Program overview</span>
                <textarea rows={5} value={form.overview} onChange={(event) => updateForm('overview', event.target.value)} placeholder="What this program helps the learner achieve." />
              </label>
              <label className="program-form-shell__wide">
                <span>Highlights</span>
                <textarea rows={3} value={form.highlights} onChange={(event) => updateForm('highlights', event.target.value)} placeholder="Add each highlight on a new line." />
              </label>
            </fieldset>

            <fieldset className="program-form-section">
              <legend>Learning details</legend>
              <label className="program-form-shell__wide">
                <span>Who should join</span>
                <textarea rows={4} value={form.whoShouldJoin} onChange={(event) => updateForm('whoShouldJoin', event.target.value)} />
              </label>
              <label className="program-form-shell__wide">
                <span>What you will learn</span>
                <textarea rows={4} value={form.whatYouWillLearn} onChange={(event) => updateForm('whatYouWillLearn', event.target.value)} />
              </label>
              <label className="program-form-shell__wide">
                <span>Curriculum modules</span>
                <textarea rows={5} value={form.curriculum} onChange={(event) => updateForm('curriculum', event.target.value)} placeholder="Add each module on a new line." />
              </label>
              <label className="program-form-shell__wide">
                <span>Tools covered</span>
                <textarea rows={3} value={form.toolsCovered} onChange={(event) => updateForm('toolsCovered', event.target.value)} />
              </label>
            </fieldset>

            <fieldset className="program-form-section">
              <legend>Outcomes and support</legend>
              <label className="program-form-shell__wide">
                <span>Live project details</span>
                <textarea rows={4} value={form.liveProjectDetails} onChange={(event) => updateForm('liveProjectDetails', event.target.value)} />
              </label>
              <label className="program-form-shell__wide">
                <span>Career outcomes</span>
                <textarea rows={4} value={form.careerOutcomes} onChange={(event) => updateForm('careerOutcomes', event.target.value)} />
              </label>
              <label className="program-form-shell__wide">
                <span>Outcomes list</span>
                <textarea rows={4} value={form.outcomes} onChange={(event) => updateForm('outcomes', event.target.value)} placeholder="Add each outcome on a new line." />
              </label>
              <label className="program-form-shell__wide">
                <span>Schedule format</span>
                <textarea rows={3} value={form.scheduleFormat} onChange={(event) => updateForm('scheduleFormat', event.target.value)} />
              </label>
              <label className="program-form-shell__wide">
                <span>Mentor support</span>
                <textarea rows={3} value={form.mentorSupport} onChange={(event) => updateForm('mentorSupport', event.target.value)} />
              </label>
              <label className="program-form-shell__wide">
                <span>Certificate details</span>
                <textarea rows={3} value={form.certificateDetails} onChange={(event) => updateForm('certificateDetails', event.target.value)} />
              </label>
            </fieldset>

            <fieldset className="program-form-section">
              <legend>CTA buttons</legend>
              {form.ctaButtons.map((button, index) => (
                <div className="program-repeat-row" key={`cta-${index}`}>
                  <label>
                    <span>Button label</span>
                    <input value={button.label} onChange={(event) => updateCtaButton(index, 'label', event.target.value)} placeholder="e.g. Pay registration fee" />
                  </label>
                  <label>
                    <span>Button link</span>
                    <input value={button.url} onChange={(event) => updateCtaButton(index, 'url', event.target.value)} placeholder="https://..." />
                  </label>
                  <label>
                    <span>Style</span>
                    <select value={button.variant ?? 'primary'} onChange={(event) => updateCtaButton(index, 'variant', event.target.value)}>
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                    </select>
                  </label>
                  <button className="segmented-button" onClick={() => removeCtaButton(index)} type="button">
                    Remove
                  </button>
                </div>
              ))}
              <button className="segmented-button segmented-button--gold program-form-shell__wide" onClick={addCtaButton} type="button">
                <Plus size={14} />
                Add CTA
              </button>
            </fieldset>

            <fieldset className="program-form-section">
              <legend>FAQs</legend>
              {form.faqs.map((faq, index) => (
                <div className="program-faq-row" key={`faq-${index}`}>
                  <label>
                    <span>Question</span>
                    <input value={faq.question} onChange={(event) => updateFaq(index, 'question', event.target.value)} />
                  </label>
                  <label>
                    <span>Answer</span>
                    <textarea rows={3} value={faq.answer} onChange={(event) => updateFaq(index, 'answer', event.target.value)} />
                  </label>
                  <button className="segmented-button" onClick={() => removeFaq(index)} type="button">
                    Remove FAQ
                  </button>
                </div>
              ))}
              <button className="segmented-button segmented-button--gold program-form-shell__wide" onClick={addFaq} type="button">
                <Plus size={14} />
                Add FAQ
              </button>
            </fieldset>
          </form>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="segmented-button segmented-button--active" disabled={isSaving || Boolean(duplicateProgram)} form="program-save-form" type="submit">
            {isSaving ? 'Saving...' : mode === 'add' ? 'Save Program' : 'Update Program'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ProgramDetailsModal({
  impact,
  isImpactLoading,
  onClose,
  onEdit,
  program
}: {
  impact?: AdminProgramImpact;
  isImpactLoading: boolean;
  onClose: () => void;
  onEdit: () => void;
  program: AdminProgram;
}) {
  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="program-details-title" aria-modal="true" className="student-modal program-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <p className="program-modal-eyebrow">Program details</p>
            <h2 id="program-details-title">{program.name}</h2>
          </div>
          <button aria-label="Close program details" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={22} />
          </button>
        </header>
        <div className="student-modal__body program-details-body">
          <div className="program-detail-summary">
            <div>
              <span>Status</span>
              <strong>{program.status}</strong>
            </div>
            <div>
              <span>Program key</span>
              <strong>{program.programKey}</strong>
            </div>
            <div>
              <span>Short name</span>
              <strong>{program.shortName ?? '-'}</strong>
            </div>
            <div>
              <span>Domain</span>
              <strong>{program.domainLabel ?? '-'}</strong>
            </div>
          </div>
          <section className="program-impact-section">
            <h3>Linked LMS data</h3>
            <div className="program-impact-grid" aria-busy={isImpactLoading}>
              <div>
                <span>Cohorts</span>
                <strong>{isImpactLoading ? '...' : impact?.cohorts ?? 0}</strong>
              </div>
              <div>
                <span>Students</span>
                <strong>{isImpactLoading ? '...' : impact?.students ?? 0}</strong>
              </div>
              <div>
                <span>Resources</span>
                <strong>{isImpactLoading ? '...' : impact?.resources ?? 0}</strong>
              </div>
              <div>
                <span>Workshops</span>
                <strong>{isImpactLoading ? '...' : impact?.workshops ?? 0}</strong>
              </div>
            </div>
          </section>
          <section className="program-impact-section">
            <h3>Recent activity</h3>
            {isImpactLoading ? (
              <p className="program-muted">Loading recent program activity...</p>
            ) : impact?.auditLogs.length ? (
              <div className="program-audit-list">
                {impact.auditLogs.map((entry) => (
                  <div key={entry.id}>
                    <strong>{formatAuditAction(entry.action)}</strong>
                    <span>
                      {entry.actorEmail || 'System'} · {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="program-muted">No recent program actions found.</p>
            )}
          </section>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" onClick={onClose} type="button">
            Close
          </button>
          <button className="segmented-button segmented-button--active" onClick={onEdit} type="button">
            <Pencil size={14} />
            Edit Program
          </button>
        </footer>
      </section>
    </div>
  );
}

function ProgramStatusModal({
  impact,
  isImpactLoading,
  isSaving,
  onClose,
  onConfirm,
  pending
}: {
  impact?: AdminProgramImpact;
  isImpactLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: PendingStatusChange;
}) {
  const isDeactivating = pending.nextStatus === 'inactive';
  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="program-status-title" aria-modal="true" className="student-modal program-modal" role="dialog">
        <header className="student-modal__header">
          <div>
            <p className="program-modal-eyebrow">Confirm status</p>
            <h2 id="program-status-title">{isDeactivating ? 'Deactivate Program' : 'Reactivate Program'}</h2>
          </div>
          <button aria-label="Close status confirmation" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={22} />
          </button>
        </header>
        <div className="student-modal__body program-details-body">
          <div className={isDeactivating ? 'program-status-warning' : 'program-status-warning program-status-warning--safe'}>
            <strong>{pending.program.name}</strong>
            <p>
              {isDeactivating
                ? 'This keeps existing data intact but removes the program from active admin selection flows.'
                : 'This makes the program available again in active admin selection flows.'}
            </p>
          </div>
          <div className="program-impact-grid" aria-busy={isImpactLoading}>
            <div>
              <span>Cohorts</span>
              <strong>{isImpactLoading ? '...' : impact?.cohorts ?? 0}</strong>
            </div>
            <div>
              <span>Students</span>
              <strong>{isImpactLoading ? '...' : impact?.students ?? 0}</strong>
            </div>
            <div>
              <span>Resources</span>
              <strong>{isImpactLoading ? '...' : impact?.resources ?? 0}</strong>
            </div>
            <div>
              <span>Workshops</span>
              <strong>{isImpactLoading ? '...' : impact?.workshops ?? 0}</strong>
            </div>
          </div>
        </div>
        <footer className="student-modal__footer">
          <button className="segmented-button" disabled={isSaving} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={isDeactivating ? 'segmented-button segmented-button--danger' : 'segmented-button segmented-button--active'} disabled={isSaving} onClick={onConfirm} type="button">
            {isSaving ? 'Saving...' : isDeactivating ? 'Deactivate' : 'Reactivate'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function cleanGuidanceHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\s(on\w+)=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href)=("|')\s*javascript:[^"']*\2/gi, ' href="#"')
    .trim();
}

function GuidanceRichTextEditor({
  html,
  onChange
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== html) {
      editor.innerHTML = html;
    }
  }, [html]);

  function syncContent() {
    onChange(cleanGuidanceHtml(editorRef.current?.innerHTML ?? ''));
  }

  function runCommand(event: ReactMouseEvent<HTMLButtonElement>, command: string, value?: string) {
    event.preventDefault();
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncContent();
  }

  function addLink(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const url = window.prompt('Paste a full https:// link');
    if (!url) return;
    if (!/^https?:\/\//i.test(url.trim())) {
      window.alert('Use a full http:// or https:// link.');
      return;
    }
    runCommand(event, 'createLink', url.trim());
  }

  return (
    <div className="guidance-rich-text">
      <div className="guidance-rich-text__toolbar" aria-label="Guidance formatting tools" role="toolbar">
        <button aria-label="Bold" onMouseDown={(event) => runCommand(event, 'bold')} type="button">
          <Bold size={16} />
        </button>
        <button aria-label="Italic" onMouseDown={(event) => runCommand(event, 'italic')} type="button">
          <Italic size={16} />
        </button>
        <button aria-label="Underline" onMouseDown={(event) => runCommand(event, 'underline')} type="button">
          <Underline size={16} />
        </button>
        <button aria-label="Bullet list" onMouseDown={(event) => runCommand(event, 'insertUnorderedList')} type="button">
          <List size={16} />
        </button>
        <button aria-label="Add link" onMouseDown={addLink} type="button">
          <LinkIcon size={16} />
        </button>
      </div>
      <div
        aria-label="Guidance reader content"
        className="guidance-rich-text__editor"
        contentEditable
        onBlur={syncContent}
        onInput={syncContent}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}

function GuidanceContentCard({
  item,
  onSaved
}: {
  item: AdminStudentGuidanceContent;
  onSaved: (message: string) => void;
}) {
  const updateGuidance = useUpdateAdminStudentGuidanceContent();
  const [title, setTitle] = useState(item.title);
  const [summary, setSummary] = useState(item.summary ?? '');
  const [content, setContent] = useState(item.content ?? '');
  const [status, setStatus] = useState<AdminStudentGuidanceContentStatus>(item.status);
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(item.title);
    setSummary(item.summary ?? '');
    setContent(item.content ?? '');
    setStatus(item.status);
    setError('');
  }, [item]);

  const isDirty = title !== item.title || summary !== (item.summary ?? '') || content !== (item.content ?? '') || status !== item.status;
  const label = item.contentKey === 'program_structure' ? 'Program structure reader' : 'Certificate reader';

  function resetForm() {
    setTitle(item.title);
    setSummary(item.summary ?? '');
    setContent(item.content ?? '');
    setStatus(item.status);
    setError('');
  }

  async function saveGuidance() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError('Title is required.');
      return;
    }

    try {
      setError('');
      await updateGuidance.mutateAsync({
        body: {
          audience: 'leadership',
          content: cleanGuidanceHtml(content),
          sortOrder: item.sortOrder,
          status,
          summary: summary.trim() || null,
          title: nextTitle
        },
        contentId: item.id
      });
      onSaved(`${label} updated successfully.`);
    } catch (saveError) {
      setError(readableError(saveError, `${label} could not be saved.`));
    }
  }

  return (
    <article className="program-guidance-card">
      <header className="program-guidance-card__header">
        <div>
          <span className="program-modal-eyebrow">{label}</span>
          <h3>{item.title}</h3>
        </div>
        <StatusBadge tone={status === 'active' ? 'safe' : 'warning'}>{status}</StatusBadge>
      </header>
      {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
      <div className="program-guidance-form">
        <label>
          <span>CTA title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>Short description</span>
          <input value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as AdminStudentGuidanceContentStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="program-guidance-form__wide">
          <span>Full-screen reader content</span>
          <GuidanceRichTextEditor html={content} onChange={setContent} />
        </div>
      </div>
      <div className="program-guidance-preview">
        <span>Student preview</span>
        <ProjectRichText className="program-guidance-preview__copy" html={content} />
      </div>
      <footer className="program-guidance-card__footer">
        <button className="segmented-button" disabled={!isDirty || updateGuidance.isPending} onClick={resetForm} type="button">
          Reset
        </button>
        <button className="segmented-button segmented-button--danger" disabled={!isDirty || updateGuidance.isPending} onClick={() => void saveGuidance()} type="button">
          <Save size={15} />
          {updateGuidance.isPending ? 'Saving...' : 'Save guidance'}
        </button>
      </footer>
    </article>
  );
}

function ProgramGuidanceSection({ onNotice }: { onNotice: (message: string) => void }) {
  const guidanceQuery = useAdminStudentGuidanceContent();
  const items = guidanceQuery.data?.items ?? [];

  return (
    <section className="program-guidance-panel">
      <header className="program-guidance-panel__header">
        <div>
          <span className="program-modal-eyebrow">Student clarity</span>
          <h2>Leadership program guidance</h2>
          <p>Controls the two full-screen explainers shown to leadership program students on the dashboard.</p>
        </div>
        <button className="segmented-button" disabled={guidanceQuery.isFetching} onClick={() => void guidanceQuery.refetch()} type="button">
          <RefreshCw size={15} />
          {guidanceQuery.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>
      {guidanceQuery.isError ? (
        <div className="auth-alert auth-alert--error">Guidance content could not be loaded. Program records are unchanged.</div>
      ) : guidanceQuery.isLoading ? (
        <LoadingState />
      ) : items.length > 0 ? (
        <div className="program-guidance-grid">
          {items.map((item) => (
            <GuidanceContentCard item={item} key={item.id} onSaved={onNotice} />
          ))}
        </div>
      ) : (
        <div className="auth-alert auth-alert--warning">Guidance content has not been seeded yet.</div>
      )}
    </section>
  );
}

function ProgramTemplateBuilder({ programs, onNotice }: { onNotice: (message: string) => void; programs: AdminProgram[] }) {
  const activePrograms = useMemo(() => programs.filter((program) => program.status === 'active'), [programs]);
  const selectablePrograms = activePrograms.length > 0 ? activePrograms : programs;
  const [selectedProgramKey, setSelectedProgramKey] = useState(() => selectablePrograms[0]?.programKey ?? '');
  const [topicRecords, setTopicRecords] = useState<WorkshopTopicRecord[]>(() => loadSavedWorkshopTopicRecords());
  const [flows, setFlows] = useState<Record<string, ProgramTemplateFlow>>(() => loadProgramTemplateFlows());
  const [resourceManager, setResourceManager] = useState<ProgramTemplateResourceManager | null>(null);
  const templatesQuery = useAdminProgramTemplates({ limit: 500, page: 1, status: 'all' });
  const saveProgramTemplateMutation = useSaveAdminProgramTemplate();
  const sequenceRulesQuery = useAdminRecordingSequenceRules({ limit: 1000, page: 1, status: 'active' });
  const workshopsQuery = useAdminWorkshops({ limit: 500, page: 1, status: 'all' });
  const selectedProgram = selectablePrograms.find((program) => program.programKey === selectedProgramKey) ?? selectablePrograms[0];
  const resourcesQuery = useAdminResources({ limit: 500, page: 1, status: 'active' });
  const resourceManagerLinksQuery = useAdminRecordingResourceLinks(resourceManager?.recordingIds[0]);
  const resources = resourcesQuery.data?.items ?? [];
  const activeSequenceRules = sequenceRulesQuery.data?.items ?? [];
  const selectedSequenceFlow = useMemo(
    () => (selectedProgram ? buildFlowFromSequenceRules(selectedProgram.programKey, activeSequenceRules, topicRecords) : null),
    [activeSequenceRules, selectedProgram, topicRecords]
  );
  const savedTemplateKeys = useMemo(() => new Set((templatesQuery.data?.items ?? []).map((template) => template.programKey)), [templatesQuery.data?.items]);
  const hasSavedTemplate = Boolean(selectedProgram && (savedTemplateKeys.has(selectedProgram.programKey) || flows[selectedProgram.programKey]));
  const selectedFlow = selectedProgram ? flows[selectedProgram.programKey] ?? selectedSequenceFlow ?? emptyProgramTemplateFlow(selectedProgram.programKey) : null;
  const selectedSequenceRuleCount = selectedSequenceFlow?.chapters.reduce((count, chapter) => count + chapter.items.length, 0) ?? 0;
  const templateSource = hasSavedTemplate ? 'Saved template' : selectedSequenceRuleCount > 0 ? 'Current sequence' : 'Empty setup';
  const topicTitles = useMemo(
    () => uniqueTitles([...(topicRecords.map((topic) => topic.title)), ...((selectedSequenceFlow?.chapters ?? []).flatMap((chapter) => chapter.items.map((item) => item.topicTitle)))]).sort((first, second) => first.localeCompare(second)),
    [selectedSequenceFlow, topicRecords]
  );
  const workshopTitleOptions = useMemo(
    () => uniqueTitles([...(workshopsQuery.data?.items ?? []).map((workshop) => workshop.title), ...topicTitles].filter((title) => title.trim())).sort((first, second) => first.localeCompare(second)),
    [topicTitles, workshopsQuery.data?.items]
  );
  const completedWorkshopsByTopic = useMemo(() => {
    const map = new Map<string, AdminWorkshop[]>();
    (workshopsQuery.data?.items ?? [])
      .filter((item) => item.status === 'Completed' && item.sessionType !== 'doubt_session')
      .forEach((item) => {
        const key = normalizeTopicLookupKey(item.title);
        if (!key) return;
        const rows = map.get(key) ?? [];
        rows.push(item);
        map.set(key, rows);
      });
    return map;
  }, [workshopsQuery.data?.items]);
  const templateRecordingIds = useMemo(() => {
    const topicTitlesForTemplate = (selectedFlow?.chapters ?? []).flatMap((chapter) => chapter.items.flatMap(moduleMatchTitles));
    const ids = new Set<string>();
    completedWorkshopsByTopic.forEach((items, completedTopicKey) => {
      if (topicTitlesForTemplate.some((topicTitle) => topicKeysMatch(topicTitle, completedTopicKey))) {
        items.forEach((item) => ids.add(item.id));
      }
    });
    return Array.from(ids);
  }, [completedWorkshopsByTopic, selectedFlow]);
  const resourceSummaryQuery = useAdminRecordingResourceSummary(templateRecordingIds);
  const recordingResourceCountById = useMemo(() => {
    const map = new Map<string, number>();
    resourceSummaryQuery.data?.items.forEach((item) => map.set(item.recordingId, item.resourceCount));
    return map;
  }, [resourceSummaryQuery.data?.items]);
  const resourceCountByTopicKey = useMemo(() => {
    const map = new Map<string, number>();
    completedWorkshopsByTopic.forEach((items, key) => {
      const counts = items.map((item) => recordingResourceCountById.get(item.id) ?? 0);
      map.set(key, Math.max(0, ...counts));
    });
    return map;
  }, [completedWorkshopsByTopic, recordingResourceCountById]);
  const metrics = useMemo(() => {
    const chapters = selectedFlow?.chapters ?? [];
    const modules = chapters.reduce((count, chapter) => count + chapter.items.length, 0);
    const resources = chapters.reduce(
      (count, chapter) =>
        count +
        chapter.items.reduce(
          (resourceCount, item) => resourceCount + moduleResourceCount(item, topicRecords, resourceCountByTopicKey),
          0
      ),
      0
    );
    return { chapters: chapters.length, modules, resources };
  }, [resourceCountByTopicKey, selectedFlow, topicRecords]);

  useEffect(() => {
    if (selectedProgramKey || selectablePrograms.length === 0) return;
    setSelectedProgramKey(selectablePrograms[0].programKey);
  }, [selectablePrograms, selectedProgramKey]);

  useEffect(() => {
    const templates = templatesQuery.data?.items;
    if (!templates) return;
    setFlows((current) => {
      const nextFlows = { ...current };
      templates.forEach((template) => {
        nextFlows[template.programKey] = normalizeTemplateFlow({
          chapters: template.chapters ?? [],
          programKey: template.programKey,
          updatedAt: template.updatedAt
        });
      });
      saveProgramTemplateFlows(nextFlows);
      return nextFlows;
    });
  }, [templatesQuery.data?.items]);

  function updateSelectedFlow(updater: (flow: ProgramTemplateFlow) => ProgramTemplateFlow) {
    if (!selectedProgram) return;
    setFlows((current) => {
      const currentFlow = current[selectedProgram.programKey] ?? selectedSequenceFlow ?? emptyProgramTemplateFlow(selectedProgram.programKey);
      return {
        ...current,
        [selectedProgram.programKey]: updater(currentFlow)
      };
    });
  }

  function moveChapter(chapterId: string, direction: -1 | 1) {
    updateSelectedFlow((flow) => {
      const index = flow.chapters.findIndex((chapter) => chapter.id === chapterId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= flow.chapters.length) return flow;
      const chapters = [...flow.chapters];
      const [chapter] = chapters.splice(index, 1);
      chapters.splice(nextIndex, 0, chapter);
      return { ...flow, chapters };
    });
  }

  function moveModule(chapterId: string, itemId: string, direction: -1 | 1) {
    updateSelectedFlow((flow) => ({
      ...flow,
      chapters: flow.chapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        const index = chapter.items.findIndex((item) => item.id === itemId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= chapter.items.length) return chapter;
        const items = [...chapter.items];
        const [item] = items.splice(index, 1);
        items.splice(nextIndex, 0, item);
        return { ...chapter, items };
      })
    }));
  }

  function removeModule(chapterId: string, itemId: string) {
    updateSelectedFlow((flow) => ({
      ...flow,
      chapters: flow.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              items: chapter.items.filter((item) => item.id !== itemId)
            }
          : chapter
      )
    }));
  }

  function updateModuleTitle(chapterId: string, itemId: string, topicTitle: string) {
    updateSelectedFlow((flow) => ({
      ...flow,
      chapters: flow.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              items: chapter.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      matchAliases: uniqueTitles(item.matchAliases ?? []).filter((title) => !topicKeysMatch(title, topicTitle)),
                      resourceIds: uniqueTitles(topicResourceIds(topicRecords, topicTitle)),
                      topicTitle
                    }
                  : item
              )
            }
          : chapter
      )
    }));
  }

  function addModuleMatchAlias(chapterId: string, itemId: string, title: string) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    updateSelectedFlow((flow) => ({
      ...flow,
      chapters: flow.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              items: chapter.items.map((item) => {
                if (item.id !== itemId) return item;
                if (topicKeysMatch(item.topicTitle, cleanTitle) || moduleMatchTitles(item).some((candidate) => topicKeysMatch(candidate, cleanTitle))) return item;
                return {
                  ...item,
                  matchAliases: uniqueTitles([...(item.matchAliases ?? []), cleanTitle]),
                  resourceIds: uniqueTitles([...moduleResourceIds(item, topicRecords), ...topicResourceIds(topicRecords, cleanTitle)])
                };
              })
            }
          : chapter
      )
    }));
  }

  function removeModuleMatchAlias(chapterId: string, itemId: string, title: string) {
    updateSelectedFlow((flow) => ({
      ...flow,
      chapters: flow.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              items: chapter.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      matchAliases: uniqueTitles(item.matchAliases ?? []).filter((candidate) => !topicKeysMatch(candidate, title))
                    }
                  : item
              )
            }
          : chapter
      )
    }));
  }

  function matchingCompletedRecordingIds(title: string) {
    const ids = new Set<string>();
    completedWorkshopsByTopic.forEach((items, topicKey) => {
      if (!topicKeysMatch(title, topicKey)) return;
      items.forEach((item) => ids.add(item.id));
    });
    return Array.from(ids);
  }

  function syncProgramResources() {
    updateSelectedFlow((flow) => ({
      ...flow,
      chapters: flow.chapters.map((chapter) => ({
        ...chapter,
        items: chapter.items.map((item) => ({
          ...item,
          resourceIds: uniqueTitles(moduleMatchTitles(item).flatMap((title) => topicResourceIds(topicRecords, title)))
        }))
      }))
    }));
    onNotice('Tagged resources refreshed for this program template.');
  }

  function openResourceManager(item: ProgramTemplateItem) {
    const title = item.topicTitle.trim();
    setResourceManager({
      resourceIds: moduleResourceIds(item, topicRecords),
      recordingIds: uniqueTitles(moduleMatchTitles(item).flatMap(matchingCompletedRecordingIds)),
      title: title || 'Untitled module'
    });
  }

  function closeResourceManager() {
    setResourceManager(null);
  }

  function materializeTemplateFlow(flow: ProgramTemplateFlow): ProgramTemplateFlow {
    return normalizeTemplateFlow({
      ...flow,
      chapters: flow.chapters.map((chapter) => ({
        ...chapter,
        items: chapter.items
          .filter((item) => item.topicTitle.trim())
          .map((item) => ({
            ...item,
            matchAliases: uniqueTitles(item.matchAliases ?? []).filter((title) => title.trim() && !topicKeysMatch(title, item.topicTitle)),
            resourceIds: uniqueTitles([...(item.resourceIds ?? []), ...moduleMatchTitles(item).flatMap((title) => topicResourceIds(topicRecords, title))])
          }))
      })),
      updatedAt: new Date().toISOString()
    });
  }

  async function persistTemplateFlow(flow: ProgramTemplateFlow, source: 'admin_template' | 'sequence_manager', notice: string) {
    if (!selectedProgram) return;
    const nextFlow = materializeTemplateFlow(flow);
    try {
      const savedTemplate = await saveProgramTemplateMutation.mutateAsync({
        chapters: nextFlow.chapters,
        programKey: nextFlow.programKey,
        source,
        status: 'draft'
      });
      const savedFlow = normalizeTemplateFlow({
        chapters: savedTemplate.chapters ?? nextFlow.chapters,
        programKey: savedTemplate.programKey,
        updatedAt: savedTemplate.updatedAt ?? nextFlow.updatedAt
      });
      const nextFlows = {
        ...flows,
        [selectedProgram.programKey]: savedFlow
      };
      setFlows(nextFlows);
      saveProgramTemplateFlows(nextFlows);
      onNotice(notice);
    } catch {
      onNotice('Program template could not be saved. Please try again.');
    }
  }

  function saveTemplate() {
    if (!selectedFlow || !selectedProgram) return;
    void persistTemplateFlow(selectedFlow, 'admin_template', `${selectedProgram.name} template saved.`);
  }

  function syncCurrentSequenceTemplate() {
    if (!selectedProgram || !selectedSequenceFlow) return;
    setFlows((current) => ({
      ...current,
      [selectedProgram.programKey]: selectedSequenceFlow
    }));
    void persistTemplateFlow(selectedSequenceFlow, 'sequence_manager', `${selectedProgram.name} template synced from current sequence rules.`);
  }

  function refreshTopics() {
    setTopicRecords(loadSavedWorkshopTopicRecords());
    onNotice('Meeting topics refreshed for the template builder.');
  }

  function renderResourceManager() {
    if (!resourceManager) return null;
    const linkedResourceIds = resourceManager.resourceIds.length > 0 ? resourceManager.resourceIds : resourceManagerLinksQuery.data?.resourceIds ?? [];
    const linkedResourceSet = new Set(linkedResourceIds);
    const isLoading = resourcesQuery.isLoading || (resourceManager.resourceIds.length === 0 && resourceManagerLinksQuery.isLoading);
    const linkedResources = resources
      .filter((resource) => linkedResourceSet.has(resource.id))
      .sort((left, right) => linkedResourceIds.indexOf(left.id) - linkedResourceIds.indexOf(right.id));

    return (
      <div className="admin-recording-resource-modal" role="dialog" aria-modal="true" aria-label="View module resources">
        <div className="admin-recording-resource-modal__panel">
          <div className="admin-recording-resource-modal__header">
            <div>
              <span className="section-eyebrow">RELATED RESOURCES</span>
              <h2>{resourceManager.title}</h2>
              {resourceManager.recordingIds.length > 0 ? (
                <p>
                  Linked Resource Library items from this topic. This matches {resourceManager.recordingIds.length} completed recording{resourceManager.recordingIds.length === 1 ? '' : 's'} with this title.
                </p>
              ) : (
                <p>Linked Resource Library items saved for this topic. Matching completed recordings can use this setup once they are published.</p>
              )}
            </div>
            <button className="admin-recording-action" onClick={closeResourceManager} type="button">
              Close
            </button>
          </div>
          {resourcesQuery.isError || resourceManagerLinksQuery.isError ? <div className="workshop-error-note">Related resources could not be loaded right now.</div> : null}
          {isLoading ? (
            <LoadingState />
          ) : (
            <div className="admin-recording-resource-picker">
              {linkedResources.length > 0 ? (
                linkedResources.map((resource) => (
                  <label className="admin-recording-resource-option" key={resource.id}>
                    <input checked readOnly disabled type="checkbox" />
                    <span>
                      <strong>{resource.title}</strong>
                      <small>{resourceSummary(resource) || 'Resource Library item'}</small>
                    </span>
                    {resource.url ? (
                      <a href={resource.url} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank">
                        Preview
                      </a>
                    ) : null}
                  </label>
                ))
              ) : (
                <p className="admin-recording-resource-empty">No related resources are linked for this module.</p>
              )}
            </div>
          )}
          <div className="admin-recording-resource-modal__actions">
            <span>{linkedResourceIds.length} linked resource{linkedResourceIds.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
    );
  }

  if (programs.length === 0) {
    return null;
  }

  return (
    <section className="program-template-builder">
      <header className="program-template-builder__header">
        <div>
          <span className="program-modal-eyebrow">Template setup</span>
          <h2>Program Template Builder</h2>
          <p>Create a reusable chapter and module flow for each program. Phase 2 mirrors current Sequence Manager data here without changing student visibility.</p>
        </div>
        <div className="program-template-builder__actions">
          <button className="segmented-button" onClick={refreshTopics} type="button">
            <RefreshCw size={15} />
            Refresh topics
          </button>
          <button className="segmented-button" onClick={syncProgramResources} type="button">
            <RefreshCw size={15} />
            Refresh tagged resources
          </button>
          <button className="segmented-button segmented-button--gold" disabled={saveProgramTemplateMutation.isPending} onClick={saveTemplate} type="button">
            <Save size={15} />
            {saveProgramTemplateMutation.isPending ? 'Saving...' : 'Save template'}
          </button>
        </div>
      </header>

      {templatesQuery.isError ? <div className="workshop-error-note">Saved program templates could not be loaded. Current sequence mapping is still available.</div> : null}

      <div className="program-template-toolbar">
        <label>
          <span>Program</span>
          <select value={selectedProgram?.programKey ?? ''} onChange={(event) => setSelectedProgramKey(event.target.value)}>
            {selectablePrograms.map((program) => (
              <option key={program.id} value={program.programKey}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <div className="program-template-toolbar__stats" aria-label="Selected program template summary">
          <StatusBadge>{`${metrics.chapters} chapters`}</StatusBadge>
          <StatusBadge>{`${metrics.modules} modules`}</StatusBadge>
          <StatusBadge>{`${metrics.resources} resources`}</StatusBadge>
          <StatusBadge>{templateSource}</StatusBadge>
        </div>
        <button
          className="segmented-button"
          disabled={!selectedProgram || sequenceRulesQuery.isLoading || saveProgramTemplateMutation.isPending || selectedSequenceRuleCount === 0}
          onClick={syncCurrentSequenceTemplate}
          type="button"
        >
          <List size={15} />
          {sequenceRulesQuery.isLoading ? 'Loading sequence...' : `Use current sequence (${selectedSequenceRuleCount})`}
        </button>
      </div>

      {selectedFlow ? (
        <div className="program-template-chapters">
          {selectedFlow.chapters.map((chapter, chapterIndex) => (
            <article className="program-template-chapter" key={chapter.id}>
              <header className="program-template-chapter__header">
                <label>
                  <span>Chapter {chapterIndex + 1}</span>
                  <input
                    value={chapter.title}
                    onChange={(event) =>
                      updateSelectedFlow((flow) => ({
                        ...flow,
                        chapters: flow.chapters.map((candidate) => (candidate.id === chapter.id ? { ...candidate, title: event.target.value } : candidate))
                      }))
                    }
                  />
                </label>
                <div className="program-template-chapter__actions">
                  <button className="icon-button" disabled={chapterIndex === 0} onClick={() => moveChapter(chapter.id, -1)} title="Move chapter up" type="button">
                    <ChevronUp size={16} />
                  </button>
                  <button className="icon-button" disabled={chapterIndex === selectedFlow.chapters.length - 1} onClick={() => moveChapter(chapter.id, 1)} title="Move chapter down" type="button">
                    <ChevronDown size={16} />
                  </button>
                  <button
                    className="segmented-button"
                    onClick={() =>
                      updateSelectedFlow((flow) => ({
                        ...flow,
                        chapters: flow.chapters.map((candidate) =>
                          candidate.id === chapter.id
                            ? {
                                ...candidate,
                                items: [
                                  ...candidate.items,
                                  {
                                    id: createTemplateId('module'),
                                    resourceIds: [],
                                    topicTitle: ''
                                  }
                                ]
                              }
                            : candidate
                        )
                      }))
                    }
                    type="button"
                  >
                    <Plus size={15} />
                    Module
                  </button>
                  <button
                    className="icon-button icon-button--danger"
                    disabled={selectedFlow.chapters.length <= 1}
                    onClick={() =>
                      updateSelectedFlow((flow) => ({
                        ...flow,
                        chapters: flow.chapters.filter((candidate) => candidate.id !== chapter.id)
                      }))
                    }
                    title="Remove chapter"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </header>

              <div className="program-template-module-list">
                {chapter.items.length === 0 ? (
                  <div className="program-template-empty">No modules added yet.</div>
                ) : (
                  chapter.items.map((item, itemIndex) => {
                    const linkedResourceCount = moduleResourceCount(item, topicRecords, resourceCountByTopicKey);
                    const matchTitles = moduleMatchTitles(item);
                    const aliasOptions = workshopTitleOptions.filter((title) => !matchTitles.some((candidate) => topicKeysMatch(candidate, title)));
                    return (
                      <div className="program-template-module-row" key={item.id || `${chapter.id}-${itemIndex}-${item.topicTitle}`}>
                        <Video size={16} />
                        <div className="program-template-row-reorder" aria-label={`Move ${item.topicTitle || 'module'}`}>
                          <button className="icon-button" disabled={itemIndex === 0} onClick={() => moveModule(chapter.id, item.id, -1)} title="Move module up" type="button">
                            <ChevronUp size={15} />
                          </button>
                          <button className="icon-button" disabled={itemIndex === chapter.items.length - 1} onClick={() => moveModule(chapter.id, item.id, 1)} title="Move module down" type="button">
                            <ChevronDown size={15} />
                          </button>
                        </div>
                        <div className="program-template-module-row__title">
                          {item.topicTitle.trim() ? (
                            <strong>{item.topicTitle}</strong>
                          ) : (
                            <select
                              aria-label="Select workshop title"
                              className="program-template-module-select"
                              disabled={workshopTitleOptions.length === 0}
                              onChange={(event) => updateModuleTitle(chapter.id, item.id, event.target.value)}
                              value=""
                            >
                              <option value="">Select workshop title</option>
                              {workshopTitleOptions.map((title) => (
                                <option key={title} value={title}>
                                  {title}
                                </option>
                              ))}
                            </select>
                          )}
                          <span>{linkedResourceCount > 0 ? `${linkedResourceCount} linked resource${linkedResourceCount === 1 ? '' : 's'}` : 'No resources linked'}</span>
                          {item.topicTitle.trim() ? (
                            <div className="program-template-match-options">
                              <div className="program-template-match-options__chips" aria-label="Workshop title match options">
                                <span className="program-template-match-chip">Option 1: {item.topicTitle}</span>
                                {(item.matchAliases ?? []).map((title, aliasIndex) => (
                                  <span className="program-template-match-chip" key={title}>
                                    Option {aliasIndex + 2}: {title}
                                    <button onClick={() => removeModuleMatchAlias(chapter.id, item.id, title)} title={`Remove ${title}`} type="button">
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <select
                                aria-label={`Add match option for ${item.topicTitle}`}
                                className="program-template-module-select"
                                disabled={aliasOptions.length === 0}
                                onChange={(event) => {
                                  addModuleMatchAlias(chapter.id, item.id, event.target.value);
                                  event.currentTarget.value = '';
                                }}
                                value=""
                              >
                                <option value="">Add match option</option>
                                {aliasOptions.map((title) => (
                                  <option key={title} value={title}>
                                    {title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </div>
                        <span className="program-template-count">{`${linkedResourceCount} Resources`}</span>
                        <button
                          className="segmented-button"
                          disabled={!item.topicTitle.trim()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openResourceManager(item);
                          }}
                          type="button"
                        >
                          <BookOpen size={14} />
                          Resources
                        </button>
                        <button className="icon-button icon-button--danger" onClick={() => removeModule(chapter.id, item.id)} title="Remove module" type="button">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          ))}
          <button
            className="segmented-button"
            onClick={() =>
              updateSelectedFlow((flow) => ({
                ...flow,
                chapters: [...flow.chapters, { id: createTemplateId('chapter'), items: [], title: 'New Chapter' }]
              }))
            }
            type="button"
          >
            <Plus size={15} />
            Add chapter
          </button>
        </div>
      ) : (
        <EmptyState />
      )}

      {renderResourceManager()}
    </section>
  );
}

export function AdminProgramsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = asPositiveInteger(searchParams.get('page'), 1);
  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search')?.trim() ?? '';
  const domain = searchParams.get('domain')?.trim() ?? '';
  const [programModal, setProgramModal] = useState<{ mode: 'add' | 'edit'; program?: AdminProgram } | null>(null);
  const [detailsProgram, setDetailsProgram] = useState<AdminProgram | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null);
  const [searchDraft, setSearchDraft] = useState(search);
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState<ProgramAccordionKey | null>(null);
  const programsQuery = useAdminPrograms({ domain, page, search, status });
  const catalogQuery = useAdminPrograms({ limit: 500, page: 1, status: 'all' });
  const impactTarget = pendingStatusChange?.program ?? detailsProgram;
  const impactQuery = useAdminProgramImpact(impactTarget);
  const updateStatus = useUpdateAdminProgramStatus();
  const data = programsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const catalogItems = catalogQuery.data?.items ?? [];
  const activeCount = useMemo(() => catalogItems.filter((item) => item.status === 'active').length, [catalogItems]);
  const domainOptions = useMemo(() => Array.from(new Set(catalogItems.map((item) => item.domainLabel).filter((value): value is string => Boolean(value)))).sort(), [catalogItems]);
  const domainCount = domainOptions.length;

  const updateParams = useCallback((nextValues: { domain?: string; page?: number; search?: string; status?: AdminProgramStatus | 'all' }) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextValues.page ?? 1));
    const nextSearch = nextValues.search ?? search;
    const nextStatus = nextValues.status ?? status;
    const nextDomain = nextValues.domain ?? domain;
    nextSearch ? next.set('search', nextSearch) : next.delete('search');
    nextStatus !== 'all' ? next.set('status', nextStatus) : next.delete('status');
    nextDomain ? next.set('domain', nextDomain) : next.delete('domain');
    setSearchParams(next);
  }, [domain, search, searchParams, setSearchParams, status]);

  useEffect(() => {
    const nextSearch = searchDraft.trim();
    if (nextSearch === search) return;
    const timer = window.setTimeout(() => {
      updateParams({ page: 1, search: nextSearch });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft, search, updateParams]);

  async function confirmStatusChange() {
    if (!pendingStatusChange) return;
    try {
      await updateStatus.mutateAsync({ programId: pendingStatusChange.program.id, status: pendingStatusChange.nextStatus });
      setNotice(`Program ${pendingStatusChange.nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully.`);
      setPendingStatusChange(null);
    } catch (error) {
      setNotice(readableError(error, 'Program status could not be updated.'));
    }
  }

  const columns: DataColumn<AdminProgram>[] = [
    {
      header: 'Program',
      key: 'program',
      render: (item) => (
        <div className="announcement-title-cell">
          <strong>{item.name}</strong>
          <p>{item.shortName ?? item.programKey}</p>
          <div className="chip-row">
            <StatusBadge tone={item.status === 'active' ? 'safe' : 'warning'}>{item.status}</StatusBadge>
            <StatusBadge>{item.programKey}</StatusBadge>
            {item.domainLabel ? <StatusBadge>{item.domainLabel}</StatusBadge> : null}
          </div>
        </div>
      )
    },
    {
      header: 'Key',
      key: 'key',
      render: (item) => item.programKey
    },
    {
      header: 'Domain',
      key: 'domain',
      render: (item) => item.domainLabel ?? 'Not mapped'
    },
    {
      header: 'Updated',
      key: 'updated',
      render: (item) => formatDate(item.updatedAt)
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item) => (
        <div className="admin-program-actions">
          <button className="segmented-button" onClick={() => setDetailsProgram(item)} type="button">
            <Eye size={14} />
            Details
          </button>
          <button className="segmented-button" onClick={() => setProgramModal({ mode: 'edit', program: item })} type="button">
            <Pencil size={14} />
            Edit
          </button>
          <button
            className={item.status === 'inactive' ? 'segmented-button' : 'segmented-button segmented-button--danger'}
            disabled={updateStatus.isPending}
            onClick={() => setPendingStatusChange({ nextStatus: item.status === 'inactive' ? 'active' : 'inactive', program: item })}
            type="button"
          >
            <Ban size={14} />
            {item.status === 'inactive' ? 'Reactivate' : 'Deactivate'}
          </button>
        </div>
      )
    }
  ];

  if (programsQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading program catalog." eyebrow="Admin programs" title="Programs" />
        <LoadingState />
      </div>
    );
  }

  if (programsQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Programs could not be loaded right now." eyebrow="Admin programs" title="Programs unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack admin-programs-page">
      <PageHeader description="Maintain the source of truth for LMS program names, keys, domains, and active status." eyebrow="Admin programs" title="Programs" />

      {notice ? <div className={/could not|failed|error/i.test(notice) ? 'auth-alert auth-alert--error' : 'auth-alert auth-alert--success'}>{notice}</div> : null}

      <div className="metric-grid">
        <article className="metric-tile">
          <BookOpen size={22} />
          <span>Total programs</span>
          <strong>{catalogQuery.data?.total ?? total}</strong>
        </article>
        <article className="metric-tile">
          <ShieldCheck size={22} />
          <span>Active programs</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="metric-tile">
          <Layers3 size={22} />
          <span>Domains</span>
          <strong>{domainCount}</strong>
        </article>
      </div>

      <ProgramAccordionSection activeSection={activeSection} eyebrow="Student clarity" sectionKey="guidance" setActiveSection={setActiveSection} title="Leadership program guidance">
        <ProgramGuidanceSection onNotice={setNotice} />
      </ProgramAccordionSection>

      <ProgramAccordionSection activeSection={activeSection} eyebrow="Program records" sectionKey="records" setActiveSection={setActiveSection} title="Program master records and operational status">
        <section className="filter-bar admin-program-filter-bar" aria-label="Program admin filters">
          <form className="filter-search filter-search--form admin-program-search" onSubmit={(event) => event.preventDefault()}>
            <Search size={18} />
            <label className="sr-only" htmlFor="admin-program-search">
              Search programs
            </label>
            <input id="admin-program-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search programs..." type="search" />
          </form>
          <select aria-label="Filter by domain" className="admin-program-domain-select" value={domain || 'all'} onChange={(event) => updateParams({ domain: event.target.value === 'all' ? '' : event.target.value, page: 1 })}>
            <option value="all">All Domains</option>
            {domainOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className="segmented-control admin-program-status-control" role="group" aria-label="Program status">
            {statusOptions.map((option) => (
              <button className={option === status ? 'segmented-button segmented-button--active' : 'segmented-button'} key={option} onClick={() => updateParams({ page: 1, status: option })} type="button">
                {option}
              </button>
            ))}
          </div>
          <button className="segmented-button segmented-button--gold" onClick={() => setProgramModal({ mode: 'add' })} type="button">
            <Plus size={16} />
            Program
          </button>
          <button className="segmented-button" disabled={programsQuery.isFetching} onClick={() => void programsQuery.refetch()} type="button">
            <RefreshCw size={16} />
            {programsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </section>

        {data && data.items.length > 0 ? (
          <div className="admin-program-table-panel">
            <DataPanel columns={columns} description="Program master records and operational status." items={data.items} title="Program records" />
          </div>
        ) : (
          <EmptyState />
        )}

        <nav className="pagination-bar" aria-label="Admin program pagination">
          {data?.hasPreviousPage ? (
            <Link className="pagination-link" to={buildPageLink(page - 1, search, status, domain)}>
              Previous page
            </Link>
          ) : (
            <span className="pagination-link pagination-link--disabled">Previous page</span>
          )}
          <span>
            Page {page} of {totalPages} · {total} matching
          </span>
          {data?.hasNextPage ? (
            <Link className="pagination-link" to={buildPageLink(page + 1, search, status, domain)}>
              Next page
            </Link>
          ) : (
            <span className="pagination-link pagination-link--disabled">Next page</span>
          )}
        </nav>
      </ProgramAccordionSection>

      <ProgramAccordionSection activeSection={activeSection} eyebrow="Template setup" sectionKey="template" setActiveSection={setActiveSection} title="Program Template Builder">
        <ProgramTemplateBuilder programs={catalogItems} onNotice={setNotice} />
      </ProgramAccordionSection>

      {programModal ? <ProgramModal existingPrograms={catalogItems} mode={programModal.mode} onClose={() => setProgramModal(null)} onSaved={setNotice} program={programModal.program} /> : null}
      {detailsProgram ? (
        <ProgramDetailsModal
          impact={impactQuery.data}
          isImpactLoading={impactQuery.isFetching}
          onClose={() => setDetailsProgram(null)}
          onEdit={() => {
            setProgramModal({ mode: 'edit', program: detailsProgram });
            setDetailsProgram(null);
          }}
          program={detailsProgram}
        />
      ) : null}
      {pendingStatusChange ? (
        <ProgramStatusModal
          impact={impactQuery.data}
          isImpactLoading={impactQuery.isFetching}
          isSaving={updateStatus.isPending}
          onClose={() => setPendingStatusChange(null)}
          onConfirm={() => void confirmStatusChange()}
          pending={pendingStatusChange}
        />
      ) : null}
    </div>
  );
}
