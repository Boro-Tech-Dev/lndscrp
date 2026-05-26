import { one, query } from "@landscrape/db";

export interface AgentBriefJobRow {
  brief_job_id: string;
  tenant_id: string;
  title: string;
  signal_limit: number;
  status: string;
  report_id: string | null;
  body_markdown: string | null;
  citations: string[];
  signal_ids: string[];
  error_message: string | null;
}

export async function createBriefJob(
  tenantId: string,
  title: string,
  signalLimit: number,
  briefJobId?: string
): Promise<string> {
  const row = await one<{ brief_job_id: string }>(
    `INSERT INTO agent_brief_jobs (brief_job_id, tenant_id, title, signal_limit, status)
     VALUES (COALESCE($4::uuid, gen_random_uuid()), $1, $2, $3, 'queued')
     RETURNING brief_job_id`,
    [tenantId, title, signalLimit, briefJobId ?? null]
  );
  if (!row) throw new Error("Failed to create brief job");
  return row.brief_job_id;
}

export async function getBriefJob(tenantId: string, briefJobId: string): Promise<AgentBriefJobRow | null> {
  const row = await one<{
    brief_job_id: string;
    tenant_id: string;
    title: string;
    signal_limit: number;
    status: string;
    report_id: string | null;
    body_markdown: string | null;
    citations: unknown;
    signal_ids: unknown;
    error_message: string | null;
  }>(
    `SELECT brief_job_id, tenant_id, title, signal_limit, status, report_id, body_markdown, citations, signal_ids, error_message
     FROM agent_brief_jobs WHERE tenant_id = $1 AND brief_job_id = $2`,
    [tenantId, briefJobId]
  );
  if (!row) return null;
  return {
    ...row,
    citations: Array.isArray(row.citations) ? (row.citations as string[]) : [],
    signal_ids: Array.isArray(row.signal_ids) ? (row.signal_ids as string[]) : [],
  };
}

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
