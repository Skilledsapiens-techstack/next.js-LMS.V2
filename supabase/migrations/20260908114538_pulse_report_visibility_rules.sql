drop policy if exists "Pulse reports are created by active profiles" on public.pulse_reports;

create policy "Pulse reports are created for visible content by active profiles"
on public.pulse_reports
for insert
to authenticated
with check (
  reporter_profile_id = public.pulse_current_profile_id()
  and (
    (
      post_id is not null
      and exists (
        select 1
        from public.pulse_posts post
        where post.id = pulse_reports.post_id
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
        where comment.id = pulse_reports.comment_id
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
