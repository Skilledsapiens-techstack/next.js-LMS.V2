-- Student-facing support contact details are managed by Support admins but
-- must be readable by authenticated students on the Support page.
grant select, insert, update on public.support_settings to authenticated;

drop policy if exists "students read active support contact setting" on public.support_settings;
create policy "students read active support contact setting"
on public.support_settings for select to authenticated
using (
  status = 'active'
  and setting_key = 'student_contact'
);
