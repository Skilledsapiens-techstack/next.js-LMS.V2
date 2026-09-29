import { Bell, BriefcaseBusiness, CalendarClock, CheckCheck, FileStack, MessageCircle, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulseNotification,
  useMarkPulseNotificationsRead,
  usePulseNotifications,
  usePulseProfile
} from '../features/usePulseCommunity';

const notificationLabels: Record<PulseNotification['notification_type'], string> = {
  club_action: 'Club activity',
  club_membership: 'Membership',
  club_post: 'Club update',
  comment: 'Comment',
  connection_interest: 'Interest',
  invite_accepted: 'Invite',
  opportunity_status: 'Opportunity',
  reaction: 'Recognition',
  report_status: 'Moderation'
};

type NotificationFilter = 'all' | 'unread' | 'replies' | 'opportunities' | 'invites' | 'moderation';

const notificationFilters: Array<{ label: string; value: NotificationFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Replies', value: 'replies' },
  { label: 'Opportunities', value: 'opportunities' },
  { label: 'Invites & members', value: 'invites' },
  { label: 'Moderation', value: 'moderation' }
];

function notificationTone(type: PulseNotification['notification_type']) {
  if (type === 'club_action' || type === 'club_membership' || type === 'club_post') return 'gold';
  if (type === 'opportunity_status') return 'green';
  if (type === 'invite_accepted') return 'gold';
  if (type === 'report_status') return 'coral';
  return 'brand';
}

function notificationPostType(notification: PulseNotification) {
  return typeof notification.metadata.post_type === 'string' ? notification.metadata.post_type : null;
}

function notificationIcon(notification: PulseNotification) {
  const type = notification.notification_type;
  const postType = notificationPostType(notification);
  const linkPath = notification.link_path;

  if (type === 'comment') return MessageCircle;
  if (type === 'club_membership') return UserPlus;
  if (type === 'club_action') return Sparkles;
  if (type === 'club_post' && postType === 'event') return CalendarClock;
  if (type === 'club_post' && postType === 'opportunity') return BriefcaseBusiness;
  if (type === 'club_post') return FileStack;
  if (type === 'opportunity_status' || linkPath?.includes('/opportunities')) return BriefcaseBusiness;
  if (linkPath?.includes('resources')) return FileStack;
  if (type === 'invite_accepted') return UserPlus;
  if (type === 'report_status') return ShieldCheck;
  return Sparkles;
}

function notificationWorkflowLabel(notification: PulseNotification) {
  const postType = notificationPostType(notification);
  if (notification.notification_type === 'comment') return 'Reply or comment';
  if (notification.notification_type === 'opportunity_status') return 'Opportunity update';
  if (notification.notification_type === 'club_membership') return 'Membership update';
  if (notification.notification_type === 'club_action') return 'Club activity';
  if (notification.notification_type === 'club_post' && postType === 'event') return 'New event';
  if (notification.notification_type === 'club_post' && postType === 'resource') return 'New resource';
  if (notification.notification_type === 'club_post' && postType === 'opportunity') return 'New opportunity';
  if (notification.notification_type === 'invite_accepted') return 'Invite activity';
  if (notification.notification_type === 'report_status') return 'Moderation update';
  if (notification.link_path?.includes('resources')) return 'Resource activity';
  if (notification.link_path?.includes('/clubs')) return 'College workspace';
  return notificationLabels[notification.notification_type];
}

function notificationMatchesFilter(notification: PulseNotification, filter: NotificationFilter) {
  if (filter === 'all') return true;
  if (filter === 'unread') return !notification.read_at;
  if (filter === 'replies') return notification.notification_type === 'comment' || notification.notification_type === 'reaction';
  if (filter === 'opportunities') {
    return (
      notification.notification_type === 'opportunity_status' ||
      notificationPostType(notification) === 'opportunity' ||
      Boolean(notification.link_path?.includes('/opportunities'))
    );
  }
  if (filter === 'invites') return notification.notification_type === 'invite_accepted' || notification.notification_type === 'connection_interest' || notification.notification_type === 'club_membership';
  return notification.notification_type === 'report_status';
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  }).format(new Date(value));
}

export function PulseNotificationsPage() {
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profile = profileQuery.data;
  const notificationsQuery = usePulseNotifications(profile);
  const markRead = useMarkPulseNotificationsRead(profile);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  const unreadIds = useMemo(
    () => (notificationsQuery.data ?? []).filter((notification) => !notification.read_at).map((notification) => notification.id),
    [notificationsQuery.data]
  );
  const filterCounts = useMemo(
    () =>
      new Map<NotificationFilter, number>(
        notificationFilters.map((filter) => [
          filter.value,
          (notificationsQuery.data ?? []).filter((notification) => notificationMatchesFilter(notification, filter.value)).length
        ])
      ),
    [notificationsQuery.data]
  );
  const filteredNotifications = useMemo(
    () => (notificationsQuery.data ?? []).filter((notification) => notificationMatchesFilter(notification, activeFilter)),
    [activeFilter, notificationsQuery.data]
  );
  const workflowCounts = useMemo(() => {
    const notifications = notificationsQuery.data ?? [];
    return {
      opportunities: notifications.filter((notification) => notificationMatchesFilter(notification, 'opportunities')).length,
      replies: notifications.filter((notification) => notificationMatchesFilter(notification, 'replies')).length,
      unread: unreadIds.length,
      workspace: notifications.filter((notification) => notification.notification_type.startsWith('club_') || notification.link_path?.includes('/clubs')).length
    };
  }, [notificationsQuery.data, unreadIds.length]);

  useEffect(() => {
    document.title = 'Notifications | SapiensPulse';
  }, []);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Notifications</PulseBadge>
        <h1>Opening your Pulse updates.</h1>
      </section>
    );
  }

  if (!profile) {
    return <Navigate to="/pulse/home" replace />;
  }

  return (
    <section className="pulse-notifications-page">
      <div className="pulse-notifications-page__header">
        <PulseBadge tone="coral">Updates</PulseBadge>
        <h1>Your Pulse notifications.</h1>
        <p>Track replies, college workspace updates, opportunity movement, invites, and moderation responses in one place.</p>
      </div>

      <div className="pulse-notification-summary" aria-label="Notification workflow summary">
        <PulseCard>
          <Bell size={19} />
          <strong>{workflowCounts.unread}</strong>
          <span>Unread</span>
        </PulseCard>
        <PulseCard>
          <MessageCircle size={19} />
          <strong>{workflowCounts.replies}</strong>
          <span>Replies and reactions</span>
        </PulseCard>
        <PulseCard>
          <BriefcaseBusiness size={19} />
          <strong>{workflowCounts.opportunities}</strong>
          <span>Opportunity updates</span>
        </PulseCard>
        <PulseCard>
          <FileStack size={19} />
          <strong>{workflowCounts.workspace}</strong>
          <span>College workspace</span>
        </PulseCard>
      </div>

      <PulseCard className="pulse-notifications-shell">
        <div className="pulse-notifications-shell__top">
          <div>
            <Bell size={21} />
            <strong>{unreadIds.length ? `${unreadIds.length} unread updates` : 'All caught up'}</strong>
          </div>
          <button
            className="pulse-button pulse-button--ghost"
            disabled={!unreadIds.length || markRead.isPending}
            onClick={() => markRead.mutate(unreadIds)}
            type="button"
          >
            <span>{markRead.isPending ? 'Marking read' : 'Mark all read'}</span>
            <CheckCheck size={18} />
          </button>
        </div>

        <div className="pulse-notification-filters" aria-label="Notification filters">
          {notificationFilters.map((filter) => (
            <button
              className={activeFilter === filter.value ? 'is-active' : undefined}
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              type="button"
            >
              {filter.label}
              <span>{filterCounts.get(filter.value) ?? 0}</span>
            </button>
          ))}
        </div>

        {notificationsQuery.isLoading ? (
          <div className="pulse-feed-state">Loading your Pulse notifications.</div>
        ) : notificationsQuery.error ? (
          <div className="pulse-feed-state pulse-feed-state--error">{notificationsQuery.error.message}</div>
        ) : filteredNotifications.length ? (
          <div className="pulse-notification-list">
            {filteredNotifications.map((notification) => {
              const Icon = notificationIcon(notification);
              return (
                <article
                  className={notification.read_at ? 'pulse-notification-row' : 'pulse-notification-row pulse-notification-row--unread'}
                  key={notification.id}
                >
                  <span className="pulse-notification-row__icon">
                    <Icon size={18} />
                  </span>
                  <div>
                    <PulseBadge tone={notificationTone(notification.notification_type)}>
                      {notificationWorkflowLabel(notification)}
                    </PulseBadge>
                    <h2>{notification.title}</h2>
                    {notification.body ? <p>{notification.body}</p> : null}
                    <span>{formatNotificationTime(notification.created_at)}{notification.read_at ? '' : ' · Unread'}</span>
                  </div>
                  <span className="pulse-notification-row__actions">
                    {!notification.read_at ? (
                      <button disabled={markRead.isPending} onClick={() => markRead.mutate([notification.id])} type="button">
                        Mark read
                      </button>
                    ) : null}
                    {notification.link_path ? (
                      <Link className="pulse-inline-link" to={notification.link_path} onClick={() => !notification.read_at && markRead.mutate([notification.id])}>
                        Open
                      </Link>
                    ) : null}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="pulse-feed-state">
            <strong>{notificationsQuery.data?.length ? 'No notifications match this filter.' : 'No notifications yet.'}</strong>
            <span>{notificationsQuery.data?.length ? 'Switch filters to see replies, opportunity updates, invites, or all notifications.' : 'When classmates respond, recognize your posts, join through your invite, or an opportunity moves, it will appear here.'}</span>
          </div>
        )}
      </PulseCard>
    </section>
  );
}
