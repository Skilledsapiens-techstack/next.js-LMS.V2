-- The browser roles should not have table maintenance privileges.
-- Normal LMS reads/writes remain controlled by SELECT/INSERT/UPDATE/DELETE
-- grants plus RLS policies.
revoke truncate, trigger, references on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
