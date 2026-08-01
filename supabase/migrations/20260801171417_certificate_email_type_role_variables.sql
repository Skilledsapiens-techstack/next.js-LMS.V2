update public.email_templates
set
  subject = '{{certificate_type_label}}',
  allowed_variables = (
    select array_agg(variable order by variable_order)
    from (
      select variable, min(variable_order) as variable_order
      from (
        select unnest(coalesce(allowed_variables, array[]::text[])) as variable, generate_subscripts(coalesce(allowed_variables, array[]::text[]), 1) as variable_order
        union all
        values
          ('certificate_type_label', 1000),
          ('project_role', 1001),
          ('live_project_role', 1002)
      ) variables
      group by variable
    ) deduplicated_variables
  ),
  updated_at = now()
where template_key = 'certificate_ready';
