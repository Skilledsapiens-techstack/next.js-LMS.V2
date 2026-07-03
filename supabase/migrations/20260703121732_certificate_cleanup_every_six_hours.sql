select cron.alter_job(
  job_id := jobid,
  schedule := '0 */6 * * *'
)
from cron.job
where jobname = 'cleanup-expired-certificate-pdfs';
