create or replace function public.ensure_pulse_profile_college()
returns trigger
language plpgsql
as $$
begin
  if new.college_id is null then
    raise exception 'Pulse profile college is required';
  end if;

  return new;
end;
$$;

drop trigger if exists pulse_profiles_require_college on public.pulse_profiles;

create trigger pulse_profiles_require_college
before insert or update on public.pulse_profiles
for each row
execute function public.ensure_pulse_profile_college();
