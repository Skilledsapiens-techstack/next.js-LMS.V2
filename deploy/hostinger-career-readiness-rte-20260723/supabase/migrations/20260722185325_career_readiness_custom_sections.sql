alter table public.career_readiness_content
  drop constraint if exists career_readiness_category_check;

alter table public.career_readiness_content
  add column if not exists section_title text;

update public.career_readiness_content
set section_title = case category
  when 'cv_points_guide' then 'CV Points Guide'
  when 'sample_cv_points' then 'Sample Approved CV Points'
  when 'resume_resources' then 'Resume Building Resources'
  when 'interview_prep' then 'Interview Prep Resources'
  when 'cv_approval_process' then 'CV Approval Process'
  else initcap(replace(category, '_', ' '))
end
where section_title is null or btrim(section_title) = '';

alter table public.career_readiness_content
  alter column section_title set default 'Custom Section';

alter table public.career_readiness_content
  alter column section_title set not null;

alter table public.career_readiness_content
  add constraint career_readiness_category_key_check check (category ~ '^[a-z0-9][a-z0-9_-]{1,79}$');

alter table public.career_readiness_content
  add constraint career_readiness_section_title_check check (char_length(btrim(section_title)) between 2 and 120);
