import {
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  Flame,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Vote
} from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseButton, PulseFeatureCard, PulseMetricCard } from '../components';

const pulseBenefits = [
  {
    description: 'Each college can have its own verified spaces for clubs, committees, domain circles, events, polls, resources, and student updates.',
    icon: MessageCircle,
    title: 'College communities that feel real'
  },
  {
    description: 'Marketing, Finance, Consulting, Product, HR, and other campus clubs can run their own member spaces instead of scattering updates everywhere.',
    icon: Users,
    title: 'Club workspaces inside each college'
  },
  {
    description: 'Club events, AMAs, workshops, polls, live projects, freelance tasks, and competitions can reach the right students by college and interest.',
    icon: BriefcaseBusiness,
    title: 'Opportunities tied to student intent'
  },
  {
    description: 'Helpful answers, event participation, club contributions, shout-outs, and project wins can build a visible student profile over time.',
    icon: Award,
    title: 'Recognition that compounds'
  }
];

const insidePulse = [
  'College-specific club workspaces for domain communities such as Marketing, Finance, Consulting, Product, HR, and more',
  'Club posts, announcements, resources, events, polls, discussions, and opportunity drops in one place',
  'Interest-based access so students join the spaces that match their goals and domains',
  'My college and Pulse-wide feeds for the right mix of local relevance and wider student discovery',
  'Student profiles with skills, interests, projects, club activity, shout-outs, and college identity',
  'Invite-led access, moderation, and referral tracking so the community stays trusted'
];

const communitySignals = [
  { label: 'College-specific spaces for verified club communities', value: 'Club hubs' },
  { label: 'Announcements, events, polls, resources, and discussions', value: 'Active feed' },
  { label: 'Participation turns into profile visibility and opportunities', value: 'Career signal' }
];

const studentUseCases = [
  'Join your college’s club spaces based on domains you actually care about.',
  'Follow club announcements, event calendars, polls, discussions, and useful resources.',
  'Ask seniors, peers, and club teams practical questions before making career choices.',
  'Find teammates for live projects, competitions, case work, and campus initiatives.',
  'Give shout-outs to people who help, lead, create, organize, or perform.',
  'Move from community discovery into My Learning when you need structured Skilled Sapiens support.'
];

export function PulseLandingPage() {
  const { getLmsHandoffUrl, status } = useAuth();
  const isSignedIn = status === 'authenticated';
  const lmsLearningUrl = getLmsHandoffUrl('/learning-access');

  useEffect(() => {
    document.title = 'SapiensPulse | Skilled Sapiens';
  }, []);

  return (
    <>
      <section className="pulse-hero">
        <div className="pulse-hero__copy">
          <PulseBadge tone="coral">SapiensPulse by Skilled Sapiens</PulseBadge>
          <h1>
            Your college clubs,
            <span> communities, and career opportunities in one place.</span>
          </h1>
          <p>
            Pulse gives every college a trusted student network where clubs can run focused workspaces, share events,
            launch polls, drop opportunities, and help students build visible proof of participation.
          </p>
          <div className="pulse-hero__actions">
            {isSignedIn ? (
              <>
                <PulseButton to="/pulse/home">Enter Pulse</PulseButton>
                <PulseButton href={lmsLearningUrl} variant="ghost">Open My Learning</PulseButton>
              </>
            ) : (
              <>
                <PulseButton to="/pulse/access-request">Get invited to Pulse</PulseButton>
                <PulseButton to="/pulse/login" variant="ghost">Sign in to explore feed</PulseButton>
              </>
            )}
          </div>
          <div className="pulse-hero__trust">
            <span><ShieldCheck size={16} /> College-first spaces with moderation boundaries</span>
            <span><LockKeyhole size={16} /> Join clubs by interest, domain, and college context</span>
          </div>
        </div>

        <div className="pulse-hero__product" aria-label="SapiensPulse student experience">
          <div className="pulse-live-strip">
            <Flame size={18} />
            <span>Happening on Pulse</span>
          </div>
          <div className="pulse-showcase-card pulse-showcase-card--wide">
            <div>
              <PulseBadge tone="brand">IIM Ranchi Marketing Club</PulseBadge>
              <strong>Which brand teardown should we host this week?</strong>
              <p>Members are voting between D2C growth, luxury positioning, creator marketing, and campus launch strategy.</p>
            </div>
            <span className="pulse-showcase-meter">Active poll</span>
          </div>
          <div className="pulse-showcase-grid">
            <div className="pulse-showcase-card">
              <Sparkles size={20} />
              <strong>Club event</strong>
              <span>Finance club AMA with seniors opens for second-year students</span>
            </div>
            <div className="pulse-showcase-card">
              <BriefcaseBusiness size={20} />
              <strong>Opportunity drop</strong>
              <span>Market research sprint shared with marketing members first</span>
            </div>
          </div>
          <div className="pulse-showcase-card pulse-showcase-card--dark">
            <Award size={20} />
            <div>
              <strong>Recognition wall</strong>
              <span>Club contributors, event hosts, project wins, and useful answers get visible</span>
            </div>
          </div>
        </div>
      </section>

      <section className="pulse-metrics" aria-label="SapiensPulse community model">
        {communitySignals.map((item) => (
          <PulseMetricCard key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="pulse-section" id="why-join">
        <div className="pulse-section__header">
          <PulseBadge tone="coral">Why join</PulseBadge>
          <h2>Built for the student side of campus life.</h2>
          <p>
            Pulse gives colleges and their clubs a cleaner home for student activity, while still connecting that
            activity to learning, projects, opportunities, and career readiness.
          </p>
        </div>
        <div className="pulse-feature-grid">
          {pulseBenefits.map((benefit) => (
            <PulseFeatureCard key={benefit.title} {...benefit} />
          ))}
        </div>
      </section>

      <section className="pulse-split-section" id="inside-pulse">
        <div>
          <PulseBadge tone="green">Inside Pulse</PulseBadge>
          <h2>College-first spaces. Club-led activity. Career upside built in.</h2>
          <p>
            Students can keep club and college conversations focused while strong ideas, useful contributions, and
            career signals can still travel across the wider Pulse network.
          </p>
        </div>
        <div className="pulse-check-list">
          {insidePulse.map((item) => (
            <span key={item}>
              <CheckCircle2 size={18} />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="pulse-callout-band" id="invite-only">
        <div>
          <PulseBadge tone="gold">Invite-led access</PulseBadge>
          <h2>Pulse grows through trusted college and club circles.</h2>
          <p>
            Every student gets a profile and referral code. Clubs can build focused communities for students who care
            about a domain, while invite-led access keeps the broader network trusted.
          </p>
        </div>
        <div className="pulse-invite-stack">
          <span><Users size={18} /> College and club spaces for verified student members</span>
          <span><Vote size={18} /> Polls, posts, events, resources, and opportunity drops</span>
          <span><Eye size={18} /> Community activity connected to student visibility</span>
        </div>
      </section>

      <section className="pulse-section pulse-section--use-cases">
        <div className="pulse-section__header">
          <PulseBadge tone="brand">What students do here</PulseBadge>
          <h2>From club participation to visible student growth.</h2>
          <p>
            Pulse turns everyday student participation into a more useful campus network: clearer communities, better
            discovery, stronger career signals, and a smooth bridge into the Skilled Sapiens learning ecosystem.
          </p>
        </div>
        <div className="pulse-use-case-grid">
          {studentUseCases.map((item) => (
            <span key={item}>
              <CheckCircle2 size={18} />
              {item}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
