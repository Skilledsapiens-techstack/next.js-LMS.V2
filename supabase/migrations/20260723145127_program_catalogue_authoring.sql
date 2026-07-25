alter table public.programs
  add column if not exists guest_catalogue_enabled boolean not null default true,
  add column if not exists catalogue_badge text,
  add column if not exists thumbnail_url text,
  add column if not exists banner_url text,
  add column if not exists short_description text,
  add column if not exists overview text,
  add column if not exists who_should_join text,
  add column if not exists what_you_will_learn text,
  add column if not exists live_project_details text,
  add column if not exists tools_covered text,
  add column if not exists career_outcomes text,
  add column if not exists duration text,
  add column if not exists schedule_format text,
  add column if not exists mentor_support text,
  add column if not exists certificate_details text,
  add column if not exists pricing text,
  add column if not exists next_batch_date date,
  add column if not exists highlights text[] not null default '{}'::text[],
  add column if not exists curriculum jsonb not null default '[]'::jsonb,
  add column if not exists outcomes jsonb not null default '[]'::jsonb,
  add column if not exists faqs jsonb not null default '[]'::jsonb,
  add column if not exists cta_buttons jsonb not null default '[]'::jsonb;

create index if not exists programs_guest_catalogue_enabled_idx
  on public.programs (guest_catalogue_enabled)
  where status = 'active';
