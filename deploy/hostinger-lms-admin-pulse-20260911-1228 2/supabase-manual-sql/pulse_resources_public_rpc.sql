-- Apply this in Supabase SQL Editor to make active Resources available inside Pulse.

alter table public.resources
  add column if not exists available_on_pulse boolean not null default false,
  add column if not exists pulse_featured boolean not null default false,
  add column if not exists pulse_category text,
  add column if not exists pulse_visibility text not null default 'all',
  add column if not exists pulse_summary text;

alter table public.resources
  drop constraint if exists resources_pulse_visibility_check,
  add constraint resources_pulse_visibility_check
    check (pulse_visibility in ('all', 'college', 'program'));

update public.resources
set
  available_on_pulse = true,
  pulse_visibility = 'all',
  pulse_category = coalesce(nullif(pulse_category, ''), nullif(resource_domain_key, ''), nullif(resource_type, ''), 'career_starter'),
  pulse_summary = coalesce(nullif(pulse_summary, ''), nullif(description, ''))
where status = 'active';

create index if not exists resources_available_on_pulse_idx
  on public.resources (available_on_pulse, pulse_featured, resource_domain_key, updated_at desc)
  where status = 'active';

create or replace function public.student_pulse_resources(
  p_student_email text default null::text
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  with context as (
    select
      public.lms_student_id_for_request(p_student_email) as student_id,
      public.lms_request_email(p_student_email) as email
  ),
  visible as (
    select
      r.*,
      case
        when r.access_type <> 'paid' then true
        when pa.id is not null then true
        else false
      end as "hasAccess",
      case when r.access_type = 'paid' and pa.id is null then true else false end as locked,
      case when r.access_type = 'paid' and pa.id is null then 'Payment required' else '' end as "lockReason"
    from public.resources r
    cross join context c
    left join public.paid_access pa
      on lower(trim(pa.student_email)) = c.email
     and pa.item_type = 'resource'
     and pa.status = 'active'
     and (pa.item_id = r.resource_id or pa.item_id = r.id::text)
     and (pa.expires_at is null or pa.expires_at > now())
    where c.student_id is not null
      and r.status = 'active'
      and r.available_on_pulse = true
      and r.pulse_visibility = 'all'
    order by
      r.pulse_featured desc,
      coalesce(nullif(r.pulse_category, ''), nullif(r.resource_domain_key, ''), r.resource_type) asc,
      r.updated_at desc
  )
  select coalesce(
    jsonb_agg(
      to_jsonb(visible)
      || jsonb_build_object(
        'url', case when visible.locked then null else visible.url end
      )
    ),
    '[]'::jsonb
  )
  from visible;
$function$;

revoke all on function public.student_pulse_resources(text) from public;
grant execute on function public.student_pulse_resources(text) to authenticated, service_role;

notify pgrst, 'reload schema';
