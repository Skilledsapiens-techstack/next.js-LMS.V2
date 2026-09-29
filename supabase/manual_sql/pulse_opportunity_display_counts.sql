alter table public.pulse_opportunities
  add column if not exists display_applied_count integer not null default 0;

alter table public.pulse_opportunities
  drop constraint if exists pulse_opportunities_display_applied_count_check;

alter table public.pulse_opportunities
  add constraint pulse_opportunities_display_applied_count_check
  check (display_applied_count between 0 and 9999);

comment on column public.pulse_opportunities.display_applied_count
is 'Public-facing applied count shown on Pulse opportunity cards. This is a managed display value and can be higher than raw application records for social proof.';

update public.pulse_opportunities
set display_applied_count = case opportunity_type
  when 'live_project' then 64 + floor(random() * 55)::integer
  when 'freelance' then 28 + floor(random() * 44)::integer
  when 'challenge' then 92 + floor(random() * 85)::integer
  when 'event' then 120 + floor(random() * 140)::integer
  when 'resume_review' then 42 + floor(random() * 58)::integer
  else 24 + floor(random() * 48)::integer
end
where display_applied_count = 0;
