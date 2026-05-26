import { Pool } from "pg";
import { getConfig } from "@landscrape/config";

const config = getConfig();

export const pool = new Pool({
  connectionString: config.databaseUrl
});

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function one<T = unknown>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export interface RecordOllamaUsageParams {
  tenantId: string | null;
  operation: "generate" | "embed" | "agent_turn";
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalDurationNs: number | null;
  referenceType: string | null;
  referenceId: string | null;
  metadata?: Record<string, unknown>;
}

/** Persist Ollama usage counters (best-effort billing / capacity telemetry). */
export async function recordOllamaUsage(params: RecordOllamaUsageParams): Promise<void> {
  const metadata = params.metadata ?? {};
  await pool.query(
    `INSERT INTO ollama_usage_events (
       tenant_id, operation, model, prompt_tokens, completion_tokens, total_duration_ns, reference_type, reference_id, metadata
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      params.tenantId,
      params.operation,
      params.model,
      params.promptTokens,
      params.completionTokens,
      params.totalDurationNs,
      params.referenceType,
      params.referenceId,
      JSON.stringify(metadata)
    ]
  );
}
