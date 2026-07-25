alter table public.career_readiness_content
  add column if not exists link_buttons jsonb not null default '[]'::jsonb;

alter table public.career_readiness_content
  drop constraint if exists career_readiness_link_buttons_array_check;

alter table public.career_readiness_content
  add constraint career_readiness_link_buttons_array_check
  check (jsonb_typeof(link_buttons) = 'array' and jsonb_array_length(link_buttons) <= 8);

update public.career_readiness_content
set link_buttons = case
  when coalesce(btrim(link_url), '') <> '' then jsonb_build_array(
    jsonb_build_object(
      'label',
      coalesce(nullif(btrim(link_label), ''), 'Open resource'),
      'url',
      btrim(link_url)
    )
  )
  else '[]'::jsonb
end
where link_buttons = '[]'::jsonb;
