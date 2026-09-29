import {
  Activity,
  Award,
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  EyeOff,
  Flag,
  Globe2,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Pencil,
  Send,
  Sparkles,
  TrendingUp,
  Trash2,
  UsersRound,
  UserRoundCheck,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseButton, PulseCard, PulseTagSelector } from '../components';
import {
  PulseFeedFilter,
  PulsePost,
  PulsePostInteractionSummary,
  PulsePostInput,
  PulseProfile,
  PulseProfileInput,
  useArchivePulsePost,
  useCreatePulseComment,
  useCreatePulsePost,
  useCreatePulseReport,
  useDeletePulseComment,
  useAcceptPulseInvite,
  usePulseColleges,
  usePulseFeed,
  usePulseFeedRealtime,
  usePulsePeopleDirectory,
  usePulsePostInteractions,
  usePulseProfile,
  usePulseProfileDefaults,
  useSavePulseProfile,
  useStoredPulseInviteCode,
  useTogglePulsePostReaction,
  useUpdatePulseComment,
  useUpdatePulsePost,
  useVotePulsePoll
} from '../features/usePulseCommunity';
import {
  PULSE_OTHER_COLLEGE_ID,
  buildPulseCollegeOptions,
  getPulseCollegeOptionName
} from '../lib/collegeOptions';
import { normalizeLinkedInProfileUrl } from '../lib/linkedin';
import { pulseInterestOptions, pulseSkillOptions } from '../lib/profileOptions';

const postTypeLabels: Record<PulsePostInput['postType'], string> = {
  announcement: 'Update',
  article: 'Share Idea',
  discussion: 'Ask / Discuss',
  opportunity: 'Opportunity',
  poll: 'Poll',
  recognition: 'Shout-out',
  shoutout: 'Shout-out'
};

const composerPostTypes: Array<{ label: string; value: PulsePostInput['postType'] }> = [
  { label: 'Ask / Discuss', value: 'discussion' },
  { label: 'Poll', value: 'poll' },
  { label: 'Share Idea', value: 'article' },
  { label: 'Shout-out', value: 'shoutout' },
  { label: 'Opportunity', value: 'opportunity' }
];

const feedTabs: Array<{ label: string; path: string }> = [
  { label: 'All', path: '/pulse/home' },
  { label: 'My college', path: '/pulse/my-college' },
  { label: 'Across campuses', path: '/pulse/global' },
  { label: 'Shout-outs', path: '/pulse/recognition' }
];

type PulseQuickFeedFilter = 'recent' | 'popular' | 'answered' | 'college' | 'opportunities' | 'shoutouts';

const quickFeedFilters: Array<{ label: string; value: PulseQuickFeedFilter }> = [
  { label: 'Recent', value: 'recent' },
  { label: 'Popular', value: 'popular' },
  { label: 'Answered', value: 'answered' },
  { label: 'My College', value: 'college' },
  { label: 'Opportunities', value: 'opportunities' },
  { label: 'Shout-outs', value: 'shoutouts' }
];

const conversationStarters: Array<{
  body: string;
  icon: typeof MessageCircle;
  label: string;
  postType: PulsePostInput['postType'];
  title: string;
}> = [
  {
    body: 'What helped you prepare better, what felt confusing, and what should juniors know before they start?',
    icon: MessageCircle,
    label: 'Ask a useful question',
    postType: 'discussion',
    title: 'What should students know before preparing for placements?'
  },
  {
    body: 'Vote once so we can plan what students need most next.',
    icon: BarChart3,
    label: 'Run a quick poll',
    postType: 'poll',
    title: 'What should Pulse host next?'
  },
  {
    body: 'Share the idea, the kind of teammates you need, and what students can contribute this week.',
    icon: Sparkles,
    label: 'Start a project idea',
    postType: 'article',
    title: 'Anyone interested in building a student project around this?'
  },
  {
    body: 'Mention the role, expected work, deadline, and who should show interest.',
    icon: BriefcaseBusiness,
    label: 'Drop an opportunity',
    postType: 'opportunity',
    title: 'Student opportunity: '
  },
  {
    body: 'Write the specific help, idea, work, or win you want the community to notice.',
    icon: Award,
    label: 'Give a shout-out',
    postType: 'shoutout',
    title: 'Shout-out for '
  }
];

const reportReasons = [
  { label: 'Harassment or bullying', value: 'harassment' },
  { label: 'Spam or promotion', value: 'spam' },
  { label: 'False or misleading information', value: 'fake_info' },
  { label: 'Abusive content', value: 'abuse' },
  { label: 'Sensitive personal information', value: 'sensitive' },
  { label: 'Other concern', value: 'other' }
] as const;

const feedViewContent: Record<PulseFeedFilter, { badge: string; empty: string; title: string; text: string }> = {
  all: {
    badge: 'Welcome back',
    empty: 'Be the first to start a useful conversation for your college or across campuses.',
    text: 'Post to your college circle or across campuses, keep your profile current, invite trusted peers, and move into My Learning whenever you need structured Skilled Sapiens support.',
    title: 'Campus conversations, discussions, shout-outs, and real projects collaborations.'
  },
  college: {
    badge: 'My college',
    empty: 'Your college feed is ready. Start with a question, shout-out, idea, or batch update.',
    text: 'Keep your closest campus conversations inside your college space while still having the option to share stronger ideas across campuses.',
    title: 'Your college circle, without the formal layer.'
  },
  global: {
    badge: 'Across campuses',
    empty: 'No cross-campus posts are visible yet. Publish a sharp idea, question, or useful campus observation.',
    text: 'Explore ideas, career questions, student wins, and useful discussions from the wider Pulse community.',
    title: 'Ideas and student voices beyond one campus.'
  },
  opportunities: {
    badge: 'Opportunities',
    empty: 'Opportunity posts will appear here as students and admins publish them.',
    text: 'Find live projects, freelance tasks, competitions, resume rooms, and career moments where students already gather.',
    title: 'Projects and career drops inside the community.'
  },
  recognition: {
    badge: 'Shout-outs',
    empty: 'No shout-outs yet. Celebrate a helpful peer, project win, strong idea, or standout contribution.',
    text: 'Turn peer support, good work, project wins, and campus contributions into visible student shout-outs.',
    title: 'Shout-outs that make student effort visible.'
  }
};

function feedFilterFromPath(pathname: string): PulseFeedFilter {
  if (pathname.includes('/my-college')) return 'college';
  if (pathname.includes('/global')) return 'global';
  if (pathname.includes('/recognition')) return 'recognition';
  return 'all';
}

function pollOptionsForPost(post: PulsePost) {
  const options = post.metadata.poll_options;
  if (!Array.isArray(options)) return [];

  return options
    .map((option, index) => {
      if (!option || typeof option !== 'object') return null;
      const record = option as Record<string, unknown>;
      const label = String(record.label ?? '').trim();
      if (!label) return null;
      return {
        id: String(record.id ?? `option-${index + 1}`),
        label
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string }>;
}

function postBadge(post: PulsePost) {
  if (post.anonymous) return 'Anonymous';
  if (post.post_type === 'recognition' || post.post_type === 'shoutout') return 'Shout-out';
  if (post.visibility === 'college') return 'My college only';
  return 'Everyone on Pulse';
}

function postBadgeTone(post: PulsePost) {
  if (post.anonymous) return 'coral';
  if (post.post_type === 'recognition' || post.post_type === 'shoutout') return 'green';
  if (post.visibility === 'global') return 'gold';
  return 'brand';
}

function formatPostMeta(post: PulsePost) {
  const audience = post.visibility === 'global' ? 'Across campuses' : post.college?.name ?? 'My college';
  return `${postTypeLabels[post.post_type]} · ${audience}`;
}

function formatRelativeTime(value: string) {
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

function postActivityLabel(interaction?: PulsePostInteractionSummary) {
  const reactions = interaction?.reactionCount ?? 0;
  const comments = interaction?.commentCount ?? 0;

  if (comments >= 3) return 'Active discussion';
  if (reactions >= 3) return 'Getting recognized';
  if (comments > 0) return 'Students are replying';
  if (reactions > 0) return 'Students noticed this';

  return 'Open for first response';
}

function postCardTone(post: PulsePost) {
  if (post.post_type === 'opportunity') return 'opportunity';
  if (post.post_type === 'recognition' || post.post_type === 'shoutout') return 'recognition';
  if (post.post_type === 'poll') return 'poll';
  if (post.post_type === 'article') return 'idea';
  if (post.anonymous) return 'anonymous';
  return 'discussion';
}

function pulsePostErrorMessage(message: string) {
  if (/pulse_posts_title_check|title/i.test(message) && /check constraint|violates/i.test(message)) {
    return 'Please add a title with at least 3 characters.';
  }

  if (/pulse_posts_body_check|body/i.test(message) && /check constraint|violates/i.test(message)) {
    return 'Please write something before posting.';
  }

  return message;
}

export function PulseProfileOnboarding({ defaults }: { defaults: PulseProfileInput }) {
  const collegesQuery = usePulseColleges();
  const saveProfile = useSavePulseProfile();
  const [form, setForm] = useState({
    bio: defaults.bio ?? '',
    collegeId: defaults.collegeId ?? '',
    collegeName: defaults.collegeName ?? '',
    displayName: defaults.displayName,
    headline: defaults.headline ?? '',
    interests: defaults.interests.slice(0, 5),
    linkedinUrl: defaults.linkedinUrl ?? '',
    skills: defaults.skills.slice(0, 5)
  });
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    setForm((current) => ({
      ...current,
      displayName: current.displayName || defaults.displayName,
      headline: current.headline || defaults.headline || '',
      linkedinUrl: current.linkedinUrl || defaults.linkedinUrl || ''
    }));
  }, [defaults.displayName, defaults.headline, defaults.linkedinUrl]);

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

  const collegeOptions = buildPulseCollegeOptions(collegesQuery.data ?? []);
  const skillOptions = Array.from(new Set([...form.skills, ...pulseSkillOptions])).sort((a, b) => a.localeCompare(b));
  const interestOptions = Array.from(new Set([...form.interests, ...pulseInterestOptions])).sort((a, b) => a.localeCompare(b));

  return (
    <section className="pulse-onboarding">
      <div className="pulse-onboarding__copy">
        <PulseBadge tone="coral">Profile required</PulseBadge>
        <h1>Create your Pulse identity.</h1>
        <p>
          Your profile helps classmates recognize your work, invite trusted peers, and match you with community-led
          projects and opportunity drops.
        </p>
        <div className="pulse-onboarding__benefits">
          <span><UserRoundCheck size={17} /> Build a credible student presence</span>
          <span><LockKeyhole size={17} /> Verified Pulse members can discover your profile</span>
          <span><Sparkles size={17} /> Unlock posts, referrals, shout-outs, and opportunities</span>
        </div>
      </div>

      <PulseCard className="pulse-profile-card">
        <form className="pulse-profile-form" onSubmit={submitProfile}>
          <label>
            <span>Display name</span>
            <input
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Your name"
              required
              value={form.displayName}
            />
          </label>

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
                  collegeName: collegeId === PULSE_OTHER_COLLEGE_ID ? '' : getPulseCollegeOptionName(collegeOptions, collegeId)
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
              rows={4}
              value={form.bio}
            />
          </label>

          {profileError ? <p className="pulse-form-error">{profileError}</p> : null}
          {saveProfile.error ? <p className="pulse-form-error">{saveProfile.error.message}</p> : null}

          <button className="pulse-button pulse-button--primary pulse-profile-form__submit" disabled={saveProfile.isPending} type="submit">
            <span>{saveProfile.isPending ? 'Saving profile' : 'Enter Pulse'}</span>
            <Send size={18} />
          </button>
        </form>
      </PulseCard>
    </section>
  );
}

function PulseComposer({ activeFilter, profile }: { activeFilter: PulseFeedFilter; profile: PulseProfile }) {
  const createPost = useCreatePulsePost(profile);
  const isShoutOut = (postType: PulsePostInput['postType']) => postType === 'recognition' || postType === 'shoutout';
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<PulsePostInput>({
    anonymous: false,
    body: '',
    pollOptions: ['Resume review', 'Project ideas', 'Interview prep', 'Domain clarity'],
    postType: activeFilter === 'recognition' ? 'shoutout' : 'discussion',
    recipientProfileId: '',
    title: '',
    visibility: profile.college_id ? 'college' : 'global'
  });
  const [recipientQuery, setRecipientQuery] = useState('');
  const peopleQuery = usePulsePeopleDirectory(
    {
      query: '',
      scope: profile.college_id ? 'college' : 'all',
      sort: 'name',
      tag: ''
    },
    profile
  );

  const canPostToCollege = Boolean(profile.college_id);
  const shoutOutRecipients = useMemo(
    () => (peopleQuery.data ?? []).filter((person) => person.id !== profile.id),
    [peopleQuery.data, profile.id]
  );
  const filteredShoutOutRecipients = useMemo(() => {
    const cleanQuery = recipientQuery.trim().toLowerCase();
    if (!cleanQuery) return shoutOutRecipients;

    return shoutOutRecipients.filter((person) => {
      const searchableText = [
        person.display_name,
        person.headline,
        person.college?.name,
        ...person.skills,
        ...person.interests
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(cleanQuery);
    });
  }, [recipientQuery, shoutOutRecipients]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      anonymous: activeFilter === 'recognition' ? false : current.anonymous,
      postType: activeFilter === 'recognition' ? 'shoutout' : 'discussion',
      recipientProfileId: activeFilter === 'recognition' ? current.recipientProfileId : ''
    }));

    if (activeFilter !== 'recognition') {
      setRecipientQuery('');
    }
  }, [activeFilter]);

  function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const body = form.body.trim();

    if (title.length < 3) {
      setFormError('Please add a title with at least 3 characters.');
      return;
    }

    if (!body) {
      setFormError('Please write something before posting.');
      return;
    }

    if (form.postType === 'poll' && (form.pollOptions ?? []).filter((option) => option.trim()).length < 2) {
      setFormError('Please add at least two poll options.');
      return;
    }

    if (isShoutOut(form.postType) && !form.recipientProfileId) {
      setFormError('Please select the student you want to shout out.');
      return;
    }

    setFormError('');
    createPost.mutate(form, {
      onSuccess: () => {
        setForm({
          anonymous: false,
          body: '',
          pollOptions: ['Resume review', 'Project ideas', 'Interview prep', 'Domain clarity'],
          postType: 'discussion',
          recipientProfileId: '',
          title: '',
          visibility: canPostToCollege ? 'college' : 'global'
        });
        setRecipientQuery('');
      }
    });
  }

  function useStarter(starter: (typeof conversationStarters)[number]) {
    const shoutOut = isShoutOut(starter.postType);
    setForm({
      ...form,
      anonymous: shoutOut ? false : form.anonymous,
      body: starter.body,
      pollOptions:
        starter.postType === 'poll'
          ? ['Resume review', 'Mock interview', 'Live project walkthrough', 'Career AMA']
          : form.pollOptions,
      postType: starter.postType,
      recipientProfileId: shoutOut ? form.recipientProfileId : '',
      title: starter.title
    });
  }

  return (
    <PulseCard className="pulse-composer-card">
      <form onSubmit={submitPost}>
        <div className="pulse-composer-card__top">
          <div>
            <strong>Share something with Pulse</strong>
            <span>Ask a question, share an idea, give a shout-out, or drop an opportunity.</span>
          </div>
          <select
            onChange={(event) => {
              const postType = event.target.value as PulsePostInput['postType'];
              setForm({
                ...form,
                anonymous: isShoutOut(postType) ? false : form.anonymous,
                postType,
                recipientProfileId: isShoutOut(postType) ? form.recipientProfileId : ''
              });
            }}
            value={form.postType}
          >
            {composerPostTypes.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="pulse-composer-prompts" aria-label="Post starters">
          <span>Start with</span>
          {conversationStarters.map((starter) => {
            const Icon = starter.icon;
            return (
              <button key={starter.label} onClick={() => useStarter(starter)} type="button">
                <Icon size={15} />
                <span>{starter.label}</span>
              </button>
            );
          })}
        </div>

        <input
          minLength={3}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder={isShoutOut(form.postType) ? 'What are you recognizing them for?' : 'Give your post a clear title'}
          required
          value={form.title}
        />
        <textarea
          onChange={(event) => setForm({ ...form, body: event.target.value })}
          placeholder={
            isShoutOut(form.postType)
              ? 'Write the specific work, help, idea, or win you want to appreciate.'
              : form.postType === 'poll'
                ? 'Give context so students know what they are voting on.'
              : 'Write what students should know, discuss, vote on, or celebrate.'
          }
          required
          rows={4}
          value={form.body}
        />

        {form.postType === 'poll' ? (
          <div className="pulse-composer-poll-options">
            <div>
              <strong>Poll options</strong>
              <span>Students can vote once and see the live result.</span>
            </div>
            {(form.pollOptions ?? []).map((option, index) => (
              <label key={`poll-option-${index + 1}`}>
                <span>Option {index + 1}</span>
                <input
                  onChange={(event) => {
                    const nextOptions = [...(form.pollOptions ?? [])];
                    nextOptions[index] = event.target.value;
                    setForm({ ...form, pollOptions: nextOptions });
                  }}
                  placeholder={`Choice ${index + 1}`}
                  value={option}
                />
              </label>
            ))}
          </div>
        ) : null}

        {isShoutOut(form.postType) ? (
          <label className="pulse-composer-recipient">
            <span>Shout out to</span>
            <input
              onChange={(event) => setRecipientQuery(event.target.value)}
              placeholder="Search student by name, college, skill, or interest"
              value={recipientQuery}
            />
            <select
              onChange={(event) => setForm({ ...form, recipientProfileId: event.target.value })}
              required
              value={form.recipientProfileId ?? ''}
            >
              <option value="">Select a student to recognize</option>
              {filteredShoutOutRecipients.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.display_name}{person.college?.name ? ` · ${person.college.name}` : ''}
                </option>
              ))}
              {!filteredShoutOutRecipients.length ? (
                <option disabled value="">No matching students found</option>
              ) : null}
            </select>
          </label>
        ) : null}

        <div className="pulse-composer-card__controls">
          <label>
            <input
              checked={form.visibility === 'college'}
              disabled={!canPostToCollege}
              name="pulse-post-visibility"
              onChange={() => setForm({ ...form, visibility: 'college' })}
              type="radio"
            />
            <span>My college only</span>
          </label>
          <label>
            <input
              checked={form.visibility === 'global'}
              name="pulse-post-visibility"
              onChange={() => setForm({ ...form, visibility: 'global' })}
              type="radio"
            />
            <span>Everyone on Pulse</span>
          </label>
          <label>
            <input
              checked={form.anonymous}
              disabled={isShoutOut(form.postType)}
              onChange={(event) => setForm({ ...form, anonymous: event.target.checked })}
              type="checkbox"
            />
            <span>Post anonymously</span>
          </label>
          <button className="pulse-button pulse-button--primary" disabled={createPost.isPending} type="submit">
            <span>{createPost.isPending ? 'Posting' : 'Post'}</span>
            <Send size={18} />
          </button>
        </div>

        {!canPostToCollege ? <p className="pulse-form-note">Select a college in your profile to post inside your college space.</p> : null}
        {formError ? <p className="pulse-form-error">{formError}</p> : null}
        {createPost.error ? <p className="pulse-form-error">{pulsePostErrorMessage(createPost.error.message)}</p> : null}
      </form>
    </PulseCard>
  );
}

function PulsePollResults({
  interaction,
  post,
  profile
}: {
  interaction?: PulsePostInteractionSummary;
  post: PulsePost;
  profile: PulseProfile;
}) {
  const votePoll = useVotePulsePoll(profile);
  const options = pollOptionsForPost(post);
  const totalVotes = interaction?.pollTotal ?? 0;
  const selectedOptionId = interaction?.selectedPollOptionId;

  if (!options.length) return null;

  return (
    <div className="pulse-poll-results" aria-label="Poll options">
      {options.map((option) => {
        const count = interaction?.pollCounts[option.id] ?? 0;
        const percentage = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        const selected = selectedOptionId === option.id;

        return (
          <button
            className={selected ? 'pulse-poll-option is-selected' : 'pulse-poll-option'}
            disabled={votePoll.isPending}
            key={option.id}
            onClick={() => votePoll.mutate({ optionId: option.id, postId: post.id })}
            type="button"
          >
            <span className="pulse-poll-option__bar" style={{ width: `${percentage}%` }} />
            <span className="pulse-poll-option__label">{option.label}</span>
            <strong>{percentage}%</strong>
          </button>
        );
      })}
      <div className="pulse-poll-results__meta">
        <span><BarChart3 size={15} /> {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
        {selectedOptionId ? <span>Your vote is counted</span> : <span>Tap an option to vote</span>}
      </div>
      {votePoll.error ? <p className="pulse-form-error">{votePoll.error.message}</p> : null}
    </div>
  );
}

function PulseFeedPost({
  interaction,
  post,
  profile
}: {
  interaction?: PulsePostInteractionSummary;
  post: PulsePost;
  profile: PulseProfile;
}) {
  const authorName = post.anonymous ? 'Anonymous student' : post.author?.display_name ?? 'Pulse member';
  const authorAvatarUrl = post.anonymous ? null : post.author?.avatar_url;
  const createComment = useCreatePulseComment(profile);
  const createReport = useCreatePulseReport(profile);
  const updatePost = useUpdatePulsePost(profile);
  const archivePost = useArchivePulsePost(profile);
  const updateComment = useUpdatePulseComment(profile);
  const deleteComment = useDeletePulseComment(profile);
  const toggleReaction = useTogglePulsePostReaction(profile);
  const [commentBody, setCommentBody] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(post.anonymous);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [postEditBody, setPostEditBody] = useState(post.body);
  const [postEditTitle, setPostEditTitle] = useState(post.title);
  const [postEditVisibility, setPostEditVisibility] = useState<PulsePost['visibility']>(post.visibility);
  const [reportTarget, setReportTarget] = useState<{ commentId?: string; label: string; postId?: string } | null>(null);
  const [reportReason, setReportReason] = useState<(typeof reportReasons)[number]['value']>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const commentCount = interaction?.commentCount ?? 0;
  const latestComment = interaction?.comments.at(-1) ?? null;
  const isPostOwner = post.author_profile_id === profile.id;

  useEffect(() => {
    if (!isCommentsOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCommentsOpen]);

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createComment.mutate(
      {
        anonymous: commentAnonymous,
        body: commentBody,
        postId: post.id
      },
      {
        onSuccess: () => {
          setCommentBody('');
          setIsCommentsOpen(true);
        }
      }
    );
  }

  function toggleRecognize() {
    toggleReaction.mutate({ hasReacted: Boolean(interaction?.hasReacted), postId: post.id });
  }

  function closeReportDialog() {
    setReportTarget(null);
    setReportReason('harassment');
    setReportDetails('');
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportTarget) return;
    createReport.mutate(
      {
        commentId: reportTarget.commentId,
        details: reportDetails,
        postId: reportTarget.postId,
        reason: reportReason
      },
      {
        onSuccess: closeReportDialog
      }
    );
  }

  function startPostEdit() {
    setPostEditTitle(post.title);
    setPostEditBody(post.body);
    setPostEditVisibility(post.visibility);
    setIsEditingPost(true);
  }

  function cancelPostEdit() {
    setIsEditingPost(false);
    setPostEditTitle(post.title);
    setPostEditBody(post.body);
    setPostEditVisibility(post.visibility);
  }

  function submitPostEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updatePost.mutate(
      {
        body: postEditBody,
        postId: post.id,
        title: postEditTitle,
        visibility: postEditVisibility
      },
      {
        onSuccess: () => setIsEditingPost(false)
      }
    );
  }

  function hidePostFromFeed() {
    if (!window.confirm('Hide this post from the feed?')) return;
    archivePost.mutate(post.id);
  }

  function startCommentEdit(commentId: string, body: string) {
    setEditingCommentId(commentId);
    setEditingCommentBody(body);
  }

  function cancelCommentEdit() {
    setEditingCommentId(null);
    setEditingCommentBody('');
  }

  function submitCommentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCommentId) return;
    updateComment.mutate(
      {
        body: editingCommentBody,
        commentId: editingCommentId
      },
      {
        onSuccess: cancelCommentEdit
      }
    );
  }

  function removeComment(commentId: string) {
    if (!window.confirm('Delete this comment?')) return;
    deleteComment.mutate(commentId, {
      onSuccess: () => {
        if (editingCommentId === commentId) cancelCommentEdit();
      }
    });
  }

  return (
    <>
    <PulseCard className={`pulse-post-card pulse-post-card--${postCardTone(post)}`}>
      <div className="pulse-post-card__signal">
        <span><Activity size={15} /> {postActivityLabel(interaction)}</span>
        <span>{formatRelativeTime(post.created_at)}</span>
      </div>

      <div className="pulse-post-card__author-row">
        <span className="pulse-post-author">
          <strong>
            {authorAvatarUrl ? <img alt="" src={authorAvatarUrl} /> : authorName.slice(0, 1).toUpperCase()}
          </strong>
          <span>
            <b>{authorName}</b>
            {post.author?.headline && !post.anonymous ? <small>{post.author.headline}</small> : null}
          </span>
        </span>
        <span className="pulse-post-card__audience">{formatPostMeta(post)}</span>
      </div>

      {isEditingPost ? (
        <form className="pulse-post-edit-form" onSubmit={submitPostEdit}>
          <label>
            <span>Post title</span>
            <input
              maxLength={180}
              minLength={3}
              onChange={(event) => setPostEditTitle(event.target.value)}
              required
              value={postEditTitle}
            />
          </label>
          <label>
            <span>Post details</span>
            <textarea
              maxLength={12000}
              minLength={1}
              onChange={(event) => setPostEditBody(event.target.value)}
              required
              rows={4}
              value={postEditBody}
            />
          </label>
          <label>
            <span>Audience</span>
            <select
              onChange={(event) => setPostEditVisibility(event.target.value as PulsePost['visibility'])}
              value={postEditVisibility}
            >
              <option value="college">My college only</option>
              <option value="global">Everyone on Pulse</option>
            </select>
          </label>
          <div className="pulse-owner-action-row">
            <button className="pulse-button pulse-button--primary" disabled={updatePost.isPending || !postEditTitle.trim() || !postEditBody.trim()} type="submit">
              {updatePost.isPending ? 'Saving' : 'Save changes'}
            </button>
            <button className="pulse-button pulse-button--ghost" onClick={cancelPostEdit} type="button">
              Cancel
            </button>
          </div>
          {updatePost.error ? <p className="pulse-form-error">{updatePost.error.message}</p> : null}
        </form>
      ) : (
        <div className="pulse-post-card__content">
          <PulseBadge tone={postBadgeTone(post)}>{postBadge(post)}</PulseBadge>
          <h2>{post.title}</h2>
          <p>{post.body}</p>
          {post.post_type === 'poll' ? <PulsePollResults interaction={interaction} post={post} profile={profile} /> : null}
        </div>
      )}

      <div className="pulse-post-card__footer">
        {latestComment ? (
          <button className="pulse-comment-preview" onClick={() => setIsCommentsOpen(true)} type="button">
            <MessageCircle size={15} />
            <span>
              <strong>{latestComment.anonymous ? 'Anonymous student' : latestComment.author?.display_name ?? 'Pulse member'}</strong>
              {latestComment.body}
            </span>
          </button>
        ) : (
          <span className="pulse-post-card__join">
            <Sparkles size={15} />
            {commentCount ? 'Join the discussion.' : 'Start the first useful reply.'}
          </span>
        )}
        <div className="pulse-post-card__actions">
          <button
            className={interaction?.hasReacted ? 'pulse-post-action pulse-post-action--active' : 'pulse-post-action'}
            disabled={toggleReaction.isPending}
            onClick={toggleRecognize}
            type="button"
          >
            <Award size={16} />
            <span>{interaction?.reactionCount ?? 0} Recognize</span>
          </button>
          <button
            aria-expanded={isCommentsOpen}
            className={isCommentsOpen ? 'pulse-post-action pulse-post-action--active' : 'pulse-post-action'}
            onClick={() => setIsCommentsOpen(true)}
            type="button"
          >
            <MessageCircle size={16} />
            <span>{commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}</span>
          </button>
          <button
            className="pulse-post-action"
            onClick={() => setReportTarget({ label: post.title, postId: post.id })}
            type="button"
          >
            <Flag size={16} />
            <span>Report</span>
          </button>
          {isPostOwner ? (
            <>
              <button
                className="pulse-post-action"
                disabled={updatePost.isPending}
                onClick={startPostEdit}
                type="button"
              >
                <Pencil size={16} />
                <span>Edit</span>
              </button>
              <button
                className="pulse-post-action pulse-post-action--danger"
                disabled={archivePost.isPending}
                onClick={hidePostFromFeed}
                type="button"
              >
                <EyeOff size={16} />
                <span>{archivePost.isPending ? 'Hiding' : 'Hide'}</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
      {toggleReaction.error ? <p className="pulse-form-error">{toggleReaction.error.message}</p> : null}
      {archivePost.error ? <p className="pulse-form-error">{archivePost.error.message}</p> : null}
    </PulseCard>

      {isCommentsOpen ? (
        <div className="pulse-comments-drawer" role="dialog" aria-modal="true" aria-label={`Comments on ${post.title}`}>
          <button className="pulse-comments-drawer__backdrop" aria-label="Close comments" onClick={() => setIsCommentsOpen(false)} type="button" />
          <aside className="pulse-comments-drawer__panel">
            <header className="pulse-comments-drawer__header">
              <div>
                <PulseBadge tone={postBadgeTone(post)}>{postBadge(post)}</PulseBadge>
                <h3>{commentCount ? `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : 'Start the discussion'}</h3>
              </div>
              <button aria-label="Close comments" className="pulse-comments-drawer__close" onClick={() => setIsCommentsOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>

            <section className="pulse-comments-drawer__post">
              <strong>{post.title}</strong>
              <p>{post.body}</p>
              <span>{formatPostMeta(post)} · {formatRelativeTime(post.created_at)}</span>
            </section>

            <div className="pulse-comments-drawer__body">
              {interaction?.comments.length ? (
                <div className="pulse-comments__list">
                  {interaction.comments.map((comment) => {
                    const isCommentOwner = comment.author_profile_id === profile.id;
                    const isEditingComment = editingCommentId === comment.id;
                    return (
                      <article className="pulse-comment" key={comment.id}>
                        <div className="pulse-comment__top">
                          <strong className="pulse-comment-author">
                            <span>
                              {!comment.anonymous && comment.author?.avatar_url ? (
                                <img alt="" src={comment.author.avatar_url} />
                              ) : (
                                (comment.anonymous ? 'A' : comment.author?.display_name ?? 'P').slice(0, 1).toUpperCase()
                              )}
                            </span>
                            {comment.anonymous ? 'Anonymous student' : comment.author?.display_name ?? 'Pulse member'}
                          </strong>
                          <div className="pulse-comment__actions">
                            {isCommentOwner ? (
                              <>
                                <button
                                  aria-label="Edit comment"
                                  className="pulse-comment__report"
                                  onClick={() => startCommentEdit(comment.id, comment.body)}
                                  type="button"
                                >
                                  <Pencil size={14} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  aria-label="Delete comment"
                                  className="pulse-comment__report pulse-comment__report--danger"
                                  disabled={deleteComment.isPending}
                                  onClick={() => removeComment(comment.id)}
                                  type="button"
                                >
                                  <Trash2 size={14} />
                                  <span>Delete</span>
                                </button>
                              </>
                            ) : null}
                            <button
                              aria-label="Report comment"
                              className="pulse-comment__report"
                              onClick={() =>
                                setReportTarget({
                                  commentId: comment.id,
                                  label: `Comment on ${post.title}`
                                })
                              }
                              type="button"
                            >
                              <Flag size={14} />
                              <span>Report</span>
                            </button>
                          </div>
                        </div>
                        {isEditingComment ? (
                          <form className="pulse-comment-edit-form" onSubmit={submitCommentEdit}>
                            <textarea
                              maxLength={12000}
                              minLength={1}
                              onChange={(event) => setEditingCommentBody(event.target.value)}
                              required
                              rows={3}
                              value={editingCommentBody}
                            />
                            <div className="pulse-owner-action-row">
                              <button className="pulse-button pulse-button--primary" disabled={updateComment.isPending || !editingCommentBody.trim()} type="submit">
                                {updateComment.isPending ? 'Saving' : 'Save'}
                              </button>
                              <button className="pulse-button pulse-button--ghost" onClick={cancelCommentEdit} type="button">
                                Cancel
                              </button>
                            </div>
                            {updateComment.error ? <p className="pulse-form-error">{updateComment.error.message}</p> : null}
                          </form>
                        ) : (
                          <p>{comment.body}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="pulse-comments__empty">
                  <MessageCircle size={18} />
                  <span>Be the first to add a useful reply.</span>
                </div>
              )}
            </div>

            <form className="pulse-comment-form pulse-comments-drawer__form" onSubmit={submitComment}>
              <textarea
                onChange={(event) => setCommentBody(event.target.value)}
                onInput={(event) => {
                  const textarea = event.currentTarget;
                  textarea.style.height = 'auto';
                  textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
                }}
                placeholder="Share a helpful reply or student perspective"
                required
                rows={1}
                value={commentBody}
              />
              <label>
                <input
                  checked={commentAnonymous}
                  onChange={(event) => setCommentAnonymous(event.target.checked)}
                  type="checkbox"
                />
                <span>Anonymous</span>
              </label>
              <button className="pulse-button pulse-button--ghost" disabled={createComment.isPending || !commentBody.trim()} type="submit">
                {createComment.isPending ? 'Sending' : 'Comment'}
              </button>
              {createComment.error ? <p className="pulse-form-error">{createComment.error.message}</p> : null}
              {deleteComment.error ? <p className="pulse-form-error">{deleteComment.error.message}</p> : null}
            </form>
          </aside>
        </div>
      ) : null}

      {reportTarget ? (
        <div className="pulse-report-dialog" role="dialog" aria-modal="true" aria-label="Report Pulse content">
          <form className="pulse-report-dialog__panel" onSubmit={submitReport}>
            <button aria-label="Close report dialog" className="pulse-report-dialog__close" onClick={closeReportDialog} type="button">
              <X size={18} />
            </button>
            <PulseBadge tone="coral">Safety report</PulseBadge>
            <h3>Report this content</h3>
            <p>{reportTarget.label}</p>
            <label>
              <span>Reason</span>
              <select
                onChange={(event) => setReportReason(event.target.value as (typeof reportReasons)[number]['value'])}
                value={reportReason}
              >
                {reportReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Details</span>
              <textarea
                onChange={(event) => setReportDetails(event.target.value)}
                placeholder="Add context for the moderation team"
                rows={4}
                value={reportDetails}
              />
            </label>
            {createReport.error ? <p className="pulse-form-error">{createReport.error.message}</p> : null}
            <button className="pulse-button pulse-button--primary" disabled={createReport.isPending} type="submit">
              <span>{createReport.isPending ? 'Submitting report' : 'Submit report'}</span>
              <Flag size={18} />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function PulseHappeningStrip({
  interactions,
  posts,
  profile
}: {
  interactions?: Map<string, PulsePostInteractionSummary>;
  posts: PulsePost[];
  profile: PulseProfile;
}) {
  const now = Date.now();
  const freshPosts = posts.filter((post) => now - new Date(post.created_at).getTime() <= 24 * 60 * 60 * 1000).length;
  const discussions = posts.reduce((total, post) => total + (interactions?.get(post.id)?.commentCount ?? 0), 0);
  const recognized = posts.reduce((total, post) => total + (interactions?.get(post.id)?.reactionCount ?? 0), 0);
  const collegePosts = posts.filter((post) => post.visibility === 'college' && post.college_id === profile.college_id).length;

  const cards = [
    {
      icon: Clock3,
      label: 'Fresh today',
      text: freshPosts ? `${freshPosts} new posts to explore` : 'Start today’s first useful post'
    },
    {
      icon: MessageCircle,
      label: 'Conversations',
      text: discussions ? `${discussions} student replies` : 'Reply to make the feed move'
    },
    {
      icon: Award,
      label: 'Recognition',
      text: recognized ? `${recognized} recognizes given` : 'Notice good work early'
    },
    {
      icon: UsersRound,
      label: 'Your college',
      text: profile.college_id ? `${collegePosts} college-space posts` : 'Select college to unlock this'
    }
  ];

  return (
    <div className="pulse-happening-strip" aria-label="Pulse activity summary">
      <div className="pulse-happening-strip__intro">
        <PulseBadge tone="gold">Happening now</PulseBadge>
        <strong>Join what community members are already building, asking, and celebrating.</strong>
      </div>
      <div className="pulse-happening-strip__cards">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="pulse-happening-card" key={card.label}>
              <Icon size={18} />
              <span>{card.label}</span>
              <strong>{card.text}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PulseHomePage() {
  const { getLmsHandoffUrl, status } = useAuth();
  const location = useLocation();
  const activeFilter = feedFilterFromPath(location.pathname);
  const viewContent = feedViewContent[activeFilter];
  const profileQuery = usePulseProfile();
  const profileDefaults = usePulseProfileDefaults();
  const profile = profileQuery.data;
  const feedQuery = usePulseFeed(profile, activeFilter);
  const interactionsQuery = usePulsePostInteractions(feedQuery.data, profile);
  const storedInviteCode = useStoredPulseInviteCode();
  const acceptInvite = useAcceptPulseInvite();
  const [processedInviteCode, setProcessedInviteCode] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<PulseQuickFeedFilter>('recent');
  const [newFeedUpdateCount, setNewFeedUpdateCount] = useState(0);

  const recognitionCount = useMemo(
    () => (feedQuery.data ?? []).filter((post) => post.post_type === 'recognition' || post.post_type === 'shoutout').length,
    [feedQuery.data]
  );

  const visiblePosts = useMemo(() => {
    const posts = [...(feedQuery.data ?? [])];
    const interactionMap = interactionsQuery.data;

    if (quickFilter === 'college') {
      return posts.filter((post) => post.visibility === 'college' && (!profile?.college_id || post.college_id === profile.college_id));
    }

    if (quickFilter === 'opportunities') {
      return posts.filter((post) => post.post_type === 'opportunity');
    }

    if (quickFilter === 'shoutouts') {
      return posts.filter((post) => post.post_type === 'recognition' || post.post_type === 'shoutout');
    }

    if (quickFilter === 'popular') {
      return posts.sort((first, second) => {
        const firstReactions = interactionMap?.get(first.id)?.reactionCount ?? 0;
        const secondReactions = interactionMap?.get(second.id)?.reactionCount ?? 0;
        return secondReactions - firstReactions || new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
      });
    }

    if (quickFilter === 'answered') {
      return posts
        .filter((post) => (interactionMap?.get(post.id)?.commentCount ?? 0) > 0)
        .sort((first, second) => {
        const firstComments = interactionMap?.get(first.id)?.commentCount ?? 0;
        const secondComments = interactionMap?.get(second.id)?.commentCount ?? 0;
        return secondComments - firstComments || new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
      });
    }

    return posts.sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime());
  }, [feedQuery.data, interactionsQuery.data, profile?.college_id, quickFilter]);

  useEffect(() => {
    document.title = 'SapiensPulse Home | Skilled Sapiens';
  }, []);

  useEffect(() => {
    if (!profile?.id || !storedInviteCode || processedInviteCode === storedInviteCode || acceptInvite.isPending) return;

    acceptInvite.mutate(storedInviteCode, {
      onSettled: () => setProcessedInviteCode(storedInviteCode)
    });
  }, [acceptInvite, processedInviteCode, profile?.id, storedInviteCode]);

  useEffect(() => {
    setNewFeedUpdateCount(0);
  }, [activeFilter, quickFilter]);

  usePulseFeedRealtime({
    enabled: status === 'authenticated',
    filter: activeFilter,
    onNewFeedUpdate: () => setNewFeedUpdateCount((count) => Math.min(count + 1, 9)),
    posts: feedQuery.data,
    profile
  });

  function showNewFeedUpdates() {
    setNewFeedUpdateCount(0);
    feedQuery.refetch();
    interactionsQuery.refetch();
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Pulse</PulseBadge>
        <h1>Opening your student community.</h1>
      </section>
    );
  }

  if (!profile) {
    return <PulseProfileOnboarding defaults={profileDefaults} />;
  }

  const lmsLearningUrl = getLmsHandoffUrl('/learning-access');

  return (
    <section className="pulse-home">
      <div className="pulse-home__hero">
        <div>
          <PulseBadge tone="coral">{viewContent.badge}</PulseBadge>
          <h1>{viewContent.title}</h1>
          <p>{viewContent.text}</p>
        </div>
        <div className="pulse-home__actions">
          <PulseButton icon={BriefcaseBusiness} to="/pulse/opportunities" variant="secondary">Explore opportunities</PulseButton>
          <PulseButton icon={BriefcaseBusiness} href={lmsLearningUrl} variant="ghost">Open My Learning</PulseButton>
        </div>
      </div>

      <nav className="pulse-feed-tabs" aria-label="Pulse feed filters">
        {feedTabs.map((tab) => (
          <NavLink key={tab.path} to={tab.path}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <PulseHappeningStrip interactions={interactionsQuery.data} posts={feedQuery.data ?? []} profile={profile} />

      <div className="pulse-feed-layout">
        <section className="pulse-feed-main" aria-label="SapiensPulse campus feed">
          <PulseComposer activeFilter={activeFilter} profile={profile} />

          {newFeedUpdateCount ? (
            <button className="pulse-feed-live-update" onClick={showNewFeedUpdates} type="button">
              <Sparkles size={16} />
              <span>{newFeedUpdateCount === 1 ? '1 new update' : `${newFeedUpdateCount} new updates`}</span>
            </button>
          ) : null}

          <div className="pulse-quick-filters" aria-label="Quick feed filters">
            {quickFeedFilters.map((filter) => {
              const disabled = filter.value === 'college' && !profile.college_id;
              return (
                <button
                  className={quickFilter === filter.value ? 'is-active' : ''}
                  disabled={disabled}
                  key={filter.value}
                  onClick={() => setQuickFilter(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {feedQuery.isLoading ? (
            <div className="pulse-feed-state">Loading fresh Pulse posts.</div>
          ) : feedQuery.error ? (
            <div className="pulse-feed-state pulse-feed-state--error">{feedQuery.error.message}</div>
          ) : visiblePosts.length ? (
            visiblePosts.map((post) => (
              <PulseFeedPost
                interaction={interactionsQuery.data?.get(post.id)}
                key={post.id}
                post={post}
                profile={profile}
              />
            ))
          ) : (
            <div className="pulse-feed-state">
              <strong>No posts match this filter.</strong>
              <span>{quickFilter === 'recent' ? viewContent.empty : 'Try another quick filter or start a fresh post.'}</span>
            </div>
          )}
        </section>

        <aside className="pulse-home-sidebar" aria-label="SapiensPulse profile and community controls">
          {acceptInvite.isPending ? (
            <PulseCard className="pulse-sidebar-card pulse-invite-acceptance">
              <PulseBadge tone="gold">Invite</PulseBadge>
              <h2>Connecting your invite.</h2>
              <span>Your Pulse access is being linked to the peer who invited you.</span>
            </PulseCard>
          ) : acceptInvite.data ? (
            <PulseCard className={`pulse-sidebar-card pulse-invite-acceptance ${acceptInvite.data.accepted ? 'pulse-invite-acceptance--success' : 'pulse-invite-acceptance--notice'}`}>
              <PulseBadge tone={acceptInvite.data.accepted ? 'green' : 'gold'}>Invite</PulseBadge>
              <h2>{acceptInvite.data.accepted ? 'Invite connected.' : 'Invite note'}</h2>
              <span>{acceptInvite.data.message}</span>
            </PulseCard>
          ) : acceptInvite.error ? (
            <PulseCard className="pulse-sidebar-card pulse-invite-acceptance pulse-invite-acceptance--error">
              <PulseBadge tone="coral">Invite</PulseBadge>
              <h2>Invite not connected.</h2>
              <span>{acceptInvite.error.message}</span>
            </PulseCard>
          ) : null}
          <PulseCard className="pulse-sidebar-card">
            <PulseBadge tone="brand">Before you post</PulseBadge>
            <h2>Keep it clear and useful.</h2>
            <span><LockKeyhole size={16} /> Pick the audience: your college or everyone on Pulse.</span>
            <span><MessageCircle size={16} /> Use anonymous only when the topic needs it.</span>
            <span><Globe2 size={16} /> Share questions, ideas, updates, or shout-outs students can act on.</span>
          </PulseCard>
          <PulseCard className="pulse-sidebar-card pulse-sidebar-card--live">
            <PulseBadge tone="coral">Feed ideas</PulseBadge>
            <h2>Make Pulse useful today.</h2>
            <span><Megaphone size={16} /> Ask what your batch needs help with this week.</span>
            <span><TrendingUp size={16} /> Share a trend, resource, or project lead others can use.</span>
            <span><Sparkles size={16} /> Recognize a classmate whose work deserves visibility.</span>
          </PulseCard>
          <PulseCard className="pulse-sidebar-card pulse-sidebar-card--gold">
            <PulseBadge tone="gold">Shout-outs</PulseBadge>
            <h2>{recognitionCount ? `${recognitionCount} spotlight posts` : 'Shout-out wall'}</h2>
            <span><Award size={16} /> Celebrate helpful classmates, strong ideas, project wins, and peer support.</span>
          </PulseCard>
        </aside>
      </div>
    </section>
  );
}
