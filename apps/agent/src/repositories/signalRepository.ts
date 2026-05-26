import { query } from "@landscrape/db";

export async function listRecentSignals(
  tenantId: string,
  limit: number
): Promise<
  Array<{
    signal_id: string;
    title: string;
    summary: string;
    signal_type: string;
    importance_score: number;
  }>
> {
  return query(
    `SELECT signal_id, title, summary, signal_type, importance_score
     FROM signals
     WHERE tenant_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );
}
