import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Building2, Eye, EyeOff, GraduationCap, KeyRound, Loader2, Mail, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type GuestSignUpPayload } from '../auth/AuthProvider';
import { StateBlock } from '../components/StateBlock';

const currentStatusOptions = [
  { label: 'Student', value: 'student' },
  { label: 'Working Professional', value: 'working_professional' },
  { label: 'Looking for Job', value: 'looking_for_job' },
  { label: 'Career Switcher', value: 'career_switcher' },
  { label: 'Entrepreneur / Founder', value: 'entrepreneur_founder' },
  { label: 'Other', value: 'other' }
];

const educationYearOptions = ['1st Year', '2nd Year', '3rd Year', 'Final Year', 'Postgraduate', 'Recently Graduated'];
const interestedRoleOptions = ['Finance', 'Marketing', 'Sales', 'Sales & Marketing', 'HR', 'Business Analytics', 'Consulting', 'Product Management', 'Operations', 'Entrepreneurship', 'Not sure yet'];

const initialForm: GuestSignUpPayload = {
  audienceType: 'student',
  collegeName: '',
  companyName: '',
  currentCity: '',
  currentRole: '',
  currentStatus: 'student',
  educationYear: '',
  fullName: '',
  interestedProgram: '',
  interestedRoles: [],
  mentorAllocationInterest: 'maybe_later',
  officialEmail: '',
  password: '',
  personalEmail: '',
  whatsappNumber: ''
};

function normalizeAudienceType(status: string): GuestSignUpPayload['audienceType'] {
  if (status === 'student') return 'student';
  if (status === 'working_professional') return 'working_professional';
  return 'other';
}

function cleanWhatsApp(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, 10);
}

export function GuestSignupPage() {
  const { isConfigured, signUpGuest } = useAuth();
  const [form, setForm] = useState<GuestSignUpPayload>(initialForm);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isStudent = form.audienceType === 'student';
  const isWorking = form.audienceType === 'working_professional';
  const selectedRoles = useMemo(() => new Set(form.interestedRoles), [form.interestedRoles]);

  function updateField<TKey extends keyof GuestSignUpPayload>(key: TKey, value: GuestSignUpPayload[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateStatus(value: string) {
    const audienceType = normalizeAudienceType(value);
    setForm((current) => ({
      ...current,
      audienceType,
      currentStatus: value,
      collegeName: audienceType === 'student' ? current.collegeName : '',
      companyName: audienceType === 'working_professional' ? current.companyName : '',
      currentRole: audienceType === 'working_professional' ? current.currentRole : '',
      educationYear: audienceType === 'student' ? current.educationYear : '',
      officialEmail: audienceType === 'student' ? current.officialEmail : current.officialEmail
    }));
  }

  function toggleRole(role: string) {
    setForm((current) => {
      const roles = new Set(current.interestedRoles);
      if (roles.has(role)) roles.delete(role);
      else roles.add(role);
      return { ...current, interestedRoles: Array.from(roles) };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    if (form.password.length < 8) {
      setStatus('failed');
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (form.password !== confirmPassword) {
      setStatus('failed');
      setErrorMessage('Password and confirmation do not match.');
      return;
    }

    if (!/^[6-9][0-9]{9}$/.test(form.whatsappNumber)) {
      setStatus('failed');
      setErrorMessage('Enter a valid 10-digit India WhatsApp number.');
      return;
    }

    try {
      await signUpGuest(form);
      setStatus('sent');
    } catch (error) {
      setStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create guest access.');
    }
  }

  return (
    <main className="auth-page auth-page--guest">
      <section className="guest-signup-shell">
        <section className="auth-panel guest-signup-panel">
          <div className="auth-lockup">
            <div className="brand-mark brand-mark--logo">
              <img alt="Skilled Sapiens logo" src="/apple-touch-icon.png" />
            </div>
            <div>
              <strong>Skilled Sapiens</strong>
              <span>Free Access signup</span>
            </div>
          </div>

          <div className="auth-copy">
            <span>Guest Access</span>
            <h1>Create Free Access</h1>
            <p>Your Personal Email will be your login and communication mail ID. Use an email you can access long term.</p>
          </div>

          {status === 'sent' ? (
            <StateBlock title="Verify your email">
              We have sent a verification link to your Personal Email. Verify it, then sign in to open your Free Access workspace.
              <span className="state-block-actions">
                <Link className="segmented-button" to="/login?portal=student">
                  Back to login
                </Link>
              </span>
            </StateBlock>
          ) : (
            <form className="auth-form guest-signup-form" onSubmit={handleSubmit}>
              <div className="guest-signup-scroll">
              <section className="guest-form-section">
                <div className="guest-form-section__header">
                  <h2>Account Details</h2>
                </div>
                <div className="guest-form-grid">
                  <TextField icon={<UserRound size={17} />} label="Full name" value={form.fullName} onChange={(value) => updateField('fullName', value)} required />
                  <TextField icon={<Mail size={17} />} label="Personal Email" type="email" value={form.personalEmail} onChange={(value) => updateField('personalEmail', value)} required helper="Login and communication email." />
                  <TextField icon={<Mail size={17} />} label="Official Email" type="email" value={form.officialEmail ?? ''} onChange={(value) => updateField('officialEmail', value)} required={isStudent} helper={isStudent ? 'Mandatory for college students.' : 'Optional for working professionals.'} />
                  <TextField icon={<Phone size={17} />} label="WhatsApp number (+91)" inputMode="numeric" value={form.whatsappNumber} onChange={(value) => updateField('whatsappNumber', cleanWhatsApp(value))} required />
                  <PasswordField label="Password" value={form.password} show={showPassword} onChange={(value) => updateField('password', value)} onToggle={() => setShowPassword((current) => !current)} required />
                  <PasswordField label="Confirm password" value={confirmPassword} show={showConfirmPassword} onChange={setConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} required />
                </div>
              </section>

              <section className="guest-form-section">
                <div className="guest-form-section__header">
                  <h2>Profile Details</h2>
                </div>
                <div className="guest-form-grid">
                  <SelectField icon={<BriefcaseBusiness size={17} />} label="Current status" value={form.currentStatus} onChange={updateStatus} options={currentStatusOptions} />
                  <TextField icon={<MapPin size={17} />} label="Current city" value={form.currentCity ?? ''} onChange={(value) => updateField('currentCity', value)} required />
                  {isStudent ? (
                    <>
                      <TextField icon={<Building2 size={17} />} label="College / institution" value={form.collegeName ?? ''} onChange={(value) => updateField('collegeName', value)} required />
                      <SelectField icon={<GraduationCap size={17} />} label="Year of education" value={form.educationYear ?? ''} onChange={(value) => updateField('educationYear', value)} options={educationYearOptions.map((year) => ({ label: year, value: year }))} />
                    </>
                  ) : null}
                  {isWorking ? (
                    <>
                      <TextField icon={<Building2 size={17} />} label="Current company" value={form.companyName ?? ''} onChange={(value) => updateField('companyName', value)} required />
                      <TextField icon={<BriefcaseBusiness size={17} />} label="Current role" value={form.currentRole ?? ''} onChange={(value) => updateField('currentRole', value)} />
                    </>
                  ) : null}
                  <SelectField
                    icon={<UserRound size={17} />}
                    label="Mentor Allocation"
                    value={form.mentorAllocationInterest}
                    onChange={(value) => updateField('mentorAllocationInterest', value as GuestSignUpPayload['mentorAllocationInterest'])}
                    options={[
                      { label: 'Yes, urgently', value: 'yes_urgently' },
                      { label: 'Maybe later', value: 'maybe_later' },
                      { label: 'No', value: 'no' }
                    ]}
                  />
                </div>

                <fieldset className="guest-checkbox-group">
                  <legend>Interested profile / role</legend>
                  <div>
                    {interestedRoleOptions.map((role) => (
                      <label key={role}>
                        <input type="checkbox" checked={selectedRoles.has(role)} onChange={() => toggleRole(role)} />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>
              </div>

              <button className="auth-submit" type="submit" disabled={!isConfigured || status === 'submitting'}>
                {status === 'submitting' ? (
                  <>
                    Creating access
                    <Loader2 className="auth-spin" size={17} />
                  </>
                ) : (
                  <>
                    Create Free Access
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {status === 'failed' ? (
            <StateBlock title="Guest signup could not complete" tone="warning">
              {errorMessage}
            </StateBlock>
          ) : null}

          <div className="guest-signup-footnote">
            <span>
              <Mail size={14} />
              Duplicate accounts are not allowed.
            </span>
            <span>
              <ShieldCheck size={14} />
              Email verification required.
            </span>
          </div>
        </section>

      </section>
    </main>
  );
}

function TextField({
  helper,
  icon,
  inputMode,
  label,
  onChange,
  required,
  type = 'text',
  value
}: {
  helper?: string;
  icon: ReactNode;
  inputMode?: 'numeric';
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="guest-field">
      <span className="auth-field-label">{label}{required ? ' *' : ''}</span>
      <div className="auth-input-shell">
        {icon}
        <input inputMode={inputMode} type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
      </div>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function PasswordField({
  label,
  onChange,
  onToggle,
  required,
  show,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  required?: boolean;
  show: boolean;
  value: string;
}) {
  return (
    <label className="guest-field">
      <span className="auth-field-label">{label}{required ? ' *' : ''}</span>
      <div className="auth-input-shell auth-input-shell--password">
        <KeyRound size={17} />
        <input type={show ? 'text' : 'password'} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
        <button className="auth-password-toggle" type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  );
}

function SelectField({ icon, label, onChange, options, value }: { icon: ReactNode; label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) {
  return (
    <label className="guest-field">
      <span className="auth-field-label">{label} *</span>
      <div className="auth-input-shell auth-input-shell--select">
        {icon}
        <select value={value} required onChange={(event) => onChange(event.target.value)}>
          <option value="" disabled>
            Select
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
