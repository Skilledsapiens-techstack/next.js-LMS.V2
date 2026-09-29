import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { getSupabaseClient } from '../../lib/supabaseClient';
import type {
  PulseCollege,
  PulseClub,
  PulseClubMembership,
  PulseClubPost,
  PulseComment,
  PulseConnection,
  PulseMentorshipRsvp,
  PulseMentorshipSession,
  PulseMentorshipSessionStatus,
  PulseOpportunityApplication,
  PulsePost,
  PulseProfile
} from './usePulseCommunity';

export type AdminPulseReport = {
  comment?: Pick<PulseComment, 'anonymous' | 'body' | 'id' | 'post_id'> & {
    author?: Pick<PulseProfile, 'display_name' | 'id'> | null;
  } | null;
  created_at: string;
  details?: string | null;
  id: string;
  post?: Pick<PulsePost, 'id' | 'title' | 'visibility'> | null;
  reason: string;
  reporter?: Pick<PulseProfile, 'display_name' | 'id'> | null;
  resolution_note?: string | null;
  reviewed_at?: string | null;
  reviewed_by_auth_user_id?: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
};

export type AdminPulseOpportunity = {
  club?: Pick<PulseClub, 'college_id' | 'id' | 'name' | 'slug'> | null;
  club_id?: string | null;
  closes_at?: string | null;
  company_name?: string | null;
  created_at: string;
  description: string;
  detail_description?: string | null;
  id: string;
  opportunity_type: 'live_project' | 'freelance' | 'challenge' | 'resume_review' | 'event';
  status: 'draft' | 'active' | 'paused' | 'closed' | 'archived';
  title: string;
  visibility: 'global' | 'college';
};

export type AdminPulseOpportunityApplication = PulseOpportunityApplication & {
  opportunity?: Pick<AdminPulseOpportunity, 'company_name' | 'id' | 'title'> | null;
  profile?: Pick<PulseProfile, 'college' | 'display_name' | 'headline' | 'id'> | null;
};

export type AdminPulseMentorshipSession = PulseMentorshipSession & {
  host?: Pick<PulseProfile, 'college' | 'display_name' | 'headline' | 'id'> | null;
};

export type AdminPulseMentorshipRsvp = PulseMentorshipRsvp & {
  profile?: Pick<PulseProfile, 'college' | 'display_name' | 'headline' | 'id'> | null;
  session?: Pick<AdminPulseMentorshipSession, 'id' | 'title'> | null;
};

export type AdminPulseConnection = PulseConnection & {
  requester?: Pick<PulseProfile, 'college' | 'display_name' | 'headline' | 'id'> | null;
  target?: Pick<PulseProfile, 'college' | 'display_name' | 'headline' | 'id'> | null;
};

export type AdminPulseCollege = PulseCollege & {
  status: 'active' | 'paused' | 'archived';
};

export type AdminPulseClub = PulseClub;

export type AdminPulseClubMembership = PulseClubMembership & {
  club?: Pick<PulseClub, 'college_id' | 'id' | 'name' | 'slug'> | null;
  profile?: Pick<PulseProfile, 'college' | 'display_name' | 'headline' | 'id'> | null;
};

export type AdminPulseClubPost = PulseClubPost & {
  club?: (Pick<PulseClub, 'college' | 'college_id' | 'id' | 'name' | 'slug'>) | null;
};

export type AdminPulseData = {
  applications: AdminPulseOpportunityApplication[];
  clubMemberships: AdminPulseClubMembership[];
  clubPosts: AdminPulseClubPost[];
  clubs: AdminPulseClub[];
  colleges: AdminPulseCollege[];
  connections: AdminPulseConnection[];
  mentorshipRsvps: AdminPulseMentorshipRsvp[];
  mentorshipSessions: AdminPulseMentorshipSession[];
  opportunities: AdminPulseOpportunity[];
  posts: PulsePost[];
  profiles: PulseProfile[];
  reports: AdminPulseReport[];
};

export type PulseCollegeInput = {
  city?: string;
  name: string;
  slug?: string;
  state?: string;
};

export type PulseOpportunityInput = {
  clubId?: string;
  closesAt?: string;
  companyName?: string;
  description: string;
  detailDescription?: string;
  opportunityType: AdminPulseOpportunity['opportunity_type'];
  title: string;
  visibility: AdminPulseOpportunity['visibility'];
};

export type PulseClubInput = {
  category: AdminPulseClub['category'];
  collegeId: string;
  contactEmail?: string;
  coverColor: AdminPulseClub['cover_color'];
  description?: string;
  externalUrl?: string;
  focusTags: string[];
  name: string;
  slug?: string;
  summary: string;
};

export type PulseClubMembershipInput = {
  clubId: string;
  profileId: string;
  role: AdminPulseClubMembership['role'];
  title?: string;
};

function requireSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Pulse admin is not connected to Supabase in this environment.');
  }
  return supabase;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function asArray<T>(data: T[] | null) {
  return data ?? [];
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapAdminProfile(row: Record<string, unknown>): PulseProfile {
  return {
    avatar_url: row.avatar_url as string | null | undefined,
    bio: row.bio as string | null | undefined,
    college: firstRelation(row.college as PulseProfile['college'] | PulseProfile['college'][]),
    college_id: row.college_id as string | null | undefined,
    created_at: row.created_at as string | undefined,
    display_name: String(row.display_name ?? ''),
    headline: row.headline as string | null | undefined,
    id: String(row.id),
    interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
    profile_visibility: (row.profile_visibility as PulseProfile['profile_visibility']) ?? 'college',
    pulse_status: (row.pulse_status as PulseProfile['pulse_status']) ?? 'active',
    referral_code: String(row.referral_code ?? ''),
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    student_id: row.student_id as string | null | undefined
  };
}

function mapAdminPost(row: Record<string, unknown>): PulsePost {
  return {
    anonymous: Boolean(row.anonymous),
    author: firstRelation(row.author as PulsePost['author'] | PulsePost['author'][]),
    author_profile_id: String(row.author_profile_id ?? ''),
    body: String(row.body ?? ''),
    college: firstRelation(row.college as PulsePost['college'] | PulsePost['college'][]),
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

function mapAdminReport(row: Record<string, unknown>): AdminPulseReport {
  return {
    comment: firstRelation(row.comment as AdminPulseReport['comment'] | AdminPulseReport['comment'][]),
    created_at: String(row.created_at ?? ''),
    details: row.details as string | null | undefined,
    id: String(row.id),
    post: firstRelation(row.post as AdminPulseReport['post'] | AdminPulseReport['post'][]),
    reason: String(row.reason ?? ''),
    reporter: firstRelation(row.reporter as AdminPulseReport['reporter'] | AdminPulseReport['reporter'][]),
    resolution_note: row.resolution_note as string | null | undefined,
    reviewed_at: row.reviewed_at as string | null | undefined,
    reviewed_by_auth_user_id: row.reviewed_by_auth_user_id as string | null | undefined,
    status: (row.status as AdminPulseReport['status']) ?? 'open'
  };
}

function mapAdminOpportunity(row: Record<string, unknown>): AdminPulseOpportunity {
  return {
    closes_at: row.closes_at as string | null | undefined,
    club: firstRelation(row.club as AdminPulseOpportunity['club'] | AdminPulseOpportunity['club'][]),
    club_id: row.club_id as string | null | undefined,
    company_name: row.company_name as string | null | undefined,
    created_at: String(row.created_at ?? ''),
    description: String(row.description ?? ''),
    detail_description: row.detail_description as string | null | undefined,
    id: String(row.id),
    opportunity_type: (row.opportunity_type as AdminPulseOpportunity['opportunity_type']) ?? 'live_project',
    status: (row.status as AdminPulseOpportunity['status']) ?? 'active',
    title: String(row.title ?? ''),
    visibility: (row.visibility as AdminPulseOpportunity['visibility']) ?? 'global'
  };
}

function mapAdminOpportunityApplication(row: Record<string, unknown>): AdminPulseOpportunityApplication {
  return {
    answers: (row.answers as Record<string, unknown> | null | undefined) ?? {},
    applied_at: row.applied_at as string | null | undefined,
    created_at: String(row.created_at ?? ''),
    id: String(row.id),
    linkedin_url: row.linkedin_url as string | null | undefined,
    note: row.note as string | null | undefined,
    opportunity: firstRelation(row.opportunity as AdminPulseOpportunityApplication['opportunity'] | AdminPulseOpportunityApplication['opportunity'][]),
    opportunity_id: String(row.opportunity_id ?? ''),
    portfolio_url: row.portfolio_url as string | null | undefined,
    profile: firstRelation(row.profile as AdminPulseOpportunityApplication['profile'] | AdminPulseOpportunityApplication['profile'][]),
    profile_id: String(row.profile_id ?? ''),
    resume_url: row.resume_url as string | null | undefined,
    status: (row.status as AdminPulseOpportunityApplication['status']) ?? 'interested'
  };
}

function mapAdminClub(row: Record<string, unknown>): AdminPulseClub {
  return {
    category: (row.category as AdminPulseClub['category']) ?? 'domain',
    college: firstRelation(row.college as AdminPulseClub['college'] | AdminPulseClub['college'][]),
    college_id: String(row.college_id ?? ''),
    contact_email: row.contact_email as string | null | undefined,
    cover_color: (row.cover_color as AdminPulseClub['cover_color']) ?? 'red',
    created_at: String(row.created_at ?? ''),
    description: row.description as string | null | undefined,
    external_url: row.external_url as string | null | undefined,
    focus_tags: Array.isArray(row.focus_tags) ? row.focus_tags.map(String) : [],
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    status: (row.status as AdminPulseClub['status']) ?? 'active',
    summary: String(row.summary ?? '')
  };
}

function mapAdminClubMembership(row: Record<string, unknown>): AdminPulseClubMembership {
  return {
    club: firstRelation(row.club as AdminPulseClubMembership['club'] | AdminPulseClubMembership['club'][]),
    club_id: String(row.club_id ?? ''),
    id: String(row.id),
    profile: firstRelation(row.profile as AdminPulseClubMembership['profile'] | AdminPulseClubMembership['profile'][]),
    profile_id: String(row.profile_id ?? ''),
    role: (row.role as AdminPulseClubMembership['role']) ?? 'member',
    status: (row.status as AdminPulseClubMembership['status']) ?? 'active',
    title: row.title as string | null | undefined
  };
}

function mapAdminClubPost(row: Record<string, unknown>): AdminPulseClubPost {
  return {
    author: firstRelation(row.author as AdminPulseClubPost['author'] | AdminPulseClubPost['author'][]),
    author_profile_id: String(row.author_profile_id ?? ''),
    body: String(row.body ?? ''),
    club: firstRelation(row.club as AdminPulseClubPost['club'] | AdminPulseClubPost['club'][]),
    club_id: String(row.club_id ?? ''),
    created_at: String(row.created_at ?? ''),
    id: String(row.id),
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? {},
    pinned: Boolean(row.pinned),
    post_id: row.post_id as string | null | undefined,
    post_type: (row.post_type as AdminPulseClubPost['post_type']) ?? 'announcement',
    status: (row.status as AdminPulseClubPost['status']) ?? 'published',
    title: String(row.title ?? '')
  };
}

function mapAdminConnection(row: Record<string, unknown>): AdminPulseConnection {
  return {
    connection_type: (row.connection_type as AdminPulseConnection['connection_type']) ?? 'connect_interest',
    created_at: String(row.created_at ?? ''),
    id: String(row.id),
    message: row.message as string | null | undefined,
    requester: firstRelation(row.requester as AdminPulseConnection['requester'] | AdminPulseConnection['requester'][]),
    requester_profile_id: String(row.requester_profile_id ?? ''),
    target: firstRelation(row.target as AdminPulseConnection['target'] | AdminPulseConnection['target'][]),
    target_profile_id: String(row.target_profile_id ?? '')
  };
}

function mapAdminMentorshipSession(row: Record<string, unknown>): AdminPulseMentorshipSession {
  const host = firstRelation(row.host as AdminPulseMentorshipSession['host'] | AdminPulseMentorshipSession['host'][]);

  return {
    college_id: row.college_id as string | null | undefined,
    college_name: host?.college?.name ?? '',
    created_at: String(row.created_at ?? ''),
    description: String(row.description ?? ''),
    ends_at: row.ends_at as string | null | undefined,
    host,
    host_display_name: host?.display_name ?? 'Pulse mentor',
    host_headline: host?.headline ?? null,
    host_profile_id: String(row.host_profile_id ?? ''),
    id: String(row.id),
    max_seats: Number(row.max_seats ?? 0) || null,
    meeting_platform: (row.meeting_platform as AdminPulseMentorshipSession['meeting_platform']) ?? 'google_meet',
    meeting_url: row.meeting_url as string | null | undefined,
    rsvp_count: Number(row.rsvp_count ?? 0),
    session_type: (row.session_type as AdminPulseMentorshipSession['session_type']) ?? 'workshop',
    starts_at: String(row.starts_at ?? ''),
    status: (row.status as AdminPulseMentorshipSession['status']) ?? 'submitted',
    title: String(row.title ?? ''),
    topic: String(row.topic ?? ''),
    visibility: (row.visibility as AdminPulseMentorshipSession['visibility']) ?? 'global'
  };
}

function mapAdminMentorshipRsvp(row: Record<string, unknown>): AdminPulseMentorshipRsvp {
  return {
    created_at: String(row.created_at ?? ''),
    id: String(row.id),
    note: row.note as string | null | undefined,
    profile: firstRelation(row.profile as AdminPulseMentorshipRsvp['profile'] | AdminPulseMentorshipRsvp['profile'][]),
    profile_id: String(row.profile_id ?? ''),
    session: firstRelation(row.session as AdminPulseMentorshipRsvp['session'] | AdminPulseMentorshipRsvp['session'][]),
    session_id: String(row.session_id ?? ''),
    status: (row.status as AdminPulseMentorshipRsvp['status']) ?? 'rsvped'
  };
}

export function useAdminPulseData() {
  const { status } = useAuth();

  return useQuery({
    enabled: status === 'authenticated',
    queryFn: async (): Promise<AdminPulseData> => {
      const supabase = requireSupabase();
      const [colleges, profiles, clubs, clubMemberships, clubPosts, posts, reports, opportunities, applications, connections, mentorshipSessions, mentorshipRsvps] = await Promise.all([
        supabase.from('pulse_colleges').select('id, name, city, state, country, status').order('name', { ascending: true }),
        supabase
          .from('pulse_profiles')
          .select('id, display_name, headline, bio, avatar_url, skills, interests, profile_visibility, pulse_status, referral_code, student_id, college_id, created_at, college:pulse_colleges(id, name, city, state, country)')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('pulse_clubs')
          .select('id, college_id, name, slug, category, summary, description, focus_tags, cover_color, contact_email, external_url, status, created_at, college:pulse_colleges(id, name)')
          .order('name', { ascending: true })
          .limit(500),
        supabase
          .from('pulse_club_members')
          .select('id, club_id, profile_id, role, title, status, club:pulse_clubs(id, college_id, name, slug), profile:pulse_profiles(id, display_name, headline, college:pulse_colleges(id, name))')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('pulse_club_posts')
          .select('id, club_id, author_profile_id, post_id, post_type, title, body, status, pinned, metadata, moderated_at, moderated_by_auth_user_id, created_at, author:pulse_profiles(id, display_name, headline, avatar_url), club:pulse_clubs(id, college_id, name, slug, college:pulse_colleges(id, name))')
          .order('created_at', { ascending: false })
          .limit(160),
        supabase
          .from('pulse_posts')
          .select('id, author_profile_id, title, body, post_type, visibility, anonymous, pinned, status, created_at, college_id, author:pulse_profiles(id, display_name, headline, avatar_url), college:pulse_colleges(id, name)')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('pulse_reports')
          .select('id, reason, details, status, resolution_note, reviewed_at, reviewed_by_auth_user_id, created_at, reporter:pulse_profiles(id, display_name), post:pulse_posts(id, title, visibility), comment:pulse_comments(id, body, anonymous, post_id, author:pulse_profiles(id, display_name))')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('pulse_opportunities')
          .select('id, title, company_name, opportunity_type, description, detail_description, visibility, status, closes_at, created_at, club_id, club:pulse_clubs(id, college_id, name, slug)')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('pulse_opportunity_applications')
          .select('id, opportunity_id, profile_id, status, note, resume_url, portfolio_url, linkedin_url, answers, applied_at, created_at, opportunity:pulse_opportunities(id, title, company_name), profile:pulse_profiles(id, display_name, headline, college:pulse_colleges(id, name))')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('pulse_connections')
          .select('id, requester_profile_id, target_profile_id, connection_type, message, created_at, requester:pulse_profiles!pulse_connections_requester_profile_id_fkey(id, display_name, headline, college:pulse_colleges(id, name)), target:pulse_profiles!pulse_connections_target_profile_id_fkey(id, display_name, headline, college:pulse_colleges(id, name))')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('pulse_mentorship_sessions')
          .select('id, host_profile_id, college_id, title, session_type, topic, description, visibility, status, starts_at, ends_at, max_seats, meeting_platform, created_at, host:pulse_profiles!pulse_mentorship_sessions_host_profile_id_fkey(id, display_name, headline, college:pulse_colleges(id, name))')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('pulse_mentorship_rsvps')
          .select('id, session_id, profile_id, status, note, created_at, session:pulse_mentorship_sessions(id, title), profile:pulse_profiles(id, display_name, headline, college:pulse_colleges(id, name))')
          .order('created_at', { ascending: false })
          .limit(80)
      ]);

      const firstError = [
        colleges.error,
        profiles.error,
        clubs.error,
        clubMemberships.error,
        clubPosts.error,
        posts.error,
        reports.error,
        opportunities.error,
        applications.error,
        connections.error,
        mentorshipSessions.error,
        mentorshipRsvps.error
      ].find(Boolean);
      if (firstError) throw firstError;

      return {
        applications: asArray(applications.data).map((row) => mapAdminOpportunityApplication(row)),
        clubMemberships: asArray(clubMemberships.data).map((row) => mapAdminClubMembership(row)),
        clubPosts: asArray(clubPosts.data).map((row) => mapAdminClubPost(row)),
        clubs: asArray(clubs.data).map((row) => mapAdminClub(row)),
        colleges: asArray(colleges.data) as AdminPulseCollege[],
        connections: asArray(connections.data).map((row) => mapAdminConnection(row)),
        mentorshipRsvps: asArray(mentorshipRsvps.data).map((row) => mapAdminMentorshipRsvp(row)),
        mentorshipSessions: asArray(mentorshipSessions.data).map((row) => mapAdminMentorshipSession(row)),
        opportunities: asArray(opportunities.data).map((row) => mapAdminOpportunity(row)),
        posts: asArray(posts.data).map((row) => mapAdminPost(row)),
        profiles: asArray(profiles.data).map((row) => mapAdminProfile(row)),
        reports: asArray(reports.data).map((row) => mapAdminReport(row))
      };
    },
    queryKey: ['admin-pulse-data'],
    staleTime: 20_000
  });
}

export function useCreatePulseClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseClubInput) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_clubs').insert({
        category: input.category,
        college_id: input.collegeId,
        contact_email: input.contactEmail?.trim() || null,
        cover_color: input.coverColor,
        description: input.description?.trim() || null,
        external_url: input.externalUrl?.trim() || null,
        focus_tags: input.focusTags.map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
        name: input.name.trim(),
        slug: input.slug?.trim() || slugify(input.name),
        status: 'active',
        summary: input.summary.trim()
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-college-clubs'] });
    }
  });
}

export function useUpdatePulseClubStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clubId, status }: { clubId: string; status: AdminPulseClub['status'] }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_clubs').update({ status }).eq('id', clubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-college-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-detail'] });
    }
  });
}

export function useUpsertPulseClubMembership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseClubMembershipInput) => {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_club_members')
        .upsert(
          {
            club_id: input.clubId,
            profile_id: input.profileId,
            role: input.role,
            status: 'active',
            title: input.title?.trim() || null
          },
          { onConflict: 'club_id,profile_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-memberships'] });
    }
  });
}

export function useUpdatePulseClubMembershipStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ membershipId, status }: { membershipId: string; status: AdminPulseClubMembership['status'] }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_club_members').update({ status }).eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-memberships'] });
    }
  });
}

export function useCreatePulseCollege() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseCollegeInput) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_colleges').insert({
        city: input.city?.trim() || null,
        name: input.name.trim(),
        slug: input.slug?.trim() || slugify(input.name),
        state: input.state?.trim() || null,
        status: 'active'
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] })
  });
}

export function useUpdatePulseCollegeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ collegeId, status }: { collegeId: string; status: 'active' | 'paused' | 'archived' }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_colleges').update({ status }).eq('id', collegeId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] })
  });
}

export function useUpdatePulsePostStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, status }: { postId: string; status: 'published' | 'hidden' | 'archived' | 'under_review' }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_posts').update({ status }).eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] })
  });
}

export function useUpdatePulseClubPostStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, status }: { postId: string; status: AdminPulseClubPost['status'] }) => {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_club_posts')
        .update({
          moderated_at: new Date().toISOString(),
          moderated_by_auth_user_id: session?.user.id ?? null,
          status
        })
        .eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-club-posts'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-college-club-posts'] });
    }
  });
}

export function useUpdatePulseReportStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      resolutionNote,
      status
    }: {
      reportId: string;
      resolutionNote?: string;
      status: AdminPulseReport['status'];
    }) => {
      const supabase = requireSupabase();
      const updates: {
        resolution_note?: string | null;
        reviewed_at: string;
        reviewed_by_auth_user_id: string | null;
        status: AdminPulseReport['status'];
      } = {
        reviewed_at: new Date().toISOString(),
        reviewed_by_auth_user_id: session?.user.id ?? null,
        status
      };
      if (typeof resolutionNote === 'string') {
        updates.resolution_note = resolutionNote.trim() || null;
      }
      const { error } = await supabase
        .from('pulse_reports')
        .update(updates)
        .eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] })
  });
}

export function useCreatePulseOpportunity() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PulseOpportunityInput) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_opportunities').insert({
        closes_at: input.closesAt || null,
        club_id: input.clubId || null,
        company_name: input.companyName?.trim() || null,
        created_by_auth_user_id: session?.user.id ?? null,
        description: input.description.trim(),
        detail_description: input.detailDescription?.trim() || null,
        opportunity_type: input.opportunityType,
        status: 'active',
        title: input.title.trim(),
        visibility: input.visibility
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] })
  });
}

export function useUpdatePulseOpportunityApplicationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      status
    }: {
      applicationId: string;
      status: AdminPulseOpportunityApplication['status'];
    }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_opportunity_applications').update({ status }).eq('id', applicationId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] })
  });
}

export function useUpdatePulseMentorshipSessionStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      status
    }: {
      sessionId: string;
      status: PulseMentorshipSessionStatus;
    }) => {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from('pulse_mentorship_sessions')
        .update({
          reviewed_at: new Date().toISOString(),
          reviewed_by_auth_user_id: session?.user.id ?? null,
          status
        })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-mentorship-sessions'] });
    }
  });
}

export function useUpdatePulseMentorshipRsvpStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rsvpId,
      status
    }: {
      rsvpId: string;
      status: AdminPulseMentorshipRsvp['status'];
    }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from('pulse_mentorship_rsvps').update({ status }).eq('id', rsvpId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pulse-data'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-mentorship-rsvps'] });
      queryClient.invalidateQueries({ queryKey: ['pulse-mentorship-sessions'] });
    }
  });
}
