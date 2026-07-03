import { Bell, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NavItem, Portal } from '../app/routeConfig';
import { useAuth } from '../auth/AuthProvider';
import { StatusBadge } from '../components/StatusBadge';
import { StudentAnnouncement, useStudentAnnouncements } from '../features/student/useStudentAnnouncements';

type AppShellProps = {
  navItems: NavItem[];
  portal: Portal;
};

type NavSection = {
  title: string;
  moduleIds: string[];
};

const studentSections: NavSection[] = [
  { title: 'Main', moduleIds: ['dashboard', 'cohorts', 'recordings', 'schedule', 'resources'] },
  { title: 'My Progress', moduleIds: ['projects', 'project-submissions', 'certificates'] },
  { title: 'Community', moduleIds: ['community'] },
  { title: 'Help', moduleIds: ['announcements', 'support'] },
  { title: 'Account', moduleIds: ['payments'] }
];

const adminSections: NavSection[] = [
  { title: 'Main', moduleIds: ['dashboard', 'recording-candidates', 'workshops', 'resources'] },
  { title: 'Administration', moduleIds: ['students', 'cohorts', 'programs', 'projects', 'project-submissions', 'certificates', 'enrollments'] },
  { title: 'Community', moduleIds: ['community'] },
  { title: 'Help', moduleIds: ['announcements', 'support'] },
  { title: 'Payments', moduleIds: ['payment-orders', 'paid-access'] }
];

function groupNavItems(navItems: NavItem[], portal: Portal) {
  const sections = portal === 'student' ? studentSections : adminSections;
  const itemMap = new Map(navItems.map((item) => [item.moduleId, item]));

  return sections
    .map((section) => ({
      ...section,
      items: section.moduleIds.map((moduleId) => itemMap.get(moduleId)).filter((item): item is NavItem => Boolean(item))
    }))
    .filter((section) => section.items.length > 0);
}

function sortAnnouncements(items: StudentAnnouncement[]) {
  return [...items].sort((left, right) => {
    const leftPinned = left.pinned ? 1 : 0;
    const rightPinned = right.pinned ? 1 : 0;
    if (leftPinned !== rightPinned) return rightPinned - leftPinned;
    const priorityRank: Record<string, number> = { urgent: 3, important: 2, normal: 1 };
    const priorityDiff = (priorityRank[right.priority] ?? 0) - (priorityRank[left.priority] ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime();
  });
}

function announcementMeta(announcement: StudentAnnouncement) {
  if (announcement.pinned) return 'Pinned';
  if (announcement.priority === 'urgent') return 'Urgent';
  if (announcement.priority === 'important') return 'Important';
  return 'Announcement';
}

export function AppShell({ navItems, portal }: AppShellProps) {
  const portalLabel = portal === 'student' ? 'Student Portal' : 'Admin Portal';
  const workspaceLabel = portal === 'student' ? 'Learning workspace' : 'Admin workspace';
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [dismissedBannerId, setDismissedBannerId] = useState<string | null>(null);
  const announcementMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const announcementsQuery = useStudentAnnouncements({ enabled: portal === 'student', limit: 5, page: 1, priority: 'all' });
  const navSections = groupNavItems(navItems, portal);
  const activeNavItem = [...navItems]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => location.pathname === item.path || (item.path !== `/${portal}` && location.pathname.startsWith(`${item.path}/`)));
  const topbarTitle = activeNavItem?.label ?? workspaceLabel;
  const announcementItems = useMemo(() => sortAnnouncements(announcementsQuery.data?.items ?? []), [announcementsQuery.data?.items]);
  const activeAnnouncementCount = portal === 'student' ? announcementsQuery.data?.total ?? 0 : 0;
  const countLabel = activeAnnouncementCount > 99 ? '99+' : String(activeAnnouncementCount);
  const bannerAnnouncement = announcementItems.find((item) => item.pinned || item.priority === 'urgent');

  useEffect(() => {
    setIsAnnouncementOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isAnnouncementOpen) return;

    function closeOnOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (announcementMenuRef.current?.contains(target)) return;
      setIsAnnouncementOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('touchstart', closeOnOutsideClick);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('touchstart', closeOnOutsideClick);
    };
  }, [isAnnouncementOpen]);

  async function handleSignOut() {
    setIsNavOpen(false);
    await signOut();
    navigate(`/login?portal=${portal}`, { replace: true });
  }

  return (
    <div className="app-shell">
      <button aria-label="Close navigation menu" className={`sidebar-overlay ${isNavOpen ? 'sidebar-overlay--visible' : ''}`} onClick={() => setIsNavOpen(false)} type="button" />
      <aside className={`sidebar ${isNavOpen ? 'sidebar--open' : ''}`} aria-label={`${portalLabel} navigation`}>
        <button aria-label="Close navigation menu" className="sidebar-close" onClick={() => setIsNavOpen(false)} type="button">
          <X size={20} />
        </button>

        <div className="brand-lockup">
          <div className="brand-mark">SS</div>
          <div>
            <strong>Skilled Sapiens</strong>
            <span>{portal === 'student' ? 'Learning portal' : 'Admin portal'}</span>
          </div>
        </div>

        <nav className="nav-list">
          {navSections.map((section) => (
            <section className="nav-section" key={section.title}>
              <span className="nav-section__title">{section.title}</span>
              <div className="nav-section__items">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === `/${portal}`}
                      className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
                      onClick={() => setIsNavOpen(false)}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" type="button" onClick={handleSignOut}>
            <LogOut size={18} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button aria-expanded={isNavOpen} aria-label="Open navigation menu" className="mobile-menu-button" onClick={() => setIsNavOpen(true)} type="button">
              <Menu size={22} />
            </button>
            <div>
              <span>{portalLabel}</span>
              <strong>{topbarTitle}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            {portal === 'student' ? (
              <div className="topbar-announcements" ref={announcementMenuRef}>
                <button
                  aria-expanded={isAnnouncementOpen}
                  aria-label={`Open announcements${activeAnnouncementCount > 0 ? `, ${activeAnnouncementCount} active` : ''}`}
                  className="topbar-announcement-button"
                  onClick={() => setIsAnnouncementOpen((current) => !current)}
                  type="button"
                >
                  <Bell size={18} />
                  {activeAnnouncementCount > 0 ? <span>{countLabel}</span> : null}
                </button>
                {isAnnouncementOpen ? (
                  <section className="topbar-announcement-menu" aria-label="Latest announcements">
                    <div className="topbar-announcement-menu__header">
                      <div>
                        <strong>Announcements</strong>
                        <small>{activeAnnouncementCount} active</small>
                      </div>
                      <button aria-label="Close announcements" className="topbar-announcement-close" onClick={() => setIsAnnouncementOpen(false)} type="button">
                        <X size={16} />
                      </button>
                    </div>
                    {announcementItems.length > 0 ? (
                      <div className="topbar-announcement-menu__list">
                        {announcementItems.map((announcement) => (
                          <Link className="topbar-announcement-item" key={announcement.id} to="/student/announcements">
                            <span>{announcementMeta(announcement)}</span>
                            <strong>{announcement.title}</strong>
                            <small>{announcement.message}</small>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p>No active announcements right now.</p>
                    )}
                    <Link className="topbar-announcement-view-all" to="/student/announcements">
                      View all announcements
                    </Link>
                  </section>
                ) : null}
              </div>
            ) : null}
            <StatusBadge tone="safe">Protected session</StatusBadge>
            <ShieldCheck size={20} />
          </div>
        </header>

        {portal === 'student' && bannerAnnouncement && dismissedBannerId !== bannerAnnouncement.id ? (
          <section className="student-announcement-banner" aria-label="Pinned announcement">
            <div>
              <span>{announcementMeta(bannerAnnouncement)}</span>
              <strong>{bannerAnnouncement.title}</strong>
              <p>{bannerAnnouncement.message}</p>
            </div>
            <div className="student-announcement-banner__actions">
              <Link to="/student/announcements">View</Link>
              <button aria-label="Dismiss announcement banner" onClick={() => setDismissedBannerId(bannerAnnouncement.id)} type="button">
                <X size={17} />
              </button>
            </div>
          </section>
        ) : null}

        <main className="page-frame">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
