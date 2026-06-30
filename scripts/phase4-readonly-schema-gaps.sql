with required_tables(table_name) as (
  values
    ('certificate_generation_jobs'),
    ('email_outbox'),
    ('audit_logs'),
    ('certificates'),
    ('email_templates'),
    ('enrollment_status_history'),
    ('project_submission_requests'),
    ('project_submission_student_limits'),
    ('student_cohorts'),
    ('student_programs'),
    ('support_ticket_messages'),
    ('support_tickets')
),
required_columns(table_name, column_name) as (
  values
    ('audit_logs', 'idempotency_key'),
    ('certificate_generation_jobs', 'idempotency_key'),
    ('certificate_generation_jobs', 'request_id'),
    ('certificate_generation_jobs', 'status'),
    ('certificate_generation_jobs', 'storage_bucket'),
    ('certificate_generation_jobs', 'storage_path'),
    ('certificate_generation_jobs', 'pdf_sha256'),
    ('certificates', 'pdf_storage_bucket'),
    ('certificates', 'pdf_sha256'),
    ('email_outbox', 'idempotency_key'),
    ('email_outbox', 'template_key'),
    ('email_outbox', 'recipient_email'),
    ('email_outbox', 'status'),
    ('email_templates', 'html_body'),
    ('email_templates', 'text_body'),
    ('enrollment_status_history', 'idempotency_key'),
    ('project_submission_requests', 'idempotency_key'),
    ('project_submission_student_limits', 'idempotency_key'),
    ('project_submission_student_limits', 'project_id'),
    ('student_cohorts', 'idempotency_key'),
    ('student_programs', 'idempotency_key'),
    ('support_ticket_messages', 'idempotency_key'),
    ('support_tickets', 'idempotency_key')
),
missing_tables as (
  select
    'missing_table' as gap_type,
    required_tables.table_name as object_name,
    'Required by Phase 4 Supabase write workflow readiness.' as detail
  from required_tables
  left join information_schema.tables tables
    on tables.table_schema = 'public'
    and tables.table_name = required_tables.table_name
  where tables.table_name is null
),
missing_columns as (
  select
    'missing_column' as gap_type,
    required_columns.table_name || '.' || required_columns.column_name as object_name,
    'Required by Phase 4 idempotent write/readiness plan.' as detail
  from required_columns
  left join information_schema.columns columns
    on columns.table_schema = 'public'
    and columns.table_name = required_columns.table_name
    and columns.column_name = required_columns.column_name
  where columns.column_name is null
),
storage_expectations(bucket_id) as (
  values ('certificates-private')
),
storage_gaps as (
  select
    'missing_storage_bucket' as gap_type,
    storage_expectations.bucket_id as object_name,
    'Readiness doc expects private certificate PDF bucket. Existing bucket inventory should be reviewed before renaming code or storage.' as detail
  from storage_expectations
  left join storage.buckets buckets on buckets.id = storage_expectations.bucket_id
  where buckets.id is null
)
select gap_type, object_name, detail
from missing_tables
union all
select gap_type, object_name, detail
from missing_columns
union all
select gap_type, object_name, detail
from storage_gaps
order by gap_type, object_name;
