alter table public.pulse_club_posts
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by_auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists pulse_club_posts_moderated_at_idx
  on public.pulse_club_posts(moderated_at desc)
  where moderated_at is not null;

comment on column public.pulse_club_posts.moderated_at
is 'Timestamp of the latest moderation action, such as hold, hide, archive, or restore.';

comment on column public.pulse_club_posts.moderated_by_auth_user_id
is 'Auth user id that performed the latest moderation action.';
