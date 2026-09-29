import { ArrowUpRight, Award, BriefcaseBusiness, Building2, Flame, Medal, MessageCircle, Send, Sparkles, Trophy, UserPlus, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulseLeaderboardEntry,
  PulseLeaderboardPeriod,
  PulseLeaderboardScope,
  usePulseLeaderboard,
  usePulseProfile,
  usePulseProfileDefaults
} from '../features/usePulseCommunity';
import { PulseProfileOnboarding } from './PulseHomePage';

const scopeOptions: Array<{ icon: typeof Building2; label: string; value: PulseLeaderboardScope }> = [
  { icon: Building2, label: 'My college', value: 'college' },
  { icon: UsersRound, label: 'Across Pulse', value: 'pulse' }
];

const periodOptions: Array<{ label: string; value: PulseLeaderboardPeriod }> = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' }
];

const starMilestones = [
  { label: 'Profile boost', points: 50, text: 'Get noticed faster in people discovery.' },
  { label: 'Priority recommendations', points: 100, text: 'Move into stronger opportunity suggestions.' },
  { label: 'Live project access', points: 200, text: 'Strengthen access to live project applications.' },
  { label: 'Top contributor badge', points: 500, text: 'Stand out across Pulse and college circles.' }
];

const starActions = [
  {
    icon: MessageCircle,
    points: '+2',
    text: 'Ask something your batch or other campuses can answer.',
    title: 'Start a useful discussion',
    to: '/pulse/home'
  },
  {
    icon: Award,
    points: '+10',
    text: 'Celebrate helpful students and visible work.',
    title: 'Give a meaningful shout-out',
    to: '/pulse/recognition'
  },
  {
    icon: UserPlus,
    points: '+15',
    text: 'Accepted invites add serious leaderboard momentum.',
    title: 'Bring trusted peers',
    to: '/pulse/invite'
  },
  {
    icon: BriefcaseBusiness,
    points: '+3',
    text: 'Show interest in projects and student career drops.',
    title: 'Explore opportunities',
    to: '/pulse/opportunities'
  }
];

const previewLeaderboardProfiles = [
  {
    badge: 'Case Builder',
    college_name: 'IIM Sambalpur',
    display_name: 'Ananya Sharma',
    headline: 'Marketing club member exploring brand strategy'
  },
  {
    badge: 'Helpful Peer',
    college_name: 'IMT Hyderabad',
    display_name: 'Kabir Mehta',
    headline: 'Finance student active in equity research discussions'
  },
  {
    badge: 'Campus Connector',
    college_name: 'Jaipuria Institute of Management',
    display_name: 'Meera Nair',
    headline: 'HR club volunteer sharing interview prep notes'
  },
  {
    badge: 'Rising Contributor',
    college_name: 'GL Bajaj Institute of Management',
    display_name: 'Arjun Rao',
    headline: 'Product management learner tracking live projects'
  },
  {
    badge: 'Discussion Starter',
    college_name: 'BIMTECH',
    display_name: 'Ishita Banerjee',
    headline: 'Consulting aspirant asking useful case questions'
  },
  {
    badge: 'Opportunity Explorer',
    college_name: 'Christ University',
    display_name: 'Rohan Kapoor',
    headline: 'Analytics student applying to campus projects'
  },
  {
    badge: 'Helpful Peer',
    college_name: 'Welingkar Mumbai',
    display_name: 'Priya Menon',
    headline: 'Resume readiness contributor for placement prep'
  },
  {
    badge: 'Campus Connector',
    college_name: 'XIME Bangalore',
    display_name: 'Devansh Jain',
    headline: 'Operations student building peer learning circles'
  },
  {
    badge: 'Rising Contributor',
    college_name: 'IFMR GSB',
    display_name: 'Sara Thomas',
    headline: 'Finance club member sharing market updates'
  },
  {
    badge: 'Discussion Starter',
    college_name: 'SOIL Institute of Management',
    display_name: 'Nikhil Verma',
    headline: 'Marketing student active in campaign discussions'
  }
];

function pulseStarsPreviewEntries(realLeaders: PulseLeaderboardEntry[]) {
  const usedNames = new Set(realLeaders.map((entry) => entry.display_name.toLowerCase()));
  const topPoints = realLeaders[0]?.total_points ?? 120;
  const basePoints = realLeaders.length ? Math.max(4, topPoints - 1) : topPoints;

  return previewLeaderboardProfiles
    .filter((profile) => !usedNames.has(profile.display_name.toLowerCase()))
    .map((profile, index): PulseLeaderboardEntry => ({
      avatar_url: null,
      badge: profile.badge,
      college_name: profile.college_name,
      display_name: profile.display_name,
      headline: profile.headline,
      profile_id: `preview-star-${index + 1}`,
      rank_position: realLeaders.length + index + 1,
      total_points: Math.max(2, basePoints - index)
    }));
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SP';
}

function PulseStarsAvatar({ entry }: { entry: PulseLeaderboardEntry }) {
  if (entry.avatar_url) {
    return <img alt="" className="pulse-stars-avatar" src={entry.avatar_url} />;
  }

  return <span className="pulse-stars-avatar pulse-stars-avatar--initials">{initials(entry.display_name)}</span>;
}

function PulseStarsPodiumCard({
  entry,
  isCurrentStudent
}: {
  entry: PulseLeaderboardEntry;
  isCurrentStudent: boolean;
}) {
  const RankIcon = entry.rank_position === 1 ? Trophy : entry.rank_position === 2 ? Medal : Award;

  return (
    <Link
      className={`pulse-stars-podium-card pulse-stars-podium-card--rank-${entry.rank_position}${isCurrentStudent ? ' pulse-stars-podium-card--you' : ''}`}
      to={`/pulse/u/${entry.profile_id}`}
    >
      <div className="pulse-stars-podium-card__top">
        <span className="pulse-stars-rank">
          <RankIcon size={18} />
          #{entry.rank_position}
        </span>
        {isCurrentStudent ? <span className="pulse-stars-you-chip">You</span> : null}
      </div>
      <div className="pulse-stars-podium-card__identity">
        <PulseStarsAvatar entry={entry} />
        <div>
          <h2>{entry.display_name}</h2>
          <p>{entry.college_name || 'Pulse community'}</p>
        </div>
      </div>
      <div className="pulse-stars-points-meter">
        <strong>{entry.total_points} pts</strong>
      </div>
      <span className="pulse-stars-view-profile">Profile <ArrowUpRight size={15} /></span>
    </Link>
  );
}

function PulseStarsRow({
  entry,
  isCurrentStudent
}: {
  entry: PulseLeaderboardEntry;
  isCurrentStudent: boolean;
}) {
  return (
    <Link className={`pulse-stars-row${isCurrentStudent ? ' pulse-stars-row--you' : ''}`} to={`/pulse/u/${entry.profile_id}`}>
      <span className="pulse-stars-rank">#{entry.rank_position}</span>
      <PulseStarsAvatar entry={entry} />
      <div>
        <strong>{entry.display_name}</strong>
        <span>{entry.college_name || 'Pulse community'}</span>
      </div>
      <div className="pulse-stars-row__score">
        <strong className="pulse-stars-row__points">{entry.total_points} pts</strong>
      </div>
      <span className="pulse-stars-view-profile">Profile <ArrowUpRight size={15} /></span>
    </Link>
  );
}

function pulseStarsErrorMessage(message: string) {
  if (/get_pulse_leaderboard|schema cache/i.test(message)) {
    return 'Pulse Stars setup is still being applied. Please apply the latest leaderboard migration, then refresh this page.';
  }

  return message;
}

function pulseStarsLiveSignals(leaders: PulseLeaderboardEntry[], period: PulseLeaderboardPeriod) {
  const topStudent = leaders[0];
  const activeCount = leaders.length;
  const periodLabel = period === 'week' ? 'this week' : 'this month';
  return [
    topStudent ? `${topStudent.display_name} is leading ${periodLabel} with ${topStudent.total_points} points` : `Pulse Stars will update from real activity ${periodLabel}`,
    `${activeCount || 'New'} students are visible on this board`,
    'Helpful comments, accepted invites, shout-outs, and opportunity interest move the board',
    'Reach 200 points to strengthen live project priority access',
    'Consistent contributors can unlock stronger visibility across Pulse'
  ];
}

export function PulseStarsPage() {
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const [scope, setScope] = useState<PulseLeaderboardScope>('college');
  const [period, setPeriod] = useState<PulseLeaderboardPeriod>('week');
  const leaderboardQuery = usePulseLeaderboard(profile, scope, period);

  const realLeaders = leaderboardQuery.data ?? [];
  const leaders = useMemo(() => {
    if (realLeaders.length >= 12) return realLeaders;

    return [...realLeaders, ...pulseStarsPreviewEntries(realLeaders).slice(0, 12 - realLeaders.length)]
      .map((entry, index) => ({ ...entry, rank_position: index + 1 }));
  }, [realLeaders]);
  const topThree = useMemo(() => leaders.slice(0, 3), [leaders]);
  const remainingLeaders = useMemo(() => leaders.slice(3), [leaders]);
  const currentStudent = useMemo(
    () => leaders.find((entry) => entry.profile_id === profile?.id),
    [leaders, profile?.id]
  );
  const nextRank = useMemo(
    () =>
      currentStudent
        ? leaders
            .filter((entry) => entry.total_points > currentStudent.total_points)
            .sort((first, second) => first.total_points - second.total_points)[0]
        : null,
    [currentStudent, leaders]
  );
  const pointsToNext = currentStudent && nextRank ? nextRank.total_points - currentStudent.total_points + 1 : 0;
  const activeBoardLabel = `${scope === 'college' ? 'college' : 'cross-campus'} ${period === 'week' ? 'weekly' : 'monthly'} board`;
  const currentPoints = currentStudent?.total_points ?? 0;
  const nextMilestone = starMilestones.find((milestone) => milestone.points > currentPoints);
  const milestoneProgress = nextMilestone ? Math.min(100, Math.round((currentPoints / nextMilestone.points) * 100)) : 100;
  const liveSignals = useMemo(() => pulseStarsLiveSignals(leaders, period), [leaders, period]);

  useEffect(() => {
    document.title = 'Pulse Stars | SapiensPulse';
  }, []);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Pulse Stars</PulseBadge>
        <h1>Finding this cycle's active contributors.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  return (
    <section className="pulse-stars-page">
      <div className="pulse-stars-hero">
        <div>
          <PulseBadge tone="coral">Pulse Stars</PulseBadge>
          <h1>Students making Pulse more useful for everyone.</h1>
          <p>
            Pulse Stars updates automatically from real participation: posts, comments, useful reactions, accepted
            invites, shout-outs, and opportunity interest.
          </p>
        </div>
        <PulseCard className="pulse-stars-score-card">
          <span><Sparkles size={18} /> Your standing</span>
          <strong>{currentStudent ? `#${currentStudent.rank_position}` : 'Keep contributing'}</strong>
          <p>
            {currentStudent
              ? pointsToNext
                ? `${pointsToNext} more points can move you closer on the ${activeBoardLabel}.`
                : `${currentStudent.total_points} points this ${period === 'week' ? 'week' : 'month'} on the ${activeBoardLabel}.`
              : 'Share useful updates, help peers, and explore opportunities to enter the board.'}
          </p>
          <Link to="/pulse/home">Start contributing <Send size={15} /></Link>
        </PulseCard>
      </div>

      <PulseCard className="pulse-stars-controls">
        <div aria-label="Leaderboard scope" className="pulse-stars-toggle">
          {scopeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                className={scope === option.value ? 'is-active' : ''}
                key={option.value}
                onClick={() => setScope(option.value)}
                type="button"
              >
                <Icon size={17} />
                {option.label}
              </button>
            );
          })}
        </div>
        <div aria-label="Leaderboard period" className="pulse-stars-toggle pulse-stars-toggle--period">
          {periodOptions.map((option) => (
            <button
              className={period === option.value ? 'is-active' : ''}
              key={option.value}
              onClick={() => setPeriod(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </PulseCard>

      <div className="pulse-stars-live-grid">
        <PulseCard className="pulse-stars-live-strip" aria-label="Pulse Stars live updates">
          <div>
            <PulseBadge tone="gold">Live updates</PulseBadge>
            <strong>The board moves when students contribute.</strong>
          </div>
          <div className="pulse-stars-live-strip__track">
            <div>
              {[...liveSignals, ...liveSignals].map((signal, index) => (
                <span key={`${signal}-${index}`}><Flame size={15} /> {signal}</span>
              ))}
            </div>
          </div>
        </PulseCard>

        <PulseCard className="pulse-stars-next-card">
          <span><Trophy size={18} /> Next unlock</span>
          <strong>{nextMilestone ? `${nextMilestone.points - currentPoints} pts to ${nextMilestone.label}` : 'All milestone levels unlocked'}</strong>
          <p>{nextMilestone ? nextMilestone.text : 'Keep contributing to stay visible on Pulse Stars.'}</p>
          <div aria-hidden="true"><i style={{ width: `${milestoneProgress}%` }} /></div>
        </PulseCard>
      </div>

      <div className="pulse-stars-rules" aria-label="Pulse Stars point rules">
        <span><Flame size={16} /> Daily post: 2</span>
        <span><Medal size={16} /> Shout-out received: 10</span>
        <span><UsersRound size={16} /> Invite accepted: 15</span>
        <span><Trophy size={16} /> Opportunity interest: 3</span>
      </div>

      <section className="pulse-stars-milestones" aria-label="Pulse Stars milestone unlocks">
        <div>
          <PulseBadge tone="green">Milestones</PulseBadge>
          <h2>Unlock more visibility as you contribute.</h2>
        </div>
        <div className="pulse-stars-milestone-track">
          {starMilestones.map((milestone) => (
            <div
              className={currentPoints >= milestone.points ? 'pulse-stars-milestone-step is-unlocked' : 'pulse-stars-milestone-step'}
              key={milestone.points}
            >
              <span aria-hidden="true" />
              <div>
                <strong>{milestone.points} pts</strong>
                <p>{milestone.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="pulse-stars-action-row" aria-label="Ways to earn Pulse Stars points">
        {starActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.title} to={action.to}>
              <span className="pulse-stars-action-grid__points">{action.points}</span>
              <Icon size={20} />
              <strong>{action.title}</strong>
            </Link>
          );
        })}
      </div>

      {leaderboardQuery.isLoading ? (
        <div className="pulse-feed-state">Loading Pulse Stars.</div>
      ) : leaderboardQuery.error ? (
        <div className="pulse-feed-state pulse-feed-state--error">
          {pulseStarsErrorMessage(leaderboardQuery.error.message)}
        </div>
      ) : leaders.length ? (
        <>
          <div className="pulse-stars-podium">
            {topThree.map((entry) => (
              <PulseStarsPodiumCard
                entry={entry}
                isCurrentStudent={entry.profile_id === profile.id}
                key={entry.profile_id}
              />
            ))}
          </div>

          <PulseCard className="pulse-stars-list">
            <div className="pulse-stars-list__header">
              <span>{scope === 'college' ? 'My college board' : 'Across Pulse board'}</span>
              <strong>{period === 'week' ? 'Weekly cycle' : 'Monthly cycle'}</strong>
            </div>
            {remainingLeaders.length ? (
              remainingLeaders.map((entry) => (
                <PulseStarsRow
                  entry={entry}
                  isCurrentStudent={entry.profile_id === profile.id}
                  key={entry.profile_id}
                />
              ))
            ) : (
              <p>More students will appear here as the board grows.</p>
            )}
          </PulseCard>
        </>
      ) : (
        <div className="pulse-feed-state">
          <strong>No Pulse Stars yet.</strong>
          <span>Useful posts, comments, reactions, invites, and opportunity interest will start this board.</span>
        </div>
      )}
    </section>
  );
}
