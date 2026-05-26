import { getConfig } from "@landscrape/config";
import { decryptJson } from "@landscrape/crypto";
import { one } from "@landscrape/db";
import { fetchXItems, parseCredentialsFromSecrets } from "@landscrape/x-twitter";
import type { ToolContext, ToolInput, ToolResult } from "../types";
import type { IntelligenceTool } from "../types";

async function loadTenantSocialSecrets(tenantId: string): Promise<Record<string, unknown>> {
  const config = getConfig();
  const row = await one<{ connection_config: Record<string, unknown> }>(
    `SELECT connection_config::jsonb AS connection_config FROM connectors
     WHERE tenant_id = $1 AND connector_type = 'social' AND is_active = TRUE
     ORDER BY connector_name LIMIT 1`,
    [tenantId]
  );
  if (!row) {
    throw new Error("No active social connector configured for this tenant");
  }
  const rawCfg = row.connection_config ?? {};
  let secrets: Record<string, unknown> = {};
  if (typeof rawCfg.encrypted_payload === "string" && rawCfg.encrypted_payload.length > 0 && config.credentialsKey) {
    const dec = decryptJson<Record<string, unknown>>(Buffer.from(rawCfg.encrypted_payload, "base64"), config.credentialsKey);
    if (dec) secrets = dec;
  }
  return { ...rawCfg, ...secrets };
}

export const nativeXSearch: IntelligenceTool = {
  id: "native.x.search",
  name: "x_search",
  description: "Search public posts on X (Twitter) for market intelligence. Returns recent matching posts with links.",
  hipaaLevel: "L2",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "X search query (keywords, hashtags, from:user)" },
      limit: { type: "number", description: "Max posts (1-25)", default: 10 },
    },
    required: ["query"],
  },
  async execute(input: ToolInput, ctx: ToolContext): Promise<ToolResult> {
    const query = String(input.query ?? "").trim();
    if (!query) {
      return { ok: false, toolId: "native.x.search", summary: "Missing query", error: "query required" };
    }
    const limit = Math.min(25, Math.max(1, Number(input.limit ?? 10)));
    try {
      const merged = await loadTenantSocialSecrets(ctx.tenantId);
      parseCredentialsFromSecrets(merged);
      const items = await fetchXItems(
        { provider: "x", mode: "search", query, limit, filter: "latest" },
        merged
      );
      const citations = items
        .filter((i) => i.url)
        .map((i) => ({ title: i.title, url: i.url!, source: "X" }));
      return {
        ok: true,
        toolId: "native.x.search",
        summary: `Found ${items.length} X post(s) for "${query}"`,
        data: { count: items.length, items },
        citations,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, toolId: "native.x.search", summary: "X search failed", error: msg };
    }
  },
};
