create table if not exists public.recording_resource_links (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.workshops(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text,
  constraint recording_resource_links_unique unique (recording_id, resource_id)
);

create index if not exists recording_resource_links_recording_idx
  on public.recording_resource_links (recording_id);

create index if not exists recording_resource_links_resource_idx
  on public.recording_resource_links (resource_id);

alter table public.recording_resource_links enable row level security;

drop policy if exists "recording resource links readable by authenticated users" on public.recording_resource_links;
create policy "recording resource links readable by authenticated users"
on public.recording_resource_links
for select
to authenticated
using (true);

drop policy if exists "recording resource links manageable by recording admins" on public.recording_resource_links;
create policy "recording resource links manageable by recording admins"
on public.recording_resource_links
for all
to authenticated
using (public.admin_has_permission('admin.recordings.manage'))
with check (public.admin_has_permission('admin.recordings.manage'));

grant select, insert, update, delete on public.recording_resource_links to authenticated;

comment on table public.recording_resource_links is 'Admin-managed links between published workshop recordings and existing Resource Library items.';
