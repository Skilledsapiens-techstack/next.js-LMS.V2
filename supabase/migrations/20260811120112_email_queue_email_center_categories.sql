alter table public.email_queue
  drop constraint if exists email_queue_category_check;

alter table public.email_queue
  add constraint email_queue_category_check
  check (
    category = any (
      array[
        'auth',
        'transactional',
        'promotional',
        'system',
        'custom',
        'onboarding',
        'workshop_link',
        'reminder',
        'recording_update',
        'resource_share',
        'certificate',
        'support',
        'project_submission',
        'payment',
        'enrollment',
        'placement',
        'general'
      ]::text[]
    )
  );
