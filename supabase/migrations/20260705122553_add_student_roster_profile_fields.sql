alter table public.students
  add column if not exists personalmentor text,
  add column if not exists you_are_from text,
  add column if not exists project_start_date date,
  add column if not exists duration text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_personalmentor_allowed'
  ) then
    alter table public.students
      add constraint students_personalmentor_allowed
      check (personalmentor is null or personalmentor in ('Yes', 'No'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_you_are_from_allowed'
  ) then
    alter table public.students
      add constraint students_you_are_from_allowed
      check (you_are_from is null or you_are_from in ('1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', 'Working Professional'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_duration_allowed'
  ) then
    alter table public.students
      add constraint students_duration_allowed
      check (duration is null or duration in ('2 weeks', '4 weeks', '6 weeks', '8 weeks'));
  end if;
end $$;
