do $$
declare
  constraint_record record;
  index_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.certificates'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%certificate_type%'
      and pg_get_constraintdef(oid) ilike '%student_email%'
      and pg_get_constraintdef(oid) ilike '%program_key%'
      and pg_get_constraintdef(oid) not ilike '%project_role%'
      and pg_get_constraintdef(oid) not ilike '%role_name%'
  loop
    execute format('alter table public.certificates drop constraint if exists %I', constraint_record.conname);
  end loop;

  for index_record in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'certificates'
      and indexdef ilike 'create unique index%'
      and indexdef ilike '%certificate_type%'
      and indexdef ilike '%student_email%'
      and indexdef ilike '%program_key%'
      and indexdef not ilike '%project_role%'
      and indexdef not ilike '%role_name%'
  loop
    execute format('drop index if exists public.%I', index_record.indexname);
  end loop;
end $$;

create unique index if not exists certificates_active_leadership_role_unique_idx
  on public.certificates (
    lower(student_email),
    program_key,
    coalesce(nullif(project_role, ''), nullif(role_name, ''), ''),
    coalesce(program_name, '')
  )
  where certificate_type = 'leadership'
    and status <> 'revoked';
