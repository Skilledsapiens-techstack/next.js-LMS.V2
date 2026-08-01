create table if not exists public.whatsapp_message_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  sort_order integer not null default 100,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_message_categories_name_unique unique (name),
  constraint whatsapp_message_categories_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.whatsapp_groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  cohort_name text,
  program_name text,
  invite_link text,
  direct_chat_link text,
  status text not null default 'active',
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_groups_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.whatsapp_message_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.whatsapp_message_categories(id) on delete set null,
  title text not null,
  message_body text not null,
  status text not null default 'active',
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_message_templates_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.whatsapp_groups(id) on delete set null,
  category_id uuid references public.whatsapp_message_categories(id) on delete set null,
  template_id uuid references public.whatsapp_message_templates(id) on delete set null,
  cohort_name text,
  program_name text,
  group_name text not null,
  message_title text not null,
  message_body text not null,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  sent_by text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_message_logs_status_check check (status in ('draft', 'sent', 'skipped'))
);

create index if not exists whatsapp_groups_cohort_status_idx
  on public.whatsapp_groups (cohort_name, status);

create index if not exists whatsapp_message_templates_category_status_idx
  on public.whatsapp_message_templates (category_id, status);

create index if not exists whatsapp_message_logs_sent_at_idx
  on public.whatsapp_message_logs (sent_at desc);

create index if not exists whatsapp_message_logs_group_category_idx
  on public.whatsapp_message_logs (group_id, category_id);

alter table public.whatsapp_message_categories enable row level security;
alter table public.whatsapp_groups enable row level security;
alter table public.whatsapp_message_templates enable row level security;
alter table public.whatsapp_message_logs enable row level security;

drop policy if exists "whatsapp categories readable by community admins" on public.whatsapp_message_categories;
create policy "whatsapp categories readable by community admins"
on public.whatsapp_message_categories for select to authenticated
using (public.admin_has_permission('admin.community.manage'));

drop policy if exists "whatsapp categories manageable by community admins" on public.whatsapp_message_categories;
create policy "whatsapp categories manageable by community admins"
on public.whatsapp_message_categories for all to authenticated
using (public.admin_has_permission('admin.community.manage'))
with check (public.admin_has_permission('admin.community.manage'));

drop policy if exists "whatsapp groups readable by community admins" on public.whatsapp_groups;
create policy "whatsapp groups readable by community admins"
on public.whatsapp_groups for select to authenticated
using (public.admin_has_permission('admin.community.manage'));

drop policy if exists "whatsapp groups manageable by community admins" on public.whatsapp_groups;
create policy "whatsapp groups manageable by community admins"
on public.whatsapp_groups for all to authenticated
using (public.admin_has_permission('admin.community.manage'))
with check (public.admin_has_permission('admin.community.manage'));

drop policy if exists "whatsapp templates readable by community admins" on public.whatsapp_message_templates;
create policy "whatsapp templates readable by community admins"
on public.whatsapp_message_templates for select to authenticated
using (public.admin_has_permission('admin.community.manage'));

drop policy if exists "whatsapp templates manageable by community admins" on public.whatsapp_message_templates;
create policy "whatsapp templates manageable by community admins"
on public.whatsapp_message_templates for all to authenticated
using (public.admin_has_permission('admin.community.manage'))
with check (public.admin_has_permission('admin.community.manage'));

drop policy if exists "whatsapp logs readable by community admins" on public.whatsapp_message_logs;
create policy "whatsapp logs readable by community admins"
on public.whatsapp_message_logs for select to authenticated
using (public.admin_has_permission('admin.community.manage'));

drop policy if exists "whatsapp logs manageable by community admins" on public.whatsapp_message_logs;
create policy "whatsapp logs manageable by community admins"
on public.whatsapp_message_logs for all to authenticated
using (public.admin_has_permission('admin.community.manage'))
with check (public.admin_has_permission('admin.community.manage'));

grant select, insert, update, delete on public.whatsapp_message_categories to authenticated;
grant select, insert, update, delete on public.whatsapp_groups to authenticated;
grant select, insert, update, delete on public.whatsapp_message_templates to authenticated;
grant select, insert, update, delete on public.whatsapp_message_logs to authenticated;

insert into public.whatsapp_message_categories (name, sort_order)
values
  ('Workshop Reminder', 10),
  ('Recording Update', 20),
  ('Doubt Session', 30),
  ('Certificate Update', 40),
  ('Onboarding', 50),
  ('Payment Follow-up', 60),
  ('General Announcement', 70),
  ('Urgent Update', 80)
on conflict (name) do update
set
  sort_order = excluded.sort_order,
  status = 'active',
  updated_at = now();
