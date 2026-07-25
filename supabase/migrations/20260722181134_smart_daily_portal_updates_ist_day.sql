alter table public.portal_update_events
  alter column event_date set default ((now() at time zone 'Asia/Kolkata')::date);

do $$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.record_portal_update_event(text,text,text,text,text,text,text,text[],text[],text[],text,jsonb)'::regprocedure
  );

  function_definition := replace(
    function_definition,
    'current_date',
    '((now() at time zone ''Asia/Kolkata'')::date)'
  );

  execute function_definition;
end $$;
