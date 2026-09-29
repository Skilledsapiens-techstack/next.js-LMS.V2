create extension if not exists pgcrypto;

create table if not exists public.pulse_colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  state text,
  country text not null default 'India',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_colleges_status_check check (status in ('active', 'paused', 'archived'))
);

create table if not exists public.pulse_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  student_id uuid unique references public.students(id) on delete set null,
  college_id uuid references public.pulse_colleges(id) on delete set null,
  display_name text not null,
  headline text,
  bio text,
  avatar_url text,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  profile_visibility text not null default 'college',
  pulse_status text not null default 'active',
  referral_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  referred_by_profile_id uuid references public.pulse_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_profiles_visibility_check check (profile_visibility in ('public', 'college', 'private')),
  constraint pulse_profiles_status_check check (pulse_status in ('active', 'paused', 'blocked')),
  constraint pulse_profiles_display_name_check check (length(btrim(display_name)) between 2 and 120)
);

create table if not exists public.pulse_invites (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  invited_email text,
  invited_by_profile_id uuid references public.pulse_profiles(id) on delete set null,
  college_id uuid references public.pulse_colleges(id) on delete set null,
  status text not null default 'pending',
  accepted_by_profile_id uuid references public.pulse_profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_invites_status_check check (status in ('pending', 'accepted', 'expired', 'cancelled'))
);

create table if not exists public.pulse_posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  college_id uuid references public.pulse_colleges(id) on delete set null,
  post_type text not null default 'discussion',
  visibility text not null default 'college',
  anonymous boolean not null default false,
  title text not null,
  body text not null,
  status text not null default 'published',
  pinned boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_posts_type_check check (post_type in ('discussion', 'poll', 'article', 'recognition', 'opportunity', 'shoutout', 'announcement')),
  constraint pulse_posts_visibility_check check (visibility in ('global', 'college')),
  constraint pulse_posts_status_check check (status in ('draft', 'published', 'hidden', 'archived', 'under_review')),
  constraint pulse_posts_title_check check (length(btrim(title)) between 3 and 180),
  constraint pulse_posts_body_check check (length(btrim(body)) between 1 and 12000)
);

create table if not exists public.pulse_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.pulse_posts(id) on delete cascade,
  author_profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  body text not null,
  anonymous boolean not null default false,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_comments_status_check check (status in ('published', 'hidden', 'archived', 'under_review')),
  constraint pulse_comments_body_check check (length(btrim(body)) between 1 and 4000)
);

create table if not exists public.pulse_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.pulse_posts(id) on delete cascade,
  comment_id uuid references public.pulse_comments(id) on delete cascade,
  profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  constraint pulse_reactions_type_check check (reaction_type in ('like', 'celebrate', 'insightful', 'support', 'vote')),
  constraint pulse_reactions_single_target_check check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

create table if not exists public.pulse_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.pulse_posts(id) on delete cascade,
  comment_id uuid references public.pulse_comments(id) on delete cascade,
  reporter_profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  resolution_note text,
  reviewed_by_auth_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint pulse_reports_single_target_check check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  ),
  constraint pulse_reports_reason_check check (length(btrim(reason)) between 3 and 120)
);

create table if not exists public.pulse_opportunities (
  id uuid primary key default gen_random_uuid(),
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  college_id uuid references public.pulse_colleges(id) on delete set null,
  title text not null,
  company_name text,
  opportunity_type text not null default 'live_project',
  description text not null,
  visibility text not null default 'global',
  status text not null default 'active',
  application_url text,
  starts_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_opportunities_type_check check (opportunity_type in ('live_project', 'freelance', 'challenge', 'resume_review', 'event')),
  constraint pulse_opportunities_visibility_check check (visibility in ('global', 'college')),
  constraint pulse_opportunities_status_check check (status in ('draft', 'active', 'paused', 'closed', 'archived')),
  constraint pulse_opportunities_title_check check (length(btrim(title)) between 3 and 180),
  constraint pulse_opportunities_description_check check (length(btrim(description)) between 1 and 12000)
);

create table if not exists public.pulse_opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.pulse_opportunities(id) on delete cascade,
  profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  status text not null default 'interested',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_opportunity_applications_status_check check (status in ('interested', 'applied', 'shortlisted', 'selected', 'rejected', 'withdrawn')),
  constraint pulse_opportunity_applications_unique unique (opportunity_id, profile_id)
);

create index if not exists pulse_colleges_status_idx on public.pulse_colleges (status);
create index if not exists pulse_profiles_college_status_idx on public.pulse_profiles (college_id, pulse_status);
create index if not exists pulse_profiles_student_idx on public.pulse_profiles (student_id);
create index if not exists pulse_invites_referral_status_idx on public.pulse_invites (referral_code, status);
create index if not exists pulse_posts_feed_idx on public.pulse_posts (visibility, college_id, status, pinned desc, created_at desc);
create index if not exists pulse_posts_author_idx on public.pulse_posts (author_profile_id, created_at desc);
create index if not exists pulse_comments_post_idx on public.pulse_comments (post_id, status, created_at);
create index if not exists pulse_reports_status_idx on public.pulse_reports (status, created_at desc);
create index if not exists pulse_opportunities_feed_idx on public.pulse_opportunities (visibility, college_id, status, created_at desc);

create unique index if not exists pulse_reactions_post_unique_idx
  on public.pulse_reactions (post_id, profile_id, reaction_type)
  where post_id is not null;

create unique index if not exists pulse_reactions_comment_unique_idx
  on public.pulse_reactions (comment_id, profile_id, reaction_type)
  where comment_id is not null;

drop trigger if exists pulse_colleges_set_updated_at on public.pulse_colleges;
create trigger pulse_colleges_set_updated_at
before update on public.pulse_colleges
for each row execute function public.set_updated_at();

drop trigger if exists pulse_profiles_set_updated_at on public.pulse_profiles;
create trigger pulse_profiles_set_updated_at
before update on public.pulse_profiles
for each row execute function public.set_updated_at();

drop trigger if exists pulse_invites_set_updated_at on public.pulse_invites;
create trigger pulse_invites_set_updated_at
before update on public.pulse_invites
for each row execute function public.set_updated_at();

drop trigger if exists pulse_posts_set_updated_at on public.pulse_posts;
create trigger pulse_posts_set_updated_at
before update on public.pulse_posts
for each row execute function public.set_updated_at();

drop trigger if exists pulse_comments_set_updated_at on public.pulse_comments;
create trigger pulse_comments_set_updated_at
before update on public.pulse_comments
for each row execute function public.set_updated_at();

drop trigger if exists pulse_reports_set_updated_at on public.pulse_reports;
create trigger pulse_reports_set_updated_at
before update on public.pulse_reports
for each row execute function public.set_updated_at();

drop trigger if exists pulse_opportunities_set_updated_at on public.pulse_opportunities;
create trigger pulse_opportunities_set_updated_at
before update on public.pulse_opportunities
for each row execute function public.set_updated_at();

drop trigger if exists pulse_opportunity_applications_set_updated_at on public.pulse_opportunity_applications;
create trigger pulse_opportunity_applications_set_updated_at
before update on public.pulse_opportunity_applications
for each row execute function public.set_updated_at();

create or replace function public.pulse_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile.id
  from public.pulse_profiles profile
  where profile.auth_user_id = (select auth.uid())
    and profile.pulse_status = 'active'
  limit 1
$$;

create or replace function public.pulse_current_college_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile.college_id
  from public.pulse_profiles profile
  where profile.auth_user_id = (select auth.uid())
    and profile.pulse_status = 'active'
  limit 1
$$;

revoke all on function public.pulse_current_profile_id() from public;
revoke all on function public.pulse_current_college_id() from public;
grant execute on function public.pulse_current_profile_id() to authenticated;
grant execute on function public.pulse_current_college_id() to authenticated;

alter table public.pulse_colleges enable row level security;
alter table public.pulse_profiles enable row level security;
alter table public.pulse_invites enable row level security;
alter table public.pulse_posts enable row level security;
alter table public.pulse_comments enable row level security;
alter table public.pulse_reactions enable row level security;
alter table public.pulse_reports enable row level security;
alter table public.pulse_opportunities enable row level security;
alter table public.pulse_opportunity_applications enable row level security;

revoke all on table public.pulse_colleges from anon, authenticated;
revoke all on table public.pulse_profiles from anon, authenticated;
revoke all on table public.pulse_invites from anon, authenticated;
revoke all on table public.pulse_posts from anon, authenticated;
revoke all on table public.pulse_comments from anon, authenticated;
revoke all on table public.pulse_reactions from anon, authenticated;
revoke all on table public.pulse_reports from anon, authenticated;
revoke all on table public.pulse_opportunities from anon, authenticated;
revoke all on table public.pulse_opportunity_applications from anon, authenticated;

grant select, insert, update, delete on table public.pulse_colleges to authenticated;
grant select, insert, update on table public.pulse_profiles to authenticated;
grant select, insert, update on table public.pulse_invites to authenticated;
grant select, insert, update on table public.pulse_posts to authenticated;
grant select, insert, update on table public.pulse_comments to authenticated;
grant select, insert, delete on table public.pulse_reactions to authenticated;
grant select, insert, update on table public.pulse_reports to authenticated;
grant select, insert, update, delete on table public.pulse_opportunities to authenticated;
grant select, insert, update on table public.pulse_opportunity_applications to authenticated;

create policy "Pulse colleges are readable by signed in users"
on public.pulse_colleges
for select
to authenticated
using (true);

create policy "Pulse colleges are managed by community admins"
on public.pulse_colleges
for all
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

create policy "Pulse profiles are readable by owner public profiles and admins"
on public.pulse_profiles
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or profile_visibility = 'public'
  or (
    profile_visibility = 'college'
    and pulse_status = 'active'
    and college_id = public.pulse_current_college_id()
  )
  or (select public.admin_has_permission('admin.community.view'))
);

create policy "Pulse profiles are created by owner or admins"
on public.pulse_profiles
for insert
to authenticated
with check (
  auth_user_id = (select auth.uid())
  or (select public.admin_has_permission('admin.community.manage'))
);

create policy "Pulse profiles are updated by owner or admins"
on public.pulse_profiles
for update
to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select public.admin_has_permission('admin.community.manage'))
)
with check (
  auth_user_id = (select auth.uid())
  or (select public.admin_has_permission('admin.community.manage'))
);

create policy "Pulse invites are readable by related students and admins"
on public.pulse_invites
for select
to authenticated
using (
  invited_by_profile_id = public.pulse_current_profile_id()
  or accepted_by_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
);

create policy "Pulse invites are created by active profiles or admins"
on public.pulse_invites
for insert
to authenticated
with check (
  invited_by_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
);

create policy "Pulse invites are updated by related students and admins"
on public.pulse_invites
for update
to authenticated
using (
  invited_by_profile_id = public.pulse_current_profile_id()
  or accepted_by_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
)
with check (
  invited_by_profile_id = public.pulse_current_profile_id()
  or accepted_by_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
);

create policy "Pulse posts are readable by global or college audience"
on public.pulse_posts
for select
to authenticated
using (
  author_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
  or (
    status = 'published'
    and (
      visibility = 'global'
      or (visibility = 'college' and college_id = public.pulse_current_college_id())
    )
  )
);

create policy "Pulse posts are created by active profiles"
on public.pulse_posts
for insert
to authenticated
with check (
  (
    author_profile_id = public.pulse_current_profile_id()
    and (
      visibility = 'global'
      or college_id = public.pulse_current_college_id()
    )
  )
  or (select public.admin_has_permission('admin.community.manage'))
);

create policy "Pulse posts are updated by authors or admins"
on public.pulse_posts
for update
to authenticated
using (
  author_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
)
with check (
  author_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
);

create policy "Pulse comments are readable through visible posts"
on public.pulse_comments
for select
to authenticated
using (
  author_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
  or exists (
    select 1
    from public.pulse_posts post
    where post.id = pulse_comments.post_id
      and post.status = 'published'
      and (
        post.visibility = 'global'
        or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
      )
  )
);

create policy "Pulse comments are created by active profiles"
on public.pulse_comments
for insert
to authenticated
with check (
  author_profile_id = public.pulse_current_profile_id()
  and exists (
    select 1
    from public.pulse_posts post
    where post.id = pulse_comments.post_id
      and post.status = 'published'
      and (
        post.visibility = 'global'
        or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
      )
  )
);

create policy "Pulse comments are updated by authors or admins"
on public.pulse_comments
for update
to authenticated
using (
  author_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
)
with check (
  author_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
);

create policy "Pulse reactions are readable by signed in users"
on public.pulse_reactions
for select
to authenticated
using (true);

create policy "Pulse reactions are created by active profiles"
on public.pulse_reactions
for insert
to authenticated
with check (profile_id = public.pulse_current_profile_id());

create policy "Pulse reactions are removed by owner or admins"
on public.pulse_reactions
for delete
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
);

create policy "Pulse reports are readable by reporter or admins"
on public.pulse_reports
for select
to authenticated
using (
  reporter_profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
);

create policy "Pulse reports are created by active profiles"
on public.pulse_reports
for insert
to authenticated
with check (reporter_profile_id = public.pulse_current_profile_id());

create policy "Pulse reports are updated by community admins"
on public.pulse_reports
for update
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

create policy "Pulse opportunities are readable by target audience"
on public.pulse_opportunities
for select
to authenticated
using (
  (select public.admin_has_permission('admin.community.view'))
  or (
    status = 'active'
    and (
      visibility = 'global'
      or (visibility = 'college' and college_id = public.pulse_current_college_id())
    )
  )
);

create policy "Pulse opportunities are managed by community admins"
on public.pulse_opportunities
for all
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

create policy "Pulse opportunity applications are readable by applicant or admins"
on public.pulse_opportunity_applications
for select
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
);

create policy "Pulse opportunity applications are created by applicant"
on public.pulse_opportunity_applications
for insert
to authenticated
with check (profile_id = public.pulse_current_profile_id());

create policy "Pulse opportunity applications are updated by applicant or admins"
on public.pulse_opportunity_applications
for update
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
)
with check (
  profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.manage'))
);
