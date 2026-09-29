drop policy if exists "Pulse reactions are readable by signed in users" on public.pulse_reactions;
drop policy if exists "Pulse reactions are created by active profiles" on public.pulse_reactions;

create policy "Pulse reactions are readable through visible content"
on public.pulse_reactions
for select
to authenticated
using (
  profile_id = public.pulse_current_profile_id()
  or (select public.admin_has_permission('admin.community.view'))
  or (
    post_id is not null
    and exists (
      select 1
      from public.pulse_posts post
      where post.id = pulse_reactions.post_id
        and post.status = 'published'
        and (
          post.visibility = 'global'
          or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
        )
    )
  )
  or (
    comment_id is not null
    and exists (
      select 1
      from public.pulse_comments comment
      join public.pulse_posts post on post.id = comment.post_id
      where comment.id = pulse_reactions.comment_id
        and comment.status = 'published'
        and post.status = 'published'
        and (
          post.visibility = 'global'
          or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
        )
    )
  )
);

create policy "Pulse reactions are created on visible content by active profiles"
on public.pulse_reactions
for insert
to authenticated
with check (
  profile_id = public.pulse_current_profile_id()
  and (
    (
      post_id is not null
      and exists (
        select 1
        from public.pulse_posts post
        where post.id = pulse_reactions.post_id
          and post.status = 'published'
          and (
            post.visibility = 'global'
            or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
          )
      )
    )
    or (
      comment_id is not null
      and exists (
        select 1
        from public.pulse_comments comment
        join public.pulse_posts post on post.id = comment.post_id
        where comment.id = pulse_reactions.comment_id
          and comment.status = 'published'
          and post.status = 'published'
          and (
            post.visibility = 'global'
            or (post.visibility = 'college' and post.college_id = public.pulse_current_college_id())
          )
      )
    )
  )
);
