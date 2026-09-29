import {
  ArrowLeft,
  ArrowRight,
  Archive,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  FileStack,
  FileText,
  Gauge,
  LayoutDashboard,
  Link as LinkIcon,
  Megaphone,
  MessageCircle,
  Pencil,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  UsersRound
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseButton, PulseCard } from '../components';
import {
  PulseClub,
  PulseClubAccent,
  PulseClubMembership,
  PulseClubMembershipActivityItem,
  PulseClubNotificationAuditItem,
  PulseClubPost,
  PulsePost,
  PulsePostInput,
  PulsePostInteractionSummary,
  PulseProfile,
  PulseOpportunity,
  useArchivePulseClubPost,
  useCreatePulseComment,
  useCreatePulseClubPost,
  useCreatePulsePost,
  useMarkPulseOpportunityInterest,
  usePulseCollegeClubMembers,
  usePulseCollegeClubPosts,
  usePulseCollegeOpportunities,
  usePulseClubPendingMembers,
  usePulseClubDetail,
  usePulseClubMemberships,
  usePulseClubMembershipActivity,
  usePulseClubNotificationAudit,
  usePulseClubPostActions,
  usePulseClubPostActionSummary,
  usePulseClubPosts,
  usePulseCollegeClubs,
  usePulseFeed,
  usePulseOpportunityApplications,
  usePulsePostInteractions,
  usePulseProfile,
  usePulseProfileDefaults,
  useSendPulseClubTestNotification,
  useTogglePulseClubPostAction,
  useTogglePulsePostReaction,
  useTogglePulseClubMembership,
  useUpdatePulseClubMembershipStatus,
  useUpdatePulseClubPost
} from '../features/usePulseCommunity';
import { PulseProfileOnboarding } from './PulseHomePage';

type CollegeWorkspaceSection = 'overview' | 'clubs' | 'events' | 'resources' | 'opportunities' | 'discussions' | 'members' | 'announcements';
type ClubContentTab = 'events' | 'resources' | 'opportunities' | 'members';
type ClubAdminPreviewMode = 'student' | 'admin';
type ClubAdminPanel = 'dashboard' | 'publish' | 'content' | 'members' | 'notifications' | 'student';
type ClubFeedFilter = 'all' | 'active' | 'expired' | 'drafts' | 'archived' | 'announcements' | 'discussions' | 'events' | 'resources' | 'opportunities';
type ClubFeedSort = 'newest' | 'oldest' | 'edited' | 'status';
type CampusDiscussionFilter = 'recent' | 'popular' | 'unanswered' | 'polls';
type CollegeResourceFilter = 'all' | 'saved' | 'useful' | 'recent';
type CollegeOpportunityFilter = 'all' | 'interested' | 'open' | 'deadline';
type CollegeEventSort = 'date' | 'newest' | 'club';
type CollegeResourceSort = 'newest' | 'saved' | 'club' | 'type';
type CollegeOpportunitySort = 'deadline' | 'newest' | 'interested' | 'club';
type CollegeQuickAccessKind = 'club' | 'event' | 'opportunity' | 'resource';
type CollegeQuickAccessItem = {
  kind: CollegeQuickAccessKind;
  key: string;
  meta: string;
  timestamp: number;
  title: string;
  to: string;
};
type ClubComposerTemplate = {
  body: string;
  eventAgendaItems?: string;
  eventDate?: string;
  eventLocation?: string;
  eventMode?: string;
  eventPrepItems?: string;
  eventTime?: string;
  label: string;
  opportunityBriefItems?: string;
  opportunityDeadline?: string;
  opportunityFitItems?: string;
  postType: 'announcement' | 'event' | 'resource' | 'opportunity';
  resourcePreviewItems?: string;
  resourceType?: string;
  resourceUrl?: string;
  resourceUsageItems?: string;
  title: string;
  announcementContextItems?: string;
  announcementNextActions?: string;
};
type ClubComposerDraft = {
  announcementContextItems: string;
  announcementNextActions: string;
  eventAgendaItems: string;
  eventDate: string;
  eventLocation: string;
  eventMode: string;
  eventPrepItems: string;
  eventTime: string;
  opportunityBriefItems: string;
  opportunityDeadline: string;
  opportunityFitItems: string;
  postBody: string;
  postStatus: 'draft' | 'published';
  postTitle: string;
  postType: 'announcement' | 'event' | 'resource' | 'opportunity';
  resourcePreviewItems: string;
  resourceType: string;
  resourceUrl: string;
  resourceUsageItems: string;
  savedAt: number;
};
type PendingNotificationPublishAction =
  | { kind: 'create'; metadata: Record<string, unknown> }
  | { kind: 'edit'; metadata: Record<string, unknown>; postId: string };
type PendingClubArchiveAction =
  | { kind: 'single'; post: PulseClubPost }
  | { kind: 'bulk'; posts: PulseClubPost[] };
type PendingClubMemberStatusAction = {
  member: PulseClubMembership;
  nextStatus: PulseClubMembership['status'];
};
type PendingUnsavedEditAction = {
  action: () => void;
  label: string;
};
type NotificationPublishSuccess = {
  contentLabel: string;
  recipientCount: number;
};
type ClubArchiveSuccess = {
  count: number;
  undoPost?: PulseClubPost;
};
type ClubMemberActionSuccess = {
  actionLabel: string;
  memberName: string;
};
type ClubPostEditSuccess = {
  postId: string;
  postType: PulseClubPost['post_type'];
  title: string;
};

const pulsePostTypeLabels: Record<PulsePost['post_type'], string> = {
  announcement: 'Update',
  article: 'Idea',
  discussion: 'Ask / Discuss',
  opportunity: 'Opportunity',
  poll: 'Poll',
  recognition: 'Shout-out',
  shoutout: 'Shout-out'
};

const clubPostTypeLabels: Record<PulseClubPost['post_type'], string> = {
  announcement: 'Announcement',
  discussion: 'Discussion',
  event: 'Event',
  opportunity: 'Opportunity',
  poll: 'Poll',
  resource: 'Resource'
};

const clubContentTabValues: ClubContentTab[] = ['events', 'resources', 'opportunities', 'members'];

function normalizeClubContentTab(value: string | null): ClubContentTab {
  return clubContentTabValues.includes(value as ClubContentTab) ? (value as ClubContentTab) : 'events';
}

const clubAdminPanelValues: ClubAdminPanel[] = ['dashboard', 'publish', 'content', 'members', 'notifications', 'student'];

function normalizeClubAdminPanel(value: string | null): ClubAdminPanel {
  return clubAdminPanelValues.includes(value as ClubAdminPanel) ? (value as ClubAdminPanel) : 'dashboard';
}

const collegeWorkspaceSectionValues: CollegeWorkspaceSection[] = [
  'overview',
  'discussions',
  'clubs',
  'events',
  'opportunities',
  'resources',
  'announcements',
  'members'
];

function normalizeCollegeWorkspaceSection(value: string | null): CollegeWorkspaceSection {
  return collegeWorkspaceSectionValues.includes(value as CollegeWorkspaceSection)
    ? (value as CollegeWorkspaceSection)
    : 'overview';
}

function readClubPostDateMetadata(post: PulseClubPost) {
  const value = post.metadata.event_date ?? post.metadata.expires_at ?? post.metadata.closes_at ?? post.metadata.deadline;
  return typeof value === 'string' ? value : null;
}

function isClubPostExpired(post: PulseClubPost) {
  const dateValue = readClubPostDateMetadata(post);

  if (!dateValue) {
    return false;
  }

  const deadline = new Date(`${dateValue}T23:59:59`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return !Number.isNaN(deadline.getTime()) && deadline < today;
}

function matchesClubFeedFilter(post: PulseClubPost, filter: ClubFeedFilter) {
  if (filter === 'all') return true;
  if (filter === 'active') return post.status === 'published' && !isClubPostExpired(post);
  if (filter === 'expired') return post.status === 'published' && isClubPostExpired(post);
  if (filter === 'drafts') return post.status === 'draft';
  if (filter === 'archived') return post.status === 'archived';
  if (filter === 'announcements') return post.post_type === 'announcement';
  if (filter === 'discussions') return post.post_type === 'discussion' || post.post_type === 'poll';
  if (filter === 'events') return post.post_type === 'event';
  if (filter === 'resources') return post.post_type === 'resource';
  return post.post_type === 'opportunity';
}

function clubPostStatusLabel(status: PulseClubPost['status']) {
  if (status === 'draft') return 'Draft';
  if (status === 'archived') return 'Archived';
  if (status === 'hidden') return 'Hidden';
  if (status === 'under_review') return 'Under review';
  return 'Published';
}

function clubNotificationAuditLabel(item: PulseClubNotificationAuditItem) {
  const postType = typeof item.metadata.post_type === 'string' ? item.metadata.post_type : '';
  if (item.notification_type === 'club_membership') return 'Membership approved';
  if (item.notification_type === 'club_action') return 'Student action';
  if (item.notification_type === 'club_post' && postType === 'event') return 'Event sent';
  if (item.notification_type === 'club_post' && postType === 'resource') return 'Resource sent';
  if (item.notification_type === 'club_post' && postType === 'opportunity') return 'Opportunity sent';
  if (item.notification_type === 'comment') return 'Reply sent';
  if (item.notification_type === 'opportunity_status') return 'Opportunity status';
  return 'Notification sent';
}

function clubMembershipActivityLabel(item: PulseClubMembershipActivityItem) {
  if (item.action === 'approved') return 'Approved member';
  if (item.action === 'held') return 'Held request';
  if (item.action === 'paused') return 'Paused member';
  if (item.action === 'role_updated') return 'Updated role';
  if (item.action === 'title_updated') return 'Updated club title';
  return 'Updated membership';
}

function splitClubMetadataLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function clubMetadataLinesToText(value: unknown) {
  if (!Array.isArray(value)) return '';
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join('\n');
}

function readClubMetadataList(post: PulseClubPost, key: string, fallback: string[]) {
  const value = post.metadata[key];
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length ? items : fallback;
}

function clubMetadataListCount(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim().length > 0).length : 0;
}

function dateInputOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildClubPostQualityHints(type: PulseClubPost['post_type'], title: string, body: string, metadata: Record<string, unknown>) {
  const hints: string[] = [];
  if (title.trim().length < 12) hints.push('Use a specific title so students immediately understand the update.');
  if (body.trim().length < 80) hints.push('Add a little more context in Details so students know why this matters.');

  if (type === 'event') {
    if (!metadata.event_date) hints.push('Add the event date if it is already decided.');
    if (!metadata.event_time) hints.push('Add the time so students can plan around it.');
    if (!metadata.event_location) hints.push('Add a venue or joining link when available.');
    if (clubMetadataListCount(metadata, 'agenda_items') < 2) hints.push('Add at least two agenda items to set expectations.');
    if (clubMetadataListCount(metadata, 'prep_items') < 1) hints.push('Add one preparation note so students arrive ready.');
  }

  if (type === 'resource') {
    if (!metadata.resource_url) hints.push('Attach a resource link if the material lives outside Pulse.');
    if (clubMetadataListCount(metadata, 'resource_items') < 2) hints.push('Add two preview points explaining what the resource contains.');
    if (clubMetadataListCount(metadata, 'usage_items') < 1) hints.push('Add one best-use note so students know how to apply it.');
  }

  if (type === 'opportunity') {
    if (!metadata.deadline) hints.push('Add a deadline if students need to respond by a date.');
    if (clubMetadataListCount(metadata, 'opportunity_items') < 2) hints.push('Add two brief points covering scope, process, or next steps.');
    if (clubMetadataListCount(metadata, 'fit_items') < 1) hints.push('Add one good-fit note so the right students respond.');
  }

  if (type === 'announcement') {
    if (clubMetadataListCount(metadata, 'next_action_items') < 1) hints.push('Add one clear next action for students.');
    if (clubMetadataListCount(metadata, 'context_items') < 1) hints.push('Add one context note so the update feels grounded.');
  }

  return hints.slice(0, 5);
}

function buildClubPostPublishRequirements(type: PulseClubPost['post_type'], title: string, body: string, metadata: Record<string, unknown>) {
  const requirements = [
    { label: 'Specific title added', met: title.trim().length >= 12 },
    { label: 'Details explain what students should know', met: body.trim().length >= 80 }
  ];

  if (type === 'event') {
    requirements.push(
      { label: 'Event date added', met: Boolean(metadata.event_date) },
      { label: 'Time or session mode is clear', met: Boolean(metadata.event_time || metadata.event_mode) },
      { label: 'Venue or joining link added', met: Boolean(metadata.event_location) },
      { label: 'At least one agenda item added', met: clubMetadataListCount(metadata, 'agenda_items') >= 1 }
    );
  }

  if (type === 'resource') {
    requirements.push(
      { label: 'Resource type selected', met: Boolean(metadata.resource_type) },
      { label: 'Link or preview details added', met: Boolean(metadata.resource_url) || clubMetadataListCount(metadata, 'resource_items') >= 1 },
      { label: 'Best-use note added', met: clubMetadataListCount(metadata, 'usage_items') >= 1 }
    );
  }

  if (type === 'opportunity') {
    requirements.push(
      { label: 'Deadline added', met: Boolean(metadata.deadline) },
      { label: 'Opportunity brief added', met: clubMetadataListCount(metadata, 'opportunity_items') >= 1 },
      { label: 'Good-fit note added', met: clubMetadataListCount(metadata, 'fit_items') >= 1 }
    );
  }

  if (type === 'announcement') {
    requirements.push(
      { label: 'Student next action added', met: clubMetadataListCount(metadata, 'next_action_items') >= 1 },
      { label: 'Context note added', met: clubMetadataListCount(metadata, 'context_items') >= 1 }
    );
  }

  return requirements;
}

function buildClubPostPublishIssues(type: PulseClubPost['post_type'], title: string, body: string, metadata: Record<string, unknown>) {
  return buildClubPostPublishRequirements(type, title, body, metadata)
    .filter((item) => !item.met)
    .map((item) => item.label);
}

function buildClubPostConsistencyChecks(type: PulseClubPost['post_type'], metadata: Record<string, unknown>) {
  const checks: Array<{ label: string; met: boolean; surfaces: string }> = [];

  if (type === 'event') {
    checks.push(
      { label: 'Date appears on event card, detail page, and preview', met: Boolean(metadata.event_date), surfaces: 'Card · Detail · Preview' },
      { label: 'Time or mode is visible before students open the post', met: Boolean(metadata.event_time || metadata.event_mode), surfaces: 'Card · Detail · Preview' },
      { label: 'Venue or joining link is carried into the detail view', met: Boolean(metadata.event_location), surfaces: 'Card · Detail · Preview' },
      { label: 'Agenda gives the detail page enough structure', met: clubMetadataListCount(metadata, 'agenda_items') >= 1, surfaces: 'Detail · Preview' }
    );
  }

  if (type === 'resource') {
    checks.push(
      { label: 'Resource type appears on card and preview', met: Boolean(metadata.resource_type), surfaces: 'Card · Detail · Preview' },
      { label: 'Resource link is available from the student view', met: Boolean(metadata.resource_url), surfaces: 'Detail · Preview' },
      { label: 'Preview notes explain what is inside the resource', met: clubMetadataListCount(metadata, 'resource_items') >= 1, surfaces: 'Detail · Preview' },
      { label: 'Best-use notes explain how students should apply it', met: clubMetadataListCount(metadata, 'usage_items') >= 1, surfaces: 'Detail · Preview' }
    );
  }

  if (type === 'opportunity') {
    checks.push(
      { label: 'Deadline appears on opportunity card, detail page, and preview', met: Boolean(metadata.deadline), surfaces: 'Card · Detail · Preview' },
      { label: 'Opportunity brief explains scope and next steps', met: clubMetadataListCount(metadata, 'opportunity_items') >= 1, surfaces: 'Detail · Preview' },
      { label: 'Good-fit notes help the right students respond', met: clubMetadataListCount(metadata, 'fit_items') >= 1, surfaces: 'Detail · Preview' }
    );
  }

  return checks;
}

function clubPostSearchText(post: PulseClubPost) {
  const metadataText = Object.values(post.metadata)
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return [value];
      return [];
    })
    .join(' ');

  return [
    post.title,
    post.body,
    post.post_type,
    post.status,
    clubPostStatusLabel(post.status),
    post.author?.display_name,
    post.author?.headline,
    post.club?.name,
    metadataText
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function readClubPostAdminNote(post: PulseClubPost) {
  return typeof post.metadata.admin_note === 'string' ? post.metadata.admin_note : '';
}

function isSampleRecord(record?: { id?: string } | null) {
  return Boolean(record?.id?.startsWith('sample-'));
}

function clubPostTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortClubFeedPosts(posts: PulseClubPost[], sort: ClubFeedSort) {
  const statusOrder: Record<PulseClubPost['status'], number> = {
    draft: 0,
    published: 1,
    under_review: 2,
    hidden: 3,
    archived: 4
  };

  return [...posts].sort((left, right) => {
    if (sort === 'oldest') return clubPostTimestamp(left.created_at) - clubPostTimestamp(right.created_at);
    if (sort === 'edited') return clubPostTimestamp(right.updated_at ?? right.created_at) - clubPostTimestamp(left.updated_at ?? left.created_at);
    if (sort === 'status') {
      return statusOrder[left.status] - statusOrder[right.status] || clubPostTimestamp(right.created_at) - clubPostTimestamp(left.created_at);
    }
    return clubPostTimestamp(right.created_at) - clubPostTimestamp(left.created_at);
  });
}

function canBulkArchiveClubPost(post: PulseClubPost) {
  if (post.id.startsWith('sample-')) return false;
  return post.status === 'draft' || (post.status === 'published' && isClubPostExpired(post));
}

function buildClubPostDetailBlocks(post: PulseClubPost, sourceName: string) {
  const eventDate = typeof post.metadata.event_date === 'string' ? post.metadata.event_date : null;
  const eventTime = typeof post.metadata.event_time === 'string' ? post.metadata.event_time : null;
  const eventMode = typeof post.metadata.event_mode === 'string' ? post.metadata.event_mode : null;
  const eventLocation = typeof post.metadata.event_location === 'string' ? post.metadata.event_location : null;
  const resourceType = typeof post.metadata.resource_type === 'string' ? post.metadata.resource_type : null;
  const resourceUrl = typeof post.metadata.resource_url === 'string' ? post.metadata.resource_url : null;
  const deadline = readClubPostDateMetadata(post);

  if (post.post_type === 'event') {
    const agendaItems = readClubMetadataList(post, 'agenda_items', [
      'Opening context and goal-setting by the club team.',
      'Main working segment with examples, practice, or live discussion.',
      'Wrap-up with next steps, follow-up material, and open questions.'
    ]);
    const prepItems = readClubMetadataList(post, 'prep_items', [
      eventLocation || 'Venue or joining link will be shared by the club team.',
      eventMode ? `${eventMode} format` : 'Campus participation format',
      `Hosted by ${sourceName}`
    ]);

    return [
      {
        badge: 'Agenda',
        title: 'How the session will run',
        items: agendaItems
      },
      {
        badge: 'Join prepared',
        title: eventDate ? `${clubActivityDateLabel(eventDate)}${eventTime ? ` at ${eventTime}` : ''}` : 'Date and time will be confirmed',
        items: prepItems
      }
    ];
  }

  if (post.post_type === 'resource') {
    const resourceItems = readClubMetadataList(post, 'resource_items', [
      'Use this as a starting point before attending related sessions.',
      'Save it if you want it to appear in My Activity for later access.',
      resourceUrl ? 'External link is attached for the full material.' : 'Material context is available inside Pulse.'
    ]);
    const usageItems = readClubMetadataList(post, 'usage_items', [
      'Review the framework, template, or notes before practice.',
      'Discuss doubts with peers in the club workspace.',
      `Look for more resources from ${sourceName} if this is useful.`
    ]);

    return [
      {
        badge: 'Resource preview',
        title: resourceType || 'Learning material',
        items: resourceItems
      },
      {
        badge: 'Best use',
        title: 'How students can use it',
        items: usageItems
      }
    ];
  }

  if (post.post_type === 'opportunity') {
    const opportunityItems = readClubMetadataList(post, 'opportunity_items', [
      'Read the scope carefully before marking interest.',
      'Check whether this needs an individual response, team, or nomination.',
      'Use the club feed for selection updates and clarifications.'
    ]);
    const fitItems = readClubMetadataList(post, 'fit_items', [
      `Students actively following ${sourceName} activity.`,
      'Students who can commit time and communicate clearly.',
      'Students looking for visible campus contribution or project exposure.'
    ]);

    return [
      {
        badge: 'Opportunity brief',
        title: deadline ? `Act before ${clubActivityDateLabel(deadline)}` : 'Open for interested students',
        items: opportunityItems
      },
      {
        badge: 'Good fit',
        title: 'Who should consider this',
        items: fitItems
      }
    ];
  }

  const nextActionItems = readClubMetadataList(post, 'next_action_items', [
    'Read the full update and note any deadline or follow-up.',
    'Open the source club if you want related context.',
    'Check back for edits, replies, or a follow-up post.'
  ]);
  const contextItems = readClubMetadataList(post, 'context_items', [
    'This update is visible inside the college workspace.',
    'Students can use it to stay aligned with club activity.',
    'Related items from the same club appear below when available.'
  ]);

  return [
    {
      badge: 'Next actions',
      title: 'What students should do now',
      items: nextActionItems
    },
    {
      badge: 'Context',
      title: `Shared by ${sourceName}`,
      items: contextItems
    }
  ];
}

function pulsePostRelativeTime(value: string) {
  const createdAt = new Date(value).getTime();
  const diffMs = Date.now() - createdAt;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (Number.isNaN(createdAt)) return 'Recently';
  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d ago`;

  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function campusThreadActivityLabel(interaction?: PulsePostInteractionSummary) {
  const comments = interaction?.commentCount ?? 0;
  const reactions = interaction?.reactionCount ?? 0;

  if (comments >= 3) return 'Active campus thread';
  if (comments > 0) return 'Students are replying';
  if (reactions > 0) return 'Students noticed this';
  return 'Needs first useful reply';
}

const collegeWorkspaceSections: Array<{
  description: string;
  icon: typeof LayoutDashboard;
  label: string;
  value: CollegeWorkspaceSection;
}> = [
  { description: 'College snapshot', icon: LayoutDashboard, label: 'Overview', value: 'overview' },
  { description: 'Club workspaces', icon: UsersRound, label: 'Clubs', value: 'clubs' },
  { description: 'Sessions and activities', icon: CalendarClock, label: 'Events', value: 'events' },
  { description: 'Files and links', icon: FileStack, label: 'Resources', value: 'resources' },
  { description: 'Roles and projects', icon: BriefcaseBusiness, label: 'Opportunities', value: 'opportunities' },
  { description: 'College conversations', icon: MessageCircle, label: 'Discussions', value: 'discussions' },
  { description: 'Official updates', icon: Megaphone, label: 'Announcements', value: 'announcements' },
  { description: 'Students and club teams', icon: UsersRound, label: 'Members', value: 'members' }
];

const workspaceSectionCopy: Record<Exclude<CollegeWorkspaceSection, 'overview' | 'clubs'>, {
  badge: string;
  title: string;
  text: string;
  examples: string[];
}> = {
  announcements: {
    badge: 'College Announcements',
    examples: ['Placement office updates', 'Club reminders', 'Deadline alerts'],
    text: 'Official college and club updates will come together here, with filters by club, committee, or college-wide source.',
    title: 'All official college updates in one place.'
  },
  discussions: {
    badge: 'College Discussions',
    examples: ['Placement questions', 'Case prep threads', 'Event feedback'],
    text: 'Students will be able to follow campus conversations across clubs, then filter down to one club or domain when needed.',
    title: 'Campus conversations without switching club pages.'
  },
  events: {
    badge: 'College Events',
    examples: ['Marketing workshop', 'Finance AMA', 'Consulting case night'],
    text: 'Events from every club and committee will aggregate here, while each club page will still keep its own focused event list.',
    title: 'All campus events, filterable by club.'
  },
  members: {
    badge: 'College Members',
    examples: ['Club admins', 'Active contributors', 'Domain peers'],
    text: 'Students will be able to discover members across the college and filter by club, role, domain, or contribution context.',
    title: 'Find students and club teams across your college.'
  },
  opportunities: {
    badge: 'College Opportunities',
    examples: ['Live projects', 'Competitions', 'Club roles'],
    text: 'Projects, competitions, volunteer roles, and campus opportunities will appear here across all clubs, with club-level filters.',
    title: 'All college opportunities from every club.'
  },
  resources: {
    badge: 'College Resources',
    examples: ['Case prep decks', 'Finance templates', 'Placement playbooks'],
    text: 'Resources from all clubs will appear together here, tagged by source so students can browse everything or filter by club.',
    title: 'One college resource library, organized by club.'
  }
};

const collegeOpportunityTypeLabels: Record<PulseOpportunity['opportunity_type'], string> = {
  challenge: 'Challenge',
  event: 'Event',
  freelance: 'Freelance',
  live_project: 'Live project',
  resume_review: 'Resume review'
};

const sampleCollegeClubs: PulseClub[] = [
  {
    category: 'domain',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'consulting',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Case practice, business problem solving, frameworks, and practical business projects.',
    external_url: null,
    focus_tags: [],
    id: 'sample-consulting',
    name: 'Consulting Club',
    slug: 'sample-consulting-club',
    status: 'active',
    summary: 'Case practice, business problem solving, frameworks, and practical business projects.'
  },
  {
    category: 'entrepreneurship',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'startup',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Founders, campus ventures, validation sprints, pitch practice, and startup events.',
    external_url: null,
    focus_tags: [],
    id: 'sample-ecell',
    name: 'Entrepreneurship Cell',
    slug: 'sample-entrepreneurship-cell',
    status: 'active',
    summary: 'Founders, campus ventures, validation sprints, pitch practice, and startup events.'
  },
  {
    category: 'domain',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'finance',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Markets, valuation, equity research, financial modelling, and investment prep.',
    external_url: null,
    focus_tags: [],
    id: 'sample-finance',
    name: 'Finance Club',
    slug: 'sample-finance-club',
    status: 'active',
    summary: 'Markets, valuation, equity research, financial modelling, and investment prep.'
  },
  {
    category: 'domain',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'marketing',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Brand, consumer insight, GTM, campaigns, and campus marketing practice.',
    external_url: null,
    focus_tags: [],
    id: 'sample-marketing',
    name: 'Marketing Club',
    slug: 'sample-marketing-club',
    status: 'active',
    summary: 'Brand, consumer insight, GTM, campaigns, and campus marketing practice.'
  },
  {
    category: 'operations',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'operations',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Supply chain, process excellence, analytics, and operations competitions.',
    external_url: null,
    focus_tags: [],
    id: 'sample-operations',
    name: 'Operations Club',
    slug: 'sample-operations-club',
    status: 'active',
    summary: 'Supply chain, process excellence, analytics, and operations competitions.'
  },
  {
    category: 'placement',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'hr',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Interview prep, recruiter readiness, placement communication, and buddy support.',
    external_url: null,
    focus_tags: [],
    id: 'sample-prep',
    name: 'Prep Cell',
    slug: 'sample-prep-cell',
    status: 'active',
    summary: 'Interview prep, recruiter readiness, placement communication, and buddy support.'
  },
  {
    category: 'committee',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'product',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Placement prep, resume reviews, company briefings, and interview readiness support.',
    external_url: null,
    focus_tags: [],
    id: 'sample-placement',
    name: 'Placement Committee',
    slug: 'sample-placement-committee',
    status: 'active',
    summary: 'Placement prep, resume reviews, company briefings, and interview readiness support.'
  },
  {
    category: 'culture',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'red',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Cultural nights, college festivals, performances, creative showcases, and student celebrations.',
    external_url: null,
    focus_tags: [],
    id: 'sample-cultural',
    name: 'Cultural Committee',
    slug: 'sample-cultural-committee',
    status: 'active',
    summary: 'Cultural nights, college festivals, performances, creative showcases, and student celebrations.'
  },
  {
    category: 'sports',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'analytics',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Sports leagues, tournaments, practice schedules, team trials, and inter-college fixtures.',
    external_url: null,
    focus_tags: [],
    id: 'sample-sports',
    name: 'Sports Committee',
    slug: 'sample-sports-committee',
    status: 'active',
    summary: 'Sports leagues, tournaments, practice schedules, team trials, and inter-college fixtures.'
  },
  {
    category: 'domain',
    college_id: 'sample-college',
    contact_email: null,
    cover_color: 'product',
    created_at: '2026-09-01T00:00:00.000Z',
    description: 'Product thinking, analytics, AI tools, no-code builds, and student product experiments.',
    external_url: null,
    focus_tags: [],
    id: 'sample-product',
    name: 'Product & Analytics Club',
    slug: 'sample-product-analytics-club',
    status: 'active',
    summary: 'Product thinking, analytics, AI tools, no-code builds, and student product experiments.'
  }
];

function sampleClubRef(index: number) {
  const club = sampleCollegeClubs[index % sampleCollegeClubs.length];
  return clubRefFromClub(club);
}

function clubRefFromClub(club: PulseClub) {
  return {
    cover_color: club.cover_color,
    id: club.id,
    name: club.name,
    slug: club.slug
  };
}

function rehomeSamplePosts(posts: PulseClubPost[], clubs: PulseClub[]) {
  if (!clubs.length) return posts;
  return posts.map((post, index) => {
    const club = clubRefFromClub(clubs[index % clubs.length]);
    return {
      ...post,
      club,
      club_id: club.id
    };
  });
}

function rehomeSampleMembers(members: PulseClubMembership[], clubs: PulseClub[]) {
  if (!clubs.length) return members;
  return members.map((member, index) => {
    const club = clubRefFromClub(clubs[index % clubs.length]);
    return {
      ...member,
      club,
      club_id: club.id
    };
  });
}

function rehomeSampleOpportunities(opportunities: PulseOpportunity[], clubs: PulseClub[]) {
  if (!clubs.length) return opportunities;
  return opportunities.map((opportunity, index) => {
    const sourceClub = clubs[index % clubs.length];
    return {
      ...opportunity,
      club: {
        ...clubRefFromClub(sourceClub),
        category: sourceClub.category
      },
      club_id: sourceClub.id,
      company_name: sourceClub.name
    };
  });
}

function makeClubSpecificSamplePosts(club: PulseClub): PulseClubPost[] {
  const topic = club.name.replace(' Club', '').replace(' Cell', '').replace(' Committee', '');
  const clubRef = clubRefFromClub(club);
  const bodyPrefix = `${club.name} is using this workspace to keep students aligned on ${topic.toLowerCase()} activities`;
  const posts: Array<Pick<PulseClubPost, 'post_type' | 'title' | 'body' | 'metadata'>> = [
    {
      body: `${bodyPrefix}, upcoming priorities, and participation updates for this week.`,
      metadata: {},
      post_type: 'announcement',
      title: `${topic} weekly coordination update`
    },
    {
      body: `Students can use this thread to ask questions, find peers, and share useful context related to ${topic.toLowerCase()} work.`,
      metadata: {},
      post_type: 'discussion',
      title: `${topic} peer discussion thread`
    },
    {
      body: `A focused live session for students who want practical exposure and feedback from the ${club.name} team.`,
      metadata: {
        event_date: '2026-10-06',
        event_location: 'Campus learning room',
        event_mode: 'Campus',
        event_time: '18:30'
      },
      post_type: 'event',
      title: `${topic} practice workshop`
    },
    {
      body: `A reusable starter guide curated by ${club.name} so students can prepare before joining club activities.`,
      metadata: {
        resource_type: 'Guide',
        resource_url: 'https://drive.google.com'
      },
      post_type: 'resource',
      title: `${topic} starter guide`
    },
    {
      body: `A short project-style opportunity where students can work in teams and submit a practical output for review.`,
      metadata: {},
      post_type: 'opportunity',
      title: `${topic} live project sprint`
    },
    {
      body: `The club team is collecting student interest before finalizing the next activity format and schedule.`,
      metadata: {},
      post_type: 'poll',
      title: `Vote for the next ${topic} activity`
    },
    {
      body: `${club.name} will publish preparation notes, timelines, and participation instructions here as they are finalized.`,
      metadata: {},
      post_type: 'announcement',
      title: `${topic} preparation note`
    },
    {
      body: `Use this discussion to find partners, share doubts, and coordinate practice groups inside the club workspace.`,
      metadata: {},
      post_type: 'discussion',
      title: `${topic} partner matching thread`
    },
    {
      body: `A practical resource pack with templates, checklists, examples, and reference material for students.`,
      metadata: {
        resource_type: 'Template',
        resource_url: 'https://drive.google.com'
      },
      post_type: 'resource',
      title: `${topic} templates and checklist`
    },
    {
      body: `A club-hosted review round where students can present progress and get structured peer feedback.`,
      metadata: {
        event_date: '2026-09-20',
        event_location: 'Seminar hall',
        event_mode: 'Hybrid',
        event_time: '19:00'
      },
      post_type: 'event',
      title: `${topic} review circle`
    }
  ];

  return posts.map((post, index) => ({
    author_profile_id: 'sample-author',
    body: post.body,
    club: clubRef,
    club_id: club.id,
    created_at: `2026-09-${String(18 + index).padStart(2, '0')}T00:00:00.000Z`,
    id: `${club.id}-sample-post-${index + 1}`,
    metadata: post.metadata,
    pinned: index === 0,
    post_type: post.post_type,
    status: 'published',
    title: post.title
  }));
}

function makeSamplePost(
  id: string,
  postType: PulseClubPost['post_type'],
  title: string,
  body: string,
  clubIndex: number
): PulseClubPost {
  const club = sampleClubRef(clubIndex);
  const sampleNumber = Number(id.match(/(\d+)$/)?.[1] ?? clubIndex + 1);
  const metadata: Record<string, unknown> =
    postType === 'event'
      ? {
        event_date: `2026-10-${String(4 + sampleNumber).padStart(2, '0')}`,
        event_location: sampleNumber % 2 === 0 ? 'Main seminar hall' : 'Campus learning room',
        event_mode: sampleNumber % 3 === 0 ? 'Hybrid' : 'Campus',
        event_time: sampleNumber % 2 === 0 ? '18:00' : '19:00'
      }
      : postType === 'resource'
        ? {
          resource_type: sampleNumber % 2 === 0 ? 'Template' : 'Guide',
          resource_url: `https://drive.google.com/drive/folders/sample-${id}`
        }
        : {};

  return {
    author_profile_id: 'sample-author',
    body,
    club,
    club_id: club.id,
    created_at: '2026-09-28T00:00:00.000Z',
    id,
    metadata,
    pinned: false,
    post_type: postType,
    status: 'published',
    title
  };
}

const sampleCollegePosts: Record<'announcements' | 'discussions' | 'events' | 'resources', PulseClubPost[]> = {
  announcements: [
    makeSamplePost('sample-announcement-1', 'announcement', 'Consulting case circle registrations open', 'The Consulting Club has opened registrations for this week’s case circle. Teams can join individually or as pairs.', 0),
    makeSamplePost('sample-announcement-2', 'announcement', 'E-Cell founder mixer moved to Thursday', 'The founder mixer will now happen on Thursday evening with student venture demos and mentor feedback.', 1),
    makeSamplePost('sample-announcement-3', 'announcement', 'Finance valuation bootcamp shortlist released', 'Selected participants for the valuation bootcamp can check the club workspace for prep material and timelines.', 2),
    makeSamplePost('sample-announcement-4', 'announcement', 'Marketing Club opens campaign lab seats', 'Students can now apply for the next campaign lab focused on campus launch planning and D2C growth teardown.', 3),
    makeSamplePost('sample-announcement-5', 'announcement', 'Operations simulation room booking live', 'Operations Club has opened slots for the supply chain simulation room and process improvement practice round.', 4),
    makeSamplePost('sample-announcement-6', 'announcement', 'Prep Cell mock interview calendar published', 'The Prep Cell has published this month’s mock interview calendar with peer panels and alumni slots.', 5),
    makeSamplePost('sample-announcement-7', 'announcement', 'Placement Committee resume clinic starts Monday', 'Students can book resume review slots and get structured feedback before recruiter outreach begins.', 6),
    makeSamplePost('sample-announcement-8', 'announcement', 'Cultural Committee festival volunteer call', 'Volunteer registrations are open for stage, design, hospitality, sponsorship, and event operations teams.', 7),
    makeSamplePost('sample-announcement-9', 'announcement', 'Sports Committee trials schedule updated', 'Updated trial timings for football, badminton, cricket, and athletics are now available in the workspace.', 8),
    makeSamplePost('sample-announcement-10', 'announcement', 'Product & Analytics Club demo day announced', 'Student builders can showcase dashboards, AI workflows, product prototypes, and analytics case studies.', 9)
  ],
  discussions: [
    makeSamplePost('sample-discussion-1', 'discussion', 'How are you preparing for consulting shortlists?', 'Share useful case books, partner matching requests, and practice routines for the next two weeks.', 0),
    makeSamplePost('sample-discussion-2', 'discussion', 'Best way to validate a campus startup idea?', 'Students are discussing quick interviews, landing pages, and pilot experiments before building full products.', 1),
    makeSamplePost('sample-discussion-3', 'discussion', 'Which sector should Finance Club cover next?', 'Vote or suggest sectors for the next equity research discussion: FMCG, banking, renewables, or consumer tech.', 2),
    makeSamplePost('sample-discussion-4', 'discussion', 'What makes a strong campus brand campaign?', 'Marketing Club members are comparing launch examples, hooks, content calendars, and conversion metrics.', 3),
    makeSamplePost('sample-discussion-5', 'discussion', 'Operations case practice partner thread', 'Use this thread to find a partner for process improvement, inventory, and supply chain case practice.', 4),
    makeSamplePost('sample-discussion-6', 'discussion', 'Mock interview peer feedback format', 'Prep Cell is collecting suggestions for making peer mock interviews more useful and less repetitive.', 5),
    makeSamplePost('sample-discussion-7', 'discussion', 'What should go into a one-page resume?', 'Students are discussing resume structure, bullets, metrics, projects, and common mistakes before reviews.', 6),
    makeSamplePost('sample-discussion-8', 'discussion', 'Ideas for the next cultural night theme', 'Share themes, performance ideas, format suggestions, and volunteer interest for the next college cultural evening.', 7),
    makeSamplePost('sample-discussion-9', 'discussion', 'Inter-section sports league format', 'Sports Committee is collecting preferences for league format, team size, fixtures, and match timings.', 8),
    makeSamplePost('sample-discussion-10', 'discussion', 'Useful AI tools for student productivity', 'Product & Analytics Club is discussing AI tools for research, dashboards, presentations, and project management.', 9)
  ],
  events: [
    makeSamplePost('sample-event-1', 'event', 'Case practice night with alumni mentors', 'A live case practice session for first-year students with alumni feedback and peer observation rounds.', 0),
    makeSamplePost('sample-event-2', 'event', 'Pitch clinic for early-stage ideas', 'E-Cell will run a pitch clinic for teams preparing for campus venture showcases and competitions.', 1),
    makeSamplePost('sample-event-3', 'event', 'Marketing teardown: D2C growth campaigns', 'Marketing Club will review recent D2C campaigns and discuss positioning, channels, and creative strategy.', 3),
    makeSamplePost('sample-event-4', 'event', 'Valuation workshop: quick DCF build', 'Finance Club will host a hands-on DCF session using a simple listed-company example.', 2),
    makeSamplePost('sample-event-5', 'event', 'Supply chain simulation evening', 'Operations Club is hosting a simulation around forecasting, inventory planning, and service-level tradeoffs.', 4),
    makeSamplePost('sample-event-6', 'event', 'Group discussion practice room', 'Prep Cell will run moderated GD rounds with feedback on structure, listening, and closing summaries.', 5),
    makeSamplePost('sample-event-7', 'event', 'Resume review desk with seniors', 'Placement Committee seniors will review resumes and help students prioritize impact bullets.', 6),
    makeSamplePost('sample-event-8', 'event', 'Open mic and performance jam', 'Cultural Committee is hosting an informal evening for music, poetry, comedy, and short performances.', 7),
    makeSamplePost('sample-event-9', 'event', 'Badminton league fixtures briefing', 'Sports Committee will brief captains on fixtures, rules, substitutions, and reporting format.', 8),
    makeSamplePost('sample-event-10', 'event', 'No-code dashboard build-along', 'Product & Analytics Club will run a build-along for a simple student activity dashboard.', 9)
  ],
  resources: [
    makeSamplePost('sample-resource-1', 'resource', 'Case interview starter pack', 'A curated set of case structures, sample prompts, estimation drills, and partner practice guidelines.', 0),
    makeSamplePost('sample-resource-2', 'resource', 'Financial modelling base template', 'Finance Club’s clean Excel template for quick valuation practice and sensitivity analysis.', 2),
    makeSamplePost('sample-resource-3', 'resource', 'Campus campaign planning checklist', 'A practical checklist for clubs planning launches, events, and student outreach campaigns.', 3),
    makeSamplePost('sample-resource-4', 'resource', 'Startup validation interview script', 'A simple guide for speaking with potential users before building a venture or product idea.', 1),
    makeSamplePost('sample-resource-5', 'resource', 'Operations case formula sheet', 'Common formulas and frameworks for capacity, inventory, queueing, and process improvement problems.', 4),
    makeSamplePost('sample-resource-6', 'resource', 'GD and PI preparation tracker', 'A tracker for practice rounds, feedback notes, target companies, and improvement areas.', 5),
    makeSamplePost('sample-resource-7', 'resource', 'Resume bullet improvement guide', 'Examples of weak versus strong resume bullets with action verbs, metrics, and business impact.', 6),
    makeSamplePost('sample-resource-8', 'resource', 'College event runbook template', 'A planning runbook for cultural events covering timelines, owners, budgets, and risk checks.', 7),
    makeSamplePost('sample-resource-9', 'resource', 'Tournament rules and fixture sheet', 'A reusable fixture sheet and rules template for sports leagues and inter-section matches.', 8),
    makeSamplePost('sample-resource-10', 'resource', 'Student dashboard starter kit', 'A starter kit for building dashboards with metrics, filters, charts, and update routines.', 9)
  ]
};

const sampleCollegeMembers: PulseClubMembership[] = [
  {
    club: sampleClubRef(0),
    club_id: 'sample-consulting',
    id: 'sample-member-1',
    profile: { avatar_url: null, display_name: 'Aarav Mehta', headline: 'Consulting Club coordinator', id: 'sample-profile-1', linkedin_url: 'https://www.linkedin.com/in/aarav-mehta' },
    profile_id: 'sample-profile-1',
    role: 'admin',
    status: 'active',
    title: 'Coordinator'
  },
  {
    club: sampleClubRef(1),
    club_id: 'sample-ecell',
    id: 'sample-member-2',
    profile: { avatar_url: null, display_name: 'Riya Nair', headline: 'E-Cell events and founder programs', id: 'sample-profile-2', linkedin_url: 'https://www.linkedin.com/in/riya-nair' },
    profile_id: 'sample-profile-2',
    role: 'moderator',
    status: 'active',
    title: 'Events Lead'
  },
  {
    club: sampleClubRef(2),
    club_id: 'sample-finance',
    id: 'sample-member-3',
    profile: { avatar_url: null, display_name: 'Kabir Sethi', headline: 'Finance Club research lead', id: 'sample-profile-3', linkedin_url: 'https://www.linkedin.com/in/kabir-sethi' },
    profile_id: 'sample-profile-3',
    role: 'member',
    status: 'active',
    title: 'Research Lead'
  },
  {
    club: sampleClubRef(3),
    club_id: 'sample-marketing',
    id: 'sample-member-4',
    profile: { avatar_url: null, display_name: 'Meera Iyer', headline: 'Marketing Club campaign lead', id: 'sample-profile-4', linkedin_url: 'https://www.linkedin.com/in/meera-iyer' },
    profile_id: 'sample-profile-4',
    role: 'admin',
    status: 'active',
    title: 'Campaign Lead'
  },
  {
    club: sampleClubRef(4),
    club_id: 'sample-operations',
    id: 'sample-member-5',
    profile: { avatar_url: null, display_name: 'Devansh Rao', headline: 'Operations Club simulation coordinator', id: 'sample-profile-5', linkedin_url: 'https://www.linkedin.com/in/devansh-rao' },
    profile_id: 'sample-profile-5',
    role: 'moderator',
    status: 'active',
    title: 'Simulation Coordinator'
  },
  {
    club: sampleClubRef(5),
    club_id: 'sample-prep',
    id: 'sample-member-6',
    profile: { avatar_url: null, display_name: 'Nisha Kapoor', headline: 'Prep Cell interview practice lead', id: 'sample-profile-6', linkedin_url: 'https://www.linkedin.com/in/nisha-kapoor' },
    profile_id: 'sample-profile-6',
    role: 'admin',
    status: 'active',
    title: 'Interview Lead'
  },
  {
    club: sampleClubRef(6),
    club_id: 'sample-placement',
    id: 'sample-member-7',
    profile: { avatar_url: null, display_name: 'Ishaan Malhotra', headline: 'Placement Committee resume desk', id: 'sample-profile-7', linkedin_url: 'https://www.linkedin.com/in/ishaan-malhotra' },
    profile_id: 'sample-profile-7',
    role: 'member',
    status: 'active',
    title: 'Resume Desk'
  },
  {
    club: sampleClubRef(7),
    club_id: 'sample-cultural',
    id: 'sample-member-8',
    profile: { avatar_url: null, display_name: 'Ananya Bose', headline: 'Cultural Committee programming lead', id: 'sample-profile-8', linkedin_url: 'https://www.linkedin.com/in/ananya-bose' },
    profile_id: 'sample-profile-8',
    role: 'moderator',
    status: 'active',
    title: 'Programming Lead'
  },
  {
    club: sampleClubRef(8),
    club_id: 'sample-sports',
    id: 'sample-member-9',
    profile: { avatar_url: null, display_name: 'Vivaan Shah', headline: 'Sports Committee league coordinator', id: 'sample-profile-9', linkedin_url: 'https://www.linkedin.com/in/vivaan-shah' },
    profile_id: 'sample-profile-9',
    role: 'member',
    status: 'active',
    title: 'League Coordinator'
  },
  {
    club: sampleClubRef(9),
    club_id: 'sample-product',
    id: 'sample-member-10',
    profile: { avatar_url: null, display_name: 'Sara Thomas', headline: 'Product & Analytics Club builder', id: 'sample-profile-10', linkedin_url: 'https://www.linkedin.com/in/sara-thomas' },
    profile_id: 'sample-profile-10',
    role: 'admin',
    status: 'active',
    title: 'Builder Lead'
  }
];

const sampleCollegeOpportunities: PulseOpportunity[] = [
  {
    club: { ...sampleClubRef(0), category: 'domain' },
    club_id: 'sample-consulting',
    closes_at: '2026-10-05T00:00:00.000Z',
    company_name: 'Consulting Club',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Join a student consulting sprint to solve a market entry problem and present recommendations to alumni mentors.',
    id: 'sample-opportunity-1',
    opportunity_type: 'live_project',
    title: 'Market entry live project sprint',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(1), category: 'entrepreneurship' },
    club_id: 'sample-ecell',
    closes_at: '2026-10-08T00:00:00.000Z',
    company_name: 'Entrepreneurship Cell',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Volunteer with E-Cell to run startup idea reviews, founder office hours, and demo-day operations.',
    id: 'sample-opportunity-2',
    opportunity_type: 'event',
    title: 'Startup showcase organizing team',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(2), category: 'domain' },
    club_id: 'sample-finance',
    closes_at: '2026-10-12T00:00:00.000Z',
    company_name: 'Finance Club',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Prepare a short equity research note with a sector thesis, valuation snapshot, and risk view.',
    id: 'sample-opportunity-3',
    opportunity_type: 'challenge',
    title: 'Equity research note challenge',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(3), category: 'domain' },
    club_id: 'sample-marketing',
    closes_at: '2026-10-15T00:00:00.000Z',
    company_name: 'Marketing Club',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Work with a team to design a campus launch plan, content calendar, and campaign measurement dashboard.',
    id: 'sample-opportunity-4',
    opportunity_type: 'live_project',
    title: 'Campus launch campaign sprint',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(4), category: 'operations' },
    club_id: 'sample-operations',
    closes_at: '2026-10-18T00:00:00.000Z',
    company_name: 'Operations Club',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Join a small team to map a campus process, identify bottlenecks, and propose measurable improvements.',
    id: 'sample-opportunity-5',
    opportunity_type: 'challenge',
    title: 'Process improvement challenge',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(5), category: 'placement' },
    club_id: 'sample-prep',
    closes_at: '2026-10-20T00:00:00.000Z',
    company_name: 'Prep Cell',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Become a peer interviewer for mock PI rounds and help students capture feedback after every session.',
    id: 'sample-opportunity-6',
    opportunity_type: 'event',
    title: 'Mock interview peer panel',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(6), category: 'committee' },
    club_id: 'sample-placement',
    closes_at: '2026-10-22T00:00:00.000Z',
    company_name: 'Placement Committee',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Support the resume clinic by reviewing first drafts, tagging improvement areas, and routing reviews to seniors.',
    id: 'sample-opportunity-7',
    opportunity_type: 'resume_review',
    title: 'Resume clinic support team',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(7), category: 'culture' },
    club_id: 'sample-cultural',
    closes_at: '2026-10-25T00:00:00.000Z',
    company_name: 'Cultural Committee',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Join the volunteer team for cultural night across stage, design, hospitality, and backstage operations.',
    id: 'sample-opportunity-8',
    opportunity_type: 'event',
    title: 'Cultural night volunteer crew',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(8), category: 'sports' },
    club_id: 'sample-sports',
    closes_at: '2026-10-28T00:00:00.000Z',
    company_name: 'Sports Committee',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Help coordinate fixtures, score reporting, and team communication for the inter-section sports league.',
    id: 'sample-opportunity-9',
    opportunity_type: 'event',
    title: 'Inter-section league operations team',
    visibility: 'college'
  },
  {
    club: { ...sampleClubRef(9), category: 'domain' },
    club_id: 'sample-product',
    closes_at: '2026-11-02T00:00:00.000Z',
    company_name: 'Product & Analytics Club',
    created_at: '2026-09-28T00:00:00.000Z',
    description: 'Build a lightweight dashboard prototype for student clubs to track events, participation, and resources.',
    id: 'sample-opportunity-10',
    opportunity_type: 'live_project',
    title: 'Club analytics dashboard prototype',
    visibility: 'college'
  }
];

function opportunityCloseLabel(value?: string | null) {
  if (!value) return 'Open now';
  return `Closes ${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(value))}`;
}

function clubActivityDateLabel(value?: string | null) {
  if (!value) return 'No activity yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity yet';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date);
}

function clubPostDateMeta(post: PulseClubPost) {
  const eventDate = typeof post.metadata.event_date === 'string' ? post.metadata.event_date : null;
  const deadline = readClubPostDateMetadata(post);
  if (post.post_type === 'event') return eventDate ? `Event ${clubActivityDateLabel(eventDate)}` : 'Event date TBA';
  if (deadline) return `Deadline ${clubActivityDateLabel(deadline)}`;
  return `Updated ${clubActivityDateLabel(post.created_at)}`;
}

function clubPostFormatMeta(post: PulseClubPost) {
  const eventTime = typeof post.metadata.event_time === 'string' ? post.metadata.event_time : null;
  const eventMode = typeof post.metadata.event_mode === 'string' ? post.metadata.event_mode : null;
  const resourceType = typeof post.metadata.resource_type === 'string' ? post.metadata.resource_type : null;
  const resourceUrl = typeof post.metadata.resource_url === 'string' ? post.metadata.resource_url : null;
  if (post.post_type === 'event') return [eventTime, eventMode].filter(Boolean).join(' · ') || 'Session details';
  if (post.post_type === 'resource') return resourceType || (resourceUrl ? 'External link' : 'Pulse resource');
  if (post.post_type === 'opportunity') return isClubPostExpired(post) ? 'Expired' : 'Active';
  return post.pinned ? 'Priority update' : clubPostTypeLabels[post.post_type];
}

function collegePostCardDetailItems(post: PulseClubPost) {
  if (post.post_type === 'event') {
    const eventLocation = typeof post.metadata.event_location === 'string' ? post.metadata.event_location : '';
    const agendaCount = clubMetadataListCount(post.metadata, 'agenda_items');
    const prepCount = clubMetadataListCount(post.metadata, 'prep_items');
    return [
      eventLocation || 'Venue TBA',
      agendaCount ? `${agendaCount} agenda` : 'Agenda TBA',
      prepCount ? `${prepCount} prep` : 'Prep TBA'
    ];
  }

  if (post.post_type === 'resource') {
    const resourceUrl = typeof post.metadata.resource_url === 'string' ? post.metadata.resource_url : '';
    const previewCount = clubMetadataListCount(post.metadata, 'resource_items');
    const usageCount = clubMetadataListCount(post.metadata, 'usage_items');
    return [
      resourceUrl ? 'Link attached' : 'Pulse resource',
      previewCount ? `${previewCount} previews` : 'Preview TBA',
      usageCount ? `${usageCount} use notes` : 'Use note TBA'
    ];
  }

  if (post.post_type === 'opportunity') {
    const deadline = readClubPostDateMetadata(post);
    const briefCount = clubMetadataListCount(post.metadata, 'opportunity_items');
    const fitCount = clubMetadataListCount(post.metadata, 'fit_items');
    return [
      deadline ? `Deadline ${clubActivityDateLabel(deadline)}` : 'Deadline TBA',
      briefCount ? `${briefCount} brief` : 'Brief TBA',
      fitCount ? `${fitCount} fit notes` : 'Fit TBA'
    ];
  }

  return [];
}

function collegeOpportunityCardDetailItems(opportunity: PulseOpportunity, isInterested: boolean) {
  return [
    opportunity.starts_at ? `Starts ${clubActivityDateLabel(opportunity.starts_at)}` : 'Flexible start',
    `Deadline ${opportunityCloseLabel(opportunity.closes_at)}`,
    opportunity.application_url ? 'External link' : 'Pulse hosted',
    isInterested ? 'Interested' : opportunity.visibility === 'global' ? 'Everyone' : 'College-only'
  ];
}

function quickAccessIcon(kind: CollegeQuickAccessKind) {
  if (kind === 'club') return UsersRound;
  if (kind === 'event') return CalendarClock;
  if (kind === 'opportunity') return BriefcaseBusiness;
  return FileStack;
}

function sampleInteractionCount(id: string, base: number) {
  const total = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return base + (total % 9);
}

function clubSearchLink(type: 'posts' | 'people' | 'opportunities', club: PulseClub) {
  const query = club.name.replace(' Club', '').replace(' Cell', '').replace(' Committee', '');
  return `/pulse/search?q=${encodeURIComponent(query)}&type=${type}`;
}

function collegeClubName(club: PulseClub, collegeName: string) {
  return `${collegeName} ${club.name}`;
}

function clubAccentClass(accent: PulseClubAccent) {
  return `pulse-club-card--${accent}`;
}

function categoryLabel(category: PulseClub['category']) {
  if (category === 'entrepreneurship') return 'Entrepreneurship';
  if (category === 'placement') return 'Placement';
  if (category === 'committee') return 'Committee';
  if (category === 'operations') return 'Operations';
  if (category === 'culture') return 'Culture';
  if (category === 'sports') return 'Sports';
  if (category === 'domain') return 'Domain club';
  return 'College club';
}

function PulseClubCard({
  club,
  onOpen
}: {
  club: PulseClub;
  onOpen?: (club: PulseClub) => void;
}) {
  return (
    <Link className={`pulse-club-card ${clubAccentClass(club.cover_color)}`} to={`/pulse/clubs/${club.slug}`} onClick={() => onOpen?.(club)}>
      <div className="pulse-club-card__top">
        <span><UsersRound size={18} /></span>
      </div>
      <h2>{club.name}</h2>
      <p>{club.summary}</p>
      <div className="pulse-club-card__bottom">
        <strong>{categoryLabel(club.category)}</strong>
        <span>Open workspace <ArrowRight size={16} /></span>
      </div>
    </Link>
  );
}

function CampusThreadCard({
  interaction,
  post,
  profile
}: {
  interaction?: PulsePostInteractionSummary;
  post: PulsePost;
  profile: PulseProfile;
}) {
  const createComment = useCreatePulseComment(profile);
  const toggleReaction = useTogglePulsePostReaction(profile);
  const [commentBody, setCommentBody] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(post.anonymous);
  const authorName = post.anonymous ? 'Anonymous student' : post.author?.display_name ?? 'Pulse member';
  const authorAvatarUrl = post.anonymous ? null : post.author?.avatar_url;
  const comments = interaction?.comments ?? [];
  const pollOptions = Array.isArray(post.metadata.poll_options)
    ? post.metadata.poll_options.filter((option): option is { id: string; label: string } => {
      if (!option || typeof option !== 'object') return false;
      const candidate = option as { id?: unknown; label?: unknown };
      return typeof candidate.id === 'string' && typeof candidate.label === 'string';
    })
    : [];

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    createComment.mutate(
      {
        anonymous: commentAnonymous,
        body: commentBody,
        postId: post.id
      },
      {
        onSuccess: () => setCommentBody('')
      }
    );
  }

  return (
    <article className="pulse-campus-thread-card">
      <div className="pulse-campus-thread-card__signal">
        <span><Gauge size={16} /> {campusThreadActivityLabel(interaction)}</span>
        <small>{pulsePostRelativeTime(post.created_at)}</small>
      </div>

      <div className="pulse-campus-thread-card__author">
        <span className="pulse-post-author">
          <strong>{authorAvatarUrl ? <img alt="" src={authorAvatarUrl} /> : authorName.slice(0, 1).toUpperCase()}</strong>
          <span>
            <b>{authorName}</b>
            {post.author?.headline && !post.anonymous ? <small>{post.author.headline}</small> : null}
          </span>
        </span>
        <span className="pulse-campus-thread-card__audience">{pulsePostTypeLabels[post.post_type]} · {post.college?.name ?? 'My college only'}</span>
      </div>

      <div className="pulse-campus-thread-card__content">
        <PulseBadge tone={post.post_type === 'poll' ? 'gold' : 'green'}>{post.post_type === 'poll' ? 'Campus poll' : 'College-only'}</PulseBadge>
        <h3>{post.title}</h3>
        <p>{post.body}</p>
        <div className="pulse-campus-thread-card__meta">
          <span><CalendarClock size={14} /> Started {clubActivityDateLabel(post.created_at)}</span>
          <span><MessageCircle size={14} /> {interaction?.commentCount ?? 0} replies</span>
          <span><ShieldCheck size={14} /> {post.college?.name ?? 'My college only'}</span>
        </div>
        {pollOptions.length ? (
          <div className="pulse-campus-thread-card__poll">
            {pollOptions.map((option) => (
              <span key={option.id}>{option.label}</span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="pulse-campus-thread-card__actions">
        <button
          className={interaction?.hasReacted ? 'active' : undefined}
          disabled={toggleReaction.isPending}
          onClick={() => toggleReaction.mutate({ hasReacted: Boolean(interaction?.hasReacted), postId: post.id })}
          type="button"
        >
          <Trophy size={16} /> {interaction?.reactionCount ?? 0} Recognize
        </button>
        <span><MessageCircle size={16} /> {interaction?.commentCount ?? 0} replies</span>
      </div>

      <div className="pulse-campus-thread-card__comments">
        {comments.length ? comments.slice(-3).map((comment) => (
          <div className="pulse-campus-thread-card__comment" key={comment.id}>
            <strong>{comment.anonymous ? 'Anonymous student' : comment.author?.display_name ?? 'Pulse member'}</strong>
            <p>{comment.body}</p>
          </div>
        )) : (
          <div className="pulse-campus-thread-card__empty-reply">
            <MessageCircle size={16} /> Start the first useful reply.
          </div>
        )}
      </div>

      <form className="pulse-campus-thread-card__reply" onSubmit={submitComment}>
        <textarea
          onChange={(event) => setCommentBody(event.target.value)}
          placeholder="Share a helpful reply for your campus"
          rows={1}
          value={commentBody}
        />
        <label>
          <input checked={commentAnonymous} onChange={(event) => setCommentAnonymous(event.target.checked)} type="checkbox" />
          <span>Anonymous</span>
        </label>
        <button disabled={createComment.isPending || !commentBody.trim()} type="submit">
          {createComment.isPending ? 'Sending' : 'Reply'}
        </button>
        {createComment.error ? <p className="pulse-form-error">{createComment.error.message}</p> : null}
        {toggleReaction.error ? <p className="pulse-form-error">{toggleReaction.error.message}</p> : null}
      </form>
    </article>
  );
}

export function PulseClubsPage() {
  const { status } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const clubsQuery = usePulseCollegeClubs(profile);
  const membershipsQuery = usePulseClubMemberships(profile);
  const selectedWorkspaceSection = normalizeCollegeWorkspaceSection(searchParams.get('section'));
  const [activeSection, setActiveSection] = useState<CollegeWorkspaceSection>(selectedWorkspaceSection);
  const [activeClubFilter, setActiveClubFilter] = useState('all');
  const [selectedCollegePost, setSelectedCollegePost] = useState<PulseClubPost | null>(null);
  const [previousCollegePost, setPreviousCollegePost] = useState<PulseClubPost | null>(null);
  const [selectedCollegeOpportunity, setSelectedCollegeOpportunity] = useState<PulseOpportunity | null>(null);
  const [campusDiscussionFilter, setCampusDiscussionFilter] = useState<CampusDiscussionFilter>('recent');
  const [campusComposerType, setCampusComposerType] = useState<PulsePostInput['postType']>('discussion');
  const [campusComposerTitle, setCampusComposerTitle] = useState('');
  const [campusComposerBody, setCampusComposerBody] = useState('');
  const [campusPollOptions, setCampusPollOptions] = useState(['Resume prep', 'Club projects', 'Interview practice', 'Campus events']);
  const [collegeResourceFilter, setCollegeResourceFilter] = useState<CollegeResourceFilter>('all');
  const [collegeOpportunityFilter, setCollegeOpportunityFilter] = useState<CollegeOpportunityFilter>('all');
  const [collegeEventSort, setCollegeEventSort] = useState<CollegeEventSort>('date');
  const [collegeResourceSort, setCollegeResourceSort] = useState<CollegeResourceSort>('newest');
  const [collegeOpportunitySort, setCollegeOpportunitySort] = useState<CollegeOpportunitySort>('deadline');
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  const [copiedCollegeDetailId, setCopiedCollegeDetailId] = useState<string | null>(null);
  const [recentQuickAccessItems, setRecentQuickAccessItems] = useState<CollegeQuickAccessItem[]>(() => {
    try {
      const storedItems = window.localStorage.getItem('pulseCollegeQuickAccessItems');
      if (!storedItems) return [];
      const parsedItems = JSON.parse(storedItems) as CollegeQuickAccessItem[];
      return Array.isArray(parsedItems) ? parsedItems.slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const clubIds = useMemo(() => (clubsQuery.data ?? []).map((club) => club.id), [clubsQuery.data]);
  const announcementsQuery = usePulseCollegeClubPosts(clubIds, ['announcement'], profile);
  const discussionsQuery = usePulseCollegeClubPosts(clubIds, ['discussion'], profile);
  const eventsQuery = usePulseCollegeClubPosts(clubIds, ['event'], profile);
  const resourcesQuery = usePulseCollegeClubPosts(clubIds, ['resource'], profile);
  const collegeMembersQuery = usePulseCollegeClubMembers(clubIds, profile);
  const collegeOpportunitiesQuery = usePulseCollegeOpportunities(profile);
  const campusFeedQuery = usePulseFeed(profile, 'college');
  const campusPulsePosts = useMemo(
    () =>
      (campusFeedQuery.data ?? []).filter(
        (post) =>
          post.visibility === 'college' &&
          (!profile?.college_id || post.college_id === profile.college_id) &&
          (post.post_type === 'discussion' || post.post_type === 'poll' || post.post_type === 'article')
      ),
    [campusFeedQuery.data, profile?.college_id]
  );
  const campusInteractionsQuery = usePulsePostInteractions(campusPulsePosts, profile);
  const createCampusPost = useCreatePulsePost(profile);
  const collegeActionPostIds = useMemo(
    () => (resourcesQuery.data ?? []).filter((post) => !post.id.startsWith('sample-')).map((post) => post.id),
    [resourcesQuery.data]
  );
  const collegeClubPostActionsQuery = usePulseClubPostActions(collegeActionPostIds, profile);
  const toggleCollegeClubPostAction = useTogglePulseClubPostAction(profile);
  const opportunityApplicationsQuery = usePulseOpportunityApplications(profile);
  const markOpportunityInterest = useMarkPulseOpportunityInterest(profile);
  const collegeClubPostActionSet = useMemo(
    () => new Set((collegeClubPostActionsQuery.data ?? []).map((action) => `${action.club_post_id}:${action.action_type}`)),
    [collegeClubPostActionsQuery.data]
  );
  const opportunityApplicationMap = useMemo(() => {
    const map = new Map<string, string>();
    (opportunityApplicationsQuery.data ?? []).forEach((application) => {
      map.set(application.opportunity_id, application.status);
    });
    return map;
  }, [opportunityApplicationsQuery.data]);

  function rememberQuickAccessItem(item: Omit<CollegeQuickAccessItem, 'timestamp'>) {
    setRecentQuickAccessItems((currentItems) => {
      const nextItems = [
        { ...item, timestamp: Date.now() },
        ...currentItems.filter((currentItem) => currentItem.key !== item.key)
      ].slice(0, 6);
      try {
        window.localStorage.setItem('pulseCollegeQuickAccessItems', JSON.stringify(nextItems));
      } catch {
        // Quick access is helpful but not required if browser storage is unavailable.
      }
      return nextItems;
    });
  }

  const collegeDetailLink = (path: string) => `${window.location.origin}${path}`;

  const collegePostDetailPath = (post: PulseClubPost) => {
    const section = post.post_type === 'event' ? 'events' : post.post_type === 'resource' ? 'resources' : 'announcements';
    return `/pulse/clubs?section=${section}&post=${post.id}`;
  };

  const copyCollegeDetailLink = async (id: string, path: string, promptLabel: string) => {
    const link = collegeDetailLink(path);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt(promptLabel, link);
    }
    setCopiedCollegeDetailId(id);
  };

  useEffect(() => {
    document.title = 'My College Workspace | SapiensPulse';
  }, []);

  useEffect(() => {
    if (!copiedCollegeDetailId) return undefined;
    const timeout = window.setTimeout(() => setCopiedCollegeDetailId(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedCollegeDetailId]);

  useEffect(() => {
    if (searchParams.get('compose') !== '1' || selectedWorkspaceSection !== 'discussions') return;
    window.requestAnimationFrame(() => {
      document.getElementById('campus-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [searchParams, selectedWorkspaceSection]);

  useEffect(() => {
    setActiveSection(selectedWorkspaceSection);
    setActiveClubFilter('all');
    setSelectedCollegePost(null);
    setPreviousCollegePost(null);
    setSelectedCollegeOpportunity(null);
    setCollegeResourceFilter('all');
    setCollegeOpportunityFilter('all');
    setCollegeEventSort('date');
    setCollegeResourceSort('newest');
    setCollegeOpportunitySort('deadline');
    setModuleSearchQuery('');
  }, [selectedWorkspaceSection]);

  useEffect(() => {
    const postId = searchParams.get('post');
    if (!postId) {
      setSelectedCollegePost(null);
      return;
    }

    const availablePosts = [
      ...(eventsQuery.data ?? []),
      ...(resourcesQuery.data ?? []),
      ...(announcementsQuery.data ?? []),
      ...sampleCollegePosts.events,
      ...sampleCollegePosts.resources,
      ...sampleCollegePosts.announcements
    ];
    const matchedPost = availablePosts.find((post) => post.id === postId) ?? null;
    if (matchedPost) setSelectedCollegePost(matchedPost);
  }, [announcementsQuery.data, eventsQuery.data, resourcesQuery.data, searchParams]);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Workspace</PulseBadge>
        <h1>Opening your college workspace.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  const activeProfile = profile;
  const collegeName = profile.college?.name ?? 'Your College';
  const clubs = clubsQuery.data ?? [];
  const displayedClubs = clubs.length ? clubs : sampleCollegeClubs;
  const previewPosts = {
    announcements: rehomeSamplePosts(sampleCollegePosts.announcements, displayedClubs),
    discussions: rehomeSamplePosts(sampleCollegePosts.discussions, displayedClubs),
    events: rehomeSamplePosts(sampleCollegePosts.events, displayedClubs),
    resources: rehomeSamplePosts(sampleCollegePosts.resources, displayedClubs)
  };
  const previewMembers = rehomeSampleMembers(sampleCollegeMembers, displayedClubs);
  const previewOpportunities = rehomeSampleOpportunities(sampleCollegeOpportunities, displayedClubs);
  const isLoadingWorkspace = clubsQuery.isLoading || membershipsQuery.isLoading;
  const featuredClubs = clubs.slice(0, 3);
  const selectedSectionMeta = collegeWorkspaceSections.find((section) => section.value === activeSection) ?? collegeWorkspaceSections[0];

  function closeCollegePostDetail() {
    setSelectedCollegePost(null);
    setPreviousCollegePost(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('post');
    setSearchParams(nextParams, { replace: true });
  }

  function scrollCollegeDetailIntoView() {
    window.requestAnimationFrame(() => {
      document.getElementById('college-post-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function openRelatedCollegePost(post: PulseClubPost, currentPost: PulseClubPost) {
    setSelectedCollegePost(post);
    setPreviousCollegePost(currentPost);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('section', post.post_type === 'event' ? 'events' : post.post_type === 'resource' ? 'resources' : 'announcements');
    nextParams.set('post', post.id);
    setSearchParams(nextParams, { replace: false });
    scrollCollegeDetailIntoView();
  }

  function openPreviousCollegePost() {
    if (!previousCollegePost || !selectedCollegePost) return;
    const targetPost = previousCollegePost;
    setSelectedCollegePost(targetPost);
    setPreviousCollegePost(selectedCollegePost);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('section', targetPost.post_type === 'event' ? 'events' : targetPost.post_type === 'resource' ? 'resources' : 'announcements');
    nextParams.set('post', targetPost.id);
    setSearchParams(nextParams, { replace: false });
    scrollCollegeDetailIntoView();
  }

  function collegePostTypeLabel(post: PulseClubPost) {
    if (post.post_type === 'announcement') return 'Announcement';
    if (post.post_type === 'discussion') return 'Discussion';
    if (post.post_type === 'event') return 'Event';
    if (post.post_type === 'resource') return 'Resource';
    if (post.post_type === 'opportunity') return 'Opportunity';
    return 'Poll';
  }

  function relatedCollegePosts(post: PulseClubPost) {
    return [
      ...((eventsQuery.data?.length ? eventsQuery.data : previewPosts.events) ?? []),
      ...((resourcesQuery.data?.length ? resourcesQuery.data : previewPosts.resources) ?? []),
      ...((announcementsQuery.data?.length ? announcementsQuery.data : previewPosts.announcements) ?? [])
    ]
      .filter((item) => item.id !== post.id && item.club_id === post.club_id)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, 3);
  }

  function renderRelatedCollegePosts(post: PulseClubPost) {
    const relatedPosts = relatedCollegePosts(post);
    if (!relatedPosts.length) return null;

    return (
      <section className="pulse-opportunity-related">
        <div className="pulse-college-overview-panel__header">
          <div>
            <PulseBadge tone="gold">More from this club</PulseBadge>
            <h2>Related items from {post.club?.name ?? 'this club'}</h2>
          </div>
          {post.club?.slug ? <Link to={`/pulse/clubs/${post.club.slug}`}>Open club <ArrowRight size={15} /></Link> : null}
        </div>
        <div className="pulse-opportunity-related__grid">
          {relatedPosts.map((item) => (
            <button className="pulse-opportunity-related-card" key={item.id} type="button" onClick={() => openRelatedCollegePost(item, post)}>
              <PulseBadge tone={item.post_type === 'event' ? 'green' : item.post_type === 'resource' ? 'gold' : 'coral'}>
                {collegePostTypeLabel(item)}
              </PulseBadge>
              <strong>{item.title}</strong>
              <span>{clubPostDateMeta(item)}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function renderCollegePostDetail(post: PulseClubPost) {
    const eventDate = typeof post.metadata.event_date === 'string' ? post.metadata.event_date : null;
    const eventTime = typeof post.metadata.event_time === 'string' ? post.metadata.event_time : null;
    const eventMode = typeof post.metadata.event_mode === 'string' ? post.metadata.event_mode : null;
    const eventLocation = typeof post.metadata.event_location === 'string' ? post.metadata.event_location : null;
    const resourceType = typeof post.metadata.resource_type === 'string' ? post.metadata.resource_type : null;
    const resourceUrl = typeof post.metadata.resource_url === 'string' ? post.metadata.resource_url : null;
    const detailLabel = collegePostTypeLabel(post);
    const isEvent = post.post_type === 'event';
    const isResource = post.post_type === 'resource';
    const canPersistResourceAction = isResource && !post.id.startsWith('sample-');
    const isSaved = collegeClubPostActionSet.has(`${post.id}:saved`);
    const isUseful = collegeClubPostActionSet.has(`${post.id}:useful`);
    const saveCount = sampleInteractionCount(post.id, 11) + (isSaved ? 1 : 0);
    const usefulCount = sampleInteractionCount(post.id, 7) + (isUseful ? 1 : 0);
    const detailBlocks = buildClubPostDetailBlocks(post, post.club?.name ?? 'this club');
    const quickFacts = [
      { icon: UsersRound, label: 'Source', value: post.club?.name ?? 'College club' },
      { icon: CalendarClock, label: isEvent ? 'Date' : 'Published', value: eventDate ? clubActivityDateLabel(eventDate) : clubActivityDateLabel(post.created_at) },
      { icon: Clock3, label: isEvent ? 'Time' : 'Access', value: eventTime || (resourceUrl ? 'Link attached' : 'Inside Pulse') },
      { icon: isResource ? FileText : Gauge, label: isResource ? 'Type' : 'Format', value: resourceType || eventMode || detailLabel },
      ...(isResource ? [{ icon: Trophy, label: 'Saved', value: `${saveCount} saves` }] : [])
    ];
    const checklist = isEvent
      ? [
          'Check the session date, time, and participation mode.',
          'Use the details section before joining or asking the club team.',
          'Follow the club workspace for future updates from the same team.'
        ]
      : isResource
        ? [
            'Open the attached link or use the notes shared by the club.',
            'Save the resource context before using it for prep or projects.',
            'Check the source club if you need related sessions or support.'
          ]
        : [
            'Review the full update shared by the club team.',
            'Use the club workspace to follow related activity.',
            'Check back for edits or follow-up announcements.'
          ];
    const summaryItems = isEvent
      ? [
          { icon: CalendarClock, label: 'When', value: [eventDate ? clubActivityDateLabel(eventDate) : 'Date TBA', eventTime].filter(Boolean).join(' · ') },
          { icon: Gauge, label: 'Mode', value: eventMode || 'Format TBA' },
          { icon: UsersRound, label: 'Where', value: eventLocation || 'Venue or link TBA' }
        ]
      : isResource
        ? [
            { icon: FileText, label: 'What', value: resourceType || 'Resource' },
            { icon: LinkIcon, label: 'Access', value: resourceUrl ? 'External link attached' : 'Inside Pulse' },
            { icon: UsersRound, label: 'Source', value: post.club?.name ?? 'College club' }
          ]
        : [];

    return (
      <article className="pulse-college-detail-panel pulse-opportunity-detail-page" id="college-post-detail">
        <div className="pulse-opportunity-detail-hero">
          <div>
            <nav className="pulse-detail-breadcrumb" aria-label="Detail location">
              <span>My College</span>
              <span>{detailLabel}s</span>
              <span>{post.club?.name ?? 'College club'}</span>
            </nav>
            <PulseBadge tone={post.post_type === 'event' ? 'green' : post.post_type === 'resource' ? 'gold' : 'coral'}>
              {detailLabel}
            </PulseBadge>
            <h1>{post.title}</h1>
            <p>{post.body}</p>
            <div className="pulse-opportunity-detail-hero__meta">
              <span><UsersRound size={17} /> {post.club?.name ?? 'College club'}</span>
              <span><ShieldCheck size={17} /> My college only</span>
            </div>
            {summaryItems.length ? (
              <div className="pulse-post-detail-summary" aria-label={`${detailLabel} summary`}>
                {summaryItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <span key={item.label}>
                      <Icon size={16} />
                      <small>{item.label}</small>
                      <strong>{item.value}</strong>
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>

          <PulseCard className="pulse-opportunity-action-card">
            <span>{isEvent ? <CalendarClock size={18} /> : isResource ? <FileStack size={18} /> : <Megaphone size={18} />} Next step</span>
            <strong>{isEvent ? (eventDate ? [clubActivityDateLabel(eventDate), eventTime].filter(Boolean).join(' · ') : 'Check event details') : isResource ? (isSaved ? 'Saved to your activity' : resourceUrl ? 'Open or save this resource' : 'Review this resource') : 'Published update'}</strong>
            {resourceUrl ? (
              <a className="pulse-button pulse-button--primary" href={resourceUrl} target="_blank" rel="noreferrer">
                <span>Open resource</span>
                <ArrowRight size={18} />
              </a>
            ) : (
              <button className="pulse-button pulse-button--primary" type="button" onClick={closeCollegePostDetail}>
                <span>{isEvent ? 'Back to events' : 'Back to list'}</span>
                <ArrowRight size={18} />
              </button>
            )}
            <button
              className="pulse-button pulse-button--ghost"
              type="button"
              onClick={() => copyCollegeDetailLink(`post-${post.id}`, collegePostDetailPath(post), 'Copy this detail link')}
            >
              <span>{copiedCollegeDetailId === `post-${post.id}` ? 'Copied link' : 'Copy link'}</span>
              <LinkIcon size={18} />
            </button>
            {previousCollegePost ? (
              <button className="pulse-button pulse-button--ghost" type="button" onClick={openPreviousCollegePost}>
                <span>Back to previous item</span>
                <ArrowLeft size={18} />
              </button>
            ) : null}
            {post.club?.slug ? (
              <Link className="pulse-button pulse-button--ghost" to={`/pulse/clubs/${post.club.slug}?post=${post.id}`}>
                <span>Open in source club</span>
                <ArrowRight size={18} />
              </Link>
            ) : null}
            {isResource ? (
              <>
                <button
                  className={isSaved ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--ghost'}
                  disabled={!canPersistResourceAction || toggleCollegeClubPostAction.isPending}
                  type="button"
                  onClick={() => toggleCollegeClubPostAction.mutate({ actionType: 'saved', clubPostId: post.id, isActive: isSaved })}
                >
                  <span>{canPersistResourceAction ? (isSaved ? 'Saved resource' : 'Save resource') : 'Preview only'}</span>
                  <FileStack size={18} />
                </button>
                <button
                  className={isUseful ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--ghost'}
                  disabled={!canPersistResourceAction || toggleCollegeClubPostAction.isPending}
                  type="button"
                  onClick={() => toggleCollegeClubPostAction.mutate({ actionType: 'useful', clubPostId: post.id, isActive: isUseful })}
                >
                  <span>{canPersistResourceAction ? (isUseful ? 'Marked useful' : 'Mark useful') : 'Preview only'}</span>
                  <Trophy size={18} />
                </button>
              </>
            ) : null}
            {toggleCollegeClubPostAction.error ? <p className="pulse-form-error">{toggleCollegeClubPostAction.error.message}</p> : null}
            <button className="pulse-button pulse-button--ghost" type="button" onClick={closeCollegePostDetail}>
              <span>Close details</span>
            </button>
          </PulseCard>
        </div>

        <div className="pulse-opportunity-info-grid">
          {quickFacts.map((item) => {
            const Icon = item.icon;
            return (
              <PulseCard key={`${item.label}-${item.value}`}>
                <Icon size={20} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </PulseCard>
            );
          })}
        </div>

        <div className="pulse-opportunity-detail-grid">
          <PulseCard className="pulse-opportunity-brief-card">
            <PulseBadge tone="coral">What to expect</PulseBadge>
            <h2>{isEvent ? 'Use this before joining the session.' : isResource ? 'Use this before opening the material.' : 'Use this update for next steps.'}</h2>
            <div className="pulse-opportunity-checklist">
              {checklist.map((item) => (
                <span key={item}><CheckCircle2 size={17} /> {item}</span>
              ))}
            </div>
          </PulseCard>
          <PulseCard className="pulse-opportunity-brief-card">
            <PulseBadge tone="gold">Key details</PulseBadge>
            <h2>{isEvent ? eventLocation || 'Venue or link will be shared by the club.' : resourceType || 'Club resource'}</h2>
            <div className="pulse-opportunity-checklist">
              <span><UsersRound size={17} /> Shared by {post.author?.display_name ?? 'Club admin'}</span>
              <span><Clock3 size={17} /> Posted {clubActivityDateLabel(post.created_at)}</span>
              <span><ShieldCheck size={17} /> Visible inside {collegeName}</span>
              {isResource ? <span><Trophy size={17} /> {usefulCount} students found this useful</span> : null}
            </div>
          </PulseCard>
        </div>

        <PulseCard className="pulse-opportunity-detail-description-card">
          <div>
            <PulseBadge tone="coral">{detailLabel} details</PulseBadge>
            <h2>Read the full note from the club.</h2>
          </div>
          <div className="pulse-opportunity-detail-description">
            <p>{post.body}</p>
          </div>
        </PulseCard>

        <div className="pulse-opportunity-detail-grid">
          {detailBlocks.map((block) => (
            <PulseCard className="pulse-opportunity-brief-card" key={`${post.id}-${block.badge}`}>
              <PulseBadge tone="gold">{block.badge}</PulseBadge>
              <h2>{block.title}</h2>
              <div className="pulse-opportunity-checklist">
                {block.items.map((item) => (
                  <span key={item}><ClipboardCheck size={17} /> {item}</span>
                ))}
              </div>
            </PulseCard>
          ))}
        </div>

        {renderRelatedCollegePosts(post)}
      </article>
    );
  }

  function renderCollegePostAction(post: PulseClubPost) {
    const resourceUrl = typeof post.metadata.resource_url === 'string' ? post.metadata.resource_url : null;

    if (resourceUrl) {
      return (
        <a
          href={resourceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => rememberQuickAccessItem({
            kind: 'resource',
            key: `post-${post.id}`,
            meta: `${post.club?.name ?? 'College resource'} · Opened`,
            title: post.title,
            to: `/pulse/clubs?section=resources&post=${post.id}`
          })}
        >
          Open resource <ArrowRight size={15} />
        </a>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          rememberQuickAccessItem({
            kind: post.post_type === 'event' ? 'event' : post.post_type === 'resource' ? 'resource' : 'club',
            key: `post-${post.id}`,
            meta: `${post.club?.name ?? 'College club'} · ${clubPostDateMeta(post)}`,
            title: post.title,
            to: `/pulse/clubs?section=${post.post_type === 'event' ? 'events' : post.post_type === 'resource' ? 'resources' : 'announcements'}&post=${post.id}`
          });
          setSelectedCollegePost(post);
          setPreviousCollegePost(null);
        }}
      >
        {post.post_type === 'event' ? 'View event details' : post.post_type === 'resource' ? 'View resource details' : 'View details'}
        <ArrowRight size={15} />
      </button>
    );
  }

  function renderPostAggregate(posts: PulseClubPost[], isLoading: boolean, section: typeof workspaceSectionCopy.announcements) {
    const showingSamplePosts = posts.some(isSampleRecord);

    if (isLoading) {
      return (
        <div className="pulse-college-placeholder-grid">
          <article>
            <span>Loading</span>
            <strong>Checking college activity</strong>
            <p>Pulse is loading posts from all clubs in this college workspace.</p>
          </article>
        </div>
      );
    }

    if (!posts.length) {
      return (
        <div className="pulse-college-placeholder-grid">
          {section.examples.map((example) => (
            <article key={example}>
              <span>{selectedSectionMeta.label}</span>
              <strong>{example}</strong>
              <p>Sample card for layout review. Real club posts will appear here once club admins publish them.</p>
            </article>
          ))}
        </div>
      );
    }

    const searchedPosts = filterCollegePostsBySearch(posts);
    const visiblePosts = activeSection === 'resources' ? sortCollegePosts(filterCollegeResources(searchedPosts)) : sortCollegePosts(searchedPosts);

    return (
      <>
        {showingSamplePosts ? renderSamplePreviewNotice(
          'Sample preview data',
          `These ${section.title.toLowerCase()} show how this module will look once clubs publish live items.`
        ) : null}
        {activeSection === 'events' ? renderEventSort() : null}
        {activeSection === 'resources' ? renderResourceFilter() : null}
        {selectedCollegePost && posts.some((post) => post.id === selectedCollegePost.id) ? renderCollegePostDetail(selectedCollegePost) : null}
        {activeSection === 'resources' && !visiblePosts.length ? (
          <div className="pulse-college-filter-empty">
            <FileStack size={18} />
            <div>
              <strong>No resources match this filter.</strong>
              <p>Use all resources to browse everything, then save or mark useful items from the detail view.</p>
              <div className="pulse-college-filter-empty__actions">
                {collegeResourceFilter !== 'all' ? (
                  <button type="button" onClick={() => setCollegeResourceFilter('all')}>
                    Show all resources
                  </button>
                ) : null}
                {activeClubFilter !== 'all' ? (
                  <button type="button" onClick={() => setActiveClubFilter('all')}>
                    View all clubs
                  </button>
                ) : null}
                {moduleSearchQuery ? (
                  <button type="button" onClick={() => setModuleSearchQuery('')}>
                    Clear search
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {activeSection === 'events' && !visiblePosts.length ? (
          <div className="pulse-college-filter-empty">
            <CalendarClock size={18} />
            <div>
              <strong>No events match this search.</strong>
              <p>Try another keyword, switch clubs, or clear search to see all listed events.</p>
              <div className="pulse-college-filter-empty__actions">
                {moduleSearchQuery ? (
                  <button type="button" onClick={() => setModuleSearchQuery('')}>
                    Clear search
                  </button>
                ) : null}
                {activeClubFilter !== 'all' ? (
                  <button type="button" onClick={() => setActiveClubFilter('all')}>
                    View all clubs
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <div className="pulse-college-post-list">
          {visiblePosts.map((post) => {
            const detailItems = collegePostCardDetailItems(post);
            return (
              <article key={post.id}>
                <div>
                  <PulseBadge tone={post.post_type === 'announcement' ? 'coral' : post.post_type === 'event' ? 'green' : 'gold'}>
                    {post.club?.name ?? 'College club'}
                  </PulseBadge>
                  <h3>{post.title}</h3>
                  <p>{post.body}</p>
                  <div className="pulse-college-post-meta">
                    <span><UsersRound size={15} /> {post.club?.name ?? 'College club'}</span>
                    <span><CalendarClock size={15} /> {clubPostDateMeta(post)}</span>
                    <span><Clock3 size={15} /> {clubPostFormatMeta(post)}</span>
                  </div>
                  {detailItems.length ? (
                    <div className="pulse-college-card-details" aria-label="Key student details">
                      {detailItems.map((item) => (
                        <span key={item}><CheckCircle2 size={14} /> {item}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {renderCollegePostAction(post)}
              </article>
            );
          })}
        </div>
      </>
    );
  }

  function submitCampusDiscussion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campusComposerTitle.trim() || !campusComposerBody.trim()) return;

    createCampusPost.mutate(
      {
        anonymous: false,
        body: campusComposerBody,
        pollOptions: campusPollOptions,
        postType: campusComposerType,
        title: campusComposerTitle,
        visibility: 'college'
      },
      {
        onSuccess: () => {
          setCampusComposerBody('');
          setCampusComposerTitle('');
          setCampusComposerType('discussion');
          setCampusPollOptions(['Resume prep', 'Club projects', 'Interview practice', 'Campus events']);
        }
      }
    );
  }

  function filterCampusDiscussions(posts: PulsePost[]) {
    const interactionMap = campusInteractionsQuery.data;
    const filtered = posts.filter((post) => {
      if (campusDiscussionFilter === 'polls') return post.post_type === 'poll';
      if (campusDiscussionFilter === 'unanswered') return (interactionMap?.get(post.id)?.commentCount ?? 0) === 0;
      return true;
    });

    if (campusDiscussionFilter === 'popular') {
      return [...filtered].sort((left, right) => {
        const leftScore = (interactionMap?.get(left.id)?.commentCount ?? 0) + (interactionMap?.get(left.id)?.reactionCount ?? 0);
        const rightScore = (interactionMap?.get(right.id)?.commentCount ?? 0) + (interactionMap?.get(right.id)?.reactionCount ?? 0);
        return rightScore - leftScore;
      });
    }

    return filtered;
  }

  function renderCampusDiscussions() {
    const visibleDiscussions = filterCampusDiscussions(campusPulsePosts);
    const filterOptions: Array<{ label: string; value: CampusDiscussionFilter }> = [
      { label: 'Recent', value: 'recent' },
      { label: 'Popular', value: 'popular' },
      { label: 'Unanswered', value: 'unanswered' },
      { label: 'Polls', value: 'polls' }
    ];

    if (campusFeedQuery.isLoading || campusInteractionsQuery.isLoading) {
      return (
        <div className="pulse-campus-discussion-state">
          <strong>Loading campus conversations</strong>
          <span>Pulse is checking discussions from your college workspace.</span>
        </div>
      );
    }

    return (
      <div className="pulse-campus-discussions">
        <form className="pulse-campus-discussion-composer" id="campus-composer" onSubmit={submitCampusDiscussion}>
          <div className="pulse-campus-discussion-composer__top">
            <div>
              <strong>Share with {collegeName}</strong>
              <span>Start a college-only thread here, or open the right module for official club items.</span>
            </div>
            <select value={campusComposerType} onChange={(event) => setCampusComposerType(event.target.value as PulsePostInput['postType'])}>
              <option value="discussion">Ask / Discuss</option>
              <option value="poll">Run a poll</option>
              <option value="article">Share an idea</option>
            </select>
          </div>
          <div className="pulse-campus-share-routes" aria-label="Share update routes">
            <button type="button" onClick={() => { setCampusComposerType('discussion'); setCampusComposerTitle(''); }}>
              <MessageCircle size={16} />
              <span>
                <strong>Discussion</strong>
                <small>Peer thread</small>
              </span>
            </button>
            <button type="button" onClick={() => { setCampusComposerType('poll'); setCampusComposerTitle(''); }}>
              <BarChart3 size={16} />
              <span>
                <strong>Poll</strong>
                <small>College vote</small>
              </span>
            </button>
            <Link to="/pulse/clubs?section=announcements">
              <Megaphone size={16} />
              <span>
                <strong>Announcement</strong>
                <small>Official club update</small>
              </span>
            </Link>
            <Link to="/pulse/clubs?section=events">
              <CalendarClock size={16} />
              <span>
                <strong>Event</strong>
                <small>Club session</small>
              </span>
            </Link>
            <Link to="/pulse/clubs?section=resources">
              <FileStack size={16} />
              <span>
                <strong>Resource</strong>
                <small>File or link</small>
              </span>
            </Link>
            <Link to="/pulse/clubs?section=opportunities">
              <BriefcaseBusiness size={16} />
              <span>
                <strong>Opportunity</strong>
                <small>Role or project</small>
              </span>
            </Link>
          </div>
          <div className="pulse-campus-discussion-starters" aria-label="Campus discussion starters">
            <span>Start with</span>
            <button type="button" onClick={() => { setCampusComposerType('discussion'); setCampusComposerTitle('What should we discuss as a campus this week?'); }}>
              <MessageCircle size={15} /> Ask a question
            </button>
            <button type="button" onClick={() => { setCampusComposerType('poll'); setCampusComposerTitle('What should the next campus discussion focus on?'); }}>
              <BarChart3 size={15} /> Run a poll
            </button>
            <button type="button" onClick={() => { setCampusComposerType('discussion'); setCampusComposerTitle('Looking for teammates for a campus project'); }}>
              <UsersRound size={15} /> Find teammates
            </button>
            <button type="button" onClick={() => { setCampusComposerType('article'); setCampusComposerTitle('Idea for improving our campus learning experience'); }}>
              <BriefcaseBusiness size={15} /> Share an idea
            </button>
          </div>
          <div className="pulse-campus-discussion-fields">
            <input
              minLength={3}
              onChange={(event) => setCampusComposerTitle(event.target.value)}
              placeholder="Give your campus thread a clear title"
              required
              value={campusComposerTitle}
            />
            <textarea
              minLength={1}
              onChange={(event) => setCampusComposerBody(event.target.value)}
              placeholder="Write what students from your college should discuss, answer, vote on, or coordinate."
              required
              rows={3}
              value={campusComposerBody}
            />
          </div>
          {campusComposerType === 'poll' ? (
            <div className="pulse-campus-discussion-poll-options">
              {campusPollOptions.map((option, index) => (
                <input
                  key={`campus-poll-option-${index + 1}`}
                  onChange={(event) =>
                    setCampusPollOptions((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                  }
                  placeholder={`Option ${index + 1}`}
                  value={option}
                />
              ))}
            </div>
          ) : null}
          <div className="pulse-campus-discussion-composer__footer">
            <span><ShieldCheck size={15} /> Visible to your college only</span>
            <button className="pulse-button pulse-button--primary" disabled={createCampusPost.isPending} type="submit">
              {createCampusPost.isPending ? 'Posting' : 'Post'} <Send size={17} />
            </button>
          </div>
          {createCampusPost.error ? <p className="pulse-form-error">{createCampusPost.error.message}</p> : null}
        </form>

        <div className="pulse-campus-discussion-filters" aria-label="Campus discussion filters">
          {filterOptions.map((filter) => (
            <button
              className={campusDiscussionFilter === filter.value ? 'active' : undefined}
              key={filter.value}
              onClick={() => setCampusDiscussionFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="pulse-campus-thread-list">
          {!visibleDiscussions.length ? (
            <article>
              <div className="pulse-campus-thread-list__icon"><MessageCircle size={20} /></div>
              <div>
                <strong>No campus discussions match this filter.</strong>
                <p>Go back to recent threads, or use the composer above to start a new college-only conversation.</p>
                <div className="pulse-college-filter-empty__actions">
                  {campusDiscussionFilter !== 'recent' ? (
                    <button type="button" onClick={() => setCampusDiscussionFilter('recent')}>
                      Show recent threads
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setCampusComposerType('discussion');
                      setCampusComposerTitle('What should we discuss as a campus this week?');
                      setCampusComposerBody('');
                    }}
                  >
                    Start a thread
                  </button>
                </div>
              </div>
            </article>
          ) : null}
          {visibleDiscussions.map((post) => (
            <CampusThreadCard
              interaction={campusInteractionsQuery.data?.get(post.id)}
              key={post.id}
              post={post}
              profile={activeProfile}
            />
          ))}
        </div>
      </div>
    );
  }

  function filteredByClub<T extends { club_id: string }>(items: T[]) {
    return activeClubFilter === 'all' ? items : items.filter((item) => item.club_id === activeClubFilter);
  }

  function matchesModuleSearch(values: Array<string | null | undefined>) {
    const query = moduleSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return values.some((value) => value?.toLowerCase().includes(query));
  }

  function filterCollegePostsBySearch(posts: PulseClubPost[]) {
    return posts.filter((post) =>
      matchesModuleSearch([
        post.title,
        post.body,
        post.club?.name,
        clubPostTypeLabels[post.post_type],
        typeof post.metadata.event_date === 'string' ? post.metadata.event_date : null,
        typeof post.metadata.event_location === 'string' ? post.metadata.event_location : null,
        typeof post.metadata.event_mode === 'string' ? post.metadata.event_mode : null,
        typeof post.metadata.resource_type === 'string' ? post.metadata.resource_type : null,
        clubPostDateMeta(post),
        clubPostFormatMeta(post)
      ])
    );
  }

  function filterCollegeOpportunitiesBySearch(opportunities: PulseOpportunity[]) {
    return opportunities.filter((opportunity) =>
      matchesModuleSearch([
        opportunity.title,
        opportunity.description,
        opportunity.company_name,
        opportunity.club?.name,
        collegeOpportunityTypeLabels[opportunity.opportunity_type],
        opportunityCloseLabel(opportunity.closes_at),
        clubActivityDateLabel(opportunity.created_at)
      ])
    );
  }

  function filterCollegeMembersBySearch(members: PulseClubMembership[]) {
    return members.filter((member) =>
      matchesModuleSearch([
        member.profile?.display_name,
        member.profile?.headline,
        member.title,
        member.role,
        member.club?.name
      ])
    );
  }

  function postSortTime(post: PulseClubPost) {
    const dateValue = readClubPostDateMetadata(post) ?? post.created_at;
    const timestamp = new Date(dateValue).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  function opportunitySortTime(value?: string | null) {
    if (!value) return Number.POSITIVE_INFINITY;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
  }

  function sortCollegePosts(posts: PulseClubPost[]) {
    const sorted = [...posts];

    if (activeSection === 'events') {
      if (collegeEventSort === 'date') return sorted.sort((left, right) => postSortTime(left) - postSortTime(right));
      if (collegeEventSort === 'club') return sorted.sort((left, right) => (left.club?.name ?? '').localeCompare(right.club?.name ?? ''));
      return sorted.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    }

    if (activeSection === 'resources') {
      if (collegeResourceSort === 'saved') {
        return sorted.sort((left, right) => {
          const rightSaved = collegeClubPostActionSet.has(`${right.id}:saved`) ? 1 : 0;
          const leftSaved = collegeClubPostActionSet.has(`${left.id}:saved`) ? 1 : 0;
          return rightSaved - leftSaved || new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        });
      }
      if (collegeResourceSort === 'club') return sorted.sort((left, right) => (left.club?.name ?? '').localeCompare(right.club?.name ?? ''));
      if (collegeResourceSort === 'type') {
        return sorted.sort((left, right) => {
          const leftType = typeof left.metadata.resource_type === 'string' ? left.metadata.resource_type : '';
          const rightType = typeof right.metadata.resource_type === 'string' ? right.metadata.resource_type : '';
          return leftType.localeCompare(rightType) || new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        });
      }
    }

    return sorted.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }

  function filterCollegeResources(posts: PulseClubPost[]) {
    const filtered = posts.filter((post) => {
      if (collegeResourceFilter === 'saved') return collegeClubPostActionSet.has(`${post.id}:saved`);
      if (collegeResourceFilter === 'useful') return collegeClubPostActionSet.has(`${post.id}:useful`);
      return true;
    });

    if (collegeResourceFilter === 'recent') {
      return [...filtered].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    }

    return filtered;
  }

  function sortCollegeOpportunities(opportunities: PulseOpportunity[]) {
    const sorted = [...opportunities];
    if (collegeOpportunitySort === 'newest') {
      return sorted.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    }
    if (collegeOpportunitySort === 'interested') {
      return sorted.sort((left, right) => {
        const rightInterested = opportunityApplicationMap.has(right.id) ? 1 : 0;
        const leftInterested = opportunityApplicationMap.has(left.id) ? 1 : 0;
        return rightInterested - leftInterested || opportunitySortTime(left.closes_at) - opportunitySortTime(right.closes_at);
      });
    }
    if (collegeOpportunitySort === 'club') {
      return sorted.sort((left, right) => (left.club?.name ?? '').localeCompare(right.club?.name ?? ''));
    }
    return sorted.sort((left, right) => opportunitySortTime(left.closes_at) - opportunitySortTime(right.closes_at));
  }

  function filterCollegeOpportunities(opportunities: PulseOpportunity[]) {
    const now = new Date();
    const filtered = opportunities
      .filter((opportunity) => {
        if (collegeOpportunityFilter === 'interested') return opportunityApplicationMap.has(opportunity.id);
        if (collegeOpportunityFilter === 'open') {
          if (!opportunity.closes_at) return true;
          const closesAt = new Date(opportunity.closes_at);
          return Number.isNaN(closesAt.getTime()) || closesAt >= now;
        }
        return true;
      });

    return sortCollegeOpportunities(filtered);
  }

  function renderResourceFilter() {
    const options: Array<{ label: string; value: CollegeResourceFilter }> = [
      { label: 'All resources', value: 'all' },
      { label: 'Saved', value: 'saved' },
      { label: 'Useful', value: 'useful' },
      { label: 'Recent', value: 'recent' }
    ];

    return (
      <div className="pulse-college-action-filter" aria-label="Resource filters">
        {renderModuleSearch('Search resources')}
        {options.map((option) => (
          <button
            className={collegeResourceFilter === option.value ? 'active' : undefined}
            key={option.value}
            onClick={() => setCollegeResourceFilter(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
        <label className="pulse-college-sort-control">
          <span>Sort by</span>
          <select value={collegeResourceSort} onChange={(event) => setCollegeResourceSort(event.target.value as CollegeResourceSort)}>
            <option value="newest">Newest</option>
            <option value="saved">Saved first</option>
            <option value="club">Club</option>
            <option value="type">Type</option>
          </select>
        </label>
      </div>
    );
  }

  function renderEventSort() {
    return (
      <div className="pulse-college-action-filter" aria-label="Event sorting">
        {renderModuleSearch('Search events')}
        <label className="pulse-college-sort-control">
          <span>Sort by</span>
          <select value={collegeEventSort} onChange={(event) => setCollegeEventSort(event.target.value as CollegeEventSort)}>
            <option value="date">Event date</option>
            <option value="newest">Newest</option>
            <option value="club">Club</option>
          </select>
        </label>
      </div>
    );
  }

  function renderOpportunityFilter() {
    const options: Array<{ label: string; value: CollegeOpportunityFilter }> = [
      { label: 'All opportunities', value: 'all' },
      { label: 'Interested', value: 'interested' },
      { label: 'Open', value: 'open' },
      { label: 'Deadline soon', value: 'deadline' }
    ];

    return (
      <div className="pulse-college-action-filter" aria-label="Opportunity filters">
        {renderModuleSearch('Search opportunities')}
        {options.map((option) => (
          <button
            className={collegeOpportunityFilter === option.value ? 'active' : undefined}
            key={option.value}
            onClick={() => setCollegeOpportunityFilter(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
        <label className="pulse-college-sort-control">
          <span>Sort by</span>
          <select value={collegeOpportunitySort} onChange={(event) => setCollegeOpportunitySort(event.target.value as CollegeOpportunitySort)}>
            <option value="deadline">Deadline soon</option>
            <option value="newest">Newest</option>
            <option value="interested">Interested first</option>
            <option value="club">Club</option>
          </select>
        </label>
      </div>
    );
  }

  function renderModuleSearch(placeholder: string) {
    return (
      <label className="pulse-college-module-search">
        <Search size={15} />
        <span className="sr-only">{placeholder}</span>
        <input
          onChange={(event) => setModuleSearchQuery(event.target.value)}
          placeholder={placeholder}
          value={moduleSearchQuery}
        />
        {moduleSearchQuery ? (
          <button aria-label="Clear module search" type="button" onClick={() => setModuleSearchQuery('')}>
            Clear
          </button>
        ) : null}
      </label>
    );
  }

  function renderSamplePreviewNotice(title: string, body: string) {
    return (
      <div className="pulse-college-sample-notice">
        <Sparkles size={16} />
        <div>
          <strong>{title}</strong>
          <span>{body}</span>
        </div>
      </div>
    );
  }

  function moduleStatItems(section: CollegeWorkspaceSection) {
    const sectionPosts =
      section === 'announcements'
        ? filteredByClub((announcementsQuery.data?.length ? announcementsQuery.data : previewPosts.announcements) ?? [])
        : section === 'events'
          ? filteredByClub((eventsQuery.data?.length ? eventsQuery.data : previewPosts.events) ?? [])
          : section === 'resources'
            ? filteredByClub((resourcesQuery.data?.length ? resourcesQuery.data : previewPosts.resources) ?? [])
            : [];
    const sectionOpportunities =
      section === 'opportunities'
        ? (activeClubFilter === 'all'
            ? (collegeOpportunitiesQuery.data?.length ? collegeOpportunitiesQuery.data : previewOpportunities)
            : (collegeOpportunitiesQuery.data?.length ? collegeOpportunitiesQuery.data : previewOpportunities)
              .filter((opportunity) => opportunity.club_id === activeClubFilter))
        : [];
    const sectionMembers =
      section === 'members'
        ? filteredByClub((collegeMembersQuery.data?.length ? collegeMembersQuery.data : previewMembers) ?? [])
        : [];
    const savedResources = sectionPosts.filter((post) => collegeClubPostActionSet.has(`${post.id}:saved`)).length;
    const usefulResources = sectionPosts.filter((post) => collegeClubPostActionSet.has(`${post.id}:useful`)).length;
    const openOpportunities = sectionOpportunities.filter((opportunity) => {
      if (!opportunity.closes_at) return true;
      const closesAt = new Date(opportunity.closes_at);
      return Number.isNaN(closesAt.getTime()) || closesAt >= new Date();
    }).length;
    const interestedOpportunities = sectionOpportunities.filter((opportunity) => opportunityApplicationMap.has(opportunity.id)).length;
    const unansweredDiscussions = campusPulsePosts.filter((post) => (campusInteractionsQuery.data?.get(post.id)?.commentCount ?? 0) === 0).length;
    const activeMembers = sectionMembers.filter((member) => member.status === 'active').length;
    const clubCount = displayedClubs.length;

    if (section === 'clubs') {
      return [
        { label: 'Active workspaces', value: clubCount },
        { label: 'Club categories', value: new Set(displayedClubs.map((club) => club.category)).size },
        { label: 'Open to browse', value: displayedClubs.filter((club) => club.status === 'active').length }
      ];
    }

    if (section === 'discussions') {
      return [
        { label: 'Campus threads', value: campusPulsePosts.length },
        { label: 'Unanswered', value: unansweredDiscussions },
        { label: 'Polls', value: campusPulsePosts.filter((post) => post.post_type === 'poll').length }
      ];
    }

    if (section === 'events') {
      return [
        { label: 'Listed events', value: sectionPosts.length },
        { label: 'Upcoming', value: sectionPosts.filter((post) => !isClubPostExpired(post)).length },
        { label: 'Past/expired', value: sectionPosts.filter((post) => isClubPostExpired(post)).length }
      ];
    }

    if (section === 'resources') {
      return [
        { label: 'All resources', value: sectionPosts.length },
        { label: 'Saved by you', value: savedResources },
        { label: 'Marked useful', value: usefulResources }
      ];
    }

    if (section === 'opportunities') {
      return [
        { label: 'Open opportunities', value: openOpportunities },
        { label: 'Interested by you', value: interestedOpportunities },
        { label: 'Total listed', value: sectionOpportunities.length }
      ];
    }

    if (section === 'announcements') {
      return [
        { label: 'Published updates', value: sectionPosts.length },
        { label: 'Sources', value: new Set(sectionPosts.map((post) => post.club_id)).size },
        { label: 'Pinned/priority', value: sectionPosts.filter((post) => post.pinned).length }
      ];
    }

    if (section === 'members') {
      return [
        { label: 'Visible members', value: sectionMembers.length },
        { label: 'Active members', value: activeMembers },
        { label: 'Club teams', value: new Set(sectionMembers.map((member) => member.club_id)).size }
      ];
    }

    return [];
  }

  function renderModuleStats(section: CollegeWorkspaceSection) {
    const items = moduleStatItems(section);
    if (!items.length) return null;

    return (
      <div className="pulse-college-module-stats" aria-label={`${selectedSectionMeta.label} summary`}>
        {items.map((item) => (
          <span key={item.label}>
            <strong>{item.value}</strong>
            {item.label}
          </span>
        ))}
      </div>
    );
  }

  function renderSourceFilter() {
    return (
      <div className="pulse-college-source-filter">
        <button className={activeClubFilter === 'all' ? 'active' : ''} type="button" onClick={() => setActiveClubFilter('all')}>
          All clubs
        </button>
        {displayedClubs.map((club) => (
          <button
            className={activeClubFilter === club.id ? 'active' : ''}
            key={club.id}
            onClick={() => setActiveClubFilter(club.id)}
            type="button"
          >
            {club.name.replace(' Club', '')}
          </button>
        ))}
      </div>
    );
  }

  function renderMembersAggregate(members: PulseClubMembership[], isLoading: boolean) {
    const showingSampleMembers = members.some(isSampleRecord);

    if (isLoading) {
      return (
        <div className="pulse-college-member-grid">
          <article>
            <div className="pulse-member-avatar">P</div>
            <div>
              <strong>Loading members</strong>
              <p>Pulse is checking active club members in this college workspace.</p>
            </div>
          </article>
        </div>
      );
    }

    if (!members.length) {
      return (
        <div className="pulse-college-placeholder-grid">
          {workspaceSectionCopy.members.examples.map((example) => (
            <article key={example}>
              <span>Members</span>
              <strong>{example}</strong>
              <p>Students will appear here once they follow or manage a club workspace.</p>
            </article>
          ))}
        </div>
      );
    }

    const visibleMembers = filterCollegeMembersBySearch(members);

    return (
      <>
        {showingSampleMembers ? renderSamplePreviewNotice(
          'Sample member roster',
          'These profiles show the intended roster layout. Live students will replace them after club memberships are added.'
        ) : null}
        <div className="pulse-college-action-filter" aria-label="Member search">
          {renderModuleSearch('Search members')}
        </div>
        {!visibleMembers.length ? (
          <div className="pulse-college-filter-empty">
            <UsersRound size={18} />
            <div>
              <strong>No members match this search.</strong>
              <p>Try searching by student name, role, headline, or club.</p>
              <div className="pulse-college-filter-empty__actions">
                <button type="button" onClick={() => setModuleSearchQuery('')}>
                  Clear search
                </button>
                {activeClubFilter !== 'all' ? (
                  <button type="button" onClick={() => setActiveClubFilter('all')}>
                    View all clubs
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <div className="pulse-college-member-grid">
        {visibleMembers.map((member) => {
          const displayName = member.profile?.display_name || 'Pulse member';
          const initials = displayName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <article key={member.id}>
              <div className="pulse-member-avatar">{initials || 'P'}</div>
              <div>
                <strong>{displayName}</strong>
                <p>{member.profile?.headline || member.title || 'Building their Pulse profile.'}</p>
                <span>{member.club?.name ?? 'College club'} · {member.role}</span>
              </div>
              <div className="pulse-college-member-actions">
                <Link to={`/pulse/u/${member.profile_id}`}>Open Pulse Profile</Link>
                {member.profile?.linkedin_url ? (
                  <a href={member.profile.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>
                ) : null}
              </div>
            </article>
          );
        })}
        </div>
      </>
    );
  }

  function renderCollegeOpportunityDetail(opportunity: PulseOpportunity) {
    const isSample = opportunity.id.startsWith('sample-');
    const sourceName = opportunity.company_name || opportunity.club?.name || 'College opportunity';
    const opportunityType = collegeOpportunityTypeLabels[opportunity.opportunity_type];
    const isInterested = Boolean(opportunityApplicationMap.get(opportunity.id));
    const interestCount = sampleInteractionCount(opportunity.id, 14) + (isInterested ? 1 : 0);
    const detailItems = [
      { icon: CalendarClock, label: 'Starts', value: clubActivityDateLabel(opportunity.starts_at) },
      { icon: Clock3, label: 'Deadline', value: opportunityCloseLabel(opportunity.closes_at) },
      { icon: Target, label: 'Format', value: opportunityType },
      { icon: UsersRound, label: 'Source', value: sourceName },
      { icon: Sparkles, label: 'Interest', value: `${interestCount} students` }
    ];
    const briefItems = [
      `Review the ${opportunityType.toLowerCase()} brief and check whether it matches your current goals.`,
      'Use the club tag to understand who owns the opportunity inside the college workspace.',
      'Open the full opportunity when it is hosted on Pulse, or use the external application link when available.'
    ];

    return (
      <article className="pulse-college-detail-panel pulse-opportunity-detail-page">
        <div className="pulse-opportunity-detail-hero">
          <div>
            <nav className="pulse-detail-breadcrumb" aria-label="Detail location">
              <span>My College</span>
              <span>Opportunities</span>
              <span>{opportunity.club?.name ?? sourceName}</span>
            </nav>
            <PulseBadge tone="green">{opportunityType}</PulseBadge>
            <h1>{opportunity.title}</h1>
            <p>{opportunity.description}</p>
            <div className="pulse-opportunity-detail-hero__meta">
              <span><BriefcaseBusiness size={17} /> {sourceName}</span>
              <span><ShieldCheck size={17} /> {opportunity.visibility === 'global' ? 'Everyone on Pulse' : 'My college only'}</span>
            </div>
          </div>

          <PulseCard className="pulse-opportunity-action-card">
            <span><Sparkles size={18} /> Opportunity status</span>
            <strong>{isInterested ? 'Interest saved' : opportunityCloseLabel(opportunity.closes_at)}</strong>
            {!isSample ? (
              <Link className="pulse-button pulse-button--primary" to={`/pulse/opportunities/${opportunity.id}`}>
                <span>Open full opportunity</span>
                <ArrowRight size={18} />
              </Link>
            ) : opportunity.application_url ? (
              <a className="pulse-button pulse-button--primary" href={opportunity.application_url} target="_blank" rel="noreferrer">
                <span>Open application link</span>
                <ArrowRight size={18} />
              </a>
            ) : (
              <button className="pulse-button pulse-button--primary" type="button" onClick={() => setSelectedCollegeOpportunity(null)}>
                <span>Back to list</span>
                <ArrowRight size={18} />
              </button>
            )}
            <button
              className={isInterested ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--ghost'}
              disabled={isSample || isInterested || markOpportunityInterest.isPending}
              type="button"
              onClick={() => markOpportunityInterest.mutate({ opportunityId: opportunity.id })}
            >
              <span>{isSample ? 'Preview only' : isInterested ? 'Interested' : "I'm interested"}</span>
              <BriefcaseBusiness size={18} />
            </button>
            {markOpportunityInterest.error ? <p className="pulse-form-error">{markOpportunityInterest.error.message}</p> : null}
            <button
              className="pulse-button pulse-button--ghost"
              type="button"
              onClick={() =>
                copyCollegeDetailLink(
                  `opportunity-${opportunity.id}`,
                  opportunity.id.startsWith('sample-') ? '/pulse/clubs?section=opportunities' : `/pulse/opportunities/${opportunity.id}`,
                  'Copy this opportunity link'
                )
              }
            >
              <span>{copiedCollegeDetailId === `opportunity-${opportunity.id}` ? 'Copied link' : 'Copy link'}</span>
              <LinkIcon size={18} />
            </button>
            <button className="pulse-button pulse-button--ghost" type="button" onClick={() => setSelectedCollegeOpportunity(null)}>
              <span>Close details</span>
            </button>
          </PulseCard>
        </div>

        <div className="pulse-opportunity-info-grid">
          {detailItems.map((item) => {
            const Icon = item.icon;
            return (
              <PulseCard key={`${item.label}-${item.value}`}>
                <Icon size={20} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </PulseCard>
            );
          })}
        </div>

        <div className="pulse-opportunity-detail-grid">
          <PulseCard className="pulse-opportunity-brief-card">
            <PulseBadge tone="coral">What you will do</PulseBadge>
            <h2>Understand the opportunity before you apply.</h2>
            <div className="pulse-opportunity-checklist">
              {briefItems.map((item) => (
                <span key={item}><CheckCircle2 size={17} /> {item}</span>
              ))}
            </div>
          </PulseCard>
          <PulseCard className="pulse-opportunity-brief-card">
            <PulseBadge tone="gold">Why it matters</PulseBadge>
            <h2>Use college opportunities to build visible proof of work.</h2>
            <div className="pulse-opportunity-checklist">
              <span><Sparkles size={17} /> Apply where your skills and availability fit.</span>
              <span><BriefcaseBusiness size={17} /> Track source club or company context.</span>
              <span><ShieldCheck size={17} /> Keep activity visible inside your college workspace.</span>
            </div>
          </PulseCard>
        </div>

        <PulseCard className="pulse-opportunity-detail-description-card">
          <div>
            <PulseBadge tone="coral">Opportunity details</PulseBadge>
            <h2>Read the full brief before taking action.</h2>
          </div>
          <div className="pulse-opportunity-detail-description">
            <p>{opportunity.detail_description || opportunity.description}</p>
          </div>
        </PulseCard>
      </article>
    );
  }

  function renderOpportunitiesAggregate(opportunities: PulseOpportunity[], isLoading: boolean) {
    const showingSampleOpportunities = opportunities.some(isSampleRecord);

    if (isLoading) {
      return (
        <div className="pulse-college-placeholder-grid">
          <article>
            <span>Loading</span>
            <strong>Checking college opportunities</strong>
            <p>Pulse is loading active opportunities available inside this college workspace.</p>
          </article>
        </div>
      );
    }

    if (!opportunities.length) {
      return (
        <div className="pulse-college-placeholder-grid">
          {workspaceSectionCopy.opportunities.examples.map((example) => (
            <article key={example}>
              <span>Opportunities</span>
              <strong>{example}</strong>
              <p>College-visible opportunities will appear here once they are published for this workspace.</p>
            </article>
          ))}
        </div>
      );
    }

    const visibleOpportunities = filterCollegeOpportunities(filterCollegeOpportunitiesBySearch(opportunities));

    return (
      <>
        {showingSampleOpportunities ? renderSamplePreviewNotice(
          'Sample opportunities',
          'These opportunity cards are previews. Live opportunities will open the full opportunity detail page.'
        ) : null}
        {renderOpportunityFilter()}
        {selectedCollegeOpportunity && opportunities.some((opportunity) => opportunity.id === selectedCollegeOpportunity.id)
          ? renderCollegeOpportunityDetail(selectedCollegeOpportunity)
          : null}
        {!visibleOpportunities.length ? (
          <div className="pulse-college-filter-empty">
            <BriefcaseBusiness size={18} />
            <div>
              <strong>No opportunities match this filter.</strong>
              <p>Open opportunities are still available. Mark interest from the detail view to build your interested list.</p>
              <div className="pulse-college-filter-empty__actions">
                {collegeOpportunityFilter !== 'open' ? (
                  <button type="button" onClick={() => setCollegeOpportunityFilter('open')}>
                    View open opportunities
                  </button>
                ) : null}
                {collegeOpportunityFilter !== 'all' ? (
                  <button type="button" onClick={() => setCollegeOpportunityFilter('all')}>
                    Show all opportunities
                  </button>
                ) : null}
                {activeClubFilter !== 'all' ? (
                  <button type="button" onClick={() => setActiveClubFilter('all')}>
                    View all clubs
                  </button>
                ) : null}
                {moduleSearchQuery ? (
                  <button type="button" onClick={() => setModuleSearchQuery('')}>
                    Clear search
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <div className="pulse-college-opportunity-list">
          {visibleOpportunities.map((opportunity) => {
            const isInterested = Boolean(opportunityApplicationMap.get(opportunity.id));
            const detailItems = collegeOpportunityCardDetailItems(opportunity, isInterested);
            return (
              <article key={opportunity.id}>
                <div>
                  <PulseBadge tone="green">{collegeOpportunityTypeLabels[opportunity.opportunity_type]}</PulseBadge>
                  {opportunity.club?.name ? <PulseBadge tone="gold">{opportunity.club.name}</PulseBadge> : null}
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.description}</p>
                  <div className="pulse-college-opportunity-meta">
                    <span><BriefcaseBusiness size={15} /> {opportunity.company_name || 'College opportunity'}</span>
                    <span><UsersRound size={15} /> {opportunity.club?.name ?? 'College-wide'}</span>
                    <span><Clock3 size={15} /> {opportunityCloseLabel(opportunity.closes_at)}</span>
                    <span><CalendarClock size={15} /> Posted {clubActivityDateLabel(opportunity.created_at)}</span>
                  </div>
                  <div className="pulse-college-card-details" aria-label="Key opportunity details">
                    {detailItems.map((item) => (
                      <span key={item}><CheckCircle2 size={14} /> {item}</span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    rememberQuickAccessItem({
                      kind: 'opportunity',
                      key: `opportunity-${opportunity.id}`,
                      meta: `${opportunity.company_name || opportunity.club?.name || 'College opportunity'} · ${opportunityCloseLabel(opportunity.closes_at)}`,
                      title: opportunity.title,
                      to: opportunity.id.startsWith('sample-') ? '/pulse/clubs?section=opportunities' : `/pulse/opportunities/${opportunity.id}`
                    });
                    setSelectedCollegeOpportunity(opportunity);
                  }}
                >
                  View details <ArrowRight size={15} />
                </button>
              </article>
            );
          })}
        </div>
      </>
    );
  }

  function renderWorkspaceBody() {
    if (activeSection === 'overview') {
      const overviewAnnouncements = (announcementsQuery.data?.length ? announcementsQuery.data : previewPosts.announcements).slice(0, 2);
      const overviewEvents = (eventsQuery.data?.length ? eventsQuery.data : previewPosts.events).slice(0, 2);
      const allOverviewResources = resourcesQuery.data?.length ? resourcesQuery.data : previewPosts.resources;
      const allOverviewOpportunities = collegeOpportunitiesQuery.data?.length ? collegeOpportunitiesQuery.data : previewOpportunities;
      const overviewResources = allOverviewResources.slice(0, 2);
      const overviewOpportunities = allOverviewOpportunities.slice(0, 3);
      const overviewThreads = campusPulsePosts.slice(0, 3);
      const unansweredThreads = campusPulsePosts.filter((post) => (campusInteractionsQuery.data?.get(post.id)?.commentCount ?? 0) === 0).slice(0, 2);
      const featuredOverviewClubs = displayedClubs;
      const savedOverviewResources = allOverviewResources.filter((resource) => collegeClubPostActionSet.has(`${resource.id}:saved`)).slice(0, 3);
      const interestedOverviewOpportunities = allOverviewOpportunities
        .filter((opportunity) => opportunityApplicationMap.has(opportunity.id))
        .slice(0, 3);
      const personalOverviewItems = [
        ...recentQuickAccessItems.map((item) => ({
          icon: quickAccessIcon(item.kind),
          key: item.key,
          meta: `${item.meta} · Recent`,
          title: item.title,
          to: item.to
        })),
        ...savedOverviewResources.map((resource) => ({
          icon: FileStack,
          key: `resource-${resource.id}`,
          meta: `${resource.club?.name ?? 'College resource'} · Saved`,
          title: resource.title,
          to: `/pulse/clubs?section=resources&post=${resource.id}`
        })),
        ...interestedOverviewOpportunities.map((opportunity) => ({
          icon: BriefcaseBusiness,
          key: `opportunity-${opportunity.id}`,
          meta: `${opportunity.company_name || opportunity.club?.name || 'College opportunity'} · Interested`,
          title: opportunity.title,
          to: `/pulse/opportunities/${opportunity.id}`
        }))
      ].filter((item, index, items) => items.findIndex((candidate) => candidate.key === item.key) === index).slice(0, 5);
      const showingSampleOverview = [
        ...featuredOverviewClubs,
        ...overviewAnnouncements,
        ...overviewEvents,
        ...overviewResources,
        ...overviewOpportunities
      ].some(isSampleRecord);

      return (
        <div className="pulse-college-overview-grid">
          {showingSampleOverview ? (
            <div className="pulse-college-overview-card--wide">
              {renderSamplePreviewNotice(
                'Sample preview data',
                'This overview is showing example clubs, posts, resources, and opportunities until live college data is added.'
              )}
            </div>
          ) : null}
          <PulseCard className="pulse-college-overview-card pulse-college-overview-card--wide pulse-college-student-command">
            <div>
              <PulseBadge tone="coral">Today’s Campus Pulse</PulseBadge>
              <h2>What should I do next?</h2>
              <p>Jump into the most useful activity from {collegeName}: events, open threads, resources, club workspaces, and opportunities.</p>
            </div>
            <div className="pulse-college-quick-actions">
              <Link to="/pulse/clubs?section=discussions"><MessageCircle size={17} /> Start discussion</Link>
              <Link to="/pulse/clubs?section=events"><CalendarClock size={17} /> View events</Link>
              <Link to="/pulse/clubs?section=resources"><FileStack size={17} /> Find resources</Link>
              <Link to="/pulse/clubs?section=opportunities"><BriefcaseBusiness size={17} /> Open opportunities</Link>
            </div>
          </PulseCard>

          <PulseCard className="pulse-college-overview-card pulse-college-overview-panel">
            <div className="pulse-college-overview-panel__header">
              <div>
                <PulseBadge tone="green">Happening now</PulseBadge>
                <h2>This week on campus</h2>
              </div>
              <Link to="/pulse/clubs?section=events">All events <ArrowRight size={15} /></Link>
            </div>
            <div className="pulse-college-overview-list">
              {overviewEvents.map((event) => (
                <Link
                  key={event.id}
                  to={`/pulse/clubs?section=events&post=${event.id}`}
                  onClick={() => rememberQuickAccessItem({
                    kind: 'event',
                    key: `post-${event.id}`,
                    meta: `${event.club?.name ?? 'College event'} · ${clubPostDateMeta(event)}`,
                    title: event.title,
                    to: `/pulse/clubs?section=events&post=${event.id}`
                  })}
                >
                  <CalendarClock size={18} />
                  <span>
                    <strong>{event.title}</strong>
                    <small>{event.club?.name ?? 'College event'} · {typeof event.metadata.event_date === 'string' ? clubActivityDateLabel(event.metadata.event_date) : 'Date TBA'}</small>
                  </span>
                </Link>
              ))}
              {overviewAnnouncements.slice(0, 1).map((announcement) => (
                <Link
                  key={announcement.id}
                  to="/pulse/clubs?section=announcements"
                  onClick={() => rememberQuickAccessItem({
                    kind: 'club',
                    key: `post-${announcement.id}`,
                    meta: `${announcement.club?.name ?? 'College announcement'} · Update`,
                    title: announcement.title,
                    to: '/pulse/clubs?section=announcements'
                  })}
                >
                  <Megaphone size={18} />
                  <span>
                    <strong>{announcement.title}</strong>
                    <small>{announcement.club?.name ?? 'College announcement'}</small>
                  </span>
                </Link>
              ))}
            </div>
          </PulseCard>

          <PulseCard className="pulse-college-overview-card pulse-college-overview-panel">
            <div className="pulse-college-overview-panel__header">
              <div>
                <PulseBadge tone="coral">Needs response</PulseBadge>
                <h2>Help your campus move</h2>
              </div>
              <Link to="/pulse/clubs?section=discussions">All threads <ArrowRight size={15} /></Link>
            </div>
            <div className="pulse-college-overview-list">
              {(unansweredThreads.length ? unansweredThreads : overviewThreads).slice(0, 3).map((thread) => (
                <Link key={thread.id} to="/pulse/clubs?section=discussions">
                  <MessageCircle size={18} />
                  <span>
                    <strong>{thread.title}</strong>
                    <small>{campusInteractionsQuery.data?.get(thread.id)?.commentCount ?? 0} replies · {pulsePostRelativeTime(thread.created_at)}</small>
                  </span>
                </Link>
              ))}
              {!campusPulsePosts.length ? (
                <Link to="/pulse/clubs?section=discussions">
                  <MessageCircle size={18} />
                  <span>
                    <strong>Start the first campus discussion</strong>
                    <small>Ask a question or find peers from your college.</small>
                  </span>
                </Link>
              ) : null}
            </div>
          </PulseCard>

          <PulseCard className="pulse-college-overview-card pulse-college-overview-panel pulse-college-overview-panel--wide">
            <div className="pulse-college-overview-panel__header">
              <div>
                <PulseBadge tone="gold">For You</PulseBadge>
                <h2>Resources and opportunities to check</h2>
              </div>
              <span className="pulse-college-overview-panel__links">
                <Link to="/pulse/clubs?section=resources">All resources <ArrowRight size={15} /></Link>
                <Link to="/pulse/clubs?section=opportunities">All opportunities <ArrowRight size={15} /></Link>
              </span>
            </div>
            <div className="pulse-college-opportunity-strip">
              {overviewOpportunities.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  to="/pulse/clubs?section=opportunities"
                  onClick={() => rememberQuickAccessItem({
                    kind: 'opportunity',
                    key: `opportunity-${opportunity.id}`,
                    meta: `${opportunity.company_name || opportunity.club?.name || 'College opportunity'} · ${opportunityCloseLabel(opportunity.closes_at)}`,
                    title: opportunity.title,
                    to: opportunity.id.startsWith('sample-') ? '/pulse/clubs?section=opportunities' : `/pulse/opportunities/${opportunity.id}`
                  })}
                >
                  <BriefcaseBusiness size={18} />
                  <span>
                    <strong>{opportunity.title}</strong>
                    <small>{opportunity.company_name || opportunity.club?.name || 'College opportunity'} · {opportunityCloseLabel(opportunity.closes_at)}</small>
                  </span>
                </Link>
              ))}
              {overviewResources.slice(0, 2).map((resource) => (
                <Link
                  key={resource.id}
                  to="/pulse/clubs?section=resources"
                  onClick={() => rememberQuickAccessItem({
                    kind: 'resource',
                    key: `post-${resource.id}`,
                    meta: `${resource.club?.name ?? 'College resource'} · ${clubPostFormatMeta(resource)}`,
                    title: resource.title,
                    to: `/pulse/clubs?section=resources&post=${resource.id}`
                  })}
                >
                  <FileStack size={18} />
                  <span>
                    <strong>{resource.title}</strong>
                    <small>{resource.club?.name ?? 'College resource'}</small>
                  </span>
                </Link>
              ))}
            </div>
          </PulseCard>

          <PulseCard className="pulse-college-overview-card pulse-college-overview-panel">
            <div className="pulse-college-overview-panel__header">
              <div>
                <PulseBadge tone="coral">Quick access</PulseBadge>
                <h2>Recently opened and saved</h2>
              </div>
              <Link to="/pulse/activity">My Activity <ArrowRight size={15} /></Link>
            </div>
            <div className="pulse-college-overview-list">
              {personalOverviewItems.length ? personalOverviewItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.key} to={item.to}>
                    <Icon size={18} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                    </span>
                  </Link>
                );
              }) : (
                <div className="pulse-college-overview-empty">
                  <Sparkles size={18} />
                  <span>
                    <strong>No quick access yet</strong>
                    <small>Open a club, view an event, save a resource, or mark interest in an opportunity.</small>
                  </span>
                </div>
              )}
            </div>
          </PulseCard>

          <PulseCard className="pulse-college-overview-card pulse-college-campus-stats">
            <article>
              <strong>{displayedClubs.length}</strong>
              <span>Club workspaces</span>
            </article>
            <article>
              <strong>{campusPulsePosts.length || sampleCollegePosts.discussions.length}</strong>
              <span>Campus threads</span>
            </article>
            <article>
              <strong>{overviewOpportunities.length}</strong>
              <span>Open opportunities</span>
            </article>
            <article>
              <strong>{overviewEvents.length}</strong>
              <span>Upcoming events</span>
            </article>
          </PulseCard>

          <PulseCard className="pulse-college-overview-card pulse-college-overview-panel">
            <div className="pulse-college-overview-panel__header">
              <div>
                <PulseBadge tone="green">Active clubs</PulseBadge>
                <h2>Explore workspaces</h2>
              </div>
              <Link to="/pulse/clubs?section=clubs">All clubs <ArrowRight size={15} /></Link>
            </div>
            <div className="pulse-college-featured-clubs">
              {featuredOverviewClubs.map((club) => (
                <Link
                  key={club.id}
                  to={`/pulse/clubs/${club.slug}`}
                  onClick={() => rememberQuickAccessItem({
                    kind: 'club',
                    key: `club-${club.id}`,
                    meta: `${categoryLabel(club.category)} · Workspace`,
                    title: club.name,
                    to: `/pulse/clubs/${club.slug}`
                  })}
                >
                  <span>{club.name}</span>
                  <small>{club.summary}</small>
                </Link>
              ))}
            </div>
          </PulseCard>
        </div>
      );
    }

    if (activeSection === 'clubs') {
      return (
        <>
          {isLoadingWorkspace ? (
            <PulseCard className="pulse-clubs-empty">
              <PulseBadge tone="gold">Loading Clubs</PulseBadge>
              <h2>Opening your college clubs.</h2>
              <p>Pulse is checking the clubs and committees connected to your college profile.</p>
            </PulseCard>
          ) : null}

          {!isLoadingWorkspace && clubsQuery.error ? (
            <PulseCard className="pulse-clubs-empty">
              <PulseBadge tone="coral">Workspace unavailable</PulseBadge>
              <h2>College clubs could not be loaded.</h2>
              <p>Please refresh once. If this continues, the Pulse club workspace migration may still need to be deployed.</p>
            </PulseCard>
          ) : null}

          {!isLoadingWorkspace && !clubsQuery.error ? (
            <>
              {displayedClubs.some(isSampleRecord) ? renderSamplePreviewNotice(
                'Sample club workspaces',
                'These clubs show the intended college workspace structure. Live clubs will replace them once configured.'
              ) : null}
              {renderModuleStats('clubs')}
              <div className="pulse-club-grid">
                {displayedClubs.map((club) => (
                  <PulseClubCard
                    club={club}
                    key={club.id}
                    onOpen={(openedClub) => rememberQuickAccessItem({
                      kind: 'club',
                      key: `club-${openedClub.id}`,
                      meta: `${categoryLabel(openedClub.category)} · Workspace`,
                      title: openedClub.name,
                      to: `/pulse/clubs/${openedClub.slug}`
                    })}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      );
    }

    const section = workspaceSectionCopy[activeSection];
    const realPosts =
      activeSection === 'announcements'
        ? { isLoading: announcementsQuery.isLoading, posts: filteredByClub((announcementsQuery.data?.length ? announcementsQuery.data : previewPosts.announcements) ?? []) }
        : activeSection === 'discussions'
          ? { isLoading: discussionsQuery.isLoading, posts: filteredByClub((discussionsQuery.data?.length ? discussionsQuery.data : previewPosts.discussions) ?? []) }
          : activeSection === 'events'
            ? { isLoading: eventsQuery.isLoading, posts: filteredByClub((eventsQuery.data?.length ? eventsQuery.data : previewPosts.events) ?? []) }
            : activeSection === 'resources'
              ? { isLoading: resourcesQuery.isLoading, posts: filteredByClub((resourcesQuery.data?.length ? resourcesQuery.data : previewPosts.resources) ?? []) }
              : null;
    const realMembers =
      activeSection === 'members'
        ? { isLoading: collegeMembersQuery.isLoading, members: filteredByClub((collegeMembersQuery.data?.length ? collegeMembersQuery.data : previewMembers) ?? []) }
        : null;
    const realOpportunities =
      activeSection === 'opportunities'
        ? {
          isLoading: collegeOpportunitiesQuery.isLoading,
          opportunities: activeClubFilter === 'all'
            ? (collegeOpportunitiesQuery.data?.length ? collegeOpportunitiesQuery.data : previewOpportunities)
            : (collegeOpportunitiesQuery.data?.length ? collegeOpportunitiesQuery.data : previewOpportunities)
              .filter((opportunity) => opportunity.club_id === activeClubFilter)
        }
        : null;

    return (
      <PulseCard className="pulse-college-placeholder">
        <PulseBadge tone="gold">{section.badge}</PulseBadge>
        <h2>{section.title}</h2>
        <p>{section.text}</p>
        {renderModuleStats(activeSection)}
        {activeSection === 'discussions' ? null : renderSourceFilter()}
        {activeSection === 'discussions' ? renderCampusDiscussions() : realPosts ? renderPostAggregate(realPosts.posts, realPosts.isLoading, section) : realMembers ? (
          renderMembersAggregate(realMembers.members, realMembers.isLoading)
        ) : realOpportunities ? (
          renderOpportunitiesAggregate(realOpportunities.opportunities, realOpportunities.isLoading)
        ) : (
          <div className="pulse-college-placeholder-grid">
            {section.examples.map((example) => (
              <article key={example}>
                <span>{selectedSectionMeta.label}</span>
                <strong>{example}</strong>
                <p>Sample card for layout review. This will connect to real {selectedSectionMeta.label.toLowerCase()} data next.</p>
              </article>
            ))}
          </div>
        )}
      </PulseCard>
    );
  }

  return (
    <section className="pulse-clubs-page">
      <div className="pulse-college-workspace-hero">
        <div>
          <PulseBadge tone="coral">My College Workspace</PulseBadge>
          <h1>{collegeName}</h1>
          <p>
            Your college-specific operating space for clubs, events, resources, opportunities, discussions, members, and announcements.
          </p>
        </div>
      </div>

      <div className="pulse-college-workspace-shell pulse-college-workspace-shell--full">
        <div className="pulse-college-workspace-content">
          <div className="pulse-college-section-header">
            <div>
              <PulseBadge tone={activeSection === 'overview' ? 'coral' : 'gold'}>{selectedSectionMeta.label}</PulseBadge>
              <h2>{selectedSectionMeta.description}</h2>
            </div>
            <span><ShieldCheck size={16} /> College-only</span>
          </div>
          {renderWorkspaceBody()}
        </div>
      </div>
    </section>
  );
}

export function PulseClubDetailPage() {
  const { clubKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const clubQuery = usePulseClubDetail(clubKey, profile);
  const membershipsQuery = usePulseClubMemberships(profile);
  const sampleClub = sampleCollegeClubs.find((item) => item.slug === clubKey) ?? null;
  const club = clubQuery.data ?? sampleClub;
  const clubMembersQuery = usePulseCollegeClubMembers(club?.id ? [club.id] : [], profile);
  const pendingMembersQuery = usePulseClubPendingMembers(club?.id, profile);
  const createClubPost = useCreatePulseClubPost(profile);
  const updateClubPost = useUpdatePulseClubPost(profile);
  const archiveClubPost = useArchivePulseClubPost(profile);
  const updateClubMembershipStatus = useUpdatePulseClubMembershipStatus(profile);
  const toggleClubMembership = useTogglePulseClubMembership(profile);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [postType, setPostType] = useState<'announcement' | 'event' | 'resource' | 'opportunity'>('announcement');
  const [postStatus, setPostStatus] = useState<'draft' | 'published'>('published');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventMode, setEventMode] = useState('Campus');
  const [eventAgendaItems, setEventAgendaItems] = useState('');
  const [eventPrepItems, setEventPrepItems] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState('Guide');
  const [resourcePreviewItems, setResourcePreviewItems] = useState('');
  const [resourceUsageItems, setResourceUsageItems] = useState('');
  const [opportunityDeadline, setOpportunityDeadline] = useState('');
  const [opportunityBriefItems, setOpportunityBriefItems] = useState('');
  const [opportunityFitItems, setOpportunityFitItems] = useState('');
  const [announcementNextActions, setAnnouncementNextActions] = useState('');
  const [announcementContextItems, setAnnouncementContextItems] = useState('');
  const [postQualityError, setPostQualityError] = useState<string | null>(null);
  const [composerTemplateNotice, setComposerTemplateNotice] = useState<string | null>(null);
  const [composerDraftSavedAt, setComposerDraftSavedAt] = useState<number | null>(null);
  const [restoredComposerDraftKey, setRestoredComposerDraftKey] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostType, setEditingPostType] = useState<PulseClubPost['post_type']>('announcement');
  const [editingPostStatus, setEditingPostStatus] = useState<'draft' | 'published' | 'archived'>('published');
  const [editingPostTitle, setEditingPostTitle] = useState('');
  const [editingPostBody, setEditingPostBody] = useState('');
  const [editingEventDate, setEditingEventDate] = useState('');
  const [editingEventTime, setEditingEventTime] = useState('');
  const [editingEventLocation, setEditingEventLocation] = useState('');
  const [editingEventMode, setEditingEventMode] = useState('Campus');
  const [editingEventAgendaItems, setEditingEventAgendaItems] = useState('');
  const [editingEventPrepItems, setEditingEventPrepItems] = useState('');
  const [editingResourceUrl, setEditingResourceUrl] = useState('');
  const [editingResourceType, setEditingResourceType] = useState('Guide');
  const [editingResourcePreviewItems, setEditingResourcePreviewItems] = useState('');
  const [editingResourceUsageItems, setEditingResourceUsageItems] = useState('');
  const [editingOpportunityDeadline, setEditingOpportunityDeadline] = useState('');
  const [editingOpportunityBriefItems, setEditingOpportunityBriefItems] = useState('');
  const [editingOpportunityFitItems, setEditingOpportunityFitItems] = useState('');
  const [editingAnnouncementNextActions, setEditingAnnouncementNextActions] = useState('');
  const [editingAnnouncementContextItems, setEditingAnnouncementContextItems] = useState('');
  const [editingPostQualityError, setEditingPostQualityError] = useState<string | null>(null);
  const [editingPostInitialSnapshot, setEditingPostInitialSnapshot] = useState<string | null>(null);
  const [memberTitleDrafts, setMemberTitleDrafts] = useState<Record<string, string>>({});
  const selectedClubTab = normalizeClubContentTab(searchParams.get('tab'));
  const selectedClubAdminPanel = normalizeClubAdminPanel(searchParams.get('admin'));
  const [activeClubTab, setActiveClubTab] = useState<ClubContentTab>(selectedClubTab);
  const [clubAdminMode, setClubAdminMode] = useState<ClubAdminPreviewMode>('student');
  const [activeClubAdminPanel, setActiveClubAdminPanel] = useState<ClubAdminPanel>(selectedClubAdminPanel);
  const [copiedClubTab, setCopiedClubTab] = useState(false);
  const [copiedClubAdminView, setCopiedClubAdminView] = useState(false);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [clubFeedFilter, setClubFeedFilter] = useState<ClubFeedFilter>('all');
  const [clubFeedSearchQuery, setClubFeedSearchQuery] = useState('');
  const [clubFeedSort, setClubFeedSort] = useState<ClubFeedSort>('newest');
  const [selectedBulkPostIds, setSelectedBulkPostIds] = useState<string[]>([]);
  const [adminActivityPostId, setAdminActivityPostId] = useState<string | null>(null);
  const [adminNoteDrafts, setAdminNoteDrafts] = useState<Record<string, string>>({});
  const [previousClubPostId, setPreviousClubPostId] = useState<string | null>(null);
  const [pendingNotificationPublish, setPendingNotificationPublish] = useState<PendingNotificationPublishAction | null>(null);
  const [pendingClubArchive, setPendingClubArchive] = useState<PendingClubArchiveAction | null>(null);
  const [pendingClubMemberStatus, setPendingClubMemberStatus] = useState<PendingClubMemberStatusAction | null>(null);
  const [pendingUnsavedEditAction, setPendingUnsavedEditAction] = useState<PendingUnsavedEditAction | null>(null);
  const [notificationPublishSuccess, setNotificationPublishSuccess] = useState<NotificationPublishSuccess | null>(null);
  const [clubArchiveSuccess, setClubArchiveSuccess] = useState<ClubArchiveSuccess | null>(null);
  const [clubMemberActionSuccess, setClubMemberActionSuccess] = useState<ClubMemberActionSuccess | null>(null);
  const [clubPostEditSuccess, setClubPostEditSuccess] = useState<ClubPostEditSuccess | null>(null);
  const membership = (membershipsQuery.data ?? []).find((item) => item.club_id === club?.id);
  const isJoined = membership?.status === 'active';
  const isManager = membership?.status === 'active' && (membership?.role === 'admin' || membership?.role === 'moderator');
  const showAdminTools = isManager && clubAdminMode === 'admin';
  const composerDraftKey = useMemo(
    () => (club?.id && profile?.id ? `pulseClubComposerDraft:${profile.id}:${club.id}` : null),
    [club?.id, profile?.id]
  );
  const clubPostsQuery = usePulseClubPosts(club?.id, profile, showAdminTools);
  const clubPosts =
    clubPostsQuery.data?.length || !club
      ? clubPostsQuery.data ?? []
      : makeClubSpecificSamplePosts(club);
  const selectedClubPost = useMemo(
    () => clubPosts.find((post) => post.id === searchParams.get('post')) ?? null,
    [clubPosts, searchParams]
  );
  const currentEditingPostSnapshot = useMemo(
    () =>
      JSON.stringify({
        announcementContextItems: editingAnnouncementContextItems,
        announcementNextActions: editingAnnouncementNextActions,
        body: editingPostBody,
        eventAgendaItems: editingEventAgendaItems,
        eventDate: editingEventDate,
        eventLocation: editingEventLocation,
        eventMode: editingEventMode,
        eventPrepItems: editingEventPrepItems,
        eventTime: editingEventTime,
        opportunityBriefItems: editingOpportunityBriefItems,
        opportunityDeadline: editingOpportunityDeadline,
        opportunityFitItems: editingOpportunityFitItems,
        postType: editingPostType,
        resourcePreviewItems: editingResourcePreviewItems,
        resourceType: editingResourceType,
        resourceUrl: editingResourceUrl,
        resourceUsageItems: editingResourceUsageItems,
        status: editingPostStatus,
        title: editingPostTitle
      }),
    [
      editingAnnouncementContextItems,
      editingAnnouncementNextActions,
      editingEventAgendaItems,
      editingEventDate,
      editingEventLocation,
      editingEventMode,
      editingEventPrepItems,
      editingEventTime,
      editingOpportunityBriefItems,
      editingOpportunityDeadline,
      editingOpportunityFitItems,
      editingPostBody,
      editingPostStatus,
      editingPostTitle,
      editingPostType,
      editingResourcePreviewItems,
      editingResourceType,
      editingResourceUrl,
      editingResourceUsageItems
    ]
  );
  const hasUnsavedEditingChanges = Boolean(
    editingPostId && editingPostInitialSnapshot && editingPostInitialSnapshot !== currentEditingPostSnapshot
  );
  const filteredClubFeedPosts = useMemo(
    () => {
      const query = showAdminTools ? clubFeedSearchQuery.trim().toLowerCase() : '';
      const matchedPosts = clubPosts.filter((post) => {
        if (!matchesClubFeedFilter(post, clubFeedFilter)) return false;
        if (!query) return true;
        return clubPostSearchText(post).includes(query);
      });
      return showAdminTools ? sortClubFeedPosts(matchedPosts, clubFeedSort) : matchedPosts;
    },
    [clubFeedFilter, clubFeedSearchQuery, clubFeedSort, clubPosts, showAdminTools]
  );
  const clubFeedFilterOptions = useMemo(
    () => [
      { count: clubPosts.length, label: 'All', value: 'all' as ClubFeedFilter },
      { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'active')).length, label: 'Active', value: 'active' as ClubFeedFilter },
      { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'expired')).length, label: 'Expired', value: 'expired' as ClubFeedFilter },
      ...(showAdminTools
        ? [
            { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'drafts')).length, label: 'Drafts', value: 'drafts' as ClubFeedFilter },
            { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'archived')).length, label: 'Archived', value: 'archived' as ClubFeedFilter }
          ]
        : []),
      { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'announcements')).length, label: 'Announcements', value: 'announcements' as ClubFeedFilter },
      { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'discussions')).length, label: 'Discussions', value: 'discussions' as ClubFeedFilter },
      { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'events')).length, label: 'Events', value: 'events' as ClubFeedFilter },
      { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'resources')).length, label: 'Resources', value: 'resources' as ClubFeedFilter },
      { count: clubPosts.filter((post) => matchesClubFeedFilter(post, 'opportunities')).length, label: 'Opportunities', value: 'opportunities' as ClubFeedFilter }
    ],
    [clubPosts, showAdminTools]
  );
  const adminPostStatusCounts = useMemo(
    () => ({
      archived: clubPosts.filter((post) => post.status === 'archived').length,
      drafts: clubPosts.filter((post) => post.status === 'draft').length,
      expired: clubPosts.filter((post) => post.status === 'published' && isClubPostExpired(post)).length,
      published: clubPosts.filter((post) => post.status === 'published').length
    }),
    [clubPosts]
  );
  const selectedBulkPosts = useMemo(
    () => clubPosts.filter((post) => selectedBulkPostIds.includes(post.id)),
    [clubPosts, selectedBulkPostIds]
  );
  const eligibleSelectedBulkPosts = useMemo(
    () => selectedBulkPosts.filter((post) => canBulkArchiveClubPost(post)),
    [selectedBulkPosts]
  );
  const visibleBulkArchivePosts = useMemo(
    () => filteredClubFeedPosts.filter((post) => canBulkArchiveClubPost(post)),
    [filteredClubFeedPosts]
  );
  const areAllVisibleBulkPostsSelected =
    visibleBulkArchivePosts.length > 0 && visibleBulkArchivePosts.every((post) => selectedBulkPostIds.includes(post.id));
  const adminActivityPost = useMemo(
    () => clubPosts.find((post) => post.id === adminActivityPostId) ?? null,
    [adminActivityPostId, clubPosts]
  );
  const eventPosts = useMemo(() => clubPosts.filter((post) => post.post_type === 'event'), [clubPosts]);
  const resourcePosts = useMemo(() => clubPosts.filter((post) => post.post_type === 'resource'), [clubPosts]);
  const opportunityPosts = useMemo(() => clubPosts.filter((post) => post.post_type === 'opportunity'), [clubPosts]);
  const clubActionPostIds = useMemo(
    () =>
      clubPosts
        .filter((post) => (post.post_type === 'resource' || post.post_type === 'opportunity') && !post.id.startsWith('sample-'))
        .map((post) => post.id),
    [clubPosts]
  );
  const clubPostActionsQuery = usePulseClubPostActions(clubActionPostIds, profile);
  const toggleClubPostAction = useTogglePulseClubPostAction(profile);
  const clubPostActionSet = useMemo(
    () => new Set((clubPostActionsQuery.data ?? []).map((action) => `${action.club_post_id}:${action.action_type}`)),
    [clubPostActionsQuery.data]
  );
  const clubPostActionSummaryQuery = usePulseClubPostActionSummary(showAdminTools ? clubActionPostIds : [], profile);
  const notificationAuditQuery = usePulseClubNotificationAudit(showAdminTools ? club?.id : undefined, profile);
  const membershipActivityQuery = usePulseClubMembershipActivity(showAdminTools ? club?.id : undefined, profile);
  const sendTestNotification = useSendPulseClubTestNotification(showAdminTools ? club?.id : undefined, profile);
  const notificationAuditItems = notificationAuditQuery.data ?? [];
  const membershipActivityItems = membershipActivityQuery.data ?? [];
  const notificationAuditStats = useMemo(
    () => ({
      read: notificationAuditItems.filter((item) => item.read_at).length,
      sent: notificationAuditItems.length,
      unread: notificationAuditItems.filter((item) => !item.read_at).length
    }),
    [notificationAuditItems]
  );
  const clubPostActionSummary = clubPostActionSummaryQuery.data ?? new Map();
  const adminActionTotals = useMemo(
    () =>
      Array.from(clubPostActionSummary.values()).reduce(
        (totals, item) => ({
          interested: totals.interested + item.interested,
          saved: totals.saved + item.saved,
          useful: totals.useful + item.useful
        }),
        { interested: 0, saved: 0, useful: 0 }
      ),
    [clubPostActionSummary]
  );
  const topContentSignals = useMemo(
    () =>
      clubPosts
        .filter((post) => post.post_type === 'resource' || post.post_type === 'opportunity')
        .map((post) => {
          const summary = clubPostActionSummary.get(post.id) ?? { interested: 0, saved: 0, useful: 0 };
          return {
            post,
            score: summary.interested + summary.saved + summary.useful,
            summary
          };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [clubPostActionSummary, clubPosts]
  );
  const monthlyActivity = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonthPosts = clubPosts.filter((post) => new Date(post.created_at).getTime() >= monthStart);

    return {
      discussions: thisMonthPosts.filter((post) => post.post_type === 'discussion' || post.post_type === 'poll').length,
      events: thisMonthPosts.filter((post) => post.post_type === 'event').length,
      opportunities: thisMonthPosts.filter((post) => post.post_type === 'opportunity').length,
      resources: thisMonthPosts.filter((post) => post.post_type === 'resource').length,
      total: thisMonthPosts.length
    };
  }, [clubPosts]);
  const activeClubMembers =
    clubMembersQuery.data?.length || !club
      ? clubMembersQuery.data ?? []
      : rehomeSampleMembers(sampleCollegeMembers, [club]);
  const currentProfileId = profile?.id ?? '';
  const notificationAudienceRecipients = useMemo(
    () => activeClubMembers.filter((member) => member.profile_id !== currentProfileId),
    [activeClubMembers, currentProfileId]
  );
  const pendingArchivePosts = pendingClubArchive
    ? pendingClubArchive.kind === 'bulk'
      ? pendingClubArchive.posts
      : [pendingClubArchive.post]
    : [];
  const pendingClubMembers = pendingMembersQuery.data ?? [];
  const lastClubActivity = clubPosts[0]?.created_at ?? null;
  const coordinators = useMemo(
    () =>
      activeClubMembers
        .filter((member) => member.role === 'admin' || member.role === 'moderator')
        .slice(0, 4),
    [activeClubMembers]
  );
  const upcomingEvent = eventPosts[0] ?? null;
  const featuredResource = resourcePosts[0] ?? null;
  const pendingContentActions = useMemo(
    () => [
      monthlyActivity.events === 0 ? 'Add this month’s next event or workshop.' : null,
      monthlyActivity.resources === 0 ? 'Add one useful resource for members.' : null,
      monthlyActivity.opportunities === 0 ? 'Share one opportunity, role, or project drop.' : null,
      monthlyActivity.total === 0 ? 'Post one official update to keep the club active.' : null
    ].filter(Boolean) as string[],
    [monthlyActivity.events, monthlyActivity.opportunities, monthlyActivity.resources, monthlyActivity.total]
  );

  const templateClubName = club?.name ?? 'Club';
  const templateCollegeName = profile?.college?.name ?? 'Your college';
  const memberRows = useMemo(
    () =>
      activeClubMembers.length
        ? activeClubMembers.slice(0, 8).map((member) => ({
          name: member.profile?.display_name ?? 'Pulse member',
          role: member.title || member.role
        }))
        : [
          { name: profile?.display_name ?? 'You', role: isJoined ? membership?.title ?? 'Member' : 'Campus member' },
          { name: 'Pulse Campus Team', role: 'Workspace moderator' },
          { name: `${clubPosts.length} club updates`, role: 'Published in this workspace' }
        ],
    [activeClubMembers, clubPosts.length, isJoined, membership?.title, profile?.display_name]
  );
  const composerTemplates = useMemo<Record<typeof postType, ClubComposerTemplate[]>>(
    () => ({
      announcement: [
        {
          announcementContextItems: `Shared by ${templateClubName} for ${templateCollegeName} students\nUseful for members tracking this week's club activity`,
          announcementNextActions: 'Read the full update\nSave the relevant dates or links\nFollow the club feed for follow-up posts',
          body: `${templateClubName} is sharing this update so students can stay aligned on current priorities, upcoming activity, and useful next steps. Please read the details and check the club feed for related items.`,
          label: 'Weekly coordination update',
          postType: 'announcement',
          title: `${templateClubName} weekly coordination update`
        },
        {
          announcementContextItems: `This is an official ${templateClubName} note\nVisible only inside the college workspace`,
          announcementNextActions: 'Review the announcement\nReach out to the club coordinator if you need clarity\nWatch for the next update',
          body: `${templateClubName} has a new club update for students. This note summarizes what changed, who it is relevant for, and what students should do next.`,
          label: 'Official club notice',
          postType: 'announcement',
          title: `${templateClubName} official student notice`
        }
      ],
      event: [
        {
          body: `${templateClubName} is hosting a focused practice session for students who want hands-on exposure, peer learning, and structured feedback from the club team.`,
          eventAgendaItems: 'Opening context and goals\nLive practice round\nFeedback and improvement notes\nWrap-up and next steps',
          eventDate: dateInputOffset(7),
          eventLocation: 'Campus classroom / link to be shared',
          eventMode: 'Campus',
          eventPrepItems: 'Bring your laptop or notebook\nReview the shared context before joining\nArrive 10 minutes early',
          eventTime: '18:00',
          label: 'Practice session',
          postType: 'event',
          title: `${templateClubName} practice session`
        },
        {
          body: `${templateClubName} is running a short workshop to help students understand the topic, ask questions, and leave with clear action points for their preparation.`,
          eventAgendaItems: 'Quick concept walkthrough\nWorked example or live demo\nStudent Q&A\nAction checklist',
          eventDate: dateInputOffset(10),
          eventLocation: 'Seminar room / online link',
          eventMode: 'Hybrid',
          eventPrepItems: 'Bring one question\nSkim the basics before joining\nKeep 60 minutes blocked',
          eventTime: '17:30',
          label: 'Workshop',
          postType: 'event',
          title: `${templateClubName} learning workshop`
        }
      ],
      resource: [
        {
          body: `${templateClubName} is sharing this starter pack so students can prepare faster and use a structured reference while working on club activities, interviews, or projects.`,
          label: 'Starter pack',
          postType: 'resource',
          resourcePreviewItems: 'Includes a practical structure\nContains examples students can reuse\nUseful before the next club session',
          resourceType: 'Guide',
          resourceUrl: 'https://drive.google.com',
          resourceUsageItems: 'Save it for preparation\nUse it before attending the next session\nDiscuss doubts in the club workspace',
          title: `${templateClubName} starter pack`
        },
        {
          body: `${templateClubName} has prepared a reusable template for students who want a cleaner way to organize notes, submissions, or practice work.`,
          label: 'Reusable template',
          postType: 'resource',
          resourcePreviewItems: 'Ready-to-copy structure\nIncludes suggested sections\nCan be adapted for different tasks',
          resourceType: 'Template',
          resourceUrl: 'https://drive.google.com',
          resourceUsageItems: 'Make a personal copy\nFill it while preparing\nShare questions with the club team',
          title: `${templateClubName} reusable template`
        }
      ],
      opportunity: [
        {
          body: `${templateClubName} is opening a short project-style opportunity for students who want practical exposure, teamwork, and review from the club team.`,
          label: 'Live project',
          opportunityBriefItems: 'Open for teams of 2-3 students\nShortlisted students will get a practical brief\nClub coordinators will confirm next steps',
          opportunityDeadline: dateInputOffset(14),
          opportunityFitItems: 'Students interested in hands-on exposure\nStudents who can commit time this week\nStudents comfortable with research and presentation work',
          postType: 'opportunity',
          title: `${templateClubName} live project opportunity`
        },
        {
          body: `${templateClubName} is inviting interested students to join a working group for upcoming club activities, planning, and student-facing execution support.`,
          label: 'Working group',
          opportunityBriefItems: 'Open to students who want to contribute regularly\nSelected members will support planning and execution\nResponsibilities will be shared after shortlisting',
          opportunityDeadline: dateInputOffset(12),
          opportunityFitItems: 'Students who can coordinate reliably\nStudents interested in club operations\nStudents comfortable communicating with peers',
          postType: 'opportunity',
          title: `${templateClubName} working group invitation`
        }
      ]
    }),
    [templateClubName, templateCollegeName]
  );

  useEffect(() => {
    document.title = club ? `${club.name} | SapiensPulse` : 'My College Workspace | SapiensPulse';
  }, [club]);

  useEffect(() => {
    setActiveClubTab(selectedClubTab);
  }, [selectedClubTab]);

  useEffect(() => {
    setActiveClubAdminPanel(selectedClubAdminPanel);
  }, [selectedClubAdminPanel]);

  useEffect(() => {
    if (!copiedClubTab) return undefined;
    const timeout = window.setTimeout(() => setCopiedClubTab(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedClubTab]);

  useEffect(() => {
    if (!copiedClubAdminView) return undefined;
    const timeout = window.setTimeout(() => setCopiedClubAdminView(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedClubAdminView]);

  useEffect(() => {
    if (!copiedPostId) return undefined;
    const timeout = window.setTimeout(() => setCopiedPostId(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedPostId]);

  useEffect(() => {
    if (!pendingNotificationPublish && !pendingClubArchive && !pendingClubMemberStatus && !pendingUnsavedEditAction) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [pendingClubArchive, pendingClubMemberStatus, pendingNotificationPublish, pendingUnsavedEditAction]);

  useEffect(() => {
    if (!hasUnsavedEditingChanges) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEditingChanges]);

  useEffect(() => {
    if (!notificationPublishSuccess) return undefined;
    const timeout = window.setTimeout(() => setNotificationPublishSuccess(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notificationPublishSuccess]);

  useEffect(() => {
    if (!clubArchiveSuccess) return undefined;
    const timeout = window.setTimeout(() => setClubArchiveSuccess(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [clubArchiveSuccess]);

  useEffect(() => {
    if (!clubMemberActionSuccess) return undefined;
    const timeout = window.setTimeout(() => setClubMemberActionSuccess(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [clubMemberActionSuccess]);

  useEffect(() => {
    if (!clubPostEditSuccess) return undefined;
    const timeout = window.setTimeout(() => setClubPostEditSuccess(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [clubPostEditSuccess]);

  useEffect(() => {
    const postId = searchParams.get('post');
    if (!postId || clubPostsQuery.isLoading) return;
    const target = document.getElementById(`club-post-${postId}`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [clubPostsQuery.isLoading, searchParams]);

  useEffect(() => {
    if (!composerDraftKey || restoredComposerDraftKey === composerDraftKey) return;
    try {
      const storedDraft = window.localStorage.getItem(composerDraftKey);
      if (!storedDraft) {
        setRestoredComposerDraftKey(composerDraftKey);
        return;
      }

      const draft = JSON.parse(storedDraft) as Partial<ClubComposerDraft>;
      if (draft.postType === 'announcement' || draft.postType === 'event' || draft.postType === 'resource' || draft.postType === 'opportunity') {
        setPostType(draft.postType);
      }
      if (draft.postStatus === 'draft' || draft.postStatus === 'published') {
        setPostStatus(draft.postStatus);
      }
      setPostTitle(typeof draft.postTitle === 'string' ? draft.postTitle : '');
      setPostBody(typeof draft.postBody === 'string' ? draft.postBody : '');
      setEventDate(typeof draft.eventDate === 'string' ? draft.eventDate : '');
      setEventTime(typeof draft.eventTime === 'string' ? draft.eventTime : '');
      setEventLocation(typeof draft.eventLocation === 'string' ? draft.eventLocation : '');
      setEventMode(typeof draft.eventMode === 'string' ? draft.eventMode : 'Campus');
      setEventAgendaItems(typeof draft.eventAgendaItems === 'string' ? draft.eventAgendaItems : '');
      setEventPrepItems(typeof draft.eventPrepItems === 'string' ? draft.eventPrepItems : '');
      setResourceUrl(typeof draft.resourceUrl === 'string' ? draft.resourceUrl : '');
      setResourceType(typeof draft.resourceType === 'string' ? draft.resourceType : 'Guide');
      setResourcePreviewItems(typeof draft.resourcePreviewItems === 'string' ? draft.resourcePreviewItems : '');
      setResourceUsageItems(typeof draft.resourceUsageItems === 'string' ? draft.resourceUsageItems : '');
      setOpportunityDeadline(typeof draft.opportunityDeadline === 'string' ? draft.opportunityDeadline : '');
      setOpportunityBriefItems(typeof draft.opportunityBriefItems === 'string' ? draft.opportunityBriefItems : '');
      setOpportunityFitItems(typeof draft.opportunityFitItems === 'string' ? draft.opportunityFitItems : '');
      setAnnouncementNextActions(typeof draft.announcementNextActions === 'string' ? draft.announcementNextActions : '');
      setAnnouncementContextItems(typeof draft.announcementContextItems === 'string' ? draft.announcementContextItems : '');
      setComposerDraftSavedAt(typeof draft.savedAt === 'number' ? draft.savedAt : null);
    } catch {
      setComposerDraftSavedAt(null);
    } finally {
      setRestoredComposerDraftKey(composerDraftKey);
    }
  }, [composerDraftKey, restoredComposerDraftKey]);

  useEffect(() => {
    if (!composerDraftKey || restoredComposerDraftKey !== composerDraftKey) return;
    const hasDraftContent = [
      postTitle,
      postBody,
      eventDate,
      eventTime,
      eventLocation,
      eventAgendaItems,
      eventPrepItems,
      resourceUrl,
      resourcePreviewItems,
      resourceUsageItems,
      opportunityDeadline,
      opportunityBriefItems,
      opportunityFitItems,
      announcementNextActions,
      announcementContextItems
    ].some((value) => value.trim().length > 0);

    if (!hasDraftContent && postType === 'announcement') {
      try {
        window.localStorage.removeItem(composerDraftKey);
      } catch {
        // Draft persistence is optional.
      }
      setComposerDraftSavedAt(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      const savedAt = Date.now();
      const draft: ClubComposerDraft = {
        announcementContextItems,
        announcementNextActions,
        eventAgendaItems,
        eventDate,
        eventLocation,
        eventMode,
        eventPrepItems,
        eventTime,
        opportunityBriefItems,
        opportunityDeadline,
        opportunityFitItems,
        postBody,
        postStatus,
        postTitle,
        postType,
        resourcePreviewItems,
        resourceType,
        resourceUrl,
        resourceUsageItems,
        savedAt
      };
      try {
        window.localStorage.setItem(composerDraftKey, JSON.stringify(draft));
        setComposerDraftSavedAt(savedAt);
      } catch {
        // Ignore local storage failures; the composer still works normally.
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    announcementContextItems,
    announcementNextActions,
    composerDraftKey,
    eventAgendaItems,
    eventDate,
    eventLocation,
    eventMode,
    eventPrepItems,
    eventTime,
    opportunityBriefItems,
    opportunityDeadline,
    opportunityFitItems,
    postBody,
    postStatus,
    postTitle,
    postType,
    resourcePreviewItems,
    resourceType,
    resourceUrl,
    resourceUsageItems,
    restoredComposerDraftKey
  ]);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading || (clubQuery.isLoading && !sampleClub) || membershipsQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Workspace</PulseBadge>
        <h1>Opening this college workspace.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  if (clubQuery.error && !sampleClub) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="coral">Workspace unavailable</PulseBadge>
        <h1>This club could not be loaded.</h1>
        <p>Please refresh once. If this continues, the Pulse club workspace migration may still need to be deployed.</p>
      </section>
    );
  }

  if (!club) {
    return <Navigate to="/pulse/clubs" replace />;
  }

  const clubTopic = club.name.replace(' Club', '').replace(' Cell', '').replace(' Committee', '');
  const collegeName = profile.college?.name ?? 'Your College';
  const workspaceName = club.name;
  const isWorking = createClubPost.isPending || updateClubPost.isPending || archiveClubPost.isPending || toggleClubMembership.isPending;

  const handleMembershipToggle = () => {
    toggleClubMembership.mutate({
      clubId: club.id,
      isJoining: !isJoined,
      membershipId: membership?.id
    });
  };

  const handleClubTabChange = (tab: ClubContentTab) => {
    setActiveClubTab(tab);
    setPreviousClubPostId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('post');
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const handleClubAdminPanelChange = (panel: ClubAdminPanel) => {
    setActiveClubAdminPanel(panel);
    const next = new URLSearchParams(searchParams);
    next.set('admin', panel);
    setSearchParams(next, { replace: true });
  };

  const clubTabLink = (tab: ClubContentTab) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    return url.toString();
  };

  const clubAdminViewLink = (panel: ClubAdminPanel) => {
    const url = new URL(window.location.href);
    url.searchParams.set('admin', panel);
    return url.toString();
  };

  const clubPostLink = (post: PulseClubPost) => {
    const url = new URL(window.location.href);
    url.searchParams.set('post', post.id);
    return url.toString();
  };

  const handleCopyClubTabLink = async () => {
    const link = clubTabLink(activeClubTab);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedClubTab(true);
    } catch {
      window.prompt('Copy this club section link', link);
    }
  };

  const handleCopyClubAdminViewLink = async () => {
    const link = clubAdminViewLink(activeClubAdminPanel);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedClubAdminView(true);
    } catch {
      window.prompt('Copy this admin view link', link);
    }
  };

  const handleCopyClubPostLink = async (post: PulseClubPost) => {
    const link = clubPostLink(post);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedPostId(post.id);
    } catch {
      window.prompt('Copy this club item link', link);
    }
  };

  const handleOpenClubPost = (post: PulseClubPost, options?: { previousPostId?: string | null }) => {
    setPreviousClubPostId(options?.previousPostId ?? null);
    const next = new URLSearchParams(searchParams);
    next.set('post', post.id);
    setSearchParams(next, { replace: false });
  };

  const handleCloseClubPost = () => {
    setPreviousClubPostId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('post');
    setSearchParams(next, { replace: false });
  };

  const handleOpenPreviousClubPost = () => {
    if (!previousClubPostId) return;
    const targetPost = clubPosts.find((post) => post.id === previousClubPostId);
    if (!targetPost) return;
    handleOpenClubPost(targetPost, { previousPostId: selectedClubPost?.id ?? null });
  };

  const handleViewEditedPost = () => {
    if (!clubPostEditSuccess) return;
    const targetPost = clubPosts.find((post) => post.id === clubPostEditSuccess.postId);
    if (targetPost) {
      handleOpenClubPost(targetPost);
    } else {
      const next = new URLSearchParams(searchParams);
      next.set('post', clubPostEditSuccess.postId);
      setSearchParams(next, { replace: false });
    }
    setClubPostEditSuccess(null);
  };

  const runAfterUnsavedEditGuard = (label: string, action: () => void) => {
    if (hasUnsavedEditingChanges) {
      setPendingUnsavedEditAction({ action, label });
      return;
    }
    action();
  };

  const confirmPendingUnsavedEditAction = () => {
    const pendingAction = pendingUnsavedEditAction;
    setPendingUnsavedEditAction(null);
    pendingAction?.action();
  };

  const openClubComposerDirect = (nextPostType: typeof postType = 'announcement') => {
    if (!isManager) return;
    setClubAdminMode('admin');
    setActiveClubAdminPanel('publish');
    const next = new URLSearchParams(searchParams);
    next.set('admin', 'publish');
    setSearchParams(next, { replace: true });
    setPostType(nextPostType);
    setIsManageOpen(true);
    cancelEditingPost();
  };

  const openClubComposer = (nextPostType: typeof postType = 'announcement') => {
    runAfterUnsavedEditGuard('open the new post composer', () => openClubComposerDirect(nextPostType));
  };

  const applyComposerTemplate = (template: ClubComposerTemplate) => {
    setPostType(template.postType);
    setPostTitle(template.title);
    setPostBody(template.body);
    setEventDate(template.eventDate ?? '');
    setEventTime(template.eventTime ?? '');
    setEventLocation(template.eventLocation ?? '');
    setEventMode(template.eventMode ?? 'Campus');
    setEventAgendaItems(template.eventAgendaItems ?? '');
    setEventPrepItems(template.eventPrepItems ?? '');
    setResourceUrl(template.resourceUrl ?? '');
    setResourceType(template.resourceType ?? 'Guide');
    setResourcePreviewItems(template.resourcePreviewItems ?? '');
    setResourceUsageItems(template.resourceUsageItems ?? '');
    setOpportunityDeadline(template.opportunityDeadline ?? '');
    setOpportunityBriefItems(template.opportunityBriefItems ?? '');
    setOpportunityFitItems(template.opportunityFitItems ?? '');
    setAnnouncementNextActions(template.announcementNextActions ?? '');
    setAnnouncementContextItems(template.announcementContextItems ?? '');
    setPostQualityError(null);
    setComposerTemplateNotice(`${template.label} template applied. Everything below is editable before publishing.`);
  };

  const handleClubAdminQuickCreate = (nextPostType: typeof postType) => {
    runAfterUnsavedEditGuard('start a new post from a template', () => {
      openClubComposerDirect(nextPostType);
      const firstTemplate = composerTemplates[nextPostType][0];
      if (firstTemplate) applyComposerTemplate(firstTemplate);
    });
  };

  const jumpToCreateStudentPreview = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('club-create-student-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const jumpToCreateComposerEditor = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('club-create-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const jumpToEditStudentPreview = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('club-edit-student-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const jumpToEditComposerEditor = () => {
    window.requestAnimationFrame(() => {
      document.getElementById('club-edit-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const duplicateClubPostDirect = (post: PulseClubPost) => {
    if (!isManager) return;
    const duplicateType =
      post.post_type === 'event' || post.post_type === 'resource' || post.post_type === 'opportunity' || post.post_type === 'announcement'
        ? post.post_type
        : 'announcement';

    cancelEditingPost();
    setClubAdminMode('admin');
    setActiveClubAdminPanel('publish');
    const next = new URLSearchParams(searchParams);
    next.set('admin', 'publish');
    setSearchParams(next, { replace: true });
    setIsManageOpen(true);
    setPostType(duplicateType);
    setPostStatus('draft');
    setPostTitle(`Copy of ${post.title}`);
    setPostBody(post.body);
    setEventDate(typeof post.metadata.event_date === 'string' ? post.metadata.event_date : '');
    setEventTime(typeof post.metadata.event_time === 'string' ? post.metadata.event_time : '');
    setEventLocation(typeof post.metadata.event_location === 'string' ? post.metadata.event_location : '');
    setEventMode(typeof post.metadata.event_mode === 'string' ? post.metadata.event_mode : 'Campus');
    setEventAgendaItems(clubMetadataLinesToText(post.metadata.agenda_items));
    setEventPrepItems(clubMetadataLinesToText(post.metadata.prep_items));
    setResourceUrl(typeof post.metadata.resource_url === 'string' ? post.metadata.resource_url : '');
    setResourceType(typeof post.metadata.resource_type === 'string' ? post.metadata.resource_type : 'Guide');
    setResourcePreviewItems(clubMetadataLinesToText(post.metadata.resource_items));
    setResourceUsageItems(clubMetadataLinesToText(post.metadata.usage_items));
    setOpportunityDeadline(typeof post.metadata.deadline === 'string' ? post.metadata.deadline : '');
    setOpportunityBriefItems(clubMetadataLinesToText(post.metadata.opportunity_items));
    setOpportunityFitItems(clubMetadataLinesToText(post.metadata.fit_items));
    setAnnouncementNextActions(clubMetadataLinesToText(post.metadata.next_action_items));
    setAnnouncementContextItems(clubMetadataLinesToText(post.metadata.context_items));
    setPostQualityError(null);
    setComposerTemplateNotice(null);
    window.requestAnimationFrame(() => {
      document.querySelector('.pulse-club-manage-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const duplicateClubPost = (post: PulseClubPost) => {
    runAfterUnsavedEditGuard('duplicate this post', () => duplicateClubPostDirect(post));
  };

  const jumpToClubFeedFilter = (filter: ClubFeedFilter) => {
    setClubFeedFilter(filter);
    window.requestAnimationFrame(() => {
      document.getElementById('club-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const resetCreateComposer = () => {
    setPostTitle('');
    setPostBody('');
    setEventDate('');
    setEventTime('');
    setEventLocation('');
    setEventMode('Campus');
    setEventAgendaItems('');
    setEventPrepItems('');
    setResourceUrl('');
    setResourceType('Guide');
    setResourcePreviewItems('');
    setResourceUsageItems('');
    setOpportunityDeadline('');
    setOpportunityBriefItems('');
    setOpportunityFitItems('');
    setAnnouncementNextActions('');
    setAnnouncementContextItems('');
    setPostType('announcement');
    setPostStatus('published');
    setPostQualityError(null);
    setComposerTemplateNotice(null);
  };

  const clearComposerDraft = () => {
    resetCreateComposer();
    if (composerDraftKey) {
      try {
        window.localStorage.removeItem(composerDraftKey);
      } catch {
        // Draft persistence is optional.
      }
    }
    setComposerDraftSavedAt(null);
    setRestoredComposerDraftKey(composerDraftKey);
  };

  const buildPostMetadata = (
    type: PulseClubPost['post_type'],
    values: {
      announcementContextItems: string;
      announcementNextActions: string;
      eventAgendaItems: string;
      eventDate: string;
      eventLocation: string;
      eventMode: string;
      eventPrepItems: string;
      eventTime: string;
      opportunityBriefItems: string;
      opportunityDeadline: string;
      opportunityFitItems: string;
      resourcePreviewItems: string;
      resourceType: string;
      resourceUrl: string;
      resourceUsageItems: string;
    }
  ) => {
    const metadata: Record<string, unknown> = {};
    if (type === 'event') {
      metadata.event_date = values.eventDate;
      metadata.event_time = values.eventTime;
      metadata.event_location = values.eventLocation;
      metadata.event_mode = values.eventMode;
      metadata.agenda_items = splitClubMetadataLines(values.eventAgendaItems);
      metadata.prep_items = splitClubMetadataLines(values.eventPrepItems);
    }
    if (type === 'resource') {
      metadata.resource_url = values.resourceUrl;
      metadata.resource_type = values.resourceType;
      metadata.resource_items = splitClubMetadataLines(values.resourcePreviewItems);
      metadata.usage_items = splitClubMetadataLines(values.resourceUsageItems);
    }
    if (type === 'opportunity') {
      metadata.deadline = values.opportunityDeadline;
      metadata.opportunity_items = splitClubMetadataLines(values.opportunityBriefItems);
      metadata.fit_items = splitClubMetadataLines(values.opportunityFitItems);
    }
    if (type === 'announcement') {
      metadata.next_action_items = splitClubMetadataLines(values.announcementNextActions);
      metadata.context_items = splitClubMetadataLines(values.announcementContextItems);
    }
    return metadata;
  };

  const buildCreatePostMetadata = () =>
    buildPostMetadata(postType, {
      announcementContextItems,
      announcementNextActions,
      eventAgendaItems,
      eventDate,
      eventLocation,
      eventMode,
      eventPrepItems,
      eventTime,
      opportunityBriefItems,
      opportunityDeadline,
      opportunityFitItems,
      resourcePreviewItems,
      resourceType,
      resourceUrl,
      resourceUsageItems
    });

  const buildEditingPostMetadata = () =>
    buildPostMetadata(editingPostType, {
      announcementContextItems: editingAnnouncementContextItems,
      announcementNextActions: editingAnnouncementNextActions,
      eventAgendaItems: editingEventAgendaItems,
      eventDate: editingEventDate,
      eventLocation: editingEventLocation,
      eventMode: editingEventMode,
      eventPrepItems: editingEventPrepItems,
      eventTime: editingEventTime,
      opportunityBriefItems: editingOpportunityBriefItems,
      opportunityDeadline: editingOpportunityDeadline,
      opportunityFitItems: editingOpportunityFitItems,
      resourcePreviewItems: editingResourcePreviewItems,
      resourceType: editingResourceType,
      resourceUrl: editingResourceUrl,
      resourceUsageItems: editingResourceUsageItems
    });

  const renderNotificationAudiencePreview = (
    type: PulseClubPost['post_type'],
    statusValue: 'draft' | 'published' | 'archived',
    previousStatus?: PulseClubPost['status'] | null
  ) => {
    const eligibleType = type === 'event' || type === 'resource' || type === 'opportunity';
    const willPublish = statusValue === 'published';
    const alreadyPublished = previousStatus === 'published';
    const recipients = activeClubMembers.filter((member) => member.profile_id !== profile.id);
    const recipientPreview = recipients.slice(0, 4);
    const message = !willPublish
      ? 'No notification will be sent while this stays as a draft or archived item.'
      : !eligibleType
        ? 'This update will appear in the club workspace, but it will not trigger a bell notification.'
        : alreadyPublished
          ? 'This is already published, so saving edits will not re-notify students.'
          : `${recipients.length} active club member${recipients.length === 1 ? '' : 's'} will receive a bell notification.`;

    return (
      <section className={willPublish && eligibleType && !alreadyPublished ? 'pulse-club-audience-preview pulse-club-audience-preview--notify pulse-club-manage-panel__wide' : 'pulse-club-audience-preview pulse-club-manage-panel__wide'}>
        <div>
          <Bell size={18} />
          <span>
            <strong>Audience preview</strong>
            <small>{message}</small>
          </span>
        </div>
        {willPublish && eligibleType && !alreadyPublished ? (
          <div className="pulse-club-audience-preview__members">
            {recipientPreview.length ? recipientPreview.map((member) => (
              <span key={member.id}>{member.profile?.display_name ?? 'Pulse member'}</span>
            )) : (
              <span>No active members yet</span>
            )}
            {recipients.length > recipientPreview.length ? <span>+{recipients.length - recipientPreview.length} more</span> : null}
          </div>
        ) : null}
      </section>
    );
  };

  const confirmNotificationAudience = (
    type: PulseClubPost['post_type'],
    statusValue: 'draft' | 'published' | 'archived',
    previousStatus?: PulseClubPost['status'] | null
  ) => {
    const eligibleType = type === 'event' || type === 'resource' || type === 'opportunity';
    return statusValue === 'published' && eligibleType && previousStatus !== 'published';
  };

  const notificationAudienceContentLabel = (
    type: PulseClubPost['post_type']
  ) => {
    if (type === 'event') return 'event';
    if (type === 'resource') return 'resource';
    if (type === 'opportunity') return 'opportunity';
    return 'update';
  };

  const renderStudentPostPreview = (
    type: PulseClubPost['post_type'],
    title: string,
    body: string,
    metadata: Record<string, unknown>,
    statusValue: 'draft' | 'published' | 'archived',
    qualityError?: string | null,
    previewId?: string,
    onBackToEditor: () => void = jumpToCreateComposerEditor
  ) => {
    const previewPost: PulseClubPost = {
      author: profile,
      author_profile_id: profile.id,
      body: body.trim() || 'Add details so students can understand what to do next.',
      club,
      club_id: club.id,
      created_at: new Date().toISOString(),
      id: 'draft-preview',
      metadata,
      moderated_at: null,
      moderated_by_auth_user_id: null,
      pinned: false,
      post_id: null,
      post_type: type,
      status: 'published',
      title: title.trim() || 'Student preview title'
    };
    const blocks = buildClubPostDetailBlocks(previewPost, club.name);
    const qualityHints = buildClubPostQualityHints(type, title, body, metadata);
    const publishRequirements = buildClubPostPublishRequirements(type, title, body, metadata);
    const publishIssues = publishRequirements.filter((item) => !item.met);
    const consistencyChecks = buildClubPostConsistencyChecks(type, metadata);
    const isPublishing = statusValue === 'published';

    return (
      <section className="pulse-club-student-preview pulse-club-manage-panel__wide" id={previewId} aria-label="Student preview">
        <div className="pulse-club-student-preview__header">
          <div>
            <PulseBadge tone="green">Preview as student</PulseBadge>
            <h3>{previewPost.title}</h3>
          </div>
          <span className="pulse-club-student-preview__actions">
            <button type="button" onClick={onBackToEditor}>
              <ArrowLeft size={14} /> Back to editor
            </button>
            <em>{clubPostTypeLabel(type)}</em>
          </span>
        </div>
        <p>{previewPost.body}</p>
        <div className={qualityHints.length ? 'pulse-club-preview-hints' : 'pulse-club-preview-hints pulse-club-preview-hints--ready'}>
          <strong>{qualityHints.length ? 'Before publishing, consider' : 'Looks ready for students'}</strong>
          {qualityHints.length ? (
            <div>
              {qualityHints.map((hint) => (
                <span key={hint}><Target size={15} /> {hint}</span>
              ))}
            </div>
          ) : (
            <span><CheckCircle2 size={15} /> This post has enough detail for a useful student view.</span>
          )}
        </div>
        <div className={isPublishing && publishIssues.length ? 'pulse-club-publish-checklist' : 'pulse-club-publish-checklist pulse-club-publish-checklist--ready'}>
          <strong>{isPublishing ? (publishIssues.length ? 'Required before publishing' : 'Ready to publish') : 'Draft mode'}</strong>
          {qualityError && publishIssues.length ? <p>{qualityError}</p> : null}
          <div>
            {isPublishing ? publishRequirements.map((item) => (
              <span className={item.met ? 'is-complete' : undefined} key={item.label}>
                {item.met ? <CheckCircle2 size={15} /> : <Target size={15} />}
                {item.label}
              </span>
            )) : (
              <span className="is-complete"><CheckCircle2 size={15} /> Drafts can be saved before every field is complete.</span>
            )}
          </div>
        </div>
        {consistencyChecks.length ? (
          <div className={consistencyChecks.every((item) => item.met) ? 'pulse-club-consistency-check pulse-club-consistency-check--ready' : 'pulse-club-consistency-check'}>
            <strong>Student-facing consistency</strong>
            <div>
              {consistencyChecks.map((item) => (
                <span className={item.met ? 'is-complete' : undefined} key={item.label}>
                  {item.met ? <CheckCircle2 size={15} /> : <Target size={15} />}
                  <em>{item.surfaces}</em>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="pulse-club-student-preview__blocks">
          {blocks.map((block) => (
            <article key={`${type}-${block.badge}`}>
              <small>{block.badge}</small>
              <strong>{block.title}</strong>
              <div>
                {block.items.slice(0, 4).map((item) => (
                  <span key={item}><ClipboardCheck size={15} /> {item}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  };

  const handlePostSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!showAdminTools) return;
    if (!postTitle.trim() || !postBody.trim()) return;
    const metadata = buildCreatePostMetadata();
    const publishIssues = postStatus === 'published' ? buildClubPostPublishIssues(postType, postTitle, postBody, metadata) : [];
    if (publishIssues.length) {
      setPostQualityError('Complete the publish checklist before making this post visible to students.');
      return;
    }
    if (confirmNotificationAudience(postType, postStatus)) {
      setPendingNotificationPublish({ kind: 'create', metadata });
      return;
    }
    setPostQualityError(null);

    createClubPost.mutate(
      {
        body: postBody,
        clubId: club.id,
        metadata,
        postType,
        status: postStatus,
        title: postTitle
      },
      {
        onSuccess: () => {
          clearComposerDraft();
        }
      }
    );
  };

  const startEditingPostDirect = (post: PulseClubPost) => {
    if (!isManager) return;
    const nextPostType = post.post_type;
    const nextPostStatus = post.status === 'draft' || post.status === 'archived' ? post.status : 'published';
    const nextEventDate = typeof post.metadata.event_date === 'string' ? post.metadata.event_date : '';
    const nextEventTime = typeof post.metadata.event_time === 'string' ? post.metadata.event_time : '';
    const nextEventLocation = typeof post.metadata.event_location === 'string' ? post.metadata.event_location : '';
    const nextEventMode = typeof post.metadata.event_mode === 'string' ? post.metadata.event_mode : 'Campus';
    const nextEventAgendaItems = clubMetadataLinesToText(post.metadata.agenda_items);
    const nextEventPrepItems = clubMetadataLinesToText(post.metadata.prep_items);
    const nextResourceUrl = typeof post.metadata.resource_url === 'string' ? post.metadata.resource_url : '';
    const nextResourceType = typeof post.metadata.resource_type === 'string' ? post.metadata.resource_type : 'Guide';
    const nextResourcePreviewItems = clubMetadataLinesToText(post.metadata.resource_items);
    const nextResourceUsageItems = clubMetadataLinesToText(post.metadata.usage_items);
    const nextOpportunityDeadline = typeof post.metadata.deadline === 'string' ? post.metadata.deadline : '';
    const nextOpportunityBriefItems = clubMetadataLinesToText(post.metadata.opportunity_items);
    const nextOpportunityFitItems = clubMetadataLinesToText(post.metadata.fit_items);
    const nextAnnouncementNextActions = clubMetadataLinesToText(post.metadata.next_action_items);
    const nextAnnouncementContextItems = clubMetadataLinesToText(post.metadata.context_items);

    setClubAdminMode('admin');
    setActiveClubAdminPanel('publish');
    const next = new URLSearchParams(searchParams);
    next.set('admin', 'publish');
    setSearchParams(next, { replace: true });
    setEditingPostId(post.id);
    setEditingPostType(nextPostType);
    setEditingPostStatus(nextPostStatus);
    setEditingPostTitle(post.title);
    setEditingPostBody(post.body);
    setEditingEventDate(nextEventDate);
    setEditingEventTime(nextEventTime);
    setEditingEventLocation(nextEventLocation);
    setEditingEventMode(nextEventMode);
    setEditingEventAgendaItems(nextEventAgendaItems);
    setEditingEventPrepItems(nextEventPrepItems);
    setEditingResourceUrl(nextResourceUrl);
    setEditingResourceType(nextResourceType);
    setEditingResourcePreviewItems(nextResourcePreviewItems);
    setEditingResourceUsageItems(nextResourceUsageItems);
    setEditingOpportunityDeadline(nextOpportunityDeadline);
    setEditingOpportunityBriefItems(nextOpportunityBriefItems);
    setEditingOpportunityFitItems(nextOpportunityFitItems);
    setEditingAnnouncementNextActions(nextAnnouncementNextActions);
    setEditingAnnouncementContextItems(nextAnnouncementContextItems);
    setEditingPostQualityError(null);
    setEditingPostInitialSnapshot(JSON.stringify({
      announcementContextItems: nextAnnouncementContextItems,
      announcementNextActions: nextAnnouncementNextActions,
      body: post.body,
      eventAgendaItems: nextEventAgendaItems,
      eventDate: nextEventDate,
      eventLocation: nextEventLocation,
      eventMode: nextEventMode,
      eventPrepItems: nextEventPrepItems,
      eventTime: nextEventTime,
      opportunityBriefItems: nextOpportunityBriefItems,
      opportunityDeadline: nextOpportunityDeadline,
      opportunityFitItems: nextOpportunityFitItems,
      postType: nextPostType,
      resourcePreviewItems: nextResourcePreviewItems,
      resourceType: nextResourceType,
      resourceUrl: nextResourceUrl,
      resourceUsageItems: nextResourceUsageItems,
      status: nextPostStatus,
      title: post.title
    }));
    setIsManageOpen(false);
  };

  const startEditingPost = (post: PulseClubPost) => {
    if (editingPostId === post.id) {
      jumpToEditComposerEditor();
      return;
    }
    runAfterUnsavedEditGuard('edit another post', () => startEditingPostDirect(post));
  };

  const cancelEditingPost = () => {
    setEditingPostId(null);
    setEditingPostType('announcement');
    setEditingPostStatus('published');
    setEditingPostTitle('');
    setEditingPostBody('');
    setEditingEventDate('');
    setEditingEventTime('');
    setEditingEventLocation('');
    setEditingEventMode('Campus');
    setEditingEventAgendaItems('');
    setEditingEventPrepItems('');
    setEditingResourceUrl('');
    setEditingResourceType('Guide');
    setEditingResourcePreviewItems('');
    setEditingResourceUsageItems('');
    setEditingOpportunityDeadline('');
    setEditingOpportunityBriefItems('');
    setEditingOpportunityFitItems('');
    setEditingAnnouncementNextActions('');
    setEditingAnnouncementContextItems('');
    setEditingPostQualityError(null);
    setEditingPostInitialSnapshot(null);
  };

  const requestCancelEditingPost = () => {
    runAfterUnsavedEditGuard('close the editor', cancelEditingPost);
  };

  const handleClubAdminModeChangeDirect = (mode: ClubAdminPreviewMode) => {
    setClubAdminMode(mode);
    if (mode === 'student') {
      setIsManageOpen(false);
      setClubFeedSearchQuery('');
      setClubFeedSort('newest');
      setSelectedBulkPostIds([]);
      cancelEditingPost();
    }
  };

  const handleClubAdminModeChange = (mode: ClubAdminPreviewMode) => {
    if (mode === 'student') {
      runAfterUnsavedEditGuard('switch to student view', () => handleClubAdminModeChangeDirect(mode));
      return;
    }
    handleClubAdminModeChangeDirect(mode);
  };

  const toggleBulkPostSelection = (post: PulseClubPost) => {
    if (!canBulkArchiveClubPost(post)) return;
    setSelectedBulkPostIds((current) =>
      current.includes(post.id) ? current.filter((id) => id !== post.id) : [...current, post.id]
    );
  };

  const toggleVisibleBulkPostSelection = () => {
    const visibleIds = visibleBulkArchivePosts.map((post) => post.id);
    if (!visibleIds.length) return;
    setSelectedBulkPostIds((current) => {
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleBulkArchivePosts = async () => {
    if (!showAdminTools || !eligibleSelectedBulkPosts.length) return;
    setPendingClubArchive({ kind: 'bulk', posts: eligibleSelectedBulkPosts });
  };

  const handleSaveAdminNote = (post: PulseClubPost) => {
    if (!showAdminTools || post.id.startsWith('sample-')) return;
    const note = (adminNoteDrafts[post.id] ?? readClubPostAdminNote(post)).trim();
    const nextMetadata = { ...post.metadata };

    if (note) {
      nextMetadata.admin_note = note;
      nextMetadata.admin_note_updated_at = new Date().toISOString();
    } else {
      delete nextMetadata.admin_note;
      delete nextMetadata.admin_note_updated_at;
    }

    updateClubPost.mutate(
      {
        body: post.body,
        metadata: nextMetadata,
        postId: post.id,
        postType: post.post_type,
        status: post.status,
        title: post.title
      },
      {
        onSuccess: () => {
          setAdminNoteDrafts((current) => {
            const next = { ...current };
            delete next[post.id];
            return next;
          });
        }
      }
    );
  };

  const handlePostEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPostId || !editingPostTitle.trim() || !editingPostBody.trim()) return;
    const metadata = buildEditingPostMetadata();
    const existingPost = clubPosts.find((post) => post.id === editingPostId);
    if (existingPost) {
      const adminNote = readClubPostAdminNote(existingPost);
      const adminNoteUpdatedAt = typeof existingPost.metadata.admin_note_updated_at === 'string'
        ? existingPost.metadata.admin_note_updated_at
        : '';
      if (adminNote) metadata.admin_note = adminNote;
      if (adminNoteUpdatedAt) metadata.admin_note_updated_at = adminNoteUpdatedAt;
    }
    const publishIssues = editingPostStatus === 'published' ? buildClubPostPublishIssues(editingPostType, editingPostTitle, editingPostBody, metadata) : [];
    if (publishIssues.length) {
      setEditingPostQualityError('Complete the publish checklist before keeping this post visible to students.');
      return;
    }
    if (confirmNotificationAudience(editingPostType, editingPostStatus, existingPost?.status ?? null)) {
      setPendingNotificationPublish({ kind: 'edit', metadata, postId: editingPostId });
      return;
    }
    setEditingPostQualityError(null);

    updateClubPost.mutate(
      {
        body: editingPostBody,
        metadata,
        postId: editingPostId,
        postType: editingPostType,
        status: editingPostStatus,
        title: editingPostTitle
      },
      {
        onSuccess: () => {
          setClubPostEditSuccess({ postId: editingPostId, postType: editingPostType, title: editingPostTitle });
          cancelEditingPost();
        }
      }
    );
  };

  const confirmPendingNotificationPublish = () => {
    if (!pendingNotificationPublish) return;
    const successMessage = {
      contentLabel: notificationAudienceContentLabel(pendingNotificationPublish.kind === 'create' ? postType : editingPostType),
      recipientCount: notificationAudienceRecipients.length
    };

    if (pendingNotificationPublish.kind === 'create') {
      setPostQualityError(null);
      createClubPost.mutate(
        {
          body: postBody,
          clubId: club.id,
          metadata: pendingNotificationPublish.metadata,
          postType,
          status: postStatus,
          title: postTitle
        },
        {
          onSuccess: () => {
            setPendingNotificationPublish(null);
            setNotificationPublishSuccess(successMessage);
            clearComposerDraft();
          }
        }
      );
      return;
    }

    setEditingPostQualityError(null);
    updateClubPost.mutate(
      {
        body: editingPostBody,
        metadata: pendingNotificationPublish.metadata,
        postId: pendingNotificationPublish.postId,
        postType: editingPostType,
        status: editingPostStatus,
        title: editingPostTitle
      },
      {
        onSuccess: () => {
          setPendingNotificationPublish(null);
          setNotificationPublishSuccess(successMessage);
          setClubPostEditSuccess({ postId: pendingNotificationPublish.postId, postType: editingPostType, title: editingPostTitle });
          cancelEditingPost();
        }
      }
    );
  };

  const handleArchivePost = (post: PulseClubPost) => {
    if (!showAdminTools) return;
    setPendingClubArchive({ kind: 'single', post });
  };

  const confirmPendingClubArchive = async () => {
    if (!pendingClubArchive || archiveClubPost.isPending) return;
    const postsToArchive = pendingClubArchive.kind === 'bulk' ? pendingClubArchive.posts : [pendingClubArchive.post];
    await Promise.all(postsToArchive.map((post) => archiveClubPost.mutateAsync({ club_id: post.club_id, id: post.id })));
    const archivedIds = new Set(postsToArchive.map((post) => post.id));
    setPendingClubArchive(null);
    setClubArchiveSuccess({
      count: postsToArchive.length,
      undoPost: pendingClubArchive.kind === 'single' ? pendingClubArchive.post : undefined
    });
    setSelectedBulkPostIds((current) => pendingClubArchive.kind === 'bulk' ? [] : current.filter((id) => !archivedIds.has(id)));
    if (editingPostId && archivedIds.has(editingPostId)) cancelEditingPost();
  };

  const undoSingleClubArchive = () => {
    const post = clubArchiveSuccess?.undoPost;
    if (!post || updateClubPost.isPending) return;
    updateClubPost.mutate(
      {
        body: post.body,
        metadata: post.metadata,
        postId: post.id,
        postType: post.post_type,
        status: post.status,
        title: post.title
      },
      {
        onSuccess: () => setClubArchiveSuccess(null)
      }
    );
  };

  const clubMemberDisplayName = (member: PulseClubMembership) =>
    member.profile?.display_name ?? 'Pulse member';

  const handleMemberStatusUpdate = (member: PulseClubMembership, nextStatus: PulseClubMembership['status']) => {
    if (nextStatus !== 'active') {
      setPendingClubMemberStatus({ member, nextStatus });
      return;
    }

    updateClubMembershipStatus.mutate({
      clubId: club.id,
      membershipId: member.id,
      status: nextStatus
    }, {
      onSuccess: () => {
        setClubMemberActionSuccess({
          actionLabel: 'approved',
          memberName: clubMemberDisplayName(member)
        });
      }
    });
  };

  const confirmPendingClubMemberStatus = () => {
    if (!pendingClubMemberStatus || updateClubMembershipStatus.isPending) return;
    const { member, nextStatus } = pendingClubMemberStatus;
    updateClubMembershipStatus.mutate({
      clubId: club.id,
      membershipId: member.id,
      status: nextStatus
    }, {
      onSuccess: () => {
        setPendingClubMemberStatus(null);
        setClubMemberActionSuccess({
          actionLabel: nextStatus === 'paused' && member.status === 'pending' ? 'held' : nextStatus === 'paused' ? 'paused' : 'updated',
          memberName: clubMemberDisplayName(member)
        });
      }
    });
  };

  const handleMemberRoleUpdate = (member: PulseClubMembership, nextRole: PulseClubMembership['role']) => {
    if (member.profile_id === profile.id) return;
    updateClubMembershipStatus.mutate({
      clubId: club.id,
      membershipId: member.id,
      role: nextRole
    });
  };

  const handleMemberTitleSave = (member: PulseClubMembership) => {
    const draftTitle = memberTitleDrafts[member.id] ?? member.title ?? '';
    updateClubMembershipStatus.mutate({
      clubId: club.id,
      membershipId: member.id,
      title: draftTitle.trim() || null
    });
  };

  const renderClubPostIcon = (postType: PulseClubPost['post_type']) => {
    if (postType === 'announcement') return <Megaphone size={18} />;
    if (postType === 'event') return <CalendarClock size={18} />;
    if (postType === 'resource') return <FileStack size={18} />;
    if (postType === 'opportunity') return <BriefcaseBusiness size={18} />;
    return <MessageCircle size={18} />;
  };

  const renderClubPostMeta = (post: PulseClubPost) => {
    const items: string[] = [];
    if (post.post_type === 'event') {
      if (typeof post.metadata.event_date === 'string' && post.metadata.event_date) {
        items.push(clubActivityDateLabel(post.metadata.event_date));
      }
      if (typeof post.metadata.event_time === 'string' && post.metadata.event_time) items.push(post.metadata.event_time);
      if (typeof post.metadata.event_mode === 'string' && post.metadata.event_mode) items.push(post.metadata.event_mode);
      if (typeof post.metadata.event_location === 'string' && post.metadata.event_location) items.push(post.metadata.event_location);
    }
    if (post.post_type === 'resource') {
      if (typeof post.metadata.resource_type === 'string' && post.metadata.resource_type) items.push(post.metadata.resource_type);
      if (typeof post.metadata.resource_url === 'string' && post.metadata.resource_url) items.push('Link attached');
    }
    if (post.post_type === 'opportunity') {
      const deadline = readClubPostDateMetadata(post);
      if (deadline) items.push(`Deadline ${clubActivityDateLabel(deadline)}`);
      items.push(isClubPostExpired(post) ? 'Expired' : 'Active');
    }
    if (!items.length) return null;
    return <small className="pulse-club-structured-meta">{items.join(' · ')}</small>;
  };

  const renderClubPostAdminMeta = (post: PulseClubPost) => {
    const createdAtMs = new Date(post.created_at).getTime();
    const updatedAtMs = post.updated_at ? new Date(post.updated_at).getTime() : 0;
    const hasEdit = Number.isFinite(updatedAtMs) && Number.isFinite(createdAtMs) && updatedAtMs - createdAtMs > 5000;

    return (
      <div className="pulse-club-post-admin-meta" aria-label="Admin post history">
        <span><UsersRound size={14} /> Created by {post.author?.display_name ?? 'Club admin'}</span>
        <span><Clock3 size={14} /> Created {clubActivityDateLabel(post.created_at)}</span>
        <span><Pencil size={14} /> Last edited {hasEdit && post.updated_at ? clubActivityDateLabel(post.updated_at) : 'Not edited yet'}</span>
        <span><ShieldCheck size={14} /> {clubPostStatusLabel(post.status)}</span>
        {post.status === 'archived' && post.moderated_at ? (
          <span><Archive size={14} /> Archived {clubActivityDateLabel(post.moderated_at)}</span>
        ) : null}
      </div>
    );
  };

  const renderClubPostActivityPanel = (post: PulseClubPost) => {
    const summary = clubPostActionSummary.get(post.id) ?? { interested: 0, saved: 0, useful: 0 };
    const editedAt = post.updated_at && clubPostTimestamp(post.updated_at) > clubPostTimestamp(post.created_at)
      ? clubActivityDateLabel(post.updated_at)
      : 'Not edited yet';
    const adminNote = adminNoteDrafts[post.id] ?? readClubPostAdminNote(post);
    const adminNoteUpdatedAt = typeof post.metadata.admin_note_updated_at === 'string' ? post.metadata.admin_note_updated_at : '';
    const canSaveNote = !post.id.startsWith('sample-') && !updateClubPost.isPending;

    return (
      <section className="pulse-club-post-activity-panel" aria-label="Admin post activity">
        <div className="pulse-club-post-activity-panel__header">
          <div>
            <PulseBadge tone="gold">Post Activity</PulseBadge>
            <h3>{post.title}</h3>
            <p>{clubPostTypeLabel(post.post_type)} · {clubPostStatusLabel(post.status)} · Posted {clubActivityDateLabel(post.created_at)}</p>
          </div>
          <button type="button" onClick={() => setAdminActivityPostId(null)}>
            Close
          </button>
        </div>
        <div className="pulse-club-post-activity-panel__stats">
          <span>
            <strong>{summary.saved}</strong>
            Saves
          </span>
          <span>
            <strong>{summary.useful}</strong>
            Useful marks
          </span>
          <span>
            <strong>{summary.interested}</strong>
            Interested
          </span>
          <span>
            <strong>{editedAt}</strong>
            Last edited
          </span>
        </div>
        <div className="pulse-club-post-activity-panel__meta">
          <span><UsersRound size={15} /> {post.author?.display_name ?? 'Club admin'}</span>
          <span><ShieldCheck size={15} /> {canBulkArchiveClubPost(post) ? 'Bulk archive eligible' : 'Protected from bulk archive'}</span>
          <span><Clock3 size={15} /> {clubPostDateMeta(post)}</span>
        </div>
        <div className="pulse-club-post-admin-note">
          <label>
            Admin note
            <textarea
              value={adminNote}
              onChange={(event) => setAdminNoteDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
              placeholder="Add an internal follow-up like confirm speaker, update venue, or archive after deadline."
              rows={3}
            />
          </label>
          <div>
            <span>{adminNoteUpdatedAt ? `Last updated ${clubActivityDateLabel(adminNoteUpdatedAt)}` : 'Visible only to club admins.'}</span>
            <button type="button" onClick={() => handleSaveAdminNote(post)} disabled={!canSaveNote}>
              {post.id.startsWith('sample-') ? 'Preview only' : updateClubPost.isPending ? 'Saving note' : 'Save note'}
            </button>
          </div>
        </div>
        <div className="pulse-club-post-activity-panel__actions">
          <button type="button" onClick={() => handleOpenClubPost(post)}>
            View details <ArrowRight size={14} />
          </button>
          <button type="button" onClick={() => startEditingPost(post)}>
            <Pencil size={14} /> Edit
          </button>
          <button type="button" onClick={() => duplicateClubPost(post)}>
            <Copy size={14} /> Duplicate
          </button>
          <button type="button" onClick={() => handleArchivePost(post)} disabled={archiveClubPost.isPending || post.status === 'archived'}>
            <Archive size={14} /> {post.status === 'archived' ? 'Archived' : 'Archive'}
          </button>
        </div>
      </section>
    );
  };

  const renderRelatedClubPosts = (post: PulseClubPost) => {
    const relatedPosts = clubPosts
      .filter((item) => item.id !== post.id)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, 3);

    if (!relatedPosts.length) return null;

    return (
      <section className="pulse-opportunity-related">
        <div className="pulse-college-overview-panel__header">
          <div>
            <PulseBadge tone="gold">More from this club</PulseBadge>
            <h2>Related items from {club.name}</h2>
          </div>
        </div>
        <div className="pulse-opportunity-related__grid">
          {relatedPosts.map((item) => (
            <button
              className="pulse-opportunity-related-card"
              key={item.id}
              type="button"
              onClick={() => {
                handleOpenClubPost(item, { previousPostId: post.id });
                window.requestAnimationFrame(() => {
                  document.getElementById(`club-post-detail-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
              }}
            >
              <PulseBadge tone={item.post_type === 'event' ? 'green' : item.post_type === 'resource' ? 'gold' : 'coral'}>
                {clubPostTypeLabel(item.post_type)}
              </PulseBadge>
              <strong>{item.title}</strong>
              <span>{clubPostDateMeta(item)}</span>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const clubPostTypeLabel = (postType: PulseClubPost['post_type']) => {
    if (postType === 'announcement') return 'Announcement';
    if (postType === 'discussion') return 'Discussion';
    if (postType === 'event') return 'Event';
    if (postType === 'resource') return 'Resource';
    if (postType === 'opportunity') return 'Opportunity';
    if (postType === 'poll') return 'Poll';
    return 'Update';
  };

  const renderSelectedClubPost = (post: PulseClubPost) => {
    const postLabel = clubPostTypeLabel(post.post_type);
    const eventDate = typeof post.metadata.event_date === 'string' ? post.metadata.event_date : null;
    const eventTime = typeof post.metadata.event_time === 'string' ? post.metadata.event_time : null;
    const eventMode = typeof post.metadata.event_mode === 'string' ? post.metadata.event_mode : null;
    const eventLocation = typeof post.metadata.event_location === 'string' ? post.metadata.event_location : null;
    const resourceType = typeof post.metadata.resource_type === 'string' ? post.metadata.resource_type : null;
    const resourceUrl = typeof post.metadata.resource_url === 'string' ? post.metadata.resource_url : null;
    const isEvent = post.post_type === 'event';
    const isResource = post.post_type === 'resource';
    const isOpportunity = post.post_type === 'opportunity';
    const canPersistClubAction = !post.id.startsWith('sample-') && (isResource || isOpportunity);
    const isSaved = clubPostActionSet.has(`${post.id}:saved`);
    const isUseful = clubPostActionSet.has(`${post.id}:useful`);
    const isInterested = clubPostActionSet.has(`${post.id}:interested`);
    const saveCount = sampleInteractionCount(post.id, 11) + (isSaved ? 1 : 0);
    const usefulCount = sampleInteractionCount(post.id, 7) + (isUseful ? 1 : 0);
    const interestCount = sampleInteractionCount(post.id, 14) + (isInterested ? 1 : 0);
    const detailBlocks = buildClubPostDetailBlocks(post, club.name);
    const detailFacts = [
      { icon: UsersRound, label: 'Source', value: club.name },
      { icon: CalendarClock, label: isEvent ? 'Date' : 'Posted', value: eventDate ? clubActivityDateLabel(eventDate) : clubActivityDateLabel(post.created_at) },
      { icon: Clock3, label: isEvent ? 'Time' : 'Access', value: eventTime || (resourceUrl ? 'Link attached' : 'Inside Pulse') },
      { icon: isOpportunity ? BriefcaseBusiness : isResource ? FileText : Gauge, label: isOpportunity ? 'Type' : isResource ? 'Resource' : 'Format', value: resourceType || eventMode || postLabel },
      ...(isOpportunity ? [{ icon: Sparkles, label: 'Interest', value: `${interestCount} students` }] : []),
      ...(isResource ? [{ icon: Trophy, label: 'Saved', value: `${saveCount} saves` }] : [])
    ];
    const actionTitle = isEvent
      ? 'Event details'
      : isResource
        ? 'Resource access'
        : isOpportunity
          ? 'Opportunity status'
          : 'Club update';
    const checklist = isEvent
      ? [
          'Check the date, time, mode, and venue before joining.',
          'Follow the club workspace for changes to the session plan.',
          'Use the details section if you need to coordinate with club admins.'
        ]
      : isResource
        ? [
            'Open the attached link if the club shared an external file.',
            'Use the resource notes for preparation, projects, or event follow-up.',
            'Return to the club workspace for related resources from the same team.'
          ]
        : isOpportunity
          ? [
              'Read the brief before expressing interest or contacting the club.',
              'Check whether the opportunity needs applications, teams, or nominations.',
              'Watch the club feed for deadline and selection updates.'
            ]
          : [
              'Read the full update from the club team.',
              'Use the source and posted date to understand context.',
              'Follow the club workspace for related announcements.'
            ];
    const summaryItems = isEvent
      ? [
          { icon: CalendarClock, label: 'When', value: [eventDate ? clubActivityDateLabel(eventDate) : 'Date TBA', eventTime].filter(Boolean).join(' · ') },
          { icon: Gauge, label: 'Mode', value: eventMode || 'Format TBA' },
          { icon: UsersRound, label: 'Where', value: eventLocation || 'Venue or link TBA' }
        ]
      : isResource
        ? [
            { icon: FileText, label: 'What', value: resourceType || 'Resource' },
            { icon: LinkIcon, label: 'Access', value: resourceUrl ? 'External link attached' : 'Inside Pulse' },
            { icon: UsersRound, label: 'Source', value: club.name }
          ]
        : [];

    return (
      <article className="pulse-club-detail-panel pulse-opportunity-detail-page" id={`club-post-detail-${post.id}`}>
        <div className="pulse-opportunity-detail-hero">
          <div>
            <nav className="pulse-detail-breadcrumb" aria-label="Detail location">
              <span>{collegeName}</span>
              <span>{club.name}</span>
              <span>{postLabel}</span>
            </nav>
            <PulseBadge tone={post.post_type === 'event' ? 'green' : post.post_type === 'resource' ? 'gold' : 'coral'}>
              {postLabel}
            </PulseBadge>
            <h1>{post.title}</h1>
            <p>{post.body}</p>
            <div className="pulse-opportunity-detail-hero__meta">
              <span><UsersRound size={17} /> {club.name}</span>
              <span><ShieldCheck size={17} /> {collegeName} workspace</span>
            </div>
            {summaryItems.length ? (
              <div className="pulse-post-detail-summary" aria-label={`${postLabel} summary`}>
                {summaryItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <span key={item.label}>
                      <Icon size={16} />
                      <small>{item.label}</small>
                      <strong>{item.value}</strong>
                    </span>
                  );
                })}
              </div>
            ) : null}
            {showAdminTools ? renderClubPostAdminMeta(post) : null}
          </div>

          <PulseCard className="pulse-opportunity-action-card">
            <span>{renderClubPostIcon(post.post_type)} {isEvent || isResource ? 'Next step' : actionTitle}</span>
            <strong>{isEvent ? (eventDate ? [clubActivityDateLabel(eventDate), eventTime].filter(Boolean).join(' · ') : 'Check event details') : isResource ? (isSaved ? 'Saved to your activity' : resourceUrl ? 'Open or save this resource' : 'Review this resource') : isOpportunity ? (isInterested ? 'Interest saved' : 'Open for club coordination') : 'Published by club admin'}</strong>
            {resourceUrl ? (
              <a className="pulse-button pulse-button--primary" href={resourceUrl} target="_blank" rel="noreferrer">
                <span>Open resource</span>
                <ArrowRight size={18} />
              </a>
            ) : isOpportunity ? (
              <button
                className="pulse-button pulse-button--primary"
                disabled={!canPersistClubAction || toggleClubPostAction.isPending || isInterested}
                type="button"
                onClick={() => toggleClubPostAction.mutate({ actionType: 'interested', clubPostId: post.id, isActive: isInterested })}
              >
                <span>{canPersistClubAction ? (isInterested ? 'Interested' : "I'm interested") : 'Preview only'}</span>
                <BriefcaseBusiness size={18} />
              </button>
            ) : (
              <button className="pulse-button pulse-button--primary" type="button" onClick={handleCloseClubPost}>
                <span>{isEvent ? 'Back to events' : 'Back to club feed'}</span>
                <ArrowRight size={18} />
              </button>
            )}
            {isResource ? (
              <>
                <button
                  className={isSaved ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--ghost'}
                  disabled={!canPersistClubAction || toggleClubPostAction.isPending}
                  type="button"
                  onClick={() => toggleClubPostAction.mutate({ actionType: 'saved', clubPostId: post.id, isActive: isSaved })}
                >
                  <span>{canPersistClubAction ? (isSaved ? 'Saved resource' : 'Save resource') : 'Preview only'}</span>
                  <FileStack size={18} />
                </button>
                <button
                  className={isUseful ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--ghost'}
                  disabled={!canPersistClubAction || toggleClubPostAction.isPending}
                  type="button"
                  onClick={() => toggleClubPostAction.mutate({ actionType: 'useful', clubPostId: post.id, isActive: isUseful })}
                >
                  <span>{canPersistClubAction ? (isUseful ? 'Marked useful' : 'Mark useful') : 'Preview only'}</span>
                  <Trophy size={18} />
                </button>
              </>
            ) : null}
            {isOpportunity && resourceUrl ? (
              <button
                className={isInterested ? 'pulse-button pulse-button--secondary' : 'pulse-button pulse-button--ghost'}
                disabled={!canPersistClubAction || toggleClubPostAction.isPending || isInterested}
                type="button"
                onClick={() => toggleClubPostAction.mutate({ actionType: 'interested', clubPostId: post.id, isActive: isInterested })}
              >
                <span>{canPersistClubAction ? (isInterested ? 'Interested' : "I'm interested") : 'Preview only'}</span>
                <BriefcaseBusiness size={18} />
              </button>
            ) : null}
            {toggleClubPostAction.error ? <p className="pulse-form-error">{toggleClubPostAction.error.message}</p> : null}
            <button className="pulse-button pulse-button--ghost" type="button" onClick={() => handleCopyClubPostLink(post)}>
              <span>{copiedPostId === post.id ? 'Copied link' : 'Copy link'}</span>
              <LinkIcon size={18} />
            </button>
            {previousClubPostId ? (
              <button className="pulse-button pulse-button--ghost" type="button" onClick={handleOpenPreviousClubPost}>
                <span>Back to previous item</span>
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <button className="pulse-button pulse-button--ghost" type="button" onClick={handleCloseClubPost}>
              <span>Close details</span>
            </button>
          </PulseCard>
        </div>

        <div className="pulse-opportunity-info-grid">
          {detailFacts.map((item) => {
            const Icon = item.icon;
            return (
              <PulseCard key={`${item.label}-${item.value}`}>
                <Icon size={20} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </PulseCard>
            );
          })}
        </div>

        <div className="pulse-opportunity-detail-grid">
          <PulseCard className="pulse-opportunity-brief-card">
            <PulseBadge tone="coral">What to expect</PulseBadge>
            <h2>{isEvent ? 'Use this before joining the event.' : isResource ? 'Use this before opening the resource.' : isOpportunity ? 'Use this before taking action.' : 'Use this to understand the update.'}</h2>
            <div className="pulse-opportunity-checklist">
              {checklist.map((item) => (
                <span key={item}><CheckCircle2 size={17} /> {item}</span>
              ))}
            </div>
          </PulseCard>
          <PulseCard className="pulse-opportunity-brief-card">
            <PulseBadge tone="gold">Key details</PulseBadge>
            <h2>{eventLocation || resourceType || `${club.name} workspace`}</h2>
            <div className="pulse-opportunity-checklist">
              <span><UsersRound size={17} /> Posted by {post.author?.display_name ?? 'Club admin'}</span>
              <span><Clock3 size={17} /> Posted {clubActivityDateLabel(post.created_at)}</span>
              <span><ShieldCheck size={17} /> Visible to {collegeName} students</span>
              {isResource ? <span><Trophy size={17} /> {usefulCount} students found this useful</span> : null}
            </div>
          </PulseCard>
        </div>

        <PulseCard className="pulse-opportunity-detail-description-card">
          <div>
            <PulseBadge tone="coral">{postLabel} details</PulseBadge>
            <h2>Read the full note from the club.</h2>
          </div>
          <div className="pulse-opportunity-detail-description">
            <p>{post.body}</p>
          </div>
        </PulseCard>

        <div className="pulse-opportunity-detail-grid">
          {detailBlocks.map((block) => (
            <PulseCard className="pulse-opportunity-brief-card" key={`${post.id}-${block.badge}`}>
              <PulseBadge tone="gold">{block.badge}</PulseBadge>
              <h2>{block.title}</h2>
              <div className="pulse-opportunity-checklist">
                {block.items.map((item) => (
                  <span key={item}><ClipboardCheck size={17} /> {item}</span>
                ))}
              </div>
            </PulseCard>
          ))}
        </div>

        {renderRelatedClubPosts(post)}
      </article>
    );
  };

  const renderClubPreviewList = (
    posts: PulseClubPost[],
    emptyTitle: string,
    emptyText: string,
    adminActionLabel: string,
    nextPostType: typeof postType
  ) => (
    <div className="pulse-club-mini-list">
      {posts.length ? posts.slice(0, 3).map((post) => (
        <article
          className={searchParams.get('post') === post.id ? 'pulse-club-mini-list__item--highlighted' : ''}
          id={`club-post-${post.id}`}
          key={post.id}
          onClick={() => handleOpenClubPost(post)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleOpenClubPost(post);
            }
          }}
          role="button"
          tabIndex={0}
        >
          {renderClubPostIcon(post.post_type)}
          <div>
            <span className="pulse-club-mini-list__title-row">
              <strong>{post.title}</strong>
              {(post.post_type === 'event' || post.post_type === 'resource') ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCopyClubPostLink(post);
                  }}
                >
                  <LinkIcon size={13} /> {copiedPostId === post.id ? 'Copied' : 'Share'}
                </button>
              ) : null}
            </span>
            <p>{post.body}</p>
            {renderClubPostMeta(post)}
            <small>{post.author?.display_name ?? 'Club admin'} · {post.post_type}</small>
          </div>
        </article>
      )) : (
        <article>
          <MessageCircle size={18} />
          <div>
            <strong>{emptyTitle}</strong>
            <p>{emptyText}</p>
            {isManager ? (
              <button className="pulse-club-inline-action pulse-club-empty-action" type="button" onClick={() => openClubComposer(nextPostType)}>
                {adminActionLabel}
              </button>
            ) : null}
          </div>
        </article>
      )}
    </div>
  );

  return (
    <section className="pulse-club-detail-page">
      <Link className="pulse-back-link" to="/pulse/clubs"><ArrowLeft size={18} /> Back to My College Workspace</Link>

      <div className={`pulse-club-detail-hero ${clubAccentClass(club.cover_color)}`}>
        <div>
          <PulseBadge tone="green">{collegeName} workspace</PulseBadge>
          <h1>{workspaceName}</h1>
          <p>{club.description || club.summary}</p>
        </div>
        <PulseCard className="pulse-club-next-card">
          <span><UsersRound size={18} /> Membership</span>
          <strong>{isJoined ? 'You are connected to this club workspace.' : 'This club is visible to your college community.'}</strong>
          <p>{categoryLabel(club.category)} · {club.summary}</p>
          <div className="pulse-club-next-card__meta">
            <span>{activeClubMembers.length} followers</span>
            <span>{eventPosts.length} events</span>
            <span>{resourcePosts.length} resources</span>
          </div>
          {isManager ? (
            <button
              className="pulse-button pulse-button--primary"
              type="button"
              onClick={() => {
                setClubAdminMode('admin');
                setIsManageOpen((value) => !value);
              }}
            >
              <span>{showAdminTools ? 'Manage Club' : 'Open admin tools'}</span>
              <Gauge size={18} />
            </button>
          ) : (
            <button className="pulse-button pulse-button--secondary" disabled={isWorking} type="button" onClick={handleMembershipToggle}>
              <span>{isJoined ? 'Following Club' : 'Follow Club'}</span>
              {isJoined ? <CheckCircle2 size={18} /> : <UserPlus size={18} />}
            </button>
          )}
        </PulseCard>
      </div>

      {isManager ? (
        <PulseCard className="pulse-club-view-toggle">
          <div>
            <PulseBadge tone={showAdminTools ? 'gold' : 'green'}>Club Admin Preview</PulseBadge>
            <h2>{showAdminTools ? 'Admin tools view' : 'Student view'}</h2>
            <p>
              {showAdminTools
                ? 'Operational controls are visible for publishing, approvals, roles, and workspace review.'
                : 'You are seeing this club exactly like a regular student member would see it.'}
            </p>
          </div>
          <div className="pulse-club-view-toggle__controls" aria-label="Club admin preview mode">
            <button
              className={clubAdminMode === 'student' ? 'active' : ''}
              onClick={() => handleClubAdminModeChange('student')}
              type="button"
            >
              Student view
            </button>
            <button
              className={clubAdminMode === 'admin' ? 'active' : ''}
              onClick={() => handleClubAdminModeChange('admin')}
              type="button"
            >
              Admin tools
            </button>
          </div>
        </PulseCard>
      ) : null}

      {showAdminTools ? (
        <PulseCard className="pulse-club-admin-top-tabs">
          <div className="pulse-club-admin-panel-tabs" aria-label="Club admin sections">
            {[
              { count: adminPostStatusCounts.published, icon: LayoutDashboard, label: 'Dashboard', value: 'dashboard' as ClubAdminPanel },
              { count: editingPostId ? 1 : postTitle.trim() ? 1 : 0, icon: Send, label: 'Publish', value: 'publish' as ClubAdminPanel },
              { count: clubPosts.length, icon: BarChart3, label: 'Content', value: 'content' as ClubAdminPanel },
              { count: activeClubMembers.length + pendingClubMembers.length, icon: UsersRound, label: 'Members', value: 'members' as ClubAdminPanel },
              { count: notificationAuditStats.sent, icon: Bell, label: 'Notifications', value: 'notifications' as ClubAdminPanel },
              { count: eventPosts.length + resourcePosts.length + opportunityPosts.length, icon: Search, label: 'Student View', value: 'student' as ClubAdminPanel }
            ].map((panel) => {
              const Icon = panel.icon;
              return (
                <button
                  className={activeClubAdminPanel === panel.value ? 'active' : undefined}
                  key={panel.value}
                  onClick={() => handleClubAdminPanelChange(panel.value)}
                  type="button"
                >
                  <Icon size={16} />
                  <span>{panel.label}</span>
                  <em>{panel.count}</em>
                </button>
              );
            })}
            <button
              className="pulse-club-admin-panel-tabs__copy"
              onClick={handleCopyClubAdminViewLink}
              type="button"
            >
              <LinkIcon size={15} />
              <span>{copiedClubAdminView ? 'Copied' : 'Copy view link'}</span>
            </button>
          </div>
        </PulseCard>
      ) : null}

      {showAdminTools && activeClubAdminPanel === 'dashboard' ? (
        <PulseCard className="pulse-club-admin-status-banner">
          <div>
            <PulseBadge tone="gold">Content Health</PulseBadge>
            <h2>Admin status overview</h2>
            <p>Track what is visible, waiting in draft, archived, or expired.</p>
          </div>
          <div className="pulse-club-admin-status-banner__grid" aria-label="Club content status counts">
            <button type="button" onClick={() => jumpToClubFeedFilter('drafts')}>
              <span>Drafts</span>
              <strong>{adminPostStatusCounts.drafts}</strong>
            </button>
            <button type="button" onClick={() => jumpToClubFeedFilter('active')}>
              <span>Published</span>
              <strong>{adminPostStatusCounts.published}</strong>
            </button>
            <button type="button" onClick={() => jumpToClubFeedFilter('archived')}>
              <span>Archived</span>
              <strong>{adminPostStatusCounts.archived}</strong>
            </button>
            <button type="button" onClick={() => jumpToClubFeedFilter('expired')}>
              <span>Expired</span>
              <strong>{adminPostStatusCounts.expired}</strong>
            </button>
          </div>
        </PulseCard>
      ) : null}

      {(!showAdminTools || activeClubAdminPanel === 'student') ? (
      <PulseCard className="pulse-club-public-profile">
        <div className="pulse-club-public-profile__intro">
          <PulseBadge tone="coral">Club Profile</PulseBadge>
          <h2>{club.name}</h2>
          <p>{club.summary}</p>
        </div>
        <div className="pulse-club-public-profile__grid">
          <article>
            <div className="pulse-club-command-card__header">
              <UsersRound size={22} />
              <PulseBadge tone="green">{coordinators.length || activeClubMembers.length} visible</PulseBadge>
            </div>
            <h3>Coordinators</h3>
            <div className="pulse-club-profile-list">
              {(coordinators.length ? coordinators : activeClubMembers.slice(0, 3)).map((member) => (
                <span key={member.id}>
                  <strong>{member.profile?.display_name ?? 'Pulse member'}</strong>
                  <small>{member.title || member.role}</small>
                </span>
              ))}
              {!coordinators.length && !activeClubMembers.length ? (
                <span>
                  <strong>Coordinator details coming soon</strong>
                  <small>Club admins can add members and titles.</small>
                </span>
              ) : null}
            </div>
          </article>
          <article>
            <div className="pulse-club-command-card__header">
              <CalendarClock size={22} />
              <PulseBadge tone="gold">{upcomingEvent ? 'Upcoming' : 'Not added yet'}</PulseBadge>
            </div>
            <h3>Upcoming event</h3>
            <strong>{upcomingEvent?.title ?? 'No event published yet'}</strong>
            <p>{upcomingEvent?.body ?? `Events from ${clubTopic} will appear here once the club publishes them.`}</p>
            {upcomingEvent ? renderClubPostMeta(upcomingEvent) : null}
          </article>
          <article>
            <div className="pulse-club-command-card__header">
              <FileStack size={22} />
              <PulseBadge tone="gold">{featuredResource ? 'Featured' : 'Empty'}</PulseBadge>
            </div>
            <h3>Featured resource</h3>
            <strong>{featuredResource?.title ?? 'No resource published yet'}</strong>
            <p>{featuredResource?.body ?? `Resources, templates, and links shared by ${clubTopic} will appear here.`}</p>
            {featuredResource ? renderClubPostMeta(featuredResource) : null}
            {typeof featuredResource?.metadata.resource_url === 'string' && featuredResource.metadata.resource_url ? (
              <a className="pulse-club-resource-link" href={featuredResource.metadata.resource_url} target="_blank" rel="noreferrer">
                Open resource <ArrowRight size={14} />
              </a>
            ) : null}
          </article>
        </div>
      </PulseCard>
      ) : null}

      {showAdminTools && activeClubAdminPanel === 'publish' && !isManageOpen && !editingPostId ? (
        <PulseCard className="pulse-club-admin-summary">
          <div className="pulse-club-section-header">
            <div>
              <PulseBadge tone="gold">Publish</PulseBadge>
              <h2>What do you want to share?</h2>
            </div>
            <span><Send size={16} /> Club admin</span>
          </div>
          <div className="pulse-club-admin-quick-actions" aria-label="Start publishing">
            {[
              { icon: Megaphone, label: 'Announcement', type: 'announcement' as typeof postType },
              { icon: CalendarClock, label: 'Event', type: 'event' as typeof postType },
              { icon: FileText, label: 'Resource', type: 'resource' as typeof postType },
              { icon: BriefcaseBusiness, label: 'Opportunity', type: 'opportunity' as typeof postType }
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.type} onClick={() => openClubComposer(action.type)} type="button">
                  <Icon size={16} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </PulseCard>
      ) : null}

      {showAdminTools && activeClubAdminPanel === 'publish' && isManageOpen ? (
        <PulseCard className="pulse-club-manage-panel">
          <div className="pulse-club-section-header" id="club-create-composer">
            <div>
              <PulseBadge tone="gold">Club Admin Mode</PulseBadge>
              <h2>Publish an official club update</h2>
            </div>
            <div className="pulse-club-composer-actions">
              <button type="button" onClick={jumpToCreateStudentPreview}>
                <Search size={14} /> Preview as student
              </button>
              <div className="pulse-club-draft-status">
                <span>
                  {composerDraftSavedAt
                    ? `Draft saved ${pulsePostRelativeTime(new Date(composerDraftSavedAt).toISOString())}`
                    : 'Draft autosaves locally'}
                </span>
                <button type="button" onClick={clearComposerDraft}>
                  Clear draft
                </button>
              </div>
            </div>
          </div>
          <form onSubmit={handlePostSubmit}>
            <label>
              Update type
              <select value={postType} onChange={(event) => setPostType(event.target.value as typeof postType)}>
                <option value="announcement">Announcement</option>
                <option value="event">Event</option>
                <option value="resource">Resource</option>
                <option value="opportunity">Opportunity</option>
              </select>
            </label>
            <label>
              Post status
              <select value={postStatus} onChange={(event) => setPostStatus(event.target.value as typeof postStatus)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <div className="pulse-club-template-picker pulse-club-manage-panel__wide">
              <div>
                <strong>Start from a template</strong>
                <span>{postTitle.startsWith('Copy of ') ? 'Duplicated post loaded as a draft. Review dates and details before publishing.' : 'Prefill useful details, then edit before publishing.'}</span>
              </div>
              <div>
                {composerTemplates[postType].map((template) => (
                  <button key={`${template.postType}-${template.label}`} type="button" onClick={() => applyComposerTemplate(template)}>
                    <Sparkles size={15} /> {template.label}
                  </button>
                ))}
              </div>
            </div>
            {composerTemplateNotice ? (
              <div className="pulse-club-template-notice pulse-club-manage-panel__wide">
                <Sparkles size={16} />
                <span>{composerTemplateNotice}</span>
              </div>
            ) : null}
            <label>
              Title
              <input
                maxLength={180}
                placeholder="e.g. Case prep session this Friday"
                required
                value={postTitle}
                onChange={(event) => setPostTitle(event.target.value)}
              />
            </label>
            <label className="pulse-club-manage-panel__wide">
              Details
              <textarea
                placeholder="Add the announcement, event note, resource context, or opportunity details."
                required
                rows={4}
                value={postBody}
                onChange={(event) => setPostBody(event.target.value)}
              />
            </label>
            {postType === 'event' ? (
              <div className="pulse-club-structured-fields pulse-club-manage-panel__wide">
                <label>
                  Event date
                  <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
                </label>
                <label>
                  Event time
                  <input type="time" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />
                </label>
                <label>
                  Mode
                  <select value={eventMode} onChange={(event) => setEventMode(event.target.value)}>
                    <option value="Campus">Campus</option>
                    <option value="Online">Online</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </label>
                <label>
                  Venue or link
                  <input
                    maxLength={180}
                    placeholder="Auditorium, classroom, or meeting link"
                    value={eventLocation}
                    onChange={(event) => setEventLocation(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Agenda items
                  <textarea
                    placeholder={'Opening context and goals\nLive practice round\nWrap-up and next steps'}
                    rows={3}
                    value={eventAgendaItems}
                    onChange={(event) => setEventAgendaItems(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Preparation notes
                  <textarea
                    placeholder={'Bring your laptop\nRead the case prompt before joining\nArrive 10 minutes early'}
                    rows={3}
                    value={eventPrepItems}
                    onChange={(event) => setEventPrepItems(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {postType === 'resource' ? (
              <div className="pulse-club-structured-fields pulse-club-manage-panel__wide">
                <label>
                  Resource type
                  <select value={resourceType} onChange={(event) => setResourceType(event.target.value)}>
                    <option value="Guide">Guide</option>
                    <option value="Template">Template</option>
                    <option value="Deck">Deck</option>
                    <option value="Drive link">Drive link</option>
                    <option value="Reading">Reading</option>
                  </select>
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Resource link
                  <input
                    placeholder="Paste Drive, document, or website link"
                    type="url"
                    value={resourceUrl}
                    onChange={(event) => setResourceUrl(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Resource preview
                  <textarea
                    placeholder={'Includes sample framework and examples\nUseful before the next practice session\nSave it for interview prep'}
                    rows={3}
                    value={resourcePreviewItems}
                    onChange={(event) => setResourcePreviewItems(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Best use
                  <textarea
                    placeholder={'Use it to structure your first draft\nDiscuss doubts in the club workspace\nPair it with the upcoming workshop'}
                    rows={3}
                    value={resourceUsageItems}
                    onChange={(event) => setResourceUsageItems(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {postType === 'opportunity' ? (
              <div className="pulse-club-structured-fields pulse-club-manage-panel__wide">
                <label>
                  Deadline
                  <input type="date" value={opportunityDeadline} onChange={(event) => setOpportunityDeadline(event.target.value)} />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Opportunity brief
                  <textarea
                    placeholder={'Open for teams of 2-3 students\nShortlisted students will get a project brief\nClub coordinators will confirm next steps'}
                    rows={3}
                    value={opportunityBriefItems}
                    onChange={(event) => setOpportunityBriefItems(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Good fit
                  <textarea
                    placeholder={'Students interested in live project exposure\nStudents who can commit 3-4 hours this week\nStudents comfortable with research and presentation work'}
                    rows={3}
                    value={opportunityFitItems}
                    onChange={(event) => setOpportunityFitItems(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {postType === 'announcement' ? (
              <div className="pulse-club-structured-fields pulse-club-manage-panel__wide">
                <label className="pulse-club-structured-fields__wide">
                  Student next actions
                  <textarea
                    placeholder={'Read the update carefully\nOpen the club workspace for related posts\nWatch for the next announcement'}
                    rows={3}
                    value={announcementNextActions}
                    onChange={(event) => setAnnouncementNextActions(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Context notes
                  <textarea
                    placeholder={'Shared by the club admin team\nVisible to this college workspace\nRelated items may appear below'}
                    rows={3}
                    value={announcementContextItems}
                    onChange={(event) => setAnnouncementContextItems(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {renderNotificationAudiencePreview(postType, postStatus)}
            {renderStudentPostPreview(postType, postTitle, postBody, buildCreatePostMetadata(), postStatus, postQualityError, 'club-create-student-preview')}
            {createClubPost.error ? <p className="pulse-club-form-error">{createClubPost.error.message}</p> : null}
            <button className="pulse-button pulse-button--primary" disabled={createClubPost.isPending} type="submit">
              <span>{createClubPost.isPending ? 'Saving...' : postStatus === 'draft' ? 'Save draft' : 'Publish update'}</span>
              <Send size={18} />
            </button>
          </form>
        </PulseCard>
      ) : null}

      {showAdminTools && activeClubAdminPanel === 'publish' && editingPostId ? (
        <PulseCard className="pulse-club-manage-panel">
          <div className="pulse-club-section-header" id="club-edit-composer">
            <div>
              <PulseBadge tone="gold">Edit Club Post</PulseBadge>
              <h2>Update this club workspace post</h2>
            </div>
            <div className="pulse-club-composer-actions">
              <button type="button" onClick={jumpToEditStudentPreview}>
                <Search size={14} /> Preview as student
              </button>
              <button className="pulse-club-inline-action" type="button" onClick={requestCancelEditingPost}>
                Cancel
              </button>
            </div>
          </div>
          <form onSubmit={handlePostEditSubmit}>
            <label>
              Post type
              <select value={editingPostType} onChange={(event) => setEditingPostType(event.target.value as PulseClubPost['post_type'])}>
                <option value="announcement">Announcement</option>
                <option value="discussion">Discussion</option>
                <option value="event">Event</option>
                <option value="poll">Poll</option>
                <option value="resource">Resource</option>
                <option value="opportunity">Opportunity</option>
              </select>
            </label>
            <label>
              Post status
              <select value={editingPostStatus} onChange={(event) => setEditingPostStatus(event.target.value as typeof editingPostStatus)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Title
              <input
                maxLength={180}
                required
                value={editingPostTitle}
                onChange={(event) => setEditingPostTitle(event.target.value)}
              />
            </label>
            <label className="pulse-club-manage-panel__wide">
              Details
              <textarea
                required
                rows={4}
                value={editingPostBody}
                onChange={(event) => setEditingPostBody(event.target.value)}
              />
            </label>
            {editingPostType === 'event' ? (
              <div className="pulse-club-structured-fields pulse-club-manage-panel__wide">
                <label>
                  Event date
                  <input type="date" value={editingEventDate} onChange={(event) => setEditingEventDate(event.target.value)} />
                </label>
                <label>
                  Event time
                  <input type="time" value={editingEventTime} onChange={(event) => setEditingEventTime(event.target.value)} />
                </label>
                <label>
                  Mode
                  <select value={editingEventMode} onChange={(event) => setEditingEventMode(event.target.value)}>
                    <option value="Campus">Campus</option>
                    <option value="Online">Online</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </label>
                <label>
                  Venue or link
                  <input
                    maxLength={180}
                    placeholder="Auditorium, classroom, or meeting link"
                    value={editingEventLocation}
                    onChange={(event) => setEditingEventLocation(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Agenda items
                  <textarea
                    placeholder={'Opening context and goals\nLive practice round\nWrap-up and next steps'}
                    rows={3}
                    value={editingEventAgendaItems}
                    onChange={(event) => setEditingEventAgendaItems(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Preparation notes
                  <textarea
                    placeholder={'Bring your laptop\nRead the case prompt before joining\nArrive 10 minutes early'}
                    rows={3}
                    value={editingEventPrepItems}
                    onChange={(event) => setEditingEventPrepItems(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {editingPostType === 'resource' ? (
              <div className="pulse-club-structured-fields pulse-club-manage-panel__wide">
                <label>
                  Resource type
                  <select value={editingResourceType} onChange={(event) => setEditingResourceType(event.target.value)}>
                    <option value="Guide">Guide</option>
                    <option value="Template">Template</option>
                    <option value="Deck">Deck</option>
                    <option value="Drive link">Drive link</option>
                    <option value="Reading">Reading</option>
                  </select>
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Resource link
                  <input
                    placeholder="Paste Drive, document, or website link"
                    type="url"
                    value={editingResourceUrl}
                    onChange={(event) => setEditingResourceUrl(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Resource preview
                  <textarea
                    placeholder={'Includes sample framework and examples\nUseful before the next practice session\nSave it for interview prep'}
                    rows={3}
                    value={editingResourcePreviewItems}
                    onChange={(event) => setEditingResourcePreviewItems(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Best use
                  <textarea
                    placeholder={'Use it to structure your first draft\nDiscuss doubts in the club workspace\nPair it with the upcoming workshop'}
                    rows={3}
                    value={editingResourceUsageItems}
                    onChange={(event) => setEditingResourceUsageItems(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {editingPostType === 'opportunity' ? (
              <div className="pulse-club-structured-fields pulse-club-manage-panel__wide">
                <label>
                  Deadline
                  <input type="date" value={editingOpportunityDeadline} onChange={(event) => setEditingOpportunityDeadline(event.target.value)} />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Opportunity brief
                  <textarea
                    placeholder={'Open for teams of 2-3 students\nShortlisted students will get a project brief\nClub coordinators will confirm next steps'}
                    rows={3}
                    value={editingOpportunityBriefItems}
                    onChange={(event) => setEditingOpportunityBriefItems(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Good fit
                  <textarea
                    placeholder={'Students interested in live project exposure\nStudents who can commit 3-4 hours this week\nStudents comfortable with research and presentation work'}
                    rows={3}
                    value={editingOpportunityFitItems}
                    onChange={(event) => setEditingOpportunityFitItems(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {editingPostType === 'announcement' ? (
              <div className="pulse-club-structured-fields pulse-club-manage-panel__wide">
                <label className="pulse-club-structured-fields__wide">
                  Student next actions
                  <textarea
                    placeholder={'Read the update carefully\nOpen the club workspace for related posts\nWatch for the next announcement'}
                    rows={3}
                    value={editingAnnouncementNextActions}
                    onChange={(event) => setEditingAnnouncementNextActions(event.target.value)}
                  />
                </label>
                <label className="pulse-club-structured-fields__wide">
                  Context notes
                  <textarea
                    placeholder={'Shared by the club admin team\nVisible to this college workspace\nRelated items may appear below'}
                    rows={3}
                    value={editingAnnouncementContextItems}
                    onChange={(event) => setEditingAnnouncementContextItems(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            {renderNotificationAudiencePreview(
              editingPostType,
              editingPostStatus,
              clubPosts.find((post) => post.id === editingPostId)?.status ?? null
            )}
            {renderStudentPostPreview(
              editingPostType,
              editingPostTitle,
              editingPostBody,
              buildEditingPostMetadata(),
              editingPostStatus,
              editingPostQualityError,
              'club-edit-student-preview',
              jumpToEditComposerEditor
            )}
            {updateClubPost.error ? <p className="pulse-club-form-error">{updateClubPost.error.message}</p> : null}
            <button className="pulse-button pulse-button--primary" disabled={updateClubPost.isPending} type="submit">
              <span>{updateClubPost.isPending ? 'Saving...' : 'Save changes'}</span>
              <CheckCircle2 size={18} />
            </button>
          </form>
        </PulseCard>
      ) : null}

      {showAdminTools && activeClubAdminPanel !== 'publish' && activeClubAdminPanel !== 'student' ? (
        <div className={activeClubAdminPanel === 'content' ? 'pulse-club-content-overview-grid' : undefined}>
        <PulseCard className="pulse-club-admin-summary">
          <div className="pulse-club-section-header">
            <div>
              <PulseBadge tone="gold">
                {activeClubAdminPanel === 'dashboard' ? 'Club Admin Activity Summary' : activeClubAdminPanel === 'content' ? 'Content Management' : activeClubAdminPanel === 'members' ? 'Member Management' : 'Notification Management'}
              </PulseBadge>
              <h2>
                {activeClubAdminPanel === 'dashboard' ? 'Workspace activity this month' : activeClubAdminPanel === 'content' ? 'Content signals and post management' : activeClubAdminPanel === 'members' ? 'Members, roles, and requests' : 'Notification delivery audit'}
              </h2>
            </div>
            <span><ShieldCheck size={16} /> Admin only</span>
          </div>
          {activeClubAdminPanel === 'dashboard' ? (
          <>
          <div className="pulse-club-admin-summary__grid">
            <article>
              <strong>{monthlyActivity.total}</strong>
              <span>Posts this month</span>
            </article>
            <article>
              <strong>{monthlyActivity.events}</strong>
              <span>Events created</span>
            </article>
            <article>
              <strong>{monthlyActivity.resources}</strong>
              <span>Resources added</span>
            </article>
            <article>
              <strong>{monthlyActivity.opportunities}</strong>
              <span>Opportunities shared</span>
            </article>
            <article>
              <strong>{monthlyActivity.discussions}</strong>
              <span>Discussions and polls</span>
            </article>
            <article>
              <strong>{activeClubMembers.length}</strong>
              <span>Active members</span>
            </article>
            <article>
              <strong>{adminActionTotals.saved}</strong>
              <span>Resource saves</span>
            </article>
            <article>
              <strong>{adminActionTotals.useful}</strong>
              <span>Useful marks</span>
            </article>
            <article>
              <strong>{adminActionTotals.interested}</strong>
              <span>Opportunity interests</span>
            </article>
          </div>
          <div className="pulse-club-admin-quick-actions" aria-label="Club admin quick actions">
            {[
              { icon: Megaphone, label: 'Create update', type: 'announcement' as typeof postType },
              { icon: CalendarClock, label: 'Add event', type: 'event' as typeof postType },
              { icon: FileText, label: 'Add resource', type: 'resource' as typeof postType },
              { icon: BriefcaseBusiness, label: 'Post opportunity', type: 'opportunity' as typeof postType }
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.type} onClick={() => handleClubAdminQuickCreate(action.type)} type="button">
                  <Icon size={16} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
          </>
          ) : null}
          {activeClubAdminPanel === 'content' ? (
            <div className="pulse-club-admin-signals">
            <div className="pulse-club-admin-actions__header">
              <h3>Top content signals</h3>
              <PulseBadge tone={topContentSignals.length ? 'green' : 'gold'}>
                {topContentSignals.length ? `${topContentSignals.length} active` : 'No signals yet'}
              </PulseBadge>
            </div>
            {clubPostActionSummaryQuery.isLoading ? (
              <article>
                <BarChart3 size={18} />
                <div>
                  <strong>Checking student actions</strong>
                  <p>Pulse is loading saved, useful, and interest signals for this club.</p>
                </div>
              </article>
            ) : null}
            {!clubPostActionSummaryQuery.isLoading && topContentSignals.length ? topContentSignals.map(({ post, score, summary }) => (
              <article key={post.id}>
                {post.post_type === 'resource' ? <FileStack size={18} /> : <BriefcaseBusiness size={18} />}
                <div>
                  <strong>{post.title}</strong>
                  <p>
                    {post.post_type === 'resource'
                      ? `${summary.saved} saves · ${summary.useful} useful marks`
                      : `${summary.interested} interested students`}
                  </p>
                </div>
                <button className="pulse-club-inline-action" type="button" onClick={() => handleOpenClubPost(post)}>
                  View <ArrowRight size={14} />
                </button>
                <em>{score}</em>
              </article>
            )) : null}
            {!clubPostActionSummaryQuery.isLoading && !topContentSignals.length ? (
              <article>
                <BarChart3 size={18} />
                <div>
                  <strong>No student signals yet</strong>
                  <p>As students save resources, mark them useful, or show opportunity interest, the strongest content will appear here.</p>
                </div>
              </article>
            ) : null}
            {pendingContentActions.map((action) => (
              <article key={action}>
                <ClipboardCheck size={18} />
                <div>
                  <strong>{action}</strong>
                  <p>Recommended to keep this club workspace useful for students.</p>
                </div>
              </article>
            ))}
            </div>
          ) : null}
          {activeClubAdminPanel === 'notifications' ? (
            <div className="pulse-club-notification-audit">
            <div className="pulse-club-admin-actions__header">
              <h3>Notification delivery audit</h3>
              <span className="pulse-club-admin-actions__controls">
                <button type="button" onClick={() => sendTestNotification.mutate()} disabled={sendTestNotification.isPending}>
                  {sendTestNotification.isPending ? 'Sending...' : 'Send test'}
                </button>
                <PulseBadge tone={notificationAuditStats.sent ? 'green' : 'gold'}>
                  {notificationAuditStats.sent ? `${notificationAuditStats.sent} tracked` : 'No delivery yet'}
                </PulseBadge>
              </span>
            </div>
            <div className="pulse-club-notification-audit__stats">
              <span><strong>{notificationAuditStats.sent}</strong> Sent</span>
              <span><strong>{notificationAuditStats.read}</strong> Read</span>
              <span><strong>{notificationAuditStats.unread}</strong> Unread</span>
            </div>
            {sendTestNotification.isSuccess ? (
              <p className="pulse-club-notification-audit__note">Test sent to your own Pulse account. Students were not notified.</p>
            ) : null}
            {sendTestNotification.error ? (
              <p className="pulse-club-notification-audit__note pulse-club-notification-audit__note--error">{sendTestNotification.error.message}</p>
            ) : null}
            {notificationAuditQuery.isLoading ? (
              <article>
                <Bell size={18} />
                <div>
                  <strong>Checking notification delivery</strong>
                  <p>Pulse is loading recent event, resource, opportunity, and membership notifications for this club.</p>
                </div>
              </article>
            ) : null}
            {notificationAuditQuery.error ? (
              <article>
                <ShieldCheck size={18} />
                <div>
                  <strong>Audit could not load</strong>
                  <p>{notificationAuditQuery.error.message}</p>
                </div>
              </article>
            ) : null}
            {!notificationAuditQuery.isLoading && !notificationAuditQuery.error && notificationAuditItems.length ? notificationAuditItems.slice(0, 8).map((item) => (
              <article key={item.id}>
                <Bell size={18} />
                <div>
                  <strong>{clubNotificationAuditLabel(item)}</strong>
                  <p>{item.title}</p>
                  <small>
                    {item.recipient_display_name ?? 'Pulse member'} · {item.read_at ? `Read ${clubActivityDateLabel(item.read_at)}` : 'Unread'} · Sent {clubActivityDateLabel(item.created_at)}
                  </small>
                </div>
                {item.link_path ? (
                  <Link className="pulse-club-inline-action" to={item.link_path}>
                    Open <ArrowRight size={14} />
                  </Link>
                ) : null}
              </article>
            )) : null}
            {!notificationAuditQuery.isLoading && !notificationAuditQuery.error && !notificationAuditItems.length ? (
              <article>
                <Bell size={18} />
                <div>
                  <strong>No tracked notifications yet</strong>
                  <p>When this club publishes events, resources, opportunities, or approves members, recent delivery rows will appear here.</p>
                </div>
              </article>
            ) : null}
            </div>
          ) : null}
          {activeClubAdminPanel === 'members' ? (
            <div className="pulse-club-notification-audit">
            <div className="pulse-club-admin-actions__header">
              <h3>Membership activity</h3>
              <PulseBadge tone={membershipActivityItems.length ? 'green' : 'gold'}>
                {membershipActivityItems.length ? `${membershipActivityItems.length} logged` : 'No changes yet'}
              </PulseBadge>
            </div>
            {membershipActivityQuery.isLoading ? (
              <article>
                <UsersRound size={18} />
                <div>
                  <strong>Checking member activity</strong>
                  <p>Pulse is loading recent approvals, holds, pauses, role changes, and title edits for this club.</p>
                </div>
              </article>
            ) : null}
            {membershipActivityQuery.error ? (
              <article>
                <ShieldCheck size={18} />
                <div>
                  <strong>Membership activity could not load</strong>
                  <p>{membershipActivityQuery.error.message}</p>
                </div>
              </article>
            ) : null}
            {!membershipActivityQuery.isLoading && !membershipActivityQuery.error && membershipActivityItems.length ? membershipActivityItems.slice(0, 8).map((item) => (
              <article key={item.id}>
                <UsersRound size={18} />
                <div>
                  <strong>{clubMembershipActivityLabel(item)}</strong>
                  <p>{item.target_display_name ?? 'Pulse member'}</p>
                  <small>
                    By {item.actor_display_name ?? 'Club admin'} · {clubActivityDateLabel(item.created_at)}
                  </small>
                </div>
                {item.previous_status !== item.next_status ? <em>{item.previous_status ?? 'new'} to {item.next_status ?? 'updated'}</em> : null}
                {item.previous_role !== item.next_role ? <em>{item.previous_role ?? 'role'} to {item.next_role ?? 'role'}</em> : null}
              </article>
            )) : null}
            {!membershipActivityQuery.isLoading && !membershipActivityQuery.error && !membershipActivityItems.length ? (
              <article>
                <UsersRound size={18} />
                <div>
                  <strong>No membership actions yet</strong>
                  <p>Approvals, holds, pauses, role changes, and club title edits will appear here after admins make changes.</p>
                </div>
              </article>
            ) : null}
            </div>
          ) : null}
          {activeClubAdminPanel === 'members' ? (
            <div className="pulse-club-admin-actions">
            <div className="pulse-club-admin-actions__header">
              <h3>Pending actions</h3>
              <PulseBadge tone={pendingClubMembers.length ? 'coral' : 'green'}>
                {pendingClubMembers.length} open
              </PulseBadge>
            </div>
            {pendingMembersQuery.isLoading ? (
              <article>
                <UsersRound size={18} />
                <div>
                  <strong>Checking member requests</strong>
                  <p>Pulse is loading any pending club membership requests.</p>
                </div>
              </article>
            ) : null}
            {!pendingMembersQuery.isLoading && pendingClubMembers.map((member) => (
              <article key={member.id}>
                <UserPlus size={18} />
                <div>
                  <strong>{member.profile?.display_name ?? 'Pulse member'}</strong>
                  <p>{member.profile?.headline || 'Requested access to this club workspace.'}</p>
                </div>
                <span className="pulse-club-admin-actions__controls">
                  <button
                    disabled={updateClubMembershipStatus.isPending}
                    onClick={() => handleMemberStatusUpdate(member, 'active')}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    disabled={updateClubMembershipStatus.isPending}
                    onClick={() => handleMemberStatusUpdate(member, 'paused')}
                    type="button"
                  >
                    Hold
                  </button>
                </span>
              </article>
            ))}
            {!pendingMembersQuery.isLoading && !pendingClubMembers.length ? (
              <article>
                <CheckCircle2 size={18} />
                <div>
                  <strong>No pending actions right now</strong>
                  <p>This club has no open member requests.</p>
                </div>
              </article>
            ) : null}
            </div>
          ) : null}
          {activeClubAdminPanel === 'members' ? (
            <div className="pulse-club-role-manager">
            <div className="pulse-club-admin-actions__header">
              <h3>Club role management</h3>
              <PulseBadge tone="gold">{activeClubMembers.length} active</PulseBadge>
            </div>
            {activeClubMembers.length ? activeClubMembers.slice(0, 8).map((member) => {
              const isSelf = member.profile_id === profile.id;
              const draftTitle = memberTitleDrafts[member.id] ?? member.title ?? '';
              return (
                <article key={member.id}>
                  <div>
                    <strong>{member.profile?.display_name ?? 'Pulse member'}</strong>
                    <p>{member.profile?.headline || member.title || 'Active club member'}</p>
                  </div>
                  <label>
                    Role
                    <select
                      disabled={isSelf || updateClubMembershipStatus.isPending}
                      value={member.role}
                      onChange={(event) => handleMemberRoleUpdate(member, event.target.value as PulseClubMembership['role'])}
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label>
                    Club title
                    <input
                      maxLength={80}
                      placeholder="President, Coordinator, Core Member"
                      value={draftTitle}
                      onChange={(event) => setMemberTitleDrafts((current) => ({ ...current, [member.id]: event.target.value }))}
                    />
                  </label>
                  <div className="pulse-club-role-manager__actions">
                    <button
                      disabled={updateClubMembershipStatus.isPending}
                      onClick={() => handleMemberTitleSave(member)}
                      type="button"
                    >
                      Save title
                    </button>
                    <button
                      disabled={isSelf || updateClubMembershipStatus.isPending}
                      onClick={() => handleMemberStatusUpdate(member, 'paused')}
                      type="button"
                    >
                      Pause
                    </button>
                  </div>
                  {isSelf ? <small>You cannot demote or pause your own admin access here.</small> : null}
                </article>
              );
            }) : (
              <article>
                <div>
                  <strong>No active members yet</strong>
                  <p>Members will appear here once students follow or join this club workspace.</p>
                </div>
              </article>
            )}
          </div>
          ) : null}
          {activeClubAdminPanel === 'dashboard' ? (
          <div className="pulse-club-admin-summary__footer">
            <span><Clock3 size={16} /> Last activity: {clubActivityDateLabel(lastClubActivity)}</span>
            <button className="pulse-button pulse-button--secondary" type="button" onClick={() => openClubComposer('announcement')}>
              Create update
            </button>
          </div>
          ) : null}
        </PulseCard>
        {activeClubAdminPanel === 'content' ? (
          <PulseCard className="pulse-club-workspace-side">
            <PulseBadge tone="gold">Club Snapshot</PulseBadge>
            <h2>{clubTopic} workspace activity</h2>
            <div className="pulse-club-stat-list">
              <span><strong>{clubPosts.length}</strong> Published updates</span>
              <span><strong>{eventPosts.length}</strong> Events</span>
              <span><strong>{resourcePosts.length}</strong> Resources</span>
              <span><strong>{activeClubMembers.length}</strong> Members</span>
            </div>
          </PulseCard>
        ) : null}
        </div>
      ) : null}

      {(!showAdminTools || activeClubAdminPanel === 'content') ? (
      <div className={showAdminTools ? 'pulse-club-workspace-grid pulse-club-workspace-grid--feed-only' : 'pulse-club-workspace-grid'}>
        <PulseCard className="pulse-club-workspace-main">
          <div className="pulse-club-section-header" id="club-feed">
            <div>
              <PulseBadge tone="coral">Club Feed</PulseBadge>
              <h2>Club feed</h2>
            </div>
            <PulseButton to={clubSearchLink('posts', club)} variant="ghost">Search posts</PulseButton>
          </div>
          <div className="pulse-club-feed-filters" aria-label="Filter club feed">
            {clubFeedFilterOptions.map((option) => (
              <button
                className={clubFeedFilter === option.value ? 'active' : undefined}
                key={option.value}
                onClick={() => setClubFeedFilter(option.value)}
                type="button"
              >
                {option.label}
                <span>{option.count}</span>
              </button>
            ))}
          </div>
          {showAdminTools ? (
            <div className="pulse-club-admin-feed-search">
              <Search size={16} />
              <input
                placeholder="Search admin posts by title, type, status, author, date, or detail"
                type="search"
                value={clubFeedSearchQuery}
                onChange={(event) => setClubFeedSearchQuery(event.target.value)}
              />
              <label>
                Sort
                <select value={clubFeedSort} onChange={(event) => setClubFeedSort(event.target.value as ClubFeedSort)}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="edited">Recently edited</option>
                  <option value="status">Status</option>
                </select>
              </label>
              {clubFeedSearchQuery ? (
                <button aria-label="Clear club feed search" type="button" onClick={() => setClubFeedSearchQuery('')}>
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
          {showAdminTools ? (
            <div className="pulse-club-bulk-actions">
              <label>
                <input
                  checked={areAllVisibleBulkPostsSelected}
                  disabled={!visibleBulkArchivePosts.length}
                  onChange={toggleVisibleBulkPostSelection}
                  type="checkbox"
                />
                <span>Select visible drafts/expired</span>
              </label>
              <p>
                {selectedBulkPostIds.length
                  ? `${eligibleSelectedBulkPosts.length} eligible selected${selectedBulkPostIds.length !== eligibleSelectedBulkPosts.length ? ` · ${selectedBulkPostIds.length - eligibleSelectedBulkPosts.length} excluded` : ''}`
                  : 'Bulk archive only works for drafts and expired posts.'}
              </p>
              <button
                disabled={!eligibleSelectedBulkPosts.length || archiveClubPost.isPending}
                onClick={handleBulkArchivePosts}
                type="button"
              >
                <Archive size={14} /> Archive selected
              </button>
              {selectedBulkPostIds.length ? (
                <button type="button" onClick={() => setSelectedBulkPostIds([])}>
                  Clear selection
                </button>
              ) : null}
            </div>
          ) : null}
          {showAdminTools && adminActivityPost ? renderClubPostActivityPanel(adminActivityPost) : null}
          {selectedClubPost ? renderSelectedClubPost(selectedClubPost) : null}
          <div className="pulse-club-feed-preview">
            {clubPostsQuery.isLoading ? (
              <article>
                <Megaphone size={18} />
                <div>
                  <strong>Loading club updates</strong>
                  <p>Pulse is checking this workspace for official posts.</p>
                </div>
              </article>
            ) : null}
            {!clubPostsQuery.isLoading && clubPosts.length === 0 ? (
              <article className="pulse-club-feed-preview__empty">
                <Megaphone size={18} />
                <div>
                  <strong>Club feed is ready</strong>
                  <p>
                    {isManager
                      ? `Publish announcements, events, resources, and opportunities so students can follow ${clubTopic} activity from one place.`
                      : `Official announcements, events, resources, and opportunities from ${clubTopic} will appear here once club admins publish them.`}
                  </p>
                  {isManager ? (
                    <button className="pulse-club-inline-action pulse-club-empty-action" type="button" onClick={() => openClubComposer('announcement')}>
                      Publish first update
                    </button>
                  ) : null}
                </div>
              </article>
            ) : null}
            {!clubPostsQuery.isLoading && clubPosts.length > 0 && filteredClubFeedPosts.length === 0 ? (
              <article className="pulse-club-feed-preview__empty">
                <Megaphone size={18} />
                <div>
                  <strong>No posts match this view</strong>
                  <p>{clubFeedSearchQuery ? 'Clear search or switch filters to find the post.' : 'Switch filters to see active, expired, and category-specific club posts.'}</p>
                  <div className="pulse-college-filter-empty__actions">
                    <button type="button" onClick={() => setClubFeedFilter('all')}>
                      Show all posts
                    </button>
                    {clubFeedSearchQuery ? (
                      <button type="button" onClick={() => setClubFeedSearchQuery('')}>
                        Clear search
                      </button>
                    ) : null}
                    {isManager ? (
                      <button type="button" onClick={() => openClubComposer('announcement')}>
                        Publish update
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ) : null}
            {filteredClubFeedPosts.map((post) => (
              <article
                className={[
                  selectedClubPost?.id === post.id ? 'active' : '',
                  selectedBulkPostIds.includes(post.id) ? 'pulse-club-feed-preview__selected' : ''
                ].filter(Boolean).join(' ') || undefined}
                key={post.id}
                onClick={() => handleOpenClubPost(post)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenClubPost(post);
                  }
                }}
              >
                {showAdminTools ? (
                  <label
                    className="pulse-club-feed-select"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      checked={selectedBulkPostIds.includes(post.id)}
                      disabled={!canBulkArchiveClubPost(post)}
                      onChange={() => toggleBulkPostSelection(post)}
                      type="checkbox"
                    />
                    <span>{canBulkArchiveClubPost(post) ? 'Select post' : 'Not bulk eligible'}</span>
                  </label>
                ) : null}
                {post.post_type === 'announcement' ? (
                  <Megaphone size={18} />
                ) : post.post_type === 'event' ? (
                  <CalendarClock size={18} />
                ) : post.post_type === 'resource' ? (
                  <FileStack size={18} />
                ) : (
                  <MessageCircle size={18} />
                )}
                <div>
                  <button
                    className="pulse-club-feed-preview__title"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenClubPost(post);
                    }}
                  >
                    {post.title}
                  </button>
                  <p>{post.body}</p>
                  <small>
                    {post.author?.display_name ?? 'Club admin'} · {post.post_type}
                    {showAdminTools ? ` · ${clubPostStatusLabel(post.status)}` : ''}
                  </small>
                  {showAdminTools ? renderClubPostAdminMeta(post) : null}
                  {showAdminTools && readClubPostAdminNote(post) ? (
                    <span className="pulse-club-post-admin-note-indicator">
                      <FileText size={14} /> Admin note saved
                    </span>
                  ) : null}
                  <button
                    className="pulse-club-feed-preview__open"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenClubPost(post);
                    }}
                  >
                    View details <ArrowRight size={14} />
                  </button>
                  {showAdminTools ? (
                    <span className="pulse-club-post-actions" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => setAdminActivityPostId(post.id)}>
                        <BarChart3 size={14} /> Activity
                      </button>
                      <button type="button" onClick={() => startEditingPost(post)}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button type="button" onClick={() => duplicateClubPost(post)}>
                        <Copy size={14} /> Duplicate
                      </button>
                      <button type="button" onClick={() => handleArchivePost(post)} disabled={archiveClubPost.isPending || post.status === 'archived'}>
                        <Archive size={14} /> {post.status === 'archived' ? 'Archived' : 'Archive'}
                      </button>
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </PulseCard>

        {!showAdminTools ? (
        <PulseCard className="pulse-club-workspace-side">
          <PulseBadge tone="gold">Club Snapshot</PulseBadge>
          <h2>{clubTopic} workspace activity</h2>
          <div className="pulse-club-stat-list">
            <span><strong>{clubPosts.length}</strong> Published updates</span>
            <span><strong>{eventPosts.length}</strong> Events</span>
            <span><strong>{resourcePosts.length}</strong> Resources</span>
            <span><strong>{activeClubMembers.length}</strong> Members</span>
          </div>
        </PulseCard>
        ) : null}
      </div>
      ) : null}

      {(!showAdminTools || activeClubAdminPanel === 'student') ? (
      <PulseCard className="pulse-club-content-tabs">
        <div className="pulse-club-section-header">
          <div>
            <PulseBadge tone="coral">Club Browser</PulseBadge>
            <h2>Browse this club workspace</h2>
          </div>
          <span className="pulse-club-tab-actions">
            <button className="pulse-club-inline-action" type="button" onClick={handleCopyClubTabLink}>
              <LinkIcon size={14} /> {copiedClubTab ? 'Copied' : 'Copy tab link'}
            </button>
            {showAdminTools ? (
              <button className="pulse-club-inline-action" type="button" onClick={() => openClubComposer('announcement')}>
                Create update
              </button>
            ) : null}
          </span>
        </div>
        <div className="pulse-club-tab-list" role="tablist" aria-label="Club content sections">
          {[
            { count: eventPosts.length, icon: CalendarClock, label: 'Events', value: 'events' as ClubContentTab },
            { count: resourcePosts.length, icon: FileText, label: 'Resources', value: 'resources' as ClubContentTab },
            { count: opportunityPosts.length, icon: BriefcaseBusiness, label: 'Opportunities', value: 'opportunities' as ClubContentTab },
            { count: activeClubMembers.length, icon: UsersRound, label: 'Members', value: 'members' as ClubContentTab }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                aria-selected={activeClubTab === tab.value}
                className={activeClubTab === tab.value ? 'active' : ''}
                key={tab.value}
                onClick={() => handleClubTabChange(tab.value)}
                role="tab"
                type="button"
              >
                <Icon size={17} />
                <span>{tab.label}</span>
                <em>{tab.count}</em>
              </button>
            );
          })}
        </div>
        <div className="pulse-club-tab-panel" role="tabpanel">
          {activeClubTab === 'events' ? (
            <div>
              <h3>Events</h3>
              {renderClubPreviewList(
                eventPosts,
                'No club events yet',
                `Workshops, competitions, and speaker sessions for ${clubTopic} will appear here.`,
                'Create first event',
                'event'
              )}
            </div>
          ) : null}
          {activeClubTab === 'resources' ? (
            <div>
              <h3>Resources</h3>
              {renderClubPreviewList(
                resourcePosts,
                'No club resources yet',
                'Club notes, prep links, templates, and reference material will appear here.',
                'Add first resource',
                'resource'
              )}
            </div>
          ) : null}
          {activeClubTab === 'opportunities' ? (
            <div>
              <h3>Opportunities</h3>
              {renderClubPreviewList(
                opportunityPosts,
                'No club opportunities yet',
                'Live projects, competitions, and student roles shared by this club will appear here.',
                'Post first opportunity',
                'opportunity'
              )}
            </div>
          ) : null}
          {activeClubTab === 'members' ? (
            <div>
              <h3>Members</h3>
              <div className="pulse-club-members-workspace">
                {showAdminTools ? (
                  <section className="pulse-club-members-workspace__pending">
                    <div className="pulse-club-members-workspace__header">
                      <div>
                        <strong>Pending requests</strong>
                        <p>Approve students who should be visible in this club workspace.</p>
                      </div>
                      <PulseBadge tone={pendingClubMembers.length ? 'coral' : 'green'}>
                        {pendingClubMembers.length} pending
                      </PulseBadge>
                    </div>
                    {pendingMembersQuery.isLoading ? (
                      <article>
                        <UserPlus size={18} />
                        <div>
                          <strong>Checking requests</strong>
                          <p>Pulse is loading pending membership requests.</p>
                        </div>
                      </article>
                    ) : null}
                    {!pendingMembersQuery.isLoading && pendingClubMembers.map((member) => (
                      <article key={member.id}>
                        <UserPlus size={18} />
                        <div>
                          <strong>{member.profile?.display_name ?? 'Pulse member'}</strong>
                          <p>{member.profile?.headline || 'Requested access to this club workspace.'}</p>
                        </div>
                        <span className="pulse-club-admin-actions__controls">
                          <button
                            disabled={updateClubMembershipStatus.isPending}
                            onClick={() => handleMemberStatusUpdate(member, 'active')}
                            type="button"
                          >
                            Approve
                          </button>
                          <button
                            disabled={updateClubMembershipStatus.isPending}
                            onClick={() => handleMemberStatusUpdate(member, 'paused')}
                            type="button"
                          >
                            Hold
                          </button>
                        </span>
                      </article>
                    ))}
                    {!pendingMembersQuery.isLoading && !pendingClubMembers.length ? (
                      <article>
                        <CheckCircle2 size={18} />
                        <div>
                          <strong>No pending requests</strong>
                          <p>New join requests will appear here for club admins.</p>
                        </div>
                      </article>
                    ) : null}
                  </section>
                ) : null}
                <section>
                  <div className="pulse-club-members-workspace__header">
                    <div>
                      <strong>Active members</strong>
                      <p>{showAdminTools ? 'Manage roles, titles, and visibility from the roster.' : 'Students currently visible in this club workspace.'}</p>
                    </div>
                    <PulseBadge tone="gold">{activeClubMembers.length} active</PulseBadge>
                  </div>
                  <div className={showAdminTools ? 'pulse-club-role-manager pulse-club-role-manager--roster' : 'pulse-club-mini-list pulse-club-members-scroll-list'}>
                    {activeClubMembers.length ? activeClubMembers.map((member) => {
                      const isSelf = member.profile_id === profile.id;
                      const draftTitle = memberTitleDrafts[member.id] ?? member.title ?? '';
                      return showAdminTools ? (
                        <article key={member.id}>
                          <div>
                            <strong>{member.profile?.display_name ?? 'Pulse member'}</strong>
                            <p>{member.profile?.headline || member.title || 'Active club member'}</p>
                          </div>
                          <label>
                            Role
                            <select
                              disabled={isSelf || updateClubMembershipStatus.isPending}
                              value={member.role}
                              onChange={(event) => handleMemberRoleUpdate(member, event.target.value as PulseClubMembership['role'])}
                            >
                              <option value="member">Member</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          </label>
                          <label>
                            Club title
                            <input
                              maxLength={80}
                              placeholder="President, Coordinator, Core Member"
                              value={draftTitle}
                              onChange={(event) => setMemberTitleDrafts((current) => ({ ...current, [member.id]: event.target.value }))}
                            />
                          </label>
                          <div className="pulse-club-role-manager__actions">
                            <button
                              disabled={updateClubMembershipStatus.isPending}
                              onClick={() => handleMemberTitleSave(member)}
                              type="button"
                            >
                              Save title
                            </button>
                            <button
                              disabled={isSelf || updateClubMembershipStatus.isPending}
                              onClick={() => handleMemberStatusUpdate(member, 'paused')}
                              type="button"
                            >
                              Pause
                            </button>
                          </div>
                          {isSelf ? <small>You cannot demote or pause your own admin access here.</small> : null}
                        </article>
                      ) : (
                        <article key={member.id}>
                          <UsersRound size={18} />
                          <div>
                            <strong>{member.profile?.display_name ?? 'Pulse member'}</strong>
                            <p>{member.title || member.role}</p>
                            {member.profile?.headline ? <small>{member.profile.headline}</small> : null}
                          </div>
                        </article>
                      );
                    }) : (
                      <article>
                        {showAdminTools ? null : <UsersRound size={18} />}
                        <div>
                          <strong>No active members yet</strong>
                          <p>Members will appear here once students follow or join this club workspace.</p>
                        </div>
                      </article>
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </PulseCard>
      ) : null}

      {(!showAdminTools || activeClubAdminPanel === 'student') ? (
      <PulseCard className="pulse-club-playbook">
        <PulseBadge tone="gold">Workspace members</PulseBadge>
        <h2>People visible in this club</h2>
        <div>
          {memberRows.map((member) => (
            <span key={`${member.name}-${member.role}`}><UsersRound size={17} /> {member.name} · {member.role}</span>
          ))}
          <span><Trophy size={17} /> Weekly club contributors can appear here</span>
        </div>
      </PulseCard>
      ) : null}

      {pendingNotificationPublish ? (
        <div className="pulse-club-publish-confirm" role="dialog" aria-modal="true" aria-labelledby="pulse-club-publish-confirm-title">
          <button
            aria-label="Cancel publish confirmation"
            className="pulse-club-publish-confirm__backdrop"
            onClick={() => setPendingNotificationPublish(null)}
            type="button"
          />
          <PulseCard className="pulse-club-publish-confirm__panel">
            <header className="pulse-club-publish-confirm__header">
              <span>
                <Bell size={20} />
                <PulseBadge tone="gold">Notify members</PulseBadge>
              </span>
              <h2 id="pulse-club-publish-confirm-title">Publish and notify club members?</h2>
              <p>
                This will publish the {notificationAudienceContentLabel(pendingNotificationPublish.kind === 'create' ? postType : editingPostType)} and send a bell notification to active members of {club.name}.
              </p>
            </header>
            <div className="pulse-club-publish-confirm__summary">
              <article>
                <strong>{notificationAudienceRecipients.length}</strong>
                <span>Active member{notificationAudienceRecipients.length === 1 ? '' : 's'} will be notified</span>
              </article>
              <article>
                <strong>{notificationAudienceContentLabel(pendingNotificationPublish.kind === 'create' ? postType : editingPostType)}</strong>
                <span>Published to the club workspace</span>
              </article>
            </div>
            <div className="pulse-club-publish-confirm__members">
              {notificationAudienceRecipients.slice(0, 6).map((member) => (
                <span key={member.id}>
                  <UsersRound size={15} />
                  {member.profile?.display_name ?? 'Pulse member'}
                </span>
              ))}
              {!notificationAudienceRecipients.length ? <span><UsersRound size={15} /> No active members yet</span> : null}
              {notificationAudienceRecipients.length > 6 ? <span>+{notificationAudienceRecipients.length - 6} more</span> : null}
            </div>
            <div className="pulse-club-publish-confirm__actions">
              <button
                className="pulse-button pulse-button--ghost"
                disabled={createClubPost.isPending || updateClubPost.isPending}
                onClick={() => setPendingNotificationPublish(null)}
                type="button"
              >
                Keep editing
              </button>
              <button
                className="pulse-button pulse-button--primary"
                disabled={createClubPost.isPending || updateClubPost.isPending}
                onClick={confirmPendingNotificationPublish}
                type="button"
              >
                <span>{createClubPost.isPending || updateClubPost.isPending ? 'Publishing' : 'Publish and notify'}</span>
                <Send size={18} />
              </button>
            </div>
          </PulseCard>
        </div>
      ) : null}

      {pendingClubArchive ? (
        <div className="pulse-club-publish-confirm" role="dialog" aria-modal="true" aria-labelledby="pulse-club-archive-confirm-title">
          <button
            aria-label="Cancel archive confirmation"
            className="pulse-club-publish-confirm__backdrop"
            onClick={() => setPendingClubArchive(null)}
            type="button"
          />
          <PulseCard className="pulse-club-publish-confirm__panel">
            <header className="pulse-club-publish-confirm__header">
              <span>
                <Archive size={20} />
                <PulseBadge tone="coral">Archive posts</PulseBadge>
              </span>
              <h2 id="pulse-club-archive-confirm-title">
                {pendingClubArchive.kind === 'bulk' ? 'Archive selected posts?' : 'Archive this post?'}
              </h2>
              <p>
                Archived posts will be hidden from students in the club and college workspace. Admins can still review archived items from the club feed filters.
              </p>
            </header>
            <div className="pulse-club-publish-confirm__summary">
              <article>
                <strong>{pendingArchivePosts.length}</strong>
                <span>Eligible post{pendingArchivePosts.length === 1 ? '' : 's'} selected for archive</span>
              </article>
              <article>
                <strong>{pendingClubArchive.kind === 'bulk' ? 'Bulk' : 'Single'}</strong>
                <span>Published active posts stay protected from bulk archive</span>
              </article>
            </div>
            <div className="pulse-club-publish-confirm__members">
              {pendingArchivePosts.slice(0, 6).map((post) => (
                <span key={post.id}>
                  <Archive size={15} />
                  {post.title}
                </span>
              ))}
              {pendingArchivePosts.length > 6 ? <span>+{pendingArchivePosts.length - 6} more</span> : null}
            </div>
            <div className="pulse-club-publish-confirm__actions">
              <button
                className="pulse-button pulse-button--ghost"
                disabled={archiveClubPost.isPending}
                onClick={() => setPendingClubArchive(null)}
                type="button"
              >
                Keep visible
              </button>
              <button
                className="pulse-button pulse-button--primary"
                disabled={archiveClubPost.isPending}
                onClick={confirmPendingClubArchive}
                type="button"
              >
                <span>{archiveClubPost.isPending ? 'Archiving' : 'Archive'}</span>
                <Archive size={18} />
              </button>
            </div>
          </PulseCard>
        </div>
      ) : null}

      {pendingClubMemberStatus ? (
        <div className="pulse-club-publish-confirm" role="dialog" aria-modal="true" aria-labelledby="pulse-club-member-confirm-title">
          <button
            aria-label="Cancel member status confirmation"
            className="pulse-club-publish-confirm__backdrop"
            onClick={() => setPendingClubMemberStatus(null)}
            type="button"
          />
          <PulseCard className="pulse-club-publish-confirm__panel">
            <header className="pulse-club-publish-confirm__header">
              <span>
                <UsersRound size={20} />
                <PulseBadge tone="coral">{pendingClubMemberStatus.member.status === 'pending' ? 'Hold request' : 'Pause member'}</PulseBadge>
              </span>
              <h2 id="pulse-club-member-confirm-title">
                {pendingClubMemberStatus.member.status === 'pending' ? 'Hold this join request?' : 'Pause this member?'}
              </h2>
              <p>
                {pendingClubMemberStatus.member.status === 'pending'
                  ? `${clubMemberDisplayName(pendingClubMemberStatus.member)} will stay out of the visible club roster until an admin approves them later.`
                  : `${clubMemberDisplayName(pendingClubMemberStatus.member)} will be removed from the visible active roster for this club workspace.`}
              </p>
            </header>
            <div className="pulse-club-publish-confirm__summary">
              <article>
                <strong>{clubMemberDisplayName(pendingClubMemberStatus.member)}</strong>
                <span>{pendingClubMemberStatus.member.profile?.headline || pendingClubMemberStatus.member.title || 'Club member'}</span>
              </article>
              <article>
                <strong>{pendingClubMemberStatus.member.status === 'pending' ? 'Hold' : 'Pause'}</strong>
                <span>This changes membership visibility for this club only</span>
              </article>
            </div>
            <div className="pulse-club-publish-confirm__actions">
              <button
                className="pulse-button pulse-button--ghost"
                disabled={updateClubMembershipStatus.isPending}
                onClick={() => setPendingClubMemberStatus(null)}
                type="button"
              >
                Keep as is
              </button>
              <button
                className="pulse-button pulse-button--primary"
                disabled={updateClubMembershipStatus.isPending}
                onClick={confirmPendingClubMemberStatus}
                type="button"
              >
                <span>
                  {updateClubMembershipStatus.isPending
                    ? 'Updating'
                    : pendingClubMemberStatus.member.status === 'pending'
                      ? 'Hold request'
                      : 'Pause member'}
                </span>
                <UsersRound size={18} />
              </button>
            </div>
          </PulseCard>
        </div>
      ) : null}

      {pendingUnsavedEditAction ? (
        <div className="pulse-club-publish-confirm" role="dialog" aria-modal="true" aria-labelledby="pulse-club-unsaved-edit-confirm-title">
          <button
            aria-label="Keep editing"
            className="pulse-club-publish-confirm__backdrop"
            onClick={() => setPendingUnsavedEditAction(null)}
            type="button"
          />
          <PulseCard className="pulse-club-publish-confirm__panel">
            <header className="pulse-club-publish-confirm__header">
              <span>
                <Pencil size={20} />
                <PulseBadge tone="gold">Unsaved edits</PulseBadge>
              </span>
              <h2 id="pulse-club-unsaved-edit-confirm-title">Discard unsaved changes?</h2>
              <p>
                You have changes in this club post that are not saved yet. Save them first, or discard them to {pendingUnsavedEditAction.label}.
              </p>
            </header>
            <div className="pulse-club-publish-confirm__summary">
              <article>
                <strong>{editingPostTitle.trim() || 'Untitled post'}</strong>
                <span>Current edit draft</span>
              </article>
              <article>
                <strong>{clubPostTypeLabel(editingPostType)}</strong>
                <span>{clubPostStatusLabel(editingPostStatus)}</span>
              </article>
            </div>
            <div className="pulse-club-publish-confirm__actions">
              <button
                className="pulse-button pulse-button--ghost"
                onClick={() => setPendingUnsavedEditAction(null)}
                type="button"
              >
                Keep editing
              </button>
              <button
                className="pulse-button pulse-button--primary"
                onClick={confirmPendingUnsavedEditAction}
                type="button"
              >
                <span>Discard changes</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </PulseCard>
        </div>
      ) : null}

      {notificationPublishSuccess ? (
        <div className="pulse-club-publish-success" role="status" aria-live="polite">
          <CheckCircle2 size={22} />
          <span>
            <strong>Published and notifications sent</strong>
            <small>
              {notificationPublishSuccess.contentLabel} notified {notificationPublishSuccess.recipientCount} active club member{notificationPublishSuccess.recipientCount === 1 ? '' : 's'}.
            </small>
          </span>
          <button aria-label="Dismiss notification success message" onClick={() => setNotificationPublishSuccess(null)} type="button">
            Close
          </button>
        </div>
      ) : null}

      {clubMemberActionSuccess ? (
        <div className="pulse-club-publish-success pulse-club-publish-success--member" role="status" aria-live="polite">
          <CheckCircle2 size={22} />
          <span>
            <strong>Member {clubMemberActionSuccess.actionLabel}</strong>
            <small>{clubMemberActionSuccess.memberName} has been {clubMemberActionSuccess.actionLabel} for this club workspace.</small>
          </span>
          <button aria-label="Dismiss member action success message" onClick={() => setClubMemberActionSuccess(null)} type="button">
            Close
          </button>
        </div>
      ) : null}

      {clubPostEditSuccess ? (
        <div className="pulse-club-publish-success pulse-club-publish-success--edit" role="status" aria-live="polite">
          <CheckCircle2 size={22} />
          <span>
            <strong>Post changes saved</strong>
            <small>
              {clubPostTypeLabel(clubPostEditSuccess.postType)} updated: {clubPostEditSuccess.title}
            </small>
          </span>
          <button aria-label="View updated post" onClick={handleViewEditedPost} type="button">
            View updated post
          </button>
          <button aria-label="Dismiss edit success message" onClick={() => setClubPostEditSuccess(null)} type="button">
            Close
          </button>
        </div>
      ) : null}

      {clubArchiveSuccess ? (
        <div className="pulse-club-publish-success pulse-club-publish-success--archive" role="status" aria-live="polite">
          <Archive size={22} />
          <span>
            <strong>{clubArchiveSuccess.count === 1 ? 'Post archived' : 'Posts archived'}</strong>
            <small>
              {clubArchiveSuccess.count} post{clubArchiveSuccess.count === 1 ? '' : 's'} hidden from the student workspace.
            </small>
          </span>
          {clubArchiveSuccess.undoPost ? (
            <button
              aria-label="Undo archive"
              disabled={updateClubPost.isPending}
              onClick={undoSingleClubArchive}
              type="button"
            >
              {updateClubPost.isPending ? 'Restoring' : 'Undo'}
            </button>
          ) : null}
          <button aria-label="Dismiss archive success message" onClick={() => setClubArchiveSuccess(null)} type="button">
            Close
          </button>
        </div>
      ) : null}
    </section>
  );
}
