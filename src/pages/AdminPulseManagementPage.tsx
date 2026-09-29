import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Flag,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  PauseCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Tags,
  UserRoundCheck
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { RichTextEditor } from '../components/RichTextEditor';
import {
  AdminPulseClubPost,
  AdminPulseMentorshipSession,
  AdminPulseOpportunity,
  useCreatePulseClub,
  useAdminPulseData,
  useCreatePulseCollege,
  useCreatePulseOpportunity,
  useUpdatePulseClubMembershipStatus,
  useUpdatePulseClubPostStatus,
  useUpdatePulseClubStatus,
  useUpdatePulseCollegeStatus,
  useUpdatePulseMentorshipRsvpStatus,
  useUpdatePulseMentorshipSessionStatus,
  useUpdatePulseOpportunityApplicationStatus,
  useUpdatePulsePostStatus,
  useUpdatePulseReportStatus,
  useUpsertPulseClubMembership
} from '../pulse/features/useAdminPulse';
import '../pulse/styles/pulseAdmin.css';

type AdminPulseTab = 'overview' | 'colleges' | 'clubs' | 'profiles' | 'moderation' | 'opportunities' | 'mentorship';

const tabs: Array<{ description: string; icon: typeof MessageCircle; id: AdminPulseTab; label: string; path: string }> = [
  { description: 'Pulse health, pending work, and operating areas.', icon: LayoutDashboard, id: 'overview', label: 'Overview', path: '/admin/pulse' },
  { description: 'Create, pause, and archive college spaces.', icon: Building2, id: 'colleges', label: 'College Spaces', path: '/admin/pulse/colleges' },
  { description: 'Create college clubs, committees, and assign club admins.', icon: Tags, id: 'clubs', label: 'Clubs & Committees', path: '/admin/pulse/clubs' },
  { description: 'Student profiles, referral codes, and interest signals.', icon: UserRoundCheck, id: 'profiles', label: 'Profiles & Referrals', path: '/admin/pulse/profiles' },
  { description: 'Posts, reports, and safety review workflow.', icon: Flag, id: 'moderation', label: 'Feed & Moderation', path: '/admin/pulse/moderation' },
  { description: 'Opportunity drops, applicants, and selection status.', icon: BriefcaseBusiness, id: 'opportunities', label: 'Opportunities', path: '/admin/pulse/opportunities' },
  { description: 'Mentorship session approvals, RSVPs, and attendance.', icon: GraduationCap, id: 'mentorship', label: 'Mentorship', path: '/admin/pulse/mentorship' }
];

const opportunityLabels: Record<AdminPulseOpportunity['opportunity_type'], string> = {
  challenge: 'Challenge',
  event: 'Event',
  freelance: 'Freelance',
  live_project: 'Live Project',
  resume_review: 'Resume Review'
};

const reportReasonLabels: Record<string, string> = {
  abuse: 'Abusive content',
  fake_info: 'False or misleading information',
  harassment: 'Harassment or bullying',
  other: 'Other concern',
  sensitive: 'Sensitive personal information',
  spam: 'Spam or promotion'
};

const opportunityApplicationLabels: Record<string, string> = {
  applied: 'Applied',
  interested: 'Interested',
  rejected: 'Rejected',
  selected: 'Selected',
  shortlisted: 'Shortlisted',
  withdrawn: 'Withdrawn'
};

const mentorshipLabels: Record<AdminPulseMentorshipSession['session_type'], string> = {
  ama: 'AMA',
  career_session: 'Career Session',
  one_on_one: '1-1 Mentoring',
  resume_review: 'Resume Review',
  workshop: 'Workshop'
};

const postStatusFilters = ['all', 'published', 'under_review', 'hidden', 'archived'] as const;
const reportStatusFilters = ['all', 'open', 'reviewing', 'resolved', 'dismissed'] as const;
const clubPostStatusFilters: Array<'all' | AdminPulseClubPost['status']> = ['all', 'published', 'under_review', 'hidden', 'archived'];

const clubCategoryOptions = [
  { label: 'Domain club', value: 'domain' },
  { label: 'Placement', value: 'placement' },
  { label: 'Entrepreneurship', value: 'entrepreneurship' },
  { label: 'Operations', value: 'operations' },
  { label: 'Culture', value: 'culture' },
  { label: 'Sports', value: 'sports' },
  { label: 'Committee', value: 'committee' },
  { label: 'Other', value: 'other' }
] as const;

const clubColorOptions = [
  { label: 'Marketing red', value: 'marketing' },
  { label: 'Finance green', value: 'finance' },
  { label: 'Consulting gold', value: 'consulting' },
  { label: 'Product blue', value: 'product' },
  { label: 'HR rose', value: 'hr' },
  { label: 'Analytics indigo', value: 'analytics' },
  { label: 'Startup yellow', value: 'startup' },
  { label: 'Operations teal', value: 'operations' },
  { label: 'Pulse red', value: 'red' }
] as const;

function formatDate(value?: string | null) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  }).format(new Date(value));
}

function reportTitle(report: { comment?: { body?: string } | null; post?: { title: string } | null }) {
  if (report.post?.title) return report.post.title;
  if (report.comment?.body) return `Comment: ${report.comment.body}`;
  return 'Reported content';
}

function reportContentType(report: { comment?: unknown; post?: unknown }) {
  if (report.comment) return 'Comment report';
  if (report.post) return 'Post report';
  return 'Content report';
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (['active', 'published', 'resolved'].includes(status)) return 'admin-pulse-pill--success';
  if (['hidden', 'under_review', 'reviewing', 'paused'].includes(status)) return 'admin-pulse-pill--warning';
  return 'admin-pulse-pill--muted';
}

type AdminPulseManagementPageProps = {
  activeTab?: AdminPulseTab;
};

export function AdminPulseManagementPage({ activeTab = 'overview' }: AdminPulseManagementPageProps) {
  const pulseQuery = useAdminPulseData();
  const createCollege = useCreatePulseCollege();
  const updateCollegeStatus = useUpdatePulseCollegeStatus();
  const updatePostStatus = useUpdatePulsePostStatus();
  const updateClubPostStatus = useUpdatePulseClubPostStatus();
  const updateReportStatus = useUpdatePulseReportStatus();
  const updateApplicationStatus = useUpdatePulseOpportunityApplicationStatus();
  const updateMentorshipStatus = useUpdatePulseMentorshipSessionStatus();
  const updateMentorshipRsvpStatus = useUpdatePulseMentorshipRsvpStatus();
  const createClub = useCreatePulseClub();
  const createOpportunity = useCreatePulseOpportunity();
  const updateClubStatus = useUpdatePulseClubStatus();
  const upsertClubMembership = useUpsertPulseClubMembership();
  const updateClubMembershipStatus = useUpdatePulseClubMembershipStatus();
  const data = pulseQuery.data;
  const activeModule = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const [postStatusFilter, setPostStatusFilter] = useState<(typeof postStatusFilters)[number]>('all');
  const [postTypeFilter, setPostTypeFilter] = useState('all');
  const [clubPostStatusFilter, setClubPostStatusFilter] = useState<(typeof clubPostStatusFilters)[number]>('all');
  const [clubPostTypeFilter, setClubPostTypeFilter] = useState('all');
  const [clubPostCollegeFilter, setClubPostCollegeFilter] = useState('all');
  const [clubPostClubFilter, setClubPostClubFilter] = useState('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<(typeof reportStatusFilters)[number]>('all');
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [selectedClubCollegeId, setSelectedClubCollegeId] = useState('');

  const [collegeForm, setCollegeForm] = useState({ city: '', name: '', state: '' });
  const [clubForm, setClubForm] = useState({
    category: 'domain' as (typeof clubCategoryOptions)[number]['value'],
    collegeId: '',
    contactEmail: '',
    coverColor: 'red' as (typeof clubColorOptions)[number]['value'],
    description: '',
    externalUrl: '',
    focusTags: '',
    name: '',
    summary: ''
  });
  const [clubAdminForm, setClubAdminForm] = useState({
    clubId: '',
    profileId: '',
    role: 'admin' as 'admin' | 'moderator' | 'member',
    title: ''
  });
  const [opportunityForm, setOpportunityForm] = useState({
    clubId: '',
    closesAt: '',
    companyName: '',
    description: '',
    detailDescription: '',
    opportunityType: 'live_project' as AdminPulseOpportunity['opportunity_type'],
    title: '',
    visibility: 'global' as AdminPulseOpportunity['visibility']
  });

  const summary = useMemo(() => {
    const posts = data?.posts ?? [];
    const reports = data?.reports ?? [];
    const applications = data?.applications ?? [];
    const connections = data?.connections ?? [];
    const mentorshipSessions = data?.mentorshipSessions ?? [];
    return [
      { icon: Building2, label: 'College Spaces', value: String(data?.colleges.length ?? 0), detail: 'Active, paused, and archived spaces' },
      { icon: Tags, label: 'Club Workspaces', value: String(data?.clubs.length ?? 0), detail: 'College clubs and committees' },
      { icon: UserRoundCheck, label: 'Pulse Profiles', value: String(data?.profiles.length ?? 0), detail: 'Students with referral codes' },
      { icon: MessageCircle, label: 'Published Posts', value: String(posts.filter((post) => post.status !== 'archived').length), detail: 'Across campus and college feeds' },
      { icon: Sparkles, label: 'Student Interest', value: String(connections.length), detail: 'Peer collaboration signals' },
      { icon: BriefcaseBusiness, label: 'Opportunity Interest', value: String(applications.length), detail: 'Students tracking live drops' },
      { icon: GraduationCap, label: 'Mentorship Sessions', value: String(mentorshipSessions.length), detail: 'Free community sessions' },
      { icon: Flag, label: 'Open Reports', value: String(reports.filter((report) => report.status === 'open' || report.status === 'reviewing').length), detail: 'Needs admin review' }
    ];
  }, [data]);

  const openReports = useMemo(
    () => (data?.reports ?? []).filter((report) => report.status === 'open' || report.status === 'reviewing'),
    [data?.reports]
  );
  const pendingApplications = useMemo(
    () => (data?.applications ?? []).filter((application) => application.status === 'interested' || application.status === 'applied' || application.status === 'shortlisted'),
    [data?.applications]
  );
  const pendingMentorshipSessions = useMemo(
    () => (data?.mentorshipSessions ?? []).filter((session) => session.status === 'submitted' || session.status === 'approved'),
    [data?.mentorshipSessions]
  );
  const recentProfiles = useMemo(
    () =>
      [...(data?.profiles ?? [])]
        .sort((left, right) => new Date(right.created_at ?? '').getTime() - new Date(left.created_at ?? '').getTime())
        .slice(0, 5),
    [data?.profiles]
  );

  const postTypeOptions = useMemo(() => {
    const types = new Set((data?.posts ?? []).map((post) => post.post_type));
    return Array.from(types).sort();
  }, [data?.posts]);
  const clubPostTypeOptions = useMemo(() => {
    const types = new Set((data?.clubPosts ?? []).map((post) => post.post_type));
    return Array.from(types).sort();
  }, [data?.clubPosts]);

  const activeColleges = useMemo(() => (data?.colleges ?? []).filter((college) => college.status === 'active'), [data?.colleges]);
  const selectedCollegeId = selectedClubCollegeId || clubForm.collegeId || data?.colleges[0]?.id || '';
  const clubList = useMemo(
    () => (data?.clubs ?? []).filter((club) => !selectedCollegeId || club.college_id === selectedCollegeId),
    [data?.clubs, selectedCollegeId]
  );
  const clubMembersByClub = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['clubMemberships']>();
    (data?.clubMemberships ?? []).forEach((membership) => {
      const current = map.get(membership.club_id) ?? [];
      current.push(membership);
      map.set(membership.club_id, current);
    });
    return map;
  }, [data]);
  const selectedMembershipClub = (data?.clubs ?? []).find((club) => club.id === clubAdminForm.clubId);
  const eligibleClubProfiles = useMemo(
    () =>
      (data?.profiles ?? []).filter((profile) => {
        if (!selectedMembershipClub?.college_id) return true;
        return profile.college_id === selectedMembershipClub.college_id;
      }),
    [data?.profiles, selectedMembershipClub?.college_id]
  );

  const filteredPosts = useMemo(
    () =>
      (data?.posts ?? []).filter((post) => {
        const matchesStatus = postStatusFilter === 'all' || (post.status ?? 'published') === postStatusFilter;
        const matchesType = postTypeFilter === 'all' || post.post_type === postTypeFilter;
        return matchesStatus && matchesType;
      }),
    [data?.posts, postStatusFilter, postTypeFilter]
  );

  const filteredClubPosts = useMemo(
    () =>
      (data?.clubPosts ?? []).filter((post) => {
        const matchesStatus = clubPostStatusFilter === 'all' || post.status === clubPostStatusFilter;
        const matchesType = clubPostTypeFilter === 'all' || post.post_type === clubPostTypeFilter;
        const matchesCollege = clubPostCollegeFilter === 'all' || post.club?.college_id === clubPostCollegeFilter;
        const matchesClub = clubPostClubFilter === 'all' || post.club_id === clubPostClubFilter;
        return matchesStatus && matchesType && matchesCollege && matchesClub;
      }),
    [clubPostClubFilter, clubPostCollegeFilter, clubPostStatusFilter, clubPostTypeFilter, data?.clubPosts]
  );

  const filteredReports = useMemo(
    () => (data?.reports ?? []).filter((report) => reportStatusFilter === 'all' || report.status === reportStatusFilter),
    [data?.reports, reportStatusFilter]
  );

  const moderationStats = useMemo(() => {
    const posts = data?.posts ?? [];
    const reports = data?.reports ?? [];
    return [
      {
        detail: 'Needs first admin look',
        filter: 'open' as const,
        label: 'Open reports',
        value: reports.filter((report) => report.status === 'open').length
      },
      {
        detail: 'Being checked now',
        filter: 'reviewing' as const,
        label: 'In review',
        value: reports.filter((report) => report.status === 'reviewing').length
      },
      {
        detail: 'Posts held from feed',
        filter: 'under_review' as const,
        label: 'Posts under review',
        value: posts.filter((post) => post.status === 'under_review').length
      },
      {
        detail: 'Closed moderation cases',
        filter: 'resolved' as const,
        label: 'Resolved reports',
        value: reports.filter((report) => report.status === 'resolved').length
      }
    ];
  }, [data?.posts, data?.reports]);

  const applicationsByOpportunity = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['applications']>();
    (data?.applications ?? []).forEach((application) => {
      const current = map.get(application.opportunity_id) ?? [];
      current.push(application);
      map.set(application.opportunity_id, current);
    });
    return map;
  }, [data]);

  const mentorshipRsvpsBySession = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['mentorshipRsvps']>();
    (data?.mentorshipRsvps ?? []).forEach((rsvp) => {
      const current = map.get(rsvp.session_id) ?? [];
      current.push(rsvp);
      map.set(rsvp.session_id, current);
    });
    return map;
  }, [data]);

  function submitCollege(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createCollege.mutate(collegeForm, {
      onSuccess: () => setCollegeForm({ city: '', name: '', state: '' })
    });
  }

  function submitClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createClub.mutate(
      {
        category: clubForm.category,
        collegeId: clubForm.collegeId,
        contactEmail: clubForm.contactEmail,
        coverColor: clubForm.coverColor,
        description: clubForm.description,
        externalUrl: clubForm.externalUrl,
        focusTags: clubForm.focusTags.split(',').map((tag) => tag.trim()).filter(Boolean),
        name: clubForm.name,
        summary: clubForm.summary
      },
      {
        onSuccess: () => {
          setSelectedClubCollegeId(clubForm.collegeId);
          setClubForm({
            category: 'domain',
            collegeId: clubForm.collegeId,
            contactEmail: '',
            coverColor: 'red',
            description: '',
            externalUrl: '',
            focusTags: '',
            name: '',
            summary: ''
          });
        }
      }
    );
  }

  function submitClubAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    upsertClubMembership.mutate(clubAdminForm, {
      onSuccess: () => setClubAdminForm({ ...clubAdminForm, profileId: '', title: '' })
    });
  }

  function submitOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createOpportunity.mutate(opportunityForm, {
      onSuccess: () =>
        setOpportunityForm({
          closesAt: '',
          clubId: '',
          companyName: '',
          description: '',
          detailDescription: '',
          opportunityType: 'live_project',
          title: '',
          visibility: 'global'
        })
    });
  }

  return (
    <div className="page-stack admin-pulse-page">
      <PageHeader
        description={activeModule.description}
        eyebrow="Pulse Management"
        title={activeTab === 'overview' ? 'SapiensPulse Admin' : activeModule.label}
      />

      <section className="admin-pulse-live-shell">
        <nav className="admin-pulse-tabs" aria-label="Pulse management modules">
          {tabs.map((tab) => (
            <NavLink
              className={({ isActive }) => isActive ? 'is-active' : ''}
              key={tab.id}
              to={tab.path}
              end={tab.id === 'overview'}
            >
              <tab.icon size={16} />
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {pulseQuery.isLoading ? <div className="admin-pulse-state">Loading Pulse management data.</div> : null}
        {pulseQuery.error ? <div className="admin-pulse-state admin-pulse-state--error">{pulseQuery.error.message}</div> : null}

        {data && activeTab === 'overview' ? (
          <>
            <section className="admin-pulse-summary" aria-label="Pulse admin overview">
              {summary.map((item) => (
                <article key={item.label}>
                  <item.icon size={22} />
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </article>
              ))}
            </section>

            <section className="admin-pulse-grid" aria-label="Pulse operation modules">
              {tabs.filter((tab) => tab.id !== 'overview').map((tab) => (
                <NavLink className="admin-pulse-card admin-pulse-module-card" key={tab.id} to={tab.path}>
                  <span className="admin-pulse-card__icon"><tab.icon size={20} /></span>
                  <div>
                    <h3>{tab.label}</h3>
                    <p>{tab.description}</p>
                  </div>
                </NavLink>
              ))}
            </section>

            <section className="admin-pulse-worklist" aria-label="Pulse work that needs attention">
              <div className="admin-pulse-worklist__header">
                <div>
                  <span className="section-eyebrow">Needs attention</span>
                  <h2>Pulse ops queue</h2>
                </div>
                <small>Use these shortcuts for the daily admin sweep.</small>
              </div>
              <div className="admin-pulse-worklist__grid">
                <NavLink className="admin-pulse-work-card" to="/admin/pulse/moderation">
                  <Flag size={18} />
                  <strong>{openReports.length}</strong>
                  <span>Open reports</span>
                  <small>Review safety flags and reported content.</small>
                </NavLink>
                <NavLink className="admin-pulse-work-card" to="/admin/pulse/opportunities">
                  <BriefcaseBusiness size={18} />
                  <strong>{pendingApplications.length}</strong>
                  <span>Active applications</span>
                  <small>Move students through applied, shortlist, and selected stages.</small>
                </NavLink>
                <NavLink className="admin-pulse-work-card" to="/admin/pulse/mentorship">
                  <GraduationCap size={18} />
                  <strong>{pendingMentorshipSessions.length}</strong>
                  <span>Mentorship actions</span>
                  <small>Approve, publish, or close submitted sessions.</small>
                </NavLink>
                <NavLink className="admin-pulse-work-card" to="/admin/pulse/profiles">
                  <UserRoundCheck size={18} />
                  <strong>{recentProfiles.length}</strong>
                  <span>Recent profiles</span>
                  <small>Check new student identity and referral activity.</small>
                </NavLink>
              </div>
            </section>
          </>
        ) : null}

        {data && activeTab === 'colleges' ? (
          <div className="admin-pulse-section-grid">
            <form className="admin-pulse-form" onSubmit={submitCollege}>
              <h2>Add college space</h2>
              <label>
                <span>College name</span>
                <input required value={collegeForm.name} onChange={(event) => setCollegeForm({ ...collegeForm, name: event.target.value })} />
              </label>
              <label>
                <span>City</span>
                <input value={collegeForm.city} onChange={(event) => setCollegeForm({ ...collegeForm, city: event.target.value })} />
              </label>
              <label>
                <span>State</span>
                <input value={collegeForm.state} onChange={(event) => setCollegeForm({ ...collegeForm, state: event.target.value })} />
              </label>
              {createCollege.error ? <p className="admin-pulse-error">{createCollege.error.message}</p> : null}
              <button className="admin-pulse-primary" disabled={createCollege.isPending} type="submit">
                <Plus size={17} />
                {createCollege.isPending ? 'Adding' : 'Add college'}
              </button>
            </form>

            <div className="admin-pulse-list">
              {data.colleges.map((college) => (
                <article className="admin-pulse-row" key={college.id}>
                  <div>
                    <strong>{college.name}</strong>
                    <span>{[college.city, college.state, college.country].filter(Boolean).join(', ') || 'Location not set'}</span>
                  </div>
                  <span className={`admin-pulse-pill ${statusTone(college.status)}`}>{college.status}</span>
                  <div className="admin-pulse-row__actions">
                    <button onClick={() => updateCollegeStatus.mutate({ collegeId: college.id, status: 'active' })} type="button">Active</button>
                    <button onClick={() => updateCollegeStatus.mutate({ collegeId: college.id, status: 'paused' })} type="button">Pause</button>
                    <button onClick={() => updateCollegeStatus.mutate({ collegeId: college.id, status: 'archived' })} type="button">Archive</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {data && activeTab === 'clubs' ? (
          <div className="admin-pulse-section-grid admin-pulse-section-grid--clubs">
            <form className="admin-pulse-form" onSubmit={submitClub}>
              <h2>Add club or committee</h2>
              <label className="admin-pulse-form__wide">
                <span>College</span>
                <select
                  required
                  value={clubForm.collegeId}
                  onChange={(event) => {
                    setClubForm({ ...clubForm, collegeId: event.target.value });
                    setSelectedClubCollegeId(event.target.value);
                  }}
                >
                  <option value="">Select college</option>
                  {activeColleges.map((college) => (
                    <option key={college.id} value={college.id}>{college.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Club name</span>
                <input
                  placeholder="e.g. Analytics Club"
                  required
                  value={clubForm.name}
                  onChange={(event) => setClubForm({ ...clubForm, name: event.target.value })}
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  required
                  value={clubForm.category}
                  onChange={(event) => setClubForm({ ...clubForm, category: event.target.value as typeof clubForm.category })}
                >
                  {clubCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Accent</span>
                <select
                  required
                  value={clubForm.coverColor}
                  onChange={(event) => setClubForm({ ...clubForm, coverColor: event.target.value as typeof clubForm.coverColor })}
                >
                  {clubColorOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Contact email</span>
                <input
                  placeholder="club@college.edu"
                  type="email"
                  value={clubForm.contactEmail}
                  onChange={(event) => setClubForm({ ...clubForm, contactEmail: event.target.value })}
                />
              </label>
              <label className="admin-pulse-form__wide">
                <span>Short summary</span>
                <input
                  placeholder="One-line purpose visible on the club card"
                  required
                  value={clubForm.summary}
                  onChange={(event) => setClubForm({ ...clubForm, summary: event.target.value })}
                />
              </label>
              <label className="admin-pulse-form__wide">
                <span>Description</span>
                <textarea
                  placeholder="What this club helps students do inside the college workspace"
                  rows={4}
                  value={clubForm.description}
                  onChange={(event) => setClubForm({ ...clubForm, description: event.target.value })}
                />
              </label>
              <label className="admin-pulse-form__wide">
                <span>Focus tags</span>
                <input
                  placeholder="Case prep, Competitions, Live projects"
                  value={clubForm.focusTags}
                  onChange={(event) => setClubForm({ ...clubForm, focusTags: event.target.value })}
                />
              </label>
              {createClub.error ? <p className="admin-pulse-error">{createClub.error.message}</p> : null}
              <button className="admin-pulse-primary" disabled={createClub.isPending} type="submit">
                <Plus size={17} />
                {createClub.isPending ? 'Adding' : 'Add club'}
              </button>
            </form>

            <div className="admin-pulse-list">
              <div className="admin-pulse-list__header">
                <h2>Club workspaces</h2>
                <select
                  className="admin-pulse-inline-select"
                  value={selectedCollegeId}
                  onChange={(event) => setSelectedClubCollegeId(event.target.value)}
                >
                  <option value="">All colleges</option>
                  {data.colleges.map((college) => (
                    <option key={college.id} value={college.id}>{college.name}</option>
                  ))}
                </select>
              </div>
              {clubList.length ? clubList.map((club) => {
                const members = clubMembersByClub.get(club.id) ?? [];
                return (
                  <article className="admin-pulse-row admin-pulse-row--club" key={club.id}>
                    <div className="admin-pulse-row__main">
                      <strong>{club.name}</strong>
                      <span>{club.college?.name ?? 'College not set'} · {formatLabel(club.category)}</span>
                      <p>{club.summary}</p>
                      <div className="admin-pulse-row__badges">
                        <span className={`admin-pulse-pill ${statusTone(club.status)}`}>{club.status}</span>
                        <span className="admin-pulse-pill admin-pulse-pill--muted">{members.filter((member) => member.status === 'active').length} admins/members</span>
                        {club.focus_tags.slice(0, 3).map((tag) => (
                          <span className="admin-pulse-pill admin-pulse-pill--muted" key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="admin-pulse-row__actions">
                      <button onClick={() => updateClubStatus.mutate({ clubId: club.id, status: 'active' })} type="button">Active</button>
                      <button onClick={() => updateClubStatus.mutate({ clubId: club.id, status: 'paused' })} type="button">Pause</button>
                      <button onClick={() => updateClubStatus.mutate({ clubId: club.id, status: 'archived' })} type="button">Archive</button>
                    </div>
                  </article>
                );
              }) : <div className="admin-pulse-state">No clubs configured for this college yet.</div>}
              {updateClubStatus.error ? <p className="admin-pulse-error">{updateClubStatus.error.message}</p> : null}
            </div>

            <form className="admin-pulse-form" onSubmit={submitClubAdmin}>
              <h2>Assign club admin</h2>
              <label className="admin-pulse-form__wide">
                <span>Club</span>
                <select
                  required
                  value={clubAdminForm.clubId}
                  onChange={(event) => setClubAdminForm({ ...clubAdminForm, clubId: event.target.value, profileId: '' })}
                >
                  <option value="">Select club</option>
                  {data.clubs.filter((club) => club.status !== 'archived').map((club) => (
                    <option key={club.id} value={club.id}>{club.college?.name ?? 'College'} · {club.name}</option>
                  ))}
                </select>
              </label>
              <label className="admin-pulse-form__wide">
                <span>Pulse profile</span>
                <select
                  disabled={!clubAdminForm.clubId}
                  required
                  value={clubAdminForm.profileId}
                  onChange={(event) => setClubAdminForm({ ...clubAdminForm, profileId: event.target.value })}
                >
                  <option value="">Select profile from the same college</option>
                  {eligibleClubProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.display_name} · {profile.college?.name ?? 'No college'}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Role</span>
                <select
                  required
                  value={clubAdminForm.role}
                  onChange={(event) => setClubAdminForm({ ...clubAdminForm, role: event.target.value as typeof clubAdminForm.role })}
                >
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="member">Member</option>
                </select>
              </label>
              <label>
                <span>Title</span>
                <input
                  placeholder="e.g. Club President"
                  value={clubAdminForm.title}
                  onChange={(event) => setClubAdminForm({ ...clubAdminForm, title: event.target.value })}
                />
              </label>
              {upsertClubMembership.error ? <p className="admin-pulse-error">{upsertClubMembership.error.message}</p> : null}
              <button className="admin-pulse-primary" disabled={upsertClubMembership.isPending} type="submit">
                <ShieldCheck size={17} />
                {upsertClubMembership.isPending ? 'Assigning' : 'Assign access'}
              </button>
            </form>

            <div className="admin-pulse-list">
              <h2>Club access</h2>
              {data.clubMemberships.length ? data.clubMemberships.map((membership) => (
                <article className="admin-pulse-row" key={membership.id}>
                  <div>
                    <strong>{membership.profile?.display_name ?? 'Pulse member'}</strong>
                    <span>{membership.club?.name ?? 'Club'} · {membership.title || formatLabel(membership.role)}</span>
                    <small>{membership.profile?.college?.name ?? 'College not set'}</small>
                  </div>
                  <span className={`admin-pulse-pill ${statusTone(membership.status)}`}>{membership.status}</span>
                  <span className="admin-pulse-pill admin-pulse-pill--muted">{membership.role}</span>
                  <div className="admin-pulse-row__actions">
                    <button onClick={() => updateClubMembershipStatus.mutate({ membershipId: membership.id, status: 'active' })} type="button">Active</button>
                    <button onClick={() => updateClubMembershipStatus.mutate({ membershipId: membership.id, status: 'paused' })} type="button">Pause</button>
                  </div>
                </article>
              )) : <div className="admin-pulse-state">No club admins assigned yet.</div>}
              {updateClubMembershipStatus.error ? <p className="admin-pulse-error">{updateClubMembershipStatus.error.message}</p> : null}
            </div>
          </div>
        ) : null}

        {data && activeTab === 'profiles' ? (
          <div className="admin-pulse-section-grid">
            <div className="admin-pulse-list">
              <h2>Profiles and referral codes</h2>
              {data.profiles.map((profile) => (
                <article className="admin-pulse-row admin-pulse-row--profile" key={profile.id}>
                  <div>
                    <strong>{profile.display_name}</strong>
                    <span>{profile.headline || 'No headline yet'}</span>
                    <small>{profile.college?.name ?? 'College not selected'}</small>
                  </div>
                  <span className={`admin-pulse-pill ${statusTone(profile.pulse_status)}`}>{profile.pulse_status}</span>
                  <span className="admin-pulse-code">{profile.referral_code}</span>
                  <span className="admin-pulse-pill admin-pulse-pill--muted">{profile.profile_visibility}</span>
                </article>
              ))}
            </div>

            <div className="admin-pulse-list">
              <h2>Recent student interest</h2>
              {data.connections.length ? data.connections.map((connection) => (
                <article className="admin-pulse-row" key={connection.id}>
                  <div>
                    <strong>{connection.requester?.display_name ?? 'Pulse student'}</strong>
                    <span>showed interest in {connection.target?.display_name ?? 'another student'}</span>
                    <small>{formatDate(connection.created_at)}</small>
                  </div>
                  <span className="admin-pulse-pill admin-pulse-pill--success">Interested</span>
                </article>
              )) : <div className="admin-pulse-state">No student interest yet.</div>}
            </div>
          </div>
        ) : null}

        {data && activeTab === 'moderation' ? (
          <>
            <section className="admin-pulse-moderation-board" aria-label="Moderation queues">
              {moderationStats.map((item) => (
                <button
                  className={reportStatusFilter === item.filter || postStatusFilter === item.filter ? 'is-active' : ''}
                  key={item.label}
                  onClick={() => {
                    if (item.filter === 'under_review') {
                      setPostStatusFilter('under_review');
                      setReportStatusFilter('all');
                      return;
                    }
                    setReportStatusFilter(item.filter);
                    setPostStatusFilter('all');
                  }}
                  type="button"
                >
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </button>
              ))}
            </section>

            <div className="admin-pulse-section-grid">
              <div className="admin-pulse-list">
                <div className="admin-pulse-list__header">
                  <div>
                    <h2>Post review queue</h2>
                    <span>Publish, hide, or hold posts for review.</span>
                  </div>
                  <span>{filteredPosts.length} showing</span>
                </div>
                <div className="admin-pulse-filter-row" aria-label="Post filters">
                  <select value={postStatusFilter} onChange={(event) => setPostStatusFilter(event.target.value as (typeof postStatusFilters)[number])}>
                    {postStatusFilters.map((status) => (
                      <option key={status} value={status}>{status === 'all' ? 'All statuses' : formatLabel(status)}</option>
                    ))}
                  </select>
                  <select value={postTypeFilter} onChange={(event) => setPostTypeFilter(event.target.value)}>
                    <option value="all">All post types</option>
                    {postTypeOptions.map((type) => (
                      <option key={type} value={type}>{formatLabel(type)}</option>
                    ))}
                  </select>
                </div>
                {filteredPosts.length ? filteredPosts.map((post) => (
                  <article className="admin-pulse-row admin-pulse-row--moderation" key={post.id}>
                    <div>
                      <div className="admin-pulse-row__main">
                        <div>
                          <strong>{post.title}</strong>
                          <span>
                            {post.anonymous ? 'Anonymous' : post.author?.display_name ?? 'Pulse member'} · {formatLabel(post.post_type)} · {formatDate(post.created_at)}
                          </span>
                        </div>
                        <span className={`admin-pulse-pill ${statusTone(post.status ?? 'published')}`}>{formatLabel(post.status ?? 'published')}</span>
                      </div>
                      <p className="admin-pulse-post-preview">{post.body || 'No post body added.'}</p>
                      <small>{post.visibility === 'global' ? 'Across Pulse' : post.college?.name ?? 'College feed'}</small>
                    </div>
                    <div className="admin-pulse-row__actions">
                      <button onClick={() => updatePostStatus.mutate({ postId: post.id, status: 'published' })} type="button">Publish</button>
                      <button onClick={() => updatePostStatus.mutate({ postId: post.id, status: 'under_review' })} type="button">Hold</button>
                      <button onClick={() => updatePostStatus.mutate({ postId: post.id, status: 'hidden' })} type="button">Hide</button>
                      <button onClick={() => updatePostStatus.mutate({ postId: post.id, status: 'archived' })} type="button">Archive</button>
                    </div>
                  </article>
                )) : <div className="admin-pulse-state">No posts match these filters.</div>}
              </div>

              <div className="admin-pulse-list">
                <div className="admin-pulse-list__header">
                  <div>
                    <h2>Club workspace posts</h2>
                    <span>Review club announcements, events, resources, and opportunities.</span>
                  </div>
                  <span>{filteredClubPosts.length} showing</span>
                </div>
                <div className="admin-pulse-filter-row" aria-label="Club post filters">
                  <select value={clubPostCollegeFilter} onChange={(event) => {
                    setClubPostCollegeFilter(event.target.value);
                    setClubPostClubFilter('all');
                  }}>
                    <option value="all">All colleges</option>
                    {data.colleges.map((college) => (
                      <option key={college.id} value={college.id}>{college.name}</option>
                    ))}
                  </select>
                  <select value={clubPostClubFilter} onChange={(event) => setClubPostClubFilter(event.target.value)}>
                    <option value="all">All clubs</option>
                    {data.clubs
                      .filter((club) => clubPostCollegeFilter === 'all' || club.college_id === clubPostCollegeFilter)
                      .map((club) => (
                        <option key={club.id} value={club.id}>{club.name}</option>
                      ))}
                  </select>
                  <select value={clubPostTypeFilter} onChange={(event) => setClubPostTypeFilter(event.target.value)}>
                    <option value="all">All post types</option>
                    {clubPostTypeOptions.map((type) => (
                      <option key={type} value={type}>{formatLabel(type)}</option>
                    ))}
                  </select>
                  <select value={clubPostStatusFilter} onChange={(event) => setClubPostStatusFilter(event.target.value as (typeof clubPostStatusFilters)[number])}>
                    {clubPostStatusFilters.map((status) => (
                      <option key={status} value={status}>{status === 'all' ? 'All statuses' : formatLabel(status)}</option>
                    ))}
                  </select>
                </div>
                {filteredClubPosts.length ? filteredClubPosts.map((post) => (
                  <article className="admin-pulse-row admin-pulse-row--moderation" key={post.id}>
                    <div>
                      <div className="admin-pulse-row__main">
                        <div>
                          <strong>{post.title}</strong>
                          <span>
                            {post.club?.college?.name ?? 'College'} · {post.club?.name ?? 'Club'} · {formatLabel(post.post_type)}
                          </span>
                          <small>{post.author?.display_name ?? 'Club admin'} · {formatDate(post.created_at)}</small>
                          {post.moderated_at ? <small>Last moderated {formatDateTime(post.moderated_at)}</small> : null}
                        </div>
                        <span className={`admin-pulse-pill ${statusTone(post.status)}`}>{formatLabel(post.status)}</span>
                      </div>
                      <p className="admin-pulse-post-preview">{post.body || 'No post body added.'}</p>
                    </div>
                    <div className="admin-pulse-row__actions">
                      <button onClick={() => updateClubPostStatus.mutate({ postId: post.id, status: 'published' })} type="button">Publish</button>
                      <button onClick={() => updateClubPostStatus.mutate({ postId: post.id, status: 'under_review' })} type="button">Hold</button>
                      <button onClick={() => updateClubPostStatus.mutate({ postId: post.id, status: 'hidden' })} type="button">Hide</button>
                      <button onClick={() => updateClubPostStatus.mutate({ postId: post.id, status: 'archived' })} type="button">Archive</button>
                    </div>
                  </article>
                )) : <div className="admin-pulse-state">No club posts match these filters.</div>}
                {updateClubPostStatus.error ? <p className="admin-pulse-error">{updateClubPostStatus.error.message}</p> : null}
              </div>

              <div className="admin-pulse-list">
                <div className="admin-pulse-list__header">
                  <div>
                    <h2>Report cases</h2>
                    <span>Review reports and save the final moderation note.</span>
                  </div>
                  <span>{filteredReports.length} showing</span>
                </div>
                <div className="admin-pulse-filter-row" aria-label="Report filters">
                  <select value={reportStatusFilter} onChange={(event) => setReportStatusFilter(event.target.value as (typeof reportStatusFilters)[number])}>
                    {reportStatusFilters.map((status) => (
                      <option key={status} value={status}>{status === 'all' ? 'All report statuses' : formatLabel(status)}</option>
                    ))}
                  </select>
                </div>
                {filteredReports.length ? filteredReports.map((report) => {
                  const noteValue = reportNotes[report.id] ?? report.resolution_note ?? '';
                  return (
                    <article className="admin-pulse-row admin-pulse-row--report-case" key={report.id}>
                      <div className="admin-pulse-row__main">
                        <div>
                          <strong>{reportReasonLabels[report.reason] ?? report.reason}</strong>
                          <span>{reportContentType(report)} · {report.reporter?.display_name ?? 'Reporter'} · {formatDate(report.created_at)}</span>
                        </div>
                        <span className={`admin-pulse-pill ${statusTone(report.status)}`}>{formatLabel(report.status)}</span>
                      </div>
                      <div className="admin-pulse-report-target">
                        <small>Reported item</small>
                        <strong>{reportTitle(report)}</strong>
                        {report.details ? <p>{report.details}</p> : null}
                        {report.reviewed_at ? <span>Last reviewed {formatDateTime(report.reviewed_at)}</span> : null}
                      </div>
                      <label className="admin-pulse-note-field">
                        <span>Resolution note</span>
                        <textarea
                          placeholder="Add what action was taken or why the report was dismissed."
                          rows={3}
                          value={noteValue}
                          onChange={(event) => setReportNotes({ ...reportNotes, [report.id]: event.target.value })}
                        />
                      </label>
                      <div className="admin-pulse-row__actions">
                        <button onClick={() => updateReportStatus.mutate({ reportId: report.id, status: 'reviewing' })} type="button">Mark reviewing</button>
                        <button onClick={() => updateReportStatus.mutate({ reportId: report.id, resolutionNote: noteValue, status: 'resolved' })} type="button">Resolve</button>
                        <button onClick={() => updateReportStatus.mutate({ reportId: report.id, resolutionNote: noteValue, status: 'dismissed' })} type="button">Dismiss</button>
                      </div>
                    </article>
                  );
                }) : <div className="admin-pulse-state">No reports match this queue.</div>}
              </div>
            </div>
          </>
        ) : null}

        {data && activeTab === 'opportunities' ? (
          <div className="admin-pulse-section-grid">
            <form className="admin-pulse-form" onSubmit={submitOpportunity}>
              <h2>Create opportunity drop</h2>
              <label>
                <span>Title</span>
                <input required value={opportunityForm.title} onChange={(event) => setOpportunityForm({ ...opportunityForm, title: event.target.value })} />
              </label>
              <label>
                <span>Company</span>
                <input value={opportunityForm.companyName} onChange={(event) => setOpportunityForm({ ...opportunityForm, companyName: event.target.value })} />
              </label>
              <label>
                <span>Type</span>
                <select value={opportunityForm.opportunityType} onChange={(event) => setOpportunityForm({ ...opportunityForm, opportunityType: event.target.value as AdminPulseOpportunity['opportunity_type'] })}>
                  {Object.entries(opportunityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>Visibility</span>
                <select value={opportunityForm.visibility} onChange={(event) => setOpportunityForm({ ...opportunityForm, visibility: event.target.value as AdminPulseOpportunity['visibility'] })}>
                  <option value="global">Across campuses</option>
                  <option value="college">College-specific</option>
                </select>
              </label>
              <label>
                <span>Source club</span>
                <select value={opportunityForm.clubId} onChange={(event) => setOpportunityForm({ ...opportunityForm, clubId: event.target.value })}>
                  <option value="">College-wide / no club</option>
                  {data.clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.college?.name ? `${club.college.name} · ` : ''}{club.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Close date</span>
                <input type="date" value={opportunityForm.closesAt} onChange={(event) => setOpportunityForm({ ...opportunityForm, closesAt: event.target.value })} />
              </label>
              <label className="admin-pulse-form__wide">
                <span>Short listing description</span>
                <textarea
                  required
                  rows={3}
                  placeholder="Short summary shown on opportunity cards."
                  value={opportunityForm.description}
                  onChange={(event) => setOpportunityForm({ ...opportunityForm, description: event.target.value })}
                />
              </label>
              <div className="admin-pulse-form__wide admin-pulse-rte-field">
                <RichTextEditor
                  label="Detailed opportunity description"
                  onChange={(value) => setOpportunityForm({ ...opportunityForm, detailDescription: value })}
                  placeholder="Add the full brief: context, responsibilities, deliverables, eligibility, selection process, timeline, and any useful links."
                  value={opportunityForm.detailDescription}
                />
                <small>This appears on the opportunity detail page below the skills section.</small>
              </div>
              {createOpportunity.error ? <p className="admin-pulse-error">{createOpportunity.error.message}</p> : null}
              <button className="admin-pulse-primary" disabled={createOpportunity.isPending} type="submit">
                <Sparkles size={17} />
                {createOpportunity.isPending ? 'Creating' : 'Create drop'}
              </button>
            </form>

            <div className="admin-pulse-list">
              {data.opportunities.map((opportunity) => (
                <article className="admin-pulse-row admin-pulse-row--opportunity" key={opportunity.id}>
                  <div className="admin-pulse-row__main">
                    <div>
                      <strong>{opportunity.title}</strong>
                      <span>{opportunity.company_name || 'Skilled Sapiens'} · {opportunityLabels[opportunity.opportunity_type]}</span>
                      <small>{opportunity.club?.name ? `${opportunity.club.name} · ` : ''}Closes {formatDate(opportunity.closes_at)}</small>
                    </div>
                    <div className="admin-pulse-row__badges">
                      <span className={`admin-pulse-pill ${statusTone(opportunity.status)}`}>{opportunity.status}</span>
                      <span className="admin-pulse-pill admin-pulse-pill--muted">{opportunity.visibility}</span>
                      <span className="admin-pulse-pill admin-pulse-pill--muted">
                        {(applicationsByOpportunity.get(opportunity.id) ?? []).length} interested
                      </span>
                    </div>
                  </div>

                  {(applicationsByOpportunity.get(opportunity.id) ?? []).length ? (
                    <div className="admin-pulse-applicants">
                      {(applicationsByOpportunity.get(opportunity.id) ?? []).map((application) => (
                        <div className="admin-pulse-applicant" key={application.id}>
                          <div>
                            <strong>{application.profile?.display_name ?? 'Pulse student'}</strong>
                            <span>{application.profile?.headline || application.profile?.college?.name || 'Profile details pending'}</span>
                            {application.note ? <small>{application.note}</small> : null}
                            <div className="admin-pulse-applicant__links">
                              {application.resume_url ? <a href={application.resume_url} rel="noreferrer" target="_blank">Resume</a> : null}
                              {application.linkedin_url ? <a href={application.linkedin_url} rel="noreferrer" target="_blank">LinkedIn</a> : null}
                              {application.portfolio_url ? <a href={application.portfolio_url} rel="noreferrer" target="_blank">Portfolio</a> : null}
                            </div>
                          </div>
                          <span className={`admin-pulse-pill ${statusTone(application.status)}`}>
                            {opportunityApplicationLabels[application.status] ?? application.status}
                          </span>
                          <div className="admin-pulse-row__actions">
                            <button
                              onClick={() => updateApplicationStatus.mutate({ applicationId: application.id, status: 'applied' })}
                              type="button"
                            >
                              Applied
                            </button>
                            <button
                              onClick={() => updateApplicationStatus.mutate({ applicationId: application.id, status: 'shortlisted' })}
                              type="button"
                            >
                              Shortlist
                            </button>
                            <button
                              onClick={() => updateApplicationStatus.mutate({ applicationId: application.id, status: 'selected' })}
                              type="button"
                            >
                              Select
                            </button>
                            <button
                              onClick={() => updateApplicationStatus.mutate({ applicationId: application.id, status: 'rejected' })}
                              type="button"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-pulse-state">No student interest yet.</div>
                  )}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {data && activeTab === 'mentorship' ? (
          <div className="admin-pulse-section-grid">
            <div className="admin-pulse-list">
              <h2>Session approval queue</h2>
              {data.mentorshipSessions.length ? data.mentorshipSessions.map((session) => {
                const sessionRsvps = mentorshipRsvpsBySession.get(session.id) ?? [];
                return (
                  <article className="admin-pulse-row admin-pulse-row--opportunity" key={session.id}>
                    <div className="admin-pulse-row__main">
                      <div>
                        <strong>{session.title}</strong>
                        <span>
                          {session.host?.display_name ?? 'Pulse mentor'} · {mentorshipLabels[session.session_type]} · {session.visibility === 'global' ? 'Across Pulse' : session.host?.college?.name ?? 'My college'}
                        </span>
                        <small className="admin-pulse-row__meta-line"><CalendarClock size={14} /> {formatDateTime(session.starts_at)}</small>
                      </div>
                      <div className="admin-pulse-row__badges">
                        <span className={`admin-pulse-pill ${statusTone(session.status)}`}>{session.status}</span>
                        <span className="admin-pulse-pill admin-pulse-pill--muted">{sessionRsvps.filter((rsvp) => rsvp.status === 'rsvped' || rsvp.status === 'attended').length} RSVPs</span>
                        <span className="admin-pulse-pill admin-pulse-pill--muted">{session.max_seats ?? 'Open'} seats</span>
                      </div>
                    </div>
                    <p>{session.description}</p>
                    <div className="admin-pulse-row__actions">
                      <button onClick={() => updateMentorshipStatus.mutate({ sessionId: session.id, status: 'approved' })} type="button">Approve</button>
                      <button onClick={() => updateMentorshipStatus.mutate({ sessionId: session.id, status: 'published' })} type="button">Publish</button>
                      <button onClick={() => updateMentorshipStatus.mutate({ sessionId: session.id, status: 'completed' })} type="button">Complete</button>
                      <button onClick={() => updateMentorshipStatus.mutate({ sessionId: session.id, status: 'rejected' })} type="button">Reject</button>
                      <button onClick={() => updateMentorshipStatus.mutate({ sessionId: session.id, status: 'cancelled' })} type="button">Cancel</button>
                    </div>
                    {updateMentorshipStatus.error ? <p className="admin-pulse-error">{updateMentorshipStatus.error.message}</p> : null}
                  </article>
                );
              }) : <div className="admin-pulse-state">No mentorship sessions submitted yet.</div>}
            </div>

            <div className="admin-pulse-list">
              <h2>RSVP and attendance</h2>
              {data.mentorshipRsvps.length ? data.mentorshipRsvps.map((rsvp) => (
                <article className="admin-pulse-row" key={rsvp.id}>
                  <div>
                    <strong>{rsvp.profile?.display_name ?? 'Pulse student'}</strong>
                    <span>{rsvp.session?.title ?? 'Mentorship session'}</span>
                    <small>{rsvp.profile?.college?.name ?? 'College not selected'} · {formatDate(rsvp.created_at)}</small>
                  </div>
                  <span className={`admin-pulse-pill ${statusTone(rsvp.status)}`}>{rsvp.status}</span>
                  <div className="admin-pulse-row__actions">
                    <button onClick={() => updateMentorshipRsvpStatus.mutate({ rsvpId: rsvp.id, status: 'attended' })} type="button">Attended</button>
                    <button onClick={() => updateMentorshipRsvpStatus.mutate({ rsvpId: rsvp.id, status: 'no_show' })} type="button">No-show</button>
                    <button onClick={() => updateMentorshipRsvpStatus.mutate({ rsvpId: rsvp.id, status: 'cancelled' })} type="button">Cancel</button>
                  </div>
                </article>
              )) : <div className="admin-pulse-state">No mentorship RSVPs yet.</div>}
              {updateMentorshipRsvpStatus.error ? <p className="admin-pulse-error">{updateMentorshipRsvpStatus.error.message}</p> : null}
            </div>
          </div>
        ) : null}
      </section>

      {activeTab === 'overview' ? (
        <section className="admin-pulse-decision">
          <div>
            <span className="section-eyebrow">Operating model</span>
            <h2>One admin portal, separate Pulse controls.</h2>
            <p>
              Keep Pulse student-facing and full-page, while the team manages colleges, referrals, moderation, and
              opportunities from this dedicated admin section.
            </p>
          </div>
          <div className="admin-pulse-decision__list">
            <span><ShieldCheck size={18} /> Reports can be reviewed without deleting content history.</span>
            <span><BadgeCheck size={18} /> Referral codes stay tied to student Pulse profiles.</span>
            <span><PauseCircle size={18} /> College spaces can be paused before wider scaling.</span>
            <span><BriefcaseBusiness size={18} /> Opportunity drops stay connected to the same student community.</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
