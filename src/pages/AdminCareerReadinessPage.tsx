import { CheckCircle2, Eye, EyeOff, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { RichTextEditor } from '../components/RichTextEditor';
import { StatusBadge } from '../components/StatusBadge';
import {
  AdminCareerReadinessContent,
  AdminCareerReadinessWritePayload,
  useAdminCareerReadiness,
  useSaveAdminCareerReadiness,
  useToggleAdminCareerReadinessStatus,
  useUpdateAdminCareerReadiness
} from '../features/admin/useAdminCareerReadiness';
import { useAdminCohorts } from '../features/admin/useAdminCohorts';
import { useAdminPrograms } from '../features/admin/useAdminPrograms';
import { CareerReadinessCategory } from '../features/student/useStudentCareerReadiness';

type CareerReadinessFormState = {
  category: CareerReadinessCategory;
  cohortNames: string[];
  content: string;
  description: string;
  guestAccessEnabled: boolean;
  guestAccessExpiresAt: string;
  guestCtaLabel: string;
  guestCtaUrl: string;
  guestRegistrationRequired: boolean;
  isPublished: boolean;
  linkButtons: Array<{ label: string; url: string }>;
  linkLabel: string;
  linkUrl: string;
  programKeys: string[];
  sectionTitle: string;
  sortOrder: string;
  title: string;
};

const pageSize = 25;

const categoryOptions: Array<{ label: string; value: CareerReadinessCategory }> = [
  { label: 'CV Points Guide', value: 'cv_points_guide' },
  { label: 'Sample Approved CV Points', value: 'sample_cv_points' },
  { label: 'Resume Building Resources', value: 'resume_resources' },
  { label: 'Interview Prep Resources', value: 'interview_prep' },
  { label: 'CV Approval Process', value: 'cv_approval_process' }
];

const emptyForm: CareerReadinessFormState = {
  category: 'cv_points_guide',
  cohortNames: [],
  content: '',
  description: '',
  guestAccessEnabled: false,
  guestAccessExpiresAt: '',
  guestCtaLabel: '',
  guestCtaUrl: '',
  guestRegistrationRequired: false,
  isPublished: false,
  linkButtons: [{ label: '', url: '' }],
  linkLabel: '',
  linkUrl: '',
  programKeys: [],
  sectionTitle: 'CV Points Guide',
  sortOrder: '100',
  title: ''
};

function formatDateTime(value: string | undefined) {
  if (!value) return 'Auto';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { day: '2-digit', hour: '2-digit', minute: '2-digit', month: 'short', year: 'numeric' });
}

function readableCategory(category: CareerReadinessCategory) {
  return categoryOptions.find((option) => option.value === category)?.label ?? category.replace(/_/g, ' ');
}

function plainTextPreview(value: string | undefined) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifySection(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toDatetimeLocalValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function editableLinkButtons(item: AdminCareerReadinessContent) {
  const buttons = Array.isArray(item.linkButtons) ? item.linkButtons.filter((button) => button.label || button.url) : [];
  if (buttons.length > 0) return buttons.map((button) => ({ label: button.label ?? '', url: button.url ?? '' }));
  if (item.linkUrl) return [{ label: item.linkLabel || 'Open resource', url: item.linkUrl }];
  return [{ label: '', url: '' }];
}

function mapContentToForm(item: AdminCareerReadinessContent): CareerReadinessFormState {
  return {
    category: item.category,
    cohortNames: item.cohortNames ?? [],
    content: item.content ?? '',
    description: item.description ?? '',
    guestAccessEnabled: item.guestAccessEnabled === true,
    guestAccessExpiresAt: toDatetimeLocalValue(item.guestAccessExpiresAt),
    guestCtaLabel: item.guestCtaLabel ?? '',
    guestCtaUrl: item.guestCtaUrl ?? '',
    guestRegistrationRequired: item.guestRegistrationRequired === true,
    isPublished: item.isPublished,
    linkButtons: editableLinkButtons(item),
    linkLabel: item.linkLabel ?? '',
    linkUrl: item.linkUrl ?? '',
    programKeys: item.programKeys ?? [],
    sectionTitle: item.sectionTitle || readableCategory(item.category),
    sortOrder: String(item.sortOrder ?? 100),
    title: item.title
  };
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AdminCareerReadinessPage() {
  const editorRef = useRef<HTMLFormElement | null>(null);
  const [formState, setFormState] = useState<CareerReadinessFormState>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CareerReadinessCategory | 'all'>('all');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [programSearch, setProgramSearch] = useState('');
  const [cohortSearch, setCohortSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const contentQuery = useAdminCareerReadiness({ category: categoryFilter, limit: pageSize, page, published: publishedFilter, search });
  const programsQuery = useAdminPrograms({ limit: 100, page: 1, status: 'all' });
  const cohortsQuery = useAdminCohorts({ limit: 200, page: 1, sort: 'name', status: 'all' });
  const saveMutation = useSaveAdminCareerReadiness();
  const updateMutation = useUpdateAdminCareerReadiness();
  const toggleStatusMutation = useToggleAdminCareerReadinessStatus();
  const items = contentQuery.data?.items ?? [];
  const total = contentQuery.data?.total ?? 0;
  const totalPages = contentQuery.data?.totalPages ?? 1;
  const selectedProgramSet = useMemo(() => new Set(formState.programKeys), [formState.programKeys]);
  const selectedCohortSet = useMemo(() => new Set(formState.cohortNames), [formState.cohortNames]);
  const programs = programsQuery.data?.items ?? [];
  const cohorts = cohortsQuery.data?.items ?? [];
  const sectionFilterOptions = useMemo(() => {
    const options = new Map<string, string>();
    categoryOptions.forEach((option) => options.set(option.value, option.label));
    items.forEach((item) => {
      if (!options.has(item.category)) options.set(item.category, item.sectionTitle || readableCategory(item.category));
    });
    return Array.from(options, ([value, label]) => ({ label, value }));
  }, [items]);
  const filteredPrograms = useMemo(() => {
    const query = programSearch.trim().toLowerCase();
    return programs.filter((program) => !query || [program.name, program.programKey, program.shortName].some((value) => value?.toLowerCase().includes(query)));
  }, [programSearch, programs]);
  const filteredCohorts = useMemo(() => {
    const query = cohortSearch.trim().toLowerCase();
    return cohorts.filter((cohort) => !query || [cohort.name, cohort.programKey, cohort.domainKey].some((value) => value?.toLowerCase().includes(query)));
  }, [cohortSearch, cohorts]);
  const isSaving = saveMutation.isPending || updateMutation.isPending;

  function updateForm<K extends keyof CareerReadinessFormState>(key: K, value: CareerReadinessFormState[K]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function updatePresetSection(category: CareerReadinessCategory) {
    const option = categoryOptions.find((item) => item.value === category);
    setFormState((current) => ({
      ...current,
      category,
      sectionTitle: option?.label ?? current.sectionTitle
    }));
  }

  function updateCustomSectionTitle(sectionTitle: string) {
    setFormState((current) => ({
      ...current,
      category: slugifySection(sectionTitle) || current.category,
      sectionTitle
    }));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function startNewContent() {
    setSelectedId(null);
    setFormState(emptyForm);
    setFormError(null);
    setActionMessage(null);
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function editContent(item: AdminCareerReadinessContent) {
    setSelectedId(item.id);
    setFormState(mapContentToForm(item));
    setFormError(null);
    setActionMessage(null);
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function toggleProgram(programKey: string) {
    setFormState((current) => {
      const next = new Set(current.programKeys);
      if (next.has(programKey)) next.delete(programKey);
      else next.add(programKey);
      return { ...current, programKeys: Array.from(next) };
    });
  }

  function toggleCohort(cohortName: string) {
    setFormState((current) => {
      const next = new Set(current.cohortNames);
      if (next.has(cohortName)) next.delete(cohortName);
      else next.add(cohortName);
      return { ...current, cohortNames: Array.from(next) };
    });
  }

  function updateLinkButton(index: number, key: 'label' | 'url', value: string) {
    setFormState((current) => ({
      ...current,
      linkButtons: current.linkButtons.map((button, buttonIndex) => (buttonIndex === index ? { ...button, [key]: value } : button))
    }));
  }

  function addLinkButton() {
    setFormState((current) => ({
      ...current,
      linkButtons: current.linkButtons.length >= 8 ? current.linkButtons : [...current.linkButtons, { label: '', url: '' }]
    }));
  }

  function removeLinkButton(index: number) {
    setFormState((current) => {
      const next = current.linkButtons.filter((_, buttonIndex) => buttonIndex !== index);
      return { ...current, linkButtons: next.length > 0 ? next : [{ label: '', url: '' }] };
    });
  }

  function buildPayload(): AdminCareerReadinessWritePayload | null {
    const title = formState.title.trim();
    const sectionTitle = formState.sectionTitle.trim();
    const linkButtons = formState.linkButtons
      .map((button) => ({ label: button.label.trim(), url: button.url.trim() }))
      .filter((button) => button.label || button.url);
    const firstLinkButton = linkButtons[0];
    const guestCtaUrl = formState.guestCtaUrl.trim();
    const sortOrder = Number(formState.sortOrder || 100);
    if (!sectionTitle) {
      setFormError('Section title is required.');
      return null;
    }
    if (!title) {
      setFormError('Title is required.');
      return null;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError('Sort order must be zero or a positive whole number.');
      return null;
    }
    for (const [index, button] of linkButtons.entries()) {
      if (!button.label || !button.url) {
        setFormError(`CTA button ${index + 1} needs both a label and a URL.`);
        return null;
      }
      if (button.label.length > 80) {
        setFormError(`CTA button ${index + 1} label must be 80 characters or fewer.`);
        return null;
      }
      if (!/^https?:\/\//i.test(button.url) && !button.url.startsWith('/')) {
        setFormError(`CTA button ${index + 1} URL must start with http://, https://, or /.`);
        return null;
      }
    }
    if (guestCtaUrl && !/^https?:\/\//i.test(guestCtaUrl)) {
      setFormError('Guest CTA URL must start with http:// or https://.');
      return null;
    }
    return {
      category: formState.category,
      cohortNames: uniqueStrings(formState.cohortNames),
      content: formState.content.trim() || null,
      description: formState.description.trim() || null,
      guestAccessEnabled: formState.guestAccessEnabled,
      guestAccessExpiresAt: toIsoOrNull(formState.guestAccessExpiresAt),
      guestCtaLabel: formState.guestCtaLabel.trim() || null,
      guestCtaUrl: guestCtaUrl || null,
      guestRegistrationRequired: formState.guestRegistrationRequired,
      isPublished: formState.isPublished,
      linkButtons,
      linkLabel: firstLinkButton?.label ?? null,
      linkUrl: firstLinkButton?.url ?? null,
      programKeys: uniqueStrings(formState.programKeys),
      sectionTitle,
      sortOrder,
      title
    };
  }

  async function saveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setActionMessage(null);
    const payload = buildPayload();
    if (!payload) return;

    try {
      const saved = selectedId ? await updateMutation.mutateAsync({ body: payload, contentId: selectedId }) : await saveMutation.mutateAsync(payload);
      setSelectedId(saved.id);
      setFormState(mapContentToForm(saved));
      setActionMessage(selectedId ? 'Career readiness content updated.' : 'Career readiness content created.');
    } catch (error) {
      setFormError(readableError(error, 'Career readiness content could not be saved.'));
    }
  }

  async function togglePublished(item: AdminCareerReadinessContent) {
    setFormError(null);
    setActionMessage(null);
    try {
      await toggleStatusMutation.mutateAsync({ contentId: item.id, isPublished: !item.isPublished });
      setActionMessage(!item.isPublished ? 'Content published for matching students.' : 'Content moved back to draft.');
    } catch (error) {
      setFormError(readableError(error, 'Publish status could not be updated.'));
    }
  }

  if (contentQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading Career Readiness content." eyebrow="Placement mentorship" title="Career Readiness" />
        <LoadingState />
      </div>
    );
  }

  if (contentQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Career Readiness content could not be loaded." eyebrow="Placement mentorship" title="Career Readiness unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="admin-career-page">
      <PageHeader
        description="Author the student-facing CV, resume, interview, and approval guidance shown in the Career Readiness tab."
        eyebrow="Placement mentorship"
        title="Career Readiness Content"
      />

      <div className="admin-career-grid">
        <section className="admin-project-section admin-career-library">
          <header className="admin-project-section__header">
            <div>
              <span>Content library</span>
              <h2>Published and Draft Items</h2>
            </div>
            <button className="segmented-button segmented-button--gold" onClick={startNewContent} type="button">
              <Plus size={15} />
              New Item
            </button>
          </header>

          <form className="admin-career-filter-grid" onSubmit={handleSearch}>
            <div className="filter-search">
              <Search size={16} />
              <label className="sr-only" htmlFor="admin-career-search">
                Search career readiness content
              </label>
              <input id="admin-career-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search content" type="search" />
            </div>
            <button className="segmented-button" disabled={contentQuery.isFetching} type="submit">
              Search
            </button>
            <select value={categoryFilter} onChange={(event) => { setPage(1); setCategoryFilter(event.target.value as CareerReadinessCategory | 'all'); }}>
              <option value="all">All sections</option>
              {sectionFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={publishedFilter} onChange={(event) => { setPage(1); setPublishedFilter(event.target.value as 'all' | 'draft' | 'published'); }}>
              <option value="all">All visibility</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </form>

          <div className="admin-career-list">
            {items.length > 0 ? (
              items.map((item) => (
                <article className={selectedId === item.id ? 'admin-career-card admin-career-card--selected' : 'admin-career-card'} key={item.id}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{plainTextPreview(item.description) || item.sectionTitle || readableCategory(item.category)}</p>
                    <div className="chip-row">
                      <StatusBadge tone={item.isPublished ? 'safe' : 'warning'}>{item.isPublished ? 'Published' : 'Draft'}</StatusBadge>
                      <span>{item.sectionTitle || readableCategory(item.category)}</span>
                      <span>Order {item.sortOrder}</span>
                    </div>
                  </div>
                  <div className="admin-career-card__actions">
                    <button className="segmented-button" onClick={() => editContent(item)} type="button">
                      Edit
                    </button>
                    <button className="segmented-button" disabled={toggleStatusMutation.isPending} onClick={() => void togglePublished(item)} type="button">
                      {item.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
                      {item.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState />
            )}
          </div>

          <nav className="pagination-bar" aria-label="Career readiness pagination">
            <button className="pagination-link" disabled={page <= 1 || contentQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">
              Previous page
            </button>
            <span>
              Page {page} of {totalPages} · {total} matching
            </span>
            <button className="pagination-link" disabled={page >= totalPages || contentQuery.isFetching} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} type="button">
              Next page
            </button>
          </nav>
        </section>

        <section className="admin-project-section admin-career-editor">
          <header className="admin-project-section__header">
            <div>
              <span>Editor</span>
              <h2>{selectedId ? 'Edit Content' : 'Add Content'}</h2>
            </div>
          </header>

          <form className="admin-project-form admin-career-form" onSubmit={saveContent} ref={editorRef}>
            <label>
              <span>Preset Section</span>
              <select value={categoryOptions.some((option) => option.value === formState.category) ? formState.category : ''} onChange={(event) => {
                if (event.target.value) updatePresetSection(event.target.value);
                else updateCustomSectionTitle(formState.sectionTitle);
              }}>
                <option value="">Custom section</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort Order</span>
              <input value={formState.sortOrder} onChange={(event) => updateForm('sortOrder', event.target.value)} inputMode="numeric" />
            </label>
            <label className="admin-project-form__wide">
              <span>Section Title *</span>
              <input value={formState.sectionTitle} onChange={(event) => updateCustomSectionTitle(event.target.value)} placeholder="e.g. LinkedIn Profile Checklist" />
            </label>
            <label className="admin-project-form__wide">
              <span>Title *</span>
              <input value={formState.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="How to write strong CV points" />
            </label>
            <div className="admin-project-form__wide">
              <RichTextEditor
                className="career-rte--compact"
                label="Short Description"
                onChange={(value) => updateForm('description', value)}
                placeholder="A short summary students can scan quickly."
                value={formState.description}
              />
            </div>
            <div className="admin-project-form__wide">
              <RichTextEditor
                className="career-rte--full"
                label="Content"
                onChange={(value) => updateForm('content', value)}
                placeholder="Add guidance, sample points, lists, and links."
                value={formState.content}
              />
            </div>
            <fieldset className="admin-career-cta-editor">
              <legend>CTA buttons</legend>
              <div className="admin-career-cta-editor__list">
                {formState.linkButtons.map((button, index) => (
                  <div className="admin-career-cta-row" key={index}>
                    <label>
                      <span>Button Label</span>
                      <input value={button.label} onChange={(event) => updateLinkButton(index, 'label', event.target.value)} placeholder="Open guide" />
                    </label>
                    <label>
                      <span>Link URL</span>
                      <input value={button.url} onChange={(event) => updateLinkButton(index, 'url', event.target.value)} placeholder="https://..." />
                    </label>
                    <button aria-label={`Remove CTA button ${index + 1}`} className="icon-button admin-career-cta-row__remove" disabled={formState.linkButtons.length === 1} onClick={() => removeLinkButton(index)} type="button">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="segmented-button" disabled={formState.linkButtons.length >= 8} onClick={addLinkButton} type="button">
                <Plus size={14} />
                Add CTA
              </button>
              <p className="admin-resource-validation-note">Add up to 8 buttons. These appear below the content card for students.</p>
            </fieldset>
            <label className="admin-career-publish-toggle">
              <input checked={formState.isPublished} onChange={(event) => updateForm('isPublished', event.target.checked)} type="checkbox" />
              <span>Publish to students who match the selected programs/cohorts</span>
            </label>
            <fieldset className="admin-project-program-picker admin-career-target-picker">
              <legend>Guest access controls</legend>
              <label className="admin-career-publish-toggle">
                <input checked={formState.guestAccessEnabled} onChange={(event) => updateForm('guestAccessEnabled', event.target.checked)} type="checkbox" />
                <span>Available to verified guest users</span>
              </label>
              <label className="admin-career-publish-toggle">
                <input checked={formState.guestRegistrationRequired} onChange={(event) => updateForm('guestRegistrationRequired', event.target.checked)} type="checkbox" />
                <span>Require guest registration before opening this guide</span>
              </label>
              <div className="admin-career-cta-row">
                <label>
                  <span>Guest Access Expiry</span>
                  <input type="datetime-local" value={formState.guestAccessExpiresAt} onChange={(event) => updateForm('guestAccessExpiresAt', event.target.value)} />
                </label>
                <label>
                  <span>Guest CTA Label</span>
                  <input value={formState.guestCtaLabel} onChange={(event) => updateForm('guestCtaLabel', event.target.value)} placeholder="Request access" />
                </label>
                <label>
                  <span>Guest CTA Link</span>
                  <input value={formState.guestCtaUrl} onChange={(event) => updateForm('guestCtaUrl', event.target.value)} placeholder="https://..." />
                </label>
              </div>
              <p className="admin-resource-validation-note">Guest users will see this only when the item is published and guest access is enabled. Leave expiry blank for lifetime access.</p>
            </fieldset>

            <fieldset className="admin-project-program-picker admin-career-target-picker">
              <legend>Target programs</legend>
              <div className="filter-search">
                <Search size={14} />
                <input value={programSearch} onChange={(event) => setProgramSearch(event.target.value)} placeholder="Search programs" type="search" />
              </div>
              <div className="admin-project-program-list">
                {filteredPrograms.map((program) => (
                  <label key={program.id}>
                    <input checked={selectedProgramSet.has(program.programKey)} onChange={() => toggleProgram(program.programKey)} type="checkbox" />
                    <span>{program.name}</span>
                    <strong>{program.programKey}</strong>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="admin-project-program-picker admin-career-target-picker">
              <legend>Target cohorts</legend>
              <div className="filter-search">
                <Search size={14} />
                <input value={cohortSearch} onChange={(event) => setCohortSearch(event.target.value)} placeholder="Search cohorts" type="search" />
              </div>
              <div className="admin-project-program-list">
                {filteredCohorts.map((cohort) => (
                  <label key={cohort.id}>
                    <input checked={selectedCohortSet.has(cohort.name)} onChange={() => toggleCohort(cohort.name)} type="checkbox" />
                    <span>{cohort.name}</span>
                    <strong>{[cohort.programKey, cohort.status].filter(Boolean).join(' · ')}</strong>
                  </label>
                ))}
              </div>
              <p className="admin-resource-validation-note">Leave both targeting lists empty to show this item to all students.</p>
            </fieldset>

            <div className="admin-project-form__actions">
              <button className="segmented-button" onClick={startNewContent} type="button">
                Clear
              </button>
              <button className="segmented-button segmented-button--gold" disabled={isSaving} type="submit">
                {isSaving ? <Loader2 className="workshop-action-spinner" size={14} /> : <Save size={14} />}
                {isSaving ? 'Saving...' : selectedId ? 'Update Content' : 'Save Content'}
              </button>
            </div>
            {formError ? <p className="admin-resource-error-note admin-project-form__wide">{formError}</p> : null}
            {actionMessage ? (
              <p className="admin-resource-success-note admin-project-form__wide">
                <CheckCircle2 size={15} />
                {actionMessage}
              </p>
            ) : null}
            <p className="admin-resource-validation-note admin-project-form__wide">Last saved: {selectedId ? formatDateTime(items.find((item) => item.id === selectedId)?.updatedAt) : 'Auto'}</p>
          </form>
        </section>
      </div>
    </div>
  );
}
