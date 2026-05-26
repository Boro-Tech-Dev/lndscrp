import { query } from "@landscrape/db";
import type { ToolContext, ToolInput, ToolResult, IntelligenceTool } from "../types";

export const nativeTenantSignals: IntelligenceTool = {
  id: "native.tenant.signals",
  name: "tenant_signals",
  description: "List recent market intelligence signals for the current tenant workspace (read-only grounding).",
  hipaaLevel: "L2",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", default: 8 },
      signalType: { type: "string", description: "Optional signal_type filter" },
    },
  },
  async execute(input: ToolInput, ctx: ToolContext): Promise<ToolResult> {
    const limit = Math.min(25, Math.max(1, Number(input.limit ?? 8)));
    const signalType = String(input.signalType ?? "").trim();
    const rows = signalType
      ? await query<{ signal_id: string; title: string; summary: string; signal_type: string; importance_score: number }>(
          `SELECT signal_id, title, summary, signal_type, importance_score
           FROM signals WHERE tenant_id = $1 AND signal_type = $2::signal_type
           ORDER BY created_at DESC LIMIT $3`,
          [ctx.tenantId, signalType, limit]
        )
      : await query<{ signal_id: string; title: string; summary: string; signal_type: string; importance_score: number }>(
          `SELECT signal_id, title, summary, signal_type, importance_score
           FROM signals WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [ctx.tenantId, limit]
        );
    const items = rows.map((r) => ({
      signalId: r.signal_id,
      title: r.title,
      signalType: r.signal_type,
      importanceScore: r.importance_score,
      summary: r.summary.slice(0, 300),
    }));
    return {
      ok: true,
      toolId: "native.tenant.signals",
      summary: `Loaded ${items.length} recent tenant signal(s)`,
      data: { count: items.length, items },
    };
  },
};
