import { Link, Outlet } from 'react-router-dom';
import { webEnv } from '../../config/env';
import '../styles/pulse.css';

const defaultLmsAppUrl = 'https://login.skilledsapiens.com';

function lmsPath(path: string) {
  const baseUrl = webEnv.lmsAppUrl || defaultLmsAppUrl;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export function PulsePublicLayout() {
  const lmsLoginLink = lmsPath('/login');

  return (
    <main className="pulse-site">
      <header className="pulse-public-nav">
        <Link className="pulse-brand" to="/pulse">
          <span className="pulse-brand__mark">
            <img alt="" src="/assets/pulse-icon-v3.svg" />
          </span>
          <span>
            <strong>Pulse</strong>
            <small>by Skilled Sapiens</small>
          </span>
        </Link>
        <nav aria-label="Pulse public navigation">
          <a href="#why-join">Why join</a>
          <a href="#inside-pulse">Inside Pulse</a>
          <a href="#invite-only">Invite only</a>
          <Link to="/pulse/login">Pulse Login</Link>
          <a href={lmsLoginLink}>LMS Login</a>
        </nav>
      </header>
      <Outlet />
    </main>
  );
}
