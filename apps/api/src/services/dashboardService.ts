import type { DashboardSummary } from "@landscrape/types";
import { one } from "@landscrape/db";
import { countCompetitorProducts } from "../repositories/productRepository";
import { listPendingApprovals } from "../repositories/signalRepository";

export async function getDashboardSummary(tenantId: string): Promise<DashboardSummary> {
  const row = await one<{
    open_signals: string;
    priority_signals: string;
  }>(
    `
    SELECT
      COUNT(*)::text AS open_signals,
      COUNT(*) FILTER (WHERE importance_score >= 80)::text AS priority_signals
    FROM signals
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  return {
    openSignals: Number(row?.open_signals ?? 0),
    prioritySignals: Number(row?.priority_signals ?? 0),
    activeCompetitors: await countCompetitorProducts(tenantId),
    pendingApprovals: await listPendingApprovals(tenantId)
  };
}
