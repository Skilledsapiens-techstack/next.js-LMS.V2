-- Enforce one LMS portal identity per email/auth user.
--
-- Students and admins each already have their own table-level unique email
-- constraints. This trigger closes the cross-table gap so the same identity
-- cannot be active in both portals.

create or replace function public.prevent_cross_portal_identity_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text;
begin
  normalized_email := lower(btrim(coalesce(new.email, '')));

  if tg_table_name = 'students' then
    if normalized_email <> ''
      and exists (
        select 1
        from public.admin_users admin_user
        where lower(btrim(admin_user.email)) = normalized_email
      )
    then
      raise exception 'This email is already linked to an Admin account. Use another email for Student access.'
        using errcode = '23514';
    end if;

    if new.auth_user_id is not null
      and exists (
        select 1
        from public.admin_users admin_user
        where admin_user.auth_user_id = new.auth_user_id
      )
    then
      raise exception 'This login is already linked to an Admin account. Use another login for Student access.'
        using errcode = '23514';
    end if;
  elsif tg_table_name = 'admin_users' then
    if normalized_email <> ''
      and exists (
        select 1
        from public.students student
        where lower(btrim(student.email)) = normalized_email
      )
    then
      raise exception 'This email is already linked to a Student account. Use another email for Admin access.'
        using errcode = '23514';
    end if;

    if new.auth_user_id is not null
      and exists (
        select 1
        from public.students student
        where student.auth_user_id = new.auth_user_id
      )
    then
      raise exception 'This login is already linked to a Student account. Use another login for Admin access.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_cross_portal_identity_overlap() from public;

drop trigger if exists students_prevent_cross_portal_identity_overlap on public.students;
create trigger students_prevent_cross_portal_identity_overlap
before insert or update of email, auth_user_id
on public.students
for each row
execute function public.prevent_cross_portal_identity_overlap();

drop trigger if exists admin_users_prevent_cross_portal_identity_overlap on public.admin_users;
create trigger admin_users_prevent_cross_portal_identity_overlap
before insert or update of email, auth_user_id
on public.admin_users
for each row
execute function public.prevent_cross_portal_identity_overlap();
