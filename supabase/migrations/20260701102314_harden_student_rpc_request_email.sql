-- Modernize the student RPC request-email helper without changing the access
-- model: service_role may pass p_student_email for server-side lookups, while
-- browser/authenticated calls are resolved from the caller's JWT email.

create or replace function public.lms_request_email(p_student_email text default null::text)
returns text
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select lower(trim(
    case
      when coalesce(auth.jwt() ->> 'role', '') = 'service_role'
        and nullif(trim(p_student_email), '') is not null
        then p_student_email
      else coalesce(auth.jwt() ->> 'email', '')
    end
  ));
$function$;
