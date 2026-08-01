create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_observability_logs(p_retention interval default interval '7 days')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cutoff timestamptz := now() - p_retention;
  deleted_audit_logs integer := 0;
  deleted_system_event_logs integer := 0;
  deleted_system_alerts integer := 0;
  deleted_cron_run_details integer := 0;
begin
  delete from public.audit_logs
  where created_at < cutoff;
  get diagnostics deleted_audit_logs = row_count;

  delete from public.system_event_logs
  where created_at < cutoff;
  get diagnostics deleted_system_event_logs = row_count;

  delete from public.system_alerts
  where status <> 'open'
    and created_at < cutoff;
  get diagnostics deleted_system_alerts = row_count;

  delete from cron.job_run_details
  where end_time is not null
    and end_time < cutoff;
  get diagnostics deleted_cron_run_details = row_count;

  return jsonb_build_object(
    'cutoff', cutoff,
    'auditLogs', deleted_audit_logs,
    'systemEventLogs', deleted_system_event_logs,
    'systemAlerts', deleted_system_alerts,
    'cronRunDetails', deleted_cron_run_details
  );
end;
$$;

revoke all on function public.cleanup_observability_logs(interval) from public;
revoke all on function public.cleanup_observability_logs(interval) from anon;
revoke all on function public.cleanup_observability_logs(interval) from authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-observability-logs-7-days';

select cron.schedule(
  'cleanup-observability-logs-7-days',
  '15 2 * * *',
  $$select public.cleanup_observability_logs(interval '7 days');$$
);
