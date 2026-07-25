import { ArrowRight, Award, Bell, BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock, CreditCard, ExternalLink, GraduationCap, Library, MessageCircle, Search, ShieldCheck, Video, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenStates';
import { StateBlock } from '../components/StateBlock';
import { StatusBadge } from '../components/StatusBadge';
import { apiGet } from '../lib/supabaseApi';

type GuestProfile = {
  accessLabel?: string;
  currentCity?: string | null;
  fullName: string;
  interestedRoles?: string[];
  leadStatus: string;
  mentorAllocationInterest?: string;
  personalEmail: string;
};

type GuestProgram = {
  bannerUrl?: string | null;
  careerOutcomes?: string | null;
  catalogueBadge?: string | null;
  certificateDetails?: string | null;
  ctaButtons?: Array<{ label?: string | null; url?: string | null; variant?: 'primary' | 'secondary' | null }>;
  curriculum?: string[];
  ctaLabel?: string;
  domainLabel?: string | null;
  duration?: string | null;
  faqs?: Array<{ answer?: string | null; question?: string | null }>;
  highlights?: string[];
  id: string;
  liveProjectDetails?: string | null;
  mentorSupport?: string | null;
  name: string;
  nextBatchDate?: string | null;
  outcomes?: string[];
  overview?: string;
  pricingNote?: string;
  pricing?: string | null;
  programKey: string;
  scheduleFormat?: string | null;
  shortDescription?: string | null;
  shortName?: string | null;
  thumbnailUrl?: string | null;
  toolsCovered?: string | null;
  whatYouWillLearn?: string | null;
  whoShouldJoin?: string | null;
};

type ProgramCatalogueResponse = {
  items: GuestProgram[];
  total: number;
};

type GuestModule = {
  description: string;
  eyebrow: string;
  icon: typeof GraduationCap;
  path: string;
  title: string;
};

type GuestContentItem = {
  category?: string;
  content?: string | null;
  date?: string;
  description?: string | null;
  guestCtaLabel?: string | null;
  guestCtaUrl?: string | null;
  guestRegistrationRequired?: boolean;
  id: string;
  linkButtons?: Array<{ label?: string | null; url?: string | null }>;
  linkLabel?: string | null;
  linkUrl?: string | null;
  recordingPassword?: string | null;
  recordingUrl?: string | null;
  resourceMode?: string | null;
  resourceType?: string | null;
  sectionTitle?: string | null;
  time?: string;
  title: string;
  url?: string | null;
  youtubeVideoUrl?: string | null;
  zoomRecordingUrl?: string | null;
};

type GuestContentResponse = {
  items: GuestContentItem[];
  total: number;
};

const guestModules: GuestModule[] = [
  {
    description: 'Explore active Skilled Sapiens programmes, pricing notes, and enrolment next steps.',
    eyebrow: 'Programme Catalogue',
    icon: GraduationCap,
    path: '/guest/programs',
    title: 'Browse programmes'
  },
  {
    description: 'Free recordings selected by the admin team will appear here when available for guest access.',
    eyebrow: 'Watch Recordings',
    icon: Video,
    path: '/guest/recordings',
    title: 'Watch selected recordings'
  },
  {
    description: 'Guest-accessible sessions and public workshops will appear here once scheduled.',
    eyebrow: 'Upcoming Workshops',
    icon: CalendarDays,
    path: '/guest/schedule',
    title: 'View free workshops'
  },
  {
    description: 'Free resources selected for guest learners will appear here.',
    eyebrow: 'Resource Library',
    icon: Library,
    path: '/guest/resources',
    title: 'Open free resources'
  },
  {
    description: 'Career readiness samples and guides selected for guests will appear here.',
    eyebrow: 'Career Readiness',
    icon: BriefcaseBusiness,
    path: '/guest/career-readiness',
    title: 'Explore career samples'
  },
  {
    description: 'Important guest updates and free-access announcements will appear here.',
    eyebrow: 'Announcements',
    icon: Bell,
    path: '/guest/announcements',
    title: 'Check updates'
  },
  {
    description: 'Use support when you need help with guest access or programme discovery.',
    eyebrow: 'Support',
    icon: MessageCircle,
    path: '/guest/support',
    title: 'Contact support'
  }
];

function formatLeadStatus(value?: string) {
  return (value ?? 'new').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMentorInterest(value?: string) {
  if (value === 'yes_urgently') return 'Mentor requested';
  if (value === 'no') return 'No mentor request';
  return 'Mentor maybe later';
}

function getProgramSummary(program: GuestProgram) {
  const authored = plainText(program.shortDescription || program.overview);
  if (authored) return authored;
  const domain = program.domainLabel?.trim();
  if (domain) return `Explore the ${domain} programme structure, learning direction, mentor support, and enrolment next steps curated by Skilled Sapiens.`;
  return 'Explore the programme structure, learning direction, mentor support, and enrolment next steps curated by Skilled Sapiens.';
}

function routeModule(pathname: string) {
  return guestModules.find((module) => pathname === module.path);
}

function endpointForGuestModule(path: string) {
  if (path === '/guest/resources') return '/guests/resources';
  if (path === '/guest/career-readiness') return '/guests/career-readiness';
  if (path === '/guest/schedule') return '/guests/schedule';
  if (path === '/guest/recordings') return '/guests/recordings';
  return '';
}

function plainText(value?: string | null) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatGuestDate(date?: string, time?: string) {
  if (!date) return '';
  const parsed = new Date(`${date}T${time || '00:00'}`);
  if (Number.isNaN(parsed.getTime())) return [date, time].filter(Boolean).join(' · ');
  return parsed.toLocaleString(undefined, { day: '2-digit', hour: time ? '2-digit' : undefined, minute: time ? '2-digit' : undefined, month: 'short', year: 'numeric' });
}

function primaryGuestLink(item: GuestContentItem) {
  const firstButton = item.linkButtons?.find((button) => button.url);
  const url = item.guestCtaUrl || firstButton?.url || item.linkUrl || item.url || item.recordingUrl || item.youtubeVideoUrl || item.zoomRecordingUrl;
  const label = item.guestCtaLabel || firstButton?.label || item.linkLabel || (item.guestRegistrationRequired ? 'Register to open' : 'Open');
  return url ? { label, url } : null;
}

export function GuestAccessPage() {
  const { accessToken } = useAuth();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<GuestProgram | null>(null);
  const activeModule = routeModule(location.pathname);
  const isProgrammeCatalogue = location.pathname === '/guest/programs';

  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => apiGet<GuestProfile>('/guests/me', { accessToken: accessToken ?? undefined }),
    queryKey: ['guest-profile', accessToken],
    staleTime: 60 * 1000
  });

  const programsQuery = useQuery({
    enabled: Boolean(accessToken && profileQuery.data && isProgrammeCatalogue),
    queryFn: () => apiGet<ProgramCatalogueResponse>('/guests/programs', { accessToken: accessToken ?? undefined }),
    queryKey: ['guest-programs', accessToken],
    staleTime: 60 * 1000
  });

  const filteredPrograms = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    const items = programsQuery.data?.items ?? [];
    if (!cleanSearch) return items;
    return items.filter((program) => [program.name, program.shortName, program.domainLabel, program.programKey].some((value) => String(value ?? '').toLowerCase().includes(cleanSearch)));
  }, [programsQuery.data?.items, search]);

  if (profileQuery.isLoading) {
    return (
      <div className="page-stack">
        <LoadingState />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="page-stack">
        <ErrorState />
      </div>
    );
  }

  const profile = profileQuery.data;

  if (isProgrammeCatalogue) {
    return (
      <div className="page-stack student-dashboard guest-dashboard-page">
        <PageHeader
          description="Browse active Skilled Sapiens programmes available for discovery. Payment and registration links will appear once configured by admin."
          eyebrow="Programme Catalogue"
          title="Program Catalogue"
        />
        <ProgrammeCatalogue
          filteredPrograms={filteredPrograms}
          isError={programsQuery.isError}
          isLoading={programsQuery.isLoading}
          search={search}
          setSearch={setSearch}
          setSelectedProgram={setSelectedProgram}
        />
        {selectedProgram ? <ProgramDetailModal program={selectedProgram} onClose={() => setSelectedProgram(null)} /> : null}
      </div>
    );
  }

  if (activeModule) {
    return <GuestModulePage module={activeModule} />;
  }

  return <GuestDashboard profile={profile} />;
}

function GuestDashboard({ profile }: { profile?: GuestProfile }) {
  const roles = profile?.interestedRoles?.filter(Boolean) ?? [];

  return (
    <div className="page-stack student-dashboard guest-dashboard-page">
      <PageHeader
        description="A quick home base for your free access, programme discovery, selected samples, and important updates."
        eyebrow="Student Dashboard"
        title={`Welcome${profile?.fullName ? `, ${profile.fullName}` : ''}`}
      />

      <section className="student-home-hero">
        <div className="student-home-hero__main">
          <div className="student-profile-heading">
            <span className="eyebrow">{profile?.accessLabel ?? 'Free Access'}</span>
            <h2>Start with your guest access</h2>
            <p>This is the same learning portal experience with only guest-allowed content visible. Paid-only sections stay hidden until a programme and cohort are assigned.</p>
          </div>
          <div className="student-profile-section student-profile-section--clarity">
            <div>
              <span>Access status</span>
              <p>{formatLeadStatus(profile?.leadStatus)} lead. Communication email: {profile?.personalEmail ?? 'Personal email'}.</p>
            </div>
            <div className="student-cohort-list">
              <StatusBadge tone="safe">Verified Guest</StatusBadge>
              <StatusBadge>{formatMentorInterest(profile?.mentorAllocationInterest)}</StatusBadge>
              {profile?.currentCity ? <StatusBadge>{profile.currentCity}</StatusBadge> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="student-action-center">
        <div className="student-action-center__header">
          <div>
            <span className="eyebrow">Free Access Action Center</span>
            <h2>Pick a module to explore</h2>
          </div>
        </div>
        <div className="student-action-center__grid guest-program-grid">
          {guestModules.map((module) => {
            const Icon = module.icon;
            return (
              <article className="student-action-card" key={module.path}>
                <span className="student-action-card__icon">
                  <Icon size={22} />
                </span>
                <div className="student-action-card__content">
                  <span>{module.eyebrow}</span>
                  <h3>{module.title}</h3>
                  <p>{module.description}</p>
                </div>
                <div className="student-action-card__footer">
                  <Link className="student-action student-action--primary" to={module.path}>
                    Open
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="student-home-grid student-home-grid--three">
        <article className="student-action-card">
          <span className="student-action-card__icon">
            <BriefcaseBusiness size={22} />
          </span>
          <div className="student-action-card__content">
            <span>Your interest</span>
            <h3>{roles.length > 0 ? roles.slice(0, 2).join(', ') : 'Not selected yet'}</h3>
            <p>Your signup preferences help Skilled Sapiens recommend the right programme and mentor path.</p>
          </div>
        </article>
        <article className="student-action-card">
          <span className="student-action-card__icon">
            <ShieldCheck size={22} />
          </span>
          <div className="student-action-card__content">
            <span>Upgrade path</span>
            <h3>Same login continues</h3>
            <p>When you enrol, admin can convert this guest lead into a paid student profile without asking you to create another account.</p>
          </div>
        </article>
        <article className="student-action-card">
          <span className="student-action-card__icon">
            <BookOpen size={22} />
          </span>
          <div className="student-action-card__content">
            <span>Limited access</span>
            <h3>Only unlocked items</h3>
            <p>Recordings, resources, workshops, and career guides appear only when admin marks them available to guests.</p>
          </div>
        </article>
      </section>
    </div>
  );
}

function ProgrammeCatalogue({
  filteredPrograms,
  isError,
  isLoading,
  search,
  setSearch,
  setSelectedProgram
}: {
  filteredPrograms: GuestProgram[];
  isError: boolean;
  isLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  setSelectedProgram: (program: GuestProgram) => void;
}) {
  return (
    <section className="student-action-center">
      <div className="student-action-center__header">
        <div>
          <span className="eyebrow">Programme Catalogue</span>
          <h2>Choose what you want to explore next</h2>
        </div>
        <label className="filter-search guest-program-search">
          <Search size={18} />
          <input aria-label="Search programmes" placeholder="Search programmes" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>

      {isLoading ? <LoadingState /> : null}
      {isError ? (
        <StateBlock title="Programme catalogue could not load" tone="warning">
          Refresh the page. If this continues, contact the Skilled Sapiens team.
        </StateBlock>
      ) : null}
      {!isLoading && !isError && filteredPrograms.length === 0 ? <EmptyState /> : null}

      {filteredPrograms.length > 0 ? (
        <div className="student-action-center__grid guest-program-grid">
          {filteredPrograms.map((program) => (
            <article className="student-action-card" key={program.id}>
              <span className="student-action-card__icon">
                <GraduationCap size={22} />
              </span>
              <div className="student-action-card__content">
                <span>{program.domainLabel || program.shortName || 'Programme'}</span>
                <h3>{program.name}</h3>
                <p>{getProgramSummary(program)}</p>
              </div>
              <div className="student-action-card__footer">
                <button className="student-action student-action--primary" type="button" onClick={() => setSelectedProgram(program)}>
                  View details
                  <ArrowRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function GuestModulePage({ module }: { module: GuestModule }) {
  const { accessToken } = useAuth();
  const Icon = module.icon;
  const endpoint = endpointForGuestModule(module.path);
  const contentQuery = useQuery({
    enabled: Boolean(accessToken && endpoint),
    queryFn: () => apiGet<GuestContentResponse>(endpoint, { accessToken: accessToken ?? undefined, query: { limit: 50, page: 1 } }),
    queryKey: ['guest-content', endpoint, accessToken],
    staleTime: 60 * 1000
  });
  const items = contentQuery.data?.items ?? [];

  return (
    <div className="page-stack student-dashboard guest-dashboard-page">
      <PageHeader description={module.description} eyebrow={module.eyebrow} title={module.eyebrow} />
      <section className="student-home-hero">
        <div className="student-home-hero__main">
          <div className="student-profile-heading">
            <span className="eyebrow">Free Access</span>
            <h2>{module.title}</h2>
            <p>Only content explicitly enabled for guest users will be shown here.</p>
          </div>
        </div>
      </section>
      <section className="student-action-center">
        {contentQuery.isLoading ? <LoadingState /> : null}
        {contentQuery.isError ? <ErrorState /> : null}
        {!contentQuery.isLoading && !contentQuery.isError && items.length === 0 ? (
          <div className="student-action-card">
            <span className="student-action-card__icon">
              <Icon size={22} />
            </span>
            <div className="student-action-card__content">
              <span>{module.eyebrow}</span>
              <h3>No guest items yet</h3>
              <p>The admin team can unlock selected free items for guest access. When available, they will appear here in the same portal layout.</p>
            </div>
          </div>
        ) : null}
        {items.length > 0 ? (
          <div className="student-action-center__grid guest-program-grid">
            {items.map((item) => {
              const link = primaryGuestLink(item);
              const subtitle = item.sectionTitle || item.resourceType || item.resourceMode || formatGuestDate(item.date, item.time) || module.eyebrow;
              return (
                <article className="student-action-card" key={item.id}>
                  <span className="student-action-card__icon">
                    <Icon size={22} />
                  </span>
                  <div className="student-action-card__content">
                    <span>{subtitle}</span>
                    <h3>{item.title}</h3>
                    <p>{plainText(item.description || item.content) || 'Guest-accessible item selected by Skilled Sapiens.'}</p>
                    {item.recordingPassword ? <p>Recording password: {item.recordingPassword}</p> : null}
                  </div>
                  {link ? (
                    <div className="student-action-card__footer">
                      <a className="student-action student-action--primary" href={link.url ?? '#'} rel="noreferrer" target={link.url?.startsWith('http') ? '_blank' : undefined}>
                        {link.label}
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProgramDetailModal({ onClose, program }: { onClose: () => void; program: GuestProgram }) {
  const ctaButtons = (program.ctaButtons ?? []).filter((button) => button.label && button.url);
  const highlights = (program.highlights ?? []).filter(Boolean);
  const curriculum = (program.curriculum ?? []).filter(Boolean);
  const outcomes = (program.outcomes ?? []).filter(Boolean);
  const faqs = (program.faqs ?? []).filter((faq) => faq.question && faq.answer);
  const heroSummary = plainText(program.shortDescription) || getProgramSummary(program);
  const overviewCopy = plainText(program.overview);
  const metaCards = [
    program.duration ? { icon: Clock, label: 'Duration', value: program.duration } : null,
    program.pricing ? { icon: CreditCard, label: 'Pricing', value: program.pricing } : null,
    program.nextBatchDate ? { icon: CalendarDays, label: 'Next batch', value: formatGuestDate(program.nextBatchDate) } : null,
    plainText(program.certificateDetails) ? { icon: Award, label: 'Credential', value: plainText(program.certificateDetails) } : null
  ].filter(Boolean) as Array<{ icon: typeof Clock; label: string; value: string }>;
  const detailSections = [
    { body: program.whoShouldJoin, title: 'Who should join' },
    { body: program.whatYouWillLearn, title: 'What you will learn' },
    { body: program.liveProjectDetails, title: 'Live project experience' },
    { body: program.toolsCovered, title: 'Tools covered' },
    { body: program.careerOutcomes, title: 'Career outcomes' },
    { body: program.scheduleFormat, title: 'Schedule format' },
    { body: program.mentorSupport, title: 'Mentor support' },
    { body: program.certificateDetails, title: 'Certificate details' }
  ].filter((section) => plainText(section.body));

  return (
    <div className="student-modal-backdrop" role="presentation">
      <section aria-labelledby="guest-program-modal-title" aria-modal="true" className="student-modal guest-program-modal guest-program-modal--pdp" role="dialog">
        <header className="student-modal__header">
          <div>
            <p className="program-modal-eyebrow">{program.domainLabel || 'Programme Catalogue'}</p>
            <h2 id="guest-program-modal-title">Programme Details</h2>
          </div>
          <button aria-label="Close programme details" className="student-modal__icon-button" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </header>
        <div className="student-modal__body guest-program-pdp">
          <section className="guest-program-hero">
            <div className="guest-program-hero__copy">
              <span className="eyebrow">{program.catalogueBadge || program.domainLabel || 'Skilled Sapiens Programme'}</span>
              <h3>{program.name}</h3>
              <p>{heroSummary}</p>
              {highlights.length ? (
                <div className="guest-program-chip-row">
                  {highlights.slice(0, 6).map((item) => (
                    <span className="status-badge status-badge--info" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {ctaButtons.length ? (
                <div className="student-home-actions guest-program-hero__actions">
                  {ctaButtons.slice(0, 3).map((button, index) => (
                    <a className={button.variant === 'secondary' ? 'student-action' : 'student-action student-action--primary'} href={button.url ?? '#'} key={`${button.label}-${index}`} rel="noreferrer" target={button.url?.startsWith('http') ? '_blank' : undefined}>
                      {button.label}
                      <ExternalLink size={16} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="guest-program-hero__visual">
              {program.bannerUrl || program.thumbnailUrl ? (
                <img alt="" src={program.bannerUrl || program.thumbnailUrl || ''} />
              ) : (
                <div className="guest-program-hero__fallback">
                  <GraduationCap size={42} />
                  <strong>{program.shortName || program.domainLabel || 'Programme'}</strong>
                  <span>Skilled Sapiens learning pathway</span>
                </div>
              )}
            </div>
          </section>

          {metaCards.length ? (
            <section className="guest-program-meta-grid" aria-label="Programme snapshot">
              {metaCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label}>
                    <Icon size={18} />
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </div>
                );
              })}
            </section>
          ) : null}

          {overviewCopy ? (
            <section className="guest-program-section">
              <span className="eyebrow">Programme overview</span>
              <div className="guest-program-copy">
                <p>{overviewCopy}</p>
              </div>
            </section>
          ) : null}

          {detailSections.length ? (
            <section className="guest-program-section">
              <span className="eyebrow">Programme details</span>
              <div className="guest-program-section-grid">
                {detailSections.map((section) => (
                  <article className="student-action-card guest-program-info-card" key={section.title}>
                    <div className="student-action-card__content">
                      <span>{program.shortName || program.programKey}</span>
                      <h3>{section.title}</h3>
                      <p>{plainText(section.body)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {curriculum.length ? (
            <section className="guest-program-section">
              <span className="eyebrow">Curriculum</span>
              <div className="guest-program-timeline">
                {curriculum.map((item, index) => (
                  <div key={`${item}-${index}`}>
                    <strong>{String(index + 1).padStart(2, '0')}</strong>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {outcomes.length ? (
            <section className="guest-program-section">
              <span className="eyebrow">What you walk away with</span>
              <div className="guest-program-outcomes">
                {outcomes.map((item) => (
                  <div key={item}>
                    <CheckCircle2 size={18} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {faqs.length ? (
            <section className="guest-program-section">
              <span className="eyebrow">FAQs</span>
              <div className="guest-program-faqs">
                {faqs.map((faq) => (
                  <details key={faq.question}>
                    <summary>{faq.question}</summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

        </div>
        <footer className="student-modal__footer guest-program-pdp__footer">
          <button className="segmented-button" type="button" onClick={onClose}>
            Close
          </button>
          {ctaButtons.length
            ? ctaButtons.slice(0, 2).map((button, index) => (
                <a className={button.variant === 'secondary' ? 'segmented-button' : 'student-action student-action--primary'} href={button.url ?? '#'} key={`${button.label}-footer-${index}`} rel="noreferrer" target={button.url?.startsWith('http') ? '_blank' : undefined}>
                  {button.label}
                  <ExternalLink size={16} />
                </a>
              ))
            : null}
        </footer>
      </section>
    </div>
  );
}
