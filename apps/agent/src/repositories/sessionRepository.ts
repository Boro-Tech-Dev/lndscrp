import { one, query, recordOllamaUsage } from "@landscrape/db";

export async function resolveTenantId(tenantSlug: string): Promise<string | null> {
  const row = await one<{ tenant_id: string }>(`SELECT tenant_id FROM tenants WHERE tenant_slug = $1`, [tenantSlug]);
  return row?.tenant_id ?? null;
}

export async function createSession(tenantId: string, userId: string, title: string): Promise<string> {
  const row = await one<{ session_id: string }>(
    `INSERT INTO agent_sessions (tenant_id, user_id, title) VALUES ($1, $2, $3) RETURNING session_id`,
    [tenantId, userId, title]
  );
  if (!row) throw new Error("Failed to create agent session");
  return row.session_id;
}

export async function getSession(sessionId: string, tenantId: string) {
  return one<{ session_id: string; title: string; user_id: string; created_at: string }>(
    `SELECT session_id, title, user_id, created_at FROM agent_sessions WHERE session_id = $1 AND tenant_id = $2`,
    [sessionId, tenantId]
  );
}

export async function listMessages(sessionId: string) {
  return query<{
    message_id: string;
    role: string;
    content: string;
    tool_calls: unknown;
    citations: unknown;
    created_at: string;
  }>(
    `SELECT message_id, role, content, tool_calls, citations, created_at
     FROM agent_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
}

export async function insertMessage(
  sessionId: string,
  role: string,
  content: string,
  toolCalls: unknown[] = [],
  citations: string[] = []
): Promise<string> {
  const row = await one<{ message_id: string }>(
    `INSERT INTO agent_messages (session_id, role, content, tool_calls, citations)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) RETURNING message_id`,
    [sessionId, role, content, JSON.stringify(toolCalls), JSON.stringify(citations)]
  );
  if (!row) throw new Error("Failed to insert agent message");
  await query(`UPDATE agent_sessions SET updated_at = NOW() WHERE session_id = $1`, [sessionId]);
  return row.message_id;
}

export async function recordToolAudit(params: {
  sessionId: string | null;
  tenantId: string;
  toolId: string;
  inputHash: string;
  inputRedacted: Record<string, unknown>;
  status: "ok" | "error" | "denied";
  durationMs: number;
}): Promise<void> {
  await query(
    `INSERT INTO agent_tool_audit (session_id, tenant_id, tool_id, input_hash, input_redacted, status, duration_ms)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6, $7)`,
    [
      params.sessionId,
      params.tenantId,
      params.toolId,
      params.inputHash,
      JSON.stringify(params.inputRedacted),
      params.status,
      params.durationMs,
    ]
  );
}

export { recordOllamaUsage };
