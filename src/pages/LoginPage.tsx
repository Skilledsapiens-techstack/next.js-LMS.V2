import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, HelpCircle, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { StateBlock } from '../components/StateBlock';
import { apiGet, ApiClientError } from '../lib/supabaseApi';

type LoginPortal = 'admin' | 'student';
type AuthIntent = 'forgot' | 'create';
type RequestStatus = 'idle' | 'sending' | 'sent' | 'failed';
type PasswordUpdateStatus = 'idle' | 'updating' | 'updated' | 'failed';

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
          { path: '/students/me', portal: 'student' },
          { path: '/admins/me', portal: 'admin' }
        ];

  for (const check of portalChecks) {
    if (await canAccessPortal(check.path, accessToken)) {
      return check.portal;
    }
  }

  throw new ApiClientError(`No active ${requestedPortal} profile is linked to this account.`, 404);
}

export function LoginPage() {
  const { isConfigured, isPasswordRecovery, resetPasswordForEmail, signInWithPassword, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portal: LoginPortal = searchParams.get('portal') === 'admin' ? 'admin' : 'student';
  const urlIntent = searchParams.get('intent') === 'create' ? 'create' : 'forgot';
  const isRecoveryMode = searchParams.get('mode') === 'recovery' || isPasswordRecovery;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'failed' | 'signing-in'>('idle');
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('idle');
  const [requestIntent, setRequestIntent] = useState<AuthIntent>(urlIntent);
  const [passwordUpdateStatus, setPasswordUpdateStatus] = useState<PasswordUpdateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const recoveryTitle = useMemo(() => (urlIntent === 'create' ? 'Create password' : 'Reset password'), [urlIntent]);

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
      setErrorMessage(error instanceof ApiClientError ? 'Signed in, but the LMS profile check could not complete. Please confirm the portal configuration and try again.' : error instanceof Error ? error.message : 'Unable to sign in.');
    }
  }

  async function handlePasswordEmail(intent: AuthIntent) {
    const normalizedEmail = email.trim();
    setRequestIntent(intent);
    setRequestStatus('sending');
    setStatus('idle');
    setErrorMessage('');
    setNoticeMessage('');

    if (!normalizedEmail) {
      setRequestStatus('failed');
      setErrorMessage('Enter your registered LMS email before requesting a password link.');
      return;
    }

    try {
      await resetPasswordForEmail(normalizedEmail, intent);
      setRequestStatus('sent');
      setNoticeMessage(
        intent === 'create'
          ? 'Password creation link sent. Open the email and return here to create your LMS password.'
          : 'Password reset link sent. Open the email and return here to set a new password.'
      );
    } catch (error) {
      setRequestStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send password email.');
    }
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordUpdateStatus('updating');
    setErrorMessage('');
    setNoticeMessage('');

    if (newPassword.length < 8) {
      setPasswordUpdateStatus('failed');
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordUpdateStatus('failed');
      setErrorMessage('The password and confirmation do not match.');
      return;
    }

    try {
      await updatePassword(newPassword);
      await signOut();
      setPasswordUpdateStatus('updated');
      setNewPassword('');
      setConfirmPassword('');
      setNoticeMessage('Password updated. Sign in with your new password to continue.');
    } catch (error) {
      setPasswordUpdateStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update password.');
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <section className="auth-panel">
          <div className="auth-lockup">
            <div className="brand-mark">SS</div>
            <div>
              <strong>Skilled Sapiens</strong>
              <span>{portal === 'admin' ? 'Admin portal' : 'Learning portal'}</span>
            </div>
          </div>

          <div className="auth-copy">
            <span>{isRecoveryMode ? recoveryTitle : 'Welcome back'}</span>
            <div className="auth-title-row">
              <h1>{isRecoveryMode ? recoveryTitle : 'Welcome back'}</h1>
              <HelpTip text={isRecoveryMode ? 'Use the secure email link to set your LMS password.' : 'Use the email registered with your LMS account.'} />
            </div>
            <p>{isRecoveryMode ? 'Set a secure password for your Skilled Sapiens account.' : 'Sign in to continue your Skilled Sapiens journey.'}</p>
          </div>

          {isRecoveryMode && passwordUpdateStatus !== 'updated' ? (
            <form className="auth-form" onSubmit={handlePasswordUpdate}>
              <FieldLabel htmlFor="new-password" label="New password" help="Create a password with at least 8 characters." />
              <PasswordInput
                disabled={!isConfigured || passwordUpdateStatus === 'updating'}
                icon={<LockKeyhole size={17} />}
                id="new-password"
                onToggle={() => setShowNewPassword((value) => !value)}
                placeholder="Create a secure password"
                show={showNewPassword}
                value={newPassword}
                onChange={setNewPassword}
              />

              <FieldLabel htmlFor="confirm-password" label="Confirm password" help="Re-enter the same password to avoid typing mistakes." />
              <PasswordInput
                disabled={!isConfigured || passwordUpdateStatus === 'updating'}
                icon={<ShieldCheck size={17} />}
                id="confirm-password"
                onToggle={() => setShowConfirmPassword((value) => !value)}
                placeholder="Confirm your new password"
                show={showConfirmPassword}
                value={confirmPassword}
                onChange={setConfirmPassword}
              />

              <button className="auth-submit" type="submit" disabled={!isConfigured || passwordUpdateStatus === 'updating'}>
                {passwordUpdateStatus === 'updating' ? (
                  <>
                    Updating
                    <Loader2 className="auth-spin" size={17} />
                  </>
                ) : (
                  <>
                    Save password
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <FieldLabel htmlFor="email" label="Email address" help="Use the email registered with your LMS account." />
              <div className="auth-input-shell">
                <Mail size={17} />
                <input id="email" type="email" value={email} disabled={!isConfigured || status === 'signing-in'} required onChange={(event) => setEmail(event.target.value)} placeholder="Enter your registered email" />
              </div>

              <FieldLabel htmlFor="password" label="Password" help="Enter your LMS password. Use the eye icon to check it before signing in." />
              <PasswordInput
                disabled={!isConfigured || status === 'signing-in'}
                icon={<KeyRound size={17} />}
                id="password"
                onToggle={() => setShowPassword((value) => !value)}
                placeholder="Enter your password"
                show={showPassword}
                value={password}
                onChange={setPassword}
              />

              <div className="auth-action-row">
                <button className="auth-secondary-action" type="button" disabled={!isConfigured || requestStatus === 'sending'} onClick={() => handlePasswordEmail('forgot')}>
                  {requestStatus === 'sending' && requestIntent === 'forgot' ? 'Sending' : 'Forgot password'}
                </button>
                <button className="auth-submit" type="submit" disabled={!isConfigured || status === 'signing-in'}>
                  {status === 'signing-in' ? (
                    <>
                      Signing in
                      <Loader2 className="auth-spin" size={17} />
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>

              <button className="auth-create-action" type="button" disabled={!isConfigured || requestStatus === 'sending'} onClick={() => handlePasswordEmail('create')}>
                {requestStatus === 'sending' && requestIntent === 'create' ? 'Sending create link' : 'Create password'}
              </button>
            </form>
          )}

          <div className="auth-helper-copy">
            <p>
              <HelpCircle size={16} />
              First-time users can create a password with their registered LMS email.
            </p>
            <p>
              <CheckCircle2 size={16} />
              Secure password links expire automatically for your account protection.
            </p>
          </div>

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

          {requestStatus === 'sent' || passwordUpdateStatus === 'updated' ? <StateBlock title={passwordUpdateStatus === 'updated' ? 'Password ready' : 'Check your email'}>{noticeMessage}</StateBlock> : null}
        </section>
      </section>
    </main>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="auth-help-tip" tabIndex={0} aria-label={text}>
      <HelpCircle size={16} />
      <span role="tooltip">{text}</span>
    </span>
  );
}

function FieldLabel({ help, htmlFor, label }: { help: string; htmlFor: string; label: string }) {
  return (
    <label className="auth-field-label" htmlFor={htmlFor}>
      <span>{label}</span>
      <HelpTip text={help} />
    </label>
  );
}

function PasswordInput({
  disabled,
  icon,
  id,
  onChange,
  onToggle,
  placeholder,
  show,
  value
}: {
  disabled: boolean;
  icon: ReactNode;
  id: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  placeholder: string;
  show: boolean;
  value: string;
}) {
  return (
    <div className="auth-input-shell auth-input-shell--password">
      {icon}
      <input id={id} type={show ? 'text' : 'password'} value={value} disabled={disabled} required onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <button className="auth-password-toggle" type="button" disabled={disabled} onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
