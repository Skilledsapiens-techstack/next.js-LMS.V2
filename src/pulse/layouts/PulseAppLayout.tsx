import {
  Activity,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  Files,
  HandHeart,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquareText,
  Search,
  Send,
  Trophy,
  UserCircle,
  UserPlus,
  Users
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge } from '../components';
import {
  PulseProfile,
  usePulseClubPostActions,
  usePulseCollegeClubMembers,
  usePulseCollegeClubPosts,
  usePulseCollegeClubs,
  usePulseCollegeOpportunities,
  usePulseColleges,
  usePulseFeed,
  useMarkPulseNotificationsRead,
  usePulseNotifications,
  usePulseOpportunityApplications,
  usePulsePostInteractions,
  usePulseProfile,
  usePulseProfileDefaults,
  usePulseUnreadNotificationCount,
  useSavePulseProfile
} from '../features/usePulseCommunity';
import {
  PULSE_OTHER_COLLEGE_ID,
  buildPulseCollegeOptions,
  getPulseCollegeOptionName
} from '../lib/collegeOptions';
import { normalizeLinkedInProfileUrl } from '../lib/linkedin';
import '../styles/pulse.css';

type PulseWorkspaceMode = 'pulse' | 'college';
type PulseNavItem = {
  disabled?: boolean;
  icon: typeof Home;
  label: string;
  path: string;
};

const pulseGlobalNavItems: PulseNavItem[] = [
  { icon: MessageSquareText, label: 'My Feed', path: '/pulse/home' },
  { icon: Users, label: 'People', path: '/pulse/people' },
  { icon: BriefcaseBusiness, label: 'Opportunities', path: '/pulse/opportunities' },
  { icon: Files, label: 'Resources', path: '/pulse/resources' },
  { icon: ClipboardCheck, label: 'Career Readiness', path: '/pulse/career-readiness' },
  { icon: HandHeart, label: 'Mentorship', path: '/pulse/mentorship' },
  { icon: Trophy, label: 'Stars', path: '/pulse/stars' },
  { icon: UserPlus, label: 'Invite', path: '/pulse/invite' }
];

const pulseCollegeNavItems: PulseNavItem[] = [
  { icon: LayoutDashboard, label: 'Overview', path: '/pulse/clubs?section=overview' },
  { icon: MessageSquareText, label: 'Discussions', path: '/pulse/clubs?section=discussions' },
  { icon: Building2, label: 'Clubs', path: '/pulse/clubs?section=clubs' },
  { icon: CalendarClock, label: 'Events', path: '/pulse/clubs?section=events' },
  { icon: BriefcaseBusiness, label: 'Opportunities', path: '/pulse/clubs?section=opportunities' },
  { icon: Files, label: 'Resources', path: '/pulse/clubs?section=resources' },
  { icon: Megaphone, label: 'Announcements', path: '/pulse/clubs?section=announcements' },
  { icon: Users, label: 'Members', path: '/pulse/clubs?section=members' }
];

const pulseWorkspaceOptions: Record<PulseWorkspaceMode, {
  description: string;
  icon: typeof Home;
  label: string;
  path: string;
  shortLabel: string;
}> = {
  college: {
    description: 'Campus clubs and college-only work',
    icon: Building2,
    label: 'My College Workspace',
    path: '/pulse/clubs?section=overview',
    shortLabel: 'My College'
  },
  pulse: {
    description: 'Global Pulse network',
    icon: MessageSquareText,
    label: 'My Pulse Workspace',
    path: '/pulse/home',
    shortLabel: 'My Pulse'
  }
};

function missingMandatoryProfileFields(profile?: PulseProfile | null) {
  if (!profile) return [];

  const missing: string[] = [];
  if (!profile.display_name?.trim()) missing.push('Display name');
  if (!profile.linkedin_url?.trim()) missing.push('LinkedIn URL');
  if (!profile.college_id) missing.push('College');
  return missing;
}

function pulseNotificationPreviewLabel(type: string, metadata?: Record<string, unknown>) {
  const postType = typeof metadata?.post_type === 'string' ? metadata.post_type : '';
  if (type === 'club_membership') return 'Membership';
  if (type === 'club_action') return 'Club activity';
  if (type === 'club_post' && postType === 'event') return 'New event';
  if (type === 'club_post' && postType === 'resource') return 'New resource';
  if (type === 'club_post' && postType === 'opportunity') return 'New opportunity';
  if (type === 'comment') return 'Reply';
  if (type === 'reaction') return 'Recognition';
  if (type === 'opportunity_status') return 'Opportunity';
  if (type === 'invite_accepted') return 'Invite';
  if (type === 'connection_interest') return 'Interest';
  if (type === 'report_status') return 'Moderation';
  return 'Update';
}

function pulseNotificationPreviewTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  }).format(new Date(value));
}

function PulseMandatoryProfileModal({ profile }: { profile?: PulseProfile | null }) {
  const defaults = usePulseProfileDefaults();
  const collegesQuery = usePulseColleges();
  const saveProfile = useSavePulseProfile();
  const collegeOptions = buildPulseCollegeOptions(collegesQuery.data ?? []);
  const missingFields = useMemo(() => missingMandatoryProfileFields(profile), [profile]);
  const [profileError, setProfileError] = useState('');
  const [form, setForm] = useState({
    collegeId: '',
    collegeName: '',
    displayName: '',
    linkedinUrl: ''
  });

  useEffect(() => {
    setForm({
      collegeId: profile?.college_id ?? '',
      collegeName: profile?.college?.name ?? '',
      displayName: profile?.display_name ?? defaults.displayName,
      linkedinUrl: profile?.linkedin_url ?? defaults.linkedinUrl ?? ''
    });
  }, [defaults.displayName, defaults.linkedinUrl, profile]);

  if (!profile || !missingFields.length) return null;
  const activeProfile = profile;

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError('');

    if (!form.displayName.trim()) {
      setProfileError('Add your display name to keep your Pulse account active.');
      return;
    }

    const linkedinUrl = normalizeLinkedInProfileUrl(form.linkedinUrl);
    if (!linkedinUrl) {
      setProfileError('Enter a valid LinkedIn profile URL, for example https://www.linkedin.com/in/your-profile.');
      return;
    }

    if (!form.collegeId) {
      setProfileError('Select your college, or choose Other and type your college name.');
      return;
    }

    if (form.collegeId === PULSE_OTHER_COLLEGE_ID && !form.collegeName.trim()) {
      setProfileError('Type your college name after selecting Other.');
      return;
    }

    saveProfile.mutate({
      avatarUrl: activeProfile.avatar_url ?? null,
      bio: activeProfile.bio ?? '',
      collegeId: form.collegeId,
      collegeName: form.collegeName,
      displayName: form.displayName,
      headline: activeProfile.headline ?? '',
      interests: activeProfile.interests,
      linkedinUrl,
      skills: activeProfile.skills
    });
  }

  return (
    <div className="pulse-mandatory-profile-modal" role="dialog" aria-modal="true" aria-labelledby="pulse-mandatory-profile-title">
      <div className="pulse-mandatory-profile-modal__backdrop" />
      <form className="pulse-mandatory-profile-modal__panel pulse-profile-form" onSubmit={submitProfile}>
        <div className="pulse-mandatory-profile-modal__header">
          <PulseBadge tone="coral">Profile update required</PulseBadge>
          <h2 id="pulse-mandatory-profile-title">Complete your Pulse profile to continue.</h2>
          <p>
            We need these mandatory details to keep every Pulse account discoverable, useful, and connected to the right
            college community.
          </p>
        </div>

        <div className="pulse-mandatory-profile-modal__missing">
          Missing now: {missingFields.join(', ')}
        </div>

        <label>
          <span>Display name</span>
          <input
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            placeholder="Your name"
            required
            value={form.displayName}
          />
        </label>

        <label>
          <span>LinkedIn URL</span>
          <input
            onChange={(event) => setForm({ ...form, linkedinUrl: event.target.value })}
            placeholder="https://www.linkedin.com/in/your-profile"
            required
            type="url"
            value={form.linkedinUrl}
          />
        </label>

        <label>
          <span>College</span>
          <select
            onChange={(event) => {
              const collegeId = event.target.value;
              setForm({
                ...form,
                collegeId,
                collegeName: collegeId === PULSE_OTHER_COLLEGE_ID ? '' : getPulseCollegeOptionName(collegeOptions, collegeId)
              });
            }}
            required
            value={form.collegeId}
          >
            <option value="">Select college space</option>
            {collegeOptions.map((college) => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
            <option value={PULSE_OTHER_COLLEGE_ID}>Other - add my college manually</option>
          </select>
        </label>

        {form.collegeId === PULSE_OTHER_COLLEGE_ID ? (
          <label>
            <span>College name</span>
            <input
              onChange={(event) => setForm({ ...form, collegeName: event.target.value })}
              placeholder="Type your college name"
              required
              value={form.collegeName}
            />
          </label>
        ) : null}

        {profileError ? <p className="pulse-form-error">{profileError}</p> : null}
        {saveProfile.error ? <p className="pulse-form-error">{saveProfile.error.message}</p> : null}

        <button className="pulse-button pulse-button--primary pulse-profile-form__submit" disabled={saveProfile.isPending} type="submit">
          <span>{saveProfile.isPending ? 'Saving profile' : 'Save and continue'}</span>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

export function PulseAppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { getLmsHandoffUrl, signOut } = useAuth();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    try {
      return window.localStorage.getItem('pulseSidebarPinned') === 'true';
    } catch {
      return false;
    }
  });
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const profileQuery = usePulseProfile();
  const profile = profileQuery.data;
  const unreadQuery = usePulseUnreadNotificationCount(profileQuery.data);
  const unreadCount = unreadQuery.data ?? 0;
  const notificationsQuery = usePulseNotifications(profile);
  const markNotificationsRead = useMarkPulseNotificationsRead(profile);
  const latestNotifications = useMemo(() => (notificationsQuery.data ?? []).slice(0, 5), [notificationsQuery.data]);
  const latestUnreadNotificationIds = useMemo(
    () => latestNotifications.filter((notification) => !notification.read_at).map((notification) => notification.id),
    [latestNotifications]
  );
  const collegeClubsQuery = usePulseCollegeClubs(profile);
  const collegeClubIds = useMemo(() => (collegeClubsQuery.data ?? []).map((club) => club.id), [collegeClubsQuery.data]);
  const collegeEventsQuery = usePulseCollegeClubPosts(collegeClubIds, ['event'], profile);
  const collegeResourcesQuery = usePulseCollegeClubPosts(collegeClubIds, ['resource'], profile);
  const collegeAnnouncementsQuery = usePulseCollegeClubPosts(collegeClubIds, ['announcement'], profile);
  const collegeOpportunityPostsQuery = usePulseCollegeClubPosts(collegeClubIds, ['opportunity'], profile);
  const collegeMembersQuery = usePulseCollegeClubMembers(collegeClubIds, profile);
  const collegeOpportunitiesQuery = usePulseCollegeOpportunities(profile);
  const opportunityApplicationsQuery = usePulseOpportunityApplications(profile);
  const campusFeedQuery = usePulseFeed(profile, 'college');
  const campusDiscussionPosts = useMemo(
    () => (campusFeedQuery.data ?? []).filter((post) => post.post_type === 'discussion' || post.post_type === 'poll'),
    [campusFeedQuery.data]
  );
  const campusInteractionsQuery = usePulsePostInteractions(campusDiscussionPosts, profile);
  const collegeActionPostIds = useMemo(
    () => [
      ...(collegeResourcesQuery.data ?? []).map((post) => post.id),
      ...(collegeOpportunityPostsQuery.data ?? []).map((post) => post.id)
    ],
    [collegeOpportunityPostsQuery.data, collegeResourcesQuery.data]
  );
  const collegeClubPostActionsQuery = usePulseClubPostActions(collegeActionPostIds, profile);
  const lmsHomeLink = getLmsHandoffUrl('/learning-access');
  const isSidebarExpanded = isSidebarPinned || isSidebarHovered;
  const inferredWorkspaceMode: PulseWorkspaceMode = location.pathname.startsWith('/pulse/clubs') ? 'college' : 'pulse';
  const [workspaceMode, setWorkspaceMode] = useState<PulseWorkspaceMode>(() => {
    if (window.location.pathname.startsWith('/pulse/clubs')) return 'college';
    try {
      const stored = window.localStorage.getItem('pulseWorkspaceMode');
      return stored === 'college' || stored === 'pulse' ? stored : 'pulse';
    } catch {
      return 'pulse';
    }
  });
  const activeWorkspaceMode = location.pathname.startsWith('/pulse/clubs') ? 'college' : workspaceMode;
  const activeNavItems = activeWorkspaceMode === 'college' ? pulseCollegeNavItems : pulseGlobalNavItems;
  const activeWorkspace = pulseWorkspaceOptions[activeWorkspaceMode];
  const shareUpdatePath = activeWorkspaceMode === 'college'
    ? '/pulse/clubs?section=discussions&compose=1#campus-composer'
    : '/pulse/home';
  const nextWorkspaceMode: PulseWorkspaceMode = activeWorkspaceMode === 'college' ? 'pulse' : 'college';
  const ActiveWorkspaceIcon = activeWorkspace.icon;
  const currentNavItem =
    [...activeNavItems]
      .filter((item) => !item.disabled)
      .sort((first, second) => second.path.length - first.path.length)
      .find((item) => {
        const itemUrl = new URL(item.path, window.location.origin);
        const section = itemUrl.searchParams.get('section');
        if (section === 'clubs' && location.pathname.startsWith('/pulse/clubs/')) return true;
        if (location.pathname !== itemUrl.pathname) return false;
        return section ? searchParams.get('section') === section || (section === 'overview' && !searchParams.get('section')) : true;
      }) ??
    (activeWorkspaceMode === 'college' && location.pathname.startsWith('/pulse/clubs') ? pulseCollegeNavItems[1] : activeNavItems[0]);

  const collegeNavBadges = useMemo(() => {
    const now = new Date();
    const events = (collegeEventsQuery.data ?? []).filter((event) => {
      const eventDate = typeof event.metadata.event_date === 'string' ? event.metadata.event_date : null;
      if (!eventDate) return true;
      const parsedDate = new Date(`${eventDate}T23:59:59`);
      return Number.isNaN(parsedDate.getTime()) || parsedDate >= now;
    }).length;
    const savedResources = (collegeClubPostActionsQuery.data ?? []).filter((action) => action.action_type === 'saved').length;
    const interestedClubOpportunities = (collegeClubPostActionsQuery.data ?? []).filter((action) => action.action_type === 'interested').length;
    const interestedCollegeOpportunities = (opportunityApplicationsQuery.data ?? []).filter((application) => application.status === 'interested').length;
    const unansweredDiscussions = campusDiscussionPosts.filter((post) => {
      const interaction = campusInteractionsQuery.data?.get(post.id);
      return !interaction || interaction.commentCount === 0;
    }).length;
    const members = new Set((collegeMembersQuery.data ?? []).filter((member) => member.status === 'active').map((member) => member.profile_id)).size;

    return new Map<string, number>([
      ['Overview', Math.max(collegeClubsQuery.data?.length ?? 0, 0)],
      ['Discussions', unansweredDiscussions],
      ['Clubs', collegeClubsQuery.data?.length ?? 0],
      ['Events', events],
      ['Opportunities', interestedClubOpportunities + interestedCollegeOpportunities],
      ['Resources', savedResources],
      ['Announcements', collegeAnnouncementsQuery.data?.length ?? 0],
      ['Members', members]
    ]);
  }, [
    campusDiscussionPosts,
    campusInteractionsQuery.data,
    collegeAnnouncementsQuery.data,
    collegeClubPostActionsQuery.data,
    collegeClubsQuery.data,
    collegeEventsQuery.data,
    collegeMembersQuery.data,
    opportunityApplicationsQuery.data
  ]);

  function navBadgeFor(label: string) {
    if (activeWorkspaceMode !== 'college') return '';
    const value = collegeNavBadges.get(label) ?? 0;
    if (!value) return '';
    if (label === 'Overview') return '';
    return value > 99 ? '99+' : String(value);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    const scopeParam = activeWorkspaceMode === 'college' ? '&scope=college' : '';
    navigate(cleanQuery ? `/pulse/search?q=${encodeURIComponent(cleanQuery)}&type=all${scopeParam}` : `/pulse/search${activeWorkspaceMode === 'college' ? '?scope=college' : ''}`);
  }

  function switchWorkspace(nextMode: PulseWorkspaceMode) {
    setWorkspaceMode(nextMode);
    setIsWorkspaceMenuOpen(false);
    try {
      window.localStorage.setItem('pulseWorkspaceMode', nextMode);
    } catch {
      // Ignore storage access issues; navigation still switches the workspace.
    }
    navigate(pulseWorkspaceOptions[nextMode].path);
  }

  function handleNotificationPreviewOpen(notificationId: string, isUnread: boolean) {
    setIsNotificationMenuOpen(false);
    if (isUnread) {
      markNotificationsRead.mutate([notificationId]);
    }
  }

  useEffect(() => {
    setWorkspaceMode(inferredWorkspaceMode);
    try {
      window.localStorage.setItem('pulseWorkspaceMode', inferredWorkspaceMode);
    } catch {
      // Ignore storage access issues; the current route still reflects the workspace.
    }
  }, [inferredWorkspaceMode]);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setIsNotificationMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', closeMenu);
    return () => window.removeEventListener('mousedown', closeMenu);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('pulseSidebarPinned', String(isSidebarPinned));
    } catch {
      // Ignore storage access issues; the hover behavior still works.
    }
  }, [isSidebarPinned]);

  async function handleLogout() {
    await signOut();
    setIsAccountMenuOpen(false);
    navigate('/pulse', { replace: true });
  }

  return (
    <main className={`pulse-site pulse-app-site ${isSidebarPinned ? 'is-sidebar-expanded' : 'is-sidebar-collapsed'}`}>
      <aside
        className={`pulse-app-sidebar ${isSidebarExpanded ? 'is-expanded' : 'is-collapsed'}`}
        aria-label="Pulse navigation"
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => {
          setIsSidebarHovered(false);
          if (!isSidebarPinned) setIsWorkspaceMenuOpen(false);
        }}
      >
        <div className="pulse-sidebar-top">
          <Link className="pulse-brand pulse-app-sidebar__brand" to="/pulse/home">
            <span className="pulse-brand__mark">
              <img alt="" src="/assets/pulse-icon-v3.svg" />
            </span>
            <span>
              <strong>Pulse</strong>
              <small>by Skilled Sapiens</small>
            </span>
          </Link>
          <button
            aria-label={isSidebarPinned ? 'Collapse Pulse sidebar' : 'Expand Pulse sidebar'}
            className="pulse-sidebar-toggle"
            onClick={() => setIsSidebarPinned((current) => !current)}
            type="button"
          >
            {isSidebarPinned ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
          </button>
        </div>

        <div className="pulse-sidebar-workspace-switcher">
          <span className="pulse-sidebar-workspace-switcher__label">View As</span>
          <button
            aria-expanded={isSidebarExpanded && isWorkspaceMenuOpen}
            aria-haspopup="listbox"
            aria-label="Choose Pulse workspace"
            className="pulse-sidebar-workspace-switcher__button"
            onClick={() => setIsWorkspaceMenuOpen((current) => !current)}
            type="button"
          >
            <ActiveWorkspaceIcon size={20} />
            <span>
              <strong>{activeWorkspace.shortLabel}</strong>
            </span>
            <ChevronsRight size={16} />
          </button>
          {isSidebarExpanded && isWorkspaceMenuOpen ? (
            <div className="pulse-sidebar-workspace-switcher__menu" role="listbox">
              {(['pulse', 'college'] as PulseWorkspaceMode[]).map((mode) => {
                const option = pulseWorkspaceOptions[mode];
                const Icon = option.icon;
                return (
                  <button
                    aria-selected={activeWorkspaceMode === mode}
                    className={activeWorkspaceMode === mode ? 'active' : ''}
                    key={mode}
                    onClick={() => switchWorkspace(mode)}
                    role="option"
                    type="button"
                  >
                    <Icon size={18} />
                    <span>{option.shortLabel}</span>
                    {activeWorkspaceMode === mode ? <CheckCircle2 size={15} /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <Link className="pulse-sidebar-post-button" to={shareUpdatePath}>
          <Send size={18} />
          <span>Share update</span>
        </Link>

        <nav className="pulse-sidebar-nav">
          {activeNavItems.map((item) => {
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <span aria-disabled="true" className="pulse-nav-placeholder" key={item.path} title="Coming later">
                  <Icon size={20} />
                  <span>{item.label}</span>
                </span>
              );
            }
            const itemUrl = new URL(item.path, window.location.origin);
            const section = itemUrl.searchParams.get('section');
            const isActive =
              (section === 'clubs' && location.pathname.startsWith('/pulse/clubs/')) ||
              (location.pathname === itemUrl.pathname &&
                (section
                  ? searchParams.get('section') === section ||
                    (section === 'overview' && !searchParams.get('section') && location.pathname === '/pulse/clubs')
                  : true));
            return (
              <Link className={isActive ? 'active' : undefined} key={item.path} to={item.path}>
                <Icon size={20} />
                <span>{item.label}</span>
                {navBadgeFor(item.label) ? <strong className="pulse-sidebar-nav__badge">{navBadgeFor(item.label)}</strong> : null}
              </Link>
            );
          })}
        </nav>

        <div className="pulse-sidebar-footer">
          <NavLink to="/pulse/activity">
            <Activity size={20} />
            <span>My Activity</span>
          </NavLink>
        </div>
      </aside>

      <section className="pulse-app-frame">
        <header className="pulse-app-nav">
          <div className="pulse-app-current-section">
            <Home size={16} />
            <span>{currentNavItem.label}</span>
          </div>
          <form className="pulse-app-search" onSubmit={submitSearch}>
            <Search size={18} />
            <label className="sr-only" htmlFor="pulse-header-search">Search Pulse</label>
            <input
              id="pulse-header-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeWorkspaceMode === 'college' ? 'Search your college workspace' : 'Search posts, people, opportunities'}
              value={query}
            />
          </form>
          <div className="pulse-app-nav__actions">
            <a className="pulse-icon-link" href={lmsHomeLink}>
              <BookOpen size={18} />
              <span>My Learning</span>
            </a>
            <div className="pulse-notification-menu" ref={notificationMenuRef}>
              <button
                aria-expanded={isNotificationMenuOpen}
                aria-haspopup="dialog"
                aria-label="Open Pulse notification preview"
                className="pulse-icon-button pulse-notification-link"
                onClick={() => {
                  setIsNotificationMenuOpen((current) => !current);
                  setIsAccountMenuOpen(false);
                }}
                type="button"
              >
                <Bell size={18} />
                {unreadCount ? <span>{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
              </button>
              {isNotificationMenuOpen ? (
                <div className="pulse-notification-menu__panel" role="dialog" aria-label="Recent Pulse notifications">
                  <div className="pulse-notification-menu__header">
                    <span>
                      <strong>Notifications</strong>
                      <small>{unreadCount ? `${unreadCount} unread` : 'All caught up'}</small>
                    </span>
                    <span className="pulse-notification-menu__header-actions">
                      {latestUnreadNotificationIds.length ? (
                        <button
                          disabled={markNotificationsRead.isPending}
                          onClick={() => markNotificationsRead.mutate(latestUnreadNotificationIds)}
                          type="button"
                        >
                          Mark all read
                        </button>
                      ) : null}
                      <Link onClick={() => setIsNotificationMenuOpen(false)} to="/pulse/notifications">
                        View all
                      </Link>
                    </span>
                  </div>
                  {notificationsQuery.isLoading ? (
                    <div className="pulse-notification-menu__state">
                      <Bell size={19} />
                      <strong>Checking recent updates</strong>
                      <span>Replies, club updates, and opportunity movement will appear here.</span>
                    </div>
                  ) : notificationsQuery.error ? (
                    <div className="pulse-notification-menu__state pulse-notification-menu__state--error">
                      <Bell size={19} />
                      <strong>Could not load notifications</strong>
                      <span>Open the full page or try again in a moment.</span>
                      <Link onClick={() => setIsNotificationMenuOpen(false)} to="/pulse/notifications">
                        Open notifications
                      </Link>
                    </div>
                  ) : latestNotifications.length ? (
                    <div className="pulse-notification-menu__list">
                      {latestNotifications.map((notification) => (
                        <Link
                          className={notification.read_at ? 'pulse-notification-menu__item' : 'pulse-notification-menu__item is-unread'}
                          key={notification.id}
                          onClick={() => handleNotificationPreviewOpen(notification.id, !notification.read_at)}
                          to={notification.link_path || '/pulse/notifications'}
                        >
                          <span className="pulse-notification-menu__dot" aria-hidden="true" />
                          <span>
                            <small>{pulseNotificationPreviewLabel(notification.notification_type, notification.metadata)}</small>
                            <strong>{notification.title}</strong>
                            {notification.body ? <em>{notification.body}</em> : null}
                            <time>{pulseNotificationPreviewTime(notification.created_at)}</time>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="pulse-notification-menu__state">
                      <CheckCircle2 size={19} />
                      <strong>No notifications yet</strong>
                      <span>When someone replies, posts club resources, approves membership, or updates an opportunity, it will show here.</span>
                      <Link onClick={() => setIsNotificationMenuOpen(false)} to={activeWorkspaceMode === 'college' ? '/pulse/clubs?section=overview' : '/pulse/home'}>
                        Go to workspace
                      </Link>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="pulse-account-menu" ref={accountMenuRef}>
              <button
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
                aria-label="Open Pulse account menu"
                className={profile?.avatar_url ? 'pulse-icon-button pulse-account-avatar-button' : 'pulse-icon-button'}
                onClick={() => {
                  setIsAccountMenuOpen((current) => !current);
                  setIsNotificationMenuOpen(false);
                }}
                type="button"
              >
                {profile?.avatar_url ? <img alt="" src={profile.avatar_url} /> : <UserCircle size={20} />}
              </button>
              {isAccountMenuOpen ? (
                <div className="pulse-account-menu__panel" role="menu">
                  <div className="pulse-account-menu__identity">
                    <span className="pulse-account-menu__avatar" aria-hidden="true">
                      {profile?.avatar_url ? <img alt="" src={profile.avatar_url} /> : <UserCircle size={22} />}
                    </span>
                    <span>
                      <strong>{profile?.display_name ?? 'Pulse member'}</strong>
                      <small>{profile?.college?.name ?? profile?.headline ?? 'Complete your Pulse profile'}</small>
                    </span>
                  </div>
                  <Link onClick={() => setIsAccountMenuOpen(false)} role="menuitem" to="/pulse/profile">
                    <UserCircle size={18} />
                    <span>My profile</span>
                  </Link>
                  <Link onClick={() => setIsAccountMenuOpen(false)} role="menuitem" to="/pulse/activity">
                    <Activity size={18} />
                    <span>My activity</span>
                  </Link>
                  <Link onClick={() => setIsAccountMenuOpen(false)} role="menuitem" to="/pulse/opportunities">
                    <CheckCircle2 size={18} />
                    <span>My applications</span>
                  </Link>
                  <Link onClick={() => setIsAccountMenuOpen(false)} role="menuitem" to="/pulse/invite">
                    <UserPlus size={18} />
                    <span>My referrals</span>
                  </Link>
                  <Link onClick={() => setIsAccountMenuOpen(false)} role="menuitem" to="/pulse/notifications">
                    <Bell size={18} />
                    <span>Notifications</span>
                  </Link>
                  <Link onClick={() => setIsAccountMenuOpen(false)} role="menuitem" to="/pulse/stars">
                    <Trophy size={18} />
                    <span>Pulse Stars</span>
                  </Link>
                  <a href={lmsHomeLink} role="menuitem">
                    <BookOpen size={18} />
                    <span>My Learning</span>
                  </a>
                  <button className="pulse-account-menu__logout" onClick={handleLogout} role="menuitem" type="button">
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <form className="pulse-tablet-search" onSubmit={submitSearch}>
          <Search size={18} />
          <label className="sr-only" htmlFor="pulse-tablet-search">Search Pulse</label>
          <input
            id="pulse-tablet-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={activeWorkspaceMode === 'college' ? 'Search your college workspace' : 'Search posts, people, opportunities'}
            value={query}
          />
        </form>
        <div className="pulse-app-content">
          <Outlet />
        </div>
      </section>
      <nav aria-label="Pulse mobile navigation" className="pulse-mobile-tabbar">
        {activeNavItems.map((item) => {
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <span aria-disabled="true" className="pulse-nav-placeholder" key={item.path} title="Coming later">
                <Icon size={19} />
                <span>{item.label}</span>
              </span>
            );
          }
          const itemUrl = new URL(item.path, window.location.origin);
          const section = itemUrl.searchParams.get('section');
          const isActive =
            (section === 'clubs' && location.pathname.startsWith('/pulse/clubs/')) ||
            (location.pathname === itemUrl.pathname &&
              (section
                ? searchParams.get('section') === section ||
                  (section === 'overview' && !searchParams.get('section') && location.pathname === '/pulse/clubs')
                : true));
          return (
            <Link className={isActive ? 'active' : undefined} key={item.path} to={item.path}>
              <Icon size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <PulseMandatoryProfileModal profile={profile} />
    </main>
  );
}
