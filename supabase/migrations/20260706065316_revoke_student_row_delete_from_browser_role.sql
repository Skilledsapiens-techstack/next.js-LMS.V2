-- Student records are deactivated/updated, not hard-deleted from the LMS UI.
-- Keep mapping-table deletes for cohort/program replacement flows, but block
-- direct student row deletion through browser credentials.
revoke delete on table public.students from authenticated;
