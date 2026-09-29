create table if not exists public.pulse_clubs (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.pulse_colleges(id) on delete cascade,
  name text not null,
  slug text not null,
  category text not null default 'domain',
  summary text not null,
  description text,
  focus_tags text[] not null default '{}',
  cover_color text not null default 'red',
  contact_email text,
  external_url text,
  status text not null default 'active',
  created_by_profile_id uuid references public.pulse_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_clubs_status_check check (status in ('active', 'paused', 'archived')),
  constraint pulse_clubs_category_check check (category in ('domain', 'placement', 'entrepreneurship', 'operations', 'culture', 'sports', 'committee', 'other')),
  constraint pulse_clubs_cover_color_check check (cover_color in ('marketing', 'finance', 'consulting', 'product', 'hr', 'analytics', 'startup', 'operations', 'red')),
  constraint pulse_clubs_name_check check (length(btrim(name)) between 2 and 120),
  constraint pulse_clubs_slug_check check (length(btrim(slug)) between 2 and 80),
  constraint pulse_clubs_summary_check check (length(btrim(summary)) between 12 and 240),
  constraint pulse_clubs_unique_slug unique (college_id, slug)
);

create table if not exists public.pulse_club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.pulse_clubs(id) on delete cascade,
  profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  role text not null default 'member',
  title text,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_club_members_role_check check (role in ('admin', 'moderator', 'member')),
  constraint pulse_club_members_status_check check (status in ('active', 'pending', 'paused', 'alumni')),
  constraint pulse_club_members_unique_profile unique (club_id, profile_id)
);

create table if not exists public.pulse_club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.pulse_clubs(id) on delete cascade,
  author_profile_id uuid not null references public.pulse_profiles(id) on delete cascade,
  post_id uuid references public.pulse_posts(id) on delete set null,
  post_type text not null default 'announcement',
  title text not null,
  body text not null,
  status text not null default 'published',
  pinned boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_club_posts_type_check check (post_type in ('announcement', 'discussion', 'event', 'poll', 'resource', 'opportunity')),
  constraint pulse_club_posts_status_check check (status in ('draft', 'published', 'hidden', 'archived', 'under_review')),
  constraint pulse_club_posts_title_check check (length(btrim(title)) between 3 and 180),
  constraint pulse_club_posts_body_check check (length(btrim(body)) between 1 and 12000)
);

create index if not exists pulse_clubs_college_status_idx
  on public.pulse_clubs (college_id, status, name);

create index if not exists pulse_club_members_profile_idx
  on public.pulse_club_members (profile_id, status);

create index if not exists pulse_club_members_club_role_idx
  on public.pulse_club_members (club_id, role, status);

create index if not exists pulse_club_posts_club_feed_idx
  on public.pulse_club_posts (club_id, status, pinned desc, created_at desc);

drop trigger if exists pulse_clubs_set_updated_at on public.pulse_clubs;
create trigger pulse_clubs_set_updated_at
before update on public.pulse_clubs
for each row execute function public.set_updated_at();

drop trigger if exists pulse_club_members_set_updated_at on public.pulse_club_members;
create trigger pulse_club_members_set_updated_at
before update on public.pulse_club_members
for each row execute function public.set_updated_at();

drop trigger if exists pulse_club_posts_set_updated_at on public.pulse_club_posts;
create trigger pulse_club_posts_set_updated_at
before update on public.pulse_club_posts
for each row execute function public.set_updated_at();

create or replace function public.pulse_is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pulse_club_members member
    where member.club_id = p_club_id
      and member.profile_id = public.pulse_current_profile_id()
      and member.status = 'active'
      and member.role in ('admin', 'moderator')
  )
  or (select public.admin_has_permission('admin.community.manage'))
$$;

revoke all on function public.pulse_is_club_admin(uuid) from public;
grant execute on function public.pulse_is_club_admin(uuid) to authenticated;

alter table public.pulse_clubs enable row level security;
alter table public.pulse_club_members enable row level security;
alter table public.pulse_club_posts enable row level security;

revoke all on table public.pulse_clubs from anon, authenticated;
revoke all on table public.pulse_club_members from anon, authenticated;
revoke all on table public.pulse_club_posts from anon, authenticated;

grant select, insert, update on table public.pulse_clubs to authenticated;
grant select, insert, update, delete on table public.pulse_club_members to authenticated;
grant select, insert, update on table public.pulse_club_posts to authenticated;

drop policy if exists "Pulse clubs are readable by college members and admins" on public.pulse_clubs;
create policy "Pulse clubs are readable by college members and admins"
on public.pulse_clubs
for select
to authenticated
using (
  (
    status = 'active'
    and college_id = public.pulse_current_college_id()
  )
  or (select public.admin_has_permission('admin.community.view'))
);

drop policy if exists "Pulse clubs are managed by community admins" on public.pulse_clubs;
create policy "Pulse clubs are managed by community admins"
on public.pulse_clubs
for all
to authenticated
using ((select public.admin_has_permission('admin.community.manage')))
with check ((select public.admin_has_permission('admin.community.manage')));

drop policy if exists "Pulse club memberships are readable by self club admins and platform admins" on public.pulse_club_members;
create policy "Pulse club memberships are readable by self club admins and platform admins"
on public.pulse_club_members
for select
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or public.pulse_is_club_admin(club_id)
  or (select public.admin_has_permission('admin.community.view'))
);

drop policy if exists "Pulse club memberships are managed by club admins" on public.pulse_club_members;
create policy "Pulse club memberships are managed by club admins"
on public.pulse_club_members
for all
to authenticated
using (public.pulse_is_club_admin(club_id))
with check (public.pulse_is_club_admin(club_id));

drop policy if exists "Pulse club posts are readable by college members and admins" on public.pulse_club_posts;
create policy "Pulse club posts are readable by college members and admins"
on public.pulse_club_posts
for select
to authenticated
using (
  (
    status = 'published'
    and exists (
      select 1
      from public.pulse_clubs club
      where club.id = pulse_club_posts.club_id
        and club.status = 'active'
        and club.college_id = public.pulse_current_college_id()
    )
  )
  or author_profile_id = public.pulse_current_profile_id()
  or public.pulse_is_club_admin(club_id)
  or (select public.admin_has_permission('admin.community.view'))
);

drop policy if exists "Pulse club posts are managed by club admins and authors" on public.pulse_club_posts;
create policy "Pulse club posts are managed by club admins and authors"
on public.pulse_club_posts
for all
to authenticated
using (
  author_profile_id = public.pulse_current_profile_id()
  or public.pulse_is_club_admin(club_id)
)
with check (
  author_profile_id = public.pulse_current_profile_id()
  or public.pulse_is_club_admin(club_id)
);

with target_college as (
  select id
  from public.pulse_colleges
  where slug = 'indian-institute-of-management-ranchi'
  limit 1
),
club_seed(name, slug, category, summary, description, focus_tags, cover_color) as (
  values
    ('Marketing Club', 'marketing-club', 'domain', 'Brand, consumer insight, GTM, campaigns, and campus marketing practice.', 'A college workspace for marketing discussions, campaign teardowns, competitions, events, resources, and student-led brand projects.', array['Brand strategy', 'Consumer insights', 'Campaigns'], 'marketing'),
    ('Finance Club', 'finance-club', 'domain', 'Markets, valuation, equity research, financial modelling, and investment prep.', 'A college workspace for finance learning, market notes, valuation practice, investment competitions, and finance placement preparation.', array['Equity research', 'Valuation', 'Markets'], 'finance'),
    ('Consulting Club', 'consulting-club', 'domain', 'Case practice, business problem solving, frameworks, and live project sprints.', 'A college workspace for peer case practice, consulting prep, structured problem solving, and practical business projects.', array['Case prep', 'Problem solving', 'Live projects'], 'consulting'),
    ('HR Club', 'hr-club', 'domain', 'People strategy, hiring, employee experience, and HR interview preparation.', 'A college workspace for HR domain learning, people strategy discussions, interview prep, events, and HR resources.', array['People strategy', 'Hiring', 'Interview prep'], 'hr'),
    ('Operations Club', 'operations-club', 'domain', 'Supply chain, process excellence, analytics, and operations competitions.', 'A college workspace for operations cases, supply chain learning, process improvement projects, and operations-focused opportunities.', array['Supply chain', 'Process excellence', 'Analytics'], 'operations'),
    ('Entrepreneurship Cell', 'entrepreneurship-cell', 'entrepreneurship', 'Founders, campus ventures, validation sprints, pitch practice, and startup events.', 'A college workspace for founders, aspiring entrepreneurs, E-cell updates, startup projects, pitch prep, and venture-building activity.', array['Startups', 'Pitching', 'Validation'], 'startup'),
    ('Placement Committee', 'placement-committee', 'placement', 'Placement readiness, interview coordination, company prep, and career updates.', 'A college workspace for placement-related announcements, preparation resources, company process updates, and student coordination.', array['Placement prep', 'Interview readiness', 'Company updates'], 'red'),
    ('Prep Cell', 'prep-cell', 'committee', 'Peer prep groups, GD practice, interview drills, and placement preparation support.', 'A college workspace for structured peer preparation, group discussions, mock interviews, and readiness initiatives.', array['Peer prep', 'GD practice', 'Mock interviews'], 'analytics')
)
insert into public.pulse_clubs (
  college_id,
  name,
  slug,
  category,
  summary,
  description,
  focus_tags,
  cover_color,
  status
)
select
  target_college.id,
  club_seed.name,
  club_seed.slug,
  club_seed.category,
  club_seed.summary,
  club_seed.description,
  club_seed.focus_tags,
  club_seed.cover_color,
  'active'
from club_seed
cross join target_college
on conflict (college_id, slug) do update
set
  name = excluded.name,
  category = excluded.category,
  summary = excluded.summary,
  description = excluded.description,
  focus_tags = excluded.focus_tags,
  cover_color = excluded.cover_color,
  status = 'active',
  updated_at = now();
