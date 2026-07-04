-- Refresh system Email Centre templates with cleaner spacing and student-facing copy.

update public.email_templates
set
  subject = 'Welcome to Skilled Sapiens LMS, {{student_name}}',
  body = 'Hi {{student_name}},

Welcome to Skilled Sapiens. Your LMS access is now active.

Your registered program(s):
{{programs}}

Your registered cohort(s):
{{cohorts}}

Cohort communication details:
{{cohort_group_details}}

Open your LMS portal:
{{portal_url}}

Please keep these details handy for live sessions, resources, project submissions, announcements, and support.

Regards,
Skilled Sapiens Team',
  description = 'Sent when a student is onboarded or when pending onboarding mails are processed.',
  allowed_variables = array['student_name','student_email','program','programs','cohort','cohorts','whatsapp_groups','google_groups','cohort_group_details','portal_url'],
  default_tags = array['lms','onboarding'],
  is_system = true,
  status = 'active',
  updated_at = now()
where template_key = 'onboarding_welcome';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your Skilled Sapiens LMS profile is ready.

Create your password using the secure link below:
{{action_link}}

Open LMS:
{{portal_url}}

If you did not request this email, please ignore it.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'portal_invite';

update public.email_templates
set
  body = 'Hi {{student_name}},

We received a request to reset your Skilled Sapiens LMS password.

Use the secure link below:
{{action_link}}

If this was not requested by you, you can ignore this email.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'portal_password_reset';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your live session is scheduled.

Session: {{workshop_title}}
Time: {{workshop_time}}
Cohort: {{cohort}}

Join link:
{{join_url}}

Please join on time and keep your LMS profile updated.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'workshop_link';

update public.email_templates
set
  body = 'Hi {{student_name}},

This is a reminder for your upcoming live session.

Session: {{workshop_title}}
Time: {{workshop_time}}
Cohort: {{cohort}}

Join link:
{{join_url}}

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'session_reminder';

update public.email_templates
set
  body = 'Hi {{student_name}},

The recording for your session is now available in LMS.

Session: {{workshop_title}}
Cohort: {{cohort}}

Recording link:
{{recording_url}}

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'recording_available';

update public.email_templates
set
  body = 'Hi {{student_name}},

A new resource has been shared for your LMS account.

Resource: {{resource_title}}
Program: {{program}}
Cohort: {{cohort}}

Open resource:
{{resource_link}}

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'resource_share';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your Skilled Sapiens certificate {{certificate_id}} is ready.

Download it within 24 hours:
{{certificate_download_url}}

Verify anytime:
{{verification_url}}

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'certificate_ready';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your verified Skilled Sapiens certificate {{certificate_id}} is available.

Download certificate PDF:
{{certificate_download_url}}

Verify anytime:
{{verification_url}}

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'certificate_verified';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your support ticket has been received.

Ticket ID: {{ticket_id}}
Subject: {{ticket_subject}}

Our team will review it and respond from the LMS support section.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'support_ticket_created';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your support ticket has a new reply.

Ticket ID: {{ticket_id}}
Subject: {{ticket_subject}}

Reply:
{{reply_body}}

Open LMS:
{{portal_url}}

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'support_ticket_reply';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your support ticket has been marked resolved.

Ticket ID: {{ticket_id}}
Subject: {{ticket_subject}}

If you still need help, you can raise a new query from LMS Support.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'support_ticket_resolved';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your live project report has been submitted successfully.

Project: {{project_title}}
Role: {{project_role}}
Status: {{submission_status}}

You can track the review status from LMS.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'project_submission_received';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your live project submission has been approved.

Project: {{project_title}}
Role: {{project_role}}

If eligible, your certificate request will move to the certificate review queue.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'project_submission_approved';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your live project submission needs revision.

Project: {{project_title}}
Role: {{project_role}}
Status: {{submission_status}}

Please review the admin feedback in LMS and submit again if attempts remain.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'project_submission_needs_revision';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your payment has been recorded successfully.

Item: {{item_title}}
Amount: {{amount}}
Status: {{payment_status}}

Access will be reflected in LMS once the payment is confirmed.

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'payment_receipt';

update public.email_templates
set
  body = 'Hi {{student_name}},

Your enrollment has been approved.

Program: {{program}}
Cohort: {{cohort}}
Status: {{enrollment_status}}

Open LMS:
{{portal_url}}

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'enrollment_approved';

update public.email_templates
set
  body = 'Hi {{student_name}},

There is an update on your enrollment request.

Program: {{program}}
Cohort: {{cohort}}
Status: {{enrollment_status}}

Open LMS:
{{portal_url}}

Regards,
Skilled Sapiens Team',
  updated_at = now()
where template_key = 'enrollment_update';
