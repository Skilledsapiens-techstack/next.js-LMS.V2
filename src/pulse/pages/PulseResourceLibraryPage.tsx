import { ArrowRight, BookOpen, CheckSquare, Clock3, Download, ExternalLink, FileText, Layers3, PlayCircle, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StudentResource, useStudentResources } from '../../features/student/useStudentResources';
import { PulseBadge, PulseCard } from '../components';

const sampleResources: StudentResource[] = [
  {
    accessType: 'free',
    availableOnPulse: true,
    cohortNames: [],
    description: 'A practical checklist students can use before submitting resumes for internship or live-project roles.',
    hasAccess: true,
    id: 'sample-resource-resume-checklist',
    locked: false,
    programKeys: [],
    pulseCategory: 'resume_interview',
    pulseFeatured: true,
    pulseSummary: 'Use this before applying: resume structure, proof points, and common mistakes.',
    resourceMode: 'pdf',
    resourceType: 'template',
    title: 'Resume Readiness Checklist',
    url: '#'
  },
  {
    accessType: 'free',
    availableOnPulse: true,
    cohortNames: [],
    description: 'A starter pack for turning a classroom project into a stronger portfolio story.',
    hasAccess: true,
    id: 'sample-resource-project-proof',
    locked: false,
    programKeys: [],
    pulseCategory: 'project_toolkit',
    pulseFeatured: false,
    pulseSummary: 'Frame your work with context, role, action, tools, and measurable outcome.',
    resourceMode: 'doc',
    resourceType: 'project_resource',
    title: 'Project Proof-of-Work Template',
    url: '#'
  }
];

function categoryLabel(value?: string | null) {
  return String(value || 'career_starter')
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

function resourceModeLabel(value?: string) {
  return value ? value.replace(/_/g, ' ').toUpperCase() : 'RESOURCE';
}

function resourceFormat(resource: StudentResource) {
  const combined = `${resource.resourceMode ?? ''} ${resource.resourceType ?? ''} ${resource.url ?? ''}`.toLowerCase();
  if (combined.includes('video') || combined.includes('youtube') || combined.includes('watch')) {
    return { action: 'Watch now', icon: PlayCircle, label: 'Video', tone: 'video' };
  }
  if (combined.includes('template') || combined.includes('worksheet') || combined.includes('sheet')) {
    return { action: 'Use template', icon: CheckSquare, label: 'Template', tone: 'template' };
  }
  if (combined.includes('pdf')) {
    return { action: 'Open PDF', icon: Download, label: 'PDF guide', tone: 'pdf' };
  }
  if (combined.includes('checklist')) {
    return { action: 'Start checklist', icon: CheckSquare, label: 'Checklist', tone: 'template' };
  }
  return { action: 'Open resource', icon: BookOpen, label: resourceModeLabel(resource.resourceMode), tone: 'guide' };
}

function resourceCategoryKey(resource: StudentResource) {
  return resource.pulseCategory ?? resource.resourceDomainKey ?? resource.resourceType ?? 'general';
}

export function PulseResourceLibraryPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const resourcesQuery = useStudentResources({ accessType: 'all', limit: 100, page: 1, pulse: true });
  const liveResources = resourcesQuery.data?.items ?? [];
  const resources = liveResources.length > 0 ? liveResources : sampleResources;
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    resources.forEach((resource) => {
      const key = resourceCategoryKey(resource);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts, ([value, count]) => ({ count, label: categoryLabel(value), value }));
  }, [resources]);
  const filteredResources = useMemo(() => {
    const query = search.trim().toLowerCase();
    return resources.filter((resource) => {
      const matchesCategory = activeCategory === 'all' || resourceCategoryKey(resource) === activeCategory;
      const matchesSearch = !query || JSON.stringify(resource).toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, resources, search]);
  const featuredResources = filteredResources.filter((resource) => resource.pulseFeatured).slice(0, 3);
  const shownAsSample = liveResources.length === 0;
  const categoryCount = categoryOptions.length;

  return (
    <div className="pulse-resource-page">
      <section className="pulse-library-hero">
        <div>
          <PulseBadge tone="coral">Resource Library</PulseBadge>
          <h1>Curated guides, templates, and playbooks to help you do better work.</h1>
          <p>Browse curated templates, guides, case material, and project support when you need a cleaner next step.</p>
          <div className="pulse-library-hero__chips" aria-label="Resource highlights">
            <span><FileText size={15} /> Templates</span>
            <span><Layers3 size={15} /> Playbooks</span>
            <span><Clock3 size={15} /> Quick reads</span>
          </div>
        </div>
        <PulseCard className="pulse-library-hero__panel">
          <Sparkles size={22} />
          <strong>{shownAsSample ? 'Curated preview' : `${liveResources.length} resources`}</strong>
          <span>{shownAsSample ? 'Approved resources will appear here when they are made available for Pulse.' : `${categoryCount || 1} student-focused categories available.`}</span>
        </PulseCard>
      </section>

      <section className="pulse-library-toolbar" aria-label="Resource library filters">
        <div className="pulse-library-search">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resources, templates, guides" />
        </div>
        <Link className="pulse-button pulse-button--secondary" to="/pulse/career-readiness">
          <span>Open Career Readiness</span>
          <ArrowRight size={16} />
        </Link>
      </section>

      <nav className="pulse-library-filter-chips" aria-label="Resource category filters">
        <button className={activeCategory === 'all' ? 'is-active' : ''} onClick={() => setActiveCategory('all')} type="button">
          <span>All</span>
          <strong>{resources.length}</strong>
        </button>
        {categoryOptions.map((option) => (
          <button className={`${activeCategory === option.value ? 'is-active' : ''} pulse-library-filter-chip--${categoryToneClass(option.value)}`.trim()} key={option.value} onClick={() => setActiveCategory(option.value)} type="button">
            <span>{option.label}</span>
            <strong>{option.count}</strong>
          </button>
        ))}
      </nav>

      {featuredResources.length > 0 ? (
        <section className="pulse-library-section" aria-label="Featured resources">
          <div className="pulse-library-section__header">
            <div>
              <PulseBadge tone="gold">Featured</PulseBadge>
              <h2>Recommended this week</h2>
            </div>
            <span>{featuredResources.length} selected</span>
          </div>
          <div className="pulse-library-featured">
          {featuredResources.map((resource) => {
            const format = resourceFormat(resource);
            const FormatIcon = format.icon;
            return (
              <PulseCard className={`pulse-library-feature-card pulse-library-feature-card--${format.tone}`} key={resource.id}>
                <span><Sparkles size={16} /> Featured {format.label}</span>
                <div className="pulse-library-feature-card__body">
                  <FormatIcon size={24} />
                  <div>
                    <h2>{resource.title}</h2>
                    <p>{resource.pulseSummary || resource.description}</p>
                  </div>
                </div>
              </PulseCard>
            );
          })}
          </div>
        </section>
      ) : null}

      <section className="pulse-library-section" aria-label="Pulse resources">
        <div className="pulse-library-section__header">
          <div>
            <PulseBadge tone="coral">Browse</PulseBadge>
            <h2>All resources</h2>
          </div>
          <span>{filteredResources.length} showing</span>
        </div>
        <div className="pulse-library-grid">
        {filteredResources.map((resource) => {
          const format = resourceFormat(resource);
          const FormatIcon = format.icon;
          return (
            <PulseCard className={`pulse-library-card pulse-library-card--${format.tone}`} key={resource.id}>
              <div className="pulse-library-card__preview" aria-hidden="true">
                <div className="pulse-library-card__icon">
                  <FormatIcon size={24} />
                </div>
                <span>{format.label}</span>
              </div>
              <div>
                <span className={`pulse-category-chip pulse-category-chip--${categoryToneClass(resource.pulseCategory ?? resource.resourceDomainKey)}`}>
                  {categoryLabel(resource.pulseCategory ?? resource.resourceDomainKey)}
                </span>
                <h2>{resource.title}</h2>
                <p>{resource.pulseSummary || resource.description || 'Open this resource from Pulse when you need it.'}</p>
              </div>
              {resource.url && resource.url !== '#' && !resource.locked ? (
                <a className="pulse-button pulse-button--primary" href={resource.url} rel="noreferrer" target="_blank">
                  <span>{format.action}</span>
                  <ExternalLink size={16} />
                </a>
              ) : (
                <button className="pulse-button pulse-button--secondary" disabled type="button">
                  <span>{shownAsSample ? 'Sample preview' : 'Access required'}</span>
                </button>
              )}
            </PulseCard>
          );
        })}
        </div>
      </section>
    </div>
  );
}
