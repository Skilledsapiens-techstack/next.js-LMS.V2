import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Flag,
  Send,
  Sparkles,
  Target,
  X,
  UsersRound
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { ProjectRichText } from '../../components/ProjectRichText';
import { PulseBadge, PulseCard } from '../components';
import {
  PulseOpportunity,
  useApplyPulseOpportunity,
  useMarkPulseOpportunityInterest,
  usePulseOpportunities,
  usePulseOpportunityApplications,
  usePulseOpportunityDetail,
  usePulseProfile,
  usePulseProfileDefaults
} from '../features/usePulseCommunity';
import { PulseProfileOnboarding } from './PulseHomePage';

const opportunityTypeLabels: Record<PulseOpportunity['opportunity_type'], string> = {
  challenge: 'Challenge',
  event: 'Event',
  freelance: 'Freelance',
  live_project: 'Live project',
  resume_review: 'Resume review'
};

const opportunityBriefs: Record<PulseOpportunity['opportunity_type'], { deliverables: string[]; outcomes: string[]; skills: string[] }> = {
  challenge: {
    deliverables: ['Understand the problem statement', 'Build a clear submission', 'Share your approach before the deadline'],
    outcomes: ['Competitive proof of work', 'Peer visibility', 'Stronger problem-solving signal'],
    skills: ['Research', 'Strategy', 'Presentation']
  },
  event: {
    deliverables: ['Reserve your interest', 'Attend the session or room', 'Use the discussion to connect with relevant peers'],
    outcomes: ['Peer learning', 'Career clarity', 'Community visibility'],
    skills: ['Communication', 'Networking', 'Reflection']
  },
  freelance: {
    deliverables: ['Review the brief', 'Show interest with a relevant profile', 'Prepare work samples or a short pitch'],
    outcomes: ['Client-style exposure', 'Portfolio signal', 'Practical execution experience'],
    skills: ['Execution', 'Client thinking', 'Ownership']
  },
  live_project: {
    deliverables: ['Study the company/problem brief', 'Join or form a student team', 'Create a usable project output'],
    outcomes: ['Real project experience', 'Team collaboration', 'Proof of work for interviews'],
    skills: ['Research', 'Analysis', 'Collaboration']
  },
  resume_review: {
    deliverables: ['Share your current profile context', 'Use the review feedback', 'Update your resume or LinkedIn profile'],
    outcomes: ['Sharper career positioning', 'Cleaner resume story', 'Better recruiter readiness'],
    skills: ['Career clarity', 'Writing', 'Personal branding']
  }
};

function formatDate(value?: string | null) {
  if (!value) return 'Open now';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function relatedOpportunities(opportunities: PulseOpportunity[], current?: PulseOpportunity | null) {
  if (!current) return [];
  return opportunities
    .filter((opportunity) => opportunity.id !== current.id)
    .filter((opportunity) => opportunity.opportunity_type === current.opportunity_type || opportunity.visibility === current.visibility)
    .slice(0, 3);
}

const applicationStatusLabels: Record<string, string> = {
  applied: 'Application submitted',
  interested: 'Interest saved',
  rejected: 'Not selected',
  selected: 'Selected',
  shortlisted: 'Shortlisted',
  withdrawn: 'Withdrawn'
};

export function PulseOpportunityDetailPage() {
  const { opportunityId } = useParams();
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const opportunityQuery = usePulseOpportunityDetail(opportunityId, profile);
  const opportunitiesQuery = usePulseOpportunities(profile);
  const applicationsQuery = usePulseOpportunityApplications(profile);
  const opportunity = opportunityQuery.data;
  const markInterest = useMarkPulseOpportunityInterest(profile);
  const applyOpportunity = useApplyPulseOpportunity(profile);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    linkedinUrl: '',
    note: '',
    portfolioUrl: '',
    questionOne: '',
    resumeUrl: ''
  });

  const application = useMemo(
    () => (applicationsQuery.data ?? []).find((item) => item.opportunity_id === opportunityId),
    [applicationsQuery.data, opportunityId]
  );
  const brief = opportunity ? opportunityBriefs[opportunity.opportunity_type] : null;
  const related = useMemo(
    () => relatedOpportunities(opportunitiesQuery.data ?? [], opportunity),
    [opportunitiesQuery.data, opportunity]
  );

  useEffect(() => {
    document.title = opportunity?.title ? `${opportunity.title} | Pulse Opportunities` : 'Opportunity | SapiensPulse';
  }, [opportunity?.title]);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading || opportunityQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Opportunity</PulseBadge>
        <h1>Opening this opportunity brief.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  if (!opportunity || !brief) {
    return (
      <section className="pulse-opportunity-detail-page">
        <Link className="pulse-back-link" to="/pulse/opportunities">
          <ArrowLeft size={17} /> Back to opportunities
        </Link>
        <PulseCard className="pulse-feed-state">
          <strong>This opportunity is not available.</strong>
          <span>It may be closed, paused, or outside the Pulse space you can access.</span>
        </PulseCard>
      </section>
    );
  }

  const isInterested = Boolean(application);
  const hasApplied = Boolean(application && application.status !== 'interested');

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opportunity) return;
    await applyOpportunity.mutateAsync({
      answers: {
        fit: applyForm.questionOne.trim()
      },
      linkedinUrl: applyForm.linkedinUrl,
      note: applyForm.note,
      opportunityId: opportunity.id,
      portfolioUrl: applyForm.portfolioUrl,
      resumeUrl: applyForm.resumeUrl
    });
    setIsApplyOpen(false);
  }

  return (
    <section className="pulse-opportunity-detail-page">
      <Link className="pulse-back-link" to="/pulse/opportunities">
        <ArrowLeft size={17} /> Back to opportunities
      </Link>

      <div className="pulse-opportunity-detail-hero">
        <div>
          <PulseBadge tone="green">{opportunityTypeLabels[opportunity.opportunity_type]}</PulseBadge>
          <h1>{opportunity.title}</h1>
          <p>{opportunity.description}</p>
          <div className="pulse-opportunity-detail-hero__meta">
            <span><Building2 size={17} /> {opportunity.company_name || 'Skilled Sapiens'}</span>
            <span><UsersRound size={17} /> {opportunity.visibility === 'global' ? 'Everyone on Pulse' : 'My college only'}</span>
          </div>
        </div>

        <PulseCard className="pulse-opportunity-action-card">
          <span><Sparkles size={18} /> Opportunity status</span>
          <strong>{application ? applicationStatusLabels[application.status] ?? `Status: ${application.status}` : 'Open for applications'}</strong>
          <button
            className="pulse-button pulse-button--primary"
            disabled={applyOpportunity.isPending || hasApplied}
            onClick={() => setIsApplyOpen(true)}
            type="button"
          >
            <span>{hasApplied ? 'Already applied' : 'Apply now'}</span>
            <Send size={18} />
          </button>
          <button
            className={isInterested ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--ghost'}
            disabled={markInterest.isPending || isInterested}
            onClick={() => markInterest.mutate({ opportunityId: opportunity.id })}
            type="button"
          >
            <span>
              {markInterest.isPending ? 'Saving' : isInterested ? 'Interest saved' : "I'm interested"}
            </span>
            <BriefcaseBusiness size={18} />
          </button>
          {opportunity.application_url ? (
            <a className="pulse-inline-link" href={opportunity.application_url} rel="noreferrer" target="_blank">
              Open external brief <ExternalLink size={14} />
            </a>
          ) : null}
          {applyOpportunity.error ? <p className="pulse-form-error">{applyOpportunity.error.message}</p> : null}
          {markInterest.error ? <p className="pulse-form-error">{markInterest.error.message}</p> : null}
        </PulseCard>
      </div>

      <div className="pulse-opportunity-info-grid">
        <PulseCard>
          <CalendarClock size={20} />
          <span>Starts</span>
          <strong>{formatDate(opportunity.starts_at)}</strong>
        </PulseCard>
        <PulseCard>
          <Flag size={20} />
          <span>Deadline</span>
          <strong>{formatDate(opportunity.closes_at)}</strong>
        </PulseCard>
        <PulseCard>
          <Target size={20} />
          <span>Format</span>
          <strong>{opportunityTypeLabels[opportunity.opportunity_type]}</strong>
        </PulseCard>
        {Number(opportunity.display_applied_count ?? 0) > 0 ? (
          <PulseCard>
            <FileText size={20} />
            <span>Applied</span>
            <strong>{Number(opportunity.display_applied_count)} students</strong>
          </PulseCard>
        ) : null}
      </div>

      <div className="pulse-opportunity-detail-grid">
        <PulseCard className="pulse-opportunity-brief-card">
          <PulseBadge tone="coral">What you will do</PulseBadge>
          <h2>Work on a clear student-ready brief.</h2>
          <div className="pulse-opportunity-checklist">
            {brief.deliverables.map((item) => (
              <span key={item}><CheckCircle2 size={17} /> {item}</span>
            ))}
          </div>
        </PulseCard>

        <PulseCard className="pulse-opportunity-brief-card">
          <PulseBadge tone="gold">Why it matters</PulseBadge>
          <h2>Build proof that can travel beyond Pulse.</h2>
          <div className="pulse-opportunity-checklist">
            {brief.outcomes.map((item) => (
              <span key={item}><Sparkles size={17} /> {item}</span>
            ))}
          </div>
        </PulseCard>
      </div>

      <PulseCard className="pulse-opportunity-skills-card">
        <div>
          <PulseBadge tone="brand">Skills signal</PulseBadge>
          <h2>Skills students can show through this opportunity.</h2>
        </div>
        <div className="pulse-opportunity-card__tags">
          {brief.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </PulseCard>

      <PulseCard className="pulse-opportunity-detail-description-card">
        <div>
          <PulseBadge tone="coral">Opportunity details</PulseBadge>
          <h2>Read the full brief before you apply.</h2>
        </div>
        <ProjectRichText
          className="pulse-opportunity-detail-description"
          html={opportunity.detail_description || opportunity.description}
        />
      </PulseCard>

      {related.length ? (
        <section className="pulse-opportunity-related">
          <h2>Related opportunities</h2>
          <div className="pulse-opportunity-related__grid">
            {related.map((item) => (
              <Link className="pulse-opportunity-related-card" key={item.id} to={`/pulse/opportunities/${item.id}`}>
                <PulseBadge tone="green">{opportunityTypeLabels[item.opportunity_type]}</PulseBadge>
                <strong>{item.title}</strong>
                <span>{item.company_name || 'Skilled Sapiens'} · {formatDate(item.closes_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {isApplyOpen ? (
        <div className="pulse-application-modal" role="dialog" aria-modal="true" aria-labelledby="pulse-application-title">
          <button aria-label="Close application form" className="pulse-application-modal__backdrop" onClick={() => setIsApplyOpen(false)} type="button" />
          <PulseCard className="pulse-application-modal__panel">
            <header className="pulse-application-modal__header">
              <div>
                <PulseBadge tone="coral">Apply on Pulse</PulseBadge>
                <h2 id="pulse-application-title">{opportunity.title}</h2>
                <p>Submit your profile context for this opportunity. Admin can review and update your status from Pulse.</p>
              </div>
              <button aria-label="Close application form" className="pulse-icon-button" onClick={() => setIsApplyOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>
            <form className="pulse-application-form" onSubmit={submitApplication}>
              <label className="pulse-application-form__wide">
                <span>Why are you a good fit?</span>
                <textarea
                  onChange={(event) => setApplyForm({ ...applyForm, note: event.target.value })}
                  placeholder="Mention your relevant skills, project experience, interest area, or why you want to work on this."
                  required
                  rows={5}
                  value={applyForm.note}
                />
              </label>
              <label>
                <span>Resume link</span>
                <input
                  onChange={(event) => setApplyForm({ ...applyForm, resumeUrl: event.target.value })}
                  placeholder="Google Drive, Dropbox, or resume URL"
                  type="url"
                  value={applyForm.resumeUrl}
                />
              </label>
              <label>
                <span>LinkedIn profile</span>
                <input
                  onChange={(event) => setApplyForm({ ...applyForm, linkedinUrl: event.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  type="url"
                  value={applyForm.linkedinUrl}
                />
              </label>
              <label>
                <span>Portfolio or work sample</span>
                <input
                  onChange={(event) => setApplyForm({ ...applyForm, portfolioUrl: event.target.value })}
                  placeholder="Project, case deck, GitHub, Notion, or website"
                  type="url"
                  value={applyForm.portfolioUrl}
                />
              </label>
              <label>
                <span>Relevant proof</span>
                <input
                  onChange={(event) => setApplyForm({ ...applyForm, questionOne: event.target.value })}
                  placeholder="One line about a related project, skill, or result"
                  value={applyForm.questionOne}
                />
              </label>
              {applyOpportunity.error ? <p className="pulse-form-error">{applyOpportunity.error.message}</p> : null}
              <button className="pulse-button pulse-button--primary pulse-application-form__wide" disabled={applyOpportunity.isPending} type="submit">
                <span>{applyOpportunity.isPending ? 'Submitting' : 'Submit application'}</span>
                <FileText size={18} />
              </button>
            </form>
          </PulseCard>
        </div>
      ) : null}
    </section>
  );
}
