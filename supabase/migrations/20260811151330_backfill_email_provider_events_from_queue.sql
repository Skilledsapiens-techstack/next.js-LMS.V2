insert into public.email_provider_events (
  provider,
  provider_event_id,
  provider_message_id,
  email_queue_id,
  recipient_email,
  event_type,
  event_status,
  subject,
  tags,
  metadata,
  occurred_at,
  received_at
)
select
  q.provider,
  concat('queue-backfill-', q.id::text, '-', q.status),
  q.provider_message_id,
  q.id,
  lower(nullif(q.recipient_email, '')),
  case
    when q.status = 'clicked' then 'clicked'
    when q.status = 'opened' then 'opened'
    when q.status = 'delivered' then 'delivered'
    when q.status = 'unsubscribed' then 'unsubscribed'
    when q.status = 'deferred' then 'deferred'
    when q.status = 'failed' then 'error'
    else 'sent'
  end as event_type,
  'backfilled_from_queue',
  nullif(q.subject, ''),
  coalesce(q.tags, '{}'::text[]),
  jsonb_build_object(
    'source', 'email_queue_backfill',
    'queueStatus', q.status,
    'backfilledAt', now()
  ),
  coalesce(q.last_event_at, q.sent_at, q.updated_at, q.created_at, now()),
  now()
from public.email_queue q
where q.provider = 'brevo'
  and q.provider_message_id is not null
  and q.provider_message_id <> ''
  and q.status in ('sent', 'delivered', 'opened', 'clicked', 'failed', 'unsubscribed', 'deferred')
  and not exists (
    select 1
    from public.email_provider_events e
    where e.email_queue_id = q.id
      and e.event_type = case
        when q.status = 'clicked' then 'clicked'
        when q.status = 'opened' then 'opened'
        when q.status = 'delivered' then 'delivered'
        when q.status = 'unsubscribed' then 'unsubscribed'
        when q.status = 'deferred' then 'deferred'
        when q.status = 'failed' then 'error'
        else 'sent'
      end
  );
