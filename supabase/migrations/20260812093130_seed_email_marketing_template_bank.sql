-- Seed reviewed Email Marketing campaign templates and scheduler campaign mappings.
-- These are editable admin templates, not locked system templates.

begin;

insert into public.email_templates (
  template_key,
  template_name,
  phase,
  category,
  subject,
  body,
  description,
  allowed_variables,
  default_tags,
  is_system,
  status,
  sort_order
) values
  (
    'email_marketing_new_resource_added',
    'New Resource Added',
    'resource_share',
    'transactional',
    'New resource added for {{cohort_name}}',
    $body$Hi {{student_name}},

We have added a useful resource for {{cohort_name}}: {{resource_title}}.

This resource is meant to help you revise the current topic, strengthen your understanding, and move ahead with more confidence.

You can access it here:
{{resource_link}}

Please go through it today or keep it saved for your next study slot.

Regards,
Skilled Sapiens Team$body$,
    'Resource sharing template for newly added LMS material.',
    array['student_name','cohort_name','resource_title','resource_link'],
    array['email-marketing','resource-sharing','lms-resource'],
    false,
    'active',
    410
  ),
  (
    'email_marketing_weekly_resource_roundup',
    'Weekly Resource Roundup',
    'resource_share',
    'transactional',
    'Your weekly learning resources are ready',
    $body$Hi {{student_name}},

Here is your weekly resource roundup for {{cohort_name}}.

We recommend spending some focused time on these materials so you can revise, practice, and stay aligned with the learning path.

Start here:
{{resource_link}}

Small, regular revision will make the upcoming sessions and tasks much easier.

Regards,
Skilled Sapiens Team$body$,
    'Weekly learning resource roundup for active cohorts.',
    array['student_name','cohort_name','resource_link'],
    array['email-marketing','resource-sharing','weekly-roundup'],
    false,
    'active',
    420
  ),
  (
    'email_marketing_general_check_in',
    'General Check-in',
    'general',
    'transactional',
    'How is your learning going, {{student_name}}?',
    $body$Hi {{student_name}},

We just wanted to check in and see how your learning journey is going with {{cohort_name}}.

If you have missed anything recently, this is a good time to open the LMS, review your pending items, and continue from where you left off.

LMS link:
{{lms_link}}

If you need help, you can write to us at {{support_email}}.

Regards,
Skilled Sapiens Team$body$,
    'Warm student touch-base for cohorts due for outreach.',
    array['student_name','cohort_name','lms_link','support_email'],
    array['email-marketing','touch-base','check-in'],
    false,
    'active',
    430
  ),
  (
    'email_marketing_keep_going_nudge',
    'Keep Going Nudge',
    'general',
    'transactional',
    'A quick nudge to keep your progress moving',
    $body$Hi {{student_name}},

You are part of {{cohort_name}}, and this is a small reminder to keep your learning momentum active.

Even 20-30 minutes of focused revision or project work today can help you stay on track.

Open your LMS dashboard here:
{{lms_link}}

Keep going. Consistency will matter more than one long study session.

Regards,
Skilled Sapiens Team$body$,
    'Light consistency nudge for active learners.',
    array['student_name','cohort_name','lms_link'],
    array['email-marketing','touch-base','learning-nudge'],
    false,
    'active',
    440
  ),
  (
    'email_marketing_resume_readiness',
    'Resume Readiness',
    'placement',
    'transactional',
    'Is your resume placement-ready?',
    $body$Hi {{student_name}},

As part of {{cohort_name}}, this is a good time to review your resume and make sure it reflects your latest skills, projects, and learning progress.

Please check:
- updated contact details
- current education and experience
- relevant projects
- skills learned through {{program_name}}
- clean formatting and no spelling errors

Use this link to update or review your resume:
{{resource_link}}

Regards,
Skilled Sapiens Team$body$,
    'Placement readiness template for resume/profile updates.',
    array['student_name','cohort_name','program_name','resource_link'],
    array['email-marketing','placement-readiness','resume'],
    false,
    'active',
    450
  ),
  (
    'email_marketing_interview_practice',
    'Interview Practice',
    'placement',
    'transactional',
    'Practice before your next interview opportunity',
    $body$Hi {{student_name}},

Interview readiness improves with regular practice.

We have shared a useful preparation resource for {{cohort_name}} so you can revise common questions, structure better answers, and prepare with more confidence.

Practice resource:
{{resource_link}}

Try to complete one small practice round today.

Regards,
Skilled Sapiens Team$body$,
    'Placement readiness template for interview practice.',
    array['student_name','cohort_name','resource_link'],
    array['email-marketing','placement-readiness','interview-practice'],
    false,
    'active',
    460
  ),
  (
    'email_marketing_we_miss_you',
    'We Miss You',
    'general',
    'transactional',
    'We noticed you have not visited the LMS recently',
    $body$Hi {{student_name}},

We noticed that you have not been active on the LMS recently.

No worries. You can restart from where you left off and continue your learning with {{cohort_name}}.

Open LMS:
{{lms_link}}

If something is blocking your progress, reply to this email or contact us at {{support_email}}.

Regards,
Skilled Sapiens Team$body$,
    'Inactive learner reactivation email.',
    array['student_name','cohort_name','lms_link','support_email'],
    array['email-marketing','inactive-reengagement'],
    false,
    'active',
    470
  ),
  (
    'email_marketing_continue_from_where_you_left',
    'Continue From Where You Left',
    'general',
    'transactional',
    'Continue from where you left off',
    $body$Hi {{student_name}},

Your LMS access is active, and your learning path for {{cohort_name}} is ready.

Today is a good day to resume. Start with the latest available resource or pending activity and complete one small step.

Resume here:
{{lms_link}}

If you need support, contact us at {{support_email}}.

Regards,
Skilled Sapiens Team$body$,
    'Inactive learner restart email.',
    array['student_name','cohort_name','lms_link','support_email'],
    array['email-marketing','inactive-reengagement','resume-learning'],
    false,
    'active',
    480
  ),
  (
    'email_marketing_industry_fun_fact',
    'Industry Fun Fact',
    'general',
    'transactional',
    'A quick fun fact for your learning break',
    $body$Hi {{student_name}},

Here is a quick fun fact for today:

Many successful professionals improve faster because they build a habit of small daily learning, not because they study for long hours once in a while.

Take 15 minutes today to open the LMS and revise one topic from {{cohort_name}}.

Open LMS:
{{lms_link}}

Regards,
Skilled Sapiens Team$body$,
    'Light engagement email for bite-sized learning recall.',
    array['student_name','cohort_name','lms_link'],
    array['email-marketing','fun-fact','engagement'],
    false,
    'active',
    490
  ),
  (
    'email_marketing_did_you_know',
    'Did You Know',
    'general',
    'transactional',
    'Did you know this?',
    $body$Hi {{student_name}},

Did you know that revisiting a concept within 24-48 hours can make recall much stronger?

That means a short revision today can help you remember more from your recent learning sessions.

Open your LMS and revise one topic from {{cohort_name}}:
{{lms_link}}

Regards,
Skilled Sapiens Team$body$,
    'Short fun-fact style learning spark.',
    array['student_name','cohort_name','lms_link'],
    array['email-marketing','fun-fact','learning-spark'],
    false,
    'active',
    500
  ),
  (
    'email_marketing_career_tip_of_the_week',
    'Career Tip of the Week',
    'general',
    'transactional',
    'Career tip of the week for you',
    $body$Hi {{student_name}},

Career tip for this week:

Keep a running list of the skills, tools, and project outcomes you are building through {{program_name}}. This makes resume updates, interviews, and LinkedIn improvements much easier.

Spend a few minutes today updating your notes or profile.

Career resource:
{{resource_link}}

Regards,
Skilled Sapiens Team$body$,
    'Career content template for weekly career guidance.',
    array['student_name','program_name','resource_link'],
    array['email-marketing','career-content','career-tip'],
    false,
    'active',
    510
  ),
  (
    'email_marketing_skill_spotlight',
    'Skill Spotlight',
    'general',
    'transactional',
    'One skill that can improve your career readiness',
    $body$Hi {{student_name}},

This week, focus on one skill from your {{program_name}} learning path and try to connect it with a real project, example, or interview answer.

Learning becomes more valuable when you can explain where and how you applied it.

Explore the recommended material here:
{{resource_link}}

Regards,
Skilled Sapiens Team$body$,
    'Career content template focused on one employability skill.',
    array['student_name','program_name','resource_link'],
    array['email-marketing','career-content','skill-spotlight'],
    false,
    'active',
    520
  ),
  (
    'email_marketing_join_the_discussion',
    'Join the Discussion',
    'general',
    'transactional',
    'Join the latest discussion with your learning community',
    $body$Hi {{student_name}},

Your learning community for {{cohort_name}} is a useful place to ask questions, discuss concepts, and learn from peers.

If you have not participated recently, join the conversation today.

Community link:
{{community_link}}

A small question or contribution can help you and your peers learn better.

Regards,
Skilled Sapiens Team$body$,
    'Community engagement template for discussion participation.',
    array['student_name','cohort_name','community_link'],
    array['email-marketing','community-engagement','discussion'],
    false,
    'active',
    530
  ),
  (
    'email_marketing_ask_share_learn',
    'Ask, Share, Learn',
    'general',
    'transactional',
    'Your cohort community is active today',
    $body$Hi {{student_name}},

Learning becomes stronger when you discuss it with others.

Today, we encourage you to do one simple thing in your {{cohort_name}} community:
- ask one question
- share one learning update
- help one peer

Open community:
{{community_link}}

Regards,
Skilled Sapiens Team$body$,
    'Community engagement template for peer learning.',
    array['student_name','cohort_name','community_link'],
    array['email-marketing','community-engagement','peer-learning'],
    false,
    'active',
    540
  ),
  (
    'email_marketing_project_progress_reminder',
    'Project Progress Reminder',
    'project_submission',
    'transactional',
    'Time to move your project forward',
    $body$Hi {{student_name}},

Your project work is an important part of your learning in {{cohort_name}}.

Please open your project section and complete one meaningful step today. It could be research, structure, implementation, documentation, or submission progress.

Project link:
{{project_link}}

Deadline, if applicable:
{{deadline_date}}

Regards,
Skilled Sapiens Team$body$,
    'Project push template for project progress.',
    array['student_name','cohort_name','project_link','deadline_date'],
    array['email-marketing','project-push','project-progress'],
    false,
    'active',
    550
  ),
  (
    'email_marketing_portfolio_builder',
    'Portfolio Builder',
    'project_submission',
    'transactional',
    'Your project can become a portfolio asset',
    $body$Hi {{student_name}},

The project you build during {{program_name}} can become a strong portfolio asset if you document it properly.

While working on your project, try to include:
- the problem statement
- your approach
- tools or concepts used
- screenshots or output
- final learning outcome

Continue your project here:
{{project_link}}

Regards,
Skilled Sapiens Team$body$,
    'Project push template that positions projects as portfolio assets.',
    array['student_name','program_name','project_link'],
    array['email-marketing','project-push','portfolio'],
    false,
    'active',
    560
  )
on conflict (template_key) do update
set
  template_name = excluded.template_name,
  phase = excluded.phase,
  category = excluded.category,
  subject = excluded.subject,
  body = excluded.body,
  description = excluded.description,
  allowed_variables = excluded.allowed_variables,
  default_tags = excluded.default_tags,
  is_system = excluded.is_system,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

with campaign_seed (
  campaign_key,
  title,
  description,
  phase,
  template_key,
  audience_rules,
  rotation_weight,
  touch_interval_days
) as (
  values
    (
      'email_marketing_new_resource_added',
      'New Resource Added',
      'Share a newly added LMS resource with active cohorts due for outreach.',
      'resource_share',
      'email_marketing_new_resource_added',
      '{"audienceTag":"resource_sharing","cohortStage":"active_learning","activitySegment":"overdue_touch"}'::jsonb,
      120,
      7
    ),
    (
      'email_marketing_weekly_resource_roundup',
      'Weekly Resource Roundup',
      'Share a weekly set of useful revision or practice resources.',
      'resource_share',
      'email_marketing_weekly_resource_roundup',
      '{"audienceTag":"resource_sharing","cohortStage":"active_learning"}'::jsonb,
      105,
      10
    ),
    (
      'email_marketing_general_check_in',
      'General Check-in',
      'Warm relationship-building check-in for cohorts due for a touch.',
      'general',
      'email_marketing_general_check_in',
      '{"audienceTag":"general_touch_base","activitySegment":"overdue_touch"}'::jsonb,
      90,
      21
    ),
    (
      'email_marketing_keep_going_nudge',
      'Keep Going Nudge',
      'Light consistency nudge for active learners.',
      'general',
      'email_marketing_keep_going_nudge',
      '{"audienceTag":"general_touch_base","cohortStage":"active_learning","activitySegment":"overdue_touch"}'::jsonb,
      80,
      15
    ),
    (
      'email_marketing_resume_readiness',
      'Resume Readiness',
      'Prompt students to update resumes and placement profiles.',
      'placement',
      'email_marketing_resume_readiness',
      '{"audienceTag":"placement_readiness","cohortStage":"nearing_completion","resourceType":"placement_resource"}'::jsonb,
      115,
      14
    ),
    (
      'email_marketing_interview_practice',
      'Interview Practice',
      'Share interview practice material for placement preparation.',
      'placement',
      'email_marketing_interview_practice',
      '{"audienceTag":"placement_readiness","cohortStage":"nearing_completion","resourceType":"placement_resource"}'::jsonb,
      110,
      14
    ),
    (
      'email_marketing_we_miss_you',
      'We Miss You',
      'Reactivate inactive students with a warm return-to-LMS message.',
      'general',
      'email_marketing_we_miss_you',
      '{"audienceTag":"inactive_student_reactivation","activitySegment":"overdue_touch"}'::jsonb,
      130,
      7
    ),
    (
      'email_marketing_continue_from_where_you_left',
      'Continue From Where You Left',
      'Help inactive students resume their learning path.',
      'general',
      'email_marketing_continue_from_where_you_left',
      '{"audienceTag":"inactive_student_reactivation","cohortStage":"active_learning","activitySegment":"overdue_touch"}'::jsonb,
      125,
      7
    ),
    (
      'email_marketing_industry_fun_fact',
      'Industry Fun Fact',
      'Send a light bite-sized learning fact to keep engagement warm.',
      'general',
      'email_marketing_industry_fun_fact',
      '{"audienceTag":"general_touch_base","activitySegment":"recently_touched"}'::jsonb,
      45,
      14
    ),
    (
      'email_marketing_did_you_know',
      'Did You Know',
      'Send a small learning spark for regular engagement.',
      'general',
      'email_marketing_did_you_know',
      '{"audienceTag":"general_touch_base","activitySegment":"recently_touched"}'::jsonb,
      40,
      14
    ),
    (
      'email_marketing_career_tip_of_the_week',
      'Career Tip of the Week',
      'Share a practical career habit or tip.',
      'general',
      'email_marketing_career_tip_of_the_week',
      '{"audienceTag":"general_touch_base","cohortStage":"active_learning","resourceType":"placement_resource"}'::jsonb,
      85,
      10
    ),
    (
      'email_marketing_skill_spotlight',
      'Skill Spotlight',
      'Highlight one employability skill and connect it to practice.',
      'general',
      'email_marketing_skill_spotlight',
      '{"audienceTag":"general_touch_base","cohortStage":"active_learning","resourceType":"case_material"}'::jsonb,
      80,
      10
    ),
    (
      'email_marketing_join_the_discussion',
      'Join the Discussion',
      'Encourage students to participate in cohort community discussion.',
      'general',
      'email_marketing_join_the_discussion',
      '{"audienceTag":"general_touch_base","cohortStage":"active_learning"}'::jsonb,
      70,
      14
    ),
    (
      'email_marketing_ask_share_learn',
      'Ask, Share, Learn',
      'Invite students to ask, share, or help peers in the community.',
      'general',
      'email_marketing_ask_share_learn',
      '{"audienceTag":"general_touch_base","activitySegment":"recently_touched"}'::jsonb,
      65,
      14
    ),
    (
      'email_marketing_project_progress_reminder',
      'Project Progress Reminder',
      'Nudge students to move pending project work forward.',
      'project_submission',
      'email_marketing_project_progress_reminder',
      '{"audienceTag":"project_submission_nudge","cohortStage":"active_learning","resourceType":"project_resource"}'::jsonb,
      115,
      7
    ),
    (
      'email_marketing_portfolio_builder',
      'Portfolio Builder',
      'Position project work as a career-ready portfolio asset.',
      'project_submission',
      'email_marketing_portfolio_builder',
      '{"audienceTag":"project_submission_nudge","cohortStage":"nearing_completion","resourceType":"project_resource"}'::jsonb,
      100,
      10
    )
)
insert into public.email_marketing_campaigns (
  campaign_key,
  title,
  description,
  phase,
  template_key,
  default_subject,
  default_body,
  default_resource_ids,
  audience_rules,
  rotation_weight,
  touch_interval_days,
  status
)
select
  campaign_seed.campaign_key,
  campaign_seed.title,
  campaign_seed.description,
  campaign_seed.phase,
  campaign_seed.template_key,
  email_templates.subject,
  email_templates.body,
  '{}'::uuid[],
  campaign_seed.audience_rules,
  campaign_seed.rotation_weight,
  campaign_seed.touch_interval_days,
  'active'
from campaign_seed
join public.email_templates
  on email_templates.template_key = campaign_seed.template_key
on conflict (campaign_key) do update
set
  title = excluded.title,
  description = excluded.description,
  phase = excluded.phase,
  template_key = excluded.template_key,
  default_subject = excluded.default_subject,
  default_body = excluded.default_body,
  audience_rules = excluded.audience_rules,
  rotation_weight = excluded.rotation_weight,
  touch_interval_days = excluded.touch_interval_days,
  status = excluded.status,
  updated_at = now();

commit;
