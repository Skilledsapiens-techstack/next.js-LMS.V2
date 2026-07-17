grant execute on function public.lms_student_id_for_request(text) to authenticated;
grant execute on function public.lms_workshop_program_keys(text, text[]) to authenticated;
grant execute on function public.lms_normalized_scope_values(text[]) to authenticated;
grant execute on function public.lms_audience_matches(uuid, text[], text[]) to authenticated;
