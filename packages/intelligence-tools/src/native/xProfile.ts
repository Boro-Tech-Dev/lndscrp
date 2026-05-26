import { getConfig } from "@landscrape/config";
import { decryptJson } from "@landscrape/crypto";
import { one } from "@landscrape/db";
import { fetchXProfileViaApi, parseCredentialsFromSecrets } from "@landscrape/x-twitter";
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

export const nativeXProfile: IntelligenceTool = {
  id: "native.x.profile",
  name: "x_profile",
  description: "Fetch public X (Twitter) profile metadata for a username via the XActions browser stack.",
  hipaaLevel: "L2",
  inputSchema: {
    type: "object",
    properties: {
      username: { type: "string", description: "X username without @" },
    },
    required: ["username"],
  },
  async execute(input: ToolInput, ctx: ToolContext): Promise<ToolResult> {
    const username = String(input.username ?? "").trim().replace(/^@/, "");
    if (!username) {
      return { ok: false, toolId: "native.x.profile", summary: "Missing username", error: "username required" };
    }
    if (getConfig().xBackend !== "api") {
      return {
        ok: false,
        toolId: "native.x.profile",
        summary: "X profile tool requires LANDSCRAPE_X_BACKEND=api",
        error: "Set LANDSCRAPE_X_BACKEND=api and run the xactions-api service",
      };
    }
    try {
      const merged = await loadTenantSocialSecrets(ctx.tenantId);
      const creds = parseCredentialsFromSecrets(merged);
      const profile = await fetchXProfileViaApi(creds, username);
      return {
        ok: true,
        toolId: "native.x.profile",
        summary: `Profile loaded for @${username}`,
        data: profile,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, toolId: "native.x.profile", summary: "X profile fetch failed", error: msg };
    }
  },
};
