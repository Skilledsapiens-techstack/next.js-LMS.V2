import { BadgeCheck, BriefcaseBusiness, GraduationCap, Mail, Palette, Phone, Save, ShieldCheck, Sparkles, UserRoundCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard, PulseTagSelector } from '../components';
import {
  PulseProfileInput,
  usePulseColleges,
  usePulseProfile,
  usePulseProfileDefaults,
  useSavePulseProfile
} from '../features/usePulseCommunity';
import {
  PULSE_OTHER_COLLEGE_ID,
  buildPulseCollegeOptions,
  getPulseCollegeOptionName
} from '../lib/collegeOptions';
import { normalizeLinkedInProfileUrl } from '../lib/linkedin';
import { pulseInterestOptions, pulseSkillOptions } from '../lib/profileOptions';

const avatarPresets = [
  { bg: '#ffe7e5', hair: '#1f2937', id: 'campus-woman', name: 'Campus Woman', skin: '#b56b45', top: '#d4362e', variant: 'bob' },
  { bg: '#fff4cf', hair: '#302018', id: 'finance-man', name: 'Finance Man', skin: '#c98255', top: '#1f2937', variant: 'short' },
  { bg: '#dff8ea', hair: '#0f3d3a', id: 'mentor-woman', name: 'Mentor Woman', skin: '#8f563a', top: '#0f766e', variant: 'long' },
  { bg: '#e7edf5', hair: '#111827', id: 'builder-man', name: 'Builder Man', skin: '#d59668', top: '#d4362e', variant: 'curly' },
  { bg: '#f9e1e0', hair: '#3b2418', id: 'creator-woman', name: 'Creator Woman', skin: '#d99a74', top: '#f4c542', variant: 'bun' },
  { bg: '#eef2ff', hair: '#111827', id: 'consulting-man', name: 'Consulting Man', skin: '#a76545', top: '#334155', variant: 'side' },
  { bg: '#ecfeff', hair: '#4a2c1a', id: 'research-woman', name: 'Research Woman', skin: '#c27b52', top: '#0891b2', variant: 'wave' },
  { bg: '#fef3c7', hair: '#171717', id: 'product-man', name: 'Product Man', skin: '#e0a06f', top: '#b91c1c', variant: 'fade' }
];

function avatarDataUrl(preset: (typeof avatarPresets)[number], displayName: string) {
  const initials = (displayName.trim() || 'Pulse').slice(0, 1).toUpperCase();
  const hair =
    preset.variant === 'bob'
      ? '<path d="M47 76c0-30 17-48 42-48 23 0 39 17 39 48v17H47z" fill="HAIR"/>'
      : preset.variant === 'long'
        ? '<path d="M42 83c0-36 19-58 46-58s46 22 46 58c0 29-14 50-22 58H64c-8-8-22-29-22-58z" fill="HAIR"/>'
        : preset.variant === 'bun'
          ? '<circle cx="88" cy="30" r="18" fill="HAIR"/><path d="M48 75c0-28 16-45 40-45s40 17 40 45v16H48z" fill="HAIR"/>'
          : preset.variant === 'curly'
            ? '<circle cx="52" cy="59" r="14" fill="HAIR"/><circle cx="68" cy="42" r="17" fill="HAIR"/><circle cx="91" cy="37" r="19" fill="HAIR"/><circle cx="115" cy="52" r="16" fill="HAIR"/><path d="M50 66c5-23 23-34 44-31 19 3 31 15 35 35l-4 19H55z" fill="HAIR"/>'
            : preset.variant === 'side'
              ? '<path d="M50 63c7-27 27-39 52-35 16 3 28 13 34 29-24 0-42-6-58-18-8 8-17 13-28 15z" fill="HAIR"/>'
              : preset.variant === 'wave'
                ? '<path d="M44 80c0-31 20-52 47-52 22 0 37 13 43 35-28-6-52-1-77 15v41H44z" fill="HAIR"/>'
                : preset.variant === 'fade'
                  ? '<path d="M51 59c8-24 27-34 51-30 18 3 30 13 35 28-30 1-53-5-76-18z" fill="HAIR"/>'
                  : '<path d="M51 58c8-24 26-35 49-30 20 4 32 17 35 38-27 0-50-8-72-23z" fill="HAIR"/>';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="34" fill="${preset.bg}"/>
      <circle cx="128" cy="32" r="13" fill="#f4c542"/>
      <path d="M34 145c6-31 27-49 55-49s49 18 55 49" fill="${preset.top}"/>
      <path d="M58 138h60l-6-26H64z" fill="#ffffff" opacity=".18"/>
      ${hair.replaceAll('HAIR', preset.hair)}
      <circle cx="88" cy="76" r="36" fill="${preset.skin}"/>
      <path d="M57 69c18-1 35-8 51-22 8 10 16 16 26 20-3-27-21-43-47-43-24 0-42 17-44 45z" fill="${preset.hair}" opacity=".95"/>
      <circle cx="76" cy="80" r="4" fill="#1f2937"/>
      <circle cx="101" cy="80" r="4" fill="#1f2937"/>
      <path d="M81 99c6 5 14 5 20 0" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>
      <circle cx="43" cy="124" r="14" fill="#ffffff"/>
      <text x="43" y="130" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="900" fill="#d4362e">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function completionScore(form: {
  avatarUrl?: string | null;
  bio: string;
  collegeId: string;
  collegeName: string;
  displayName: string;
  headline: string;
  interests: string[];
  linkedinUrl: string;
  skills: string[];
}) {
  const checks = [
    form.avatarUrl,
    form.displayName.trim(),
    form.headline.trim(),
    form.linkedinUrl.trim(),
    form.collegeId === PULSE_OTHER_COLLEGE_ID ? form.collegeName.trim() : form.collegeId.trim(),
    form.skills.length,
    form.interests.length,
    form.bio.trim()
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function formatContactNumber(value: unknown) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

export function PulseProfilePage() {
  const { session, status } = useAuth();
  const profileQuery = usePulseProfile();
  const collegesQuery = usePulseColleges();
  const defaults = usePulseProfileDefaults();
  const saveProfile = useSavePulseProfile();
  const profile = profileQuery.data;
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [form, setForm] = useState({
    avatarUrl: null as string | null,
    bio: '',
    collegeId: '',
    collegeName: '',
    displayName: '',
    headline: '',
    interests: [] as string[],
    linkedinUrl: '',
    skills: [] as string[]
  });
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    document.title = 'Edit Pulse Profile | Skilled Sapiens';
  }, []);

  useEffect(() => {
    setForm({
      avatarUrl: profile?.avatar_url ?? null,
      bio: profile?.bio ?? defaults.bio ?? '',
      collegeId: profile?.college_id ?? defaults.collegeId ?? '',
      collegeName: profile?.college?.name ?? defaults.collegeName ?? '',
      displayName: profile?.display_name ?? defaults.displayName,
      headline: profile?.headline ?? defaults.headline ?? '',
      interests: (profile?.interests ?? defaults.interests).slice(0, 5),
      linkedinUrl: profile?.linkedin_url ?? defaults.linkedinUrl ?? '',
      skills: (profile?.skills ?? defaults.skills).slice(0, 5)
    });
  }, [defaults, profile]);

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError('');
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
      avatarUrl: form.avatarUrl,
      bio: form.bio,
      collegeId: form.collegeId,
      collegeName: form.collegeName,
      displayName: form.displayName,
      headline: form.headline,
      interests: form.interests.slice(0, 5),
      linkedinUrl,
      skills: form.skills.slice(0, 5)
    });
  }

  const previewSkills = form.skills.slice(0, 4);
  const previewInterests = form.interests.slice(0, 4);
  const collegeOptions = buildPulseCollegeOptions(collegesQuery.data ?? []);
  const skillOptions = Array.from(new Set([...form.skills, ...pulseSkillOptions])).sort((a, b) => a.localeCompare(b));
  const interestOptions = Array.from(new Set([...form.interests, ...pulseInterestOptions])).sort((a, b) => a.localeCompare(b));
  const selectedCollegeName =
    form.collegeId === PULSE_OTHER_COLLEGE_ID ? form.collegeName.trim() : getPulseCollegeOptionName(collegeOptions, form.collegeId);
  const score = completionScore(form);
  const accountEmail = session?.user.email ?? '';
  const contactNumber = formatContactNumber(session?.user.user_metadata?.whatsapp_number);

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading profile</PulseBadge>
        <h1>Opening your Pulse profile.</h1>
      </section>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  return (
    <section className="pulse-profile-page">
      <div className="pulse-profile-page__header">
        <div>
          <PulseBadge tone="coral">Pulse profile</PulseBadge>
          <h1>Build your student identity on Pulse.</h1>
          <p>
            Your profile helps peers, mentors, and opportunity reviewers understand what you are learning, building,
            and open to collaborating on.
          </p>
        </div>
        <div className="pulse-profile-score-card">
          <span>Profile strength</span>
          <strong>{score}%</strong>
          <div aria-hidden="true"><span style={{ width: `${score}%` }} /></div>
        </div>
      </div>

      <div className="pulse-profile-workspace">
        <aside className="pulse-profile-preview-panel">
          <PulseCard className="pulse-profile-preview-card">
            <div className="pulse-profile-preview-card__cover" />
            <div className="pulse-profile-preview-card__avatar">
              {form.avatarUrl ? (
                <img alt="" src={form.avatarUrl} />
              ) : (
                <span>{(form.displayName.trim() || 'P').slice(0, 1).toUpperCase()}</span>
              )}
              <button className="pulse-profile-avatar-upload" onClick={() => setAvatarPickerOpen((current) => !current)} type="button">
                <Palette size={16} />
                <span>Choose avatar</span>
              </button>
            </div>
            {avatarPickerOpen ? (
              <div className="pulse-profile-avatar-picker" aria-label="Choose a Pulse avatar">
                {avatarPresets.map((preset) => {
                  const avatarUrl = avatarDataUrl(preset, form.displayName);
                  return (
                    <button
                      className={form.avatarUrl === avatarUrl ? 'is-active' : ''}
                      key={preset.id}
                      onClick={() => {
                        setForm({ ...form, avatarUrl });
                        setAvatarPickerOpen(false);
                      }}
                      title={preset.name}
                      type="button"
                    >
                      <img alt="" src={avatarUrl} />
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="pulse-profile-preview-card__body">
              <PulseBadge tone="green">Visible on Pulse</PulseBadge>
              <h2>{form.displayName.trim() || 'Your name'}</h2>
              <p>{form.headline.trim() || 'Add a headline that tells people what you are exploring.'}</p>
              <div className="pulse-profile-preview-card__meta">
                {accountEmail ? <span><Mail size={16} /> {accountEmail}</span> : null}
                {contactNumber ? <span><Phone size={16} /> {contactNumber}</span> : null}
                <span><GraduationCap size={16} /> {selectedCollegeName || 'Select college space'}</span>
                <span><BriefcaseBusiness size={16} /> Open to projects, sessions, and collaboration</span>
              </div>
              <div className="pulse-profile-preview-card__tags">
                {[...previewSkills, ...previewInterests].length ? (
                  [...previewSkills, ...previewInterests].slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)
                ) : (
                  <span>Add skills and interests</span>
                )}
              </div>
              {form.bio.trim() ? <p className="pulse-profile-preview-card__bio">{form.bio}</p> : null}
            </div>
          </PulseCard>

          <div className="pulse-profile-guidance">
            <span><BadgeCheck size={18} /> Strong profiles get better peer discovery.</span>
            <span><Sparkles size={18} /> Skills help match you with projects and mentorship.</span>
            <span><ShieldCheck size={18} /> Verified members can discover your profile in People.</span>
          </div>
        </aside>

        <PulseCard className="pulse-profile-card">
          <form className="pulse-profile-form" onSubmit={submitProfile}>
            <div className="pulse-profile-form__section">
              <div>
                <PulseBadge tone="brand">Basic details</PulseBadge>
                <h2>How students recognize you</h2>
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

              {accountEmail ? (
                <label>
                  <span>Email</span>
                  <input readOnly value={accountEmail} />
                </label>
              ) : null}

              {contactNumber ? (
                <label>
                  <span>Contact number</span>
                  <input readOnly value={contactNumber} />
                </label>
              ) : null}

              <label>
                <span>Headline</span>
                <input
                  onChange={(event) => setForm({ ...form, headline: event.target.value })}
                  placeholder="MBA student · Finance · Case competitions"
                  value={form.headline}
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
                      collegeName:
                        collegeId === PULSE_OTHER_COLLEGE_ID ? '' : getPulseCollegeOptionName(collegeOptions, collegeId)
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

            </div>

            <div className="pulse-profile-form__section">
              <div>
                <PulseBadge tone="gold">Skills and interests</PulseBadge>
                <h2>What you want to be discovered for</h2>
              </div>
              <PulseTagSelector
                label="Skills"
                onChange={(skills) => setForm({ ...form, skills })}
                options={skillOptions}
                placeholder="Select up to 5 skills"
                value={form.skills}
              />

              <PulseTagSelector
                label="Interests"
                onChange={(interests) => setForm({ ...form, interests })}
                options={interestOptions}
                placeholder="Select up to 5 interests"
                value={form.interests}
              />

              <label className="pulse-profile-form__wide">
                <span>Bio</span>
                <textarea
                  onChange={(event) => setForm({ ...form, bio: event.target.value })}
                  placeholder="Share what you are building, exploring, or looking to collaborate on."
                  rows={5}
                  value={form.bio}
                />
              </label>
            </div>

            {profile?.referral_code ? (
              <div className="pulse-profile-referral">
                <UserRoundCheck size={18} />
                <span>Your referral code: <strong>{profile.referral_code}</strong></span>
              </div>
            ) : null}

            {profileError ? <p className="pulse-form-error">{profileError}</p> : null}
            {saveProfile.error ? <p className="pulse-form-error">{saveProfile.error.message}</p> : null}
            {saveProfile.isSuccess ? <p className="pulse-form-success">Profile updated.</p> : null}

            <div className="pulse-profile-form__actions">
              <Link className="pulse-button pulse-button--ghost" to="/pulse/home">Back to Pulse</Link>
              <button className="pulse-button pulse-button--primary" disabled={saveProfile.isPending} type="submit">
                <span>{saveProfile.isPending ? 'Saving' : 'Save profile'}</span>
                <Save size={18} />
              </button>
            </div>
          </form>
        </PulseCard>
      </div>
    </section>
  );
}
