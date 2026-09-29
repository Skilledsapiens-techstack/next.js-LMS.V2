# SapiensPulse V1 Blueprint

## Product Thesis

SapiensPulse is a student-first campus community and opportunity network by Skilled Sapiens.

It should not feel like an LMS, portal, or college admin system. It should feel like a fast, full-page student website where campus conversations, peer recognition, and career opportunities live together.

The core promise:

> Where campus conversations turn into career opportunities.

SapiensPulse is the daily engagement layer. The LMS remains the structured learning layer.

## Brand Architecture

- Parent brand: Skilled Sapiens
- Community product: SapiensPulse
- Learning product: Skilled Sapiens LMS or My Learning

Recommended domain structure:

```txt
skilledsapiens.com          WordPress brand and marketing site
skilledsapiens.com/pulse    Pulse marketing page or redirect
pulse.skilledsapiens.com    SapiensPulse app
login.skilledsapiens.com    Current LMS/member access
```

Long-term naming recommendation:

```txt
pulse.skilledsapiens.com    Community, opportunities, recognition
learn.skilledsapiens.com    Structured learning, programs, resources
```

## Product Separation

Pulse should be a separate product surface, not a visual extension of the LMS.

Use the same underlying account, profile, college, opportunity, and learning access data where useful, but keep the experience distinct:

- Pulse uses a full website-style layout.
- LMS keeps structured learning workflows.
- Existing LMS members get Pulse access automatically.
- Pulse-only users can join community and opportunities without seeing paid LMS content.
- LMS access appears in Pulse as `My Learning`, not as `LMS portal`.

## V1 Target User

Primary V1 user:

- B-school student
- Wants peer connection, candid discussion, recognition, projects, internships, freelance work, and career visibility
- Does not want another academic portal
- Is likely to join through WhatsApp, Instagram, referral link, peer invite, or campus ambassador

Secondary V1 user:

- Existing LMS member
- Should land in Pulse by default and move smoothly into My Learning when needed

Internal V1 user:

- Skilled Sapiens operator/moderator
- Manages safety, invites, opportunities, featured content, and reports

## V1 Launch Strategy

Start with one college only.

Reason:

- Student communities need density before scale.
- One active campus is more valuable than ten quiet campuses.
- The first college becomes the proof case for future launches.

Recommended first-college criteria:

- Easy student access through warm connections
- 500-2,000 relevant students
- Active WhatsApp or Instagram groups
- Student clubs or placement-focused student committees
- Real demand for internships, live projects, freelance gigs, resume support, or company exposure

Do not involve college admin in V1 launch unless they naturally come later. Launch as an unofficial student-led community with strong platform-level moderation.

## 30-Day Launch Plan

### Week 0: Founding Circle

Recruit 15-25 founding students:

- Placement committee members
- Student council members
- Club heads
- E-cell members
- Popular/socially active students
- Content creators
- Strong academic performers
- Students actively looking for internships/projects

Give them:

- Founding Member badge
- Higher invite quota
- Early access to opportunities
- Recognition on Pulse
- Priority for live project consideration

### Week 1: Closed Beta

Invite 50-100 students.

Seed:

- 20-30 posts
- 8-10 polls
- 10 shout-out prompts
- 3-5 opportunity cards
- 5 discussion prompts

Goal:

- Make the feed feel alive before the wider launch.

### Week 2: Referral Push

Open invite-led growth.

Each normal student gets 3 invites. Founding members get 10. Ambassadors get 25-50.

Campaign hooks:

- Your campus has a pulse.
- Be candid, not cruel.
- Find people building what you care about.
- Vote which opportunities should come next.
- Bring your closest campus circle.

### Week 3: Opportunity Drop

Release:

- 2 live projects
- 2 freelance-style tasks
- 1 resume/profile review campaign
- 1 campus ambassador opportunity
- 1 company or business challenge

This proves Pulse is not just a conversation feed.

### Week 4: Recognition And Recap

Publish a student-facing recap:

- Top polls
- Top student concerns
- Most wanted opportunity domains
- Top shout-outs
- Featured ideas
- Opportunity interest numbers
- Founding contributors

Do not expose private identities or anonymous post authors.

## V1 Feature Scope

Build only what creates habit, trust, and opportunity interest.

Must-have:

- Full-page Pulse app layout
- Invite/referral onboarding
- Student profile creation and editing
- College-specific community feed
- Global feed with controlled rules
- Post composer
- Anonymous posting for allowed college-only categories
- Polls
- Shout-outs
- Comments
- Likes/upvotes
- Opportunity cards
- Opportunity interest tracking
- Report content flow
- Internal moderation queue
- Featured posts/recognition
- Basic analytics

Defer:

- Direct messaging
- Company dashboard
- Full job portal workflow
- Complex clubs/groups
- Inter-college private groups
- Mobile app
- Cash referral rewards
- Full gamification
- Advanced recommendation engine

## Feed Visibility Model

Every post should have a visibility setting:

```txt
college_only
global
```

Posting UI:

- `My college only` should be the default.
- `Across campuses` should be optional.

Recommended V1 rule:

- College-only feed is for candid, local student community.
- Global feed is for ideas, articles, career questions, opportunities, achievements, and cross-campus discussion.

Global should not be an uncontrolled open wall in V1.

## Anonymous Posting Rules

Use this rule:

> Anonymous to peers, accountable to platform moderation.

Anonymous posts must store the real `profile_id` internally but show an anonymous label publicly.

Recommended V1:

- Anonymous + college-only: allowed for selected categories
- Anonymous + global: disabled initially or requires moderation before publish
- Named + global: allowed for approved categories

Anonymous allowed categories:

- Campus Buzz
- Ask Anything
- Confessions
- Placement Concerns
- Suggestions
- Poll discussion

Anonymous restricted categories:

- Opportunities
- Articles
- Shout-outs
- Achievements
- Professional profile updates
- Posts naming specific people negatively

Community tone rule:

> Be candid, not cruel.

## Content Categories

Recommended V1 categories:

- Campus Buzz
- Ask Anything
- Confessions
- Polls
- Shout-outs
- Ideas
- Articles
- Placements
- Live Projects
- Freelance Gigs
- Events
- Help Needed

Category metadata should define:

- Anonymous allowed
- Global allowed
- Requires pre-moderation
- Can be featured
- Can include poll
- Can link opportunity

## Invite And Referral Model

Referral tracking is core to V1.

Every student profile should have:

- Referral code
- Referral link
- Invite quota
- Invites used
- Successful referrals
- Referred by profile
- Joined from channel
- Joined from campaign

Recommended invite quotas:

- Founding member: 10
- Normal member: 3
- Ambassador: 25-50
- Internal operator: unlimited

Referral code examples:

```txt
JIMS-RIYA7
NDIM-AMIT4
SP-8F4K2
```

Recommended format:

```txt
college_prefix + readable_name_or_alias + short_random_code
```

Avoid depending on full names for privacy.

## Student Profile Model

Profile creation should be mandatory enough for quality, but short enough to avoid signup drop-off.

Required during onboarding:

- Name
- Username
- College
- Program
- Batch/year

Prompt after entry:

- Profile photo/avatar
- Bio
- Skills
- Interests
- Looking for
- LinkedIn
- Portfolio/resume link

Recommended public profile sections:

- Header with photo, name, username, college, program, batch
- Bio
- Looking for chips
- Skills chips
- Interests
- Badges
- Shout-outs received
- Featured posts/articles
- Opportunities interested/applied
- LMS achievements, if the user has LMS access

Privacy defaults:

- Visible to college peers: on
- Visible across campuses: user choice
- Visible to opportunity partners: off until applying or opting in
- Show LinkedIn/resume: user choice
- Show anonymous activity: never

## Smooth Pulse To LMS Transition

Use one account and one profile.

Pulse navigation for LMS members:

```txt
Pulse
Opportunities
People
Recognition
My Learning
```

`My Learning` opens the LMS/member learning experience.

Pulse-only users clicking `My Learning` should see a soft locked state:

- Explore programs
- Request access
- See benefits
- No hard error page

LMS member experience:

- Existing LMS users land on Pulse by default.
- LMS becomes `My Learning`.
- LMS pages include `Back to Pulse`.
- Learning achievements can appear on Pulse profiles where appropriate.

Bridge examples:

- Opportunity card -> Prepare for this project
- Live project post -> Open project workspace
- Certificate -> Share recognition on Pulse
- Recording/resource -> Discuss in Pulse
- Profile -> View learning achievements

## UX Direction

Pulse should feel like a modern student website, closer to an opportunity/community marketplace than a portal.

Use:

- Full-width product pages
- Top navigation
- Search-first discovery
- Category tabs/chips
- Feed cards
- Opportunity cards
- Recognition sections
- Profile cards
- Mobile-first navigation
- Fast optimistic interactions

Avoid:

- Portal sidebar as primary Pulse navigation
- Dashboard-heavy module cards
- Table-first UI
- `Student Portal` language
- `Guest Login` language
- Heavy full-page loaders
- LMS/course-first homepage

Recommended labels:

- `Join Pulse`
- `Create student profile`
- `Continue to Pulse`
- `My Learning`
- `Across Campuses`
- `My College`

Avoid labels:

- `Guest Login`
- `LMS`
- `Portal`
- `Module`

## Reusable Component Strategy

Build standard Pulse components before building all feature pages.

Core UI:

- `PulseButton`
- `PulseCard`
- `PulseBadge`
- `PulseTabs`
- `PulseNav`
- `PulseSearch`
- `PulseAvatar`
- `PulseModal`
- `PulseDropdown`
- `PulseToast`
- `PulseEmptyState`
- `PulseSkeleton`
- `PulseMetricCard`

Product components:

- `PulsePostCard`
- `PulsePostComposer`
- `PulseCommentThread`
- `PulsePollCard`
- `PulseOpportunityCard`
- `PulseRecognitionCard`
- `PulseProfileCard`
- `PulseVisibilitySelector`
- `PulseAnonymousToggle`
- `PulseReportDialog`

Layouts:

- `PulsePublicLayout`
- `PulseAppLayout`
- `PulseAuthLayout`
- `PulseModerationLayout`

Add a lightweight internal UI kit page:

```txt
/pulse/dev/ui-kit
```

This page should render all standard components, states, and responsive variants.

## Speed And Performance Principles

Speed is a product feature for Pulse.

Principle:

> Every click should show something instantly, then refresh quietly in the background.

Rules:

- No blocking dashboard-style first load.
- Keep route transitions instant.
- Use cached data immediately.
- Use skeletons only for missing sections.
- Optimistically update likes, votes, saves, and comments.
- Keep feed scroll state on back navigation.
- Load comments only when a post is opened.
- Load media lazily.
- Avoid loading hidden modal trees and heavy libraries upfront.
- Paginate all feeds and lists.
- Use small API payloads.
- Track Core Web Vitals from day one.

Target experience:

- First meaningful screen: under 1 second on good mobile internet
- Click feedback: under 100 ms
- Feed request: under 300-500 ms
- Like/poll perceived response: instant
- No full-page loader after initial auth/profile check

## Recommended Technical Architecture

Short-term V1:

- Build Pulse as a separate product surface in the existing repo or a clean app folder.
- Reuse current auth, user, college, and LMS access foundations where practical.
- Do not mix Pulse pages into the current LMS portal shell.

Long-term recommended stack:

- Next.js App Router
- React
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage or Cloudflare R2 for media
- Cloudflare CDN
- TanStack Query for client cache
- PostHog for product analytics
- Sentry for error/performance monitoring
- Meilisearch, Typesense, or Algolia for search once needed
- Queue/background jobs for notifications, moderation, and digests

Recommended monorepo direction:

```txt
apps/
  pulse-web/
  lms-web/
packages/
  pulse-ui/
  shared-auth/
  shared-db/
  shared-config/
```

If staying in the current app for early implementation:

```txt
src/pulse/
  components/
  features/
  layouts/
  lib/
  styles/
```

## Data Access Pattern

Do not query Supabase randomly inside UI components.

Create focused hooks/services:

- `usePulseProfile`
- `useUpdatePulseProfile`
- `usePulseFeed`
- `useCreatePulsePost`
- `usePulseComments`
- `usePulseReactions`
- `usePulsePollVote`
- `usePulseOpportunities`
- `usePulseReferral`
- `usePulseModerationQueue`

All list reads must be paginated.

All writes must validate:

- User profile exists
- College/community membership exists
- Visibility is allowed
- Anonymous mode is allowed for category and visibility
- Rate limits are respected
- Report/moderation rules are respected

## Suggested Database Model

Core:

```txt
pulse_colleges
pulse_profiles
pulse_invites
pulse_posts
pulse_comments
pulse_reactions
pulse_reports
pulse_polls
pulse_poll_options
pulse_poll_votes
pulse_opportunities
pulse_opportunity_interests
pulse_featured_items
```

Later:

```txt
pulse_profile_badges
pulse_notifications
pulse_saved_items
pulse_search_index_events
pulse_moderation_actions
pulse_rate_limit_events
```

Recommended enum-style fields:

```txt
post_visibility: college_only, global
post_identity_mode: named, anonymous
post_status: draft, published, pending_review, hidden, removed
profile_role: pulse_user, lms_member, campus_ambassador, moderator, admin, super_admin
verification_status: unverified, invite_verified, college_verified, blocked
opportunity_type: live_project, freelance_gig, internship, challenge, ambassador, resume_review
```

## Feed Query Design

Do not compute the feed through expensive live joins.

Store denormalized counters on posts:

- `comment_count`
- `reaction_count`
- `poll_vote_count`
- `report_count`
- `score`
- `last_activity_at`

Load 15-20 posts per request.

Feed card payload should include:

- Post id
- Author display identity
- Anonymous label if anonymous
- Category
- Visibility
- Title/body excerpt
- Counts
- Current viewer reaction state
- Poll summary if poll
- Opportunity reference if linked
- Created timestamp

Do not include:

- All comments
- All reactions
- Full author profile
- Full opportunity object unless needed
- Large media payloads

Recommended indexes:

```sql
-- Pattern examples only; final names and columns should match the migration.
create index on pulse_posts (college_id, visibility, status, created_at desc);
create index on pulse_posts (visibility, status, created_at desc);
create index on pulse_posts (author_profile_id, created_at desc);
create index on pulse_posts (post_type, status, created_at desc);
create index on pulse_comments (post_id, created_at asc);
create index on pulse_reactions (post_id, profile_id);
create index on pulse_poll_votes (poll_id, profile_id);
create index on pulse_invites (referral_code);
create index on pulse_profiles (user_id);
create index on pulse_profiles (college_id, username);
```

## Security And RLS Principles

Every exposed Supabase table must have RLS enabled.

V1 access rules:

- Students can view published college-only posts from their own college.
- Students can view published global posts.
- Students can create posts only as their own profile.
- Students can edit/delete their own posts while allowed by status.
- Students cannot see the real author identity behind anonymous posts unless they are authorized moderators.
- Students can report content.
- Moderators can review reported content for their scope.
- Super admins can manage all Pulse content.

Do not use user-editable metadata for authorization. Store roles and access state in trusted tables or app metadata managed by the server.

Anonymous does not mean untraceable internally.

## Moderation Model

V1 moderation should be platform-led.

Must-have:

- Report button on posts/comments
- Auto-hide threshold after repeated reports
- Keyword/blocklist checks
- Moderation queue
- Hide/remove actions
- Internal identity trace for anonymous content
- Account suspension/block state

Recommended policy:

- Global anonymous posts require pre-moderation or are disabled in V1.
- Posts naming individuals negatively should be blocked or sent to review.
- Serious reports should hide content pending review.

Moderation status:

```txt
published
pending_review
hidden
removed
```

## Analytics

Track from day one:

- Signups
- Activated profiles
- Referral source
- Successful referrals
- Daily active users
- Weekly active users
- Posts created
- Anonymous posts
- Comments
- Reactions
- Poll votes
- Opportunity views
- Opportunity interests
- Reports
- Hidden/removed content
- Profile completion
- Pulse to My Learning clicks

First 30-day success targets:

- 300-500 signups
- 100+ weekly active students
- 50+ posts
- 300+ poll votes
- 100+ comments/reactions
- 50+ opportunity interests
- 10+ shout-outs
- Less than 5 serious moderation issues

Most important metric:

> Repeat usage, not total signups.

## V1 Route Map

Public:

```txt
/pulse
/pulse/join/:referralCode
/pulse/login
/pulse/campus/:collegeSlug
```

Logged in:

```txt
/pulse/home
/pulse/my-college
/pulse/global
/pulse/opportunities
/pulse/opportunities/:opportunityId
/pulse/recognition
/pulse/profile
/pulse/profile/edit
/pulse/profile/:username
/pulse/my-learning
```

Internal moderation:

```txt
/pulse/moderation
/pulse/moderation/reports
/pulse/moderation/posts
/pulse/moderation/opportunities
```

## Recommended Build Order

### Sprint 1: Pulse Foundation

- Pulse route namespace
- Pulse app shell
- Pulse design tokens
- Reusable UI components
- UI kit page
- Auth/profile guard
- Basic profile onboarding

### Sprint 2: Data Foundation

- Supabase migration for Pulse core tables
- RLS policies
- Typed data services/hooks
- Seed college and categories
- Referral code generation

### Sprint 3: Feed MVP

- Feed read path
- Post composer
- Visibility selector
- Anonymous toggle
- Post cards
- Reactions
- Comments
- Report button

### Sprint 4: Polls, Shout-Outs, Recognition

- Poll creation and voting
- Shout-out post type
- Featured posts
- Recognition wall

### Sprint 5: Opportunities

- Opportunity cards
- Opportunity detail
- Interest tracking
- Opportunity widgets in feed/home

### Sprint 6: Moderation And Launch Analytics

- Moderation queue
- Report handling
- Auto-hide threshold
- Basic analytics dashboard
- Launch checklist

## Open Decisions

These should be decided before implementation:

- First college name and expected student count
- Final invite quotas
- Whether global anonymous posts are disabled or pre-moderated
- Exact first opportunity inventory
- Final Pulse visual direction and color system
- Whether V1 is built inside current Vite app first or as a separate Next.js app immediately
- Whether `login.skilledsapiens.com` remains LMS-only or also hosts shared auth callbacks

## Recommended Immediate Next Step

Create a Pulse Foundation Sprint ticket/spec with:

- Route map
- Layout wireframes
- Component inventory
- Supabase migration draft
- RLS rule draft
- First-college launch checklist

Then implement the foundation before building feature depth.
