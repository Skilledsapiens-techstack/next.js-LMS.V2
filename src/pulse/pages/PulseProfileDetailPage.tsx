import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  Check,
  Eye,
  Linkedin,
  MapPin,
  MessageCircle,
  Sparkles,
  UserPlus,
  UserRound
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulsePost,
  usePulseConnectionInterest,
  usePulsePostInteractions,
  usePulseProfile,
  usePulseProfileDetail,
  usePulseProfilePosts,
  useTogglePulseConnectionInterest
} from '../features/usePulseCommunity';

const postTypeLabels: Record<PulsePost['post_type'], string> = {
  announcement: 'Update',
  article: 'Share Idea',
  discussion: 'Ask / Discuss',
  opportunity: 'Opportunity',
  poll: 'Poll',
  recognition: 'Shout-out',
  shoutout: 'Shout-out'
};

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SP';
}

function PulseProfilePostCard({
  interaction,
  post
}: {
  interaction?: { commentCount: number; reactionCount: number };
  post: PulsePost;
}) {
  return (
    <PulseCard className="pulse-profile-post">
      <div className="pulse-profile-post__top">
        <PulseBadge tone={post.visibility === 'global' ? 'gold' : 'brand'}>
          {post.visibility === 'global' ? 'Everyone on Pulse' : 'My college only'}
        </PulseBadge>
        <span>{postTypeLabels[post.post_type]}</span>
      </div>
      <h3>{post.title}</h3>
      <p>{post.body}</p>
      <div className="pulse-profile-post__meta">
        <span><Sparkles size={15} /> {interaction?.reactionCount ?? 0} recognizes</span>
        <span><MessageCircle size={15} /> {interaction?.commentCount ?? 0} comments</span>
        <span><ArrowUpRight size={15} /> Open post</span>
      </div>
    </PulseCard>
  );
}

export function PulseProfileDetailPage() {
  const { status } = useAuth();
  const { profileId } = useParams();
  const currentProfileQuery = usePulseProfile();
  const currentProfile = currentProfileQuery.data;
  const profileQuery = usePulseProfileDetail(profileId);
  const postsQuery = usePulseProfilePosts(profileId);
  const interactionsQuery = usePulsePostInteractions(postsQuery.data, currentProfile);
  const connectionQuery = usePulseConnectionInterest(profileId, currentProfile);
  const toggleConnection = useTogglePulseConnectionInterest(currentProfile);
  const profile = profileQuery.data;
  const posts = postsQuery.data ?? [];
  const connection = connectionQuery.data;
  const isOwnProfile = currentProfile?.id === profile?.id;

  const spotlightCount = useMemo(
    () => posts.filter((post) => post.post_type === 'recognition' || post.post_type === 'shoutout').length,
    [posts]
  );
  const skillCount = (profile?.skills.length ?? 0) + (profile?.interests.length ?? 0);
  const profileSignals = useMemo(
    () => [...(profile?.skills ?? []), ...(profile?.interests ?? [])].slice(0, 5),
    [profile?.interests, profile?.skills]
  );

  useEffect(() => {
    document.title = profile?.display_name
      ? `${profile.display_name} | SapiensPulse`
      : 'Student Profile | SapiensPulse';
  }, [profile?.display_name]);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (currentProfileQuery.isLoading || profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Opening Profile</PulseBadge>
        <h1>Loading student profile.</h1>
      </section>
    );
  }

  if (!currentProfile) {
    return <Navigate to="/pulse/home" replace />;
  }

  if (!profile) {
    return (
      <section className="pulse-profile-detail-page">
        <Link className="pulse-back-link" to="/pulse/people">
          <ArrowLeft size={17} /> Back to people
        </Link>
        <PulseCard className="pulse-profile-empty">
          <PulseBadge tone="brand">Profile</PulseBadge>
          <h1>This profile is unavailable.</h1>
          <p>This member may no longer be active on Pulse.</p>
          <Link className="pulse-inline-link" to="/pulse/people">Find other students</Link>
        </PulseCard>
      </section>
    );
  }

  return (
    <section className="pulse-profile-detail-page">
      <Link className="pulse-back-link" to="/pulse/people">
        <ArrowLeft size={17} /> Back to people
      </Link>

      <PulseCard className="pulse-profile-detail-hero">
        <div className="pulse-profile-detail-avatar" aria-hidden="true">
          {profile.avatar_url ? <img alt="" src={profile.avatar_url} /> : <span>{getInitials(profile.display_name)}</span>}
        </div>
        <div className="pulse-profile-detail-copy">
          <div className="pulse-profile-detail-kicker">
            <PulseBadge tone="green">Pulse member</PulseBadge>
            {isOwnProfile ? <Link className="pulse-inline-link" to="/pulse/profile">Edit my profile</Link> : null}
          </div>
          <h1>{profile.display_name}</h1>
          <p>{profile.headline || 'Building, learning, and discovering opportunities on Pulse.'}</p>
          <div className="pulse-profile-detail-meta">
            {profile.college?.name ? <span><MapPin size={16} /> {profile.college.name}</span> : null}
            <span><Eye size={16} /> {posts.length} visible posts</span>
            <span><BriefcaseBusiness size={16} /> Open for projects and sessions</span>
          </div>
          <div className="pulse-profile-detail-highlights">
            {profileSignals.length ? (
              profileSignals.map((signal) => <span key={signal}>{signal}</span>)
            ) : (
              <span>Profile signals coming soon</span>
            )}
          </div>
          {!isOwnProfile ? (
            <div className="pulse-profile-detail-actions">
              <button
                className={connection ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--primary'}
                disabled={connectionQuery.isLoading || toggleConnection.isPending}
                onClick={() => toggleConnection.mutate({ connectionId: connection?.id, targetProfileId: profile.id })}
                type="button"
              >
                <span>
                  {toggleConnection.isPending
                    ? 'Updating'
                    : connection
                      ? 'Interested'
                      : 'Show interest'}
                </span>
                {connection ? <Check size={18} /> : <UserPlus size={18} />}
              </button>
              {profile.linkedin_url ? (
                <a className="pulse-button pulse-button--ghost" href={profile.linkedin_url} rel="noreferrer" target="_blank">
                  <span>LinkedIn</span>
                  <Linkedin size={18} />
                </a>
              ) : null}
              <span>{connection ? 'Interest shared.' : 'Signal that you are open to collaborate or learn more.'}</span>
            </div>
          ) : null}
          {isOwnProfile && profile.linkedin_url ? (
            <a className="pulse-inline-link" href={profile.linkedin_url} rel="noreferrer" target="_blank">
              <Linkedin size={16} /> Open LinkedIn
            </a>
          ) : null}
          {toggleConnection.error ? <p className="pulse-form-error">{toggleConnection.error.message}</p> : null}
        </div>
        <aside className="pulse-profile-detail-summary" aria-label="Student contribution summary">
          <span>Pulse profile</span>
          <strong>{posts.length + spotlightCount + skillCount}</strong>
          <p>visible contribution signals</p>
          <div>
            <span><MessageCircle size={15} /> {posts.length} posts</span>
            <span><Award size={15} /> {spotlightCount} recognitions</span>
            <span><BriefcaseBusiness size={15} /> {skillCount} skills/interests</span>
          </div>
        </aside>
      </PulseCard>

      <div className="pulse-profile-detail-stats">
        <PulseCard>
          <MessageCircle size={19} />
          <strong>{posts.length}</strong>
          <span>Conversations started</span>
        </PulseCard>
        <PulseCard>
          <Award size={19} />
          <strong>{spotlightCount}</strong>
          <span>Recognition moments</span>
        </PulseCard>
        <PulseCard>
          <BriefcaseBusiness size={19} />
          <strong>{skillCount}</strong>
          <span>Discovery signals</span>
        </PulseCard>
      </div>

      <div className="pulse-profile-detail-grid">
        <aside className="pulse-profile-detail-panel">
          <PulseBadge tone="coral">About</PulseBadge>
          <p>{profile.bio || 'This student is still shaping their Pulse profile.'}</p>

          <div className="pulse-profile-contribution-card">
            <Sparkles size={18} />
            <div>
              <strong>Good fit for</strong>
              <span>Projects, peer discussions, mentorship sessions, and campus collaboration.</span>
            </div>
          </div>

          <div className="pulse-profile-tag-group">
            <h2>Skills</h2>
            <div className="pulse-profile-tags">
              {profile.skills.length ? profile.skills.map((skill) => <span key={skill}>{skill}</span>) : <em>No skills added yet</em>}
            </div>
          </div>

          <div className="pulse-profile-tag-group">
            <h2>Interests</h2>
            <div className="pulse-profile-tags">
              {profile.interests.length ? profile.interests.map((interest) => <span key={interest}>{interest}</span>) : <em>No interests added yet</em>}
            </div>
          </div>
        </aside>

        <section className="pulse-profile-activity">
          <div className="pulse-profile-activity__header">
            <PulseBadge tone="gold">Activity</PulseBadge>
            <h2>Recent visible posts</h2>
          </div>
          {postsQuery.isLoading ? (
            <div className="pulse-feed-state">Loading profile activity.</div>
          ) : posts.length ? (
            <div className="pulse-profile-post-list">
              {posts.map((post) => (
                <PulseProfilePostCard
                  interaction={interactionsQuery.data?.get(post.id)}
                  key={post.id}
                  post={post}
                />
              ))}
            </div>
          ) : (
            <div className="pulse-feed-state">
              <UserRound size={22} />
              <strong>No visible posts yet.</strong>
              <span>When this student posts to spaces you can access, their activity will appear here.</span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
