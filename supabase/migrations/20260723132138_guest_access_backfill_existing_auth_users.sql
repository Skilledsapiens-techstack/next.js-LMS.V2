insert into public.guest_leads (
  auth_user_id,
  full_name,
  personal_email,
  official_email,
  whatsapp_number,
  current_status,
  audience_type,
  college_name,
  education_year,
  company_name,
  current_job_role,
  interested_roles,
  interested_program,
  current_city,
  mentor_allocation_interest,
  email_verified_at,
  created_at,
  updated_at
)
select
  auth_user.id,
  btrim(coalesce(auth_user.raw_user_meta_data ->> 'full_name', split_part(coalesce(auth_user.email, ''), '@', 1), 'Guest')),
  lower(btrim(coalesce(auth_user.email, auth_user.raw_user_meta_data ->> 'personal_email', ''))),
  case
    when lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'audience_type', auth_user.raw_user_meta_data ->> 'current_status', ''))) = 'student'
      then lower(btrim(coalesce(nullif(auth_user.raw_user_meta_data ->> 'official_email', ''), auth_user.email, '')))
    else nullif(lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'official_email', ''))), '')
  end,
  case
    when regexp_replace(coalesce(auth_user.raw_user_meta_data ->> 'whatsapp_number', ''), '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'
      then regexp_replace(coalesce(auth_user.raw_user_meta_data ->> 'whatsapp_number', ''), '[^0-9]', '', 'g')
    else '9999999999'
  end,
  case
    when lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'current_status', 'other'))) in ('student', 'working_professional', 'looking_for_job', 'career_switcher', 'entrepreneur_founder', 'other')
      then lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'current_status', 'other')))
    else 'other'
  end,
  case
    when lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'audience_type', 'other'))) in ('student', 'working_professional', 'other')
      then lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'audience_type', 'other')))
    when lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'current_status', ''))) = 'student'
      then 'student'
    when lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'current_status', ''))) = 'working_professional'
      then 'working_professional'
    else 'other'
  end,
  case
    when lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'audience_type', auth_user.raw_user_meta_data ->> 'current_status', ''))) = 'student'
      then btrim(coalesce(nullif(auth_user.raw_user_meta_data ->> 'college_name', ''), 'Not provided'))
    else nullif(btrim(coalesce(auth_user.raw_user_meta_data ->> 'college_name', '')), '')
  end,
  case
    when lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'audience_type', auth_user.raw_user_meta_data ->> 'current_status', ''))) = 'student'
      then btrim(coalesce(nullif(auth_user.raw_user_meta_data ->> 'education_year', ''), 'Not provided'))
    else nullif(btrim(coalesce(auth_user.raw_user_meta_data ->> 'education_year', '')), '')
  end,
  nullif(btrim(coalesce(auth_user.raw_user_meta_data ->> 'company_name', '')), ''),
  nullif(btrim(coalesce(auth_user.raw_user_meta_data ->> 'current_role', '')), ''),
  coalesce(
    array(
      select jsonb_array_elements_text(
        case
          when jsonb_typeof(auth_user.raw_user_meta_data -> 'interested_roles') = 'array' then auth_user.raw_user_meta_data -> 'interested_roles'
          else '[]'::jsonb
        end
      )
    ),
    '{}'
  ),
  nullif(btrim(coalesce(auth_user.raw_user_meta_data ->> 'interested_program', '')), ''),
  nullif(btrim(coalesce(auth_user.raw_user_meta_data ->> 'current_city', '')), ''),
  case
    when lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'mentor_allocation_interest', 'maybe_later'))) in ('yes_urgently', 'maybe_later', 'no')
      then lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'mentor_allocation_interest', 'maybe_later')))
    else 'maybe_later'
  end,
  auth_user.email_confirmed_at,
  auth_user.created_at,
  now()
from auth.users auth_user
where lower(btrim(coalesce(auth_user.raw_user_meta_data ->> 'lms_signup_type', ''))) = 'guest'
  and lower(btrim(coalesce(auth_user.email, auth_user.raw_user_meta_data ->> 'personal_email', ''))) <> ''
  and not exists (
    select 1
    from public.guest_leads guest
    where guest.auth_user_id = auth_user.id
      or lower(btrim(guest.personal_email)) = lower(btrim(coalesce(auth_user.email, auth_user.raw_user_meta_data ->> 'personal_email', '')))
  )
on conflict do nothing;
