import { query, one } from "@landscrape/db";

export async function insertJobRun(
  tenantId: string | null,
  jobType: string,
  bullmqJobId: string | undefined,
  payloadRedacted: Record<string, unknown>
): Promise<string> {
  const row = await one<{ job_run_id: string }>(
    `INSERT INTO job_runs (bullmq_job_id, tenant_id, job_type, status, payload_redacted) VALUES ($1, $2, $3, 'active', $4::jsonb) RETURNING job_run_id`,
    [bullmqJobId ?? null, tenantId, jobType, JSON.stringify(payloadRedacted)]
  );
  if (!row) throw new Error("insertJobRun failed");
  return row.job_run_id;
}

export async function completeJobRun(jobRunId: string): Promise<void> {
  await query(`UPDATE job_runs SET status = 'completed', finished_at = NOW() WHERE job_run_id = $1`, [jobRunId]);
}

export async function failJobRun(jobRunId: string, message: string): Promise<void> {
  await query(`UPDATE job_runs SET status = 'failed', error_message = $2, finished_at = NOW() WHERE job_run_id = $1`, [jobRunId, message]);
}
