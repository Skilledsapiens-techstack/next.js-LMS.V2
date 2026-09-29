import { ClipboardCopy, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulseProfile,
  useAcceptPulseInvite,
  usePulseInvites,
  usePulseProfile,
  usePulseProfileDefaults,
  useStoredPulseInviteCode
} from '../features/usePulseCommunity';
import { PulseProfileOnboarding } from './PulseHomePage';

function referralLink(profile: PulseProfile) {
  if (typeof window === 'undefined') return `/pulse/invite/${profile.referral_code}`;
  return `${window.location.origin}/pulse/invite/${profile.referral_code}`;
}

export function PulseInvitePage() {
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const invitesQuery = usePulseInvites(profile);
  const storedInviteCode = useStoredPulseInviteCode();
  const acceptInvite = useAcceptPulseInvite();
  const [copied, setCopied] = useState(false);
  const [processedInviteCode, setProcessedInviteCode] = useState<string | null>(null);

  const inviteStats = useMemo(() => {
    const invites = invitesQuery.data ?? [];
    return {
      accepted: invites.filter((invite) => invite.status === 'accepted').length,
      pending: invites.filter((invite) => invite.status === 'pending').length,
      total: invites.length
    };
  }, [invitesQuery.data]);

  useEffect(() => {
    document.title = 'Invite Peers | SapiensPulse';
  }, []);

  useEffect(() => {
    if (!profile?.id || !storedInviteCode || processedInviteCode === storedInviteCode || acceptInvite.isPending) return;

    acceptInvite.mutate(storedInviteCode, {
      onSettled: () => setProcessedInviteCode(storedInviteCode)
    });
  }, [acceptInvite, processedInviteCode, profile?.id, storedInviteCode]);

  async function copyLink() {
    if (!profile) return;
    await navigator.clipboard?.writeText(referralLink(profile));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading invites</PulseBadge>
        <h1>Opening your referral space.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  return (
    <section className="pulse-invite-page">
      <div className="pulse-invite-page__header">
        <PulseBadge tone="coral">Invite-only growth</PulseBadge>
        <h1>Bring trusted peers into Pulse.</h1>
        <p>
          Share your referral link with students you trust, from your college or another campus. Their join activity
          stays connected to your profile while their college remains their own profile choice.
        </p>
      </div>

      {acceptInvite.isPending ? (
        <PulseCard className="pulse-invite-acceptance">
          <PulseBadge tone="gold">Invite</PulseBadge>
          <strong>Connecting your invite.</strong>
          <span>Your Pulse access is being linked to the peer who invited you.</span>
        </PulseCard>
      ) : acceptInvite.data ? (
        <PulseCard className={`pulse-invite-acceptance ${acceptInvite.data.accepted ? 'pulse-invite-acceptance--success' : 'pulse-invite-acceptance--notice'}`}>
          <PulseBadge tone={acceptInvite.data.accepted ? 'green' : 'gold'}>Invite</PulseBadge>
          <strong>{acceptInvite.data.accepted ? 'Invite connected.' : 'Invite note'}</strong>
          <span>{acceptInvite.data.message}</span>
        </PulseCard>
      ) : acceptInvite.error ? (
        <PulseCard className="pulse-invite-acceptance pulse-invite-acceptance--error">
          <PulseBadge tone="coral">Invite</PulseBadge>
          <strong>Invite not connected.</strong>
          <span>{acceptInvite.error.message}</span>
        </PulseCard>
      ) : null}

      <div className="pulse-invite-layout">
        <PulseCard className="pulse-invite-panel">
          <div className="pulse-invite-panel__code">
            <span>Your referral code</span>
            <strong>{profile.referral_code}</strong>
          </div>
          <button className="pulse-button pulse-button--primary" onClick={copyLink} type="button">
            <span>{copied ? 'Referral link copied' : 'Copy referral link'}</span>
            <ClipboardCopy size={18} />
          </button>
        </PulseCard>

        <div className="pulse-invite-stats">
          <PulseCard>
            <Users size={20} />
            <strong>{inviteStats.total}</strong>
            <span>Total invites</span>
          </PulseCard>
          <PulseCard>
            <UserPlus size={20} />
            <strong>{inviteStats.pending}</strong>
            <span>Pending</span>
          </PulseCard>
          <PulseCard>
            <ClipboardCopy size={20} />
            <strong>{inviteStats.accepted}</strong>
            <span>Accepted</span>
          </PulseCard>
        </div>
      </div>

      <PulseCard className="pulse-invite-history">
        <div className="pulse-invite-history__header">
          <h2>Invite activity</h2>
          <span>Tracked through your referral code</span>
        </div>
        {invitesQuery.isLoading ? <div className="pulse-feed-state">Loading invite activity.</div> : null}
        {invitesQuery.error ? <div className="pulse-feed-state pulse-feed-state--error">{invitesQuery.error.message}</div> : null}
        {invitesQuery.data?.length ? (
          invitesQuery.data.map((invite) => (
            <div className="pulse-invite-row" key={invite.id}>
              <div>
                <strong>{invite.invited_email || 'Referral link shared'}</strong>
                <span>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(invite.created_at))}</span>
              </div>
              <PulseBadge tone={invite.status === 'accepted' ? 'green' : 'gold'}>{invite.status}</PulseBadge>
            </div>
          ))
        ) : (
          <div className="pulse-feed-state">
            <strong>No invites tracked yet.</strong>
            <span>Copy your referral link and share it manually with trusted peers.</span>
          </div>
        )}
      </PulseCard>
    </section>
  );
}
