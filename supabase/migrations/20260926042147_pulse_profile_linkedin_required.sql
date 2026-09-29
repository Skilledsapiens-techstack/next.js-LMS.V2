alter table public.pulse_profiles
  add column if not exists linkedin_url text;

alter table public.pulse_profiles
  drop constraint if exists pulse_profiles_linkedin_url_check;

alter table public.pulse_profiles
  add constraint pulse_profiles_linkedin_url_check
  check (
    linkedin_url is null
    or linkedin_url ~* '^https://([a-z0-9-]+\.)?linkedin\.com/in/[A-Za-z0-9._%-]+/?$'
  );
