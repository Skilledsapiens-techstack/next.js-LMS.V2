create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  banner_id text not null unique,
  title text not null,
  message text not null,
  banner_type text not null default 'general',
  custom_type text,
  display_type text not null default 'bottom_right_floating',
  priority text not null default 'normal',
  status text not null default 'active',
  cta_label text,
  cta_url text,
  start_at timestamptz,
  end_at timestamptz,
  require_acknowledgement boolean not null default false,
  audience text not null default 'all',
  program_keys text[] not null default '{}',
  cohort_names text[] not null default '{}',
  student_emails text[] not null default '{}',
  target_paid_access boolean not null default false,
  target_ats_credits boolean not null default false,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banners_status_check check (status in ('active', 'inactive', 'draft')),
  constraint banners_type_check check (banner_type in ('general', 'launch', 'product', 'workshop', 'offer', 'maintenance', 'custom')),
  constraint banners_display_type_check check (display_type in ('login_popup', 'top_running', 'top_sticky', 'bottom_sticky', 'bottom_right_floating', 'floating_bell')),
  constraint banners_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint banners_audience_check check (audience in ('all', 'program', 'cohort', 'student', 'access')),
  constraint banners_schedule_check check (end_at is null or start_at is null or end_at >= start_at),
  constraint banners_cta_url_check check (cta_url is null or cta_url ~* '^(https?://|/)')
);

create table if not exists public.banner_dismissals (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banners(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  student_email text not null,
  acknowledged boolean not null default false,
  dismissed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (banner_id, student_email)
);

create index if not exists banners_status_schedule_idx
  on public.banners (status, start_at, end_at, priority);

create index if not exists banners_display_type_idx
  on public.banners (display_type);

create index if not exists banners_program_keys_gin_idx
  on public.banners using gin (program_keys);

create index if not exists banners_cohort_names_gin_idx
  on public.banners using gin (cohort_names);

create index if not exists banners_student_emails_gin_idx
  on public.banners using gin (student_emails);

create index if not exists banner_dismissals_student_idx
  on public.banner_dismissals (student_email, banner_id);

drop trigger if exists set_banners_updated_at on public.banners;
create trigger set_banners_updated_at
before update on public.banners
for each row execute function public.set_updated_at();

alter table public.banners enable row level security;
alter table public.banner_dismissals enable row level security;

grant select, insert, update, delete on table public.banners to authenticated;
grant select, insert, update on table public.banner_dismissals to authenticated;

drop policy if exists "banners readable by announcement admins" on public.banners;
create policy "banners readable by announcement admins"
on public.banners for select to authenticated
using (public.admin_has_permission('admin.announcements.view'));

drop policy if exists "banners manageable by announcement admins" on public.banners;
create policy "banners manageable by announcement admins"
on public.banners for all to authenticated
using (public.admin_has_permission('admin.announcements.manage'))
with check (public.admin_has_permission('admin.announcements.manage'));

drop policy if exists "active banners readable by linked students" on public.banners;
create policy "active banners readable by linked students"
on public.banners for select to authenticated
using (
  status = 'active'
  and (start_at is null or start_at <= now())
  and (end_at is null or end_at >= now())
  and exists (
    select 1
    from public.students s
    where s.active is true
      and (
        s.auth_user_id = auth.uid()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(coalesce(s.alt_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists "banner dismissals readable by owner or announcement admins" on public.banner_dismissals;
create policy "banner dismissals readable by owner or announcement admins"
on public.banner_dismissals for select to authenticated
using (
  public.admin_has_permission('admin.announcements.view')
  or exists (
    select 1
    from public.students s
    where s.active is true
      and lower(public.banner_dismissals.student_email) in (lower(s.email), lower(coalesce(s.alt_email, '')))
      and (
        s.auth_user_id = auth.uid()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(coalesce(s.alt_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists "banner dismissals insertable by linked students" on public.banner_dismissals;
create policy "banner dismissals insertable by linked students"
on public.banner_dismissals for insert to authenticated
with check (
  exists (
    select 1
    from public.students s
    where s.active is true
      and lower(public.banner_dismissals.student_email) in (lower(s.email), lower(coalesce(s.alt_email, '')))
      and (
        s.id = public.banner_dismissals.student_id
        or public.banner_dismissals.student_id is null
      )
      and (
        s.auth_user_id = auth.uid()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(coalesce(s.alt_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists "banner dismissals updatable by owner or announcement admins" on public.banner_dismissals;
create policy "banner dismissals updatable by owner or announcement admins"
on public.banner_dismissals for update to authenticated
using (
  public.admin_has_permission('admin.announcements.manage')
  or exists (
    select 1
    from public.students s
    where s.active is true
      and lower(public.banner_dismissals.student_email) in (lower(s.email), lower(coalesce(s.alt_email, '')))
      and (
        s.auth_user_id = auth.uid()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(coalesce(s.alt_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
)
with check (
  public.admin_has_permission('admin.announcements.manage')
  or exists (
    select 1
    from public.students s
    where s.active is true
      and lower(public.banner_dismissals.student_email) in (lower(s.email), lower(coalesce(s.alt_email, '')))
      and (
        s.id = public.banner_dismissals.student_id
        or public.banner_dismissals.student_id is null
      )
      and (
        s.auth_user_id = auth.uid()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or lower(coalesce(s.alt_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);
