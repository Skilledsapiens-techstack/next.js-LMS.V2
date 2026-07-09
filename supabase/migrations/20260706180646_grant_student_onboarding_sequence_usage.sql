-- Browser-authenticated admins insert students through PostgREST. The
-- onboarding_sequence column uses this sequence as its default, so the
-- authenticated role needs USAGE to let Postgres evaluate nextval().
grant usage on sequence public.students_onboarding_sequence_seq to authenticated;

-- Keep anonymous users unable to consume or inspect the roster sequence.
revoke all on sequence public.students_onboarding_sequence_seq from anon;
