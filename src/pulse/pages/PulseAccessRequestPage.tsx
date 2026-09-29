import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth, type GuestSignUpPayload } from '../../auth/AuthProvider';
import { PulseBadge, PulseButton, PulseCard } from '../components';
import { rememberPulseInviteCode } from '../features/usePulseCommunity';
import {
  PULSE_OTHER_COLLEGE_ID,
  buildPulseCollegeOptions,
  getPulseCollegeOptionName
} from '../lib/collegeOptions';
import { normalizeLinkedInProfileUrl } from '../lib/linkedin';

const currentStatusOptions = [
  { label: 'Student', value: 'student' },
  { label: 'Working Professional', value: 'working_professional' },
  { label: 'Looking for Job', value: 'looking_for_job' },
  { label: 'Career Switcher', value: 'career_switcher' },
  { label: 'Entrepreneur / Founder', value: 'entrepreneur_founder' },
  { label: 'Other', value: 'other' }
];

const educationYearOptions = ['1st Year', '2nd Year', '3rd Year', 'Final Year', 'Postgraduate', 'Recently Graduated'];
const interestedRoleOptions = ['Finance', 'Marketing', 'Sales', 'HR', 'Business Analytics', 'Consulting', 'Product Management', 'Operations', 'Entrepreneurship', 'Not sure yet'];

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
  linkedinUrl: '',
  mentorAllocationInterest: 'maybe_later',
  officialEmail: '',
  password: '',
  personalEmail: '',
  redirectPath: '/pulse/home',
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

function pulseAccessRequestPath(code?: string) {
  return code ? `/pulse/access-request/${encodeURIComponent(code)}` : '/pulse/access-request';
}

export function PulseAccessRequestPage() {
  const { code } = useParams();
  const { isConfigured, signUpGuest, status: authStatus } = useAuth();
  const [form, setForm] = useState<GuestSignUpPayload>(initialForm);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [collegeId, setCollegeId] = useState('');

  const isStudent = form.audienceType === 'student';
  const isWorking = form.audienceType === 'working_professional';
  const selectedRoles = useMemo(() => new Set(form.interestedRoles), [form.interestedRoles]);
  const collegeOptions = useMemo(() => buildPulseCollegeOptions(), []);

  useEffect(() => {
    document.title = 'Pulse Access Request | Skilled Sapiens';
  }, []);

  useEffect(() => {
    rememberPulseInviteCode(code);
  }, [code]);

  if (authStatus === 'authenticated') {
    return <Navigate replace to="/pulse/home" />;
  }

  function updateField<TKey extends keyof GuestSignUpPayload>(key: TKey, value: GuestSignUpPayload[TKey]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateStatus(value: string) {
    const audienceType = normalizeAudienceType(value);
    setForm((current) => ({
      ...current,
      audienceType,
      collegeName: audienceType === 'student' ? current.collegeName : '',
      companyName: audienceType === 'working_professional' ? current.companyName : '',
      currentRole: audienceType === 'working_professional' ? current.currentRole : '',
      currentStatus: value,
      educationYear: audienceType === 'student' ? current.educationYear : ''
    }));
    if (audienceType !== 'student') setCollegeId('');
  }

  function updateCollege(value: string) {
    setCollegeId(value);
    setForm((current) => ({
      ...current,
      collegeName: value === PULSE_OTHER_COLLEGE_ID ? '' : getPulseCollegeOptionName(collegeOptions, value)
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

    const linkedinUrl = normalizeLinkedInProfileUrl(form.linkedinUrl);
    if (!linkedinUrl) {
      setStatus('failed');
      setErrorMessage('Enter a valid LinkedIn profile URL, for example https://www.linkedin.com/in/your-profile.');
      return;
    }

    try {
      await signUpGuest({ ...form, linkedinUrl, redirectPath: '/pulse/home' });
      setStatus('sent');
    } catch (error) {
      setStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create Pulse access.');
    }
  }

  return (
    <section className="pulse-access-page">
      <div className="pulse-access-page__intro">
        <PulseBadge tone="coral">Pulse access</PulseBadge>
        <h1>Create your Pulse account.</h1>
        <p>
          Use your invite to create a Skilled Sapiens account for Pulse. After email verification, you can complete your
          Pulse profile and enter the community.
        </p>
        {code ? <span className="pulse-access-page__invite-code">Invite code: {code}</span> : null}
      </div>

      <PulseCard className="pulse-access-card">
        {status === 'sent' ? (
          <div className="pulse-access-success">
            <ShieldCheck size={26} />
            <div>
              <PulseBadge tone="green">Check your email</PulseBadge>
              <h2>Verify your email to enter Pulse.</h2>
              <p>
                We sent a verification link to your personal email. Once verified, sign in to Pulse and finish your
                profile.
              </p>
              <div className="pulse-profile-form__actions">
                <PulseButton to="/pulse/login">Sign in to Pulse</PulseButton>
                <PulseButton to={code ? `/pulse/invite/${encodeURIComponent(code)}` : '/pulse'} variant="ghost">
                  Back to invite
                </PulseButton>
              </div>
            </div>
          </div>
        ) : (
          <form className="pulse-profile-form pulse-access-form" onSubmit={handleSubmit}>
            <div className="pulse-profile-form__section">
              <div>
                <h2>Account details</h2>
                <p className="pulse-form-note">Your personal email becomes your Pulse login.</p>
              </div>
              <TextField icon={<UserRound size={17} />} label="Full name" onChange={(value) => updateField('fullName', value)} required value={form.fullName} />
              <TextField icon={<Mail size={17} />} label="Personal email" onChange={(value) => updateField('personalEmail', value)} required type="email" value={form.personalEmail} />
              <TextField icon={<Mail size={17} />} label="Official email (College/Company)" onChange={(value) => updateField('officialEmail', value)} required={isStudent} type="email" value={form.officialEmail ?? ''} />
              <TextField icon={<Phone size={17} />} inputMode="numeric" label="WhatsApp number (+91)" onChange={(value) => updateField('whatsappNumber', cleanWhatsApp(value))} required value={form.whatsappNumber} />
              <TextField icon={<Linkedin size={17} />} label="LinkedIn URL" onChange={(value) => updateField('linkedinUrl', value)} placeholder="https://www.linkedin.com/in/your-profile" required type="url" value={form.linkedinUrl} />
              <PasswordField label="Password" onChange={(value) => updateField('password', value)} onToggle={() => setShowPassword((current) => !current)} required show={showPassword} value={form.password} />
              <PasswordField label="Confirm password" onChange={setConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} required show={showConfirmPassword} value={confirmPassword} />
            </div>

            <div className="pulse-profile-form__section">
              <div>
                <h2>Profile context</h2>
                <p className="pulse-form-note">This helps Pulse connect you to relevant people, clubs, and opportunities.</p>
              </div>
              <SelectField icon={<BriefcaseBusiness size={17} />} label="Current status" onChange={updateStatus} options={currentStatusOptions} value={form.currentStatus} />
              <TextField icon={<MapPin size={17} />} label="Current city" onChange={(value) => updateField('currentCity', value)} required value={form.currentCity ?? ''} />
              {isStudent ? (
                <>
                  <SelectField
                    icon={<Building2 size={17} />}
                    label="College / institution"
                    onChange={updateCollege}
                    options={[
                      ...collegeOptions.map((college) => ({ label: college.name, value: college.id })),
                      { label: 'Other - add my college manually', value: PULSE_OTHER_COLLEGE_ID }
                    ]}
                    value={collegeId}
                  />
                  {collegeId === PULSE_OTHER_COLLEGE_ID ? (
                    <TextField
                      icon={<Building2 size={17} />}
                      label="College name"
                      onChange={(value) => updateField('collegeName', value)}
                      required
                      value={form.collegeName ?? ''}
                    />
                  ) : null}
                  <SelectField icon={<GraduationCap size={17} />} label="Year of education" onChange={(value) => updateField('educationYear', value)} options={educationYearOptions.map((year) => ({ label: year, value: year }))} value={form.educationYear ?? ''} />
                </>
              ) : null}
              {isWorking ? (
                <>
                  <TextField icon={<Building2 size={17} />} label="Current company" onChange={(value) => updateField('companyName', value)} required value={form.companyName ?? ''} />
                  <TextField icon={<BriefcaseBusiness size={17} />} label="Current role" onChange={(value) => updateField('currentRole', value)} value={form.currentRole ?? ''} />
                </>
              ) : null}
              <fieldset className="pulse-access-role-group">
                <legend>Interested profile / role</legend>
                <div>
                  {interestedRoleOptions.map((role) => (
                    <label key={role}>
                      <input checked={selectedRoles.has(role)} onChange={() => toggleRole(role)} type="checkbox" />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {!isConfigured ? <p className="pulse-form-error">Pulse signup is not configured for this deployment yet.</p> : null}
            {status === 'failed' ? <p className="pulse-form-error">{errorMessage}</p> : null}
            <button className="pulse-button pulse-button--primary pulse-profile-form__submit" disabled={!isConfigured || status === 'submitting'} type="submit">
              <span>{status === 'submitting' ? 'Creating access...' : 'Create Pulse access'}</span>
              {status === 'submitting' ? <Loader2 size={18} /> : <ArrowRight size={18} />}
            </button>
            <p className="pulse-form-note pulse-access-form__signin">
              Already have an account? <Link to="/pulse/login">Sign in to Pulse</Link>
            </p>
          </form>
        )}
      </PulseCard>
    </section>
  );
}

function TextField({
  icon,
  inputMode,
  label,
  onChange,
  placeholder,
  required,
  type = 'text',
  value
}: {
  icon: ReactNode;
  inputMode?: 'numeric';
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label>
      <span>{label}{required ? ' *' : ''}</span>
      <div className="pulse-access-input">
        {icon}
        <input inputMode={inputMode} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} />
      </div>
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
    <label>
      <span>{label}{required ? ' *' : ''}</span>
      <div className="pulse-access-input pulse-access-input--password">
        <KeyRound size={17} />
        <input onChange={(event) => onChange(event.target.value)} required={required} type={show ? 'text' : 'password'} value={value} />
        <button aria-label={show ? 'Hide password' : 'Show password'} onClick={onToggle} type="button">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  );
}

function SelectField({
  icon,
  label,
  onChange,
  options,
  value
}: {
  icon: ReactNode;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label>
      <span>{label} *</span>
      <div className="pulse-access-input pulse-access-input--select">
        {icon}
        <select onChange={(event) => onChange(event.target.value)} required value={value}>
          <option disabled value="">
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

export { pulseAccessRequestPath };
