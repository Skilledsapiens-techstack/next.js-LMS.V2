with required_tables(table_name) as (
  values
    ('admin_users'),
    ('audit_logs'),
    ('certificate_generation_jobs'),
    ('certificate_requests'),
    ('certificates'),
    ('email_outbox'),
    ('email_queue'),
    ('email_templates'),
    ('enrollment_request_items'),
    ('enrollment_requests'),
    ('enrollment_status_history'),
    ('enrollment_webhook_events'),
    ('error_logs'),
    ('paid_access'),
    ('payment_orders'),
    ('project_submission_requests'),
    ('project_submission_student_limits'),
    ('students'),
    ('student_cohorts'),
    ('student_programs'),
    ('support_ticket_messages'),
    ('support_tickets'),
    ('workshop_recording_candidates'),
    ('workshops')
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
    ('certificate_requests', 'request_id'),
    ('certificate_requests', 'admin_status'),
    ('certificate_requests', 'admin_email'),
    ('certificate_requests', 'admin_reviewed_at'),
    ('certificates', 'certificate_id'),
    ('certificates', 'certificate_type'),
    ('certificates', 'student_email'),
    ('certificates', 'status'),
    ('certificates', 'generation_status'),
    ('certificates', 'pdf_storage_bucket'),
    ('certificates', 'pdf_storage_path'),
    ('certificates', 'pdf_sha256'),
    ('email_outbox', 'idempotency_key'),
    ('email_outbox', 'template_key'),
    ('email_outbox', 'recipient_email'),
    ('email_outbox', 'status'),
    ('email_queue', 'email_key'),
    ('email_queue', 'recipient_email'),
    ('email_queue', 'status'),
    ('email_templates', 'template_key'),
    ('email_templates', 'subject'),
    ('email_templates', 'html_body'),
    ('email_templates', 'text_body'),
    ('enrollment_request_items', 'request_id'),
    ('enrollment_request_items', 'item_id'),
    ('enrollment_requests', 'request_id'),
    ('enrollment_requests', 'payment_id'),
    ('enrollment_requests', 'order_id'),
    ('enrollment_status_history', 'idempotency_key'),
    ('enrollment_webhook_events', 'event_id'),
    ('enrollment_webhook_events', 'payment_id'),
    ('enrollment_webhook_events', 'order_id'),
    ('enrollment_webhook_events', 'status'),
    ('error_logs', 'created_at'),
    ('paid_access', 'access_id'),
    ('paid_access', 'student_email'),
    ('paid_access', 'item_type'),
    ('paid_access', 'item_id'),
    ('payment_orders', 'order_id'),
    ('payment_orders', 'razorpay_order_id'),
    ('payment_orders', 'razorpay_payment_id'),
    ('payment_orders', 'student_email'),
    ('payment_orders', 'status'),
    ('project_submission_requests', 'request_id'),
    ('project_submission_requests', 'student_email'),
    ('project_submission_requests', 'project_id'),
    ('project_submission_requests', 'status'),
    ('project_submission_requests', 'idempotency_key'),
    ('project_submission_student_limits', 'idempotency_key'),
    ('project_submission_student_limits', 'student_email'),
    ('project_submission_student_limits', 'project_id'),
    ('students', 'email'),
    ('student_cohorts', 'idempotency_key'),
    ('student_programs', 'idempotency_key'),
    ('support_ticket_messages', 'ticket_id'),
    ('support_ticket_messages', 'idempotency_key'),
    ('support_tickets', 'ticket_id'),
    ('support_tickets', 'student_email'),
    ('support_tickets', 'status'),
    ('support_tickets', 'idempotency_key'),
    ('workshop_recording_candidates', 'id'),
    ('workshop_recording_candidates', 'workshop_id'),
    ('workshop_recording_candidates', 'status'),
    ('workshops', 'workshop_id'),
    ('workshops', 'workshop_status')
),
table_audit as (
  select
    'required_table' as audit_section,
    required_tables.table_name as object_name,
    case when tables.table_name is null then 'missing' else 'present' end as status,
    null::text as detail
  from required_tables
  left join information_schema.tables tables
    on tables.table_schema = 'public'
    and tables.table_name = required_tables.table_name
),
column_audit as (
  select
    'required_column' as audit_section,
    required_columns.table_name || '.' || required_columns.column_name as object_name,
    case when columns.column_name is null then 'missing' else 'present' end as status,
    columns.data_type::text as detail
  from required_columns
  left join information_schema.columns columns
    on columns.table_schema = 'public'
    and columns.table_name = required_columns.table_name
    and columns.column_name = required_columns.column_name
),
index_audit as (
  select
    'index_or_constraint' as audit_section,
    schemaname || '.' || tablename || '.' || indexname as object_name,
    case when indexdef ilike '%unique%' then 'unique' else 'index' end as status,
    indexdef as detail
  from pg_indexes
  where schemaname = 'public'
    and tablename in (select table_name from required_tables)
),
storage_audit as (
  select
    'storage_bucket' as audit_section,
    id as object_name,
    case when public then 'public' else 'private' end as status,
    name as detail
  from storage.buckets
),
rpc_audit as (
  select
    'rpc_function' as audit_section,
    proname as object_name,
    'present' as status,
    pg_get_function_identity_arguments(pg_proc.oid) as detail
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname like 'lms_%'
)
select audit_section, object_name, status, detail
from table_audit
union all
select audit_section, object_name, status, detail
from column_audit
union all
select audit_section, object_name, status, detail
from index_audit
union all
select audit_section, object_name, status, detail
from storage_audit
union all
select audit_section, object_name, status, detail
from rpc_audit
order by audit_section, object_name;
