create table if not exists public.career_readiness_content (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  description text,
  content text,
  link_url text,
  link_label text,
  program_keys text[] not null default '{}',
  cohort_names text[] not null default '{}',
  is_published boolean not null default false,
  sort_order integer not null default 100,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint career_readiness_category_check check (
    category in (
      'cv_points_guide',
      'sample_cv_points',
      'resume_resources',
      'interview_prep',
      'cv_approval_process'
    )
  ),
  constraint career_readiness_sort_order_check check (sort_order >= 0),
  constraint career_readiness_link_url_check check (
    link_url is null
    or link_url = ''
    or link_url ~* '^https?://'
    or link_url ~ '^/'
  )
);

alter table public.career_readiness_content enable row level security;

grant select on table public.career_readiness_content to authenticated;
grant insert, update on table public.career_readiness_content to authenticated;

create index if not exists career_readiness_content_published_idx
on public.career_readiness_content (is_published, category, sort_order, updated_at desc);

create index if not exists career_readiness_content_program_keys_idx
on public.career_readiness_content using gin (program_keys);

create index if not exists career_readiness_content_cohort_names_idx
on public.career_readiness_content using gin (cohort_names);

drop trigger if exists set_career_readiness_content_updated_at on public.career_readiness_content;
create trigger set_career_readiness_content_updated_at
before update on public.career_readiness_content
for each row execute function public.set_updated_at();

drop policy if exists "career readiness readable by resource admins" on public.career_readiness_content;
create policy "career readiness readable by resource admins"
on public.career_readiness_content
for select
to authenticated
using (public.admin_has_permission('admin.resources.view'));

drop policy if exists "career readiness insertable by resource admins" on public.career_readiness_content;
create policy "career readiness insertable by resource admins"
on public.career_readiness_content
for insert
to authenticated
with check (public.admin_has_permission('admin.resources.manage'));

drop policy if exists "career readiness updateable by resource admins" on public.career_readiness_content;
create policy "career readiness updateable by resource admins"
on public.career_readiness_content
for update
to authenticated
using (public.admin_has_permission('admin.resources.manage'))
with check (public.admin_has_permission('admin.resources.manage'));

create or replace function public.student_career_readiness_content(p_student_email text default null::text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  with context as (
    select public.lms_student_id_for_request(p_student_email) as student_id
  ),
  visible as (
    select c.*
    from public.career_readiness_content c
    cross join context ctx
    where ctx.student_id is not null
      and c.is_published = true
      and (
        (
          cardinality(public.lms_normalized_scope_values(c.program_keys)) = 0
          and cardinality(public.lms_normalized_scope_values(c.cohort_names)) = 0
        )
        or public.lms_audience_matches(ctx.student_id, c.program_keys, c.cohort_names)
      )
    order by c.category asc, c.sort_order asc, c.updated_at desc
  )
  select coalesce(jsonb_agg(to_jsonb(visible)), '[]'::jsonb)
  from visible;
$function$;

revoke all on function public.student_career_readiness_content(text) from public;
grant execute on function public.student_career_readiness_content(text) to authenticated;

insert into public.feature_controls (module_id, student_label, student_path, status, upcoming_message, is_core, sort_order)
values
  ('career-readiness', 'Career Readiness', '/student/career-readiness', 'show', null, false, 85)
on conflict (module_id) do update
set
  student_label = excluded.student_label,
  student_path = excluded.student_path,
  sort_order = excluded.sort_order,
  updated_at = now();

drop policy if exists "admin career readiness writes can be audited by resource admins" on public.audit_logs;
create policy "admin career readiness writes can be audited by resource admins"
on public.audit_logs
for insert
to authenticated
with check (
  public.admin_has_permission('admin.resources.manage')
  and actor_role = 'admin'
  and entity_type = 'career_readiness_content'
  and action in (
    'admin_career_readiness_content_created',
    'admin_career_readiness_content_updated',
    'admin_career_readiness_content_status_changed'
  )
);
