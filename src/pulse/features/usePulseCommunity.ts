import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { StudentProfile, useStudentProfile } from '../../features/student/useStudentDashboard';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { PULSE_OTHER_COLLEGE_ID, isPulseStaticCollegeId } from '../lib/collegeOptions';

export type PulseCollege = {
  city?: string | null;
  country?: string | null;
  id: string;
  name: string;
  state?: string | null;
};

export type PulseProfile = {
  avatar_url?: string | null;
  bio?: string | null;
  college?: PulseCollege | null;
  college_id?: string | null;
  created_at?: string;
  display_name: string;
  headline?: string | null;
  id: string;
  interests: string[];
  linkedin_url?: string | null;
  profile_visibility: 'public' | 'college' | 'private';
  pulse_status: 'active' | 'paused' | 'blocked';
  referral_code: string;
  skills: string[];
  student_id?: string | null;
};

export type PulsePost = {
  anonymous: boolean;
  author?: Pick<PulseProfile, 'avatar_url' | 'display_name' | 'headline' | 'id'> | null;
  author_profile_id: string;
  body: string;
  college?: Pick<PulseCollege, 'id' | 'name'> | null;
  college_id?: string | null;
  created_at: string;
  id: string;
  metadata: Record<string, unknown>;
  moderated_at?: string | null;
  moderated_by_auth_user_id?: string | null;
  pinned: boolean;
  post_type: 'discussion' | 'poll' | 'article' | 'recognition' | 'opportunity' | 'shoutout' | 'announcement';
  status?: 'draft' | 'published' | 'hidden' | 'archived' | 'under_review';
  title: string;
  visibility: 'global' | 'college';
};

export type PulseClubAccent = 'analytics' | 'consulting' | 'finance' | 'hr' | 'marketing' | 'operations' | 'product' | 'red' | 'startup';

export type PulseClub = {
  category: 'domain' | 'placement' | 'entrepreneurship' | 'operations' | 'culture' | 'sports' | 'committee' | 'other';
  college?: Pick<PulseCollege, 'id' | 'name'> | null;
  college_id: string;
  contact_email?: string | null;
  cover_color: PulseClubAccent;
  created_at: string;
  description?: string | null;
  external_url?: string | null;
  focus_tags: string[];
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'paused' | 'archived';
  summary: string;
};

export type PulseClubMembership = {
  club?: Pick<PulseClub, 'cover_color' | 'id' | 'name' | 'slug'> | null;
  club_id: string;
  id: string;
  profile?: Pick<PulseProfile, 'avatar_url' | 'display_name' | 'headline' | 'id' | 'linkedin_url'> | null;
  profile_id: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'paused' | 'alumni';
  title?: string | null;
};

export type PulseClubPost = {
  author?: Pick<PulseProfile, 'avatar_url' | 'display_name' | 'headline' | 'id'> | null;
  author_profile_id: string;
  body: string;
  club?: Pick<PulseClub, 'cover_color' | 'id' | 'name' | 'slug'> | null;
  club_id: string;
  created_at: string;
  id: string;
  metadata: Record<string, unknown>;
  moderated_at?: string | null;
  moderated_by_auth_user_id?: string | null;
  pinned: boolean;
  post_id?: string | null;
  post_type: 'announcement' | 'discussion' | 'event' | 'poll' | 'resource' | 'opportunity';
  status: 'draft' | 'published' | 'hidden' | 'archived' | 'under_review';
  title: string;
  updated_at?: string | null;
};

export type PulseClubPostActionType = 'saved' | 'useful' | 'interested';

export type PulseClubPostAction = {
  action_type: PulseClubPostActionType;
  club_post_id: string;
  created_at: string;
  id: string;
  profile_id: string;
  updated_at?: string | null;
};

export type PulseClubPostActionActivity = PulseClubPostAction & {
  post?: PulseClubPost | null;
};

export type PulseClubPostActionSummary = {
  interested: number;
  saved: number;
  useful: number;
};

export type PulseClubNotificationAuditItem = {
  body?: string | null;
  created_at: string;
  id: string;
  link_path?: string | null;
  metadata: Record<string, unknown>;
  notification_type: PulseNotification['notification_type'];
  read_at?: string | null;
  recipient_display_name?: string | null;
  recipient_profile_id: string;
  title: string;
};

export type PulseClubMembershipActivityItem = {
  action: 'approved' | 'held' | 'paused' | 'role_updated' | 'title_updated' | 'membership_updated';
  actor_display_name?: string | null;
  actor_profile_id?: string | null;
  club_id: string;
  created_at: string;
  id: string;
  membership_id?: string | null;
  metadata: Record<string, unknown>;
  next_role?: string | null;
  next_status?: string | null;
  next_title?: string | null;
  previous_role?: string | null;
  previous_status?: string | null;
  previous_title?: string | null;
  target_display_name?: string | null;
  target_profile_id?: string | null;
};

export type PulseComment = {
  anonymous: boolean;
  author?: Pick<PulseProfile, 'avatar_url' | 'display_name' | 'headline' | 'id'> | null;
  author_profile_id: string;
  body: string;
  created_at: string;
  id: string;
  post_id: string;
  status: 'published' | 'hidden' | 'archived' | 'under_review';
};

export type PulsePostInteractionSummary = {
  comments: PulseComment[];
  commentCount: number;
  hasReacted: boolean;
  pollCounts: Record<string, number>;
  pollTotal: number;
  selectedPollOptionId?: string;
  reactionCount: number;
};

export type PulseProfileInput = {
  avatarUrl?: string | null;
  bio?: string;
  collegeId?: string;
  collegeName?: string;
  displayName: string;
  headline?: string;
  interests: string[];
  linkedinUrl?: string;
  skills: string[];
};

export type PulsePostInput = {
  anonymous: boolean;
  body: string;
  pollOptions?: string[];
  postType: PulsePost['post_type'];
  recipientProfileId?: string;
  title: string;
  visibility: PulsePost['visibility'];
};

export type PulseCommentInput = {
  anonymous: boolean;
  body: string;
  postId: string;
};

export type PulseClubPostInput = {
  body: string;
  clubId: string;
  metadata?: Record<string, unknown>;
  postType: PulseClubPost['post_type'];
  status?: PulseClubPost['status'];
  title: string;
};

export type PulseClubPostUpdateInput = {
  body: string;
  metadata?: Record<string, unknown>;
  postId: string;
  postType: PulseClubPost['post_type'];
  status?: PulseClubPost['status'];
  title: string;
};

export type PulsePostUpdateInput = {
  body: string;
  postId: string;
  title: string;
  visibility: PulsePost['visibility'];
};

export type PulseCommentUpdateInput = {
  body: string;
  commentId: string;
};

export type PulseReportReason = 'abuse' | 'fake_info' | 'harassment' | 'sensitive' | 'spam' | 'other';

export type PulseReportInput = {
  commentId?: string;
  details?: string;
  postId?: string;
  reason: PulseReportReason;
};

export type PulseFeedFilter = 'all' | 'college' | 'global' | 'opportunities' | 'recognition';
export type PulseSearchFilter = 'all' | 'posts' | 'people' | 'opportunities';
export type PulsePeopleDirectoryScope = 'all' | 'college';
export type PulsePeopleDirectorySort = 'recent' | 'name';
export type PulseLeaderboardScope = 'college' | 'pulse';
export type PulseLeaderboardPeriod = 'week' | 'month';

export type PulsePeopleDirectoryFilters = {
  query: string;
  scope: PulsePeopleDirectoryScope;
  sort: PulsePeopleDirectorySort;
  tag: string;
};

export type PulseInvite = {
  accepted_at?: string | null;
  created_at: string;
  id: string;
  invited_email?: string | null;
  referral_code: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
};

export type PulseOpportunity = {
  application_url?: string | null;
  club?: Pick<PulseClub, 'category' | 'cover_color' | 'id' | 'name' | 'slug'> | null;
  club_id?: string | null;
  closes_at?: string | null;
  company_name?: string | null;
  created_at: string;
  description: string;
  detail_description?: string | null;
  display_applied_count?: number | null;
  id: string;
  opportunity_type: 'live_project' | 'freelance' | 'challenge' | 'resume_review' | 'event';
  starts_at?: string | null;
  title: string;
  visibility: 'global' | 'college';
};

export type PulseOpportunityApplication = {
  answers?: Record<string, unknown>;
  created_at: string;
  id: string;
  linkedin_url?: string | null;
  note?: string | null;
  opportunity?: Pick<PulseOpportunity, 'closes_at' | 'company_name' | 'id' | 'opportunity_type' | 'title'> | null;
  opportunity_id: string;
  portfolio_url?: string | null;
  profile_id: string;
  resume_url?: string | null;
  status: 'interested' | 'applied' | 'shortlisted' | 'selected' | 'rejected' | 'withdrawn';
  applied_at?: string | null;
  updated_at?: string | null;
};

export type PulseOpportunityApplicationInput = {
  answers?: Record<string, unknown>;
  linkedinUrl?: string;
  note: string;
  opportunityId: string;
  portfolioUrl?: string;
  resumeUrl?: string;
};

export type PulseMentorshipSessionType = 'workshop' | 'resume_review' | 'one_on_one' | 'ama' | 'career_session';
export type PulseMentorshipSessionStatus = 'draft' | 'submitted' | 'approved' | 'published' | 'rejected' | 'cancelled' | 'completed' | 'archived';
export type PulseMentorshipRsvpStatus = 'rsvped' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';

export type PulseMentorshipSession = {
  college_id?: string | null;
  college_name?: string | null;
  created_at: string;
  description: string;
  ends_at?: string | null;
  host_display_name?: string | null;
  host_headline?: string | null;
  host_profile_id: string;
  id: string;
  max_seats?: number | null;
  meeting_platform: 'google_meet' | 'zoom' | 'other';
  meeting_url?: string | null;
  rsvp_count: number;
  session_type: PulseMentorshipSessionType;
  source_id?: string | null;
  source_type?: 'pulse_session' | 'admin_workshop';
  starts_at: string;
  status: PulseMentorshipSessionStatus;
  title: string;
  topic: string;
  visibility: 'global' | 'college';
};

export type PulseMentorshipRsvp = {
  created_at: string;
  id: string;
  note?: string | null;
  profile_id: string;
  session?: Pick<PulseMentorshipSession, 'id' | 'title' | 'session_type' | 'starts_at' | 'host_display_name'> | null;
  session_id: string;
  status: PulseMentorshipRsvpStatus;
};

export type PulseMentorshipSessionInput = {
  description: string;
  endsAt?: string;
  maxSeats?: string;
  meetingPlatform: PulseMentorshipSession['meeting_platform'];
  meetingUrl?: string;
  sessionType: PulseMentorshipSessionType;
  startsAt: string;
  title: string;
  topic: string;
  visibility: PulseMentorshipSession['visibility'];
};

export type PulseNotification = {
  actor?: Pick<PulseProfile, 'avatar_url' | 'display_name' | 'headline' | 'id'> | null;
  actor_profile_id?: string | null;
  body?: string | null;
  created_at: string;
  id: string;
  link_path?: string | null;
  metadata: Record<string, unknown>;
  notification_type:
    | 'club_action'
    | 'club_membership'
    | 'club_post'
    | 'comment'
    | 'connection_interest'
    | 'reaction'
    | 'invite_accepted'
    | 'opportunity_status'
    | 'report_status';
  read_at?: string | null;
  title: string;
};

export type PulseConnection = {
  connection_type: 'connect_interest';
  created_at: string;
  id: string;
  message?: string | null;
  requester_profile_id: string;
  target_profile_id: string;
};

export type PulseLeaderboardEntry = {
  avatar_url?: string | null;
  badge: string;
  college_name?: string | null;
  display_name: string;
  headline?: string | null;
  profile_id: string;
  rank_position: number;
  total_points: number;
};

export type PulseSearchResults = {
  opportunities: PulseOpportunity[];
  people: PulseProfile[];
  posts: PulsePost[];
};

const PULSE_OPPORTUNITY_SELECT =
  'id, title, company_name, opportunity_type, description, detail_description, display_applied_count, visibility, application_url, starts_at, closes_at, created_at, club_id, club:pulse_clubs(id, name, slug, category, cover_color)';

const PULSE_OPPORTUNITY_SELECT_FALLBACK =
  'id, title, company_name, opportunity_type, description, detail_description, visibility, application_url, starts_at, closes_at, created_at';

function isMissingOpportunityOptionalColumn(error: { message?: string } | null) {
  const message = error?.message ?? '';
  return Boolean(
    message.includes('display_applied_count')
    || message.includes('club_id')
    || message.includes('pulse_clubs')
    || message.includes('relationship')
  );
}

function isMissingClubPostActionsTable(error: { message?: string } | null) {
  const message = error?.message ?? '';
  return Boolean(message.includes('pulse_club_post_actions') || message.includes('relation') || message.includes('schema cache'));
}

export type PulseInviteAcceptance = {
  accepted: boolean;
  invite_id?: string | null;
  invited_by_profile_id?: string | null;
  message: string;
};

const storedInviteCodeKey = 'sapiens-pulse-invite-code';
const storedInviteCodeEvent = 'sapiens-pulse-invite-code-change';

function requireSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Pulse is not connected to Supabase in this environment.');
  }
  return supabase;
}

export function rememberPulseInviteCode(code?: string | null) {
  if (typeof window === 'undefined') return;
  const cleanCode = code?.trim().toUpperCase();
  if (!cleanCode) return;
  window.sessionStorage.setItem(storedInviteCodeKey, cleanCode);
  window.dispatchEvent(new Event(storedInviteCodeEvent));
}

export function forgetPulseInviteCode() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(storedInviteCodeKey);
  window.dispatchEvent(new Event(storedInviteCodeEvent));
}

export function useStoredPulseInviteCode() {
  const [inviteCode, setInviteCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(storedInviteCodeKey);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateInviteCode = () => setInviteCode(window.sessionStorage.getItem(storedInviteCodeKey));
    window.addEventListener('storage', updateInviteCode);
    window.addEventListener(storedInviteCodeEvent, updateInviteCode);
    return () => {
      window.removeEventListener('storage', updateInviteCode);
      window.removeEventListener(storedInviteCodeEvent, updateInviteCode);
    };
  }, []);

  return inviteCode;
}

function mapProfile(row: Record<string, unknown>): PulseProfile {
  return {
    avatar_url: row.avatar_url as string | null | undefined,
    bio: row.bio as string | null | undefined,
    college: (row.college as PulseCollege | null | undefined) ?? null,
    college_id: row.college_id as string | null | undefined,
    created_at: row.created_at as string | undefined,
    display_name: String(row.display_name ?? ''),
    headline: row.headline as string | null | undefined,
    id: String(row.id),
    interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
    linkedin_url: row.linkedin_url as string | null | undefined,
    profile_visibility: (row.profile_visibility as PulseProfile['profile_visibility']) ?? 'college',
    pulse_status: (row.pulse_status as PulseProfile['pulse_status']) ?? 'active',
    referral_code: String(row.referral_code ?? ''),
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    student_id: row.student_id as string | null | undefined
  };
}

function mapPost(row: Record<string, unknown>): PulsePost {
  return {
    anonymous: Boolean(row.anonymous),
    author: (row.author as PulsePost['author']) ?? null,
    author_profile_id: String(row.author_profile_id ?? ''),
    body: String(row.body ?? ''),
    college: (row.college as PulsePost['college']) ?? null,
    college_id: row.college_id as string | null | undefined,
    created_at: String(row.created_at ?? ''),
    id: String(row.id),
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? {},
    pinned: Boolean(row.pinned),
    post_type: (row.post_type as PulsePost['post_type']) ?? 'discussion',
    status: (row.status as PulsePost['status']) ?? 'published',
    title: String(row.title ?? ''),
    visibility: (row.visibility as PulsePost['visibility']) ?? 'college'
  };
}

function mapComment(row: Record<string, unknown>): PulseComment {
  return {
    anonymous: Boolean(row.anonymous),
    author: (row.author as PulseComment['author']) ?? null,
    author_profile_id: String(row.author_profile_id ?? ''),
    body: String(row.body ?? ''),
    created_at: String(row.created_at ?? ''),
    id: String(row.id),
    post_id: String(row.post_id ?? ''),
    status: (row.status as PulseComment['status']) ?? 'published'
  };
}

function mapClub(row: Record<string, unknown>): PulseClub {
  const coverColor = String(row.cover_color ?? 'red');
  const allowedCoverColors: PulseClubAccent[] = ['analytics', 'consulting', 'finance', 'hr', 'marketing', 'operations', 'product', 'red', 'startup'];

  return {
    category: (row.category as PulseClub['category']) ?? 'domain',
    college: firstRelation(row.college as PulseClub['college'] | PulseClub['college'][]),
    college_id: String(row.college_id ?? ''),
    contact_email: row.contact_email as string | null | undefined,
    cover_color: allowedCoverColors.includes(coverColor as PulseClubAccent) ? (coverColor as PulseClubAccent) : 'red',
    created_at: String(row.created_at ?? ''),
    description: row.description as string | null | undefined,
    external_url: row.external_url as string | null | undefined,
    focus_tags: Array.isArray(row.focus_tags) ? row.focus_tags.map(String) : [],
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    status: (row.status as PulseClub['status']) ?? 'active',
    summary: String(row.summary ?? '')
  };
}

function mapClubMembership(row: Record<string, unknown>): PulseClubMembership {
  return {
    club: firstRelation(row.club as PulseClubMembership['club'] | PulseClubMembership['club'][]),
    club_id: String(row.club_id ?? ''),
    id: String(row.id ?? ''),
    profile: firstRelation(row.profile as PulseClubMembership['profile'] | PulseClubMembership['profile'][]),
    profile_id: String(row.profile_id ?? ''),
    role: (row.role as PulseClubMembership['role']) ?? 'member',
    status: (row.status as PulseClubMembership['status']) ?? 'active',
    title: row.title as string | null | undefined
  };
}

function mapClubPost(row: Record<string, unknown>): PulseClubPost {
  return {
    author: (row.author as PulseClubPost['author']) ?? null,
    author_profile_id: String(row.author_profile_id ?? ''),
    body: String(row.body ?? ''),
    club: firstRelation(row.club as PulseClubPost['club'] | PulseClubPost['club'][]),
    club_id: String(row.club_id ?? ''),
    created_at: String(row.created_at ?? ''),
    id: String(row.id ?? ''),
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? {},
    moderated_at: row.moderated_at as string | null | undefined,
    moderated_by_auth_user_id: row.moderated_by_auth_user_id as string | null | undefined,
    pinned: Boolean(row.pinned),
    post_id: row.post_id as string | null | undefined,
    post_type: (row.post_type as PulseClubPost['post_type']) ?? 'announcement',
    status: (row.status as PulseClubPost['status']) ?? 'published',
    title: String(row.title ?? ''),
    updated_at: row.updated_at as string | null | undefined
  };
}

function mapNotification(row: Record<string, unknown>): PulseNotification {
  const notificationType = (row.notification_type as PulseNotification['notification_type']) ?? 'comment';
  const rawTitle = String(row.title ?? '');
  const title =
    notificationType === 'connection_interest'
      ? rawTitle.replace(' wants to connect', ' showed interest in your profile')
      : rawTitle;

  return {
    actor: (row.actor as PulseNotification['actor']) ?? null,
    actor_profile_id: row.actor_profile_id as string | null | undefined,
    body: row.body as string | null | undefined,
    created_at: String(row.created_at ?? ''),
    id: String(row.id),
    link_path: row.link_path as string | null | undefined,
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? {},
    notification_type: notificationType,
    read_at: row.read_at as string | null | undefined,
    title
  };
}

function mapMentorshipRsvp(row: Record<string, unknown>): PulseMentorshipRsvp {
  return {
    created_at: String(row.created_at ?? ''),
    id: String(row.id ?? ''),
    note: row.note as string | null | undefined,
    profile_id: String(row.profile_id ?? ''),
    session: firstRelation(row.session as PulseMentorshipRsvp['session'] | PulseMentorshipRsvp['session'][]),
    session_id: String(row.session_id ?? ''),
    status: (row.status as PulseMentorshipRsvpStatus) ?? 'rsvped'
  };
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapOpportunityApplication(row: Record<string, unknown>): PulseOpportunityApplication {
  return {
    answers: (row.answers as Record<string, unknown> | null | undefined) ?? {},
    applied_at: row.applied_at as string | null | undefined,
    created_at: String(row.created_at ?? ''),
    id: String(row.id),
    linkedin_url: row.linkedin_url as string | null | undefined,
    note: row.note as string | null | undefined,
    opportunity: firstRelation(row.opportunity as PulseOpportunityApplication['opportunity'] | PulseOpportunityApplication['opportunity'][]),
    opportunity_id: String(row.opportunity_id ?? ''),
    portfolio_url: row.portfolio_url as string | null | undefined,
    profile_id: String(row.profile_id ?? ''),
    resume_url: row.resume_url as string | null | undefined,
    status: (row.status as PulseOpportunityApplication['status']) ?? 'interested',
    updated_at: row.updated_at as string | null | undefined
  };
}

function mapClubPostAction(row: Record<string, unknown>): PulseClubPostAction {
  return {
    action_type: (row.action_type as PulseClubPostActionType) ?? 'saved',
    club_post_id: String(row.club_post_id ?? ''),
    created_at: String(row.created_at ?? ''),
    id: String(row.id ?? ''),
    profile_id: String(row.profile_id ?? ''),
    updated_at: row.updated_at as string | null | undefined
  };
}

function mapClubPostActionActivity(row: Record<string, unknown>): PulseClubPostActionActivity {
  const post = firstRelation(row.post as Record<string, unknown> | Record<string, unknown>[] | null | undefined);
  return {
    ...mapClubPostAction(row),
    post: post ? mapClubPost(post) : null
  };
}

function mapClubNotificationAuditItem(row: Record<string, unknown>): PulseClubNotificationAuditItem {
  return {
    body: row.body as string | null | undefined,
    created_at: String(row.created_at ?? ''),
    id: String(row.id ?? ''),
    link_path: row.link_path as string | null | undefined,
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? {},
    notification_type: (row.notification_type as PulseNotification['notification_type']) ?? 'club_post',
    read_at: row.read_at as string | null | undefined,
    recipient_display_name: row.recipient_display_name as string | null | undefined,
    recipient_profile_id: String(row.recipient_profile_id ?? ''),
    title: String(row.title ?? '')
  };
}

function mapClubMembershipActivityItem(row: Record<string, unknown>): PulseClubMembershipActivityItem {
  return {
    action: (row.action as PulseClubMembershipActivityItem['action']) ?? 'membership_updated',
    actor_display_name: row.actor_display_name as string | null | undefined,
    actor_profile_id: row.actor_profile_id as string | null | undefined,
    club_id: String(row.club_id ?? ''),
    created_at: String(row.created_at ?? ''),
    id: String(row.id ?? ''),
    membership_id: row.membership_id as string | null | undefined,
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? {},
    next_role: row.next_role as string | null | undefined,
    next_status: row.next_status as string | null | undefined,
    next_title: row.next_title as string | null | undefined,
    previous_role: row.previous_role as string | null | undefined,
    previous_status: row.previous_status as string | null | undefined,
    previous_title: row.previous_title as string | null | undefined,
    target_display_name: row.target_display_name as string | null | undefined,
    target_profile_id: row.target_profile_id as string | null | undefined
  };
}

const pulseProfileSelect =
  'id, display_name, headline, bio, avatar_url, linkedin_url, skills, interests, profile_visibility, pulse_status, referral_code, student_id, college_id, created_at, college:pulse_colleges(id, name, city, state, country)';

function metadataText(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function emailDisplayNameFallback(email?: string) {
  return email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ?? '';
}

function defaultProfileInput(sessionEmail?: string, student?: StudentProfile, metadata?: Record<string, unknown>): PulseProfileInput {
  const metadataName = metadataText(metadata, ['full_name', 'fullName', 'name', 'display_name', 'displayName']);

  return {
    bio: '',
    collegeId: '',
    displayName: student?.fullName || metadataName || emailDisplayNameFallback(sessionEmail),
    headline: student?.programName ? `${student.programName} student` : '',
    interests: [],
    linkedinUrl: typeof metadata?.linkedin_url === 'string' ? metadata.linkedin_url : '',
    skills: []
  };
}

export function usePulseColleges() {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated',
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_colleges')
        .select('id, name, city, state, country')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as PulseCollege[];
    },
    queryKey: ['pulse-colleges'],
    staleTime: 5 * 60_000
  });
}

export function usePulseCollegeClubs(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.college_id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_clubs')
        .select('id, college_id, name, slug, category, summary, description, focus_tags, cover_color, contact_email, external_url, status, created_at, college:pulse_colleges(id, name)')
        .eq('college_id', profile?.college_id)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []).map((row) => mapClub(row));
    },
    queryKey: ['pulse-college-clubs', profile?.college_id],
    staleTime: 60_000
  });
}

export function usePulseClubDetail(slug?: string, profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.college_id) && Boolean(slug),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_clubs')
        .select('id, college_id, name, slug, category, summary, description, focus_tags, cover_color, contact_email, external_url, status, created_at, college:pulse_colleges(id, name)')
        .eq('college_id', profile?.college_id)
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      return data ? mapClub(data) : null;
    },
    queryKey: ['pulse-club-detail', profile?.college_id, slug],
    staleTime: 60_000
  });
}

export function usePulseClubMemberships(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_club_members')
        .select('id, club_id, profile_id, role, title, status')
        .eq('profile_id', profile?.id)
        .in('status', ['active', 'paused']);

      if (error) throw error;
      return (data ?? []).map((row) => mapClubMembership(row));
    },
    queryKey: ['pulse-club-memberships', profile?.id],
    staleTime: 60_000
  });
}

export function usePulseCollegeClubMembers(clubIds: string[], profile?: PulseProfile | null) {
  const { status } = useAuth();
  const clubKey = clubIds.join('|');

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && clubIds.length > 0,
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_club_members')
        .select('id, club_id, profile_id, role, title, status, club:pulse_clubs(id, name, slug, cover_color), profile:pulse_profiles(id, display_name, headline, avatar_url, linkedin_url)')
        .in('club_id', clubIds)
        .eq('status', 'active')
        .order('role', { ascending: true })
        .limit(120);

      if (error) throw error;
      return (data ?? []).map((row) => mapClubMembership(row));
    },
    queryKey: ['pulse-college-club-members', profile?.id, clubKey],
    staleTime: 30_000
  });
}

export function usePulseClubPendingMembers(clubId?: string, profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && Boolean(clubId),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_club_members')
        .select('id, club_id, profile_id, role, title, status, club:pulse_clubs(id, name, slug, cover_color), profile:pulse_profiles(id, display_name, headline, avatar_url, linkedin_url)')
        .eq('club_id', clubId)
        .eq('status', 'pending')
        .order('role', { ascending: true })
        .limit(20);

      if (error) throw error;
      return (data ?? []).map((row) => mapClubMembership(row));
    },
    queryKey: ['pulse-club-pending-members', clubId],
    staleTime: 20_000
  });
}

export function usePulseClubPosts(clubId?: string, profile?: PulseProfile | null, includeManagedStatuses = false) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && Boolean(clubId),
    queryFn: async () => {
      const supabase = requireSupabase();
      let query = supabase
        .from('pulse_club_posts')
        .select('id, club_id, author_profile_id, post_id, post_type, title, body, status, pinned, metadata, moderated_at, moderated_by_auth_user_id, created_at, updated_at, author:pulse_profiles(id, display_name, headline, avatar_url)')
        .eq('club_id', clubId);

      if (includeManagedStatuses) {
        query = query.in('status', ['draft', 'published', 'archived']);
      } else {
        query = query.eq('status', 'published');
      }

      const { data, error } = await query
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(includeManagedStatuses ? 80 : 30);

      if (error) throw error;
      return (data ?? []).map((row) => mapClubPost(row));
    },
    queryKey: ['pulse-club-posts', clubId, includeManagedStatuses ? 'managed' : 'published'],
    staleTime: 20_000
  });
}

export function usePulseCollegeClubPosts(
  clubIds: string[],
  postTypes: PulseClubPost['post_type'][],
  profile?: PulseProfile | null
) {
  const { status } = useAuth();
  const clubKey = clubIds.join('|');
  const typeKey = postTypes.join('|');

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && clubIds.length > 0 && postTypes.length > 0,
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_club_posts')
        .select('id, club_id, author_profile_id, post_id, post_type, title, body, status, pinned, metadata, moderated_at, moderated_by_auth_user_id, created_at, updated_at, author:pulse_profiles(id, display_name, headline, avatar_url), club:pulse_clubs(id, name, slug, cover_color)')
        .in('club_id', clubIds)
        .in('post_type', postTypes)
        .eq('status', 'published')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data ?? []).map((row) => mapClubPost(row));
    },
    queryKey: ['pulse-college-club-posts', profile?.id, clubKey, typeKey],
    staleTime: 20_000
  });
}

export function usePulseClubPostActions(postIds: string[], profile?: PulseProfile | null) {
  const { status } = useAuth();
  const postKey = postIds.join('|');

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && postIds.length > 0,
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_club_post_actions')
        .select('id, club_post_id, profile_id, action_type, created_at, updated_at')
        .eq('profile_id', profile?.id)
        .in('club_post_id', postIds);

      if (error) {
        if (isMissingClubPostActionsTable(error)) return [];
        throw error;
      }
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapClubPostAction(row));
    },
    queryKey: ['pulse-club-post-actions', profile?.id, postKey],
    staleTime: 20_000
  });
}

export function useTogglePulseClubPostAction(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { actionType: PulseClubPostActionType; clubPostId: string; isActive: boolean }) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before saving this item.');
      const supabase = requireSupabase();

      if (input.isActive) {
        const { error } = await supabase
          .from('pulse_club_post_actions')
          .delete()
          .eq('club_post_id', input.clubPostId)
          .eq('profile_id', profile.id)
          .eq('action_type', input.actionType);

        if (error) {
          if (isMissingClubPostActionsTable(error)) return;
          throw error;
        }
        return;
      }

      const { error } = await supabase
        .from('pulse_club_post_actions')
        .insert({
          action_type: input.actionType,
          club_post_id: input.clubPostId,
          profile_id: profile.id
        });

      if (error) {
        if (isMissingClubPostActionsTable(error)) return;
        throw error;
      }
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-club-post-actions', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-college-club-posts'] });
    }
  });
}

export function usePulseClubPostActionActivity(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_club_post_actions')
        .select(
          'id, club_post_id, profile_id, action_type, created_at, updated_at, post:pulse_club_posts!pulse_club_post_actions_club_post_id_fkey(id, club_id, author_profile_id, post_id, post_type, title, body, status, pinned, metadata, moderated_at, moderated_by_auth_user_id, created_at, updated_at, club:pulse_clubs(id, name, slug, cover_color))'
        )
        .eq('profile_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) {
        if (isMissingClubPostActionsTable(error)) return [];
        throw error;
      }

      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapClubPostActionActivity(row));
    },
    queryKey: ['pulse-club-post-action-activity', profile?.id],
    staleTime: 20_000
  });
}

export function usePulseClubPostActionSummary(postIds: string[], profile?: PulseProfile | null) {
  const { status } = useAuth();
  const postKey = postIds.join('|');

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && postIds.length > 0,
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_club_post_actions')
        .select('club_post_id, action_type')
        .in('club_post_id', postIds);

      if (error) {
        if (isMissingClubPostActionsTable(error)) return new Map<string, PulseClubPostActionSummary>();
        throw error;
      }

      const summary = new Map<string, PulseClubPostActionSummary>();
      ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
        const postId = String(row.club_post_id ?? '');
        const actionType = row.action_type as PulseClubPostActionType;
        if (!postId) return;
        const current = summary.get(postId) ?? { interested: 0, saved: 0, useful: 0 };
        if (actionType === 'saved') current.saved += 1;
        if (actionType === 'useful') current.useful += 1;
        if (actionType === 'interested') current.interested += 1;
        summary.set(postId, current);
      });
      return summary;
    },
    queryKey: ['pulse-club-post-action-summary', profile?.id, postKey],
    staleTime: 20_000
  });
}

export function useTogglePulseClubMembership(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { clubId: string; isJoining: boolean; membershipId?: string }) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before joining a club.');
      const supabase = requireSupabase();

      if (input.membershipId) {
        const { data, error } = await supabase
          .from('pulse_club_members')
          .update({ status: input.isJoining ? 'active' : 'paused' })
          .eq('id', input.membershipId)
          .eq('profile_id', profile.id)
          .select('id, club_id, profile_id, role, title, status')
          .single();

        if (error) throw error;
        return mapClubMembership(data);
      }

      const { data, error } = await supabase
        .from('pulse_club_members')
        .insert({
          club_id: input.clubId,
          profile_id: profile.id,
          role: 'member',
          status: 'active'
        })
        .select('id, club_id, profile_id, role, title, status')
        .single();

      if (error) throw error;
      return mapClubMembership(data);
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-club-memberships', profile?.id] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', input.clubId] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
    }
  });
}

export function useUpdatePulseClubMembershipStatus(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      clubId: string;
      membershipId: string;
      role?: PulseClubMembership['role'];
      status?: PulseClubMembership['status'];
      title?: string | null;
    }) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before managing club members.');
      const supabase = requireSupabase();
      const updates: Partial<Pick<PulseClubMembership, 'role' | 'status' | 'title'>> = {};
      if (input.role) updates.role = input.role;
      if (input.status) updates.status = input.status;
      if ('title' in input) updates.title = input.title;
      if (!Object.keys(updates).length) throw new Error('Choose a member update before saving.');

      const { data, error } = await supabase
        .from('pulse_club_members')
        .update(updates)
        .eq('id', input.membershipId)
        .eq('club_id', input.clubId)
        .select('id, club_id, profile_id, role, title, status, club:pulse_clubs(id, name, slug, cover_color), profile:pulse_profiles(id, display_name, headline, avatar_url, linkedin_url)')
        .single();

      if (error) throw error;
      return mapClubMembership(data);
    },
    onSuccess: (_membership, input) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-club-pending-members', input.clubId] });
      queryClient.invalidateQueries({ queryKey: ['pulse-college-club-members'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-membership-activity', input.clubId] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
    }
  });
}

export function usePulseClubMembershipActivity(clubId?: string, profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && Boolean(clubId),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase.rpc('get_pulse_club_membership_activity', {
        p_club_id: clubId,
        p_limit: 30
      });

      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapClubMembershipActivityItem(row));
    },
    queryKey: ['pulse-club-membership-activity', clubId, profile?.id],
    staleTime: 20_000
  });
}

export function usePulseClubNotificationAudit(clubId?: string, profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && Boolean(clubId),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase.rpc('get_pulse_club_notification_audit', {
        p_club_id: clubId,
        p_limit: 30
      });

      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapClubNotificationAuditItem(row));
    },
    queryKey: ['pulse-club-notification-audit', clubId, profile?.id],
    staleTime: 20_000
  });
}

export function useSendPulseClubTestNotification(clubId?: string, profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.id || !clubId) throw new Error('Open a club as an admin before sending a test notification.');
      const supabase = requireSupabase();
      const { error } = await supabase.rpc('send_pulse_club_test_notification', {
        p_club_id: clubId
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-club-notification-audit', clubId] });
      queryClient.invalidateQueries({ queryKey: ['pulse-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-notifications-unread'] });
    }
  });
}

export function useCreatePulseClubPost(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseClubPostInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before publishing a club update.');
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_club_posts')
        .insert({
          author_profile_id: profile.id,
          body: input.body.trim(),
          club_id: input.clubId,
          metadata: input.metadata ?? {},
          post_type: input.postType,
          status: input.status ?? 'published',
          title: input.title.trim()
        })
        .select('id, club_id, author_profile_id, post_id, post_type, title, body, status, pinned, metadata, moderated_at, moderated_by_auth_user_id, created_at, updated_at, author:pulse_profiles(id, display_name, headline, avatar_url)')
        .single();

      if (error) throw error;
      return mapClubPost(data);
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id, 'managed'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id, 'published'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-college-club-posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
    }
  });
}

export function useUpdatePulseClubPost(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseClubPostUpdateInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before editing club posts.');
      const supabase = requireSupabase();
      const updates: Record<string, unknown> = {
        body: input.body.trim(),
        post_type: input.postType,
        status: input.status ?? 'published',
        title: input.title.trim()
      };
      if (input.metadata) updates.metadata = input.metadata;

      const { data, error } = await supabase
        .from('pulse_club_posts')
        .update(updates)
        .eq('id', input.postId)
        .select('id, club_id, author_profile_id, post_id, post_type, title, body, status, pinned, metadata, moderated_at, moderated_by_auth_user_id, created_at, updated_at, author:pulse_profiles(id, display_name, headline, avatar_url)')
        .single();

      if (error) throw error;
      return mapClubPost(data);
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id, 'managed'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id, 'published'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-college-club-posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
    }
  });
}

export function useArchivePulseClubPost(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: Pick<PulseClubPost, 'club_id' | 'id'>) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before archiving club posts.');
      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_club_posts')
        .update({
          moderated_at: new Date().toISOString(),
          status: 'archived'
        })
        .eq('id', post.id);

      if (error) throw error;
      return post;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id, 'managed'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts', post.club_id, 'published'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-college-club-posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
    }
  });
}

export function usePulseProfile() {
  const { session, status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(session?.user.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_profiles')
        .select(pulseProfileSelect)
        .eq('auth_user_id', session?.user.id)
        .maybeSingle();

      if (error) throw error;
      return data ? mapProfile(data) : null;
    },
    queryKey: ['pulse-profile', session?.user.id],
    staleTime: 60_000
  });
}

export function usePulseProfileDetail(profileId?: string) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profileId),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_profiles')
        .select(pulseProfileSelect)
        .eq('id', profileId)
        .eq('pulse_status', 'active')
        .maybeSingle();

      if (error) throw error;
      return data ? mapProfile(data) : null;
    },
    queryKey: ['pulse-profile-detail', profileId],
    staleTime: 30_000
  });
}

export function usePulseProfileDefaults() {
  const { session } = useAuth();
  const studentQuery = useStudentProfile();
  return useMemo(
    () => defaultProfileInput(session?.user.email, studentQuery.data, session?.user.user_metadata),
    [session?.user.email, session?.user.user_metadata, studentQuery.data]
  );
}

export function useSavePulseProfile() {
  const { session } = useAuth();
  const studentQuery = useStudentProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseProfileInput) => {
      const supabase = requireSupabase();
      const userId = session?.user.id;
      if (!userId) throw new Error('Please sign in to create your Pulse profile.');

      let collegeId = input.collegeId || null;
      const collegeName = input.collegeName?.trim();

      if (!collegeId && !collegeName) {
        throw new Error('Select your college, or choose Other and type your college name.');
      }

      if (collegeId === PULSE_OTHER_COLLEGE_ID && !collegeName) {
        throw new Error('Type your college name after selecting Other.');
      }

      const shouldResolveCollege =
        Boolean(collegeName) && (!collegeId || collegeId === PULSE_OTHER_COLLEGE_ID || isPulseStaticCollegeId(collegeId));

      if (shouldResolveCollege) {
        const { data: resolvedCollegeId, error: collegeError } = await supabase.rpc('upsert_pulse_college_by_name', {
          p_college_name: collegeName
        });

        if (collegeError) throw collegeError;
        collegeId = resolvedCollegeId as string;
      }

      if (collegeId === PULSE_OTHER_COLLEGE_ID || isPulseStaticCollegeId(collegeId)) {
        collegeId = null;
      }

      if (!collegeId) {
        throw new Error('Select your college, or choose Other and type your college name.');
      }

      const payload = {
        auth_user_id: userId,
        avatar_url: input.avatarUrl ?? null,
        bio: input.bio?.trim() || null,
        college_id: collegeId,
        display_name: input.displayName.trim(),
        headline: input.headline?.trim() || null,
        interests: input.interests,
        linkedin_url: input.linkedinUrl?.trim() || null,
        profile_visibility: 'public',
        skills: input.skills,
        student_id: studentQuery.data?.id ?? null
      };

      const { data, error } = await supabase
        .from('pulse_profiles')
        .upsert(payload, { onConflict: 'auth_user_id' })
        .select(pulseProfileSelect)
        .single();

      if (error) throw error;
      return mapProfile(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-profile'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-feed'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function usePulseFeed(profile?: PulseProfile | null, filter: PulseFeedFilter = 'all') {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      let query = supabase
        .from('pulse_posts')
        .select('id, author_profile_id, title, body, post_type, visibility, anonymous, pinned, metadata, created_at, college_id, author:pulse_profiles(id, display_name, headline, avatar_url), college:pulse_colleges(id, name)')
        .eq('status', 'published')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter === 'college') {
        query = query.eq('visibility', 'college');
      } else if (filter === 'global') {
        query = query.eq('visibility', 'global');
      } else if (filter === 'opportunities') {
        query = query.eq('post_type', 'opportunity');
      } else if (filter === 'recognition') {
        query = query.in('post_type', ['recognition', 'shoutout']);
      }

      const { data, error } = await query.limit(30);

      if (error) throw error;
      return (data ?? []).map((row) => mapPost(row));
    },
    queryKey: ['pulse-feed', profile?.id, profile?.college_id, filter],
    staleTime: 20_000
  });
}

export function usePulseProfilePosts(profileId?: string) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profileId),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_posts')
        .select('id, author_profile_id, title, body, post_type, visibility, anonymous, pinned, metadata, created_at, college_id, author:pulse_profiles(id, display_name, headline, avatar_url), college:pulse_colleges(id, name)')
        .eq('author_profile_id', profileId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      return (data ?? []).map((row) => mapPost(row));
    },
    queryKey: ['pulse-profile-posts', profileId],
    staleTime: 20_000
  });
}

export function useCreatePulsePost(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulsePostInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before posting.');
      const supabase = requireSupabase();
      const isShoutOut = input.postType === 'recognition' || input.postType === 'shoutout';
      const cleanPollOptions = (input.pollOptions ?? [])
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 6);

      if (input.postType === 'poll' && cleanPollOptions.length < 2) {
        throw new Error('Add at least two poll options.');
      }

      const metadata =
        input.postType === 'poll'
          ? {
              poll_options: cleanPollOptions.map((label, index) => ({
                id: `option-${index + 1}`,
                label
              }))
            }
          : isShoutOut && input.recipientProfileId
            ? { recipient_profile_id: input.recipientProfileId }
            : {};

      const { data, error } = await supabase
        .from('pulse_posts')
        .insert({
          anonymous: isShoutOut ? false : input.anonymous,
          author_profile_id: profile.id,
          body: input.body.trim(),
          college_id: input.visibility === 'college' ? profile.college_id : null,
          metadata,
          post_type: input.postType,
          status: 'published',
          title: input.title.trim(),
          visibility: input.visibility
        })
        .select('id, author_profile_id, title, body, post_type, visibility, anonymous, pinned, metadata, created_at, college_id, author:pulse_profiles(id, display_name, headline, avatar_url), college:pulse_colleges(id, name)')
        .single();

      if (error) throw error;
      return mapPost(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-feed'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function useUpdatePulsePost(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulsePostUpdateInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before editing posts.');
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_posts')
        .update({
          body: input.body.trim(),
          college_id: input.visibility === 'college' ? profile.college_id : null,
          title: input.title.trim(),
          visibility: input.visibility
        })
        .eq('id', input.postId)
        .eq('author_profile_id', profile.id)
        .select('id, author_profile_id, title, body, post_type, visibility, anonymous, pinned, metadata, created_at, college_id, author:pulse_profiles(id, display_name, headline, avatar_url), college:pulse_colleges(id, name)')
        .single();

      if (error) throw error;
      return mapPost(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-feed'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-profile-posts'] });
    }
  });
}

export function useArchivePulsePost(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before hiding posts.');
      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_posts')
        .update({ status: 'archived' })
        .eq('id', postId)
        .eq('author_profile_id', profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-feed'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-profile-posts'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-post-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function usePulsePostInteractions(posts?: PulsePost[], profile?: PulseProfile | null) {
  const { status } = useAuth();
  const postIds = useMemo(() => (posts ?? []).map((post) => post.id), [posts]);

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && postIds.length > 0,
    queryFn: async () => {
      const supabase = requireSupabase();
      const pollPostIds = (posts ?? []).filter((post) => post.post_type === 'poll').map((post) => post.id);
      const [commentsResult, reactionsResult, pollVotesResult] = await Promise.all([
        supabase
          .from('pulse_comments')
          .select('id, author_profile_id, post_id, body, anonymous, status, created_at, author:pulse_profiles(id, display_name, headline, avatar_url)')
          .in('post_id', postIds)
          .eq('status', 'published')
          .order('created_at', { ascending: true }),
        supabase
          .from('pulse_reactions')
          .select('id, post_id, profile_id, reaction_type')
          .in('post_id', postIds)
          .eq('reaction_type', 'celebrate'),
        pollPostIds.length
          ? supabase
              .from('pulse_poll_votes')
              .select('post_id, profile_id, option_id')
              .in('post_id', pollPostIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (commentsResult.error) throw commentsResult.error;
      if (reactionsResult.error) throw reactionsResult.error;
      if (pollVotesResult.error && pollVotesResult.error.code !== '42P01') throw pollVotesResult.error;

      const summaries = new Map<string, PulsePostInteractionSummary>();
      postIds.forEach((postId) => {
        summaries.set(postId, {
          comments: [],
          commentCount: 0,
          hasReacted: false,
          pollCounts: {},
          pollTotal: 0,
          reactionCount: 0
        });
      });

      (commentsResult.data ?? []).forEach((row) => {
        const comment = mapComment(row);
        const summary = summaries.get(comment.post_id);
        if (!summary) return;
        summary.commentCount += 1;
        summary.comments.push(comment);
      });

      (reactionsResult.data ?? []).forEach((reaction) => {
        const postId = String(reaction.post_id ?? '');
        const summary = summaries.get(postId);
        if (!summary) return;
        summary.reactionCount += 1;
        if (reaction.profile_id === profile?.id) summary.hasReacted = true;
      });

      if (!pollVotesResult.error) {
        (pollVotesResult.data ?? []).forEach((vote) => {
          const postId = String(vote.post_id ?? '');
          const optionId = String(vote.option_id ?? '');
          const summary = summaries.get(postId);
          if (!summary || !optionId) return;
          summary.pollCounts[optionId] = (summary.pollCounts[optionId] ?? 0) + 1;
          summary.pollTotal += 1;
          if (vote.profile_id === profile?.id) summary.selectedPollOptionId = optionId;
        });
      }

      return summaries;
    },
    queryKey: ['pulse-post-interactions', profile?.id, postIds.join(',')],
    staleTime: 15_000
  });
}

function isRealtimePostVisible(
  row: Record<string, unknown>,
  profile: PulseProfile,
  filter: PulseFeedFilter
) {
  const status = String(row.status ?? 'published');
  const postType = String(row.post_type ?? '');
  const visibility = String(row.visibility ?? '');

  if (status !== 'published') return false;
  if (filter === 'college') return visibility === 'college';
  if (filter === 'global') return visibility === 'global';
  if (filter === 'opportunities') return postType === 'opportunity';
  if (filter === 'recognition') return postType === 'recognition' || postType === 'shoutout';
  if (visibility === 'college' && profile.college_id && row.college_id && row.college_id !== profile.college_id) return false;
  return true;
}

export function usePulseFeedRealtime({
  enabled = true,
  filter,
  onNewFeedUpdate,
  posts,
  profile
}: {
  enabled?: boolean;
  filter: PulseFeedFilter;
  onNewFeedUpdate?: () => void;
  posts?: PulsePost[];
  profile?: PulseProfile | null;
}) {
  const queryClient = useQueryClient();
  const postIds = useMemo(() => (posts ?? []).map((post) => post.id), [posts]);
  const postIdsKey = postIds.join(',');
  const refreshTimerRef = useRef<number | null>(null);
  const newPostTimerRef = useRef<number | null>(null);
  const onNewFeedUpdateRef = useRef(onNewFeedUpdate);

  useEffect(() => {
    onNewFeedUpdateRef.current = onNewFeedUpdate;
  }, [onNewFeedUpdate]);

  useEffect(() => {
    if (!enabled || !profile?.id) return undefined;
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;

    const visiblePostIds = new Set(postIds);
    const postIdFilter = postIds.length ? `post_id=in.(${postIds.join(',')})` : undefined;

    function scheduleInteractionRefresh() {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['pulse-post-interactions'] });
        queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
        refreshTimerRef.current = null;
      }, 1_500);
    }

    function scheduleFeedMaintenance() {
      if (newPostTimerRef.current) window.clearTimeout(newPostTimerRef.current);
      newPostTimerRef.current = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['pulse-feed'] });
        queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
        newPostTimerRef.current = null;
      }, 3_000);
    }

    function handleInteractionChange(payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) {
      const changedPostId = String(payload.new?.post_id ?? payload.old?.post_id ?? '');
      if (visiblePostIds.size && changedPostId && !visiblePostIds.has(changedPostId)) return;
      scheduleInteractionRefresh();
    }

    let channel = supabase
      .channel(`pulse-feed-live:${profile.id}:${filter}:${postIdsKey.slice(0, 80) || 'empty'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pulse_posts' },
        (payload) => {
          const row = (payload.new ?? {}) as Record<string, unknown>;
          if (!isRealtimePostVisible(row, profile, filter)) return;
          onNewFeedUpdateRef.current?.();
          queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pulse_posts' },
        (payload) => {
          const newRow = (payload.new ?? {}) as Record<string, unknown>;
          const oldRow = (payload.old ?? {}) as Record<string, unknown>;
          if (!isRealtimePostVisible(newRow, profile, filter) && !isRealtimePostVisible(oldRow, profile, filter)) return;
          scheduleFeedMaintenance();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'pulse_posts' },
        (payload) => {
          const newRow = (payload.new ?? {}) as Record<string, unknown>;
          const oldRow = (payload.old ?? {}) as Record<string, unknown>;
          if (!isRealtimePostVisible(newRow, profile, filter) && !isRealtimePostVisible(oldRow, profile, filter)) return;
          scheduleFeedMaintenance();
        }
      );

    if (postIdFilter) {
      channel = channel
        .on(
          'postgres_changes',
          {
            event: '*',
            filter: postIdFilter,
            schema: 'public',
            table: 'pulse_comments'
          },
          handleInteractionChange
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            filter: postIdFilter,
            schema: 'public',
            table: 'pulse_reactions'
          },
          handleInteractionChange
        );
    }

    channel.subscribe();

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (newPostTimerRef.current) {
        window.clearTimeout(newPostTimerRef.current);
        newPostTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [enabled, filter, postIdsKey, profile, queryClient]);
}

export function useCreatePulseComment(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseCommentInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before commenting.');
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_comments')
        .insert({
          anonymous: input.anonymous,
          author_profile_id: profile.id,
          body: input.body.trim(),
          post_id: input.postId,
          status: 'published'
        })
        .select('id, author_profile_id, post_id, body, anonymous, status, created_at, author:pulse_profiles(id, display_name, headline, avatar_url)')
        .single();

      if (error) throw error;
      return mapComment(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-post-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function useUpdatePulseComment(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseCommentUpdateInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before editing comments.');
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_comments')
        .update({ body: input.body.trim() })
        .eq('id', input.commentId)
        .eq('author_profile_id', profile.id)
        .select('id, author_profile_id, post_id, body, anonymous, status, created_at, author:pulse_profiles(id, display_name, headline, avatar_url)')
        .single();

      if (error) throw error;
      return mapComment(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-post-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function useDeletePulseComment(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before deleting comments.');
      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_comments')
        .delete()
        .eq('id', commentId)
        .eq('author_profile_id', profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-post-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function useTogglePulsePostReaction(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ hasReacted, postId }: { hasReacted: boolean; postId: string }) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before reacting.');
      const supabase = requireSupabase();

      if (hasReacted) {
        const { error } = await supabase
          .from('pulse_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('profile_id', profile.id)
          .eq('reaction_type', 'celebrate');
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('pulse_reactions').insert({
        post_id: postId,
        profile_id: profile.id,
        reaction_type: 'celebrate'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-post-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function useVotePulsePoll(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ optionId, postId }: { optionId: string; postId: string }) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before voting.');
      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_poll_votes')
        .upsert(
          {
            option_id: optionId,
            post_id: postId,
            profile_id: profile.id
          },
          { onConflict: 'post_id,profile_id' }
        );

      if (error?.code === '42P01') {
        throw new Error('Poll voting needs the latest Pulse SQL applied first.');
      }

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-post-interactions'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function useCreatePulseReport(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseReportInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before reporting content.');
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_reports').insert({
        comment_id: input.commentId ?? null,
        details: input.details?.trim() || null,
        post_id: input.postId ?? null,
        reason: input.reason,
        reporter_profile_id: profile.id,
        status: 'open'
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
    }
  });
}

export function usePulseInvites(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_invites')
        .select('id, referral_code, invited_email, status, accepted_at, created_at')
        .eq('invited_by_profile_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      return (data ?? []) as PulseInvite[];
    },
    queryKey: ['pulse-invites', profile?.id],
    staleTime: 20_000
  });
}

export function useAcceptPulseInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const supabase = requireSupabase();
      const { data, error } = await supabase.rpc('accept_pulse_invite', { invite_code: inviteCode });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      return result as PulseInviteAcceptance;
    },
    onSuccess: () => {
      forgetPulseInviteCode();
      queryClient.invalidateQueries({ queryKey: ['pulse-profile'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-invites'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function usePulseLeaderboard(
  profile?: PulseProfile | null,
  scope: PulseLeaderboardScope = 'college',
  period: PulseLeaderboardPeriod = 'week'
) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase.rpc('get_pulse_leaderboard', {
        p_limit: 30,
        p_period: period,
        p_scope: scope
      });

      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row): PulseLeaderboardEntry => ({
        avatar_url: row.avatar_url as string | null | undefined,
        badge: String(row.badge ?? 'Rising Contributor'),
        college_name: row.college_name as string | null | undefined,
        display_name: String(row.display_name ?? ''),
        headline: row.headline as string | null | undefined,
        profile_id: String(row.profile_id ?? ''),
        rank_position: Number(row.rank_position ?? 0),
        total_points: Number(row.total_points ?? 0)
      }));
    },
    queryKey: ['pulse-leaderboard', profile?.id, profile?.college_id, scope, period],
    staleTime: 20_000
  });
}

export function usePulseOpportunities(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      let result: { data: unknown; error: { message?: string } | null } = await supabase
        .from('pulse_opportunities')
        .select(PULSE_OPPORTUNITY_SELECT)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30);

      if (isMissingOpportunityOptionalColumn(result.error)) {
        result = await supabase
          .from('pulse_opportunities')
          .select(PULSE_OPPORTUNITY_SELECT_FALLBACK)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(30);
      }

      if (result.error) throw result.error;
      return (result.data ?? []) as PulseOpportunity[];
    },
    queryKey: ['pulse-opportunities', profile?.id, profile?.college_id],
    staleTime: 30_000
  });
}

export function usePulseCollegeOpportunities(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      let result: { data: unknown; error: { message?: string } | null } = await supabase
        .from('pulse_opportunities')
        .select(PULSE_OPPORTUNITY_SELECT)
        .eq('status', 'active')
        .eq('visibility', 'college')
        .order('created_at', { ascending: false })
        .limit(30);

      if (isMissingOpportunityOptionalColumn(result.error)) {
        result = await supabase
          .from('pulse_opportunities')
          .select(PULSE_OPPORTUNITY_SELECT_FALLBACK)
          .eq('status', 'active')
          .eq('visibility', 'college')
          .order('created_at', { ascending: false })
          .limit(30);
      }

      if (result.error) throw result.error;
      return (result.data ?? []) as PulseOpportunity[];
    },
    queryKey: ['pulse-college-opportunities', profile?.id, profile?.college_id],
    staleTime: 30_000
  });
}

export function usePulseOpportunityDetail(opportunityId?: string, profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && Boolean(opportunityId),
    queryFn: async () => {
      const supabase = requireSupabase();
      let result: { data: unknown; error: { message?: string } | null } = await supabase
        .from('pulse_opportunities')
        .select(PULSE_OPPORTUNITY_SELECT)
        .eq('id', opportunityId)
        .eq('status', 'active')
        .maybeSingle();

      if (isMissingOpportunityOptionalColumn(result.error)) {
        result = await supabase
          .from('pulse_opportunities')
          .select(PULSE_OPPORTUNITY_SELECT_FALLBACK)
          .eq('id', opportunityId)
          .eq('status', 'active')
          .maybeSingle();
      }

      if (result.error) throw result.error;
      return result.data as PulseOpportunity | null;
    },
    queryKey: ['pulse-opportunity-detail', profile?.id, profile?.college_id, opportunityId],
    staleTime: 30_000
  });
}

export function usePulseMentorshipSessions(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase.rpc('get_pulse_mentorship_sessions');

      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row): PulseMentorshipSession => ({
        college_id: row.college_id as string | null | undefined,
        college_name: row.college_name as string | null | undefined,
        created_at: String(row.created_at ?? ''),
        description: String(row.description ?? ''),
        ends_at: row.ends_at as string | null | undefined,
        host_display_name: row.host_display_name as string | null | undefined,
        host_headline: row.host_headline as string | null | undefined,
        host_profile_id: String(row.host_profile_id ?? ''),
        id: String(row.id ?? ''),
        max_seats: row.max_seats == null ? null : Number(row.max_seats),
        meeting_platform: (row.meeting_platform as PulseMentorshipSession['meeting_platform']) ?? 'google_meet',
        meeting_url: row.meeting_url as string | null | undefined,
        rsvp_count: Number(row.rsvp_count ?? 0),
        session_type: (row.session_type as PulseMentorshipSessionType) ?? 'workshop',
        source_id: row.source_id as string | null | undefined,
        source_type: row.source_type as PulseMentorshipSession['source_type'],
        starts_at: String(row.starts_at ?? ''),
        status: (row.status as PulseMentorshipSessionStatus) ?? 'published',
        title: String(row.title ?? ''),
        topic: String(row.topic ?? ''),
        visibility: (row.visibility as PulseMentorshipSession['visibility']) ?? 'global'
      }));
    },
    queryKey: ['pulse-mentorship-sessions', profile?.id, profile?.college_id],
    staleTime: 20_000
  });
}

export function usePulseMentorshipRsvps(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_mentorship_rsvps')
        .select('id, session_id, profile_id, status, note, created_at, session:pulse_mentorship_sessions!pulse_mentorship_rsvps_session_id_fkey(id, title, session_type, starts_at, host_display_name)')
        .eq('profile_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapMentorshipRsvp(row));
    },
    queryKey: ['pulse-mentorship-rsvps', profile?.id],
    staleTime: 20_000
  });
}

export function useCreatePulseMentorshipSession(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseMentorshipSessionInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before hosting mentorship.');
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_mentorship_sessions').insert({
        college_id: input.visibility === 'college' ? profile.college_id ?? null : null,
        description: input.description.trim(),
        ends_at: input.endsAt || null,
        host_profile_id: profile.id,
        max_seats: input.maxSeats ? Number(input.maxSeats) : null,
        meeting_platform: input.meetingPlatform,
        meeting_url: input.meetingUrl?.trim() || null,
        session_type: input.sessionType,
        starts_at: input.startsAt,
        status: 'submitted',
        title: input.title.trim(),
        topic: input.topic.trim(),
        visibility: input.visibility
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-mentorship-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
    }
  });
}

export function useTogglePulseMentorshipRsvp(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rsvpId, sessionId, shouldCancel }: { rsvpId?: string; sessionId: string; shouldCancel: boolean }) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before joining mentorship sessions.');
      const supabase = requireSupabase();

      if (rsvpId) {
        const { error } = await supabase
          .from('pulse_mentorship_rsvps')
          .update({ status: shouldCancel ? 'cancelled' : 'rsvped' })
          .eq('id', rsvpId)
          .eq('profile_id', profile.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('pulse_mentorship_rsvps').insert({
        profile_id: profile.id,
        session_id: sessionId,
        status: 'rsvped'
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-mentorship-rsvps'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-mentorship-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
    }
  });
}

export function usePulseSearch(query: string, filter: PulseSearchFilter = 'all', profile?: PulseProfile | null) {
  const { status } = useAuth();
  const cleanQuery = query.trim();
  const pattern = `%${cleanQuery.replace(/[%_]/g, '\\$&')}%`;

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && cleanQuery.length >= 2,
    queryFn: async (): Promise<PulseSearchResults> => {
      const supabase = requireSupabase();
      const shouldSearchPosts = filter === 'all' || filter === 'posts';
      const shouldSearchPeople = filter === 'all' || filter === 'people';
      const shouldSearchOpportunities = filter === 'all' || filter === 'opportunities';

      const [postsResult, peopleResult, opportunitiesResult] = await Promise.all([
        shouldSearchPosts
          ? supabase
              .from('pulse_posts')
              .select('id, author_profile_id, title, body, post_type, visibility, anonymous, pinned, metadata, created_at, college_id, author:pulse_profiles(id, display_name, headline, avatar_url), college:pulse_colleges(id, name)')
              .eq('status', 'published')
              .or(`title.ilike.${pattern},body.ilike.${pattern}`)
              .order('created_at', { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [], error: null }),
        shouldSearchPeople
          ? supabase
              .from('pulse_profiles')
              .select(pulseProfileSelect)
              .eq('pulse_status', 'active')
              .or(`display_name.ilike.${pattern},headline.ilike.${pattern},bio.ilike.${pattern}`)
              .order('created_at', { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [], error: null }),
        shouldSearchOpportunities
          ? supabase
              .from('pulse_opportunities')
              .select(PULSE_OPPORTUNITY_SELECT)
              .eq('status', 'active')
              .or(`title.ilike.${pattern},company_name.ilike.${pattern},description.ilike.${pattern},detail_description.ilike.${pattern}`)
              .order('created_at', { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [], error: null })
      ]);

      let opportunitiesFinal: { data: unknown; error: { message?: string } | null } = opportunitiesResult;
      if (shouldSearchOpportunities && isMissingOpportunityOptionalColumn(opportunitiesResult.error)) {
        opportunitiesFinal = await supabase
          .from('pulse_opportunities')
          .select(PULSE_OPPORTUNITY_SELECT_FALLBACK)
          .eq('status', 'active')
          .or(`title.ilike.${pattern},company_name.ilike.${pattern},description.ilike.${pattern},detail_description.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(12);
      }

      const firstError = [postsResult.error, peopleResult.error, opportunitiesFinal.error].find(Boolean);
      if (firstError) throw firstError;

      return {
        opportunities: (opportunitiesFinal.data ?? []) as PulseOpportunity[],
        people: (peopleResult.data ?? []).map((row) => mapProfile(row)),
        posts: (postsResult.data ?? []).map((row) => mapPost(row))
      };
    },
    queryKey: ['pulse-search', profile?.id, cleanQuery, filter],
    staleTime: 20_000
  });
}

export function usePulsePeopleDirectory(filters: PulsePeopleDirectoryFilters, profile?: PulseProfile | null) {
  const { status } = useAuth();
  const cleanQuery = filters.query.trim();
  const cleanTag = filters.tag.trim().toLowerCase();
  const pattern = `%${cleanQuery.replace(/[%_]/g, '\\$&')}%`;

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      let query = supabase
        .from('pulse_profiles')
        .select(pulseProfileSelect)
        .eq('pulse_status', 'active')
        .limit(72);

      if (filters.scope === 'college' && profile?.college_id) {
        query = query.eq('college_id', profile.college_id);
      }

      if (cleanQuery.length >= 2) {
        query = query.or(`display_name.ilike.${pattern},headline.ilike.${pattern},bio.ilike.${pattern}`);
      }

      if (filters.sort === 'name') {
        query = query.order('display_name', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      const people = (data ?? []).map((row) => mapProfile(row));
      if (!cleanTag) return people;

      return people.filter((person) => {
        const tags = [...person.skills, ...person.interests].map((tag) => tag.toLowerCase());
        return tags.some((tag) => tag.includes(cleanTag));
      });
    },
    queryKey: ['pulse-people-directory', profile?.id, profile?.college_id, filters],
    staleTime: 20_000
  });
}

export function usePulseConnectionInterest(targetProfileId?: string, profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id) && Boolean(targetProfileId) && profile?.id !== targetProfileId,
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_connections')
        .select('id, requester_profile_id, target_profile_id, connection_type, message, created_at')
        .eq('requester_profile_id', profile?.id)
        .eq('target_profile_id', targetProfileId)
        .eq('connection_type', 'connect_interest')
        .maybeSingle();

      if (error) throw error;
      return data as PulseConnection | null;
    },
    queryKey: ['pulse-connection-interest', profile?.id, targetProfileId],
    staleTime: 15_000
  });
}

export function useTogglePulseConnectionInterest(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ connectionId, targetProfileId }: { connectionId?: string; targetProfileId: string }) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before connecting with peers.');
      if (profile.id === targetProfileId) throw new Error('You are already viewing your own profile.');
      const supabase = requireSupabase();

      if (connectionId) {
        const { error } = await supabase
          .from('pulse_connections')
          .delete()
          .eq('id', connectionId)
          .eq('requester_profile_id', profile.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('pulse_connections').insert({
        connection_type: 'connect_interest',
        requester_profile_id: profile.id,
        target_profile_id: targetProfileId
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-connection-interest'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-notifications-unread'] });
    }
  });
}

export function usePulseNotifications(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_notifications')
        .select('id, actor_profile_id, notification_type, title, body, link_path, read_at, metadata, created_at, actor:pulse_profiles!pulse_notifications_actor_profile_id_fkey(id, display_name, headline, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) throw error;
      return (data ?? []).map((row) => mapNotification(row));
    },
    queryKey: ['pulse-notifications', profile?.id],
    refetchInterval: 30_000,
    staleTime: 10_000
  });
}

export function usePulseUnreadNotificationCount(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { count, error } = await supabase
        .from('pulse_notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);

      if (error) throw error;
      return count ?? 0;
    },
    queryKey: ['pulse-notifications-unread', profile?.id],
    refetchInterval: 30_000,
    staleTime: 10_000
  });
}

export function useMarkPulseNotificationsRead(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds?: string[]) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before updating notifications.');
      const supabase = requireSupabase();
      let query = supabase
        .from('pulse_notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);

      if (notificationIds?.length) {
        query = query.in('id', notificationIds);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-notifications-unread'] });
    }
  });
}

export function usePulseOpportunityApplications(profile?: PulseProfile | null) {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated' && Boolean(profile?.id),
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from('pulse_opportunity_applications')
        .select('id, opportunity_id, profile_id, status, note, resume_url, portfolio_url, linkedin_url, answers, applied_at, created_at, updated_at, opportunity:pulse_opportunities!pulse_opportunity_applications_opportunity_id_fkey(id, title, company_name, opportunity_type, closes_at)')
        .eq('profile_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapOpportunityApplication(row));
    },
    queryKey: ['pulse-opportunity-applications', profile?.id],
    staleTime: 20_000
  });
}

export function useMarkPulseOpportunityInterest(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId }: { opportunityId: string }) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before showing interest.');
      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_opportunity_applications')
        .upsert(
          {
            opportunity_id: opportunityId,
            profile_id: profile.id,
            status: 'interested'
          },
          { onConflict: 'opportunity_id,profile_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-opportunity-applications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}

export function useApplyPulseOpportunity(profile?: PulseProfile | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseOpportunityApplicationInput) => {
      if (!profile?.id) throw new Error('Create your Pulse profile before applying.');
      const note = input.note.trim();
      if (note.length < 20) throw new Error('Add a short note of at least 20 characters before applying.');

      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_opportunity_applications')
        .upsert(
          {
            answers: input.answers ?? {},
            applied_at: new Date().toISOString(),
            linkedin_url: input.linkedinUrl?.trim() || null,
            note,
            opportunity_id: input.opportunityId,
            portfolio_url: input.portfolioUrl?.trim() || null,
            profile_id: profile.id,
            resume_url: input.resumeUrl?.trim() || null,
            status: 'applied'
          },
          { onConflict: 'opportunity_id,profile_id' }
        );

      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-opportunity-applications'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-opportunity-detail', profile?.id, profile?.college_id, input.opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-leaderboard'] });
    }
  });
}
