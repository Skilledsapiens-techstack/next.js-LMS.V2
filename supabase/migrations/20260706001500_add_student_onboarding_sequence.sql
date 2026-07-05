create sequence if not exists public.students_onboarding_sequence_seq;

alter table public.students
  add column if not exists onboarding_sequence bigint;

with ordered_students as (
  select
    id,
    row_number() over (
      order by coalesce(created_at, updated_at, now()), id
    )::bigint as next_sequence
  from public.students
  where onboarding_sequence is null
)
update public.students as students
set onboarding_sequence = ordered_students.next_sequence
from ordered_students
where students.id = ordered_students.id;

do $$
declare
  max_sequence bigint;
begin
  select max(onboarding_sequence)
  into max_sequence
  from public.students;

  if max_sequence is null then
    perform setval('public.students_onboarding_sequence_seq'::regclass, 1, false);
  else
    perform setval('public.students_onboarding_sequence_seq'::regclass, max_sequence, true);
  end if;
end $$;

alter table public.students
  alter column onboarding_sequence set default nextval('public.students_onboarding_sequence_seq'::regclass);

update public.students
set onboarding_sequence = nextval('public.students_onboarding_sequence_seq'::regclass)
where onboarding_sequence is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_onboarding_sequence_positive'
  ) then
    alter table public.students
      add constraint students_onboarding_sequence_positive
      check (onboarding_sequence is null or onboarding_sequence > 0);
  end if;
end $$;

create unique index if not exists students_onboarding_sequence_key
  on public.students (onboarding_sequence)
  where onboarding_sequence is not null;

create index if not exists students_onboarding_sequence_idx
  on public.students (onboarding_sequence asc);
