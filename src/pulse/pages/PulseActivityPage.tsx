import { Award, BarChart3, BriefcaseBusiness, CalendarClock, CheckCircle2, FileStack, MessageCircle, Send, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulsePost,
  usePulseClubPostActionActivity,
  usePulseMentorshipRsvps,
  usePulseOpportunityApplications,
  usePulseProfile,
  usePulseProfileDefaults,
  usePulseProfilePosts
} from '../features/usePulseCommunity';
import { PulseProfileOnboarding } from './PulseHomePage';

const postTypeLabels: Record<PulsePost['post_type'], string> = {
  announcement: 'Update',
  article: 'Idea',
  discussion: 'Discussion',
  opportunity: 'Opportunity',
  poll: 'Poll',
  recognition: 'Shout-out',
  shoutout: 'Shout-out'
};

const applicationStatusLabels: Record<string, string> = {
  applied: 'Applied',
  interested: 'Saved interest',
  rejected: 'Not selected',
  selected: 'Selected',
  shortlisted: 'Shortlisted',
  withdrawn: 'Withdrawn'
};

type ActivityQuickAccessItem = {
  key: string;
  kind: 'club' | 'event' | 'opportunity' | 'resource';
  meta: string;
  timestamp: number;
  title: string;
  to: string;
};

type ActivityActionItem = {
  icon: typeof MessageCircle;
  key: string;
  label: string;
  meta: string;
  title: string;
  to: string;
};

function formatActivityDate(value?: string | null) {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  }).format(new Date(value));
}

function rsvpStatusLabel(status: string) {
  if (status === 'rsvped') return 'RSVP confirmed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'attended') return 'Attended';
  if (status === 'waitlisted') return 'Waitlisted';
  return status;
}

export function PulseActivityPage() {
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const postsQuery = usePulseProfilePosts(profile?.id);
  const applicationsQuery = usePulseOpportunityApplications(profile);
  const rsvpsQuery = usePulseMentorshipRsvps(profile);
  const clubActionsQuery = usePulseClubPostActionActivity(profile);
  const [recentCollegeItems] = useState<ActivityQuickAccessItem[]>(() => {
    try {
      const storedItems = window.localStorage.getItem('pulseCollegeQuickAccessItems');
      if (!storedItems) return [];
      const parsedItems = JSON.parse(storedItems) as ActivityQuickAccessItem[];
      return Array.isArray(parsedItems) ? parsedItems.slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  const activeApplications = useMemo(
    () => (applicationsQuery.data ?? []).filter((application) => application.status !== 'interested'),
    [applicationsQuery.data]
  );
  const interestedApplications = useMemo(
    () => (applicationsQuery.data ?? []).filter((application) => application.status === 'interested'),
    [applicationsQuery.data]
  );
  const savedResourceActions = useMemo(
    () => (clubActionsQuery.data ?? []).filter((action) => action.action_type === 'saved' && action.post?.post_type === 'resource'),
    [clubActionsQuery.data]
  );
  const usefulResourceActions = useMemo(
    () => (clubActionsQuery.data ?? []).filter((action) => action.action_type === 'useful' && action.post?.post_type === 'resource'),
    [clubActionsQuery.data]
  );
  const interestedClubOpportunityActions = useMemo(
    () => (clubActionsQuery.data ?? []).filter((action) => action.action_type === 'interested' && action.post?.post_type === 'opportunity'),
    [clubActionsQuery.data]
  );
  const interestedCount = interestedApplications.length + interestedClubOpportunityActions.length;
  const upcomingRsvps = useMemo(
    () => (rsvpsQuery.data ?? []).filter((rsvp) => rsvp.status !== 'cancelled').slice(0, 8),
    [rsvpsQuery.data]
  );
  const actionQueue = useMemo<ActivityActionItem[]>(() => {
    const savedResources = savedResourceActions.slice(0, 3).map((action) => ({
      icon: FileStack,
      key: `saved-${action.id}`,
      label: 'Saved resource',
      meta: `${action.post?.club?.name ?? 'Club resource'} · ${formatActivityDate(action.created_at)}`,
      title: action.post?.title ?? 'Saved resource',
      to: action.post?.club?.slug ? `/pulse/clubs/${action.post.club.slug}?tab=resources&post=${action.club_post_id}` : '/pulse/clubs?section=resources'
    }));
    const usefulResources = usefulResourceActions.slice(0, 2).map((action) => ({
      icon: Trophy,
      key: `useful-${action.id}`,
      label: 'Useful resource',
      meta: `${action.post?.club?.name ?? 'Club resource'} · ${formatActivityDate(action.created_at)}`,
      title: action.post?.title ?? 'Useful resource',
      to: action.post?.club?.slug ? `/pulse/clubs/${action.post.club.slug}?tab=resources&post=${action.club_post_id}` : '/pulse/clubs?section=resources'
    }));
    const interestedOpportunities = [
      ...interestedApplications.slice(0, 2).map((application) => ({
        icon: BriefcaseBusiness,
        key: `interest-${application.id}`,
        label: 'Interested',
        meta: `${application.opportunity?.company_name ?? 'Pulse opportunity'} · ${formatActivityDate(application.created_at)}`,
        title: application.opportunity?.title ?? 'Opportunity interest',
        to: `/pulse/opportunities/${application.opportunity_id}`
      })),
      ...interestedClubOpportunityActions.slice(0, 2).map((action) => ({
        icon: Sparkles,
        key: `club-interest-${action.id}`,
        label: 'Club opportunity',
        meta: `${action.post?.club?.name ?? 'Club opportunity'} · ${formatActivityDate(action.created_at)}`,
        title: action.post?.title ?? 'Club opportunity interest',
        to: action.post?.club?.slug ? `/pulse/clubs/${action.post.club.slug}?tab=opportunities&post=${action.club_post_id}` : '/pulse/clubs?section=opportunities'
      }))
    ];
    const applications = activeApplications.slice(0, 2).map((application) => ({
      icon: CheckCircle2,
      key: `application-${application.id}`,
      label: applicationStatusLabels[application.status] ?? 'Application',
      meta: `${application.opportunity?.company_name ?? 'Pulse opportunity'} · ${formatActivityDate(application.applied_at ?? application.created_at)}`,
      title: application.opportunity?.title ?? 'Opportunity application',
      to: `/pulse/opportunities/${application.opportunity_id}`
    }));
    const recentItems = recentCollegeItems.slice(0, 3).map((item) => ({
      icon: item.kind === 'opportunity' ? BriefcaseBusiness : item.kind === 'resource' ? FileStack : item.kind === 'event' ? CalendarClock : MessageCircle,
      key: `recent-${item.key}`,
      label: 'Recently opened',
      meta: item.meta,
      title: item.title,
      to: item.to
    }));

    return [...savedResources, ...interestedOpportunities, ...applications, ...usefulResources, ...recentItems]
      .filter((item, index, items) => items.findIndex((candidate) => candidate.to === item.to && candidate.title === item.title) === index)
      .slice(0, 8);
  }, [activeApplications, interestedApplications, interestedClubOpportunityActions, recentCollegeItems, savedResourceActions, usefulResourceActions]);

  useEffect(() => {
    document.title = 'My Activity | SapiensPulse';
  }, []);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading activity</PulseBadge>
        <h1>Opening your Pulse trail.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  return (
    <section className="pulse-activity-page">
      <div className="pulse-activity-hero">
        <div>
          <PulseBadge tone="coral">My Activity</PulseBadge>
          <h1>Everything you are doing on Pulse, in one place.</h1>
          <p>Track your posts, poll prompts, opportunity applications, and workshop RSVPs without hunting through the feed.</p>
        </div>
        <div className="pulse-activity-hero__actions">
          <Link className="pulse-button pulse-button--primary" to="/pulse/home">
            <span>Create a post</span>
            <Send size={18} />
          </Link>
          <Link className="pulse-button pulse-button--secondary" to="/pulse/mentorship">
            <span>Find workshops</span>
            <CalendarClock size={18} />
          </Link>
        </div>
      </div>

      <div className="pulse-activity-stats" aria-label="Pulse activity summary">
        <PulseCard>
          <MessageCircle size={20} />
          <strong>{postsQuery.data?.length ?? 0}</strong>
          <span>Visible posts</span>
        </PulseCard>
        <PulseCard>
          <BriefcaseBusiness size={20} />
          <strong>{activeApplications.length}</strong>
          <span>Applications</span>
        </PulseCard>
        <PulseCard>
          <FileStack size={20} />
          <strong>{savedResourceActions.length}</strong>
          <span>Saved resources</span>
        </PulseCard>
        <PulseCard>
          <Sparkles size={20} />
          <strong>{interestedCount}</strong>
          <span>Interests</span>
        </PulseCard>
        <PulseCard>
          <CalendarClock size={20} />
          <strong>{upcomingRsvps.length}</strong>
          <span>Workshop RSVPs</span>
        </PulseCard>
      </div>

      <PulseCard className="pulse-activity-focus-board">
        <header>
          <div>
            <PulseBadge tone="coral">Continue from here</PulseBadge>
            <h2>Your saved, interested, and recent items</h2>
            <p>Use this as your student dashboard for resources to revisit, opportunities to follow, and recent college workspace items.</p>
          </div>
          <Link className="pulse-inline-link" to="/pulse/clubs?section=resources">Browse college resources</Link>
        </header>
        <div className="pulse-activity-focus-list">
          {applicationsQuery.isLoading || clubActionsQuery.isLoading ? (
            <p>Loading your activity dashboard.</p>
          ) : actionQueue.length ? (
            actionQueue.map((item) => {
              const Icon = item.icon;
              return (
                <Link className="pulse-activity-focus-item" key={item.key} to={item.to}>
                  <span><Icon size={17} /></span>
                  <div>
                    <small>{item.label}</small>
                    <strong>{item.title}</strong>
                    <em>{item.meta}</em>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="pulse-activity-focus-empty">
              <Sparkles size={20} />
              <div>
                <strong>Your activity dashboard is ready.</strong>
                <p>Save a resource, mark an opportunity as interested, or open a college item to build your quick list.</p>
              </div>
            </div>
          )}
        </div>
      </PulseCard>

      <div className="pulse-activity-grid">
        <PulseCard className="pulse-activity-panel">
          <header>
            <div>
              <PulseBadge tone="gold">Posts</PulseBadge>
              <h2>Your latest Pulse posts</h2>
            </div>
            <Link className="pulse-inline-link" to="/pulse/home">Open feed</Link>
          </header>
          <div className="pulse-activity-list">
            {postsQuery.isLoading ? (
              <p>Loading your posts.</p>
            ) : postsQuery.data?.length ? (
              postsQuery.data.map((post) => (
                <Link className="pulse-activity-row" key={post.id} to="/pulse/home">
                  <span>{post.post_type === 'poll' ? <BarChart3 size={17} /> : <MessageCircle size={17} />}</span>
                  <div>
                    <strong>{post.title}</strong>
                    <small>{postTypeLabels[post.post_type]} · {formatActivityDate(post.created_at)}</small>
                  </div>
                </Link>
              ))
            ) : (
              <p>No posts yet. Start with a question, poll, idea, or shout-out.</p>
            )}
          </div>
        </PulseCard>

        <PulseCard className="pulse-activity-panel">
          <header>
            <div>
              <PulseBadge tone="gold">Resources</PulseBadge>
              <h2>Saved club resources</h2>
            </div>
            <Link className="pulse-inline-link" to="/pulse/clubs?section=resources">Open resources</Link>
          </header>
          <div className="pulse-activity-list">
            {clubActionsQuery.isLoading ? (
              <p>Loading saved resources.</p>
            ) : savedResourceActions.length ? (
              savedResourceActions.slice(0, 8).map((action) => (
                <Link
                  className="pulse-activity-row"
                  key={action.id}
                  to={action.post?.club?.slug ? `/pulse/clubs/${action.post.club.slug}?tab=resources&post=${action.club_post_id}` : '/pulse/clubs?section=resources'}
                >
                  <span><FileStack size={17} /></span>
                  <div>
                    <strong>{action.post?.title ?? 'Saved resource'}</strong>
                    <small>{action.post?.club?.name ?? 'Club resource'} · Saved {formatActivityDate(action.created_at)}</small>
                  </div>
                </Link>
              ))
            ) : (
              <p>No saved resources yet. Save a resource from any club workspace to keep it here.</p>
            )}
          </div>
        </PulseCard>

        <PulseCard className="pulse-activity-panel">
          <header>
            <div>
              <PulseBadge tone="coral">Useful</PulseBadge>
              <h2>Resources you marked useful</h2>
            </div>
            <Link className="pulse-inline-link" to="/pulse/clubs?section=resources">Browse resources</Link>
          </header>
          <div className="pulse-activity-list">
            {clubActionsQuery.isLoading ? (
              <p>Loading useful resources.</p>
            ) : usefulResourceActions.length ? (
              usefulResourceActions.slice(0, 8).map((action) => (
                <Link
                  className="pulse-activity-row"
                  key={action.id}
                  to={action.post?.club?.slug ? `/pulse/clubs/${action.post.club.slug}?tab=resources&post=${action.club_post_id}` : '/pulse/clubs?section=resources'}
                >
                  <span><Trophy size={17} /></span>
                  <div>
                    <strong>{action.post?.title ?? 'Useful resource'}</strong>
                    <small>{action.post?.club?.name ?? 'Club resource'} · Marked {formatActivityDate(action.created_at)}</small>
                  </div>
                </Link>
              ))
            ) : (
              <p>No useful resources marked yet. Mark helpful resources so you can revisit them.</p>
            )}
          </div>
        </PulseCard>

        <PulseCard className="pulse-activity-panel">
          <header>
            <div>
              <PulseBadge tone="green">Applications</PulseBadge>
              <h2>Opportunities you applied to</h2>
            </div>
            <Link className="pulse-inline-link" to="/pulse/opportunities">View all</Link>
          </header>
          <div className="pulse-activity-list">
            {applicationsQuery.isLoading ? (
              <p>Loading applications.</p>
            ) : activeApplications.length ? (
              activeApplications.map((application) => (
                <Link className="pulse-activity-row" key={application.id} to={`/pulse/opportunities/${application.opportunity_id}`}>
                  <span><CheckCircle2 size={17} /></span>
                  <div>
                    <strong>{application.opportunity?.title ?? 'Opportunity application'}</strong>
                    <small>{applicationStatusLabels[application.status] ?? application.status} · {formatActivityDate(application.applied_at ?? application.created_at)}</small>
                  </div>
                </Link>
              ))
            ) : (
              <p>No applications yet. Explore opportunities and apply when something fits.</p>
            )}
          </div>
        </PulseCard>

        <PulseCard className="pulse-activity-panel pulse-activity-panel--wide">
          <header>
            <div>
              <PulseBadge tone="green">Interests</PulseBadge>
              <h2>Opportunities you are interested in</h2>
            </div>
            <Link className="pulse-inline-link" to="/pulse/clubs?section=opportunities">View opportunities</Link>
          </header>
          <div className="pulse-activity-list pulse-activity-list--grid">
            {applicationsQuery.isLoading || clubActionsQuery.isLoading ? (
              <p>Loading interests.</p>
            ) : interestedCount ? (
              <>
                {interestedApplications.slice(0, 6).map((application) => (
                  <Link className="pulse-activity-row" key={application.id} to={`/pulse/opportunities/${application.opportunity_id}`}>
                    <span><BriefcaseBusiness size={17} /></span>
                    <div>
                      <strong>{application.opportunity?.title ?? 'Opportunity interest'}</strong>
                      <small>{application.opportunity?.company_name ?? 'Pulse opportunity'} · {formatActivityDate(application.created_at)}</small>
                    </div>
                  </Link>
                ))}
                {interestedClubOpportunityActions.slice(0, 6).map((action) => (
                  <Link
                    className="pulse-activity-row"
                    key={action.id}
                    to={action.post?.club?.slug ? `/pulse/clubs/${action.post.club.slug}?tab=opportunities&post=${action.club_post_id}` : '/pulse/clubs?section=opportunities'}
                  >
                    <span><Sparkles size={17} /></span>
                    <div>
                      <strong>{action.post?.title ?? 'Club opportunity interest'}</strong>
                      <small>{action.post?.club?.name ?? 'Club opportunity'} · {formatActivityDate(action.created_at)}</small>
                    </div>
                  </Link>
                ))}
              </>
            ) : (
              <p>No opportunity interests yet. Mark interest from college or club opportunities to keep them here.</p>
            )}
          </div>
        </PulseCard>

        <PulseCard className="pulse-activity-panel pulse-activity-panel--wide">
          <header>
            <div>
              <PulseBadge tone="coral">Workshops</PulseBadge>
              <h2>Your RSVPs</h2>
            </div>
            <Link className="pulse-inline-link" to="/pulse/mentorship">Browse workshops</Link>
          </header>
          <div className="pulse-activity-list pulse-activity-list--grid">
            {rsvpsQuery.isLoading ? (
              <p>Loading RSVPs.</p>
            ) : upcomingRsvps.length ? (
              upcomingRsvps.map((rsvp) => (
                <Link className="pulse-activity-row" key={rsvp.id} to={`/pulse/mentorship/${rsvp.session_id}`}>
                  <span><CalendarClock size={17} /></span>
                  <div>
                    <strong>{rsvp.session?.title ?? 'Mentorship session'}</strong>
                    <small>{rsvpStatusLabel(rsvp.status)} · {formatActivityDate(rsvp.session?.starts_at ?? rsvp.created_at)}</small>
                  </div>
                </Link>
              ))
            ) : (
              <p>No workshop RSVPs yet. Join a free session to keep it here.</p>
            )}
          </div>
        </PulseCard>

        <PulseCard className="pulse-activity-nudge">
          <Award size={24} />
          <div>
            <PulseBadge tone="gold">Keep momentum</PulseBadge>
            <h2>Small actions make Pulse feel alive.</h2>
            <p>Vote on a poll, recognize useful posts, RSVP for a workshop, or share one helpful thing with your college.</p>
          </div>
          <Link className="pulse-button pulse-button--primary" to="/pulse/home">
            <span>Go to feed</span>
            <Sparkles size={18} />
          </Link>
        </PulseCard>
      </div>
    </section>
  );
}
