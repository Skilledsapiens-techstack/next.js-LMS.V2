import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BookOpen, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { webEnv } from '../../config/env';
import { PulseBadge, PulseButton, PulseCard } from '../components';

const defaultLmsAppUrl = 'https://login.skilledsapiens.com';

function lmsPath(path: string) {
  const baseUrl = webEnv.lmsAppUrl || defaultLmsAppUrl;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export function PulseLoginPage() {
  const { isConfigured, sendPulsePasswordSetup, signInWithPassword, status } = useAuth();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [verificationMessage, setVerificationMessage] = useState('');
  const lmsLoginUrl = useMemo(() => lmsPath('/login'), []);

  useEffect(() => {
    document.title = 'Pulse Login | Skilled Sapiens';
  }, []);

  if (status === 'authenticated') {
    return <Navigate replace to="/pulse/home" />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setVerificationMessage('');
    setIsSubmitting(true);

    try {
      await signInWithPassword(email.trim().toLowerCase(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in. Please check your details and try again.';
      setErrorMessage(
        /invalid login credentials/i.test(message)
          ? 'Unable to sign in. If this is your first Pulse login or you forgot your password, send yourself a password setup email below.'
          : message
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSetupEmail() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setVerificationStatus('failed');
      setVerificationMessage('Enter your email above first.');
      return;
    }

    setVerificationStatus('sending');
    setVerificationMessage('');

    try {
      await sendPulsePasswordSetup(trimmedEmail, '/pulse/home');
      setVerificationStatus('sent');
      setVerificationMessage('Password setup email sent. Open it once, set your password, then sign in with email and password.');
    } catch (error) {
      setVerificationStatus('failed');
      setVerificationMessage(error instanceof Error ? error.message : 'Unable to send password setup email.');
    }
  }

  return (
    <section className="pulse-login-page">
      <div className="pulse-login-page__copy">
        <PulseBadge tone="coral">Pulse login</PulseBadge>
        <h1>Sign in to Pulse.</h1>
        <p>
          Use the same Skilled Sapiens account you use for LMS. Pulse keeps the community experience separate while
          your identity, invite history, and learning access stay connected.
        </p>
        <div className="pulse-login-page__signals">
          <span><ShieldCheck size={18} /> Same verified Skilled Sapiens account</span>
          <span><UserPlus size={18} /> Invite-led Pulse community access</span>
          <span><BookOpen size={18} /> Smooth handoff back to My Learning</span>
        </div>
      </div>

      <PulseCard className="pulse-login-card">
        <form className="pulse-profile-form pulse-login-form" onSubmit={handleSubmit}>
          <label className="pulse-profile-form__wide">
            <span>Email</span>
            <input
              autoComplete="email"
              disabled={!isConfigured || isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@email.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label className="pulse-profile-form__wide">
            <span>Password</span>
            <input
              autoComplete="current-password"
              disabled={!isConfigured || isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />
          </label>
          <div className="pulse-login-form__helpers">
            <button
              className="pulse-login-form__helper-button"
              disabled={!isConfigured || verificationStatus === 'sending'}
              onClick={handlePasswordSetupEmail}
              type="button"
            >
              {verificationStatus === 'sending' ? 'Sending password email...' : 'Forgot password?'}
            </button>
            <button
              className="pulse-login-form__helper-button"
              disabled={!isConfigured || verificationStatus === 'sending'}
              onClick={handlePasswordSetupEmail}
              type="button"
            >
              Set password for first login
            </button>
          </div>
          <button
            className="pulse-button pulse-button--ghost pulse-login-form__forgot-cta pulse-profile-form__submit"
            disabled={!isConfigured || verificationStatus === 'sending'}
            onClick={handlePasswordSetupEmail}
            type="button"
          >
            <span>{verificationStatus === 'sending' ? 'Sending password email...' : 'Forgot password? Reset it'}</span>
            <UserPlus size={18} />
          </button>
          {!isConfigured ? (
            <p className="pulse-form-error">Pulse login is not configured for this deployment yet.</p>
          ) : null}
          {errorMessage ? <p className="pulse-form-error">{errorMessage}</p> : null}
          {errorMessage && verificationStatus !== 'sent' ? (
            <button
              className="pulse-button pulse-button--secondary pulse-profile-form__submit"
              disabled={!isConfigured || verificationStatus === 'sending'}
              onClick={handlePasswordSetupEmail}
              type="button"
            >
              <span>{verificationStatus === 'sending' ? 'Sending email...' : 'Send password setup email'}</span>
              <UserPlus size={18} />
            </button>
          ) : null}
          {verificationMessage ? (
            <p className={verificationStatus === 'sent' ? 'pulse-form-success' : 'pulse-form-error'}>{verificationMessage}</p>
          ) : null}
          <button className="pulse-button pulse-button--primary pulse-profile-form__submit" disabled={!isConfigured || isSubmitting} type="submit">
            <span>{isSubmitting ? 'Signing in...' : 'Enter Pulse'}</span>
            <LogIn size={18} />
          </button>
        </form>
        <div className="pulse-login-card__footer">
          <PulseButton to="/pulse/access-request" variant="ghost">Need Pulse access?</PulseButton>
          <PulseButton href={lmsLoginUrl} variant="ghost">Open LMS login</PulseButton>
        </div>
      </PulseCard>
    </section>
  );
}
