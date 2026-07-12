create table if not exists public.project_toolkit_items (
  id uuid primary key default gen_random_uuid(),
  toolkit_id text not null unique,
  item_type text not null,
  title text not null,
  summary text,
  content text,
  link_label text,
  link_url text,
  program_keys text[] not null default '{}'::text[],
  status text not null default 'active',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_toolkit_items_id_format check (toolkit_id ~ '^[a-z0-9_]+$'),
  constraint project_toolkit_items_type_check check (item_type in ('guidelines', 'sow_link', 'framework', 'custom')),
  constraint project_toolkit_items_status_check check (status in ('active', 'inactive')),
  constraint project_toolkit_items_link_url_check check (link_url is null or link_url = '' or link_url ~* '^https?://')
);

create index if not exists project_toolkit_items_status_sort_idx
  on public.project_toolkit_items (status, sort_order, title);

create index if not exists project_toolkit_items_program_keys_idx
  on public.project_toolkit_items using gin (program_keys);

alter table public.project_toolkit_items enable row level security;

drop policy if exists "Admins can view project toolkit items" on public.project_toolkit_items;
create policy "Admins can view project toolkit items"
  on public.project_toolkit_items
  for select
  to authenticated
  using (public.admin_has_permission('admin.projects.view'));

drop policy if exists "Admins can manage project toolkit items" on public.project_toolkit_items;
create policy "Admins can manage project toolkit items"
  on public.project_toolkit_items
  for all
  to authenticated
  using (public.admin_has_permission('admin.projects.manage'))
  with check (public.admin_has_permission('admin.projects.manage'));

drop policy if exists "Students can view active project toolkit items" on public.project_toolkit_items;
create policy "Students can view active project toolkit items"
  on public.project_toolkit_items
  for select
  to authenticated
  using (
    status = 'active'
    and (
      coalesce(cardinality(program_keys), 0) = 0
      or exists (
        select 1
        from public.students s
        join public.student_programs sp on sp.student_id = s.id
        where (
          s.auth_user_id = (select auth.uid())
          or lower(s.email) = lower((select auth.jwt() ->> 'email'))
        )
        and lower(sp.program_key) = any (array(select lower(unnest(program_keys))))
      )
    )
  );

create or replace function public.set_project_toolkit_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_project_toolkit_items_updated_at on public.project_toolkit_items;
create trigger set_project_toolkit_items_updated_at
  before update on public.project_toolkit_items
  for each row
  execute function public.set_project_toolkit_items_updated_at();

insert into public.project_toolkit_items (
  toolkit_id,
  item_type,
  title,
  summary,
  content,
  link_label,
  link_url,
  program_keys,
  status,
  sort_order
) values
  (
    'live_project_guidelines',
    'guidelines',
    'Live Project Guidelines',
    'Core guidance students should review before working on any live project.',
    '<p>Review the project brief carefully, understand the expected deliverables, and keep your report structured, original, and evidence-backed.</p>',
    null,
    null,
    '{}'::text[],
    'active',
    10
  ),
  (
    'sow_document',
    'sow_link',
    'SOW Document Link',
    'Shared statement-of-work document for live project expectations and scope.',
    '<p>Use the SOW document shared by the program team as the operating reference for scope, format, and review expectations.</p>',
    'Open SOW document',
    null,
    '{}'::text[],
    'active',
    20
  ),
  (
    'four_week_framework',
    'framework',
    'How to Start your Project (4-week Framework)',
    'Suggested weekly rhythm for planning, analysis, drafting, and final submission.',
    '<ol><li><strong>Week 1:</strong> Understand the brief and define your approach.</li><li><strong>Week 2:</strong> Research, collect inputs, and structure your analysis.</li><li><strong>Week 3:</strong> Build recommendations and draft the report.</li><li><strong>Week 4:</strong> Refine, proofread, and submit through the portal.</li></ol>',
    null,
    null,
    '{}'::text[],
    'active',
    30
  )
on conflict (toolkit_id) do update set
  item_type = excluded.item_type,
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  link_label = excluded.link_label,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();
