do $$
declare
  realtime_publication_exists boolean;
  target_table regclass;
begin
  select exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  into realtime_publication_exists;

  if not realtime_publication_exists then
    return;
  end if;

  target_table := to_regclass('public.pulse_posts');
  if target_table is not null and not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    where pub.pubname = 'supabase_realtime'
      and rel.prrelid = target_table
  ) then
    alter publication supabase_realtime add table public.pulse_posts;
  end if;

  target_table := to_regclass('public.pulse_comments');
  if target_table is not null and not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    where pub.pubname = 'supabase_realtime'
      and rel.prrelid = target_table
  ) then
    alter publication supabase_realtime add table public.pulse_comments;
  end if;

  target_table := to_regclass('public.pulse_reactions');
  if target_table is not null and not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    where pub.pubname = 'supabase_realtime'
      and rel.prrelid = target_table
  ) then
    alter publication supabase_realtime add table public.pulse_reactions;
  end if;

  target_table := to_regclass('public.pulse_poll_votes');
  if target_table is not null and not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    where pub.pubname = 'supabase_realtime'
      and rel.prrelid = target_table
  ) then
    alter publication supabase_realtime add table public.pulse_poll_votes;
  end if;
end $$;
