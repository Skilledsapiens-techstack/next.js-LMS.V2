-- Legacy helper retained for backward compatibility, but it should not be a
-- public callable SECURITY DEFINER function.
revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;
