-- Email Marketing foundation: campaigns, daily plans, and auditable plan events.

create table if not exists public.email_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null unique,
  title text not null,
  description text,
  phase text not null default 'general',
  template_key text,
  default_subject text,
  default_body text,
  default_resource_ids uuid[] not null default '{}',
  audience_rules jsonb not null default '{}'::jsonb,
  rotation_weight integer not null default 100,
  touch_interval_days integer not null default 14,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_marketing_daily_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  planned_date date not null,
  campaign_id uuid references public.email_marketing_campaigns(id) on delete set null,
  campaign_title text not null,
  campaign_phase text not null default 'general',
  suggested_subject text,
  suggested_body text,
  cohort_names text[] not null default '{}',
  cohort_ids uuid[] not null default '{}',
  resource_ids uuid[] not null default '{}',
  planned_recipient_count integer not null default 0 check (planned_recipient_count >= 0),
  daily_limit integer not null default 300 check (daily_limit > 0),
  suggested_batch_size integer not null default 150 check (suggested_batch_size > 0),
  priority_score integer not null default 0,
  rationale text,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'sent', 'skipped', 'cancelled')),
  sent_email_queue_ids uuid[] not null default '{}',
  sent_at timestamptz,
  sent_by text,
  skipped_at timestamptz,
  skipped_by text,
  skip_reason text,
  created_by text,
  updated_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_marketing_daily_plans_one_plan_per_day unique (planned_date)
);

create table if not exists public.email_marketing_plan_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.email_marketing_daily_plans(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'reviewed', 'sent', 'skipped', 'cancelled', 'note')),
  actor_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_marketing_campaigns_status_phase_idx
on public.email_marketing_campaigns (status, phase, rotation_weight desc);

create index if not exists email_marketing_daily_plans_date_status_idx
on public.email_marketing_daily_plans (planned_date desc, status);

create index if not exists email_marketing_daily_plans_campaign_idx
on public.email_marketing_daily_plans (campaign_id, planned_date desc);

create index if not exists email_marketing_plan_events_plan_idx
on public.email_marketing_plan_events (plan_id, created_at desc);

drop trigger if exists set_email_marketing_campaigns_updated_at on public.email_marketing_campaigns;
create trigger set_email_marketing_campaigns_updated_at
before update on public.email_marketing_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists set_email_marketing_daily_plans_updated_at on public.email_marketing_daily_plans;
create trigger set_email_marketing_daily_plans_updated_at
before update on public.email_marketing_daily_plans
for each row execute function public.set_updated_at();

alter table public.email_marketing_campaigns enable row level security;
alter table public.email_marketing_daily_plans enable row level security;
alter table public.email_marketing_plan_events enable row level security;

drop policy if exists "email marketing campaigns readable by email admins" on public.email_marketing_campaigns;
create policy "email marketing campaigns readable by email admins"
on public.email_marketing_campaigns for select to authenticated
using (public.admin_has_permission('admin.email.view'));

drop policy if exists "email marketing campaigns managed by email admins" on public.email_marketing_campaigns;
create policy "email marketing campaigns managed by email admins"
on public.email_marketing_campaigns for all to authenticated
using (public.admin_has_permission('admin.email.manage'))
with check (public.admin_has_permission('admin.email.manage'));

drop policy if exists "email marketing plans readable by email admins" on public.email_marketing_daily_plans;
create policy "email marketing plans readable by email admins"
on public.email_marketing_daily_plans for select to authenticated
using (public.admin_has_permission('admin.email.view'));

drop policy if exists "email marketing plans managed by email admins" on public.email_marketing_daily_plans;
create policy "email marketing plans managed by email admins"
on public.email_marketing_daily_plans for all to authenticated
using (public.admin_has_permission('admin.email.manage'))
with check (public.admin_has_permission('admin.email.manage'));

drop policy if exists "email marketing plan events readable by email admins" on public.email_marketing_plan_events;
create policy "email marketing plan events readable by email admins"
on public.email_marketing_plan_events for select to authenticated
using (public.admin_has_permission('admin.email.view'));

drop policy if exists "email marketing plan events managed by email admins" on public.email_marketing_plan_events;
create policy "email marketing plan events managed by email admins"
on public.email_marketing_plan_events for all to authenticated
using (public.admin_has_permission('admin.email.manage'))
with check (public.admin_has_permission('admin.email.manage'));

grant select on table public.email_marketing_campaigns to authenticated;
grant select on table public.email_marketing_daily_plans to authenticated;
grant select on table public.email_marketing_plan_events to authenticated;
grant insert, update, delete on table public.email_marketing_campaigns to authenticated;
grant insert, update, delete on table public.email_marketing_daily_plans to authenticated;
grant insert, update, delete on table public.email_marketing_plan_events to authenticated;

insert into public.email_marketing_campaigns (
  campaign_key,
  title,
  description,
  phase,
  default_subject,
  default_body,
  rotation_weight,
  touch_interval_days,
  status
)
values
  (
    'resource_sharing',
    'Resource sharing campaign',
    'Share one useful LMS resource with cohorts due for touch-base.',
    'resource_share',
    'New LMS resource for {{cohort}}',
    'Hi {{student_name}},<br><br>We have shared a useful LMS resource for your cohort.<br><br>Resource: {{resource_title}}<br>Open resource: {{resource_link}}<br><br>Regards,<br>Skilled Sapiens Team',
    120,
    10,
    'active'
  ),
  (
    'student_touch_base',
    'Student touch-base campaign',
    'Warm check-in to keep students engaged with the LMS.',
    'general',
    'Quick check-in from Skilled Sapiens',
    'Hi {{student_name}},<br><br>We wanted to check in and make sure you are getting value from your LMS access. Please continue reviewing your resources, recordings, and upcoming sessions in the portal.<br><br>Regards,<br>Skilled Sapiens Team',
    100,
    14,
    'active'
  ),
  (
    'placement_readiness',
    'Placement readiness campaign',
    'Nudge students toward resume, interview, and role-readiness actions.',
    'placement',
    'Placement readiness resources for {{program}}',
    'Hi {{student_name}},<br><br>This is a quick reminder to keep your placement preparation moving. Review your career readiness material and update your resume or profile this week.<br><br>Regards,<br>Skilled Sapiens Team',
    90,
    14,
    'active'
  )
on conflict (campaign_key) do update
set
  title = excluded.title,
  description = excluded.description,
  phase = excluded.phase,
  default_subject = excluded.default_subject,
  default_body = excluded.default_body,
  rotation_weight = excluded.rotation_weight,
  touch_interval_days = excluded.touch_interval_days,
  status = excluded.status,
  updated_at = now();
