update public.student_guidance_content
set
  title = 'How you earn certificates',
  updated_at = now()
where content_key = 'certificate_structure'
  and title = 'Understand how you will get certificates';
