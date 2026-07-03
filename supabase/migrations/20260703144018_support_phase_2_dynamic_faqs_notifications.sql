create table if not exists public.support_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category_key text,
  category_name text,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  featured boolean not null default false,
  sort_order integer not null default 100,
  program_keys text[] not null default '{}',
  cohort_names text[] not null default '{}',
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_faqs_status_sort_idx
  on public.support_faqs (status, featured desc, sort_order, created_at desc);

create index if not exists support_faqs_program_keys_gin_idx
  on public.support_faqs using gin (program_keys);

create index if not exists support_faqs_cohort_names_gin_idx
  on public.support_faqs using gin (cohort_names);

alter table public.support_faqs enable row level security;

grant select, insert, update on table public.support_faqs to authenticated;

drop policy if exists "support faqs readable by authenticated users" on public.support_faqs;
create policy "support faqs readable by authenticated users"
on public.support_faqs
for select
to authenticated
using (status = 'published' or public.is_active_admin());

drop policy if exists "support faqs managed by active admins" on public.support_faqs;
create policy "support faqs managed by active admins"
on public.support_faqs
for all
to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists "support emails can be queued by active admins" on public.email_queue;
create policy "support emails can be queued by active admins"
on public.email_queue
for insert
to authenticated
with check (
  public.is_active_admin()
  and category = 'support'
  and status = 'queued'
  and related_entity_type = 'support_ticket'
  and lower(coalesce(created_by, '')) = public.current_auth_email()
);

create or replace function public.queue_support_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row public.support_tickets%rowtype;
  has_prior_message boolean;
begin
  if tg_table_name = 'support_tickets' then
    insert into public.email_queue (
      category,
      template_key,
      recipient_email,
      recipient_name,
      subject,
      params,
      tags,
      related_entity_type,
      related_entity_id,
      created_by
    )
    select
      'support',
      'support_ticket_created',
      lower(au.email),
      au.full_name,
      'New LMS support ticket: ' || coalesce(new.subject, new.ticket_id, new.id::text),
      jsonb_build_object(
        'ticketId', coalesce(new.ticket_id, new.id::text),
        'subject', new.subject,
        'category', new.category_name,
        'priority', new.priority,
        'studentName', new.student_name,
        'studentEmail', new.student_email
      ),
      array['lms', 'support', 'admin-notification'],
      'support_ticket',
      new.id::text,
      coalesce(new.student_email, 'system')
    from public.admin_users au
    where au.status = 'active'
      and au.email is not null;

    return new;
  end if;

  if tg_table_name = 'support_ticket_messages' and new.author_role = 'student' then
    select * into ticket_row
    from public.support_tickets
    where id = new.ticket_id;

    select exists (
      select 1
      from public.support_ticket_messages sm
      where sm.ticket_id = new.ticket_id
        and sm.id <> new.id
        and sm.created_at <= new.created_at
    ) into has_prior_message;

    if ticket_row.id is not null and has_prior_message then
      insert into public.email_queue (
        category,
        template_key,
        recipient_email,
        recipient_name,
        subject,
        params,
        tags,
        related_entity_type,
        related_entity_id,
        created_by
      )
      select
        'support',
        'support_student_reply',
        lower(au.email),
        au.full_name,
        'Student replied on support ticket: ' || coalesce(ticket_row.subject, ticket_row.ticket_id, ticket_row.id::text),
        jsonb_build_object(
          'ticketId', coalesce(ticket_row.ticket_id, ticket_row.id::text),
          'subject', ticket_row.subject,
          'category', ticket_row.category_name,
          'priority', ticket_row.priority,
          'studentName', ticket_row.student_name,
          'studentEmail', ticket_row.student_email,
          'replyPreview', left(coalesce(new.body, ''), 300)
        ),
        array['lms', 'support', 'admin-notification'],
        'support_ticket',
        ticket_row.id::text,
        coalesce(new.author_email, ticket_row.student_email, 'system')
      from public.admin_users au
      where au.status = 'active'
        and au.email is not null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists support_ticket_admin_notification on public.support_tickets;
create trigger support_ticket_admin_notification
after insert on public.support_tickets
for each row execute function public.queue_support_admin_notification();

drop trigger if exists support_ticket_message_admin_notification on public.support_ticket_messages;
create trigger support_ticket_message_admin_notification
after insert on public.support_ticket_messages
for each row execute function public.queue_support_admin_notification();

insert into public.support_faqs (question, answer, category_key, category_name, status, featured, sort_order)
values
  (
    'What should I do if my program or cohort is missing?',
    'Raise a support query with your registered LMS email, program name, and cohort name so the team can verify your access mapping.',
    'login_access',
    'Login / Access',
    'published',
    true,
    10
  ),
  (
    'Why can I not see a recording or resource?',
    'Recordings and resources are shown based on active program and cohort access. If an expected item is missing, share the item name and your cohort details in a support ticket.',
    'resources',
    'Resources',
    'published',
    false,
    20
  ),
  (
    'How should I report a live project submission issue?',
    'Use the Live Project category and include the project title, role, cohort, report link, and the exact issue you are facing.',
    'live_project',
    'Live Project',
    'published',
    false,
    30
  )
on conflict do nothing;
