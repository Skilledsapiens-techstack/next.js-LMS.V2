import { FormEvent, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CalendarDays, FolderOpen, KeyRound, Mail, Video } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { StateBlock } from '../components/StateBlock';
import { apiGet, ApiClientError } from '../lib/supabaseApi';

type LoginPortal = 'admin' | 'student';

function isProfileMismatch(error: unknown) {
  return error instanceof ApiClientError && (error.status === 403 || error.status === 404);
}

async function canAccessPortal(path: string, accessToken: string) {
  try {
    await apiGet(path, { accessToken });
    return true;
  } catch (error) {
    if (isProfileMismatch(error)) {
      return false;
    }

    throw error;
  }
}

async function resolveSignedInPortal(accessToken: string, requestedPortal: LoginPortal): Promise<LoginPortal> {
  const portalChecks: Array<{ path: string; portal: LoginPortal }> =
    requestedPortal === 'admin'
      ? [
          { path: '/admins/me', portal: 'admin' },
          { path: '/students/me', portal: 'student' }
        ]
      : [
          { path: '/admins/me', portal: 'admin' },
          { path: '/students/me', portal: 'student' }
        ];

  for (const check of portalChecks) {
    if (await canAccessPortal(check.path, accessToken)) {
      return check.portal;
    }
  }

  return requestedPortal;
}

export function LoginPage() {
  const { isConfigured, signInWithPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portal: LoginPortal = searchParams.get('portal') === 'admin' ? 'admin' : 'student';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'failed' | 'signing-in'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('signing-in');
    setErrorMessage('');

    try {
      const session = await signInWithPassword(email, password);
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Sign-in completed, but no secure session token was returned.');
      }

      const resolvedPortal = await resolveSignedInPortal(accessToken, portal);
      navigate(`/${resolvedPortal}`, { replace: true });
    } catch (error) {
      setStatus('failed');
      setErrorMessage(error instanceof ApiClientError ? 'Signed in, but the Supabase profile check could not complete. Please confirm the project configuration and try again.' : error instanceof Error ? error.message : 'Unable to sign in.');
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <aside className="auth-brand-panel" aria-label="Skilled Sapiens portal">
          <div className="brand-lockup brand-lockup--large">
            <div className="brand-mark">SS</div>
            <div>
              <strong>Skilled Sapiens</strong>
              <span>Learning portal</span>
            </div>
          </div>

          <div className="auth-brand-copy">
            <span>Choose, grow, and excel with us</span>
            <h1>
              Live learning.
              <strong>Real growth.</strong>
            </h1>
            <p>Your complete Skilled Sapiens learning hub for live classes, recordings, projects, certificates, and placement resources.</p>
          </div>

          <div className="auth-feature-grid">
            <article>
              <Video size={18} />
              <span>Recorded sessions from corporate mentors</span>
            </article>
            <article>
              <CalendarDays size={18} />
              <span>Live classes, workshops, and cohort schedules</span>
            </article>
            <article>
              <FolderOpen size={18} />
              <span>Curated resources, templates, and support data</span>
            </article>
            <article>
              <BriefcaseBusiness size={18} />
              <span>Live projects with guided submissions</span>
            </article>
          </div>
        </aside>

        <section className="auth-panel">
          <div className="auth-copy">
            <span>Learning portal</span>
            <h1>Welcome back</h1>
            <p>Sign in to continue your Skilled Sapiens journey.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <div className="auth-input-shell">
              <Mail size={18} />
              <input id="email" type="email" value={email} disabled={!isConfigured} required onChange={(event) => setEmail(event.target.value)} placeholder="Enter your registered email" />
            </div>

            <label htmlFor="password">Password</label>
            <div className="auth-input-shell">
              <KeyRound size={18} />
              <input id="password" type="password" value={password} disabled={!isConfigured} required onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
            </div>

            <button className="auth-submit" type="submit" disabled={!isConfigured || status === 'signing-in'}>
              {status === 'signing-in' ? 'Signing in' : 'Sign in'}
              <ArrowRight size={18} />
            </button>
          </form>

          {!isConfigured ? (
            <StateBlock title="Auth configuration missing" tone="warning">
              Portal sign-in is not configured for this environment yet.
            </StateBlock>
          ) : null}

          {status === 'failed' ? (
            <StateBlock title="Sign-in could not complete" tone="warning">
              {errorMessage}
            </StateBlock>
          ) : null}
        </section>
      </section>
    </main>
  );
}
