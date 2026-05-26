import { one, query } from "@landscrape/db";

export async function markBriefJobActive(briefJobId: string, bullmqJobId?: string): Promise<void> {
  await query(
    `UPDATE agent_brief_jobs SET status = 'active', bullmq_job_id = COALESCE($2, bullmq_job_id) WHERE brief_job_id = $1`,
    [briefJobId, bullmqJobId ?? null]
  );
}

export async function completeBriefJob(
  briefJobId: string,
  reportId: string,
  bodyMarkdown: string,
  citations: string[],
  signalIds: string[]
): Promise<void> {
  await query(
    `UPDATE agent_brief_jobs SET status = 'completed', report_id = $2, body_markdown = $3,
     citations = $4::jsonb, signal_ids = $5::jsonb, finished_at = NOW(), error_message = NULL
     WHERE brief_job_id = $1`,
    [briefJobId, reportId, bodyMarkdown, JSON.stringify(citations), JSON.stringify(signalIds)]
  );
}

export async function failBriefJob(briefJobId: string, errorMessage: string): Promise<void> {
  await query(
    `UPDATE agent_brief_jobs SET status = 'failed', error_message = $2, finished_at = NOW() WHERE brief_job_id = $1`,
    [briefJobId, errorMessage]
  );
}

export async function getBriefJobForAgent(tenantId: string, briefJobId: string) {
  return one<{ brief_job_id: string; status: string }>(
    `SELECT brief_job_id, status FROM agent_brief_jobs WHERE tenant_id = $1 AND brief_job_id = $2`,
    [tenantId, briefJobId]
  );
}
