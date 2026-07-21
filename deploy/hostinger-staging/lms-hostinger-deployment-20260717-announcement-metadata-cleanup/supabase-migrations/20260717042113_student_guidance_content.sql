create table if not exists public.student_guidance_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  title text not null,
  summary text,
  content text not null default '',
  status text not null default 'active',
  audience text not null default 'leadership',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_guidance_content_key_check check (content_key in ('program_structure', 'certificate_structure')),
  constraint student_guidance_content_status_check check (status in ('active', 'inactive')),
  constraint student_guidance_content_audience_check check (audience in ('leadership'))
);

create index if not exists student_guidance_content_status_sort_idx
  on public.student_guidance_content (status, audience, sort_order);

alter table public.student_guidance_content enable row level security;

drop policy if exists "Admins can view student guidance content" on public.student_guidance_content;
create policy "Admins can view student guidance content"
  on public.student_guidance_content
  for select
  to authenticated
  using (public.admin_has_permission('admin.programs.view'));

drop policy if exists "Admins can manage student guidance content" on public.student_guidance_content;
create policy "Admins can manage student guidance content"
  on public.student_guidance_content
  for all
  to authenticated
  using (public.admin_has_permission('admin.programs.manage'))
  with check (public.admin_has_permission('admin.programs.manage'));

drop policy if exists "Students can view active student guidance content" on public.student_guidance_content;
create policy "Students can view active student guidance content"
  on public.student_guidance_content
  for select
  to authenticated
  using (
    status = 'active'
    and exists (
      select 1
      from public.students s
      where s.active = true
        and lower(trim(s.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and public.lms_normalized_scope_values(public.lms_student_program_keys(s.id)) && array['mclp','smlp','hrlp','flp_er','flp_qf','pmlp']
    )
  );

drop policy if exists "Program admins can audit student guidance content" on public.audit_logs;
create policy "Program admins can audit student guidance content"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    public.admin_has_permission('admin.programs.manage')
    and actor_role = 'admin'
    and entity_type = 'student_guidance_content'
    and action in ('admin_student_guidance_content_updated')
    and lower(coalesce(actor_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create or replace function public.set_student_guidance_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_guidance_content_updated_at on public.student_guidance_content;
create trigger set_student_guidance_content_updated_at
  before update on public.student_guidance_content
  for each row
  execute function public.set_student_guidance_content_updated_at();

grant select, insert, update on table public.student_guidance_content to authenticated;

insert into public.student_guidance_content (
  content_key,
  title,
  summary,
  content,
  status,
  audience,
  sort_order
) values
  (
    'program_structure',
    'Understand your program structure',
    'How your training program, live project role, and placement mentorship fit together.',
    '<p>Your LMS access is organised into three phases. Your leadership program, such as MCLP, SMLP, FLP, HRLP, or PMLP, is the training umbrella used to give you the right workshops, recordings, resources, and module access.</p><p><strong>Phase 1: Training Phase</strong></p><p>You complete leadership program training modules and workshops available in your portal. After completing the required training modules, you become eligible for the leadership program certificate.</p><p><strong>Phase 2: Live Project Phase</strong></p><p>Your live project role is your applied project track, such as Business Analyst, Growth & Strategy Consultant, Digital Marketing Specialist, Market Research & Analytics, or Product Marketing. After submitting the project report and approval by the team, you become eligible for a separate live project certificate.</p><p><strong>Phase 3: Placement Mentorship Phase</strong></p><p>This phase supports your career preparation and placement readiness. It does not carry a separate certificate.</p>',
    'active',
    'leadership',
    10
  ),
  (
    'certificate_structure',
    'How you earn certificates',
    'Clear certificate expectations across training, live project, and placement mentorship.',
    '<p>Your certificate eligibility is linked to the phase you complete.</p><p><strong>Leadership Program Certificate</strong></p><p>This certificate is issued for completing the required training modules under your leadership program, such as MCLP, SMLP, FLP, HRLP, or PMLP.</p><p><strong>Live Project Certificate</strong></p><p>This is a separate certificate issued for your live project role after you submit the project report and it is approved by the team.</p><p><strong>Placement Mentorship</strong></p><p>Placement mentorship is a support and guidance phase. No separate certificate is issued for this phase.</p>',
    'active',
    'leadership',
    20
  )
on conflict (content_key) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  status = excluded.status,
  audience = excluded.audience,
  sort_order = excluded.sort_order,
  updated_at = now();
