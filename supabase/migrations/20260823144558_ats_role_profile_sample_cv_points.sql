-- Store admin-configurable sample resume bullet examples per ATS role profile.
-- Resume uploads and extracted resume text remain browser-only.

alter table public.ats_role_profiles
  add column if not exists sample_cv_points jsonb not null default '[]'::jsonb;

alter table public.ats_role_profiles
  drop constraint if exists ats_role_profiles_sample_cv_points_array_check;

alter table public.ats_role_profiles
  add constraint ats_role_profiles_sample_cv_points_array_check
  check (jsonb_typeof(sample_cv_points) = 'array');

with generated_points as (
  select
    profile.id,
    jsonb_build_array(
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[1], 'Analyzed'), 'metric', '500+ records', 'keywords', array[coalesce(profile.keywords[1], 'data analysis'), coalesce(profile.keywords[2], 'reporting')], 'point', format('%s 500+ records for %s and %s, identifying trends and summarizing insights for team review.', initcap(coalesce(profile.action_verbs[1], 'analyzed')), coalesce(profile.keywords[1], 'data analysis'), coalesce(profile.keywords[2], 'reporting'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[2], 'Built'), 'metric', 'weekly dashboard', 'keywords', array[coalesce(profile.keywords[3], 'Excel'), coalesce(profile.keywords[4], 'dashboard')], 'point', format('%s a weekly %s tracker using %s, improving visibility into tasks, owners, and pending follow-ups.', initcap(coalesce(profile.action_verbs[2], 'built')), coalesce(profile.keywords[4], 'dashboard'), coalesce(profile.keywords[3], 'Excel'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[3], 'Coordinated'), 'metric', '6 stakeholders', 'keywords', array[coalesce(profile.keywords[5], 'stakeholder management'), coalesce(profile.keywords[6], 'project coordination')], 'point', format('%s updates across 6 stakeholders for %s, tracking decisions, blockers, and completion timelines.', initcap(coalesce(profile.action_verbs[3], 'coordinated')), coalesce(profile.keywords[5], 'stakeholder management'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[4], 'Prepared'), 'metric', '10-page report', 'keywords', array[coalesce(profile.keywords[7], 'documentation'), coalesce(profile.keywords[8], 'presentation')], 'point', format('%s a 10-page %s and %s pack, converting research findings into clear recommendations.', initcap(coalesce(profile.action_verbs[4], 'prepared')), coalesce(profile.keywords[7], 'documentation'), coalesce(profile.keywords[8], 'presentation'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[5], 'Improved'), 'metric', '20% sample improvement', 'keywords', array[coalesce(profile.keywords[9], 'process improvement'), coalesce(profile.keywords[10], 'workflow optimization')], 'point', format('%s %s tracking, improving sample turnaround time by 20%% through clearer ownership and review checkpoints.', initcap(coalesce(profile.action_verbs[5], 'improved')), coalesce(profile.keywords[9], 'process improvement'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[6], 'Researched'), 'metric', '8 benchmarks', 'keywords', array[coalesce(profile.keywords[11], 'research'), coalesce(profile.keywords[12], 'business analysis')], 'point', format('%s 8 benchmarks for %s, summarizing patterns, gaps, and action points for team discussion.', initcap(coalesce(profile.action_verbs[6], 'researched')), coalesce(profile.keywords[11], 'research'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[7], 'Tracked'), 'metric', 'weekly tracker', 'keywords', array[coalesce(profile.keywords[13], 'performance tracking'), coalesce(profile.keywords[14], 'MIS')], 'point', format('%s weekly %s metrics in an %s sheet, highlighting delays, ownership, and completion status.', initcap(coalesce(profile.action_verbs[7], 'tracked')), coalesce(profile.keywords[13], 'performance tracking'), coalesce(profile.keywords[14], 'MIS'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[8], 'Reviewed'), 'metric', '30+ entries', 'keywords', array[coalesce(profile.keywords[15], 'quality review'), coalesce(profile.keywords[16], 'compliance')], 'point', format('%s 30+ entries for %s and %s, correcting inconsistencies before final submission.', initcap(coalesce(profile.action_verbs[8], 'reviewed')), coalesce(profile.keywords[15], 'quality review'), coalesce(profile.keywords[16], 'compliance'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[9], 'Presented'), 'metric', '5 recommendations', 'keywords', array[coalesce(profile.keywords[17], 'presentation'), coalesce(profile.keywords[18], 'stakeholder management')], 'point', format('%s 5 recommendations for %s, converting analysis into clear next steps and ownership.', initcap(coalesce(profile.action_verbs[9], 'presented')), coalesce(profile.keywords[18], 'stakeholder management'))),
      jsonb_build_object('actionVerb', coalesce(profile.action_verbs[10], 'Documented'), 'metric', '12 action items', 'keywords', array[coalesce(profile.keywords[19], 'documentation'), coalesce(profile.keywords[20], 'process improvement')], 'point', format('%s 12 action items for %s, creating a clear tracker for owners, deadlines, and completion status.', initcap(coalesce(profile.action_verbs[10], 'documented')), coalesce(profile.keywords[20], 'process improvement')))
    ) as sample_cv_points
  from public.ats_role_profiles profile
)
update public.ats_role_profiles profile
set
  sample_cv_points = generated_points.sample_cv_points,
  updated_at = now()
from generated_points
where profile.id = generated_points.id
  and profile.sample_cv_points = '[]'::jsonb;
