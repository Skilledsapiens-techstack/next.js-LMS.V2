-- Email Centre template cleanup and professional defaults.
-- Keeps system template keys stable while improving copy and onboarding context.

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
    'onboarding_welcome',
    'Onboarding Welcome',
    'onboarding',
    'auth',
    'Welcome to Skilled Sapiens LMS, {{student_name}}',
    'Hi {{student_name}},

Welcome to Skilled Sapiens. Your LMS access is now active.

Registered program(s):
{{programs}}

Registered cohort(s):
{{cohorts}}

Cohort group and communication details:
{{cohort_group_details}}

Open your LMS portal:
{{portal_url}}

Please keep these details handy for live sessions, resources, project submissions, and announcements.

Regards,
Skilled Sapiens Team',
    'Sent when a student is onboarded or when pending onboarding mails are processed.',
    array['student_name','student_email','program','programs','cohort','cohorts','whatsapp_groups','google_groups','cohort_group_details','portal_url'],
    array['lms','onboarding'],
    true,
    'active',
    10
  ),
  (
    'portal_invite',
    'Portal Invite / Create Password',
    'auth',
    'auth',
    'Create your Skilled Sapiens LMS password',
    'Hi {{student_name}},

Your Skilled Sapiens LMS profile is ready.

Create your password using the secure link below:
{{action_link}}

Open LMS:
{{portal_url}}

If you did not request this, please ignore this email.

Regards,
Skilled Sapiens Team',
    'Sent to create a first LMS password for a student.',
    array['student_name','student_email','action_link','portal_url'],
    array['lms','auth','portal-invite'],
    true,
    'active',
    20
  ),
  (
    'portal_password_reset',
    'Portal Password Reset',
    'auth',
    'auth',
    'Reset your Skilled Sapiens LMS password',
    'Hi {{student_name}},

We received a request to reset your Skilled Sapiens LMS password.

Use the secure link below:
{{action_link}}

If this was not requested by you, you can ignore this email.

Regards,
Skilled Sapiens Team',
    'Sent when an existing LMS user requests a password reset.',
    array['student_name','student_email','action_link','portal_url'],
    array['lms','auth','password-reset'],
    true,
    'active',
    30
  ),
  (
    'workshop_link',
    'Workshop Link',
    'workshop_link',
    'transactional',
    'Join link for {{workshop_title}}',
    'Hi {{student_name}},

Your live session is scheduled.

Session: {{workshop_title}}
Time: {{workshop_time}}
Cohort: {{cohort}}

Join link:
{{join_url}}

Please join on time and keep your LMS profile updated.

Regards,
Skilled Sapiens Team',
    'Sent when admins share a workshop join link.',
    array['student_name','workshop_title','workshop_time','join_url','cohort'],
    array['lms','workshop'],
    true,
    'active',
    40
  ),
  (
    'session_reminder',
    'Session Reminder',
    'reminder',
    'transactional',
    'Reminder: {{workshop_title}}',
    'Hi {{student_name}},

This is a reminder for your upcoming live session.

Session: {{workshop_title}}
Time: {{workshop_time}}
Cohort: {{cohort}}

Join link:
{{join_url}}

Regards,
Skilled Sapiens Team',
    'Sent as a reminder before a live session.',
    array['student_name','workshop_title','workshop_time','join_url','cohort'],
    array['lms','reminder','workshop'],
    true,
    'active',
    50
  ),
  (
    'recording_available',
    'Recording Available',
    'recording_update',
    'transactional',
    'Recording available: {{workshop_title}}',
    'Hi {{student_name}},

The recording for your session is now available in LMS.

Session: {{workshop_title}}
Cohort: {{cohort}}

Recording link:
{{recording_url}}

Regards,
Skilled Sapiens Team',
    'Sent when a completed workshop recording is available.',
    array['student_name','workshop_title','recording_url','cohort'],
    array['lms','recording'],
    true,
    'active',
    60
  ),
  (
    'resource_share',
    'Resource Sharing',
    'resource_share',
    'transactional',
    'New resource shared: {{resource_title}}',
    'Hi {{student_name}},

A new resource has been shared for your LMS account.

Resource: {{resource_title}}
Program: {{program}}
Cohort: {{cohort}}

Open resource:
{{resource_link}}

Regards,
Skilled Sapiens Team',
    'Sent when admins share a resource link with students.',
    array['student_name','resource_title','resource_link','program','cohort'],
    array['lms','resource'],
    true,
    'active',
    70
  ),
  (
    'certificate_ready',
    'Certificate Ready',
    'certificate',
    'transactional',
    'Your Skilled Sapiens certificate is ready',
    'Hi {{student_name}},

Your Skilled Sapiens certificate {{certificate_id}} is ready.

Download it within 24 hours:
{{certificate_download_url}}

Verify anytime:
{{verification_url}}

Regards,
Skilled Sapiens Team',
    'Sent when a certificate PDF is ready.',
    array['student_name','student_email','certificate_id','certificate_download_url','verification_url','program','cohort'],
    array['lms','certificate'],
    true,
    'active',
    80
  ),
  (
    'certificate_verified',
    'Certificate Verified',
    'certificate',
    'transactional',
    'Your verified Skilled Sapiens certificate',
    'Hi {{student_name}},

Your verified Skilled Sapiens certificate {{certificate_id}} is available.

Download certificate PDF:
{{certificate_download_url}}

Verify anytime:
{{verification_url}}

Regards,
Skilled Sapiens Team',
    'Sent when a certificate verification/download email is requested.',
    array['student_name','student_email','certificate_id','certificate_download_url','verification_url','program','cohort'],
    array['lms','certificate','verification'],
    true,
    'active',
    90
  )
on conflict (template_key) do update set
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

update public.email_templates
set
  template_name = 'General LMS Announcement',
  phase = 'general',
  category = 'transactional',
  description = 'Reusable template for general LMS announcements.',
  status = coalesce(status, 'active'),
  updated_at = now()
where template_key = 'general_announcement';

update public.email_templates
set
  template_name = 'Payment Confirmation',
  phase = 'payment',
  category = 'transactional',
  description = 'Reusable payment update template.',
  status = 'inactive',
  updated_at = now()
where template_key = 'payment_confirmation';

update public.email_templates
set
  status = 'inactive',
  description = coalesce(description, 'Archived duplicate resource sharing template. Use system Resource Sharing instead.'),
  updated_at = now()
where template_key = 'resource_shared';

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
    'support_ticket_created',
    'Support Ticket Created',
    'support',
    'transactional',
    'Support ticket {{ticket_id}} received',
    'Hi {{student_name}},

Your support ticket has been received.

Ticket ID: {{ticket_id}}
Subject: {{ticket_subject}}

Our team will review it and respond from the LMS support section.

Regards,
Skilled Sapiens Team',
    'Sent to students after creating a support ticket.',
    array['student_name','ticket_id','ticket_subject','portal_url'],
    array['lms','support'],
    true,
    'active',
    100
  ),
  (
    'support_ticket_reply',
    'Support Ticket Reply',
    'support',
    'transactional',
    'Reply on support ticket {{ticket_id}}',
    'Hi {{student_name}},

Your support ticket has a new reply.

Ticket ID: {{ticket_id}}
Subject: {{ticket_subject}}

Reply:
{{reply_body}}

Open LMS:
{{portal_url}}

Regards,
Skilled Sapiens Team',
    'Sent to students when admin replies on a support ticket.',
    array['student_name','ticket_id','ticket_subject','reply_body','portal_url'],
    array['lms','support'],
    true,
    'active',
    110
  ),
  (
    'support_ticket_resolved',
    'Support Ticket Resolved',
    'support',
    'transactional',
    'Support ticket {{ticket_id}} resolved',
    'Hi {{student_name}},

Your support ticket has been marked resolved.

Ticket ID: {{ticket_id}}
Subject: {{ticket_subject}}

If you still need help, you can raise a new query from LMS Support.

Regards,
Skilled Sapiens Team',
    'Sent when a support ticket is resolved or closed.',
    array['student_name','ticket_id','ticket_subject','portal_url'],
    array['lms','support'],
    true,
    'active',
    120
  ),
  (
    'project_submission_received',
    'Project Submission Received',
    'project_submission',
    'transactional',
    'Project submission received: {{project_title}}',
    'Hi {{student_name}},

Your live project report has been submitted successfully.

Project: {{project_title}}
Role: {{project_role}}
Status: {{submission_status}}

You can track the review status from LMS.

Regards,
Skilled Sapiens Team',
    'Sent after a student submits a project.',
    array['student_name','project_title','project_role','submission_status','portal_url'],
    array['lms','project'],
    true,
    'active',
    130
  ),
  (
    'project_submission_approved',
    'Project Submission Approved',
    'project_submission',
    'transactional',
    'Project submission approved: {{project_title}}',
    'Hi {{student_name}},

Your live project submission has been approved.

Project: {{project_title}}
Role: {{project_role}}

If eligible, your certificate request will move to the certificate review queue.

Regards,
Skilled Sapiens Team',
    'Sent after admin approves a project submission.',
    array['student_name','project_title','project_role','submission_status','portal_url'],
    array['lms','project'],
    true,
    'active',
    140
  ),
  (
    'project_submission_needs_revision',
    'Project Submission Needs Revision',
    'project_submission',
    'transactional',
    'Project submission update: {{project_title}}',
    'Hi {{student_name}},

Your live project submission needs revision.

Project: {{project_title}}
Role: {{project_role}}
Status: {{submission_status}}

Please review the admin feedback in LMS and submit again if attempts remain.

Regards,
Skilled Sapiens Team',
    'Sent after admin rejects or requests revision on a project submission.',
    array['student_name','project_title','project_role','submission_status','portal_url'],
    array['lms','project'],
    true,
    'active',
    150
  ),
  (
    'payment_receipt',
    'Payment Receipt',
    'payment',
    'transactional',
    'Payment received for {{item_title}}',
    'Hi {{student_name}},

Your payment has been recorded successfully.

Item: {{item_title}}
Amount: {{amount}}
Status: {{payment_status}}

Access will be reflected in LMS once the payment is confirmed.

Regards,
Skilled Sapiens Team',
    'Sent after a successful paid access payment.',
    array['student_name','item_title','amount','payment_status','portal_url'],
    array['lms','payment'],
    true,
    'active',
    160
  ),
  (
    'enrollment_approved',
    'Enrollment Approved',
    'enrollment',
    'transactional',
    'Your enrollment is approved',
    'Hi {{student_name}},

Your enrollment has been approved.

Program: {{program}}
Cohort: {{cohort}}
Status: {{enrollment_status}}

Open LMS:
{{portal_url}}

Regards,
Skilled Sapiens Team',
    'Sent when an enrollment request is approved.',
    array['student_name','program','cohort','enrollment_status','portal_url'],
    array['lms','enrollment'],
    true,
    'active',
    170
  ),
  (
    'enrollment_update',
    'Enrollment Update',
    'enrollment',
    'transactional',
    'Update on your enrollment request',
    'Hi {{student_name}},

There is an update on your enrollment request.

Program: {{program}}
Cohort: {{cohort}}
Status: {{enrollment_status}}

Open LMS:
{{portal_url}}

Regards,
Skilled Sapiens Team',
    'Sent when an enrollment request is rejected or needs follow-up.',
    array['student_name','program','cohort','enrollment_status','portal_url'],
    array['lms','enrollment'],
    true,
    'active',
    180
  )
on conflict (template_key) do update set
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
