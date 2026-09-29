import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseButton, PulseCard } from '../components';
import { rememberPulseInviteCode } from '../features/usePulseCommunity';
import { pulseAccessRequestPath } from './PulseAccessRequestPage';

export function PulseInviteLandingPage() {
  const { code } = useParams();
  const { status } = useAuth();
  const isSignedIn = status === 'authenticated';
  const accessRequestUrl = pulseAccessRequestPath(code);

  useEffect(() => {
    document.title = 'Pulse Invite | Skilled Sapiens';
  }, []);

  useEffect(() => {
    rememberPulseInviteCode(code);
  }, [code]);

  return (
    <section className="pulse-invite-landing">
      <div className="pulse-invite-landing__copy">
        <PulseBadge tone="coral">Pulse invite</PulseBadge>
        <h1>You have been invited to SapiensPulse.</h1>
        <p>
          Join the student community layer of Skilled Sapiens to connect with college peers, share ideas, build
          recognition, and discover live projects or freelance opportunities.
        </p>
        <div className="pulse-hero__actions">
          {isSignedIn ? (
            <PulseButton to="/pulse/home">Enter Pulse</PulseButton>
          ) : (
            <>
              <PulseButton to={accessRequestUrl}>Create access request</PulseButton>
              <PulseButton to="/pulse/login" variant="ghost">Already invited? Sign in</PulseButton>
            </>
          )}
        </div>
      </div>

      <PulseCard className="pulse-invite-landing__card">
        <span className="pulse-invite-landing__code">{code || 'PULSE'}</span>
        <strong>Invite-led access keeps Pulse useful.</strong>
        <p>
          Use this invite to join a trusted student circle. After you create your Pulse profile, your own referral code
          will be available inside the app.
        </p>
        <div>
          <span><Users size={17} /> Student community, not a formal classroom feed</span>
          <span><ShieldCheck size={17} /> Anonymous to peers, accountable to moderation</span>
          <span><UserPlus size={17} /> Referrals stay tied to student profiles</span>
        </div>
      </PulseCard>
    </section>
  );
}
