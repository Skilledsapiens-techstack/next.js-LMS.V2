import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  TrendingUp
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulseOpportunity,
  usePulseOpportunities,
  usePulseOpportunityApplications,
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

const opportunityTabs: Array<{ label: string; value: 'all' | PulseOpportunity['opportunity_type'] }> = [
  { label: 'All', value: 'all' },
  { label: 'Live projects', value: 'live_project' },
  { label: 'Freelance', value: 'freelance' },
  { label: 'Challenges', value: 'challenge' },
  { label: 'Events', value: 'event' },
  { label: 'Resume review', value: 'resume_review' }
];

const applicationStatusLabels: Record<string, string> = {
  applied: 'Applied',
  interested: 'Saved interest',
  rejected: 'Not selected',
  selected: 'Selected',
  shortlisted: 'Shortlisted',
  withdrawn: 'Withdrawn'
};

function closeLabel(value?: string | null) {
  if (!value) return 'Open now';
  return `Closes ${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(value))}`;
}

function PulseOpportunityCard({
  applicationStatus,
  opportunity
}: {
  applicationStatus?: string;
  opportunity: PulseOpportunity;
}) {
  const isInterested = Boolean(applicationStatus);

  return (
    <PulseCard className="pulse-opportunity-card">
      <div className="pulse-opportunity-card__main">
        <div className="pulse-opportunity-card__eyebrow">
          <PulseBadge tone="green">{opportunityTypeLabels[opportunity.opportunity_type]}</PulseBadge>
        </div>

        <div className="pulse-opportunity-card__body">
          <h2>{opportunity.title}</h2>
          <p>{opportunity.description}</p>
        </div>

        <div className="pulse-opportunity-card__meta">
          <span><Building2 size={16} /> {opportunity.company_name || 'Skilled Sapiens'}</span>
          <span><Clock3 size={16} /> {closeLabel(opportunity.closes_at)}</span>
        </div>
      </div>

      <div className="pulse-opportunity-card__actions">
        <Link className="pulse-button pulse-button--secondary" to={`/pulse/opportunities/${opportunity.id}`}>
          <span>{isInterested ? 'View application' : 'Apply now'}</span>
          <ArrowRight size={18} />
        </Link>
      </div>
    </PulseCard>
  );
}

export function PulseOpportunitiesPage() {
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const opportunitiesQuery = usePulseOpportunities(profile);
  const applicationsQuery = usePulseOpportunityApplications(profile);
  const [activeType, setActiveType] = useState<(typeof opportunityTabs)[number]['value']>('all');
  const [query, setQuery] = useState('');

  const applicationMap = useMemo(() => {
    const map = new Map<string, string>();
    (applicationsQuery.data ?? []).forEach((application) => {
      map.set(application.opportunity_id, application.status);
    });
    return map;
  }, [applicationsQuery.data]);

  const opportunities = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return (opportunitiesQuery.data ?? []).filter((opportunity) => {
      const matchesType = activeType === 'all' || opportunity.opportunity_type === activeType;
      const matchesQuery = !cleanQuery
        || opportunity.title.toLowerCase().includes(cleanQuery)
        || opportunity.description.toLowerCase().includes(cleanQuery)
        || (opportunity.company_name ?? '').toLowerCase().includes(cleanQuery);
      return matchesType && matchesQuery;
    });
  }, [activeType, opportunitiesQuery.data, query]);

  const myApplications = useMemo(
    () => (applicationsQuery.data ?? []).filter((application) => application.status !== 'interested'),
    [applicationsQuery.data]
  );

  useEffect(() => {
    document.title = 'Opportunities | SapiensPulse';
  }, []);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Opportunities</PulseBadge>
        <h1>Opening Pulse opportunities.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  return (
    <section className="pulse-opportunities-page">
      <div className="pulse-opportunities-hero pulse-library-hero">
        <div>
          <PulseBadge tone="coral">Opportunities</PulseBadge>
          <h1>Browse open opportunities.</h1>
          <p>Live projects, freelance-style briefs, challenges, events, and resume rooms available for Pulse students.</p>
          <div className="pulse-library-hero__chips" aria-label="Opportunity highlights">
            <span><BriefcaseBusiness size={16} /> Live projects</span>
            <span><TrendingUp size={16} /> Profile signals</span>
            <span><FileText size={16} /> Applications</span>
          </div>
        </div>
        <PulseCard className="pulse-library-hero__panel pulse-opportunities-hero__panel">
          <BriefcaseBusiness size={24} />
          <strong>{opportunities.length} {opportunities.length === 1 ? 'open opportunity' : 'open opportunities'}</strong>
          <span>Apply where your profile and goals fit best.</span>
        </PulseCard>
      </div>

      <PulseCard className="pulse-opportunity-controls">
        <div className="pulse-opportunity-search">
          <Search size={19} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects, companies, skills, or roles"
            value={query}
          />
        </div>
      </PulseCard>

      <PulseCard className="pulse-opportunity-tabs-card">
        <div className="pulse-opportunity-tabs" aria-label="Opportunity filters">
          {opportunityTabs.map((tab) => (
            <button
              className={activeType === tab.value ? 'is-active' : ''}
              key={tab.value}
              onClick={() => setActiveType(tab.value)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </PulseCard>

      {myApplications.length ? (
        <PulseCard className="pulse-my-applications-card">
          <div className="pulse-my-applications-card__header">
            <div>
              <PulseBadge tone="gold">My applications</PulseBadge>
              <h2>Track where you have applied.</h2>
            </div>
            <span><FileText size={17} /> {myApplications.length} active</span>
          </div>
          <div className="pulse-my-applications-list">
            {myApplications.map((application) => (
              <Link className="pulse-my-application-row" key={application.id} to={`/pulse/opportunities/${application.opportunity_id}`}>
                <span className="pulse-my-application-row__icon">
                  <CheckCircle2 size={18} />
                </span>
                <div>
                  <strong>{application.opportunity?.title ?? 'Opportunity application'}</strong>
                  <span>
                    {application.opportunity?.company_name || 'Skilled Sapiens'} · {applicationStatusLabels[application.status] ?? application.status}
                  </span>
                </div>
                <small>{application.applied_at ? `Applied ${closeLabel(application.applied_at).replace('Closes ', '')}` : 'Submitted on Pulse'}</small>
              </Link>
            ))}
          </div>
        </PulseCard>
      ) : null}

      <div className="pulse-opportunity-list-header">
        <div>
          <PulseBadge tone="green">Open now</PulseBadge>
          <h2>{opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}</h2>
        </div>
      </div>

      {opportunitiesQuery.isLoading ? (
        <div className="pulse-feed-state">Loading fresh opportunities.</div>
      ) : opportunitiesQuery.error ? (
        <div className="pulse-feed-state pulse-feed-state--error">{opportunitiesQuery.error.message}</div>
      ) : opportunities.length ? (
        <div className="pulse-opportunity-grid">
          {opportunities.map((opportunity) => (
            <PulseOpportunityCard
              applicationStatus={applicationMap.get(opportunity.id)}
              key={opportunity.id}
              opportunity={opportunity}
            />
          ))}
        </div>
      ) : (
        <div className="pulse-feed-state">
          <strong>No opportunities found.</strong>
          <span>Try a broader search or switch the opportunity type.</span>
        </div>
      )}
    </section>
  );
}
