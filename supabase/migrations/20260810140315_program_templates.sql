create table if not exists public.program_templates (
  id uuid primary key default gen_random_uuid(),
  program_key text not null,
  source text not null default 'sequence_manager' check (source in ('sequence_manager', 'admin_template')),
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  chapters jsonb not null default '[]'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_templates_program_key_unique unique (program_key),
  constraint program_templates_program_key_format check (program_key ~ '^[a-z0-9_]+$'),
  constraint program_templates_chapters_array check (jsonb_typeof(chapters) = 'array')
);

create index if not exists program_templates_program_status_idx
  on public.program_templates (program_key, status);

create index if not exists program_templates_chapters_gin_idx
  on public.program_templates using gin (chapters);

drop trigger if exists set_program_templates_updated_at on public.program_templates;
create trigger set_program_templates_updated_at
before update on public.program_templates
for each row execute function public.set_updated_at();

comment on table public.program_templates is 'Admin-managed program chapter/module templates derived from Sequence Manager before student rendering is switched over.';
comment on column public.program_templates.chapters is 'Ordered chapter/module JSON. Phase 2 stores the mapped template without changing student-facing My Programs behavior.';

alter table public.program_templates enable row level security;

drop policy if exists "program templates readable by program admins" on public.program_templates;
create policy "program templates readable by program admins"
on public.program_templates
for select
to authenticated
using (public.admin_has_permission('admin.programs.view'));

drop policy if exists "program templates manageable by program admins" on public.program_templates;
create policy "program templates manageable by program admins"
on public.program_templates
for all
to authenticated
using (public.admin_has_permission('admin.programs.manage'))
with check (public.admin_has_permission('admin.programs.manage'));

grant select, insert, update, delete on public.program_templates to authenticated;

insert into public.program_templates (program_key, source, status, chapters)
select
  grouped.program_key,
  'sequence_manager',
  'draft',
  jsonb_agg(
    jsonb_build_object(
      'id',
      'chapter-' || grouped.recording_section,
      'title',
      case grouped.recording_section
        when 'induction_live_project' then 'Induction & Live Project Overview'
        when 'core_modules' then 'Core Modules'
        when 'placement_mentorship' then 'Placement Mentorship'
        else 'Other Workshops'
      end,
      'items',
      grouped.items
    )
    order by
      case grouped.recording_section
        when 'induction_live_project' then 1
        when 'core_modules' then 2
        when 'placement_mentorship' then 3
        else 4
      end
  ) as chapters
from (
  select
    program_key,
    recording_section,
    jsonb_agg(
      jsonb_build_object(
        'id',
        'module-' || id::text,
        'topic_title',
        title,
        'resource_ids',
        '[]'::jsonb
      )
      order by sequence_number, title
    ) as items
  from public.recording_sequence_rules
  where status = 'active'
  group by program_key, recording_section
) grouped
group by grouped.program_key
on conflict (program_key) do nothing;
