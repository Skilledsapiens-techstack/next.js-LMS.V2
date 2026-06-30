import { LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NavItem, Portal } from '../app/routeConfig';
import { useAuth } from '../auth/AuthProvider';
import { StatusBadge } from '../components/StatusBadge';

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
  { title: 'Account', moduleIds: ['payments', 'access'] }
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

export function AppShell({ navItems, portal }: AppShellProps) {
  const portalLabel = portal === 'student' ? 'Student Portal' : 'Admin Portal';
  const workspaceLabel = portal === 'student' ? 'Learning workspace' : 'Admin workspace';
  const [isNavOpen, setIsNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const navSections = groupNavItems(navItems, portal);
  const activeNavItem = [...navItems]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => location.pathname === item.path || (item.path !== `/${portal}` && location.pathname.startsWith(`${item.path}/`)));
  const topbarTitle = activeNavItem?.label ?? workspaceLabel;

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
            <StatusBadge tone="safe">Protected session</StatusBadge>
            <ShieldCheck size={20} />
          </div>
        </header>

        <main className="page-frame">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
