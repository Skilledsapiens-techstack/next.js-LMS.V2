# SapiensPulse Foundation Sprint

## Objective

Create the technical and UX foundation for SapiensPulse without restructuring the existing LMS product.

This sprint should make Pulse feel like a separate full-page student website while preserving shared account, auth, and future LMS transition paths.

## Product Boundary

Pulse code starts in:

```txt
src/pulse/
```

Current LMS code remains in:

```txt
src/pages/
src/features/
src/components/
src/layouts/
```

Shared platform changes should be intentional and documented when touching:

```txt
src/app/
src/auth/
src/lib/
src/config/
src/styles/global.css
```

## Sprint 1 Scope

Build foundation, not the full community engine.

Included:

- Pulse folder boundary
- Pulse route namespace plan
- Pulse layout plan
- Reusable component inventory
- Profile onboarding/edit shell plan
- Invite/referral entry flow plan
- Supabase schema draft for core identity tables
- RLS rule draft
- Performance rules
- QA checklist

Excluded:

- Full feed implementation
- Full comments/reactions implementation
- Poll voting implementation
- Company dashboard
- Direct messaging
- LMS folder migration

## Route Plan

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
/pulse/recognition
/pulse/profile
/pulse/profile/edit
/pulse/my-learning
```

Internal:

```txt
/pulse/moderation
```

## Layouts

Create these Pulse-only layouts:

- `PulsePublicLayout`: public landing, join, campus preview
- `PulseAppLayout`: logged-in Pulse website shell with top nav
- `PulseAuthLayout`: login/onboarding flows
- `PulseModerationLayout`: internal moderation tools

Pulse must not reuse the LMS portal sidebar as its primary shell.

## Navigation

Pulse top navigation:

- Pulse
- My College
- Across Campuses
- Opportunities
- Recognition
- My Learning

`My Learning` behavior:

- LMS member: open learning area
- Pulse-only user: show soft locked state with program discovery/request access

## Reusable Components

Create or plan these first:

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
- `PulsePostCard`
- `PulsePostComposer`
- `PulsePollCard`
- `PulseOpportunityCard`
- `PulseRecognitionCard`
- `PulseProfileCard`
- `PulseVisibilitySelector`
- `PulseAnonymousToggle`
- `PulseReportDialog`

Add an internal UI preview page later:

```txt
/pulse/dev/ui-kit
```

## Profile Foundation

Required onboarding fields:

- Name
- Username
- College
- Program
- Batch/year

Optional profile completion fields:

- Photo/avatar
- Bio
- Skills
- Interests
- Looking for
- LinkedIn
- Portfolio/resume URL

Profile rules:

- Students can edit their profile later.
- Referral code should not change after creation.
- College change after verification should require review.
- Anonymous post identity must never appear on public profiles.

## Invite And Referral Foundation

V1 should support invite-only access.

Required:

- Unique referral code per profile
- Referral link
- Invite quota
- Successful referral count
- Referred-by tracking
- Joined-from channel/campaign tracking

Initial quotas:

- Founding member: 10
- Normal member: 3
- Ambassador: 25-50
- Internal operator: unlimited

## Supabase Schema Draft

Core identity tables for foundation:

```txt
pulse_colleges
pulse_profiles
pulse_invites
```

Next sprint tables:

```txt
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

Recommended foundation fields:

```txt
pulse_profiles
- id
- user_id
- username
- display_name
- avatar_url
- college_id
- program
- batch_year
- specialization
- bio
- skills
- interests
- looking_for
- linkedin_url
- portfolio_url
- resume_url
- visibility_scope
- company_visibility
- referral_code
- referred_by_profile_id
- invite_quota
- invites_used
- successful_referrals
- account_status
- verification_status
- created_at
- updated_at
```

## RLS Draft

Every exposed Pulse table must have RLS enabled.

Foundation rules:

- Authenticated students can read their own profile.
- Authenticated students can update their own editable profile fields.
- Students cannot update their own role, account status, verification status, referral code, or moderation state.
- Public profile reads should respect visibility settings.
- Referral/invite writes must prevent self-referrals.
- Internal roles can review profiles and referral activity.

Do not authorize from user-editable metadata.

## Performance Rules

Pulse should behave like a fast consumer website.

Rules:

- Every click gets immediate visual feedback.
- Avoid full-page loaders after initial auth/profile check.
- Use small page payloads.
- Use skeletons only for missing sections.
- Use optimistic UI for likes, votes, saves, and comments in later sprints.
- Use route-level lazy loading/code splitting.
- Keep feed, opportunity, and profile list reads paginated.
- Do not load all comments with feed cards.

Targets:

- First meaningful screen under 1 second on good mobile internet
- Click feedback under 100 ms
- Feed request under 300-500 ms once implemented

## QA Checklist

Before completing Sprint 1:

- Pulse folder boundary exists and is documented.
- No LMS folder migration has been performed.
- Pulse route plan is documented.
- Pulse component inventory is documented.
- Auth/profile transition rules are documented.
- Supabase foundation schema draft exists.
- RLS principles are documented.
- Build/typecheck passes after any implementation code is added.

## Next Implementation Step

After this sprint doc, implement:

1. Pulse route namespace.
2. Pulse public landing shell.
3. Pulse app layout shell.
4. Pulse profile onboarding/edit shell.
5. Pulse UI components baseline.
6. Supabase migration draft for `pulse_colleges`, `pulse_profiles`, and `pulse_invites`.
