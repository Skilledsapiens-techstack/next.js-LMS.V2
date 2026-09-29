alter table public.pulse_opportunities
  add column if not exists club_id uuid references public.pulse_clubs(id) on delete set null;

create index if not exists pulse_opportunities_club_id_idx
  on public.pulse_opportunities(club_id);

comment on column public.pulse_opportunities.club_id
is 'Optional source club for college workspace opportunity filtering. Null means the opportunity is college-wide or global.';
