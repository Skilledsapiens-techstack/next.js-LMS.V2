import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Compass, FileText, Search, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ProjectRichText } from '../../components/ProjectRichText';
import { StudentCareerReadinessContent, useStudentCareerReadiness } from '../../features/student/useStudentCareerReadiness';
import { PulseBadge, PulseCard } from '../components';

const sampleCareerItems: StudentCareerReadinessContent[] = [
  {
    availableOnPulse: true,
    category: 'resume_resources',
    cohortNames: [],
    content: '<p>Use this guide to convert classroom work, projects, and internships into strong resume proof points.</p>',
    description: 'Resume checkpoints for students preparing for internships, live projects, or placement conversations.',
    id: 'sample-career-resume',
    isPublished: true,
    linkButtons: [],
    programKeys: [],
    pulseCategory: 'resume_readiness',
    pulseFeatured: true,
    pulseSummary: 'Quickly improve resume bullets, project framing, and role fit before applying.',
    sectionTitle: 'Resume Readiness',
    sortOrder: 10,
    title: 'Build stronger resume proof points'
  },
  {
    availableOnPulse: true,
    category: 'interview_prep',
    cohortNames: [],
    content: '<p>Prepare examples for teamwork, ownership, problem-solving, and project impact.</p>',
    description: 'A simple interview prep flow for students who need clearer examples.',
    id: 'sample-career-interview',
    isPublished: true,
    linkButtons: [],
    programKeys: [],
    pulseCategory: 'interview_prep',
    pulseFeatured: false,
    pulseSummary: 'Practice answer structure and prepare examples from your real student work.',
    sectionTitle: 'Interview Prep',
    sortOrder: 20,
    title: 'Interview answer practice map'
  }
];

function plainText(value?: string) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function categoryLabel(value?: string | null) {
  return String(value || 'career_readiness')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryToneClass(value?: string | null) {
  const key = String(value || '').toLowerCase();
  if (key.includes('resume') || key.includes('cv')) return 'resume';
  if (key.includes('interview')) return 'interview';
  if (key.includes('consult')) return 'consulting';
  if (key.includes('finance')) return 'finance';
  if (key.includes('market')) return 'marketing';
  if (key.includes('product')) return 'product';
  if (key.includes('project')) return 'project';
  if (key.includes('placement')) return 'placements';
  if (key.includes('hr')) return 'hr';
  return 'general';
}

function formatUpdatedDate(value?: string) {
  if (!value) return 'Recently updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return `Updated ${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}`;
}

function itemDetailPath(item: StudentCareerReadinessContent) {
  return `/pulse/career-readiness/${encodeURIComponent(item.id)}`;
}

function careerCategoryKey(item: StudentCareerReadinessContent) {
  return item.pulseCategory ?? item.category ?? 'career_readiness';
}

export function PulseCareerReadinessPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const careerQuery = useStudentCareerReadiness({ limit: 100, page: 1, pulse: true });
  const liveItems = careerQuery.data?.items ?? [];
  const items = liveItems.length > 0 ? liveItems : sampleCareerItems;
  const shownAsSample = liveItems.length === 0;
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const key = careerCategoryKey(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts, ([value, count]) => ({ count, label: categoryLabel(value), value }));
  }, [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = activeCategory === 'all' || careerCategoryKey(item) === activeCategory;
      const matchesSearch = !query || JSON.stringify(item).toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, items, search]);
  const featuredItem = filteredItems.find((item) => item.pulseFeatured) ?? filteredItems[0];
  const pathLabels = categoryOptions.map((option) => option.value).slice(0, 3);

  return (
    <div className="pulse-resource-page">
      <section className="pulse-library-hero pulse-career-hero">
        <div>
          <PulseBadge tone="green">Career Readiness</PulseBadge>
          <h1>Build confidence before applications and interviews.</h1>
          <p>Use focused guides to sharpen your resume, project story, interview answers, and placement preparation inside Pulse.</p>
          <div className="pulse-library-hero__chips" aria-label="Career readiness highlights">
            {(pathLabels.length ? pathLabels : ['resume_readiness', 'interview_prep', 'project_work']).map((label) => (
              <span key={label}><Compass size={15} /> {categoryLabel(label)}</span>
            ))}
          </div>
        </div>
        <PulseCard className="pulse-library-hero__panel">
          <Target size={22} />
          <strong>{shownAsSample ? 'Guided preview' : `${liveItems.length} guides`}</strong>
          <span>{shownAsSample ? 'Approved readiness guides will appear here.' : 'Organized for students preparing their next opportunity.'}</span>
        </PulseCard>
      </section>

      <section className="pulse-library-toolbar" aria-label="Career readiness filters">
        <div className="pulse-library-search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resume, interview, CV, placement" />
        </div>
        <Link className="pulse-button pulse-button--secondary" to="/pulse/resources">
          <span>Open Resource Library</span>
          <ArrowRight size={16} />
        </Link>
      </section>

      <nav className="pulse-library-filter-chips pulse-library-filter-chips--career" aria-label="Career readiness category filters">
        <button className={activeCategory === 'all' ? 'is-active' : ''} onClick={() => setActiveCategory('all')} type="button">
          <span>All</span>
          <strong>{items.length}</strong>
        </button>
        {categoryOptions.map((option) => (
          <button className={`${activeCategory === option.value ? 'is-active' : ''} pulse-library-filter-chip--${categoryToneClass(option.value)}`.trim()} key={option.value} onClick={() => setActiveCategory(option.value)} type="button">
            <span>{option.label}</span>
            <strong>{option.count}</strong>
          </button>
        ))}
      </nav>

      {featuredItem ? (
        <PulseCard className="pulse-career-feature">
          <div>
            <PulseBadge tone="gold">Featured guide</PulseBadge>
            <h2>{featuredItem.title}</h2>
            <p>{featuredItem.pulseSummary || plainText(featuredItem.description) || plainText(featuredItem.content)}</p>
          </div>
          <div className="pulse-career-feature__actions">
            <span><CheckCircle2 size={18} /> Student-first guidance</span>
            <Link className="pulse-button pulse-button--secondary" to={itemDetailPath(featuredItem)}>
              <span>Open guide</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </PulseCard>
      ) : null}

      <section className="pulse-library-section" aria-label="Career readiness items">
        <div className="pulse-library-section__header">
          <div>
            <PulseBadge tone="green">Guides</PulseBadge>
            <h2>Choose your preparation area</h2>
          </div>
          <span>{filteredItems.length} showing</span>
        </div>
        <div className="pulse-library-grid pulse-career-grid">
        {filteredItems.map((item) => (
          <PulseCard className="pulse-library-card" key={item.id}>
            <div>
              <span className={`pulse-category-chip pulse-category-chip--${categoryToneClass(item.pulseCategory ?? item.category)}`}>
                {categoryLabel(item.pulseCategory ?? item.category)}
              </span>
              <h2>{item.title}</h2>
              <p>{item.pulseSummary || plainText(item.description) || plainText(item.content) || 'A Skilled Sapiens readiness guide for students.'}</p>
            </div>
            <Link className="pulse-button pulse-button--primary" to={itemDetailPath(item)}>
              <span>{shownAsSample ? 'Preview guide' : 'Open guide'}</span>
              <ArrowRight size={16} />
            </Link>
          </PulseCard>
        ))}
        </div>
      </section>
    </div>
  );
}

export function PulseCareerReadinessDetailPage() {
  const { contentId } = useParams();
  const careerQuery = useStudentCareerReadiness({ limit: 200, page: 1, pulse: true });
  const liveItems = careerQuery.data?.items ?? [];
  const items = liveItems.length > 0 ? liveItems : sampleCareerItems;
  const decodedContentId = contentId ? decodeURIComponent(contentId) : '';
  const item = items.find((candidate) => candidate.id === decodedContentId);
  const currentIndex = item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
  const previousItem = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextItem = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  if (!contentId) {
    return <Navigate to="/pulse/career-readiness" replace />;
  }

  if (careerQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Opening guide</PulseBadge>
        <h1>Loading career guidance.</h1>
      </section>
    );
  }

  if (careerQuery.error) {
    return (
      <section className="pulse-resource-page">
        <Link className="pulse-back-link" to="/pulse/career-readiness">
          <ArrowLeft size={18} /> Back to Career Readiness
        </Link>
        <div className="pulse-feed-state pulse-feed-state--error">{careerQuery.error.message}</div>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="pulse-resource-page">
        <Link className="pulse-back-link" to="/pulse/career-readiness">
          <ArrowLeft size={18} /> Back to Career Readiness
        </Link>
        <div className="pulse-feed-state">
          <strong>Guide not found.</strong>
          <span>This content may have been unpublished or removed from Pulse.</span>
        </div>
      </section>
    );
  }

  const summary = item.pulseSummary || plainText(item.description) || 'Practical career guidance for students.';
  const sectionTitle = item.sectionTitle || categoryLabel(item.category);

  return (
    <section className="pulse-resource-page pulse-career-detail-page">
      <Link className="pulse-back-link" to="/pulse/career-readiness">
        <ArrowLeft size={18} /> Back to Career Readiness
      </Link>

      <div className="pulse-career-detail-hero">
        <div>
          <span className={`pulse-category-chip pulse-category-chip--${categoryToneClass(item.pulseCategory ?? item.category)}`}>
            {categoryLabel(item.pulseCategory ?? item.category)}
          </span>
          <h1>{item.title}</h1>
          <p>{summary}</p>
          <div className="pulse-career-detail-hero__meta">
            <span><FileText size={16} /> {sectionTitle}</span>
            <span><Clock3 size={16} /> {formatUpdatedDate(item.updatedAt)}</span>
          </div>
        </div>
        <PulseCard className="pulse-career-detail-progress">
          <Target size={22} />
          <strong>Read inside Pulse</strong>
          <span>This guide uses the full portal content managed by the Skilled Sapiens team.</span>
        </PulseCard>
      </div>

      <div className="pulse-career-detail-layout">
        <aside className="pulse-career-detail-sidebar" aria-label="Career readiness guides">
          <div className="pulse-career-detail-sidebar__top">
            <PulseBadge tone="gold">More guides</PulseBadge>
            <Link className="pulse-inline-link" to="/pulse/career-readiness">
              <ArrowLeft size={16} /> Back to Career Readiness
            </Link>
          </div>
          <div>
            {items.slice(0, 8).map((guide) => (
              <Link className={guide.id === item.id ? 'is-active' : ''} key={guide.id} to={itemDetailPath(guide)}>
                <span>{categoryLabel(guide.pulseCategory ?? guide.category)}</span>
                <strong>{guide.title}</strong>
              </Link>
            ))}
          </div>
        </aside>

        <PulseCard className="pulse-career-reader">
          {item.description ? (
            <ProjectRichText className="project-rich-text pulse-career-reader__summary" html={item.description} />
          ) : null}
          {item.content ? (
            <ProjectRichText className="project-rich-text pulse-career-reader__copy" html={item.content} />
          ) : (
            <p>{summary}</p>
          )}

          <footer className="pulse-career-reader__footer">
            <div>
              {previousItem ? (
                <Link className="pulse-button pulse-button--secondary" to={itemDetailPath(previousItem)}>
                  <ArrowLeft size={16} />
                  <span>Previous</span>
                </Link>
              ) : null}
              {nextItem ? (
                <Link className="pulse-button pulse-button--primary" to={itemDetailPath(nextItem)}>
                  <span>Next guide</span>
                  <ArrowRight size={16} />
                </Link>
              ) : null}
            </div>
            <Link className="pulse-inline-link" to="/pulse/career-readiness">
              View all Career Readiness
            </Link>
          </footer>
        </PulseCard>
      </div>

      {item.linkButtons?.length || item.linkUrl ? (
        <PulseCard className="pulse-career-reference-note">
          <PulseBadge tone="coral">Reference note</PulseBadge>
          <h2>Supporting links are managed by admin.</h2>
          <p>
            For Pulse, the main learning material is shown inside this page. Any external reference links remain
            secondary to the in-portal guide content.
          </p>
        </PulseCard>
      ) : null}
    </section>
  );
}
