import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Link as LinkIcon,
  Mic2,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Video,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulseMentorshipSession,
  PulseMentorshipSessionInput,
  PulseMentorshipSessionType,
  PulseProfile,
  useCreatePulseMentorshipSession,
  usePulseMentorshipRsvps,
  usePulseMentorshipSessions,
  usePulseProfile,
  usePulseProfileDefaults,
  useTogglePulseMentorshipRsvp
} from '../features/usePulseCommunity';
import { PulseProfileOnboarding } from './PulseHomePage';

const sessionTypeLabels: Record<PulseMentorshipSessionType, string> = {
  ama: 'AMA',
  career_session: 'Career session',
  one_on_one: '1-1 mentoring',
  resume_review: 'Resume review',
  workshop: 'Workshop'
};

const mentorshipFilters: Array<{ label: string; value: 'all' | PulseMentorshipSessionType | 'college' }> = [
  { label: 'Upcoming', value: 'all' },
  { label: 'Workshops', value: 'workshop' },
  { label: 'Resume Review', value: 'resume_review' },
  { label: '1-1', value: 'one_on_one' },
  { label: 'My college', value: 'college' }
];

function getSampleMentorshipSessions(profile?: PulseProfile | null): PulseMentorshipSession[] {
  const collegeName = profile?.college?.name ?? 'SapiensPulse QA College';
  const collegeId = profile?.college_id ?? null;

  return [
    {
      college_id: null,
      college_name: null,
      created_at: '2026-09-09T04:30:00.000Z',
      description:
        'A hands-on workshop for students who want to turn scattered internship or project experience into a sharper finance resume story.',
      ends_at: '2026-09-13T12:30:00.000Z',
      host_display_name: 'Anaya Verma',
      host_headline: 'Equity Research Associate and Skilled Sapiens mentor',
      host_profile_id: 'sample-mentor-anaya',
      id: 'sample-resume-review-finance',
      max_seats: 45,
      meeting_platform: 'google_meet',
      meeting_url: null,
      rsvp_count: 18,
      session_type: 'resume_review',
      starts_at: '2026-09-13T11:30:00.000Z',
      status: 'published',
      title: 'Finance Resume Review Clinic',
      topic: 'Resume review, finance internships, profile storytelling',
      visibility: 'global'
    },
    {
      college_id: collegeId,
      college_name: collegeName,
      created_at: '2026-09-09T04:35:00.000Z',
      description:
        'A college-first workshop on how to select live projects, split team roles, define scope, and submit work that looks credible.',
      ends_at: '2026-09-14T14:15:00.000Z',
      host_display_name: 'Rahi',
      host_headline: 'Finance Leadership Program student',
      host_profile_id: profile?.id ?? 'sample-mentor-rahi',
      id: 'sample-live-project-sprint',
      max_seats: 60,
      meeting_platform: 'zoom',
      meeting_url: null,
      rsvp_count: 26,
      session_type: 'workshop',
      starts_at: '2026-09-14T13:00:00.000Z',
      status: 'published',
      title: 'How to Win Your First Live Project Sprint',
      topic: 'Live projects, teamwork, research, submission quality',
      visibility: collegeId ? 'college' : 'global'
    },
    {
      college_id: null,
      college_name: null,
      created_at: '2026-09-09T04:40:00.000Z',
      description:
        'An open AMA for students confused between finance, marketing, consulting, analytics, and startup projects.',
      ends_at: '2026-09-15T15:30:00.000Z',
      host_display_name: 'Kabir Mehta',
      host_headline: 'Alumni mentor and campus hiring volunteer',
      host_profile_id: 'sample-mentor-kabir',
      id: 'sample-career-clarity-ama',
      max_seats: 80,
      meeting_platform: 'google_meet',
      meeting_url: null,
      rsvp_count: 34,
      session_type: 'ama',
      starts_at: '2026-09-15T14:30:00.000Z',
      status: 'published',
      title: 'Career Clarity AMA for First-Year MBA Students',
      topic: 'Domain clarity, internships, choosing the right projects',
      visibility: 'global'
    }
  ];
}

function isSampleMentorshipSession(sessionId: string) {
  return sessionId.startsWith('sample-');
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  }).format(new Date(value));
}

function sessionDateParts(value: string) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat('en-IN', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date),
    time: new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date)
  };
}

function mentorshipErrorMessage(message: string) {
  if (/pulse_mentorship|get_pulse_mentorship_sessions|schema cache/i.test(message)) {
    return 'Mentorship setup is still being applied. Please apply the Pulse mentorship SQL, then refresh this page.';
  }

  return message;
}

function PulseMentorshipSessionCard({
  profile,
  rsvpId,
  rsvpStatus,
  session
}: {
  profile: PulseProfile;
  rsvpId?: string;
  rsvpStatus?: string;
  session: PulseMentorshipSession;
}) {
  const toggleRsvp = useTogglePulseMentorshipRsvp(profile);
  const isAdminWorkshop = session.source_type === 'admin_workshop';
  const isSample = isSampleMentorshipSession(session.id);
  const isRsvped = rsvpStatus === 'rsvped' || rsvpStatus === 'attended';
  const seatsLabel = isAdminWorkshop ? 'Pulse workshop' : session.max_seats ? `${session.rsvp_count}/${session.max_seats} seats` : `${session.rsvp_count} joined`;
  const isHost = profile.id === session.host_profile_id;
  const dateParts = sessionDateParts(session.starts_at);

  return (
    <PulseCard className="pulse-mentorship-card">
      <div className="pulse-mentorship-card__top">
        <div className="pulse-mentorship-card__date" aria-label={formatSessionTime(session.starts_at)}>
          <strong>{dateParts.day}</strong>
          <span>{dateParts.month}</span>
        </div>
        <div>
          <PulseBadge tone="green">{sessionTypeLabels[session.session_type]}</PulseBadge>
          <span>
            {isSample ? 'Sample · ' : ''}
            {isAdminWorkshop ? 'Admin workshop · ' : ''}
            {session.visibility === 'global' ? 'Across Pulse' : session.college_name ?? 'My college'}
          </span>
        </div>
      </div>
      <div className="pulse-mentorship-card__body">
        <h2>{session.title}</h2>
        <p>{session.description}</p>
      </div>
      <div className="pulse-mentorship-card__meta">
        <span><GraduationCap size={16} /> {session.host_display_name || 'Pulse mentor'}</span>
        <span><CalendarClock size={16} /> {dateParts.time}</span>
        <span><UsersRound size={16} /> {seatsLabel}</span>
      </div>
      <div className="pulse-mentorship-card__topic">
        <Sparkles size={16} />
        <span>{session.topic}</span>
      </div>
      <div className="pulse-mentorship-card__actions">
        <Link className="pulse-button pulse-button--secondary" to={`/pulse/mentorship/${session.id}`}>
          <span>View details</span>
          <ExternalLink size={16} />
        </Link>
        {session.meeting_url ? (
          <a className="pulse-mentorship-meeting-link" href={session.meeting_url} rel="noreferrer" target="_blank">
            <Video size={17} /> Join session <ExternalLink size={14} />
          </a>
        ) : null}
        {!isAdminWorkshop ? (
          <button
            className={isRsvped ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--primary'}
            disabled={toggleRsvp.isPending || isHost || isSample}
            onClick={() => toggleRsvp.mutate({ rsvpId, sessionId: session.id, shouldCancel: isRsvped })}
            type="button"
          >
            <span>
              {isSample
                ? 'Sample preview'
                : isHost
                  ? 'You are hosting'
                  : toggleRsvp.isPending
                    ? 'Saving'
                    : isRsvped
                      ? 'Cancel RSVP'
                      : 'RSVP free'}
            </span>
            <CheckCircle2 size={18} />
          </button>
        ) : null}
      </div>
      {toggleRsvp.error ? <p className="pulse-form-error">{toggleRsvp.error.message}</p> : null}
    </PulseCard>
  );
}

function PulseMentorshipHostForm({ canPostToCollege, onClose }: { canPostToCollege: boolean; onClose: () => void }) {
  const profileQuery = usePulseProfile();
  const createSession = useCreatePulseMentorshipSession(profileQuery.data);
  const [form, setForm] = useState<PulseMentorshipSessionInput>({
    description: '',
    endsAt: '',
    maxSeats: '40',
    meetingPlatform: 'google_meet',
    meetingUrl: '',
    sessionType: 'workshop',
    startsAt: '',
    title: '',
    topic: '',
    visibility: canPostToCollege ? 'college' : 'global'
  });

  function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createSession.mutate(form, {
      onSuccess: () =>
        setForm({
          description: '',
          endsAt: '',
          maxSeats: '40',
          meetingPlatform: 'google_meet',
          meetingUrl: '',
          sessionType: 'workshop',
          startsAt: '',
          title: '',
          topic: '',
          visibility: canPostToCollege ? 'college' : 'global'
        })
    });
  }

  return (
    <div className="pulse-mentorship-host-card">
      <div className="pulse-mentorship-modal__header">
        <div>
          <PulseBadge tone="coral">Host free session</PulseBadge>
          <h2>Contribute back to the student community.</h2>
          <p>Submit a workshop, resume review, 1-1 room, or topic session. Admin approval keeps the calendar useful.</p>
        </div>
        <button aria-label="Close host session form" className="pulse-icon-button" onClick={onClose} type="button">
          <X size={20} />
        </button>
      </div>
      <form className="pulse-mentorship-form" onSubmit={submitSession}>
        <label>
          <span>Session title</span>
          <input
            minLength={3}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Resume review for finance internships"
            required
            value={form.title}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            onChange={(event) => setForm({ ...form, sessionType: event.target.value as PulseMentorshipSessionType })}
            value={form.sessionType}
          >
            {Object.entries(sessionTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Topic</span>
          <input
            onChange={(event) => setForm({ ...form, topic: event.target.value })}
            placeholder="Resume, consulting, Excel, finance, interviews"
            required
            value={form.topic}
          />
        </label>
        <label>
          <span>Audience</span>
          <select
            onChange={(event) => setForm({ ...form, visibility: event.target.value as PulseMentorshipSessionInput['visibility'] })}
            value={form.visibility}
          >
            <option disabled={!canPostToCollege} value="college">My college</option>
            <option value="global">Across Pulse</option>
          </select>
        </label>
        <label>
          <span>Starts at</span>
          <input
            onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            required
            type="datetime-local"
            value={form.startsAt}
          />
        </label>
        <label>
          <span>Ends at</span>
          <input
            onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            type="datetime-local"
            value={form.endsAt}
          />
        </label>
        <label>
          <span>Seats</span>
          <input
            min={1}
            max={500}
            onChange={(event) => setForm({ ...form, maxSeats: event.target.value })}
            type="number"
            value={form.maxSeats}
          />
        </label>
        <label>
          <span>Meeting platform</span>
          <select
            onChange={(event) => setForm({ ...form, meetingPlatform: event.target.value as PulseMentorshipSessionInput['meetingPlatform'] })}
            value={form.meetingPlatform}
          >
            <option value="google_meet">Google Meet</option>
            <option value="zoom">Zoom</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="pulse-mentorship-form__wide">
          <span>Meeting link</span>
          <input
            onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })}
            placeholder="Paste Google Meet or Zoom link"
            type="url"
            value={form.meetingUrl}
          />
        </label>
        <label className="pulse-mentorship-form__wide">
          <span>Description</span>
          <textarea
            minLength={10}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Tell students who should join, what you will cover, and what they should bring."
            required
            rows={4}
            value={form.description}
          />
        </label>
        {createSession.error ? <p className="pulse-form-error">{mentorshipErrorMessage(createSession.error.message)}</p> : null}
        {createSession.isSuccess ? <p className="pulse-form-success">Session submitted for admin approval.</p> : null}
        <button className="pulse-button pulse-button--primary pulse-mentorship-form__submit" disabled={createSession.isPending} type="submit">
          <span>{createSession.isPending ? 'Submitting' : 'Submit session'}</span>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

function PulseMentorshipSubNav() {
  return (
    <nav className="pulse-mentorship-subnav" aria-label="Sapiens Mentorship sections">
      <NavLink end to="/pulse/mentorship">
        Get Mentorship
      </NavLink>
      <NavLink to="/pulse/mentorship/become">
        Become a Mentor
      </NavLink>
    </nav>
  );
}

export function PulseMentorshipPage() {
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const sessionsQuery = usePulseMentorshipSessions(profile);
  const rsvpsQuery = usePulseMentorshipRsvps(profile);
  const [activeFilter, setActiveFilter] = useState<(typeof mentorshipFilters)[number]['value']>('all');
  const [query, setQuery] = useState('');
  const sampleSessions = useMemo(() => getSampleMentorshipSessions(profile), [profile]);
  const allSessions = useMemo(() => [...(sessionsQuery.data ?? []), ...sampleSessions], [sampleSessions, sessionsQuery.data]);

  const rsvpMap = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    (rsvpsQuery.data ?? []).forEach((rsvp) => map.set(rsvp.session_id, { id: rsvp.id, status: rsvp.status }));
    return map;
  }, [rsvpsQuery.data]);

  const sessions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return allSessions.filter((session) => {
      const matchesFilter =
        activeFilter === 'all'
        || session.session_type === activeFilter
        || (activeFilter === 'college' && session.visibility === 'college');
      const matchesQuery = !cleanQuery
        || session.title.toLowerCase().includes(cleanQuery)
        || session.topic.toLowerCase().includes(cleanQuery)
        || session.description.toLowerCase().includes(cleanQuery)
        || (session.host_display_name ?? '').toLowerCase().includes(cleanQuery)
        || (session.college_name ?? '').toLowerCase().includes(cleanQuery);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, allSessions, query]);

  useEffect(() => {
    document.title = 'Mentorship | SapiensPulse';
  }, []);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Mentorship</PulseBadge>
        <h1>Opening free sessions.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  return (
    <section className="pulse-mentorship-page">
      <PulseMentorshipSubNav />
      <div className="pulse-mentorship-hero">
        <div>
          <PulseBadge tone="coral">Sapiens Mentorship</PulseBadge>
          <h1>Find free guidance from seniors, mentors, alumni, and skilled peers.</h1>
          <p>
            Discover free sessions that help you make better student decisions: resume reviews, domain clarity,
            interview prep, project guidance, AMAs, and workshops from verified Pulse contributors.
          </p>
        </div>
        <div className="pulse-mentorship-hero__cards" aria-label="Mentorship highlights">
          <span><ShieldCheck size={18} /> Verified sessions before students join</span>
          <span><GraduationCap size={18} /> Learn from relevant seniors, alumni, and mentors</span>
          <span><LinkIcon size={18} /> RSVP free and access the session link</span>
        </div>
      </div>

      <div className="pulse-mentorship-vision-grid">
        <PulseCard className="pulse-mentorship-vision-card pulse-mentorship-vision-card--wide">
          <PulseBadge tone="gold">Why use it?</PulseBadge>
          <h2>Get practical answers before you waste weeks guessing.</h2>
          <p>
            Use Sapiens Mentorship to ask better questions, understand career paths, improve your resume, prepare for
            interviews, and learn from people who have already navigated similar decisions.
          </p>
        </PulseCard>
        <PulseCard className="pulse-mentorship-vision-card">
          <Mic2 size={24} />
          <h3>Focused sessions</h3>
          <p>Join sessions around specific student needs: resumes, projects, domains, interviews, and campus decisions.</p>
        </PulseCard>
        <PulseCard className="pulse-mentorship-vision-card">
          <ShieldCheck size={24} />
          <h3>Trusted hosts</h3>
          <p>Admin approval helps students trust who is hosting and whether the guidance is relevant.</p>
        </PulseCard>
      </div>

      <PulseCard className="pulse-mentorship-controls">
        <div className="pulse-opportunity-search">
          <Sparkles size={19} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics, mentors, colleges, or session types"
            value={query}
          />
        </div>
        <div className="pulse-opportunity-tabs" aria-label="Mentorship filters">
          {mentorshipFilters.map((filter) => (
            <button
              className={activeFilter === filter.value ? 'is-active' : ''}
              disabled={filter.value === 'college' && !profile.college_id}
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </PulseCard>

      {sessionsQuery.isLoading ? (
        <div className="pulse-feed-state">Loading mentorship sessions.</div>
      ) : sessions.length ? (
        <div className="pulse-mentorship-grid">
          {sessions.map((session) => {
            const rsvp = rsvpMap.get(session.id);
            return (
              <PulseMentorshipSessionCard
                key={session.id}
                profile={profile}
                rsvpId={rsvp?.id}
                rsvpStatus={rsvp?.status}
                session={session}
              />
            );
          })}
        </div>
      ) : sessionsQuery.error ? (
        <div className="pulse-feed-state pulse-feed-state--error">{mentorshipErrorMessage(sessionsQuery.error.message)}</div>
      ) : (
        <div className="pulse-feed-state">
          <strong>No mentorship sessions found.</strong>
          <span>Try another filter or submit a free session for admin approval.</span>
        </div>
      )}

    </section>
  );
}

export function PulseMentorshipDetailPage() {
  const { sessionId } = useParams();
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const sessionsQuery = usePulseMentorshipSessions(profile);
  const rsvpsQuery = usePulseMentorshipRsvps(profile);
  const sampleSessions = useMemo(() => getSampleMentorshipSessions(profile), [profile]);
  const allSessions = useMemo(() => [...(sessionsQuery.data ?? []), ...sampleSessions], [sampleSessions, sessionsQuery.data]);
  const session = allSessions.find((item) => item.id === sessionId);
  const rsvp = (rsvpsQuery.data ?? []).find((item) => item.session_id === sessionId);
  const toggleRsvp = useTogglePulseMentorshipRsvp(profile);
  const isRsvped = rsvp?.status === 'rsvped' || rsvp?.status === 'attended';
  const isSample = sessionId ? isSampleMentorshipSession(sessionId) : false;
  const isHost = Boolean(profile && session && profile.id === session.host_profile_id);

  useEffect(() => {
    document.title = session ? `${session.title} | Sapiens Mentorship` : 'Mentorship Session | SapiensPulse';
  }, [session]);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading session</PulseBadge>
        <h1>Opening workshop details.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  if (!session) {
    return (
      <section className="pulse-mentorship-page">
        <Link className="pulse-back-link" to="/pulse/mentorship"><ArrowLeft size={18} /> Back to mentorship</Link>
        <div className="pulse-feed-state pulse-feed-state--error">
          <strong>Session not found.</strong>
          <span>This workshop may have been removed, archived, or not approved yet.</span>
        </div>
      </section>
    );
  }

  const isAdminWorkshop = session.source_type === 'admin_workshop';
  const seatsLabel = isAdminWorkshop ? 'Pulse workshop' : session.max_seats ? `${session.rsvp_count}/${session.max_seats} seats reserved` : `${session.rsvp_count} students joined`;
  const agendaItems = [
    `Why this topic matters for students right now`,
    `Examples and walkthroughs from ${session.host_display_name ?? 'the mentor'}`,
    'Live questions from students',
    'Next steps students can take after the session'
  ];

  return (
    <section className="pulse-mentorship-page pulse-mentorship-detail-page">
      <Link className="pulse-back-link" to="/pulse/mentorship"><ArrowLeft size={18} /> Back to mentorship</Link>
      <div className="pulse-mentorship-detail-hero">
        <div>
          <PulseBadge tone={isSample ? 'gold' : 'green'}>{isSample ? 'Sample workshop' : sessionTypeLabels[session.session_type]}</PulseBadge>
          <h1>{session.title}</h1>
          <p>{session.description}</p>
          <div className="pulse-mentorship-card__meta">
            <span><GraduationCap size={16} /> {session.host_display_name || 'Pulse mentor'}</span>
            <span><CalendarClock size={16} /> {formatSessionTime(session.starts_at)}</span>
            <span><UsersRound size={16} /> {seatsLabel}</span>
          </div>
        </div>
        <PulseCard className="pulse-mentorship-detail-action-card">
          <PulseBadge tone="coral">{session.visibility === 'global' ? 'Across Pulse' : session.college_name ?? 'My college'}</PulseBadge>
          <strong>{isAdminWorkshop ? 'Join this Pulse workshop.' : 'Reserve your learning seat.'}</strong>
          <p>
            {isAdminWorkshop
              ? 'This workshop is managed by Skilled Sapiens and visible inside Pulse.'
              : isSample
                ? 'This is a sample preview. Real approved sessions will allow students to RSVP here.'
                : 'RSVP free and keep the session visible in your Pulse activity.'}
          </p>
          {!isAdminWorkshop ? (
            <button
              className={isRsvped ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--primary'}
              disabled={toggleRsvp.isPending || isHost || isSample}
              onClick={() => toggleRsvp.mutate({ rsvpId: rsvp?.id, sessionId: session.id, shouldCancel: isRsvped })}
              type="button"
            >
              <span>
                {isSample
                  ? 'Sample preview'
                  : isHost
                    ? 'You are hosting'
                    : toggleRsvp.isPending
                      ? 'Saving'
                      : isRsvped
                        ? 'Cancel RSVP'
                        : 'RSVP free'}
              </span>
              <CheckCircle2 size={18} />
            </button>
          ) : null}
          {session.meeting_url ? (
            <a className="pulse-mentorship-meeting-link" href={session.meeting_url} rel="noreferrer" target="_blank">
              <Video size={17} /> Join session <ExternalLink size={14} />
            </a>
          ) : null}
          {toggleRsvp.error ? <p className="pulse-form-error">{toggleRsvp.error.message}</p> : null}
        </PulseCard>
      </div>

      <div className="pulse-mentorship-detail-grid">
        <PulseCard className="pulse-mentorship-detail-card">
          <PulseBadge tone="gold">What you will learn</PulseBadge>
          <h2>Session agenda</h2>
          <div className="pulse-mentorship-detail-list">
            {agendaItems.map((item) => <span key={item}><CheckCircle2 size={17} /> {item}</span>)}
          </div>
        </PulseCard>
        <PulseCard className="pulse-mentorship-detail-card">
          <PulseBadge tone="coral">Mentor signal</PulseBadge>
          <h2>{session.host_display_name || 'Pulse mentor'}</h2>
          <p>{session.host_headline || 'Verified Pulse contributor'}</p>
          <div className="pulse-mentorship-detail-list">
            <span><Sparkles size={17} /> Topic: {session.topic}</span>
            <span><Video size={17} /> Platform: {session.meeting_platform === 'google_meet' ? 'Google Meet' : session.meeting_platform === 'zoom' ? 'Zoom' : 'External link'}</span>
            <span><ShieldCheck size={17} /> Status: {isSample ? 'Preview sample' : 'Approved on Pulse'}</span>
          </div>
        </PulseCard>
      </div>
    </section>
  );
}

export function PulseBecomeMentorPage() {
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState('what');

  useEffect(() => {
    document.title = 'Become a Mentor | SapiensPulse';
  }, []);

  useEffect(() => {
    document.body.style.overflow = isHostModalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isHostModalOpen]);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Mentorship</PulseBadge>
        <h1>Opening mentor contribution space.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  const faqItems = [
    {
      answer: 'Skilled Sapiens Mentorship is where experienced professionals, alumni, founders, seniors, and strong peer contributors guide learners through practical career decisions.',
      id: 'what',
      question: 'Who can become a mentor?'
    },
    {
      answer: 'Use the host session flow in Pulse. Add a focused topic, timing, seats, and meeting link. The Skilled Sapiens team reviews the session before it becomes visible to students.',
      id: 'how',
      question: 'How do I start mentoring on Pulse?'
    },
    {
      answer: 'You can host 1:1 guidance, workshops, masterclasses, profile reviews, placement sessions, domain AMAs, or campus-focused learning sessions.',
      id: 'criteria',
      question: 'What formats can I host?'
    },
    {
      answer: 'Pulse currently keeps the in-platform session flow contribution-first and reviewed. Commercial or special mentor opportunities can be handled separately by the Skilled Sapiens team.',
      id: 'paid',
      question: 'Can I host paid workshops?'
    }
  ];

  const mentorBenefits = [
    {
      description: 'Build visibility through thoughtful sessions that students can discover and remember.',
      title: 'Personal brand'
    },
    {
      description: 'Connect with ambitious students, alumni, founders, and industry contributors.',
      title: 'Relevant network'
    },
    {
      description: 'Turn your experience into practical support that helps learners make better moves.',
      title: 'Visible impact'
    }
  ];

  const mentorFormats = [
    {
      detail: 'Support learners with career direction, domain clarity, and next-step decisions.',
      title: '1:1 guidance'
    },
    {
      detail: 'Host practical workshops and masterclasses using the existing Pulse session flow.',
      title: 'Workshops'
    },
    {
      detail: 'Run campus sessions for resumes, interviews, live projects, and placement readiness.',
      title: 'Campus sessions'
    },
    {
      detail: 'Review resumes, LinkedIn profiles, project stories, and interview preparation.',
      title: 'Profile reviews'
    }
  ];

  const mentorDomains = [
    'Finance',
    'Consulting',
    'Sales & Marketing',
    'HR',
    'Product Management',
    'Entrepreneurship',
    'Placement Readiness',
    'Corporate Leadership'
  ];

  return (
    <section className="pulse-mentorship-page pulse-become-mentor-page">
      <PulseMentorshipSubNav />

      <div className="pulse-become-mentor-hero">
        <div>
          <PulseBadge tone="coral">Become a Skilled Sapiens Mentor</PulseBadge>
          <h1>Share your expertise. Mentor future leaders.</h1>
          <p>
            Join a mentor network of professionals, alumni, founders, and strong contributors helping learners with practical career guidance inside Pulse.
          </p>
          <div className="pulse-become-mentor-hero__actions">
            <button className="pulse-button pulse-button--primary" onClick={() => setIsHostModalOpen(true)} type="button">
              <span>Host a session</span>
              <Mic2 size={18} />
            </button>
            <Link className="pulse-button pulse-button--secondary" to="/pulse/mentorship">
              <span>View live sessions</span>
              <CalendarClock size={18} />
            </Link>
          </div>
          <div className="pulse-become-mentor-hero__bullets" aria-label="Mentor benefits">
            <span><CheckCircle2 size={16} /> Build your personal brand</span>
            <span><CheckCircle2 size={16} /> Host workshops and masterclasses</span>
            <span><CheckCircle2 size={16} /> Network with industry experts</span>
            <span><CheckCircle2 size={16} /> Guide ambitious learners</span>
          </div>
        </div>
        <PulseCard className="pulse-become-mentor-proof-card">
          <span><ShieldCheck size={18} /> Skilled Sapiens network</span>
          <strong>Practical mentorship. Real impact.</strong>
          <p>Every Pulse session is reviewed for clarity, relevance, and student value before it goes live.</p>
          <div className="pulse-become-mentor-proof-card__stats">
            <span><b>80+</b><small>Industry mentors</small></span>
            <span><b>10K+</b><small>Community members</small></span>
            <span><b>1:1</b><small>Guidance support</small></span>
            <span><b>Multi-domain</b><small>Expert network</small></span>
          </div>
        </PulseCard>
      </div>

      <div className="pulse-become-mentor-metrics" aria-label="Mentor contribution benefits">
        <PulseCard>
          <Sparkles size={22} />
          <strong>Corporate leaders</strong>
          <span>Share practical lessons from real functions, roles, and decision-making moments.</span>
        </PulseCard>
        <PulseCard>
          <UsersRound size={22} />
          <strong>Alumni and founders</strong>
          <span>Help learners understand career paths, interviews, business thinking, and execution.</span>
        </PulseCard>
        <PulseCard>
          <GraduationCap size={22} />
          <strong>Strong peer mentors</strong>
          <span>Guide juniors through internships, projects, placements, and profile building.</span>
        </PulseCard>
      </div>

      <div className="pulse-become-mentor-section">
        <div>
          <PulseBadge tone="gold">Why mentor with us</PulseBadge>
          <h2>Grow your reach while creating meaningful impact.</h2>
          <p>Mentorship on Pulse is designed to feel useful, specific, and student-first. Host when your experience can help someone make a sharper next move.</p>
        </div>
        <div className="pulse-become-mentor-benefit-cards">
          {mentorBenefits.map((benefit) => (
            <PulseCard key={benefit.title}>
              <CheckCircle2 size={18} />
              <strong>{benefit.title}</strong>
              <span>{benefit.description}</span>
            </PulseCard>
          ))}
        </div>
      </div>

      <div className="pulse-become-mentor-section">
        <div>
          <PulseBadge tone="green">Ways to contribute</PulseBadge>
          <h2>Choose a mentorship format that works for you.</h2>
          <p>Keep the commitment flexible. Host a focused session, workshop, review, or recurring mentorship format based on your availability.</p>
        </div>
        <div className="pulse-become-mentor-format-grid">
          {mentorFormats.map((format) => (
            <PulseCard key={format.title}>
              <Mic2 size={18} />
              <strong>{format.title}</strong>
              <span>{format.detail}</span>
            </PulseCard>
          ))}
        </div>
      </div>

      <div className="pulse-become-mentor-section pulse-become-mentor-section--process">
        <div>
          <PulseBadge tone="coral">How it works</PulseBadge>
          <h2>Start mentoring in four steps.</h2>
        </div>
        <div className="pulse-become-mentor-steps">
          <PulseCard><b>1</b><strong>Apply</strong><span>Add your profile, expertise, and session idea.</span></PulseCard>
          <PulseCard><b>2</b><strong>Review</strong><span>Skilled Sapiens checks fit and student value.</span></PulseCard>
          <PulseCard><b>3</b><strong>Go live</strong><span>Students discover the session and RSVP.</span></PulseCard>
          <PulseCard><b>4</b><strong>Create impact</strong><span>Guide learners with practical, actionable support.</span></PulseCard>
        </div>
      </div>

      <div className="pulse-become-mentor-section">
        <div>
          <PulseBadge tone="gold">Domain network</PulseBadge>
          <h2>Mentor across high-value career tracks.</h2>
          <p>Bring your expertise into the areas learners actively explore for internships, placements, projects, and career decisions.</p>
        </div>
        <div className="pulse-become-mentor-topics">
          {mentorDomains.map((topic) => <span key={topic}>{topic}</span>)}
        </div>
      </div>

      <PulseCard className="pulse-mentorship-cta-card">
        <div>
          <PulseBadge tone="gold">Ready to mentor?</PulseBadge>
          <h2>Join the mentor network and help learners make stronger decisions.</h2>
          <p>Submit a session for review and start contributing through Pulse.</p>
        </div>
        <button className="pulse-button pulse-button--primary" onClick={() => setIsHostModalOpen(true)} type="button">
          <span>Host a session</span>
          <Mic2 size={18} />
        </button>
      </PulseCard>

      <div className="pulse-become-mentor-faq">
        <h2>Frequently asked questions</h2>
        {faqItems.map((item) => (
          <button
            aria-expanded={openFaq === item.id}
            className={openFaq === item.id ? 'is-open' : ''}
            key={item.id}
            onClick={() => setOpenFaq(openFaq === item.id ? '' : item.id)}
            type="button"
          >
            <span>
              <strong>{item.question}</strong>
              {openFaq === item.id ? <small>{item.answer}</small> : null}
            </span>
            <b>{openFaq === item.id ? '-' : '+'}</b>
          </button>
        ))}
      </div>

      {isHostModalOpen ? (
        <div className="pulse-mentorship-modal" role="dialog" aria-modal="true" aria-label="Host a free mentorship session">
          <div className="pulse-mentorship-modal__backdrop" onClick={() => setIsHostModalOpen(false)} />
          <div className="pulse-mentorship-modal__panel">
            <PulseMentorshipHostForm canPostToCollege={Boolean(profile.college_id)} onClose={() => setIsHostModalOpen(false)} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
