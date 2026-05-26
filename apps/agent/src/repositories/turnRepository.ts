import { one, query } from "@landscrape/db";

export interface AgentTurnRow {
  turn_id: string;
  session_id: string;
  tenant_id: string;
  user_message: string;
  status: string;
  assistant_message: string | null;
  citations: string[];
  error_message: string | null;
  bullmq_job_id: string | null;
}

export async function createAgentTurn(
  tenantId: string,
  sessionId: string,
  userMessage: string,
  turnId?: string
): Promise<string> {
  const row = await one<{ turn_id: string }>(
    `INSERT INTO agent_turns (turn_id, tenant_id, session_id, user_message, status)
     VALUES (COALESCE($4::uuid, gen_random_uuid()), $1, $2, $3, 'queued')
     RETURNING turn_id`,
    [tenantId, sessionId, userMessage, turnId ?? null]
  );
  if (!row) throw new Error("Failed to create agent turn");
  return row.turn_id;
}

export async function getAgentTurn(
  turnId: string,
  tenantId: string,
  sessionId: string
): Promise<AgentTurnRow | null> {
  const row = await one<{
    turn_id: string;
    session_id: string;
    tenant_id: string;
    user_message: string;
    status: string;
    assistant_message: string | null;
    citations: unknown;
    error_message: string | null;
    bullmq_job_id: string | null;
  }>(
    `SELECT turn_id, session_id, tenant_id, user_message, status, assistant_message, citations, error_message, bullmq_job_id
     FROM agent_turns WHERE turn_id = $1 AND tenant_id = $2 AND session_id = $3`,
    [turnId, tenantId, sessionId]
  );
  if (!row) return null;
  const citations = Array.isArray(row.citations) ? (row.citations as string[]) : [];
  return { ...row, citations };
}

export async function markAgentTurnActive(turnId: string, bullmqJobId?: string): Promise<void> {
  await query(
    `UPDATE agent_turns SET status = 'active', bullmq_job_id = COALESCE($2, bullmq_job_id) WHERE turn_id = $1`,
    [turnId, bullmqJobId ?? null]
  );
}

export async function completeAgentTurn(
  turnId: string,
  assistantMessage: string,
  citations: string[]
): Promise<void> {
  await query(
    `UPDATE agent_turns SET status = 'completed', assistant_message = $2, citations = $3::jsonb, finished_at = NOW(), error_message = NULL WHERE turn_id = $1`,
    [turnId, assistantMessage, JSON.stringify(citations)]
  );
}

export async function failAgentTurn(turnId: string, errorMessage: string): Promise<void> {
  await query(
    `UPDATE agent_turns SET status = 'failed', error_message = $2, finished_at = NOW() WHERE turn_id = $1`,
    [turnId, errorMessage]
  );
}

export async function createReportFromBrief(
  tenantId: string,
  title: string,
  bodyMarkdown: string,
  signalIds: string[]
): Promise<string> {
  const report = await one<{ report_id: string }>(
    `INSERT INTO reports (tenant_id, title, report_type, body_markdown, approval_status)
     VALUES ($1, $2, 'executive_brief', $3, 'pending_review')
     RETURNING report_id`,
    [tenantId, title, bodyMarkdown]
  );
  if (!report) throw new Error("Failed to create report");
  for (const signalId of signalIds) {
    await query(
      `INSERT INTO report_signals (report_id, signal_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [report.report_id, signalId]
    );
  }
  return report.report_id;
}
