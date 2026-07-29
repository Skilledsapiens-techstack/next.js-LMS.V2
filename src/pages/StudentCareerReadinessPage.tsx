import { ArrowLeft, ArrowRight, BriefcaseBusiness, ExternalLink, FileCheck2, FileText, Info, MailCheck, MessageSquareText, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '../components/ScreenStates';
import { PageHeader } from '../components/PageHeader';
import { ProjectRichText } from '../components/ProjectRichText';
import { StatusBadge } from '../components/StatusBadge';
import {
  CareerReadinessCategory,
  StudentCareerReadinessContent,
  useStudentCareerReadiness
} from '../features/student/useStudentCareerReadiness';

const categoryMeta: Record<string, { description: string; icon: typeof FileText; label: string }> = {
  cv_approval_process: {
    description: 'Official review steps, contact details, and approval expectations.',
    icon: MailCheck,
    label: 'CV Approval Process'
  },
  cv_points_guide: {
    description: 'Guidance for writing clear, credible, impact-focused CV points.',
    icon: FileCheck2,
    label: 'CV Points Guide'
  },
  interview_prep: {
    description: 'Question banks, frameworks, and mock interview preparation material.',
    icon: MessageSquareText,
    label: 'Interview Prep Resources'
  },
  resume_resources: {
    description: 'Templates, resume checklists, ATS notes, and formatting references.',
    icon: FileText,
    label: 'Resume Building Resources'
  },
  sample_cv_points: {
    description: 'Approved example bullets students can learn from and adapt responsibly.',
    icon: BriefcaseBusiness,
    label: 'Sample Approved CV Points'
  }
};

const categoryOrder = ['cv_points_guide', 'resume_resources', 'interview_prep', 'sample_cv_points', 'cv_approval_process'];
const internalReferenceCategories = new Set(['sample_cv_points', 'cv_approval_process']);
const internalReferenceHelpText = 'Internal reference workspace for understanding Skilled Sapiens Live Project standards, approved examples, and CV approval guidance.';

function formatDate(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function fallbackCategoryLabel(category: string) {
  return category.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function plainTextPreview(value: string | undefined, maxLength = 180) {
  const text = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function linkButtonsForItem(item: StudentCareerReadinessContent) {
  return item.linkButtons?.length ? item.linkButtons : item.linkUrl ? [{ label: item.linkLabel || 'Open resource', url: item.linkUrl }] : [];
}

function CareerReadinessCard({ item, onOpen }: { item: StudentCareerReadinessContent; onOpen: () => void }) {
  const linkButtons = item.linkButtons?.length ? item.linkButtons : item.linkUrl ? [{ label: item.linkLabel || 'Open resource', url: item.linkUrl }] : [];
  return (
    <article className="career-readiness-card career-readiness-guide-card">
      <div className="career-readiness-card__body">
        <header>
          <h3>{item.title}</h3>
          {item.updatedAt ? <StatusBadge>{formatDate(item.updatedAt)}</StatusBadge> : null}
        </header>
        <p>{plainTextPreview(item.description || item.content)}</p>
        <div className="career-readiness-card__meta-lines">
          {linkButtons.length > 0 ? <span>{linkButtons.length} reference link{linkButtons.length === 1 ? '' : 's'} attached</span> : null}
          <span>{item.sectionTitle || fallbackCategoryLabel(item.category)}</span>
        </div>
      </div>
      <button className="student-action student-action--primary career-readiness-card__link" onClick={onOpen} type="button">
        Open guide
      </button>
    </article>
  );
}

function CareerReadinessReader({
  groupItems,
  item,
  onClose,
  onSelect
}: {
  groupItems: StudentCareerReadinessContent[];
  item: StudentCareerReadinessContent;
  onClose: () => void;
  onSelect: (item: StudentCareerReadinessContent) => void;
}) {
  const linkButtons = linkButtonsForItem(item);
  const currentIndex = Math.max(0, groupItems.findIndex((guide) => guide.id === item.id));
  const previousGuide = currentIndex > 0 ? groupItems[currentIndex - 1] : null;
  const nextGuide = currentIndex < groupItems.length - 1 ? groupItems[currentIndex + 1] : null;
  const hasSectionNavigation = groupItems.length > 1;

  return (
    <div className="career-readiness-reader" role="presentation">
      <section aria-labelledby="career-readiness-reader-title" aria-modal="true" className="career-readiness-reader__shell" role="dialog">
        <header className="career-readiness-reader__header">
          <div>
            <span>{item.sectionTitle || fallbackCategoryLabel(item.category)}</span>
            <h2 id="career-readiness-reader-title">{item.title}</h2>
            {item.updatedAt ? <p>Updated {formatDate(item.updatedAt)}</p> : null}
          </div>
          <button aria-label="Close guide" className="student-modal__close career-readiness-reader__close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <div className={hasSectionNavigation ? 'career-readiness-reader__layout' : 'career-readiness-reader__layout career-readiness-reader__layout--single'}>
          {hasSectionNavigation ? (
            <aside className="career-readiness-reader__nav" aria-label="Guides in this section">
              <span>In this section</span>
              <div>
                {groupItems.map((guide) => (
                  <button className={guide.id === item.id ? 'career-readiness-reader__nav-item career-readiness-reader__nav-item--active' : 'career-readiness-reader__nav-item'} key={guide.id} onClick={() => onSelect(guide)} type="button">
                    {guide.title}
                  </button>
                ))}
              </div>
            </aside>
          ) : null}
          <article className="career-readiness-reader__page">
            <ProjectRichText className="project-rich-text career-readiness-reader__summary" html={item.description} />
            <ProjectRichText className="project-rich-text career-readiness-reader__copy" html={item.content} />
          </article>
        </div>
        <footer className="career-readiness-reader__footer">
          {hasSectionNavigation ? (
            <div className="career-readiness-reader__stepper">
              <button className="segmented-button" disabled={!previousGuide} onClick={() => previousGuide && onSelect(previousGuide)} type="button">
                <ArrowLeft size={15} />
                Previous
              </button>
              <button className="segmented-button" disabled={!nextGuide} onClick={() => nextGuide && onSelect(nextGuide)} type="button">
                Next
                <ArrowRight size={15} />
              </button>
            </div>
          ) : null}
          {linkButtons.length > 0 ? (
            <div className="career-readiness-reader__links">
              {linkButtons.map((button, index) => (
                <a className="student-action student-action--primary" href={button.url} key={`${button.url}-${index}`} rel="noreferrer" target={button.url.startsWith('/') ? undefined : '_blank'}>
                  <ExternalLink size={16} />
                  {button.label}
                </a>
              ))}
            </div>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

export function StudentCareerReadinessPage() {
  const [selectedCategory, setSelectedCategory] = useState<CareerReadinessCategory | ''>('');
  const [selectedGuide, setSelectedGuide] = useState<StudentCareerReadinessContent | null>(null);
  const careerQuery = useStudentCareerReadiness({ category: '', limit: 200, page: 1 });
  const items = careerQuery.data?.items ?? [];
  const sectionFilterOptions = useMemo(() => {
    const options = new Map<string, string>();
    categoryOrder.forEach((categoryKey) => options.set(categoryKey, categoryMeta[categoryKey].label));
    items.forEach((item) => {
      if (!options.has(item.category)) {
        options.set(item.category, item.sectionTitle || fallbackCategoryLabel(item.category));
      }
    });
    return Array.from(options, ([value, label]) => ({ label, value }));
  }, [items]);
  const groupedItems = useMemo(
    () => {
      const groups = sectionFilterOptions.map((option) => {
        const meta = categoryMeta[option.value as CareerReadinessCategory];
        return {
          category: option.value,
          description: meta?.description || 'Admin-published placement mentorship guidance.',
          icon: meta?.icon || BriefcaseBusiness,
          items: [] as StudentCareerReadinessContent[],
          label: option.label
        };
      });

      [...items]
        .sort((left, right) => {
          const leftRank = categoryOrder.includes(left.category) ? categoryOrder.indexOf(left.category) : categoryOrder.length;
          const rightRank = categoryOrder.includes(right.category) ? categoryOrder.indexOf(right.category) : categoryOrder.length;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return (left.sectionTitle || left.category).localeCompare(right.sectionTitle || right.category);
        })
        .forEach((item) => {
          const existing = groups.find((group) => group.category === item.category);
          if (existing) {
            existing.items.push(item);
          }
        });

      return groups;
    },
    [items, sectionFilterOptions]
  );
  const activeGroup = groupedItems.find((group) => group.category === selectedCategory) ?? null;
  const visibleGroups = selectedCategory ? groupedItems.filter((group) => group.category === selectedCategory) : groupedItems;
  const categoryTileGroups = groupedItems.filter((group) => group.items.length > 0);
  const visibleGuideCount = visibleGroups.reduce((count, group) => count + group.items.length, 0);
  const latestGuides = useMemo(
    () =>
      [...items]
        .sort((left, right) => new Date(right.updatedAt ?? '').getTime() - new Date(left.updatedAt ?? '').getTime())
        .slice(0, 4),
    [items]
  );
  const selectedGuideGroupItems = selectedGuide ? groupedItems.find((group) => group.category === selectedGuide.category)?.items ?? [selectedGuide] : [];

  function selectCategory(category: CareerReadinessCategory | '') {
    setSelectedCategory(category);
  }

  if (careerQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader description="Loading placement mentorship guidance for your profile." eyebrow="Career readiness" title="Career Readiness" />
        <LoadingState />
      </div>
    );
  }

  if (careerQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader description="Career readiness content could not be loaded right now." eyebrow="Career readiness" title="Career Readiness unavailable" />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="page-stack career-readiness-page">
      <PageHeader
        description="Use approved guidance, examples, and preparation resources for your CV, resume, and interviews."
        eyebrow="Placement mentorship"
        title="Career Readiness"
      />

      <section className="career-readiness-toolbar" aria-label="Career readiness filters">
        <label className="sr-only" htmlFor="career-readiness-category">
          Career readiness section
        </label>
        <select id="career-readiness-category" value={selectedCategory} onChange={(event) => selectCategory(event.target.value as CareerReadinessCategory | '')}>
          <option value="">All sections</option>
          {sectionFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      {items.length > 0 ? (
        <>
          <section className="career-readiness-category-strip" aria-label="Career readiness categories">
            {categoryTileGroups.map((group) => {
              const Icon = group.icon;
              return (
                <button className={selectedCategory === group.category ? 'career-readiness-category-tile career-readiness-category-tile--active' : 'career-readiness-category-tile'} key={group.category} onClick={() => selectCategory(group.category)} type="button">
                  <span className="career-readiness-section__icon">
                    <Icon size={21} />
                  </span>
                  <span className="career-readiness-category-tile__body">
                    <strong>{group.label}</strong>
                    {internalReferenceCategories.has(group.category) ? (
                      <span className="career-readiness-internal-help" aria-label={internalReferenceHelpText} tabIndex={0}>
                        <Info size={16} />
                        <span role="tooltip">{internalReferenceHelpText}</span>
                      </span>
                    ) : null}
                    <small>{group.items.length} guide{group.items.length === 1 ? '' : 's'}</small>
                  </span>
                </button>
              );
            })}
          </section>

          {selectedCategory ? (
            <section className="career-readiness-workspace" aria-label="Career readiness guides">
              <header>
                <div>
                  <span>Selected section</span>
                  <h2>{activeGroup?.label ?? 'Career Readiness Guides'}</h2>
                  <p>{activeGroup?.description ?? 'Open a guide to read it in full screen.'}</p>
                </div>
                {selectedCategory ? (
                  <button className="segmented-button" onClick={() => selectCategory('')} type="button">
                    <ArrowLeft size={15} />
                    All categories
                  </button>
                ) : null}
              </header>
              {visibleGuideCount > 0 ? (
                <div className="career-readiness-sections">
                  {visibleGroups.map((group) =>
                    group.items.length > 0 ? (
                      <section className="career-readiness-section career-readiness-section--compact" key={group.category}>
                        <div className="career-readiness-card-grid">
                          {group.items.map((item) => (
                            <CareerReadinessCard item={item} key={item.id} onOpen={() => setSelectedGuide(item)} />
                          ))}
                        </div>
                      </section>
                    ) : null
                  )}
                </div>
              ) : (
                <div className="career-readiness-empty-inline">
                  <strong>No guides published here yet</strong>
                  <p>New material for this section will appear here once the team publishes it.</p>
                </div>
              )}
            </section>
          ) : null}

          {!selectedCategory && latestGuides.length > 0 ? (
            <section className="career-readiness-workspace" aria-label="Latest career readiness guides">
              <header>
                <div>
                  <span>Latest guides</span>
                  <h2>Recently Updated</h2>
                  <p>Quick access to the newest placement mentorship material.</p>
                </div>
              </header>
              <div className="career-readiness-card-grid">
                {latestGuides.map((item) => (
                  <CareerReadinessCard item={item} key={item.id} onOpen={() => setSelectedGuide(item)} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="screen-state career-readiness-empty">
          <BriefcaseBusiness size={24} />
          <div>
            <h2>{selectedCategory ? 'No matching career readiness content' : 'Career readiness content is coming soon'}</h2>
            <p>{selectedCategory ? 'Try a different section.' : 'Published CV, resume, and interview guidance will appear here.'}</p>
          </div>
        </section>
      )}
      {selectedGuide ? (
        <CareerReadinessReader
          groupItems={selectedGuideGroupItems}
          item={selectedGuide}
          onClose={() => setSelectedGuide(null)}
          onSelect={setSelectedGuide}
        />
      ) : null}
    </div>
  );
}
